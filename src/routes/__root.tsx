import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { CartProvider } from "@/lib/cart";
import { WishlistProvider } from "@/lib/wishlist";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { CartDrawer } from "@/components/site/CartDrawer";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="max-w-md text-center">
        <h1 className="text-massive text-[8rem] leading-none">404</h1>
        <p className="mt-6 text-eyebrow">Off the grid</p>
        <p className="mt-3 text-sm text-muted-foreground">This page doesn&rsquo;t exist. Or it never did.</p>
        <div className="mt-10">
          <Link to="/" className="btn-cult">Return home</Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="max-w-md text-center">
        <p className="text-eyebrow">Something broke</p>
        <h1 className="mt-4 text-large-display text-[2rem]">Try again</h1>
        <div className="mt-8 flex justify-center gap-3">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="btn-cult"
          >
            Retry
          </button>
          <a href="/" className="btn-ghost">Home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Cut & Cult — Building a culture. One cut at a time." },
      { name: "description", content: "Cut & Cult is a unisex fashion house. Timeless silhouettes, heavyweight fabrics, and a culture built on authenticity." },
      { name: "theme-color", content: "#111111" },
      { property: "og:title", content: "Cut & Cult — Building a culture. One cut at a time." },
      { property: "og:description", content: "Cut & Cult is a unisex fashion house. Timeless silhouettes, heavyweight fabrics, and a culture built on authenticity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Cut & Cult — Building a culture. One cut at a time." },
      { name: "twitter:description", content: "Cut & Cult is a unisex fashion house. Timeless silhouettes, heavyweight fabrics, and a culture built on authenticity." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head><HeadContent /></head>
      <body className="bg-ink text-bone">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>
            <Nav />
            <main className="min-h-screen">
              <Outlet />
            </main>
            <Footer />
            <CartDrawer />
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
