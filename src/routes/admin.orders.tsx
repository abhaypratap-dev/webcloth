import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, type Paginated } from "@/lib/api";
import { ORDER_STATUS_LABELS, openInvoice, type Order, type Shipment } from "@/lib/account";
import {
  checkServiceability, createShipment, getShippingSettings,
  SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_TONE,
  type Carrier, type ShipmentStatus,
} from "@/lib/shipping";
import {
  Btn, Chip, EditorPanel, Input, money, PageHead, Select, Table, Td, Toggle,
  useEditor, useInvalidate,
} from "@/components/admin/kit";

export const Route = createFileRoute("/admin/orders")({
  component: AdminOrders,
});

type AdminOrder = Order & { customer_email: string; customer_name: string };

const STATUS_OPTIONS = Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({ value, label }));

// "awaiting" means a UPI/bank customer says they paid and it needs confirming
// on the Payments screen — it should stand out, not read as ordinary pending.
const PAYMENT_TONE: Record<string, "good" | "bad" | "warn" | "default"> = {
  paid: "good",
  awaiting: "warn",
  failed: "bad",
  refunded: "bad",
};

const STATUS_TONE: Record<string, "good" | "bad" | "warn" | "default"> = {
  delivered: "good",
  cancelled: "bad",
  refunded: "bad",
  pending: "warn",
};

function AdminOrders() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const editor = useEditor<AdminOrder>();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "orders", status, search],
    queryFn: () =>
      api<Paginated<AdminOrder>>(
        `/orders/admin/?page_size=50${status ? `&status=${status}` : ""}${search ? `&search=${encodeURIComponent(search)}` : ""}`,
      ),
  });

  return (
    <div>
      <PageHead title="Orders" subtitle={`${data?.count ?? 0} orders`} />

      <div className="flex flex-wrap gap-3 mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search order # or customer…"
          className="bg-transparent border border-hairline focus:border-bone px-3 py-2 outline-none text-sm w-64"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="bg-ink border border-hairline px-3 py-2 text-sm outline-none"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="text-eyebrow">Loading</div>
      ) : (
        <Table headers={["Order", "Customer", "Items", "Total", "Payment", "Status", "Shipping", ""]}>
          {(data?.results ?? []).map((o) => (
            <tr key={o.id}>
              <Td className="font-medium">{o.order_number}</Td>
              <Td className="text-muted-foreground max-w-40 truncate">{o.customer_email}</Td>
              <Td>{o.items.length}</Td>
              <Td>{money(o.total)}</Td>
              <Td>
                <Chip tone={PAYMENT_TONE[o.payment_status] ?? "default"}>
                  {o.payment_method.toUpperCase()} · {o.payment_status}
                </Chip>
              </Td>
              <Td><Chip tone={STATUS_TONE[o.status] ?? "default"}>{ORDER_STATUS_LABELS[o.status]}</Chip></Td>
              <Td>{shippingCell(o)}</Td>
              <Td><Btn onClick={() => editor.open(o)}>Manage</Btn></Td>
            </tr>
          ))}
        </Table>
      )}

      {editor.editing !== null && editor.editing !== "new" && (
        <OrderPanel order={editor.editing} onClose={editor.close} />
      )}
    </div>
  );
}

