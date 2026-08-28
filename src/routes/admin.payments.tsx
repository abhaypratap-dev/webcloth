import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type Paginated } from "@/lib/api";
import {
  Btn, Chip, Input, money, PageHead, TextArea, Toggle, Table, Td, useInvalidate,
} from "@/components/admin/kit";

export const Route = createFileRoute("/admin/payments")({
  component: AdminPayments,
});

type PaymentMethod = {
  id: number;
  method: "cod" | "upi" | "bank" | "razorpay" | "stripe";
  label: string;
  is_enabled: boolean;
  display_name: string;
  description: string;
  instructions: string;
  sort_order: number;
  is_manual: boolean;
  /** Non-empty when the method still needs details/keys before it can be enabled. */
  configuration_error: string;
  upi_id: string;
  upi_qr_url: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_ifsc: string;
  bank_name: string;
  bank_branch: string;
};

type AdminPayment = {
  id: number;
  gateway: string;
  amount: number;
  status: string;
  reference: string;
  proof_url: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_note: string;
  order_id: number;
  order_number: string;
  order_status: string;
  order_payment_status: string;
  customer_email: string;
  customer_name: string;
  reviewed_by_email: string | null;
};

function AdminPayments() {
  return (
    <div className="max-w-4xl">
      <PageHead
        title="Payments"
        subtitle="Turn methods on or off, hold your UPI and bank details, and confirm manual payments"
      />
      <ReviewQueue />
      <MethodList />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Review queue                                                               */
/* -------------------------------------------------------------------------- */

function ReviewQueue() {
  const invalidate = useInvalidate(["admin", "orders", "stats"]);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "payments", "submitted"],
    queryFn: () => api<Paginated<AdminPayment>>("/payments/admin/?status=submitted&page_size=50"),
  });

  const review = useMutation({
    mutationFn: ({ id, action, note }: { id: number; action: "approve" | "reject"; note?: string }) =>
      api(`/payments/admin/${id}/${action}/`, { method: "POST", body: { note: note ?? "" } }),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (e: any) => setError(e.message),
  });

  const rows = data?.results ?? [];

  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between mb-4">
        <div className="text-eyebrow">Awaiting confirmation</div>
        {rows.length > 0 && <Chip tone="warn">{rows.length} to review</Chip>}
      </div>

      {isLoading ? (
        <div className="text-eyebrow">Loading</div>
      ) : rows.length === 0 ? (
        <p className="border border-hairline p-6 text-sm text-muted-foreground">
          Nothing waiting. UPI and bank-transfer payments show up here once the customer
          submits their reference.
        </p>
      ) : (
        <Table headers={["Order", "Customer", "Method", "Amount", "Reference", "Proof", ""]}>
          {rows.map((p) => (
            <tr key={p.id}>
              <Td className="font-medium">{p.order_number}</Td>
              <Td className="text-muted-foreground max-w-40 truncate">{p.customer_email}</Td>
              <Td>{p.gateway.toUpperCase()}</Td>
              <Td>{money(p.amount)}</Td>
              <Td className="font-mono text-xs">{p.reference || "—"}</Td>
              <Td>
                {p.proof_url ? (
                  <a
                    href={p.proof_url}
                    target="_blank"
                    rel="noreferrer"
                    className="link-underline text-xs"
                  >
                    View
                  </a>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </Td>
              <Td>
                <div className="flex gap-2">
                  <Btn
                    variant="primary"
                    disabled={review.isPending}
                    onClick={() => review.mutate({ id: p.id, action: "approve" })}
                  >
                    Approve
                  </Btn>
                  <Btn
                    variant="danger"
                    disabled={review.isPending}
                    onClick={() => {
                      const note = window.prompt(
                        "Why is this being rejected? The order will be cancelled and its stock returned.",
                        "Payment not received",
                      );
                      if (note !== null) review.mutate({ id: p.id, action: "reject", note });
                    }}
                  >
                    Reject
                  </Btn>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}
      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Method configuration                                                       */
/* -------------------------------------------------------------------------- */

function MethodList() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "payment-methods"],
    queryFn: () => api<PaymentMethod[]>("/payments/admin/methods/"),
  });

  if (isLoading) return <div className="text-eyebrow">Loading</div>;

  return (
    <section className="space-y-4">
      <div className="text-eyebrow">Methods</div>
      {(data ?? []).map((m) => (
        <MethodCard key={m.id} method={m} />
      ))}
    </section>
  );
}

function MethodCard({ method }: { method: PaymentMethod }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(method);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const set = <K extends keyof PaymentMethod>(key: K, value: PaymentMethod[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const dirty = JSON.stringify(form) !== JSON.stringify(method);
  const hasDetails = method.method === "upi" || method.method === "bank";

  async function save(patch?: Partial<PaymentMethod>) {
    setSaving(true);
    setError(null);
    setMessage(null);
    const body = { ...form, ...patch };
    try {
      // upi_qr_url and configuration_error are read-only; the file itself goes
      // up through uploadQr() instead.
      const { upi_qr_url, configuration_error, label, is_manual, ...writable } = body;
      await api(`/payments/admin/methods/${method.id}/`, { method: "PATCH", body: writable });
      await queryClient.invalidateQueries({ queryKey: ["admin", "payment-methods"] });
      setMessage("Saved.");
    } catch (e: any) {
      setError(e.message);
      // Roll the toggle back so the switch never shows a state the server rejected.
      setForm((f) => ({ ...f, is_enabled: method.is_enabled }));
    } finally {
      setSaving(false);
    }
  }

  async function uploadQr(file: File) {
    setSaving(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("upi_qr", file);
      await api(`/payments/admin/methods/${method.id}/`, { method: "PATCH", body });
      await queryClient.invalidateQueries({ queryKey: ["admin", "payment-methods"] });
      setMessage("QR code uploaded.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-hairline">
      <div className="flex items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{method.label}</span>
            {method.is_manual && <Chip tone="warn">Manual</Chip>}
            {method.is_enabled ? <Chip tone="good">Live</Chip> : <Chip>Off</Chip>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {method.configuration_error || method.description || " "}
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <Toggle
            label={form.is_enabled ? "Enabled" : "Disabled"}
            checked={form.is_enabled}
            onChange={(v) => {
              set("is_enabled", v);
              save({ is_enabled: v });
            }}
          />
          <Btn onClick={() => setOpen((o) => !o)}>{open ? "Close" : "Edit"}</Btn>
        </div>
      </div>

      {open && (
        <div className="border-t border-hairline p-5 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Input
              label="Display name (blank uses the default)"
              value={form.display_name}
              onChange={(e) => set("display_name", e.target.value)}
            />
            <Input
              label="Short description"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          {method.method === "upi" && (
            <div className="space-y-4">
              <Input
                label="UPI ID"
                placeholder="cutcult@okhdfcbank"
                value={form.upi_id}
                onChange={(e) => set("upi_id", e.target.value)}
              />
              <div>
                <span className="block text-eyebrow mb-1.5 opacity-70">UPI QR code</span>
                <div className="flex items-center gap-4">
                  {method.upi_qr_url ? (
                    <img
                      src={method.upi_qr_url}
                      alt="UPI QR code"
                      className="h-24 w-24 object-contain bg-bone p-1"
                    />
                  ) : (
                    <div className="h-24 w-24 grid place-items-center border border-dashed border-hairline text-[10px] text-muted-foreground text-center px-2">
                      No QR yet
                    </div>
                  )}
                  <label className="cursor-pointer px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] border border-hairline text-bone/80 hover:text-bone hover:border-bone/50 transition">
                    {method.upi_qr_url ? "Replace QR" : "Upload QR"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) uploadQr(file);
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {method.method === "bank" && (
            <div className="grid md:grid-cols-2 gap-4">
              <Input
                label="Account holder name"
                value={form.bank_account_name}
                onChange={(e) => set("bank_account_name", e.target.value)}
              />
              <Input
                label="Account number"
                value={form.bank_account_number}
                onChange={(e) => set("bank_account_number", e.target.value)}
              />
              <Input
                label="IFSC"
                value={form.bank_ifsc}
                onChange={(e) => set("bank_ifsc", e.target.value)}
              />
              <Input
                label="Bank name"
                value={form.bank_name}
                onChange={(e) => set("bank_name", e.target.value)}
              />
              <Input
                label="Branch"
                value={form.bank_branch}
                onChange={(e) => set("bank_branch", e.target.value)}
              />
            </div>
          )}

          {hasDetails && (
            <TextArea
              label="Instructions shown to the customer after they order"
              value={form.instructions}
              onChange={(e) => set("instructions", e.target.value)}
            />
          )}

          {message && <p className="text-xs text-muted-foreground">{message}</p>}
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Btn variant="primary" onClick={() => save()} disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save"}
          </Btn>
        </div>
      )}
    </div>
  );
}
