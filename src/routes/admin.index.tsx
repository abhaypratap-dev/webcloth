import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { api } from "@/lib/api";
import { Chip, money, PageHead, Table, Td } from "@/components/admin/kit";
import { ORDER_STATUS_LABELS } from "@/lib/account";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

type Stats = {
  revenue: number;
  orders_count: number;
  monthly_revenue: number;
  monthly_orders: number;
  customers_count: number;
  products_count: number;
  pending_orders: number;
  low_stock_count: number;
  out_of_stock_count: number;
  sales_daily: { date: string; revenue: number; orders: number }[];
  sales_monthly: { month: string; revenue: number; orders: number }[];
  top_products: { product_id: number; title: string; sold: number; revenue: number }[];
  recent_orders: {
    id: number; order_number: string; customer_email: string; status: string;
    total: number; created_at: string;
  }[];
};

const BONE = "#F7F5F2";
const GRID = "rgba(255,255,255,0.08)";
const MUTED = "rgba(247,245,242,0.55)";

function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => api<Stats>("/dashboard/stats/"),
  });

  if (isLoading || !stats) return <div className="text-eyebrow">Loading</div>;

  return (
    <div>
      <PageHead title="Dashboard" subtitle="Store performance at a glance" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Total revenue" value={money(stats.revenue)} />
        <StatTile label="Orders" value={String(stats.orders_count)} note={`${stats.pending_orders} pending`} />
        <StatTile label="This month" value={money(stats.monthly_revenue)} note={`${stats.monthly_orders} orders`} />
        <StatTile label="Customers" value={String(stats.customers_count)} note={`${stats.products_count} products`} />
      </div>

      {(stats.low_stock_count > 0 || stats.out_of_stock_count > 0) && (
        <Link to="/admin/inventory" className="mt-4 flex items-center gap-3 border border-amber-500/40 px-4 py-3 text-sm text-amber-400 hover:border-amber-400 transition">
          <span className="text-eyebrow">Stock alerts</span>
          {stats.low_stock_count > 0 && <span>{stats.low_stock_count} low</span>}
          {stats.out_of_stock_count > 0 && <span>{stats.out_of_stock_count} out of stock</span>}
        </Link>
      )}

      <div className="grid lg:grid-cols-2 gap-4 mt-8">
        <ChartCard title="Revenue — last 30 days">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={stats.sales_daily} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: MUTED, fontSize: 10 }}
                tickFormatter={(d: string) => d.slice(5)}
                axisLine={{ stroke: GRID }}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                tick={{ fill: MUTED, fontSize: 10 }}
                tickFormatter={(v: number) => `₹${v}`}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip
                content={<ChartTooltip labelKey="date" />}
                cursor={{ stroke: MUTED, strokeDasharray: "3 3" }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke={BONE}
                strokeWidth={2}
                fill={BONE}
                fillOpacity={0.08}
                activeDot={{ r: 4, fill: BONE, stroke: "#111", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Revenue — monthly">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats.sales_monthly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: MUTED, fontSize: 10 }}
                axisLine={{ stroke: GRID }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: MUTED, fontSize: 10 }}
                tickFormatter={(v: number) => `₹${v}`}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip content={<ChartTooltip labelKey="month" />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="revenue" fill={BONE} fillOpacity={0.85} radius={[3, 3, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-8">
        <div>
          <div className="text-eyebrow mb-4">Top selling</div>
          <Table headers={["Product", "Sold", "Revenue"]}>
            {stats.top_products.map((p) => (
              <tr key={p.product_id}>
                <Td className="max-w-56 truncate">{p.title}</Td>
                <Td>{p.sold}</Td>
                <Td>{money(p.revenue)}</Td>
              </tr>
            ))}
            {stats.top_products.length === 0 && (
              <tr><Td className="text-muted-foreground">No sales yet</Td><Td>{""}</Td><Td>{""}</Td></tr>
            )}
          </Table>
        </div>
        <div>
          <div className="text-eyebrow mb-4">Recent orders</div>
          <Table headers={["Order", "Customer", "Status", "Total"]}>
            {stats.recent_orders.map((o) => (
              <tr key={o.id}>
                <Td><Link to="/admin/orders" className="link-underline">{o.order_number}</Link></Td>
                <Td className="max-w-40 truncate text-muted-foreground">{o.customer_email}</Td>
                <Td><Chip>{ORDER_STATUS_LABELS[o.status] ?? o.status}</Chip></Td>
                <Td>{money(o.total)}</Td>
              </tr>
            ))}
          </Table>
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="border border-hairline p-5">
      <div className="text-eyebrow opacity-70">{label}</div>
      <div className="mt-2 text-2xl font-medium tracking-tight">{value}</div>
      {note && <div className="mt-1 text-xs text-muted-foreground">{note}</div>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-hairline p-5">
      <div className="text-eyebrow mb-4">{title}</div>
      {children}
    </div>
  );
}

function ChartTooltip({ active, payload, label, labelKey }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="border border-hairline bg-ink px-3 py-2 text-xs">
      <div className="text-muted-foreground">{row[labelKey]}</div>
      <div className="mt-1 font-medium">{money(row.revenue)}</div>
      <div className="text-muted-foreground">{row.orders} order{row.orders === 1 ? "" : "s"}</div>
    </div>
  );
}
