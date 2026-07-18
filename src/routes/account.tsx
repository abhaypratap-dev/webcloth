import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "Account — Cut & Cult" }, { name: "robots", content: "noindex" }] }),
  component: Account,
});

const CARDS = [
  { label: "Orders", to: "/account/orders" },
  { label: "Wishlist", to: "/account/wishlist" },
  { label: "Addresses", to: "/account/addresses" },
  { label: "Profile", to: "/account/profile" },
] as const;

function Account() {
  const nav = useNavigate();
  const auth = useAuth();

  useEffect(() => {
    if (!auth.loading && !auth.isAuthenticated) nav({ to: "/auth" });
  }, [auth.loading, auth.isAuthenticated, nav]);

  if (auth.loading || !auth.user) {
    return <div className="pt-40 text-center text-eyebrow">Loading</div>;
  }

  return (
    <div className="pt-32 pb-24 px-5 md:px-10 max-w-5xl mx-auto">
      <p className="text-eyebrow">Members</p>
      <h1 className="mt-4 text-large-display">Your world</h1>
      <p className="mt-4 text-muted-foreground">{auth.user.full_name} · {auth.user.email}</p>

      <div className="mt-16 grid md:grid-cols-3 gap-4">
        {CARDS.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="group border border-hairline p-8 aspect-[4/3] flex flex-col justify-between hover:border-bone/60 transition"
          >
            <span className="text-eyebrow opacity-70">Manage</span>
            <span className="text-large-display text-[2rem] group-hover:opacity-70 transition">{c.label}</span>
          </Link>
        ))}
        {auth.user.is_staff && (
          <Link
            to="/admin"
            className="group border border-hairline p-8 aspect-[4/3] flex flex-col justify-between hover:border-bone/60 transition"
          >
            <span className="text-eyebrow opacity-70">Staff</span>
            <span className="text-large-display text-[2rem] group-hover:opacity-70 transition">Admin</span>
          </Link>
        )}
        <button
          onClick={async () => { await auth.logout(); nav({ to: "/" }); }}
          className="border border-hairline p-8 aspect-[4/3] flex flex-col justify-between hover:border-destructive/60 transition text-left"
        >
          <span className="text-eyebrow opacity-70">Session</span>
          <span className="text-large-display text-[2rem]">Sign out</span>
        </button>
      </div>
    </div>
  );
}
