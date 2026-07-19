import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { resolveAsset } from "@/lib/assets";
import {
  Btn, Chip, EditorPanel, Input, money, PageHead, Select, Table, Td, TextArea,
  Toggle, useAdminList, useAdminMutation, useEditor, useInvalidate,
} from "@/components/admin/kit";

export const Route = createFileRoute("/admin/products")({
  component: AdminProducts,
});

type Variant = {
  id?: number;
  size: string;
  color: string;
  color_hex: string;
  sku: string;
  stock: number;
  low_stock_threshold: number;
};

type AdminProduct = {
  id: number;
  title: string;
  slug: string;
  sku: string | null;
  description: string;
  short_description: string;
  brand: number | null;
  category: number | null;
  subcategory: number | null;
  price: string;
  offer_price: string | null;
  material: string;
  care_instructions: string;
  tags: string[];
  status: "draft" | "active" | "archived";
  featured: boolean;
  new_arrival: boolean;
  best_seller: boolean;
  images: { id: number; url: string; alt: string | null }[];
  variants: Variant[];
  total_stock: number;
};

type Option = { id: number; name: string };

function AdminProducts() {
  const { data: products, isLoading } = useAdminList<AdminProduct>("products", "/products/admin/?page_size=60");
  const { data: categories } = useAdminList<Option>("categories", "/categories/");
  const { data: brands } = useAdminList<Option>("brands", "/brands/");
  const editor = useEditor<AdminProduct>();
  const mutation = useAdminMutation(["products", "inventory", "stats"]);

  return (
    <div>
      <PageHead
        title="Products"
        subtitle={`${products?.length ?? 0} products`}
        action={<Btn variant="primary" onClick={() => editor.open("new")}>+ New product</Btn>}
      />
      {isLoading ? (
        <div className="text-eyebrow">Loading</div>
      ) : (
        <Table headers={["", "Product", "Category", "Price", "Stock", "Status", "Flags", ""]}>
          {(products ?? []).map((p) => (
            <tr key={p.id}>
              <Td>
                {p.images[0] && (
                  <img src={resolveAsset(p.images[0].url)} alt="" className="h-12 w-10 object-cover" />
                )}
              </Td>
              <Td>
                <div className="font-medium">{p.title}</div>
                <div className="text-xs text-muted-foreground">{p.sku ?? p.slug}</div>
              </Td>
              <Td className="text-muted-foreground">
                {categories?.find((c) => c.id === p.category)?.name ?? "—"}
              </Td>
              <Td>
                {money(p.price)}
                {p.offer_price && <div className="text-xs text-muted-foreground">offer {money(p.offer_price)}</div>}
              </Td>
              <Td>
                <Chip tone={p.total_stock === 0 ? "bad" : p.total_stock <= 10 ? "warn" : "default"}>
                  {p.total_stock}
                </Chip>
              </Td>
              <Td>
                <Chip tone={p.status === "active" ? "good" : p.status === "draft" ? "warn" : "default"}>
                  {p.status}
                </Chip>
              </Td>
              <Td className="space-x-1 whitespace-nowrap">
                {p.featured && <Chip>Feat</Chip>}
                {p.new_arrival && <Chip>New</Chip>}
                {p.best_seller && <Chip>Best</Chip>}
              </Td>
              <Td>
                <div className="flex gap-2">
                  <Btn onClick={() => editor.open(p)}>Edit</Btn>
                  <Btn
                    variant="danger"
                    onClick={() => {
                      if (confirm(`Delete "${p.title}"?`)) {
                        mutation.mutate({ path: `/products/admin/${p.id}/`, method: "DELETE" });
                      }
                    }}
                  >
                    Del
                  </Btn>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}

      {editor.editing !== null && (
        <ProductEditor
          product={editor.editing === "new" ? null : editor.editing}
          categories={categories ?? []}
          brands={brands ?? []}
          onClose={editor.close}
        />
      )}
    </div>
  );
}

const EMPTY: Omit<AdminProduct, "id" | "images" | "total_stock"> = {
  title: "", slug: "", sku: "", description: "", short_description: "",
  brand: null, category: null, subcategory: null, price: "0", offer_price: null,
  material: "", care_instructions: "", tags: [], status: "active",
  featured: false, new_arrival: false, best_seller: false, variants: [],
};

function ProductEditor({
  product,
  categories,
  brands,
  onClose,
}: {
  product: AdminProduct | null;
  categories: Option[];
  brands: Option[];
  onClose: () => void;
}) {
  const [form, setForm] = useState(() =>
    product
      ? { ...product, variants: product.variants.map((v) => ({ ...v })) }
      : { ...EMPTY, variants: [] as Variant[] },
  );
  const [imageUrl, setImageUrl] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidate(["products", "inventory", "stats"]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const pendingPreviews = useMemo(
    () => pendingFiles.map((f) => URL.createObjectURL(f)),
    [pendingFiles],
  );
  useEffect(() => () => pendingPreviews.forEach((url) => URL.revokeObjectURL(url)), [pendingPreviews]);

  async function uploadFiles(productId: number, files: File[]) {
    if (files.length === 0) return;
    const body = new FormData();
    files.forEach((f) => body.append("images", f));
    await api(`/products/admin/${productId}/images/`, { method: "POST", body });
  }

  async function save() {
    setError(null);
    const body = {
      ...form,
      sku: form.sku || null,
      offer_price: form.offer_price || null,
      tags: typeof form.tags === "string"
        ? (form.tags as unknown as string).split(",").map((t) => t.trim()).filter(Boolean)
        : form.tags,
    };
    try {
      if (product) {
        await api(`/products/admin/${product.id}/`, { method: "PATCH", body });
      } else {
        const created = await api<{ id: number }>("/products/admin/", { method: "POST", body });
        if (imageUrl) {
          await api(`/products/admin/${created.id}/images/`, {
            method: "POST",
            body: { external_url: imageUrl, alt: form.title, sort_order: 0 },
          });
        }
        await uploadFiles(created.id, pendingFiles);
      }
      invalidate();
      onClose();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function addImage() {
    if (!product || !imageUrl) return;
    await api(`/products/admin/${product.id}/images/`, {
      method: "POST",
      body: { external_url: imageUrl, alt: form.title },
    });
    setImageUrl("");
    invalidate();
  }

  async function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    if (product) {
      setUploading(true);
      setError(null);
      try {
        await uploadFiles(product.id, files);
        invalidate();
      } catch (err: any) {
        setError(err.message);
      } finally {
        setUploading(false);
      }
    } else {
      setPendingFiles((prev) => [...prev, ...files]);
    }
  }

  function removePendingFile(index: number) {
    setPendingFiles((files) => files.filter((_, i) => i !== index));
  }

  async function removeImage(imageId: number) {
    if (!product) return;
    await api(`/products/admin/${product.id}/images/${imageId}/`, { method: "DELETE" });
    invalidate();
  }

  const catOptions = [{ value: "", label: "—" }, ...categories.map((c) => ({ value: String(c.id), label: c.name }))];

  return (
    <EditorPanel title={product ? `Edit — ${product.title}` : "New product"} onClose={onClose}>
      <div className="space-y-4">
        <Input label="Title" value={form.title} onChange={(e) => set("title", e.target.value)} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Slug (auto if empty)" value={form.slug} onChange={(e) => set("slug", e.target.value)} />
          <Input label="SKU" value={form.sku ?? ""} onChange={(e) => set("sku", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Price" type="number" min="0" step="0.01" value={form.price} onChange={(e) => set("price", e.target.value)} />
          <Input label="Offer price (optional)" type="number" min="0" step="0.01" value={form.offer_price ?? ""} onChange={(e) => set("offer_price", e.target.value || null)} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Select label="Category" value={String(form.category ?? "")} options={catOptions}
            onChange={(e) => set("category", e.target.value ? Number(e.target.value) : null)} />
          <Select label="Subcategory" value={String(form.subcategory ?? "")} options={catOptions}
            onChange={(e) => set("subcategory", e.target.value ? Number(e.target.value) : null)} />
          <Select label="Brand" value={String(form.brand ?? "")}
            options={[{ value: "", label: "—" }, ...brands.map((b) => ({ value: String(b.id), label: b.name }))]}
            onChange={(e) => set("brand", e.target.value ? Number(e.target.value) : null)} />
        </div>
        <TextArea label="Short description" value={form.short_description} onChange={(e) => set("short_description", e.target.value)} />
        <TextArea label="Description" value={form.description} onChange={(e) => set("description", e.target.value)} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Material" value={form.material} onChange={(e) => set("material", e.target.value)} />
          <Input label="Tags (comma separated)" value={Array.isArray(form.tags) ? form.tags.join(", ") : form.tags}
            onChange={(e) => set("tags", e.target.value as unknown as string[])} />
        </div>
        <TextArea label="Care instructions" value={form.care_instructions} onChange={(e) => set("care_instructions", e.target.value)} />
        <div className="grid grid-cols-2 gap-4 items-end">
          <Select label="Status" value={form.status}
            options={[
              { value: "active", label: "Active" },
              { value: "draft", label: "Draft" },
              { value: "archived", label: "Archived" },
            ]}
            onChange={(e) => set("status", e.target.value as AdminProduct["status"])} />
          <div className="flex flex-wrap gap-4 pb-2">
            <Toggle label="Featured" checked={form.featured} onChange={(v) => set("featured", v)} />
            <Toggle label="New" checked={form.new_arrival} onChange={(v) => set("new_arrival", v)} />
            <Toggle label="Best seller" checked={form.best_seller} onChange={(v) => set("best_seller", v)} />
          </div>
        </div>

        {/* Images */}
        <div className="border-t border-hairline pt-4">
          <div className="text-eyebrow mb-3">Images</div>
          {product && (
            <div className="flex flex-wrap gap-3 mb-3">
              {product.images.map((img) => (
                <div key={img.id} className="relative group">
                  <img src={resolveAsset(img.url)} alt="" className="h-20 w-16 object-cover border border-hairline" />
                  <button
                    onClick={() => removeImage(img.id)}
                    className="absolute -top-2 -right-2 h-5 w-5 bg-ink border border-hairline text-xs opacity-0 group-hover:opacity-100 transition"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-3">
              {pendingFiles.map((f, i) => (
                <div key={i} className="relative group">
                  <img src={pendingPreviews[i]} alt="" className="h-20 w-16 object-cover border border-hairline opacity-90" />
                  <button
                    onClick={() => removePendingFile(i)}
                    className="absolute -top-2 -right-2 h-5 w-5 bg-ink border border-hairline text-xs opacity-0 group-hover:opacity-100 transition"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <label className="block">
            <span className="block text-eyebrow mb-1.5 opacity-70">Upload files (multiple allowed)</span>
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={uploading}
              onChange={onFilesSelected}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:px-3 file:py-1.5 file:text-[11px] file:uppercase file:tracking-[0.2em] file:border file:border-hairline file:bg-transparent file:text-bone/80 hover:file:border-bone/50 file:cursor-pointer disabled:opacity-40"
            />
          </label>
          {uploading && <p className="mt-2 text-xs text-muted-foreground">Uploading…</p>}
          <div className="flex gap-2 items-end mt-3">
            <div className="flex-1">
              <Input label="…or paste an image URL" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://… or /assets/…" />
            </div>
            {product && <Btn onClick={addImage} disabled={!imageUrl}>Add</Btn>}
          </div>
          {!product && (imageUrl || pendingFiles.length > 0) && (
            <p className="mt-2 text-xs text-muted-foreground">Images will be attached after the product is created.</p>
          )}
        </div>

        {/* Variants */}
        <div className="border-t border-hairline pt-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-eyebrow">Variants (size / colour / stock)</span>
            <Btn onClick={() => set("variants", [...form.variants, { size: "", color: "", color_hex: "", sku: "", stock: 0, low_stock_threshold: 5 }])}>
              + Variant
            </Btn>
          </div>
          <div className="space-y-2">
            {form.variants.map((v, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-center">
                <input value={v.size} placeholder="Size" onChange={(e) => updateVariant(i, "size", e.target.value)}
                  className="bg-transparent border border-hairline px-2 py-1.5 text-sm outline-none focus:border-bone" />
                <input value={v.color} placeholder="Colour" onChange={(e) => updateVariant(i, "color", e.target.value)}
                  className="bg-transparent border border-hairline px-2 py-1.5 text-sm outline-none focus:border-bone" />
                <input value={v.color_hex} placeholder="#hex" onChange={(e) => updateVariant(i, "color_hex", e.target.value)}
                  className="bg-transparent border border-hairline px-2 py-1.5 text-sm outline-none focus:border-bone" />
                <input type="number" min={0} value={v.stock} placeholder="Stock" onChange={(e) => updateVariant(i, "stock", Number(e.target.value))}
                  className="bg-transparent border border-hairline px-2 py-1.5 text-sm outline-none focus:border-bone" />
                <Btn variant="danger" onClick={() => set("variants", form.variants.filter((_, j) => j !== i))}>×</Btn>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-3 pt-4 border-t border-hairline">
          <Btn variant="primary" onClick={save}>{product ? "Save changes" : "Create product"}</Btn>
          <Btn onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </EditorPanel>
  );

  function updateVariant(index: number, key: keyof Variant, value: string | number) {
    set(
      "variants",
      form.variants.map((v, i) => (i === index ? { ...v, [key]: value } : v)),
    );
  }
}
