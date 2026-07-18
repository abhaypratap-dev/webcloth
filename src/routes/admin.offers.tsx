import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "@/lib/api";
import {
  Btn, Chip, EditorPanel, Input, PageHead, Select, Table, Td, Toggle,
  useAdminList, useAdminMutation, useEditor, useInvalidate,
} from "@/components/admin/kit";

export const Route = createFileRoute("/admin/offers")({
  component: AdminOffers,
});

type Offer = {
  id: number;
  name: string;
  kind: "product" | "category" | "seasonal" | "festival" | "flash";
  discount_type: "percent" | "fixed";
  discount_value: string;
  products: number[];
  categories: number[];
  start_at: string;
  end_at: string | null;
  is_active: boolean;
  is_live: boolean;
};

type Option = { id: number; name: string; slug?: string; title?: string };

const KIND_LABELS = {
  product: "Product", category: "Category", seasonal: "Seasonal",
  festival: "Festival", flash: "Flash sale",
};

function AdminOffers() {
  const { data: offers, isLoading } = useAdminList<Offer>("offers", "/offers/?page_size=100");
  const { data: categories } = useAdminList<Option>("categories", "/categories/");
  const { data: products } = useAdminList<Option>("products-min", "/products/?page_size=100");
  const editor = useEditor<Offer>();
  const mutation = useAdminMutation(["offers"]);

  return (
    <div>
      <PageHead
        title="Offers"
        subtitle="Automatic discounts applied storefront-wide"
        action={<Btn variant="primary" onClick={() => editor.open("new")}>+ New offer</Btn>}
      />
      {isLoading ? (
        <div className="text-eyebrow">Loading</div>
      ) : (
        <Table headers={["Name", "Type", "Discount", "Window", "Status", ""]}>
          {(offers ?? []).map((o) => (
            <tr key={o.id}>
              <Td className="font-medium">{o.name}</Td>
              <Td>{KIND_LABELS[o.kind]}</Td>
              <Td>{o.discount_type === "percent" ? `${o.discount_value}%` : `₹${o.discount_value}`}</Td>
              <Td className="text-muted-foreground text-xs">
                {new Date(o.start_at).toLocaleDateString()} → {o.end_at ? new Date(o.end_at).toLocaleDateString() : "∞"}
              </Td>
              <Td><Chip tone={o.is_live ? "good" : "default"}>{o.is_live ? "Live" : "Scheduled"}</Chip></Td>
              <Td>
                <div className="flex gap-2">
                  <Btn onClick={() => editor.open(o)}>Edit</Btn>
                  <Btn variant="danger" onClick={() => {
                    if (confirm(`Delete "${o.name}"?`)) mutation.mutate({ path: `/offers/${o.id}/`, method: "DELETE" });
                  }}>Del</Btn>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}

      {editor.editing !== null && (
        <OfferEditor
          offer={editor.editing === "new" ? null : editor.editing}
          categories={categories ?? []}
          products={products ?? []}
          onClose={editor.close}
        />
      )}
    </div>
  );
}

function OfferEditor({
  offer,
  categories,
  products,
  onClose,
}: {
  offer: Offer | null;
  categories: Option[];
  products: Option[];
  onClose: () => void;
}) {
  const [form, setForm] = useState(
    offer ?? {
      name: "", kind: "product" as Offer["kind"], discount_type: "percent" as Offer["discount_type"],
      discount_value: "10", products: [] as number[], categories: [] as number[],
      start_at: new Date().toISOString(), end_at: null as string | null, is_active: true,
    },
  );
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidate(["offers"]);

  async function save() {
    setError(null);
    const body = { ...form, end_at: form.end_at || null };
    try {
      if (offer) await api(`/offers/${offer.id}/`, { method: "PATCH", body });
      else await api("/offers/", { method: "POST", body });
      invalidate();
      onClose();
    } catch (e: any) {
      setError(e.message);
    }
  }

  const scoped = form.kind === "product" || form.kind === "category";

  return (
    <EditorPanel title={offer ? `Edit — ${offer.name}` : "New offer"} onClose={onClose}>
      <div className="space-y-4">
        <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <div className="grid grid-cols-2 gap-4">
          <Select label="Kind" value={form.kind}
            options={Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label }))}
            onChange={(e) => setForm({ ...form, kind: e.target.value as Offer["kind"] })} />
          <Select label="Discount type" value={form.discount_type}
            options={[{ value: "percent", label: "Percentage" }, { value: "fixed", label: "Fixed amount" }]}
            onChange={(e) => setForm({ ...form, discount_type: e.target.value as Offer["discount_type"] })} />
        </div>
        <Input label="Discount value" type="number" min="0" step="0.01" value={form.discount_value}
          onChange={(e) => setForm({ ...form, discount_value: e.target.value })} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Start" type="datetime-local" value={form.start_at.slice(0, 16)}
            onChange={(e) => setForm({ ...form, start_at: new Date(e.target.value).toISOString() })} />
          <Input label="End (optional)" type="datetime-local" value={form.end_at ? form.end_at.slice(0, 16) : ""}
            onChange={(e) => setForm({ ...form, end_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
        </div>

        {scoped && form.kind === "category" && (
          <MultiSelect label="Categories" options={categories.map((c) => ({ id: c.id, label: c.name }))}
            selected={form.categories} onChange={(ids) => setForm({ ...form, categories: ids })} />
        )}
        {scoped && form.kind === "product" && (
          <MultiSelect label="Products" options={products.map((p) => ({ id: p.id, label: p.title ?? p.name }))}
            selected={form.products} onChange={(ids) => setForm({ ...form, products: ids })} />
        )}
        {!scoped && (
          <p className="text-xs text-muted-foreground">
            Seasonal, festival and flash offers apply to the entire catalogue automatically.
          </p>
        )}

        <Toggle label="Active" checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-3 pt-4 border-t border-hairline">
          <Btn variant="primary" onClick={save}>{offer ? "Save" : "Create"}</Btn>
          <Btn onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </EditorPanel>
  );
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { id: number; label: string }[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  return (
    <div>
      <span className="block text-eyebrow mb-1.5 opacity-70">{label}</span>
      <div className="border border-hairline max-h-48 overflow-y-auto p-2 space-y-1">
        {options.map((o) => (
          <label key={o.id} className="flex items-center gap-2 text-sm px-1 py-0.5 cursor-pointer hover:bg-bone/5">
            <input
              type="checkbox"
              checked={selected.includes(o.id)}
              onChange={(e) =>
                onChange(e.target.checked ? [...selected, o.id] : selected.filter((id) => id !== o.id))
              }
              className="accent-current"
            />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}