function OrderPanel({ order, onClose }: { order: AdminOrder; onClose: () => void }) {
  const [status, setStatus] = useState(order.status);
  const [tracking, setTracking] = useState(order.tracking_number);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const invalidate = useInvalidate(["orders", "stats", "inventory"]);

  async function apply() {
    setSaving(true);
    setError(null);
    try {
      await api(`/orders/admin/${order.id}/set_status/`, {
        method: "PATCH",
        body: { status, note, tracking_number: tracking },
      });
      invalidate();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const addr = order.shipping_address;

  return (
    <EditorPanel title={`Order ${order.order_number}`} onClose={onClose}>
      <div className="space-y-6">
        <div>
          <div className="text-eyebrow mb-2">Customer</div>
          <p className="text-sm">{order.customer_name} · {order.customer_email}</p>
        </div>

        <div>
          <div className="text-eyebrow mb-2">Shipping to</div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {addr.full_name}<br />
            {addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}<br />
            {addr.city} {addr.postal_code}, {addr.country}<br />
            {addr.phone}
          </p>
        </div>

        <div>
          <div className="text-eyebrow mb-2">Items</div>
          <ul className="divide-y divide-hairline border-y border-hairline">
            {order.items.map((i) => (
              <li key={i.id} className="flex justify-between py-2 text-sm">
                <span>{i.title} · {[i.size, i.color].filter(Boolean).join("/")} × {i.quantity}</span>
                <span>{money(i.line_total)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 space-y-1 text-sm text-muted-foreground">
            <Row label="Subtotal" value={money(order.subtotal)} />
            {order.discount > 0 && <Row label={`Discount ${order.coupon_code}`} value={`−${money(order.discount)}`} />}
            <Row label="Shipping" value={money(order.shipping)} />
            {order.tax > 0 && <Row label="Tax" value={money(order.tax)} />}
            <div className="flex justify-between text-bone font-medium pt-1">
              <span>Total</span><span>{money(order.total)}</span>
            </div>
          </div>
        </div>

        <div className="border-t border-hairline pt-4 space-y-4">
          <div className="text-eyebrow">Update</div>
          <Select label="Status" value={status} options={STATUS_OPTIONS}
            onChange={(e) => setStatus(e.target.value)} />
          <Input label="Tracking number" value={tracking} onChange={(e) => setTracking(e.target.value)} />
          <Input label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-3">
            <Btn variant="primary" onClick={apply} disabled={saving}>{saving ? "…" : "Apply"}</Btn>
            <Btn onClick={() => openInvoice(order.id)}>Invoice</Btn>
          </div>
        </div>

        <ShippingSection order={order} />

        <div className="border-t border-hairline pt-4">
          <div className="text-eyebrow mb-2">History</div>
          <ol className="space-y-2 text-xs text-muted-foreground">
            {order.events.map((e, i) => (
              <li key={i}>
                {ORDER_STATUS_LABELS[e.status] ?? e.status} — {new Date(e.created_at).toLocaleString()}
                {e.note ? ` · ${e.note}` : ""}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </EditorPanel>
  );
}

/** The newest forward parcel — the one an admin means by "the shipment". */
function forwardShipment(order: Order): Shipment | undefined {
  return order.shipments?.find((s) => s.kind === "forward" && s.status !== "failed");
}

function shippingCell(order: Order) {
  const shipment = forwardShipment(order);
  if (!shipment) return <span className="text-xs text-muted-foreground">Not shipped</span>;
  return (
    <Chip tone={SHIPMENT_STATUS_TONE[shipment.status as ShipmentStatus] ?? "default"}>
      {SHIPMENT_STATUS_LABELS[shipment.status as ShipmentStatus] ?? shipment.status}
    </Chip>
  );
}

/**
 * Book the courier for one order.
 *
 * Serviceability is checked first and its carrier list offered as the choice,
 * because picking a courier that cannot run the lane is the one mistake
 * Velocity rejects only after the parcel is already packed.
 */
function ShippingSection({ order }: { order: Order }) {
  const invalidate = useInvalidate(["orders", "shipping", "stats"]);
  const [carrier, setCarrier] = useState("");
  const [carriers, setCarriers] = useState<Carrier[] | null>(null);
  const [assignNow, setAssignNow] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["admin", "shipping", "settings"],
    queryFn: getShippingSettings,
  });

  const check = useMutation({
    mutationFn: () => checkServiceability({ order_id: order.id }),
    onSuccess: (data) => {
      setError(data.serviceable ? null : `No courier serves ${data.to} from ${data.from}.`);
      setCarriers(data.carriers);
    },
    onError: (e: Error) => setError(e.message),
  });

  const ship = useMutation({
    mutationFn: () =>
      createShipment({ order_id: order.id, carrier_id: carrier, assign_carrier: assignNow }),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const shipment = forwardShipment(order);

  if (shipment) {
    return (
      <div className="border-t border-hairline pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-eyebrow">Shipping</div>
          <Chip tone={SHIPMENT_STATUS_TONE[shipment.status as ShipmentStatus] ?? "default"}>
            {SHIPMENT_STATUS_LABELS[shipment.status as ShipmentStatus] ?? shipment.status}
          </Chip>
        </div>
        <p className="text-sm">
          {shipment.carrier || "Courier pending"}
          {shipment.awb_code && (
            <>
              {" · "}
              <span className="font-mono text-xs">{shipment.awb_code}</span>
            </>
          )}
        </p>
        {shipment.tracking_status && (
          <p className="text-xs text-muted-foreground">Courier says: {shipment.tracking_status}</p>
        )}
        <Link to="/admin/shipping" className="text-eyebrow link-underline inline-block">
          Manage on the Shipping screen →
        </Link>
      </div>
    );
  }

  if (!settings?.is_enabled) {
    return (
      <div className="border-t border-hairline pt-4">
        <div className="text-eyebrow mb-2">Shipping</div>
        <p className="text-xs text-muted-foreground">
          Velocity Shipping is turned off.{" "}
          <Link to="/admin/shipping" className="link-underline">Set it up</Link> to book couriers
          from here.
        </p>
      </div>
    );
  }

  const cancelled = order.status === "cancelled" || order.status === "refunded";

  return (
    <div className="border-t border-hairline pt-4 space-y-4">
      <div className="text-eyebrow">Ship with Velocity</div>
      {cancelled ? (
        <p className="text-xs text-muted-foreground">
          This order is {ORDER_STATUS_LABELS[order.status].toLowerCase()} — there is nothing to ship.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <Btn disabled={check.isPending} onClick={() => check.mutate()}>
              {check.isPending ? "…" : "Check couriers"}
            </Btn>
          </div>

          {carriers !== null && (
            <Select
              label="Courier"
              value={carrier}
              options={[
                { value: "", label: "Let Velocity's shipping rules choose" },
                ...carriers.map((c) => ({ value: c.carrier_id, label: c.carrier_name })),
              ]}
              onChange={(e) => setCarrier(e.target.value)}
            />
          )}

          <Toggle
            label="Assign the courier now (off = create the order only)"
            checked={assignNow}
            onChange={setAssignNow}
          />
          <p className="text-xs text-muted-foreground">
            Uses the default pickup warehouse and parcel size from Shipping settings. The order
            moves to Packed once an AWB comes back.
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Btn variant="primary" disabled={ship.isPending} onClick={() => ship.mutate()}>
            {ship.isPending ? "…" : "Book the courier"}
          </Btn>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
