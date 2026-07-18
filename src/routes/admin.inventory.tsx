import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import {
  Btn, Chip, PageHead, Table, Td, useAdminList, useInvalidate,
} from "@/components/admin/kit";

export const Route = createFileRoute("/admin/inventory")({
  component: AdminInventory,
});

type InventoryVariant = {
  id: number;
  product_id: number;
  product_title: string;
  product_slug: string;
  size: string;
  color: string;
  sku: string;
  stock: number;
  low_stock_threshold: number;
  is_low_stock: boolean;
};

type Alerts = { low_stock: InventoryVariant[]; out_of_stock: InventoryVariant[] };

function AdminInventory() {
  const { data: variants, isLoading } = useAdminList<InventoryVariant>("inventory", "/inventory/?page_size=200");
  const { data: alerts } = useQuery({
    queryKey: ["admin", "inventory", "alerts"],
    queryFn: () => api<Alerts>("/inventory/alerts/"),
  });
  const invalidate = useInvalidate(["inventory", "products", "stats"]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  async function adjust(variant: InventoryVariant, delta: number) {
    setBusy(variant.id);
    try {
      await api("/inventory/adjust/", {
        method: "POST",
        body: { variant_id: variant.id, delta, reason: "manual", note: "Dashboard adjustment" },
      });
      invalidate();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(null);
    }
  }

  const filtered = (variants ?? []).filter((v) =>
    `${v.product_title} ${v.size} ${v.color} ${v.sku}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <PageHead title="Inventory" subtitle="Stock levels across all variants" />

      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <AlertCard
          tone="warn"
          label="Low stock"
          count={alerts?.low_stock.length ?? 0}
          items={alerts?.low_stock ?? []}
        />
        <AlertCard
          tone="bad"
          label="Out of stock"
          count={alerts?.out_of_stock.length ?? 0}
          items={alerts?.out_of_stock ?? []}
        />
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search variants…"
        className="mb-4 w-full max-w-sm bg-transparent border border-hairline focus:border-bone px-3 py-2 outline-none text-sm"
      />

      {isLoading ? (
        <div className="text-eyebrow">Loading</div>
      ) : (
        <Table headers={["Product", "Size", "Colour", "SKU", "Stock", "Adjust"]}>
          {filtered.map((v) => (
            <tr key={v.id}>
              <Td className="font-medium max-w-56 truncate">{v.product_title}</Td>
              <Td>{v.size || "—"}</Td>
              <Td>{v.color || "—"}</Td>
              <Td className="text-muted-foreground">{v.sku || "—"}</Td>
              <Td>
                <Chip tone={v.stock === 0 ? "bad" : v.is_low_stock ? "warn" : "good"}>{v.stock}</Chip>
              </Td>
              <Td>
                <div className="flex items-center gap-2">
                  <Btn onClick={() => adjust(v, -1)} disabled={busy === v.id || v.stock === 0}>−</Btn>
                  <Btn onClick={() => adjust(v, 1)} disabled={busy === v.id}>+</Btn>
                  <Btn onClick={() => adjust(v, 10)} disabled={busy === v.id}>+10</Btn>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

function AlertCard({
  tone,
  label,
  count,
  items,
}: {
  tone: "warn" | "bad";
  label: string;
  count: number;
  items: InventoryVariant[];
}) {
  return (
    <div className={`border p-5 ${tone === "bad" ? "border-destructive/40" : "border-amber-500/40"}`}>
      <div className="flex items-center justify-between">
        <span className="text-eyebrow">{label}</span>
        <span className="text-2xl font-medium">{count}</span>
      </div>
      {count > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground max-h-28 overflow-y-auto">
          {items.slice(0, 8).map((v) => (
            <li key={v.id} className="truncate">
              {v.product_title} · {[v.size, v.color].filter(Boolean).join(" / ")} — {v.stock}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
