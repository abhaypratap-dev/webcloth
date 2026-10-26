import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { createAddress, listAddresses, placeOrder, type Address, type Order } from "@/lib/account";
import { api } from "@/lib/api";
import { payWithRazorpay } from "@/lib/razorpay";
import { OtpLogin } from "@/components/site/OtpLogin";
import { PhoneInput } from "@/components/site/PhoneInput";
import { sized } from "@/lib/assets";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [{ title: "Checkout — Cut & Cult" }, { name: "robots", content: "noindex" }],
  }),
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
  const queryClient = useQueryClient();

  const [addressId, setAddressId] = useState<number | null>(null);
  // The delivery-details popup: "new" to add an address, "pick" to choose.
  const [addressModal, setAddressModal] = useState<"new" | "pick" | null>(null);
  const [payment, setPayment] = useState<string>("");
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);
  // Why an order that was placed is not yet paid, shown on the confirmation.
  const [paymentNote, setPaymentNote] = useState<string | null>(null);
  // Set when the placed order needs the customer to pay out-of-band and come
  // back with a reference (UPI / bank transfer).
  const [manualPayment, setManualPayment] = useState<{
    paymentId: number | null;
    method: PaymentMethod;
  } | null>(null);

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
    // Nowhere to deliver yet: ask straight away rather than make them find a button.
    if (addresses && addresses.length === 0 && cart.items.length > 0) setAddressModal("new");
  }, [addresses, addressId, cart.items.length]);

  if (auth.loading) {
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
        {paymentNote && (
          <p className="mt-6 text-sm text-destructive max-w-md mx-auto">
            {paymentNote} Your order is saved — you can pay for it from your orders.
          </p>
        )}
        <div className="mt-12 flex items-center justify-center gap-4">
          <Link to="/account/orders" className="btn-cult">
            Track order
          </Link>
          <Link to="/" className="btn-ghost">
            Return home
          </Link>
        </div>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="pt-40 text-center">
        <p className="text-eyebrow">Empty</p>
        <h1 className="mt-4 text-large-display text-[2rem]">Your bag is empty.</h1>
        <Link to="/shop" className="btn-cult mt-10">
          Shop the collection
        </Link>
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

  const address = addresses?.find((a) => a.id === addressId) ?? null;

  async function submit() {
    if (addressId === null) {
      setAddressModal("new");
      return;
    }
    setPlacing(true);
    setError(null);
    let order: Order;
    try {
      order = await placeOrder({
        shipping_address_id: addressId,
        payment_method: payment,
      });
    } catch (e: any) {
      setError(e.message);
      setPlacing(false);
      return;
    }
    // From here the order exists and the server has emptied the bag, so
    // nothing below may send the customer back to the form: a second submit
    // only meets "Your bag is empty." Payment trouble is reported on the
    // confirmation instead, and payment can be retried from the order.
    try {
      // Kick off the gateway record. For UPI/bank this returns the merchant's
      // pay-to details, which the customer needs on the very next screen.
      const chosen = methods?.find((m) => m.method === payment);

      if (payment === "razorpay") {
        // Razorpay collects the money in a modal, and payWithRazorpay creates
        // the payment record itself. Only our own server's verification, or
        // the webhook, marks the order paid.
        const outcome = await payWithRazorpay(order.id);
        if (
          !outcome.paid &&
          outcome.reason &&
          outcome.reason !== "closed" &&
          outcome.reason !== "pending"
        ) {
          setPaymentNote(outcome.reason);
        }
      } else {
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
      }
    } catch (e: any) {
      setPaymentNote(e.message);
    }
    await cart.refresh().catch(() => {});
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    setPlacedOrder(order);
    setPlacing(false);
  }

  return (
    <div className="pt-32 pb-24 px-5 md:px-10 max-w-6xl mx-auto">
      <p className="text-eyebrow">Checkout</p>
      <h1 className="mt-4 text-large-display">
        {auth.isAuthenticated ? "Details" : "Almost yours"}
      </h1>

      <div className="grid md:grid-cols-[1.3fr_1fr] gap-16 mt-12">
        <div className="space-y-10">
          {!auth.isAuthenticated ? (
            <Section title="1 — Sign in">
              <p className="text-sm text-muted-foreground -mt-2">
                Enter your mobile number or email and we&rsquo;ll send you a code. No password, no
                forms.
              </p>
              <div className="max-w-sm">
                <OtpLogin />
              </div>
            </Section>
          ) : (
            <Section title="Deliver to">
              {address ? (
                <div className="flex items-start justify-between gap-6 border border-hairline p-4">
                  <span className="text-sm leading-relaxed">
                    <span className="font-medium">{address.full_name}</span>
                    <br />
                    <span className="text-muted-foreground">
                      {address.line1}
                      {address.line2 ? `, ${address.line2}` : ""}, {address.city}
                      {address.state ? `, ${address.state}` : ""} {address.postal_code}
                      <br />
                      {address.phone}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setAddressModal("pick")}
                    className="text-eyebrow opacity-70 hover:opacity-100 shrink-0"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setAddressModal("new")} className="btn-ghost">
                  + Add delivery details
                </button>
              )}
            </Section>
          )}

          {auth.isAuthenticated && (
            <>
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
                              You&rsquo;ll get our details on the next screen, and we&rsquo;ll
                              confirm your payment before dispatch.
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
            </>
          )}
        </div>

        <aside className="border-l border-hairline pl-8 md:pl-12">
          <div className="text-eyebrow mb-6">Order</div>
          <ul className="divide-y divide-hairline">
            {cart.items.map((i) => (
              <li key={i.id} className="flex gap-4 py-4">
                <img src={sized(i.image, 160)} alt={i.title} className="h-20 w-16 object-cover" />
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
            {!auth.isAuthenticated ? (
              <p className="text-xs text-muted-foreground">
                Have a coupon? Apply it once you&rsquo;re signed in.
              </p>
            ) : cart.coupon_code ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-eyebrow">Coupon — {cart.coupon_code}</span>
                <button
                  onClick={() => cart.removeCoupon()}
                  className="text-eyebrow opacity-60 hover:opacity-100"
                >
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
            <Row
              label="Shipping"
              value={cart.shipping === 0 ? "Free" : `₹${cart.shipping.toFixed(2)}`}
            />
            {cart.tax > 0 && <Row label="Tax (GST)" value={`₹${cart.tax.toFixed(2)}`} />}
            <Row label="Total" value={`₹${cart.total.toFixed(2)}`} bold />
          </div>
        </aside>
      </div>

      {addressModal && (
        <DeliveryModal
          mode={addressModal}
          addresses={addresses ?? []}
          selectedId={addressId}
          defaults={{ full_name: auth.user?.full_name ?? "", phone: auth.user?.mobile ?? "" }}
          onSelect={(id) => {
            setAddressId(id);
            setAddressModal(null);
            setError(null);
          }}
          onSaved={(saved) => {
            setAddressId(saved.id);
            setAddressModal(null);
            setError(null);
            queryClient.invalidateQueries({ queryKey: ["addresses"] });
            // The first address names an account that signed up by code.
            auth.refreshUser();
          }}
          onAddNew={() => setAddressModal("new")}
          onClose={() => setAddressModal(null)}
        />
      )}
    </div>
  );
}

/**
 * Delivery details in a popup: the only form at checkout. Either the short
 * address form, or the saved addresses to pick from.
 */
function DeliveryModal({
  mode,
  addresses,
  selectedId,
  defaults,
  onSelect,
  onSaved,
  onAddNew,
  onClose,
}: {
  mode: "new" | "pick";
  addresses: Address[];
  selectedId: number | null;
  defaults: { full_name: string; phone: string };
  onSelect: (id: number) => void;
  onSaved: (address: Address) => void;
  onAddNew: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    full_name: defaults.full_name,
    phone: defaults.phone,
    postal_code: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onSaved(
        await createAddress({ ...form, country: "India", is_default: addresses.length === 0 }),
      );
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-ink/70 backdrop-blur-md" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Delivery details"
        className="relative w-full md:max-w-lg max-h-[92vh] overflow-y-auto bg-ink border border-hairline p-6 md:p-8"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="text-eyebrow">{mode === "new" ? "Delivery details" : "Deliver to"}</div>
          <button
            type="button"
            onClick={onClose}
            className="text-eyebrow opacity-60 hover:opacity-100"
          >
            Close
          </button>
        </div>

        {mode === "pick" ? (
          <div className="space-y-3">
            {addresses.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onSelect(a.id)}
                className={`block w-full text-left border p-4 text-sm leading-relaxed transition ${
                  a.id === selectedId ? "border-bone" : "border-hairline hover:border-bone/40"
                }`}
              >
                <span className="font-medium">{a.full_name}</span>
                <br />
                <span className="text-muted-foreground">
                  {a.line1}
                  {a.line2 ? `, ${a.line2}` : ""}, {a.city} {a.postal_code} · {a.phone}
                </span>
              </button>
            ))}
            <button type="button" onClick={onAddNew} className="btn-ghost w-full">
              + New address
            </button>
          </div>
        ) : (
          <form onSubmit={save} className="space-y-5">
            <ModalInput
              label="Full name"
              required
              value={form.full_name}
              onChange={set("full_name")}
              autoComplete="name"
            />
            <PhoneInput
              label="Mobile number"
              value={form.phone}
              onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
              required
            />
            <ModalInput
              label="PIN code"
              required
              value={form.postal_code}
              onChange={(e) =>
                setForm((f) => ({ ...f, postal_code: e.target.value.replace(/\D/g, "") }))
              }
              maxLength={6}
              inputMode="numeric"
              autoComplete="postal-code"
            />
            <ModalInput
              label="House / flat, street"
              required
              value={form.line1}
              onChange={set("line1")}
              autoComplete="address-line1"
            />
            <ModalInput
              label="Area, landmark (optional)"
              value={form.line2}
              onChange={set("line2")}
              autoComplete="address-line2"
            />
            <div className="grid grid-cols-2 gap-4">
              <ModalInput
                label="City"
                required
                value={form.city}
                onChange={set("city")}
                autoComplete="address-level2"
              />
              <ModalInput
                label="State"
                required
                value={form.state}
                onChange={set("state")}
                autoComplete="address-level1"
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button disabled={saving} className="btn-cult w-full">
              {saving ? "Saving…" : "Continue to payment"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function ModalInput({
  label,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="block text-eyebrow mb-2 opacity-70">{label}</span>
      <input
        {...rest}
        className="w-full bg-transparent border-b border-hairline focus:border-bone py-3 outline-none text-sm transition-colors placeholder:text-muted-foreground/40"
      />
    </label>
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
    <div
      className={`flex justify-between ${bold ? "text-base font-medium pt-2 border-t border-hairline" : "text-muted-foreground"}`}
    >
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
          We&rsquo;ve got your payment reference and we&rsquo;ll confirm it shortly. Your pieces are
          reserved in the meantime, and you&rsquo;ll get an email the moment the payment clears.
        </p>
        <div className="mt-12 flex items-center justify-center gap-4">
          <Link to="/account/orders" className="btn-cult">
            Track order
          </Link>
          <Link to="/" className="btn-ghost">
            Return home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-24 px-5 md:px-10 max-w-2xl mx-auto">
      <p className="text-eyebrow">Order placed — {order.order_number}</p>
      <h1 className="mt-4 text-large-display">Now pay ₹{order.total.toFixed(2)}</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Your order is reserved but not confirmed yet. Send the exact amount using the details below,
        then tell us the reference so we can match it.
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
          <span className="block text-eyebrow mb-1.5 opacity-70">Payment reference / UTR</span>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. 412700001234"
            className="w-full bg-transparent border border-hairline focus:border-bone px-3 py-2 outline-none text-sm"
          />
        </label>

        <label className="block">
          <span className="block text-eyebrow mb-1.5 opacity-70">Screenshot (optional)</span>
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
          <Link to="/account/orders" className="link-underline">
            your orders
          </Link>
          .
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
