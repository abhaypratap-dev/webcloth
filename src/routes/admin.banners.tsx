import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "@/lib/api";
import { resolveAsset } from "@/lib/assets";
import {
  Btn, Chip, EditorPanel, Input, PageHead, Select, Table, Td, Toggle,
  useAdminList, useAdminMutation, useEditor, useInvalidate,
} from "@/components/admin/kit";

export const Route = createFileRoute("/admin/banners")({
  component: AdminBanners,
});

type Banner = {
  id: number;
  kind: "hero" | "promo" | "campaign";
  eyebrow: string;
  title: string;
  subtitle: string;
  cta_text: string;
  cta_link: string;
  external_image_url: string;
  image_url: string;
  is_active: boolean;
  sort_order: number;
};

const KIND_LABELS = { hero: "Hero", promo: "Promotional", campaign: "Campaign" };

function AdminBanners() {
  const { data: banners, isLoading } = useAdminList<Banner>("banners", "/banners/");
  const editor = useEditor<Banner>();
  const mutation = useAdminMutation(["banners"]);

  return (
    <div>
      <PageHead
        title="Homepage"
        subtitle="Hero, promotional and campaign banners"
        action={<Btn variant="primary" onClick={() => editor.open("new")}>+ New banner</Btn>}
      />
      {isLoading ? (
        <div className="text-eyebrow">Loading</div>
      ) : (
        <Table headers={["", "Kind", "Title", "CTA", "Status", "Order", ""]}>
          {(banners ?? []).map((b) => (
            <tr key={b.id}>
              <Td>{b.image_url && <img src={resolveAsset(b.image_url)} alt="" className="h-12 w-20 object-cover" />}</Td>
              <Td><Chip>{KIND_LABELS[b.kind]}</Chip></Td>
              <Td className="font-medium">{b.title}</Td>
              <Td className="text-muted-foreground">{b.cta_text || "—"}</Td>
              <Td><Chip tone={b.is_active ? "good" : "default"}>{b.is_active ? "Active" : "Off"}</Chip></Td>
              <Td>{b.sort_order}</Td>
              <Td>
                <div className="flex gap-2">
                  <Btn onClick={() => editor.open(b)}>Edit</Btn>
                  <Btn variant="danger" onClick={() => {
                    if (confirm("Delete this banner?")) mutation.mutate({ path: `/banners/${b.id}/`, method: "DELETE" });
                  }}>Del</Btn>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}

      {editor.editing !== null && (
        <BannerEditor banner={editor.editing === "new" ? null : editor.editing} onClose={editor.close} />
      )}
    </div>
  );
}

function BannerEditor({ banner, onClose }: { banner: Banner | null; onClose: () => void }) {
  const [form, setForm] = useState(
    banner ?? {
      kind: "hero" as Banner["kind"], eyebrow: "", title: "", subtitle: "",
      cta_text: "", cta_link: "/shop", external_image_url: "", is_active: true, sort_order: 0,
    },
  );
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidate(["banners"]);

  async function save() {
    setError(null);
    try {
      if (banner) await api(`/banners/${banner.id}/`, { method: "PATCH", body: form });
      else await api("/banners/", { method: "POST", body: form });
      invalidate();
      onClose();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <EditorPanel title={banner ? "Edit banner" : "New banner"} onClose={onClose}>
      <div className="space-y-4">
        <Select label="Kind" value={form.kind}
          options={Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label }))}
          onChange={(e) => setForm({ ...form, kind: e.target.value as Banner["kind"] })} />
        <Input label="Eyebrow" value={form.eyebrow} onChange={(e) => setForm({ ...form, eyebrow: e.target.value })} />
        <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <Input label="Subtitle" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="CTA text" value={form.cta_text} onChange={(e) => setForm({ ...form, cta_text: e.target.value })} />
          <Input label="CTA link" value={form.cta_link} onChange={(e) => setForm({ ...form, cta_link: e.target.value })} />
        </div>
        <Input label="Image URL" value={form.external_image_url}
          onChange={(e) => setForm({ ...form, external_image_url: e.target.value })}
          placeholder="https://… or /assets/hero-1.jpg" />
        <div className="flex items-center gap-8">
          <Input label="Sort order" type="number" value={form.sort_order}
            onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
          <Toggle label="Active" checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-3 pt-4 border-t border-hairline">
          <Btn variant="primary" onClick={save}>{banner ? "Save" : "Create"}</Btn>
          <Btn onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </EditorPanel>
  );
}
