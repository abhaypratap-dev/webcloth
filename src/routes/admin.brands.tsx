import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "@/lib/api";
import {
  Btn, Chip, EditorPanel, Input, PageHead, Table, Td, TextArea, Toggle,
  useAdminList, useAdminMutation, useEditor, useInvalidate,
} from "@/components/admin/kit";

export const Route = createFileRoute("/admin/brands")({
  component: AdminBrands,
});

type Brand = {
  id: number;
  name: string;
  slug: string;
  description: string;
  is_active: boolean;
  products_count: number;
};

function AdminBrands() {
  const { data: brands, isLoading } = useAdminList<Brand>("brands", "/brands/");
  const editor = useEditor<Brand>();
  const mutation = useAdminMutation(["brands"]);

  return (
    <div>
      <PageHead
        title="Brands"
        action={<Btn variant="primary" onClick={() => editor.open("new")}>+ New brand</Btn>}
      />
      {isLoading ? (
        <div className="text-eyebrow">Loading</div>
      ) : (
        <Table headers={["Name", "Slug", "Products", "Status", ""]}>
          {(brands ?? []).map((b) => (
            <tr key={b.id}>
              <Td className="font-medium">{b.name}</Td>
              <Td className="text-muted-foreground">{b.slug}</Td>
              <Td>{b.products_count}</Td>
              <Td><Chip tone={b.is_active ? "good" : "bad"}>{b.is_active ? "Active" : "Hidden"}</Chip></Td>
              <Td>
                <div className="flex gap-2">
                  <Btn onClick={() => editor.open(b)}>Edit</Btn>
                  <Btn
                    variant="danger"
                    onClick={() => {
                      if (confirm(`Delete "${b.name}"?`)) {
                        mutation.mutate({ path: `/brands/${b.slug}/`, method: "DELETE" });
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
        <BrandEditor brand={editor.editing === "new" ? null : editor.editing} onClose={editor.close} />
      )}
    </div>
  );
}

function BrandEditor({ brand, onClose }: { brand: Brand | null; onClose: () => void }) {
  const [form, setForm] = useState(brand ?? { name: "", slug: "", description: "", is_active: true });
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidate(["brands"]);

  async function save() {
    setError(null);
    try {
      if (brand) await api(`/brands/${brand.slug}/`, { method: "PATCH", body: form });
      else await api("/brands/", { method: "POST", body: form });
      invalidate();
      onClose();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <EditorPanel title={brand ? `Edit — ${brand.name}` : "New brand"} onClose={onClose}>
      <div className="space-y-4">
        <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input label="Slug (auto if empty)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        <TextArea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <Toggle label="Active" checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-3 pt-4 border-t border-hairline">
          <Btn variant="primary" onClick={save}>{brand ? "Save" : "Create"}</Btn>
          <Btn onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </EditorPanel>
  );
}
