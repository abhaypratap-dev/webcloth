import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listWishlist } from "@/lib/account";
import { useWishlist } from "@/lib/wishlist";
import { ProductCard } from "@/components/site/ProductCard";
import { AccountShell } from "@/components/site/AccountShell";

export const Route = createFileRoute("/account_/wishlist")({
  head: () => ({ meta: [{ title: "Wishlist — Cut & Cult" }, { name: "robots", content: "noindex" }] }),
  component: WishlistPage,
});

function WishlistPage() {
  const wishlist = useWishlist();
  const { data: products, isLoading, refetch } = useQuery({
    queryKey: ["wishlist", "items"],
    queryFn: listWishlist,
  });

  return (
    <AccountShell eyebrow="Saved" title="Wishlist">
      {isLoading ? (
        <p className="text-eyebrow">Loading</p>
      ) : (products?.length ?? 0) === 0 ? (
        <div className="py-20 text-center">
          <p className="text-eyebrow">Empty</p>
          <p className="mt-4 text-sm text-muted-foreground">Save pieces you love and find them here.</p>
          <Link to="/shop" className="btn-cult mt-10">Shop the collection</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-16">
          {products!.map((p, i) => (
            <div key={p.id} className="relative">
              <ProductCard p={p} index={i} />
              <button
                onClick={async () => { await wishlist.toggle(p.id); refetch(); }}
                className="mt-3 text-eyebrow opacity-60 hover:opacity-100"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </AccountShell>
  );
}
