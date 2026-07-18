import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { ProductListItem } from "@/lib/products";

export function ProductCard({ p, index = 0 }: { p: ProductListItem; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.9, ease: [0.7, 0, 0.2, 1], delay: (index % 4) * 0.08 }}
      className="group"
    >
      <Link to="/product/$slug" params={{ slug: p.slug }} className="block">
        <div className="relative overflow-hidden bg-secondary aspect-[4/5]">
          <img
            src={p.image}
            alt={p.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1400ms] ease-[cubic-bezier(0.7,0,0.2,1)] group-hover:scale-[1.06]"
          />
          {p.hover_image && (
            <img
              src={p.hover_image}
              alt=""
              aria-hidden
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-1000 group-hover:opacity-100"
            />
          )}
          {p.new_arrival && (
            <span className="absolute left-4 top-4 text-eyebrow bg-ink/70 backdrop-blur px-2 py-1">
              New
            </span>
          )}
          {p.best_seller && !p.new_arrival && (
            <span className="absolute left-4 top-4 text-eyebrow bg-ink/70 backdrop-blur px-2 py-1">
              Best Seller
            </span>
          )}
          {p.discount_price != null && (
            <span className="absolute right-4 top-4 text-eyebrow bg-bone text-ink px-2 py-1">
              −{p.discount_percent}%
            </span>
          )}
        </div>
        <div className="pt-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-medium truncate group-hover:opacity-70 transition">{p.title}</div>
            {p.category && (
              <div className="text-eyebrow mt-1 opacity-60">{p.category.replace(/-/g, " ")}</div>
            )}
          </div>
          <div className="text-sm font-medium shrink-0">
            {p.discount_price != null ? (
              <span className="flex items-baseline gap-2">
                <span>₹{p.discount_price.toFixed(0)}</span>
                <span className="text-muted-foreground line-through text-xs">₹{p.price.toFixed(0)}</span>
              </span>
            ) : (
              <>₹{p.price.toFixed(0)}</>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
