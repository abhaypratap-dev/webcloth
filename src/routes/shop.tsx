import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search } from "lucide-react";
import { listProducts, listCategories, type ProductQuery } from "@/lib/products";
import { ProductCard } from "@/components/site/ProductCard";

type ShopSearch = {
  category?: string;
  filter?: "new" | "best";
  q?: string;
};

const categoriesOptions = queryOptions({
  queryKey: ["shop", "categories"],
  queryFn: () => listCategories(),
});

export const Route = createFileRoute("/shop")({
  validateSearch: (search: Record<string, unknown>): ShopSearch => ({
    category: typeof search.category === "string" ? search.category : undefined,
    filter: search.filter === "new" || search.filter === "best" ? search.filter : undefined,
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Shop — Cut & Cult" },
      { name: "description", content: "Shop the full Cut & Cult collection. Heavyweight tees, hoodies, shirts and bottomwear." },
      { property: "og:title", content: "Shop — Cut & Cult" },
      { property: "og:description", content: "Every cut. Every drop. All in one place." },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(categoriesOptions);
  },
  component: Shop,
  errorComponent: ({ error }) => <div className="pt-40 text-center text-sm">{error.message}</div>,
});

const SORTS = {
  newest: "-created_at",
  "price-asc": "price",
  "price-desc": "-price",
} as const;

function Shop() {
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: categories } = useQuery(categoriesOptions);

  const [cat, setCat] = useState<string | null>(searchParams.category ?? null);
  const [sort, setSort] = useState<keyof typeof SORTS>("newest");
  const [query, setQuery] = useState(searchParams.q ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setCat(searchParams.category ?? null);
    if (searchParams.q !== undefined) setQuery(searchParams.q);
  }, [searchParams.category, searchParams.q]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [cat, sort, debouncedQuery, searchParams.filter]);

  const apiQuery: ProductQuery = {
    category: cat ?? undefined,
    search: debouncedQuery || undefined,
    ordering: SORTS[sort],
    new_arrival: searchParams.filter === "new" ? true : undefined,
    best_seller: searchParams.filter === "best" ? true : undefined,
    page,
    page_size: 24,
  };

  const { data, isFetching } = useQuery({
    queryKey: ["shop", "products", apiQuery],
    queryFn: () => listProducts(apiQuery),
    placeholderData: keepPreviousData,
  });

  const products = data?.results ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.count / 24)) : 1;

  const selectCategory = (slug: string | null) => {
    setCat(slug);
    navigate({
      search: (prev: ShopSearch) => ({ ...prev, category: slug ?? undefined }),
      replace: true,
    });
  };

  return (
    <div className="pt-32 md:pt-40 pb-24">
      <header className="px-5 md:px-10">
        <p className="text-eyebrow">Collection</p>
        <h1 className="mt-4 text-large-display">
          {searchParams.filter === "new" ? "New Arrivals" : searchParams.filter === "best" ? "Best Sellers" : "All Pieces"}
        </h1>
      </header>

      <div className="mt-14 px-5 md:px-10 flex flex-wrap items-center justify-between gap-6 border-b border-hairline pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip active={cat === null} onClick={() => selectCategory(null)}>All</FilterChip>
          {(categories ?? []).map((c) => (
            <FilterChip key={c.id} active={cat === c.slug} onClick={() => selectCategory(c.slug)}>
              {c.name}
            </FilterChip>
          ))}
        </div>
        <div className="flex items-center gap-6 text-eyebrow">
          <label className="flex items-center gap-2 border-b border-hairline pb-1 focus-within:border-bone transition-colors">
            <Search className="h-3 w-3 opacity-60" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="bg-transparent outline-none text-bone text-xs tracking-[0.28em] uppercase w-24 md:w-32 placeholder:text-muted-foreground/60"
            />
          </label>
          <div className="flex items-center gap-3">
            <span className="opacity-60">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as keyof typeof SORTS)}
              className="bg-transparent border-b border-hairline pb-1 outline-none text-bone text-xs tracking-[0.28em] uppercase"
            >
              <option value="newest" className="bg-ink">Newest</option>
              <option value="price-asc" className="bg-ink">Price ↑</option>
              <option value="price-desc" className="bg-ink">Price ↓</option>
            </select>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${cat}${sort}${debouncedQuery}${page}${searchParams.filter}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: isFetching ? 0.5 : 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="px-5 md:px-10 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-16 mt-14"
        >
          {products.map((p, i) => <ProductCard key={p.id} p={p} index={i} />)}
        </motion.div>
      </AnimatePresence>

      {products.length === 0 && !isFetching && (
        <div className="text-center py-32 text-muted-foreground">
          <p className="text-eyebrow">Empty rack</p>
          <p className="mt-4 text-sm">No pieces match this filter.</p>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-16 flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <FilterChip key={n} active={page === n} onClick={() => setPage(n)}>
              {n}
            </FilterChip>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-[10px] uppercase tracking-[0.28em] border transition-colors ${
        active
          ? "bg-bone text-ink border-bone"
          : "border-hairline text-bone/70 hover:text-bone hover:border-bone/40"
      }`}
    >
      {children}
    </button>
  );
}
