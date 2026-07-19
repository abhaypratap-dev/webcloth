import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Heart, Plus, Minus, Star } from "lucide-react";
import { getProductBySlug, listRelated, listReviews } from "@/lib/products";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { ProductCard } from "@/components/site/ProductCard";
import { ProductGallery } from "@/components/site/ProductGallery";

const productQuery = (slug: string) =>
  queryOptions({
    queryKey: ["product", slug],
    queryFn: async () => {
      const p = await getProductBySlug(slug);
      if (!p) throw notFound();
      return p;
    },
  });

export const Route = createFileRoute("/product/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(productQuery(params.slug)),
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: `${loaderData.title} — Cut & Cult` },
            { name: "description", content: loaderData.description?.slice(0, 155) ?? "Cut & Cult" },
            { property: "og:title", content: loaderData.title },
            { property: "og:description", content: loaderData.description?.slice(0, 155) ?? "" },
            { property: "og:image", content: loaderData.image },
          ],
        }
      : { meta: [{ title: "Product not found" }, { name: "robots", content: "noindex" }] },
  component: ProductPage,
  notFoundComponent: () => (
    <div className="pt-40 text-center">
      <p className="text-eyebrow">Not found</p>
      <h1 className="mt-4 text-large-display text-[2rem]">This piece isn&rsquo;t available.</h1>
      <Link to="/shop" className="btn-cult mt-10">Back to shop</Link>
    </div>
  ),
  errorComponent: ({ error }) => <div className="pt-40 text-center text-sm">{error.message}</div>,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const { data: p } = useSuspenseQuery(productQuery(slug));
  const cart = useCart();
  const wishlist = useWishlist();

  const [size, setSize] = useState<string | null>(p.sizes[0] ?? null);
  const [color, setColor] = useState<string | null>(p.colors[0]?.name ?? null);
  const [qty, setQty] = useState(1);

  const variant = useMemo(
    () =>
      p.variants.find(
        (v) => (size === null || v.size === size) && (color === null || v.color === color),
      ) ?? null,
    [p.variants, size, color],
  );
  const stock = variant ? variant.stock : p.total_stock;
  const price = p.discount_price ?? p.price;

  const { data: related } = useQuery({
    queryKey: ["product", slug, "related"],
    queryFn: () => listRelated(slug),
  });
  const { data: reviews } = useQuery({
    queryKey: ["product", p.id, "reviews"],
    queryFn: () => listReviews(p.id),
  });

  return (
    <div className="pt-24 md:pt-28">
      <div className="grid md:grid-cols-[1.4fr_1fr]">
        {/* Gallery */}
        <div className="border-r border-hairline">
          <ProductGallery images={p.images} title={p.title} />
        </div>

        {/* Sticky panel */}
        <div className="md:sticky md:top-24 self-start px-6 md:px-12 py-12 md:py-16">
          <p className="text-eyebrow">{p.category?.replace(/-/g, " ")}</p>
          <h1 className="mt-4 text-large-display text-[2rem] md:text-[3rem] leading-[0.95]">{p.title}</h1>
          <div className="mt-6 flex items-baseline gap-3">
            <span className="text-xl">₹{price.toFixed(0)}</span>
            {p.discount_price != null && (
              <>
                <span className="text-sm text-muted-foreground line-through">₹{p.price.toFixed(0)}</span>
                <span className="text-eyebrow text-bone/80">−{p.discount_percent}%</span>
              </>
            )}
          </div>
          {(reviews?.length ?? 0) > 0 && p.rating_avg != null && (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Stars value={p.rating_avg} />
              <span>{p.rating_avg.toFixed(1)} · {p.reviews_count} review{p.reviews_count === 1 ? "" : "s"}</span>
            </div>
          )}

          {p.colors.length > 1 && (
            <div className="mt-10">
              <span className="text-eyebrow block mb-3">Colour — {color}</span>
              <div className="flex flex-wrap gap-2">
                {p.colors.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setColor(c.name)}
                    aria-label={c.name}
                    className={`h-8 w-8 rounded-full border-2 transition ${
                      color === c.name ? "border-bone" : "border-hairline hover:border-bone/60"
                    }`}
                    style={{ backgroundColor: c.hex || "#444" }}
                  />
                ))}
              </div>
            </div>
          )}

          {p.sizes.length > 0 && (
            <div className="mt-10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-eyebrow">Size</span>
                <button className="text-eyebrow opacity-60 hover:opacity-100">Size guide</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {p.sizes.map((s) => {
                  const sizeVariant = p.variants.find(
                    (v) => v.size === s && (color === null || v.color === color),
                  );
                  const disabled = (sizeVariant?.stock ?? 0) === 0;
                  return (
                    <button
                      key={s}
                      onClick={() => setSize(s)}
                      disabled={disabled}
                      className={`min-w-[3rem] px-3 py-3 text-xs uppercase tracking-widest border transition ${
                        size === s ? "bg-bone text-ink border-bone" : "border-hairline hover:border-bone/60"
                      } ${disabled ? "opacity-30 cursor-not-allowed line-through" : ""}`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {stock > 0 && stock <= 5 && (
            <p className="mt-4 text-xs text-muted-foreground">Only {stock} left in stock.</p>
          )}

          <div className="mt-8 flex items-center gap-4">
            <div className="flex items-center border border-hairline">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="p-3 hover:bg-bone/5"><Minus className="h-3 w-3" /></button>
              <span className="w-10 text-center text-xs">{qty}</span>
              <button onClick={() => setQty(Math.min(stock || 1, qty + 1))} className="p-3 hover:bg-bone/5"><Plus className="h-3 w-3" /></button>
            </div>
            <button
              onClick={() => cart.add({ product_id: p.id, variant_id: variant?.id ?? null }, qty)}
              disabled={stock === 0 || cart.loading}
              className="btn-cult flex-1 disabled:opacity-40"
            >
              {stock === 0 ? "Sold out" : cart.loading ? "Adding…" : "Add to bag"}
            </button>
            <button
              aria-label="Wishlist"
              onClick={() => wishlist.toggle(p.id)}
              className={`p-3 border transition ${
                wishlist.has(p.id)
                  ? "border-bone bg-bone text-ink"
                  : "border-hairline hover:border-bone/60"
              }`}
            >
              <Heart className={`h-4 w-4 ${wishlist.has(p.id) ? "fill-current" : ""}`} />
            </button>
          </div>

          <div className="mt-12 space-y-0 border-t border-hairline">
            <Accordion title="Description" defaultOpen>
              <p className="text-sm leading-relaxed text-muted-foreground">{p.description}</p>
            </Accordion>
            {p.material && (
              <Accordion title="Materials">
                <p className="text-sm leading-relaxed text-muted-foreground">{p.material}</p>
              </Accordion>
            )}
            {p.care_instructions && (
              <Accordion title="Care">
                <p className="text-sm leading-relaxed text-muted-foreground">{p.care_instructions}</p>
              </Accordion>
            )}
            <Accordion title="Shipping & Returns">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Free shipping over ₹1,999. 14-day returns on unworn pieces with tags attached.
              </p>
            </Accordion>
            <Accordion title={`Reviews (${reviews?.length ?? 0})`}>
              {(reviews?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">No reviews yet. Own it? Review it from your orders.</p>
              ) : (
                <ul className="space-y-6">
                  {reviews!.map((r) => (
                    <li key={r.id}>
                      <div className="flex items-center gap-3">
                        <Stars value={r.rating} />
                        <span className="text-xs uppercase tracking-widest">{r.author}</span>
                      </div>
                      {r.title && <div className="mt-2 text-sm font-medium">{r.title}</div>}
                      {r.body && <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{r.body}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </Accordion>
          </div>
        </div>
      </div>

      {(related?.length ?? 0) > 0 && (
        <section className="border-t border-hairline px-5 md:px-10 py-24">
          <p className="text-eyebrow">Complete the look</p>
          <h2 className="mt-4 text-large-display text-[2rem]">Related pieces</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-16 mt-12">
            {related!.slice(0, 4).map((rp, i) => <ProductCard key={rp.id} p={rp} index={i} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-3 w-3 ${n <= Math.round(value) ? "fill-bone text-bone" : "text-muted-foreground"}`}
        />
      ))}
    </span>
  );
}

function Accordion({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-hairline">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-eyebrow"
      >
        {title}
        <span className="text-lg">{open ? "−" : "+"}</span>
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.5, ease: [0.7, 0, 0.2, 1] }}
        className="overflow-hidden"
      >
        <div className="pb-6">{children}</div>
      </motion.div>
    </div>
  );
}
