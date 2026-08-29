import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { listAddresses, placeOrder, type Order } from "@/lib/account";
import { api } from "@/lib/api";
import { AddressForm } from "./account_.addresses";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — Cut & Cult" }, { name: "robots", content: "noindex" }] }),
  component: Checkout,
});

/** A method the admin has switched on, plus wherever the money should go. */
type PaymentMethod = {
  method: string;
  label: string;
  description: string;
  instructions: string;
  is_manual: boolean;
  pay_to: {
    upi_id?: string;
    upi_qr?: string;
    account_name?: string;
    account_number?: string;
    ifsc?: string;
    bank_name?: string;
    branch?: string;
  };
};

function Checkout() {
  const auth = useAuth();
  const cart = useCart();
  const nav = useNavigate();
  const queryClient = useQueryClient();

  const [addressId, setAddressId] = useState<number | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [payment, setPayment] = useState<string>("");
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);
  // Set when the placed order needs the customer to pay out-of-band and come
  // back with a reference (UPI / bank transfer).
  const [manualPayment, setManualPayment] = useState<{
    paymentId: number | null;
    method: PaymentMethod;
  } | null>(null);

  useEffect(() => {
    if (!auth.loading && !auth.isAuthenticated) nav({ to: "/auth" });
  }, [auth.loading, auth.isAuthenticated, nav]);

  const { data: addresses } = useQuery({
    queryKey: ["addresses"],
    queryFn: listAddresses,
    enabled: auth.isAuthenticated,
  });

  const { data: methods } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: () => api<PaymentMethod[]>("/payments/methods/"),
  });

  useEffect(() => {
    if (!payment && methods?.length) setPayment(methods[0].method);
  }, [methods, payment]);

  useEffect(() => {
    if (addressId === null && addresses?.length) {
      setAddressId((addresses.find((a) => a.is_default) ?? addresses[0]).id);
    }
  }, [addresses, addressId]);

  if (auth.loading || !auth.isAuthenticated) {
    return <div className="pt-40 text-center text-eyebrow">Loading</div>;
  }

  if (placedOrder && manualPayment) {
    return (
      <ManualPaymentStep
        order={placedOrder}
        paymentId={manualPayment.paymentId}
        method={manualPayment.method}
      />
    );
  }

  if (placedOrder) {
    return (
      <div className="pt-40 pb-40 text-center px-6">
        <p className="text-eyebrow">Order confirmed — {placedOrder.order_number}</p>
        <h1 className="mt-6 text-large-display">Welcome to the cult.</h1>
        <p className="mt-6 text-muted-foreground max-w-md mx-auto">
          A confirmation is on its way. Your pieces are being prepared with care.
        </p>
        <div className="mt-12 flex items-center justify-center gap-4">
          <Link to="/account/orders" className="btn-cult">Track order</Link>
          <Link to="/" className="btn-ghost">Return home</Link>
        </div>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="pt-40 text-center">
        <p className="text-eyebrow">Empty</p>
        <h1 className="mt-4 text-large-display text-[2rem]">Your bag is empty.</h1>
        <Link to="/shop" className="btn-cult mt-10">Shop the collection</Link>
      </div>
    );
  }

  async function applyCoupon() {
    setCouponError(null);
    try {
      await cart.applyCoupon(couponInput);
      setCouponInput("");
    } catch (e: any) {
      setCouponError(e.message);
    }
  }

  async function submit() {
    if (addressId === null) {
      setError("Choose a shipping address first.");
      return;
    }
    setPlacing(true);
    setError(null);
    try {
      const order = await placeOrder({
        shipping_address_id: addressId,
        payment_method: payment,
      });
      // Kick off the gateway record. For UPI/bank this returns the merchant's
      // pay-to details, which the customer needs on the very next screen.
      const chosen = methods?.find((m) => m.method === payment);
      try {
        const created = await api<{ payment_id: number }>("/payments/create/", {
          method: "POST",
          body: { order_id: order.id },
        });
        if (chosen?.is_manual) {
          setManualPayment({ paymentId: created.payment_id, method: chosen });
        }
      } catch {
        // Payment can be retried from the order screen; order itself is placed.
        if (chosen?.is_manual) setManualPayment({ paymentId: null, method: chosen });
      }
      await cart.refresh();
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setPlacedOrder(order);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="pt-32 pb-24 px-5 md:px-10 max-w-6xl mx-auto">
      <p className="text-eyebrow">Checkout</p>
      <h1 className="mt-4 text-large-display">Details</h1>

      <div className="grid md:grid-cols-[1.3fr_1fr] gap-16 mt-12">
        <div className="space-y-10">
          <Section title="Shipping address">
            {(addresses?.length ?? 0) > 0 && (
              <div className="space-y-3">
                {addresses!.map((address) => (
                  <label
                    key={address.id}
                    className={`flex items-start gap-4 border p-4 cursor-pointer transition ${
                      addressId === address.id ? "border-bone" : "border-hairline hover:border-bone/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="address"
                      checked={addressId === address.id}
                      onChange={() => setAddressId(address.id)}
                      className="mt-1 accent-current"
                    />
                    <span className="text-sm leading-relaxed">
                      <span className="font-medium">{address.full_name}</span>
                      {address.is_default && <span className="text-eyebrow ml-3 opacity-60">Default</span>}
                      <br />
                      <span className="text-muted-foreground">
                        {address.line1}{address.line2 ? `, ${address.line2}` : ""}, {address.city}{" "}
                        {address.postal_code}, {address.country} · {address.phone}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            {showAddressForm ? (
              <AddressForm
                initial={{
                  full_name: auth.user?.full_name ?? "",
                  phone: auth.user?.mobile ?? "",
                  line1: "", line2: "", city: "", state: "", postal_code: "", country: "India",
                  is_default: (addresses?.length ?? 0) === 0,
                }}
                addressId={null}
                onDone={(saved) => {
                  setShowAddressForm(false);
                  setAddressId(saved.id);
                  setError(null);
                  queryClient.invalidateQueries({ queryKey: ["addresses"] });
                }}
                onCancel={() => setShowAddressForm(false)}
              />
            ) : (
              <button type="button" onClick={() => setShowAddressForm(true)} className="btn-ghost">
                + New address
              </button>
            )}
          </Section>

          <Section title="Payment">
            {methods === undefined ? (
              <p className="text-xs text-muted-foreground">Loading payment methods…</p>
            ) : methods.length === 0 ? (
              <p className="text-xs text-destructive">
                No payment methods are available right now. Please try again shortly.
              </p>
            ) : (
              <div className="space-y-3">
                {methods.map((method) => (
                  <label
                    key={method.method}
                    className={`flex items-center gap-4 border p-4 cursor-pointer transition ${
                      payment === method.method
                        ? "border-bone"
                        : "border-hairline hover:border-bone/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      checked={payment === method.method}
                      onChange={() => setPayment(method.method)}
                      className="accent-current"
                    />
                    <span className="text-sm">
                      <span className="font-medium">{method.label}</span>
                      {method.description && (
                        <span className="block text-xs text-muted-foreground mt-0.5">
                          {method.description}
                        </span>
                      )}
                      {method.is_manual && (
                        <span className="block text-xs text-muted-foreground mt-0.5">
                          You&rsquo;ll get our details on the next screen, and we&rsquo;ll confirm
                          your payment before dispatch.
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </Section>

          {error && <p className="text-xs text-destructive">{error}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={placing || !payment}
            className="btn-cult w-full"
          >
            {placing ? "Placing order…" : `Place order — ₹${cart.total.toFixed(2)}`}
          </button>
        </div>

        <aside className="border-l border-hairline pl-8 md:pl-12">
          <div className="text-eyebrow mb-6">Order</div>
          <ul className="divide-y divide-hairline">
            {cart.items.map((i) => (
              <li key={i.id} className="flex gap-4 py-4">
                <img src={i.image} alt={i.title} className="h-20 w-16 object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{i.title}</div>
                  <div className="text-eyebrow mt-1 opacity-70">
                    {[i.size, i.color].filter(Boolean).join(" · ")} · Qty {i.quantity}
                  </div>
                </div>
                <div className="text-sm">₹{(i.price * i.quantity).toFixed(2)}</div>
              </li>
            ))}
          </ul>

          <div className="mt-6 border-t border-hairline pt-6">
            {cart.coupon_code ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-eyebrow">Coupon — {cart.coupon_code}</span>
                <button onClick={() => cart.removeCoupon()} className="text-eyebrow opacity-60 hover:opacity-100">
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-0 border-b border-hairline">
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="Coupon code"
                  className="flex-1 bg-transparent py-3 text-sm outline-none uppercase tracking-widest placeholder:text-muted-foreground/50 placeholder:normal-case"
                />
                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={!couponInput}
                  className="text-eyebrow py-3 px-2 hover:text-bone/70 disabled:opacity-40"
                >
                  Apply
                </button>
              </div>
            )}
            {couponError && <p className="mt-2 text-xs text-destructive">{couponError}</p>}
          </div>

          <div className="mt-6 space-y-3 border-t border-hairline pt-6 text-sm">
            <Row label="Subtotal" value={`₹${cart.subtotal.toFixed(2)}`} />
            {cart.discount > 0 && <Row label="Discount" value={`−₹${cart.discount.toFixed(2)}`} />}
            <Row label="Shipping" value={cart.shipping === 0 ? "Free" : `₹${cart.shipping.toFixed(2)}`} />
            {cart.tax > 0 && <Row label="Tax (GST)" value={`₹${cart.tax.toFixed(2)}`} />}
            <Row label="Total" value={`₹${cart.total.toFixed(2)}`} bold />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-eyebrow mb-6">{title}</div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-base font-medium pt-2 border-t border-hairline" : "text-muted-foreground"}`}>
      <span className={bold ? "" : "text-eyebrow"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

/**
 * Hand-off screen for UPI / bank transfer. The order already exists with its
 * stock reserved; it stays unpaid until an admin confirms the money arrived,
 * so the job here is to show where to send it and collect a reference the
 * admin can match against the bank statement.
 */
function ManualPaymentStep({
  order,
  paymentId,
  method,
}: {
  order: Order;
  paymentId: number | null;
  method: PaymentMethod;
}) {
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payTo = method.pay_to;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reference.trim()) {
      setError("Enter the reference number from your payment.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // FormData either way — the proof is optional but the endpoint accepts
      // both shapes, and this avoids branching on whether a file was picked.
      const body = new FormData();
      body.append("reference", reference.trim());
      if (paymentId) body.append("payment_id", String(paymentId));
      else body.append("order_id", String(order.id));
      if (proof) body.append("proof", proof);
      await api("/payments/submit/", { method: "POST", body });
      setSubmitted(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="pt-40 pb-40 text-center px-6">
        <p className="text-eyebrow">Order placed — {order.order_number}</p>
        <h1 className="mt-6 text-large-display">Thanks. We&rsquo;re checking.</h1>
        <p className="mt-6 text-muted-foreground max-w-md mx-auto">
          We&rsquo;ve got your payment reference and we&rsquo;ll confirm it shortly. Your
          pieces are reserved in the meantime, and you&rsquo;ll get an email the moment
          the payment clears.
        </p>
        <div className="mt-12 flex items-center justify-center gap-4">
          <Link to="/account/orders" className="btn-cult">Track order</Link>
          <Link to="/" className="btn-ghost">Return home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-24 px-5 md:px-10 max-w-2xl mx-auto">
      <p className="text-eyebrow">Order placed — {order.order_number}</p>
      <h1 className="mt-4 text-large-display">Now pay ₹{order.total.toFixed(2)}</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Your order is reserved but not confirmed yet. Send the exact amount using the
        details below, then tell us the reference so we can match it.
      </p>

      <div className="mt-10 border border-hairline p-6 space-y-5">
        <div className="text-eyebrow">{method.label}</div>

        {payTo.upi_qr && (
          <img
            src={payTo.upi_qr}
            alt="Scan to pay by UPI"
            className="h-48 w-48 object-contain bg-bone p-2"
          />
        )}
        {payTo.upi_id && <PayRow label="UPI ID" value={payTo.upi_id} />}
        {payTo.account_name && <PayRow label="Account name" value={payTo.account_name} />}
        {payTo.account_number && <PayRow label="Account number" value={payTo.account_number} />}
        {payTo.ifsc && <PayRow label="IFSC" value={payTo.ifsc} />}
        {payTo.bank_name && <PayRow label="Bank" value={payTo.bank_name} />}
        {payTo.branch && <PayRow label="Branch" value={payTo.branch} />}
        <PayRow label="Amount" value={`₹${order.total.toFixed(2)}`} />

        {method.instructions && (
          <p className="text-xs text-muted-foreground leading-relaxed border-t border-hairline pt-4">
            {method.instructions}
          </p>
        )}
      </div>

      <form onSubmit={submit} className="mt-10 space-y-5">
        <label className="block">
          <span className="block text-eyebrow mb-1.5 opacity-70">
            Payment reference / UTR
          </span>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. 412700001234"
            className="w-full bg-transparent border border-hairline focus:border-bone px-3 py-2 outline-none text-sm"
          />
        </label>

        <label className="block">
          <span className="block text-eyebrow mb-1.5 opacity-70">
            Screenshot (optional)
          </span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setProof(e.target.files?.[0] ?? null)}
            className="text-xs text-muted-foreground file:mr-3 file:border file:border-hairline file:bg-transparent file:px-3 file:py-1.5 file:text-[11px] file:uppercase file:tracking-[0.2em] file:text-bone/80"
          />
        </label>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <button disabled={submitting} className="btn-cult w-full">
          {submitting ? "Submitting…" : "I've paid — submit reference"}
        </button>
        <p className="text-xs text-muted-foreground text-center">
          Not ready? You can come back to this from{" "}
          <Link to="/account/orders" className="link-underline">your orders</Link>.
        </p>
      </form>
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
