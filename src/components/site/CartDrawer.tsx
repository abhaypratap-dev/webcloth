import { AnimatePresence, motion } from "framer-motion";
import { X, Minus, Plus } from "lucide-react";
import { useCart } from "@/lib/cart";
import { Link } from "@tanstack/react-router";

export function CartDrawer() {
  const cart = useCart();
  return (
    <AnimatePresence>
      {cart.isOpen && (
        <>
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            onClick={cart.close}
            className="fixed inset-0 z-[70] bg-ink/70 backdrop-blur-md"
          />
          <motion.aside
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.7, ease: [0.7, 0, 0.2, 1] }}
            className="fixed inset-y-0 right-0 z-[71] flex w-full max-w-md flex-col bg-ink border-l border-hairline"
          >
            <header className="flex items-center justify-between px-6 py-6 border-b border-hairline">
              <div className="text-eyebrow">Bag ({cart.count})</div>
              <button onClick={cart.close} aria-label="Close cart"><X className="h-5 w-5" /></button>
            </header>

            <div className="flex-1 overflow-y-auto">
              {cart.items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-6 text-center px-8">
                  <div className="text-large-display text-[2rem]">Empty</div>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Nothing in your bag yet. The collection is waiting.
                  </p>
                  <Link to="/shop" onClick={cart.close} className="btn-cult">Shop the drop</Link>
                </div>
              ) : (
                <ul className="divide-y divide-hairline">
                  {cart.items.map((i) => (
                    <li key={i.id} className="flex gap-4 p-6">
                      <img src={i.image} alt={i.title} className="h-28 w-24 object-cover" loading="lazy" />
                      <div className="flex-1 min-w-0 flex flex-col">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{i.title}</div>
                            <div className="text-xs text-muted-foreground mt-1 uppercase tracking-[0.24em]">
                              {[i.size, i.color].filter(Boolean).join(" · ")}
                            </div>
                          </div>
                          <button
                            onClick={() => cart.remove(i.id)}
                            className="text-xs text-muted-foreground hover:text-bone uppercase tracking-widest"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="mt-auto flex items-center justify-between pt-4">
                          <div className="flex items-center gap-3 border border-hairline">
                            <button onClick={() => cart.setQty(i.id, i.quantity - 1)} className="p-2 hover:bg-bone/5"><Minus className="h-3 w-3" /></button>
                            <span className="text-xs w-6 text-center">{i.quantity}</span>
                            <button onClick={() => cart.setQty(i.id, i.quantity + 1)} className="p-2 hover:bg-bone/5"><Plus className="h-3 w-3" /></button>
                          </div>
                          <div className="text-sm font-medium">₹{(i.price * i.quantity).toFixed(2)}</div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {cart.items.length > 0 && (
              <footer className="border-t border-hairline p-6 space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-eyebrow">Subtotal</span>
                  <span className="font-medium">₹{cart.subtotal.toFixed(2)}</span>
                </div>
                <p className="text-xs text-muted-foreground">Shipping and taxes calculated at checkout.</p>
                <Link to="/checkout" onClick={cart.close} className="btn-cult w-full">Checkout</Link>
              </footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
