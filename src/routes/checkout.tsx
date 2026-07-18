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

const PAYMENT_METHODS = [
  { id: "cod", label: "Cash on Delivery", hint: "Pay when your order arrives." },
  { id: "razorpay", label: "Razorpay", hint: "UPI, cards, netbanking." },
  { id: "stripe", label: "Stripe", hint: "International cards." },
] as const;

function Checkout() {
  const auth = useAuth();
  const cart = useCart();
  const nav = useNavigate();
  const queryClient = useQueryClient();

  const [addressId, setAddressId] = useState<number | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [payment, setPayment] = useState<string>("cod");
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!auth.loading && !auth.isAuthenticated) nav({ to: "/auth" });
  }, [auth.loading, auth.isAuthenticated, nav]);

  const { data: addresses } = useQuery({
    queryKey: ["addresses"],
    queryFn: listAddresses,
    enabled: auth.isAuthenticated,
  });

  useEffect(() => {
    if (addressId === null && addresses?.length) {
      setAddressId((addresses.find((a) => a.is_default) ?? addresses[0]).id);
    }
  }, [addresses, addressId]);

  if (auth.loading || !auth.isAuthenticated) {
    return <div className="pt-40 text-center text-eyebrow">Loading</div>;
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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
      // Kick off the gateway record (COD resolves immediately; card gateways
      // return a client payload that a fuller integration would drive).
      try {
        await api("/payments/create/", { method: "POST", body: { order_id: order.id } });
      } catch {
        // Payment can be retried from the order screen; order itself is placed.
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
        <form onSubmit={submit} className="space-y-10">
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
                  line1: "", line2: "", city: "", state: "", postal_code: "", country: "",
                  is_default: (addresses?.length ?? 0) === 0,
                }}
                addressId={null}
                onDone={() => {
                  setShowAddressForm(false);
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
            <div className="space-y-3">
              {PAYMENT_METHODS.map((method) => (
                <label
                  key={method.id}
                  className={`flex items-center gap-4 border p-4 cursor-pointer transition ${
                    payment === method.id ? "border-bone" : "border-hairline hover:border-bone/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    checked={payment === method.id}
                    onChange={() => setPayment(method.id)}
                    className="accent-current"
                  />
                  <span className="text-sm">
                    <span className="font-medium">{method.label}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">{method.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </Section>

          {error && <p className="text-xs text-destructive">{error}</p>}
          <button disabled={placing} className="btn-cult w-full">
            {placing ? "Placing order…" : `Place order — $${cart.total.toFixed(2)}`}
          </button>
        </form>

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
                <div className="text-sm">${(i.price * i.quantity).toFixed(2)}</div>
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
            <Row label="Subtotal" value={`$${cart.subtotal.toFixed(2)}`} />
            {cart.discount > 0 && <Row label="Discount" value={`−$${cart.discount.toFixed(2)}`} />}
            <Row label="Shipping" value={cart.shipping === 0 ? "Free" : `$${cart.shipping.toFixed(2)}`} />
            {cart.tax > 0 && <Row label="Tax" value={`$${cart.tax.toFixed(2)}`} />}
            <Row label="Total" value={`$${cart.total.toFixed(2)}`} bold />
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
