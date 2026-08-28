import { api, API_URL, getAccessToken, type Paginated } from "./api";
import { resolveAsset } from "./assets";
import type { ProductListItem } from "./products";

export type Address = {
  id: number;
  full_name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean;
};

export type AddressInput = Omit<Address, "id">;

export type OrderItem = {
  id: number;
  product: number | null;
  title: string;
  slug: string;
  size: string;
  color: string;
  image_url: string;
  price: number;
  quantity: number;
  line_total: number;
};

export type OrderEvent = { status: string; note: string; created_at: string };

export type Order = {
  id: number;
  order_number: string;
  status: string;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  coupon_code: string;
  payment_method: string;
  payment_status: string;
  shipping_address: Record<string, string>;
  billing_address: Record<string, string> | null;
  tracking_number: string;
  items: OrderItem[];
  events: OrderEvent[];
  can_cancel: boolean;
  /** Present only on UPI / bank-transfer orders, which settle out-of-band. */
  manual_payment: ManualPayment | null;
  created_at: string;
};

export type ManualPayment = {
  payment_id: number | null;
  /** "" | "pending" | "submitted" | "succeeded" | "failed" */
  status: string;
  reference: string;
  review_note: string;
  label: string;
  instructions: string;
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

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Payment pending",
  awaiting: "Awaiting confirmation",
  paid: "Paid",
  failed: "Payment failed",
  refunded: "Refunded",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  packed: "Packed",
  shipped: "Shipped",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

function fixOrder(order: Order): Order {
  return {
    ...order,
    items: order.items.map((i) => ({ ...i, image_url: resolveAsset(i.image_url) })),
  };
}

export async function listAddresses(): Promise<Address[]> {
  return api<Address[]>("/auth/addresses/");
}

export async function createAddress(data: AddressInput): Promise<Address> {
  return api<Address>("/auth/addresses/", { method: "POST", body: data });
}

export async function updateAddress(id: number, data: Partial<AddressInput>): Promise<Address> {
  return api<Address>(`/auth/addresses/${id}/`, { method: "PATCH", body: data });
}

export async function deleteAddress(id: number): Promise<void> {
  await api(`/auth/addresses/${id}/`, { method: "DELETE" });
}

export async function listOrders(): Promise<Order[]> {
  const data = await api<Paginated<Order>>("/orders/?page_size=50");
  return data.results.map(fixOrder);
}

export async function cancelOrder(id: number): Promise<Order> {
  return fixOrder(await api<Order>(`/orders/${id}/cancel/`, { method: "POST" }));
}

export async function placeOrder(payload: {
  shipping_address_id: number;
  billing_address_id?: number | null;
  payment_method: string;
  notes?: string;
}): Promise<Order> {
  return fixOrder(await api<Order>("/orders/checkout/", { method: "POST", body: payload }));
}

export async function openInvoice(orderId: number) {
  // The invoice endpoint needs the JWT, so fetch it and open as a blob.
  const res = await fetch(`${API_URL}/orders/${orderId}/invoice/`, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });
  if (!res.ok) throw new Error("Could not load invoice");
  const blob = await res.blob();
  window.open(URL.createObjectURL(blob), "_blank");
}

export async function listWishlist(): Promise<ProductListItem[]> {
  const items = await api<{ id: number; product: ProductListItem }[]>("/wishlist/");
  return items.map((w) => ({
    ...w.product,
    image: resolveAsset(w.product.image),
    hover_image: w.product.hover_image ? resolveAsset(w.product.hover_image) : null,
  }));
}
