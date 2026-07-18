import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "@/lib/api";
import {
  Btn, Chip, EditorPanel, Input, PageHead, Table, Td, TextArea, Toggle,
  useAdminList, useAdminMutation, useEditor, useInvalidate,
} from "@/components/admin/kit";

export const Route = createFileRoute("/admin/cms")({
  component: AdminCms,
});

type Page = {
  id: number;
  title: string;
  slug: string;
  body: string;
  seo_title: string;
  seo_description: string;
  is_published: boolean;
};

type Faq = { id: number; question: string; answer: string; sort_order: number; is_published: boolean };

function AdminCms() {
  const [tab, setTab] = useState<"pages" | "faqs">("pages");
  return (
    <div>
      <PageHead title="CMS" subtitle="Static pages and FAQs" />
      <div className="flex gap-2 mb-6">
        {(["pages", "faqs"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`border px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] transition ${
              tab === t ? "bg-bone text-ink border-bone" : "border-hairline text-bone/70 hover:border-bone/50"
            }`}>
            {t}
          </button>
        ))}
      </div>
      {tab === "pages" ? <PagesPanel /> : <FaqsPanel />}
    </div>
  );
}

function PagesPanel() {
  const { data: pages, isLoading } = useAdminList<Page>("cms-pages", "/cms/pages/");
  const editor = useEditor<Page>();
  const mutation = useAdminMutation(["cms-pages"]);

  return (
    <>
      <div className="mb-4"><Btn variant="primary" onClick={() => editor.open("new")}>+ New page</Btn></div>
      {isLoading ? <div className="text-eyebrow">Loading</div> : (
        <Table headers={["Title", "Slug", "Status", ""]}>
          {(pages ?? []).map((p) => (
            <tr key={p.id}>
              <Td className="font-medium">{p.title}</Td>
              <Td className="text-muted-foreground">/{p.slug}</Td>
              <Td><Chip tone={p.is_published ? "good" : "default"}>{p.is_published ? "Published" : "Draft"}</Chip></Td>
              <Td>
                <div className="flex gap-2">
                  <Btn onClick={() => editor.open(p)}>Edit</Btn>
                  <Btn variant="danger" onClick={() => {
                    if (confirm(`Delete "${p.title}"?`)) mutation.mutate({ path: `/cms/pages/${p.slug}/`, method: "DELETE" });
                  }}>Del</Btn>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}
      {editor.editing !== null && (
        <PageEditor page={editor.editing === "new" ? null : editor.editing} onClose={editor.close} />
      )}
    </>
  );
}

function PageEditor({ page, onClose }: { page: Page | null; onClose: () => void }) {
  const [form, setForm] = useState(
    page ?? { title: "", slug: "", body: "", seo_title: "", seo_description: "", is_published: true },
  );
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidate(["cms-pages"]);

  async function save() {
    setError(null);
    try {
      if (page) await api(`/cms/pages/${page.slug}/`, { method: "PATCH", body: form });
      else await api("/cms/pages/", { method: "POST", body: form });
      invalidate();
      onClose();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <EditorPanel title={page ? `Edit — ${page.title}` : "New page"} onClose={onClose}>
      <div className="space-y-4">
        <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <Input label="Slug (auto if empty)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        <TextArea label="Body" value={form.body} rows={10} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        <Input label="SEO title" value={form.seo_title} onChange={(e) => setForm({ ...form, seo_title: e.target.value })} />
        <TextArea label="SEO description" value={form.seo_description} onChange={(e) => setForm({ ...form, seo_description: e.target.value })} />
        <Toggle label="Published" checked={form.is_published} onChange={(v) => setForm({ ...form, is_published: v })} />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-3 pt-4 border-t border-hairline">
          <Btn variant="primary" onClick={save}>{page ? "Save" : "Create"}</Btn>
          <Btn onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </EditorPanel>
  );
}

function FaqsPanel() {
  const { data: faqs, isLoading } = useAdminList<Faq>("cms-faqs", "/cms/faqs/");
  const editor = useEditor<Faq>();
  const mutation = useAdminMutation(["cms-faqs"]);

  return (
    <>
      <div className="mb-4"><Btn variant="primary" onClick={() => editor.open("new")}>+ New FAQ</Btn></div>
      {isLoading ? <div className="text-eyebrow">Loading</div> : (
        <Table headers={["Question", "Order", "Status", ""]}>
          {(faqs ?? []).map((f) => (
            <tr key={f.id}>
              <Td className="font-medium max-w-96 truncate">{f.question}</Td>
              <Td>{f.sort_order}</Td>
              <Td><Chip tone={f.is_published ? "good" : "default"}>{f.is_published ? "Live" : "Hidden"}</Chip></Td>
              <Td>
                <div className="flex gap-2">
                  <Btn onClick={() => editor.open(f)}>Edit</Btn>
                  <Btn variant="danger" onClick={() => {
                    if (confirm("Delete this FAQ?")) mutation.mutate({ path: `/cms/faqs/${f.id}/`, method: "DELETE" });
                  }}>Del</Btn>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}
      {editor.editing !== null && (
        <FaqEditor faq={editor.editing === "new" ? null : editor.editing} onClose={editor.close} />
      )}
    </>
  );
}

function FaqEditor({ faq, onClose }: { faq: Faq | null; onClose: () => void }) {
  const [form, setForm] = useState(faq ?? { question: "", answer: "", sort_order: 0, is_published: true });
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidate(["cms-faqs"]);

  async function save() {
    setError(null);
    try {
      if (faq) await api(`/cms/faqs/${faq.id}/`, { method: "PATCH", body: form });
      else await api("/cms/faqs/", { method: "POST", body: form });
      invalidate();
      onClose();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <EditorPanel title={faq ? "Edit FAQ" : "New FAQ"} onClose={onClose}>
      <div className="space-y-4">
        <Input label="Question" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} />
        <TextArea label="Answer" value={form.answer} rows={5} onChange={(e) => setForm({ ...form, answer: e.target.value })} />
        <div className="flex items-center gap-8">
          <Input label="Sort order" type="number" value={form.sort_order}
            onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
          <Toggle label="Published" checked={form.is_published} onChange={(v) => setForm({ ...form, is_published: v })} />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-3 pt-4 border-t border-hairline">
          <Btn variant="primary" onClick={save}>{faq ? "Save" : "Create"}</Btn>
          <Btn onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </EditorPanel>
  );
}
