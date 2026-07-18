import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "@/lib/api";
import {
  Btn, Chip, EditorPanel, Input, PageHead, Select, Table, Td, TextArea,
  Toggle, useAdminList, useAdminMutation, useEditor, useInvalidate,
} from "@/components/admin/kit";

export const Route = createFileRoute("/admin/coupons")({
  component: AdminCoupons,
});

type Coupon = {
  id: number;
  code: string;
  description: string;
  discount_type: "percent" | "flat" | "free_shipping";
  discount_value: string;
  min_order_value: string;
  max_discount: string | null;
  usage_limit: number | null;
  per_user_limit: number | null;
  used_count: number;
  is_active: boolean;
  expires_at: string | null;
  is_expired: boolean;
};

const TYPE_LABELS = { percent: "% off", flat: "Flat", free_shipping: "Free ship" };

function AdminCoupons() {
  const { data: coupons, isLoading } = useAdminList<Coupon>("coupons", "/coupons/?page_size=100");
  const editor = useEditor<Coupon>();
  const mutation = useAdminMutation(["coupons"]);

  return (
    <div>
      <PageHead
        title="Coupons"
        action={<Btn variant="primary" onClick={() => editor.open("new")}>+ New coupon</Btn>}
      />
      {isLoading ? (
        <div className="text-eyebrow">Loading</div>
      ) : (
        <Table headers={["Code", "Type", "Value", "Min order", "Used", "Expires", "Status", ""]}>
          {(coupons ?? []).map((c) => (
            <tr key={c.id}>
              <Td className="font-medium">{c.code}</Td>
              <Td>{TYPE_LABELS[c.discount_type]}</Td>
              <Td>{c.discount_type === "free_shipping" ? "—" : c.discount_type === "percent" ? `${c.discount_value}%` : `$${c.discount_value}`}</Td>
              <Td className="text-muted-foreground">${c.min_order_value}</Td>
              <Td>{c.used_count}{c.usage_limit ? ` / ${c.usage_limit}` : ""}</Td>
              <Td className="text-muted-foreground">
                {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "—"}
              </Td>
              <Td>
                <Chip tone={c.is_expired ? "bad" : c.is_active ? "good" : "default"}>
                  {c.is_expired ? "Expired" : c.is_active ? "Active" : "Off"}
                </Chip>
              </Td>
              <Td>
                <div className="flex gap-2">
                  <Btn onClick={() => editor.open(c)}>Edit</Btn>
                  <Btn variant="danger" onClick={() => {
                    if (confirm(`Delete "${c.code}"?`)) mutation.mutate({ path: `/coupons/${c.id}/`, method: "DELETE" });
                  }}>Del</Btn>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}

      {editor.editing !== null && (
        <CouponEditor coupon={editor.editing === "new" ? null : editor.editing} onClose={editor.close} />
      )}
    </div>
  );
}

function CouponEditor({ coupon, onClose }: { coupon: Coupon | null; onClose: () => void }) {
  const [form, setForm] = useState(
    coupon ?? {
      code: "", description: "", discount_type: "percent" as Coupon["discount_type"],
      discount_value: "10", min_order_value: "0", max_discount: null as string | null,
      usage_limit: null as number | null, per_user_limit: null as number | null,
      is_active: true, expires_at: null as string | null,
    },
  );
  const [error, setError] = useState<string | null>(null);
  const invalidate = useInvalidate(["coupons"]);

  async function save() {
    setError(null);
    const body = {
      ...form,
      code: form.code.toUpperCase(),
      max_discount: form.max_discount || null,
      usage_limit: form.usage_limit || null,
      per_user_limit: form.per_user_limit || null,
      expires_at: form.expires_at || null,
    };
    try {
      if (coupon) await api(`/coupons/${coupon.id}/`, { method: "PATCH", body });
      else await api("/coupons/", { method: "POST", body });
      invalidate();
      onClose();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <EditorPanel title={coupon ? `Edit — ${coupon.code}` : "New coupon"} onClose={onClose}>
      <div className="space-y-4">
        <Input label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
        <TextArea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="grid grid-cols-2 gap-4">
          <Select label="Discount type" value={form.discount_type}
            options={[
              { value: "percent", label: "Percentage" },
              { value: "flat", label: "Flat amount" },
              { value: "free_shipping", label: "Free shipping" },
            ]}
            onChange={(e) => setForm({ ...form, discount_type: e.target.value as Coupon["discount_type"] })} />
          <Input label="Value" type="number" min="0" step="0.01" value={form.discount_value}
            disabled={form.discount_type === "free_shipping"}
            onChange={(e) => setForm({ ...form, discount_value: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Min order value" type="number" min="0" step="0.01" value={form.min_order_value}
            onChange={(e) => setForm({ ...form, min_order_value: e.target.value })} />
          <Input label="Max discount (optional)" type="number" min="0" step="0.01" value={form.max_discount ?? ""}
            onChange={(e) => setForm({ ...form, max_discount: e.target.value || null })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Total usage limit" type="number" min="0" value={form.usage_limit ?? ""}
            onChange={(e) => setForm({ ...form, usage_limit: e.target.value ? Number(e.target.value) : null })} />
          <Input label="Per-user limit" type="number" min="0" value={form.per_user_limit ?? ""}
            onChange={(e) => setForm({ ...form, per_user_limit: e.target.value ? Number(e.target.value) : null })} />
        </div>
        <Input label="Expires at" type="datetime-local"
          value={form.expires_at ? form.expires_at.slice(0, 16) : ""}
          onChange={(e) => setForm({ ...form, expires_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
        <Toggle label="Active" checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-3 pt-4 border-t border-hairline">
          <Btn variant="primary" onClick={save}>{coupon ? "Save" : "Create"}</Btn>
          <Btn onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </EditorPanel>
  );
}
