import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  cancelOrder,
  listOrders,
  openInvoice,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type ManualPayment,
  type Order,
} from "@/lib/account";
import { AccountShell } from "@/components/site/AccountShell";
import { api } from "@/lib/api";

export const Route = createFileRoute("/account_/orders")({
  head: () => ({ meta: [{ title: "Orders — Cut & Cult" }, { name: "robots", content: "noindex" }] }),
  component: OrdersPage,
});

function OrdersPage() {
  const queryClient = useQueryClient();
  const { data: orders, isLoading } = useQuery({ queryKey: ["orders"], queryFn: listOrders });

  const cancelMutation = useMutation({
    mutationFn: cancelOrder,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  return (
    <AccountShell eyebrow="History" title="Orders">
      {isLoading ? (
        <p className="text-eyebrow">Loading</p>
      ) : (orders?.length ?? 0) === 0 ? (
        <div className="py-20 text-center">
          <p className="text-eyebrow">Nothing yet</p>
          <p className="mt-4 text-sm text-muted-foreground">Your orders will appear here.</p>
          <Link to="/shop" className="btn-cult mt-10">Shop the collection</Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {orders!.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onCancel={() => cancelMutation.mutate(order.id)}
              cancelling={cancelMutation.isPending && cancelMutation.variables === order.id}
            />
          ))}
        </ul>
      )}
    </AccountShell>
  );
}

