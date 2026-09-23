import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Btn, Chip, EditorPanel, Input, PageHead, Select, Table, Td, TextArea, Toggle,
  useEditor,
} from "@/components/admin/kit";
import { ORDER_STATUS_LABELS } from "@/lib/account";
import {
  assignCarrier, cancelShipment, checkServiceability, createWarehouse,
  getShippingSettings, listShipments, listWarehouses, registerWarehouse,
  saveShippingSettings, syncAllShipments, trackShipment, updateWarehouse,
  SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_TONE,
  type AdminShipment, type Serviceability, type ShipmentStatus,
  type ShippingSettings, type Warehouse, type WarehouseInput,
} from "@/lib/shipping";

export const Route = createFileRoute("/admin/shipping")({
  component: AdminShipping,
});

/** Auto-manifest triggers. Only statuses that come before dispatch make sense. */
const AUTO_SHIP_OPTIONS = [
  { value: "", label: "Never — I'll ship each order myself" },
  ...["confirmed", "processing", "packed"].map((value) => ({
    value,
    label: `When an order becomes ${ORDER_STATUS_LABELS[value].toLowerCase()}`,
  })),
];

function AdminShipping() {
  return (
    <div className="max-w-5xl">
      <PageHead
        title="Shipping"
        subtitle="Velocity Shipping — credentials, pickup warehouses, and every parcel in flight"
      />
      <SettingsPanel />
      <WarehousePanel />
      <ServiceabilityPanel />
      <ShipmentPanel />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Connection settings                                                        */
/* -------------------------------------------------------------------------- */

function SettingsPanel() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin", "shipping", "settings"],
    queryFn: getShippingSettings,
  });
  const { data: warehouses } = useQuery({
    queryKey: ["admin", "shipping", "warehouses"],
    queryFn: listWarehouses,
  });

  const [draft, setDraft] = useState<Partial<ShippingSettings>>({});
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: (patch: Partial<ShippingSettings>) => saveShippingSettings(patch),
    onSuccess: () => {
      setError(null);
      setSaved(true);
      setPassword("");
      setDraft({});
      queryClient.invalidateQueries({ queryKey: ["admin", "shipping"] });
    },
    onError: (e: Error) => {
      setSaved(false);
      setError(e.message);
    },
  });

  if (isLoading || !settings) return <div className="text-eyebrow mb-10">Loading</div>;

  const value = { ...settings, ...draft };
  const set = <K extends keyof ShippingSettings>(key: K, v: ShippingSettings[K]) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [key]: v }));
  };

  const registered = (warehouses ?? []).filter((w) => w.is_registered);

  return (
    <section className="mb-12">
      <div className="flex items-baseline justify-between mb-4">
        <div className="text-eyebrow">Connection</div>
        <Chip tone={settings.is_enabled ? "good" : "default"}>
          {settings.is_enabled ? "Live" : "Off"}
        </Chip>
      </div>

      {settings.configuration_error && (
        <p className="border border-amber-500/40 text-amber-400 p-4 text-sm mb-4">
          {settings.configuration_error}
        </p>
      )}

      <div className="border border-hairline p-6 space-y-5">
        <Toggle
          label="Ship orders through Velocity"
          checked={value.is_enabled}
          onChange={(v) => set("is_enabled", v)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Environment"
            value={value.base_url}
            options={[
              { value: "https://shazam.velocity.in", label: "Production" },
              { value: "https://shazam.stagingvelocity.in", label: "Staging" },
            ]}
            onChange={(e) => set("base_url", e.target.value)}
          />
          <Input
            label="Username (mobile with country code)"
            value={value.username}
            placeholder="+919866340090"
            onChange={(e) => set("username", e.target.value)}
          />
          <Input
            label={settings.has_credentials ? "Password (leave blank to keep)" : "Password"}
            type="password"
            value={password}
            placeholder={settings.has_credentials ? "••••••••" : ""}
            onChange={(e) => {
              setSaved(false);
              setPassword(e.target.value);
            }}
          />
          <Select
            label="Default pickup warehouse"
            value={String(value.default_warehouse ?? "")}
            options={[
              { value: "", label: registered.length ? "Select a warehouse" : "None registered yet" },
              ...registered.map((w) => ({ value: String(w.id), label: `${w.name} · ${w.warehouse_id}` })),
            ]}
            onChange={(e) => set("default_warehouse", e.target.value ? Number(e.target.value) : null)}
          />
        </div>

        <div className="border-t border-hairline pt-5">
          <div className="text-eyebrow mb-3 opacity-70">Default parcel</div>
          <p className="text-xs text-muted-foreground mb-4">
            Used when an order's products carry no weight of their own. Dimensions always
            come from here — override them per shipment when a parcel is unusual.
          </p>
          <div className="grid gap-4 sm:grid-cols-4">
            <Input label="Length (cm)" type="number" step="0.1" value={value.default_length_cm}
              onChange={(e) => set("default_length_cm", e.target.value)} />
            <Input label="Breadth (cm)" type="number" step="0.1" value={value.default_breadth_cm}
              onChange={(e) => set("default_breadth_cm", e.target.value)} />
            <Input label="Height (cm)" type="number" step="0.1" value={value.default_height_cm}
              onChange={(e) => set("default_height_cm", e.target.value)} />
            <Input label="Weight (kg)" type="number" step="0.01" value={value.default_weight_kg}
              onChange={(e) => set("default_weight_kg", e.target.value)} />
          </div>
        </div>

        <div className="border-t border-hairline pt-5 space-y-4">
          <Select
            label="Book the courier automatically"
            value={value.auto_ship_on_status}
            options={AUTO_SHIP_OPTIONS}
            onChange={(e) => set("auto_ship_on_status", e.target.value)}
          />
          <Input
            label="Default courier ID (blank = Velocity's shipping rules choose)"
            value={value.default_carrier_id}
            placeholder="CARO0ZZQH1H6U"
            onChange={(e) => set("default_carrier_id", e.target.value)}
          />
          <Toggle
            label="Cancel the consignment when an order is cancelled here"
            checked={value.cancel_shipment_with_order}
            onChange={(v) => set("cancel_shipment_with_order", v)}
          />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex items-center gap-4">
          <Btn
            variant="primary"
            disabled={save.isPending}
            onClick={() => save.mutate({ ...draft, ...(password ? { password } : {}) })}
          >
            {save.isPending ? "…" : "Save"}
          </Btn>
          {saved && <span className="text-xs text-emerald-400">Saved</span>}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Warehouses                                                                 */
/* -------------------------------------------------------------------------- */

const EMPTY_WAREHOUSE: WarehouseInput = {
  name: "",
  pickup_location: "",
  contact_person: "",
  phone_number: "",
  email: "",
  gst_no: "",
  street_address: "",
  city: "",
  state: "",
  zip: "",
  country: "India",
  is_active: true,
};

function WarehousePanel() {
  const editor = useEditor<Warehouse>();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "shipping", "warehouses"],
    queryFn: listWarehouses,
  });

  const register = useMutation({
    mutationFn: registerWarehouse,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "shipping"] }),
  });

  return (
    <section className="mb-12">
      <div className="flex items-baseline justify-between mb-4">
        <div className="text-eyebrow">Pickup warehouses</div>
        <Btn onClick={() => editor.open("new")}>Add warehouse</Btn>
      </div>

      {isLoading ? (
        <div className="text-eyebrow">Loading</div>
      ) : (data?.length ?? 0) === 0 ? (
        <p className="border border-hairline p-6 text-sm text-muted-foreground">
          No warehouses yet. Velocity collects from a registered pickup address, so add one
          before you ship anything.
        </p>
      ) : (
        <Table headers={["Name", "Velocity ID", "City", "PIN", "Contact", ""]}>
          {data!.map((w) => (
            <tr key={w.id}>
              <Td className="font-medium">{w.name}</Td>
              <Td>
                {w.is_registered ? (
                  <span className="font-mono text-xs">{w.warehouse_id}</span>
                ) : (
                  <Chip tone="warn">Not registered</Chip>
                )}
              </Td>
              <Td>{w.city}</Td>
              <Td>{w.zip}</Td>
              <Td className="text-muted-foreground">{w.contact_person}</Td>
              <Td>
                <div className="flex gap-2">
                  <Btn onClick={() => editor.open(w)}>Edit</Btn>
                  {!w.is_registered && (
                    <Btn
                      variant="primary"
                      disabled={register.isPending}
                      onClick={() => register.mutate(w.id)}
                    >
                      Register
                    </Btn>
                  )}
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}

      {editor.editing !== null && (
        <WarehouseEditor
          warehouse={editor.editing === "new" ? null : editor.editing}
          onClose={editor.close}
        />
      )}
    </section>
  );
}

function WarehouseEditor({ warehouse, onClose }: { warehouse: Warehouse | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<WarehouseInput>(
    warehouse ? { ...(warehouse as unknown as WarehouseInput) } : EMPTY_WAREHOUSE,
  );
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => (warehouse ? updateWarehouse(warehouse.id, form) : createWarehouse(form)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "shipping"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const field = (key: keyof WarehouseInput) => ({
    value: String(form[key] ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <EditorPanel title={warehouse ? warehouse.name : "New warehouse"} onClose={onClose}>
      <div className="space-y-4">
        {warehouse?.is_registered && (
          <p className="text-xs text-muted-foreground">
            Registered with Velocity as{" "}
            <span className="font-mono text-bone">{warehouse.warehouse_id}</span>. Edits here
            do not change their copy — create a new warehouse if the address moves.
          </p>
        )}
        <Input label="Name" {...field("name")} />
        <Input label="Pickup label (blank = same as name)" {...field("pickup_location")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Contact person" {...field("contact_person")} />
          <Input label="Phone" {...field("phone_number")} />
          <Input label="Email" type="email" {...field("email")} />
          <Input label="GST number (optional)" {...field("gst_no")} />
        </div>
        <TextArea label="Street address" {...field("street_address")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="City" {...field("city")} />
          <Input label="State" {...field("state")} />
          <Input label="PIN code" {...field("zip")} />
          <Input label="Country" {...field("country")} />
        </div>
        {!warehouse && (
          <p className="text-xs text-muted-foreground">
            Saving registers this warehouse with Velocity straight away and stores the
            warehouse ID they hand back.
          </p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Btn variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "…" : warehouse ? "Save" : "Create & register"}
        </Btn>
      </div>
    </EditorPanel>
  );
}

/* -------------------------------------------------------------------------- */
/* Serviceability check                                                       */
/* -------------------------------------------------------------------------- */

function ServiceabilityPanel() {
  const [pin, setPin] = useState("");
  const [mode, setMode] = useState<"cod" | "prepaid">("prepaid");
  const [result, setResult] = useState<Serviceability | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = useMutation({
    mutationFn: () => checkServiceability({ destination_pin: pin, payment_mode: mode }),
    onSuccess: (data) => {
      setError(null);
      setResult(data);
    },
    onError: (e: Error) => {
      setResult(null);
      setError(e.message);
    },
  });

  return (
    <section className="mb-12">
      <div className="text-eyebrow mb-4">Check a PIN code</div>
      <div className="border border-hairline p-6">
        <p className="text-xs text-muted-foreground mb-4">
          Ask Velocity which couriers can run a lane from your default warehouse — worth
          doing before promising a customer a delivery date.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Input
              label="Destination PIN"
              value={pin}
              placeholder="560102"
              onChange={(e) => setPin(e.target.value)}
            />
          </div>
          <div className="w-40">
            <Select
              label="Payment"
              value={mode}
              options={[
                { value: "prepaid", label: "Prepaid" },
                { value: "cod", label: "COD" },
              ]}
              onChange={(e) => setMode(e.target.value as "cod" | "prepaid")}
            />
          </div>
          <Btn variant="primary" disabled={!pin || check.isPending} onClick={() => check.mutate()}>
            {check.isPending ? "…" : "Check"}
          </Btn>
        </div>

        {error && <p className="mt-4 text-xs text-destructive">{error}</p>}

        {result && (
          <div className="mt-5 border-t border-hairline pt-4">
            {result.serviceable ? (
              <>
                <p className="text-sm">
                  {result.from} → {result.to} ·{" "}
                  <span className="text-emerald-400">
                    {result.carriers.length} courier{result.carriers.length === 1 ? "" : "s"}
                  </span>
                  {result.zone && <span className="text-muted-foreground"> · {result.zone}</span>}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.carriers.map((c) => (
                    <span
                      key={c.carrier_id}
                      title={c.carrier_id}
                      className="border border-hairline px-2 py-1 text-xs"
                    >
                      {c.carrier_name}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-destructive">
                No courier serves {result.to} from {result.from} for {mode} orders.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Shipments                                                                  */
/* -------------------------------------------------------------------------- */

function ShipmentPanel() {
  const queryClient = useQueryClient();
  const editor = useEditor<AdminShipment>();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "shipping", "shipments", status, search],
    queryFn: () =>
      listShipments(
        `?page_size=50${status ? `&status=${status}` : ""}${search ? `&search=${encodeURIComponent(search)}` : ""}`,
      ),
  });

  const sync = useMutation({
    mutationFn: syncAllShipments,
    onSuccess: (r) => {
      setNote(
        r.errors.length
          ? r.errors[0]
          : `Refreshed ${r.updated} of ${r.tracked} shipment${r.tracked === 1 ? "" : "s"}.`,
      );
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e: Error) => setNote(e.message),
  });

  const rows = data?.results ?? [];

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
        <div className="text-eyebrow">Shipments · {data?.count ?? 0}</div>
        <div className="flex items-center gap-3">
          {note && <span className="text-xs text-muted-foreground">{note}</span>}
          <Btn disabled={sync.isPending} onClick={() => sync.mutate()}>
            {sync.isPending ? "…" : "Refresh tracking"}
          </Btn>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search AWB or order #…"
          className="bg-transparent border border-hairline focus:border-bone px-3 py-2 outline-none text-sm w-64"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="bg-ink border border-hairline px-3 py-2 text-sm outline-none"
        >
          <option value="">All statuses</option>
          {Object.entries(SHIPMENT_STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="text-eyebrow">Loading</div>
      ) : rows.length === 0 ? (
        <p className="border border-hairline p-6 text-sm text-muted-foreground">
          Nothing shipped yet. Manifest an order from the Orders screen and it will appear here.
        </p>
      ) : (
        <Table headers={["Order", "AWB", "Courier", "Type", "Status", "Tracked", ""]}>
          {rows.map((s) => (
            <tr key={s.id}>
              <Td className="font-medium">{s.order_number}</Td>
              <Td className="font-mono text-xs">{s.awb_code || "—"}</Td>
              <Td className="text-muted-foreground max-w-40 truncate">{s.carrier_name || "—"}</Td>
              <Td>{s.kind === "return" ? "Return" : "Forward"}</Td>
              <Td>
                <Chip tone={SHIPMENT_STATUS_TONE[s.status]}>
                  {SHIPMENT_STATUS_LABELS[s.status]}
                </Chip>
              </Td>
              <Td className="text-xs text-muted-foreground">
                {s.last_tracked_at ? new Date(s.last_tracked_at).toLocaleString() : "—"}
              </Td>
              <Td><Btn onClick={() => editor.open(s)}>Open</Btn></Td>
            </tr>
          ))}
        </Table>
      )}

      {editor.editing !== null && editor.editing !== "new" && (
        <ShipmentDetail shipment={editor.editing} onClose={editor.close} />
      )}
    </section>
  );
}

function ShipmentDetail({ shipment, onClose }: { shipment: AdminShipment; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [carrier, setCarrier] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin"] });

  const track = useMutation({
    mutationFn: () => trackShipment(shipment.id),
    onSuccess: refresh,
    onError: (e: Error) => setError(e.message),
  });
  const cancel = useMutation({
    mutationFn: () => cancelShipment(shipment.id),
    onSuccess: () => {
      refresh();
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });
  const assign = useMutation({
    mutationFn: () => assignCarrier(shipment.id, carrier),
    onSuccess: refresh,
    onError: (e: Error) => setError(e.message),
  });

  const charges = shipment.charges as Record<string, Record<string, string> | string>;

  return (
    <EditorPanel title={`Shipment · ${shipment.order_number}`} onClose={onClose}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Chip tone={SHIPMENT_STATUS_TONE[shipment.status as ShipmentStatus]}>
            {SHIPMENT_STATUS_LABELS[shipment.status as ShipmentStatus]}
          </Chip>
          {shipment.is_cod && <Chip tone="warn">COD ₹{shipment.cod_collectible.toFixed(2)}</Chip>}
          <Chip>{shipment.kind === "return" ? "Return pickup" : "Forward"}</Chip>
        </div>

        {shipment.error && (
          <p className="border border-destructive/40 text-destructive p-4 text-xs">
            {shipment.error}
          </p>
        )}

        <dl className="space-y-2 text-sm">
          <Detail label="Customer" value={`${shipment.customer_name} · ${shipment.customer_email}`} />
          <Detail label="AWB" value={shipment.awb_code || "—"} mono />
          <Detail label="Courier" value={shipment.carrier_name || "Not assigned"} />
          <Detail label="Velocity order" value={shipment.velocity_order_id || "—"} mono />
          <Detail label="Our reference" value={shipment.reference} mono />
          <Detail label="Warehouse" value={shipment.warehouse_name || "—"} />
          <Detail
            label="Parcel"
            value={`${shipment.length_cm} × ${shipment.breadth_cm} × ${shipment.height_cm} cm · ${shipment.weight_kg} kg`}
          />
          {shipment.applied_weight_kg && (
            <Detail label="Billed weight" value={`${shipment.applied_weight_kg} kg`} />
          )}
          {shipment.tracking_status && (
            <Detail label="Courier says" value={shipment.tracking_status} />
          )}
        </dl>

        {Object.keys(charges).length > 0 && (
          <div className="border-t border-hairline pt-4">
            <div className="text-eyebrow mb-2">Charges</div>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {Object.entries(charges).map(([group, value]) =>
                typeof value === "object" && value !== null ? (
                  Object.entries(value).map(([k, v]) => (
                    <li key={`${group}-${k}`} className="flex justify-between">
                      <span>{k.replace(/_/g, " ")}</span>
                      <span className="text-bone">{String(v)}</span>
                    </li>
                  ))
                ) : (
                  <li key={group} className="flex justify-between">
                    <span>{group.replace(/_/g, " ")}</span>
                    <span className="text-bone">{String(value)}</span>
                  </li>
                ),
              )}
            </ul>
          </div>
        )}

        <div className="border-t border-hairline pt-4 flex flex-wrap gap-3">
          {shipment.label_url && (
            <a href={shipment.label_url} target="_blank" rel="noreferrer" className="btn-ghost text-[11px] uppercase tracking-[0.2em] px-3 py-1.5 border border-hairline">
              Print label
            </a>
          )}
          {shipment.track_url && (
            <a href={shipment.track_url} target="_blank" rel="noreferrer" className="btn-ghost text-[11px] uppercase tracking-[0.2em] px-3 py-1.5 border border-hairline">
              Courier page
            </a>
          )}
          {shipment.awb_code && (
            <Btn disabled={track.isPending} onClick={() => track.mutate()}>
              {track.isPending ? "…" : "Refresh tracking"}
            </Btn>
          )}
          {shipment.can_cancel && (
            <Btn variant="danger" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
              {cancel.isPending ? "…" : "Cancel shipment"}
            </Btn>
          )}
        </div>

        {shipment.needs_carrier && (
          <div className="border-t border-hairline pt-4 space-y-3">
            <div className="text-eyebrow">Assign a courier</div>
            <p className="text-xs text-muted-foreground">
              This order exists with Velocity but has no AWB yet. Leave the field blank to let
              their shipping rules choose.
            </p>
            <Input
              label="Courier ID"
              value={carrier}
              placeholder="CARO0ZZQH1H6U"
              onChange={(e) => setCarrier(e.target.value)}
            />
            <Btn variant="primary" disabled={assign.isPending} onClick={() => assign.mutate()}>
              {assign.isPending ? "…" : "Assign"}
            </Btn>
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="border-t border-hairline pt-4">
          <div className="text-eyebrow mb-3">Courier scans</div>
          {shipment.events.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No scans yet. They appear once the courier picks the parcel up.
            </p>
          ) : (
            <ol className="space-y-3">
              {shipment.events.map((e, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-bone shrink-0" />
                  <div>
                    <div>{e.activity}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {e.raw_date}
                      {e.location ? ` · ${e.location}` : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </EditorPanel>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className={`text-right ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
