/**
 * Razorpay Standard Checkout, from the browser's side.
 *
 * The order is created on our server before any of this runs, so the amount
 * cannot be changed here, and the three fields the modal hands back are sent
 * straight to our server to be checked against a signature. Nothing in this
 * file is trusted: it opens a window and reports what came out.
 */
import { api } from "@/lib/api";

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

type RazorpayResult = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type CreatedPayment = {
  payment_id: number;
  gateway: string;
  amount: number;
  currency: string;
  payload: {
    razorpay_order_id: string;
    key_id: string;
    amount: number;
    currency: string;
    name?: string;
    description?: string;
    prefill?: { name?: string; email?: string; contact?: string };
  };
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: unknown) => void) => void;
    };
  }
}

let loading: Promise<void> | null = null;

/** Loads Razorpay's script once. Never self-hosted: they expect it to come
 *  from their CDN so fixes and new payment methods arrive without us. */
function loadCheckout(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Not in a browser"));
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const script = existing ?? document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error("Could not reach Razorpay. Check your connection and try again."));
    };
    if (!existing) document.body.appendChild(script);
  });
  return loading;
}

export type PayResult = { paid: boolean; reason?: string };

/**
 * Takes a placed order through Razorpay.
 *
 * Resolves `paid: true` only once our own server has verified the signature.
 * A customer who closes the modal resolves `paid: false` with the order left
 * pending — the webhook will still mark it paid if their payment lands late.
 */
export async function payWithRazorpay(orderId: number, themeColor?: string): Promise<PayResult> {
  const created = await api<CreatedPayment>("/payments/create/", {
    method: "POST",
    body: { order_id: orderId },
  });
  await loadCheckout();

  const options = created.payload;
  return new Promise<PayResult>((resolve) => {
    let settled = false;
    const finish = (result: PayResult) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    const rzp = new window.Razorpay!({
      key: options.key_id,
      amount: options.amount,
      currency: options.currency,
      order_id: options.razorpay_order_id,
      name: options.name ?? "",
      description: options.description ?? "",
      prefill: options.prefill ?? {},
      ...(themeColor ? { theme: { color: themeColor } } : {}),
      // Closing by accident after paying is the worst outcome here.
      modal: {
        confirm_close: true,
        ondismiss: () => finish({ paid: false, reason: "closed" }),
      },
      handler: (response: RazorpayResult) => {
        // Never treat this as proof of payment. Our server checks the
        // signature against the order id it stored, not the one sent here.
        void api("/payments/verify/", {
          method: "POST",
          body: {
            payment_id: created.payment_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
          },
        })
          .then((result) => {
            const verified = (result as { verified?: boolean } | null)?.verified === true;
            finish(
              verified
                ? { paid: true }
                : { paid: false, reason: "We could not verify that payment. Nothing has been charged twice — we will check and get back to you." },
            );
          })
          .catch(() =>
            // The money may well have been taken; the webhook is what settles
            // it either way, so never tell the customer it failed.
            finish({ paid: false, reason: "pending" }),
          );
      },
    });

    rzp.on("payment.failed", (response: unknown) => {
      const error = (response as { error?: { description?: string } })?.error;
      finish({ paid: false, reason: error?.description || "That payment did not go through." });
    });

    rzp.open();
  });
}
