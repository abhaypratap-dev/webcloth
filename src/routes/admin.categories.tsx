import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "@/lib/api";
import {
  Btn, Chip, EditorPanel, Input, PageHead, Select, Table, Td, TextArea,
  Toggle, useAdminList, useAdminMutation, useEditor, useInvalidate,
} from "@/components/admin/kit";

export const Route = createFileRoute("/admin/categories")({
  component: AdminCategories,
});

type Category = {
  id: number;
  name: string;
  slug: string;
  parent: number | null;
  description: string;
  is_active: boolean;
  sort_order: number;
  products_count: number;
};

function AdminCategories() {
  const { data: categories, isLoading } = useAdminList<Category>("categories", "/categories/");
  const editor = useEditor<Category>();
  const mutation = useAdminMutation(["categories"]);

  return (
    <div>
      <PageHead
        title="Categories"
        subtitle="Parent categories and subcategories"
        action={<Btn variant="primary" onClick={() => editor.open("new")}>+ New category</Btn>}
      />
      {isLoading ? (
        <div className="text-eyebrow">Loading</div>
      ) : (
        <Table headers={["Name", "Slug", "Parent", "Products", "Status", "Order", ""]}>
          {(categories ?? []).map((c) => (
            <tr key={c.id}>
              <Td className="font-medium">{c.name}</Td>
              <Td className="text-muted-foreground">{c.slug}</Td>
              <Td className="text-muted-foreground">
                {c.parent ? categories?.find((x) => x.id === c.parent)?.name ?? c.parent : "—"}
              </Td>
              <Td>{c.products_count}</Td>
              <Td><Chip tone={c.is_active ? "good" : "bad"}>{c.is_active ? "Active" : "Hidden"}</Chip></Td>
              <Td>{c.sort_order}</Td>
              <Td>
                <div className="flex gap-2">
                  <Btn onClick={() => editor.open(c)}>Edit</Btn>
                  <Btn
                    variant="danger"
                    onClick={() => {
                      if (confirm(`Delete "${c.name}"?`)) {
                        mutation.mutate({ path: `/categories/${c.slug}/`, method: "DELETE" });
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
        <CategoryEditor
          category={editor.editing === "new" ? null : editor.editing}
          all={categories ?? []}
          onClose={editor.close}
        />
      )}
    </div>
  );
}

function CategoryEditor({
  category,
  all,
  onClose,
}: {
  category: Category | null;
  all: Category[];
  onClose: () => void;
}) {
  const [form, setForm] = useState(
    category ?? { name: "", slug: "", parent: null as number | null, description: "", is_active: true, sort_order: 0 },
  );
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidate(["categories"]);

  async function save() {
    setError(null);
    try {
      if (category) {
        await api(`/categories/${category.slug}/`, { method: "PATCH", body: form });
      } else {
        await api("/categories/", { method: "POST", body: form });
      }
      invalidate();
      onClose();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <EditorPanel title={category ? `Edit — ${category.name}` : "New category"} onClose={onClose}>
      <div className="space-y-4">
        <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input label="Slug (auto if empty)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        <Select
          label="Parent category"
          value={String(form.parent ?? "")}
          options={[
            { value: "", label: "— top level —" },
            ...all
              .filter((c) => c.id !== category?.id)
              .map((c) => ({ value: String(c.id), label: c.name })),
          ]}
          onChange={(e) => setForm({ ...form, parent: e.target.value ? Number(e.target.value) : null })}
        />
        <TextArea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="flex items-center gap-8">
          <Input label="Sort order" type="number" value={form.sort_order}
            onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
          <Toggle label="Active" checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-3 pt-4 border-t border-hairline">
          <Btn variant="primary" onClick={save}>{category ? "Save" : "Create"}</Btn>
          <Btn onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </EditorPanel>
  );
}
