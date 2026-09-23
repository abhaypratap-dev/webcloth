/**
 * Velocity Shipping — admin API client and shared types.
 *
 * Mirrors backend/apps/shipping. Everything under `/shipping/admin/` is staff
 * only; customers see their parcels through the `shipments` array the order
 * endpoints already return (see `Shipment` in ./account).
 */

import { api, type Paginated } from "./api";

export type ShipmentStatus =
  | "created"
  | "manifested"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "rto"
  | "cancelled"
  | "failed";

export type ShipmentScan = {
  activity: string;
  location: string;
  occurred_at: string | null;
  raw_date: string;
};

export type ShippingSettings = {
  is_enabled: boolean;
  base_url: string;
  username: string;
  /** Write-only — the API never sends it back. Use `has_credentials`. */
  password?: string;
  default_warehouse: number | null;
  default_warehouse_name: string;
  default_carrier_id: string;
  default_length_cm: string;
  default_breadth_cm: string;
  default_height_cm: string;
  default_weight_kg: string;
  /** Order status that auto-manifests. "" keeps shipping a manual step. */
  auto_ship_on_status: string;
  cancel_shipment_with_order: boolean;
  has_credentials: boolean;
  token_is_valid: boolean;
  /** Non-empty while the integration cannot be switched on yet. */
  configuration_error: string;
  updated_at: string;
};

export type Warehouse = {
  id: number;
  name: string;
  /** Velocity's own id. Empty until the warehouse is registered with them. */
  warehouse_id: string;
  pickup_location: string;
  contact_person: string;
  phone_number: string;
  email: string;
  gst_no: string;
  street_address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  is_active: boolean;
  is_registered: boolean;
  created_at: string;
};

export type WarehouseInput = Omit<
  Warehouse,
  "id" | "warehouse_id" | "is_registered" | "created_at"
>;

export type AdminShipment = {
  id: number;
  order: number;
  order_number: string;
  order_status: string;
  customer_email: string;
  customer_name: string;
  kind: "forward" | "return";
  status: ShipmentStatus;
  reference: string;
  velocity_order_id: string;
  velocity_shipment_id: string;
  velocity_return_id: string;
  awb_code: string;
  carrier_id: string;
  carrier_name: string;
  label_url: string;
  manifest_url: string;
  track_url: string;
  warehouse: number | null;
  warehouse_name: string;
  length_cm: string | null;
  breadth_cm: string | null;
  height_cm: string | null;
  weight_kg: string | null;
  applied_weight_kg: string | null;
  is_cod: boolean;
  cod_collectible: number;
  charges: Record<string, unknown>;
  tracking_status: string;
  last_tracked_at: string | null;
  error: string;
  can_cancel: boolean;
  needs_carrier: boolean;
  events: ShipmentScan[];
  created_at: string;
};

export type Carrier = { carrier_id: string; carrier_name: string };

export type Serviceability = {
  serviceable: boolean;
  carriers: Carrier[];
  zone: string;
  from: string;
  to: string;
};

export type Parcel = { length: number; breadth: number; height: number; weight: number };

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  created: "Awaiting courier",
  manifested: "Manifested",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  rto: "Returned to origin",
  cancelled: "Cancelled",
  failed: "Failed",
};

export const SHIPMENT_STATUS_TONE: Record<ShipmentStatus, "good" | "bad" | "warn" | "default"> = {
  created: "warn",
  manifested: "default",
  in_transit: "default",
  out_for_delivery: "default",
  delivered: "good",
  rto: "bad",
  cancelled: "bad",
  failed: "bad",
};

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

export function getShippingSettings() {
  return api<ShippingSettings>("/shipping/admin/settings/");
}

export function saveShippingSettings(patch: Partial<ShippingSettings>) {
  return api<ShippingSettings>("/shipping/admin/settings/", { method: "PATCH", body: patch });
}

/* -------------------------------------------------------------------------- */
/* Warehouses                                                                 */
/* -------------------------------------------------------------------------- */

export function listWarehouses() {
  return api<Warehouse[]>("/shipping/admin/warehouses/");
}

export function createWarehouse(data: WarehouseInput) {
  return api<Warehouse>("/shipping/admin/warehouses/", { method: "POST", body: data });
}

export function updateWarehouse(id: number, data: Partial<WarehouseInput>) {
  return api<Warehouse>(`/shipping/admin/warehouses/${id}/`, { method: "PATCH", body: data });
}

/** Retry the Velocity-side registration for a warehouse whose creation failed. */
export function registerWarehouse(id: number) {
  return api<Warehouse>(`/shipping/admin/warehouses/${id}/register/`, { method: "POST" });
}

/* -------------------------------------------------------------------------- */
/* Serviceability                                                             */
/* -------------------------------------------------------------------------- */

export function checkServiceability(body: {
  order_id?: number;
  destination_pin?: string;
  origin_pin?: string;
  payment_mode?: "cod" | "prepaid";
  shipment_type?: "forward" | "return";
  warehouse_id?: number | null;
}) {
  return api<Serviceability>("/shipping/admin/serviceability/", { method: "POST", body });
}

/* -------------------------------------------------------------------------- */
/* Shipments                                                                  */
/* -------------------------------------------------------------------------- */

export function listShipments(query = "") {
  return api<Paginated<AdminShipment>>(`/shipping/admin/shipments/${query}`);
}

export function createShipment(body: {
  order_id: number;
  carrier_id?: string;
  warehouse_id?: number | null;
  parcel?: Parcel;
  assign_carrier?: boolean;
}) {
  return api<AdminShipment>("/shipping/admin/shipments/", { method: "POST", body });
}

export function assignCarrier(id: number, carrier_id: string) {
  return api<AdminShipment>(`/shipping/admin/shipments/${id}/assign/`, {
    method: "POST",
    body: { carrier_id },
  });
}

export function cancelShipment(id: number) {
  return api<AdminShipment>(`/shipping/admin/shipments/${id}/cancel/`, { method: "POST" });
}

export function trackShipment(id: number) {
  return api<AdminShipment>(`/shipping/admin/shipments/${id}/track/`, { method: "POST" });
}

/** Refresh every open consignment — the same work the nightly cron does. */
export function syncAllShipments() {
  return api<{ tracked: number; updated: number; errors: string[] }>(
    "/shipping/admin/shipments/sync/",
    { method: "POST" },
  );
}

export function createReturn(body: {
  order_id: number;
  items?: { order_item_id: number; units?: number }[];
  carrier_id?: string;
  warehouse_id?: number | null;
  parcel?: Parcel;
  request_pickup?: boolean;
}) {
  return api<AdminShipment>("/shipping/admin/shipments/returns/", { method: "POST", body });
}
