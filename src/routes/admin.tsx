import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  LayoutDashboard, Package, FolderTree, Tags, Boxes, ShoppingCart,
  Users, TicketPercent, BadgePercent, Star, Image, FileText, Settings,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/site/Logo";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Cut & Cult" }, { name: "robots", content: "noindex" }] }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/categories", label: "Categories", icon: FolderTree },
  { to: "/admin/brands", label: "Brands", icon: Tags },
  { to: "/admin/inventory", label: "Inventory", icon: Boxes },
  { to: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/coupons", label: "Coupons", icon: TicketPercent },
  { to: "/admin/offers", label: "Offers", icon: BadgePercent },
  { to: "/admin/reviews", label: "Reviews", icon: Star },
  { to: "/admin/banners", label: "Homepage", icon: Image },
  { to: "/admin/cms", label: "CMS", icon: FileText },
  { to: "/admin/settings", label: "Settings", icon: Settings },
] as const;

function AdminLayout() {
  const auth = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!auth.loading && (!auth.isAuthenticated || !auth.user?.is_staff)) {
      nav({ to: "/auth" });
    }
  }, [auth.loading, auth.isAuthenticated, auth.user, nav]);

  if (auth.loading || !auth.user?.is_staff) {
    return <div className="pt-40 text-center text-eyebrow">Loading</div>;
  }

  return (
    <div className="min-h-screen flex bg-ink pt-16 md:pt-20">
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-hairline min-h-full sticky top-20 self-start max-h-[calc(100vh-5rem)] overflow-y-auto">
        <div className="px-5 py-6 border-b border-hairline">
          <Logo />
          <div className="text-eyebrow mt-2 opacity-60">Control room</div>
        </div>
        <nav className="flex-1 py-4">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: "exact" in item && item.exact }}
              activeProps={{ className: "bg-bone/10 text-bone border-r-2 border-bone" }}
              className="flex items-center gap-3 px-5 py-2.5 text-[11px] uppercase tracking-[0.2em] text-bone/60 hover:text-bone transition"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-hairline">
          <Link to="/" className="text-eyebrow link-underline">← Storefront</Link>
        </div>
      </aside>

      <div className="flex-1 min-w-0 px-5 md:px-10 py-10">
        {/* Mobile nav */}
        <div className="md:hidden mb-8 flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeProps={{ className: "bg-bone text-ink border-bone" }}
              className="shrink-0 border border-hairline px-3 py-1.5 text-[10px] uppercase tracking-[0.2em]"
            >
              {item.label}
            </Link>
          ))}
        </div>
        <Outlet />
      </div>
    </div>
  );
}