function OrderCard({
  order,
  onCancel,
  cancelling,
}: {
  order: Order;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border border-hairline">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex flex-wrap items-center justify-between gap-4 p-6 text-left"
      >
        <div>
          <div className="text-sm font-medium">{order.order_number}</div>
          <div className="text-eyebrow mt-1 opacity-60">
            {new Date(order.created_at).toLocaleDateString()} · {order.items.length} item{order.items.length === 1 ? "" : "s"}
          </div>
        </div>
        <div className="flex items-center gap-6">
          {order.payment_status !== "paid" && (
            <span
              className={`text-eyebrow border px-3 py-1 ${
                order.payment_status === "failed"
                  ? "border-destructive/50 text-destructive"
                  : "border-hairline text-muted-foreground"
              }`}
            >
              {PAYMENT_STATUS_LABELS[order.payment_status] ?? order.payment_status}
            </span>
          )}
          <span className="text-eyebrow border border-hairline px-3 py-1">
            {ORDER_STATUS_LABELS[order.status] ?? order.status}
          </span>
          <span className="text-sm font-medium">₹{order.total.toFixed(2)}</span>
          <span className="text-lg">{open ? "−" : "+"}</span>
        </div>
      </button>

      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.5, ease: [0.7, 0, 0.2, 1] }}
        className="overflow-hidden"
      >
        <div className="border-t border-hairline p-6 grid md:grid-cols-[1.3fr_1fr] gap-10">
          <div>
            <ul className="divide-y divide-hairline">
              {order.items.map((item) => (
                <li key={item.id} className="flex gap-4 py-4">
                  {item.image_url && (
                    <img src={item.image_url} alt={item.title} className="h-20 w-16 object-cover" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.title}</div>
                    <div className="text-eyebrow mt-1 opacity-70">
                      {[item.size, item.color].filter(Boolean).join(" · ")} · Qty {item.quantity}
                    </div>
                  </div>
                  <div className="text-sm">₹{item.line_total.toFixed(2)}</div>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-2 border-t border-hairline pt-4 text-sm text-muted-foreground">
              <Row label="Subtotal" value={`₹${order.subtotal.toFixed(2)}`} />
              {order.discount > 0 && (
                <Row label={`Discount${order.coupon_code ? ` (${order.coupon_code})` : ""}`} value={`−₹${order.discount.toFixed(2)}`} />
              )}
              <Row label="Shipping" value={`₹${order.shipping.toFixed(2)}`} />
              {order.tax > 0 && <Row label="Tax (GST)" value={`₹${order.tax.toFixed(2)}`} />}
              <div className="flex justify-between text-bone font-medium pt-2 border-t border-hairline">
                <span>Total</span><span>₹{order.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div>
            {order.manual_payment && order.payment_status !== "paid" && (
              <ManualPaymentPanel order={order} payment={order.manual_payment} />
            )}
            <div className="text-eyebrow mb-4">Tracking</div>
            <ol className="space-y-3">
              {order.events.map((event, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-bone shrink-0" />
                  <div>
                    <div>{ORDER_STATUS_LABELS[event.status] ?? event.status}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {new Date(event.created_at).toLocaleString()}
                      {event.note ? ` — ${event.note}` : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            {order.tracking_number && (
              <p className="mt-4 text-xs text-muted-foreground">
                Tracking no. <span className="text-bone">{order.tracking_number}</span>
              </p>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={() => openInvoice(order.id)} className="btn-ghost">Invoice</button>
              {order.can_cancel && (
                <button
                  onClick={onCancel}
                  disabled={cancelling}
                  className="btn-ghost border-destructive/40 text-destructive hover:border-destructive"
                >
                  {cancelling ? "…" : "Cancel order"}
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </li>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-eyebrow">{label}</span>
      <span>{value}</span>
    </div>
  );
}

/**
 * Lets a customer finish (or re-submit) a UPI / bank-transfer payment from
 * their order history — the same hand-off checkout shows, for anyone who
 * navigated away before paying, or whose reference was rejected.
 */
function ManualPaymentPanel({ order, payment }: { order: Order; payment: ManualPayment }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(payment.status !== "submitted");
  const [reference, setReference] = useState(payment.reference);
  const [proof, setProof] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      const body = new FormData();
      body.append("reference", reference.trim());
      if (payment.payment_id) body.append("payment_id", String(payment.payment_id));
      else body.append("order_id", String(order.id));
      if (proof) body.append("proof", proof);
      return api("/payments/submit/", { method: "POST", body });
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e: any) => setError(e.message),
  });

  const payTo = payment.pay_to;
  const submitted = payment.status === "submitted";

  return (
    <div className="mb-8 border border-hairline p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="text-eyebrow">
          {submitted ? "Payment under review" : `Pay by ${payment.label}`}
        </div>
        <button onClick={() => setOpen(!open)} className="text-eyebrow opacity-60">
          {open ? "−" : "+"}
        </button>
      </div>

      {submitted && (
        <p className="mt-3 text-xs text-muted-foreground">
          We&rsquo;re checking reference{" "}
          <span className="font-mono text-bone">{payment.reference}</span> against our
          account. You&rsquo;ll get an email once it clears.
        </p>
      )}
      {payment.status === "failed" && payment.review_note && (
        <p className="mt-3 text-xs text-destructive">{payment.review_note}</p>
      )}

      {open && (
        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            {payTo.upi_qr && (
              <img
                src={payTo.upi_qr}
                alt="Scan to pay by UPI"
                className="h-40 w-40 object-contain bg-bone p-2"
              />
            )}
            {payTo.upi_id && <PayRow label="UPI ID" value={payTo.upi_id} />}
            {payTo.account_name && <PayRow label="Account name" value={payTo.account_name} />}
            {payTo.account_number && <PayRow label="Account no." value={payTo.account_number} />}
            {payTo.ifsc && <PayRow label="IFSC" value={payTo.ifsc} />}
            {payTo.bank_name && <PayRow label="Bank" value={payTo.bank_name} />}
            {payTo.branch && <PayRow label="Branch" value={payTo.branch} />}
            <PayRow label="Amount" value={`₹${order.total.toFixed(2)}`} />
          </div>

          {payment.instructions && (
            <p className="text-xs text-muted-foreground leading-relaxed">{payment.instructions}</p>
          )}

          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Payment reference / UTR"
            className="w-full bg-transparent border border-hairline focus:border-bone px-3 py-2 outline-none text-sm"
          />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setProof(e.target.files?.[0] ?? null)}
            className="text-xs text-muted-foreground file:mr-3 file:border file:border-hairline file:bg-transparent file:px-3 file:py-1.5 file:text-[11px] file:uppercase file:tracking-[0.2em] file:text-bone/80"
          />

          {error && <p className="text-xs text-destructive">{error}</p>}

          <button
            onClick={() => submit.mutate()}
            disabled={submit.isPending || !reference.trim()}
            className="btn-ghost disabled:opacity-40"
          >
            {submit.isPending ? "…" : submitted ? "Update reference" : "I've paid — submit"}
          </button>
        </div>
      )}
    </div>
  );
}

function PayRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6 text-sm">
      <span className="text-eyebrow text-muted-foreground">{label}</span>
      <span className="font-mono break-all text-right">{value}</span>
    </div>
  );
}
