import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShoppingBag, Search, User, Menu, X } from "lucide-react";
import { Logo, SkullMark } from "./Logo";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";

const NAV = [
  { to: "/shop", label: "Shop" },
  { to: "/shop", label: "New", search: { filter: "new" } as const },
  { to: "/shop", label: "Best Sellers", search: { filter: "best" } as const },
  { to: "/about", label: "World" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobile, setMobile] = useState(false);
  const cart = useCart();
  const auth = useAuth();
  const accountTo = auth.isAuthenticated ? "/account" : "/auth";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-700 ${
          scrolled ? "bg-background/85 backdrop-blur-xl border-b border-hairline" : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-[100rem] items-center justify-between px-5 md:h-20 md:px-10">
          <div className="flex items-center gap-8">
            <button
              className="md:hidden text-bone"
              aria-label="Menu"
              onClick={() => setMobile(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <nav className="hidden md:flex items-center gap-8 text-eyebrow">
              {NAV.map((n) => (
                <Link
                  key={n.label}
                  to={n.to}
                  search={n.search as any}
                  className="link-underline hover:text-bone transition-colors"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>

          <Link to="/" className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
            <SkullMark className="h-5 w-6 text-bone" />
            <Logo />
          </Link>

          <div className="flex items-center gap-5 md:gap-6">
            <Link to="/shop" aria-label="Search" className="text-bone/80 hover:text-bone transition">
              <Search className="h-[18px] w-[18px]" />
            </Link>
            <Link to={accountTo} aria-label="Account" className="hidden md:inline-flex text-bone/80 hover:text-bone transition">
              <User className="h-[18px] w-[18px]" />
            </Link>
            <button onClick={cart.open} aria-label="Cart" className="relative text-bone/80 hover:text-bone transition">
              <ShoppingBag className="h-[18px] w-[18px]" />
              {cart.count > 0 && (
                <span className="absolute -right-2 -top-2 min-w-[16px] h-4 px-1 grid place-items-center bg-bone text-ink text-[10px] font-semibold tracking-widest">
                  {cart.count}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-[60] transition-opacity duration-500 md:hidden ${
          mobile ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="absolute inset-0 bg-ink/95 backdrop-blur-xl" onClick={() => setMobile(false)} />
        <div className={`absolute inset-y-0 left-0 w-[85vw] max-w-sm bg-ink border-r border-hairline p-8 flex flex-col transition-transform duration-700 ease-[cubic-bezier(0.7,0,0.2,1)] ${mobile ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex items-center justify-between mb-16">
            <Logo />
            <button onClick={() => setMobile(false)} aria-label="Close"><X className="h-5 w-5" /></button>
          </div>
          <nav className="flex flex-col gap-6">
            {NAV.map((n) => (
              <Link
                key={n.label}
                to={n.to}
                search={n.search as any}
                onClick={() => setMobile(false)}
                className="text-large-display text-[2.5rem] hover:text-bone/60 transition"
              >
                {n.label}
              </Link>
            ))}
            <Link to={accountTo} onClick={() => setMobile(false)} className="text-large-display text-[2.5rem]">
              Account
            </Link>
          </nav>
        </div>
      </div>
    </>
  );
}
