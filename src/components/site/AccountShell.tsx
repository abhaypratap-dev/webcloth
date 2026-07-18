import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";

/** Shared frame for /account/* subpages: auth guard, back link, heading. */
export function AccountShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
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
      <Link to="/account" className="text-eyebrow link-underline">← Account</Link>
      <p className="mt-8 text-eyebrow">{eyebrow}</p>
      <h1 className="mt-4 text-large-display">{title}</h1>
      <div className="mt-12">{children}</div>
    </div>
  );
}
