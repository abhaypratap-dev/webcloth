/**
 * Razorpay credentials, per brand.
 *
 * One backend serves every label, so these cannot live in the deployment's
 * environment the way they used to — the key decides whose bank account the
 * money settles into, and a shared one would pay the wrong merchant.
 *
 * Secrets are write-only: the API never sends them back, so the boxes always
 * render empty and an empty box on save means "leave it alone".
 */
import { Input } from "@/components/admin/kit";

export type RazorpayForm = {
  razorpay_key_id: string;
  razorpay_key_secret: string;
  razorpay_webhook_secret: string;
  razorpay_key_secret_set?: boolean;
  razorpay_webhook_secret_set?: boolean;
  razorpay_mode?: string;
  razorpay_webhook_ready?: boolean;
  razorpay_webhook_url?: string;
};

export function RazorpayFields({
  form,
  set,
}: {
  form: RazorpayForm;
  set: (key: keyof RazorpayForm, value: string) => void;
}) {
  const mode = form.razorpay_mode ?? "";

  return (
    <div className="space-y-4 border border-hairline p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-eyebrow opacity-70">Razorpay account</p>
        {mode ? (
          <span className="border border-hairline px-2 py-0.5 text-eyebrow opacity-80">
            {mode === "live" ? "Live keys" : "Test keys"}
          </span>
        ) : null}
      </div>

      <p className="text-sm opacity-70">
        From your Razorpay dashboard under Account &amp; Settings → API Keys. Test keys start
        rzp_test_ and move no real money; live keys start rzp_live_ and need completed KYC.
      </p>

      <Input
        label="Key ID"
        placeholder="rzp_test_XXXXXXXXXXXXXX"
        value={form.razorpay_key_id}
        onChange={(e) => set("razorpay_key_id", e.target.value)}
      />

      <Input
        label={form.razorpay_key_secret_set ? "Key Secret — saved, type to replace" : "Key Secret"}
        type="password"
        placeholder={form.razorpay_key_secret_set ? "••••••••••••" : "Paste the secret"}
        value={form.razorpay_key_secret}
        onChange={(e) => set("razorpay_key_secret", e.target.value)}
      />

      <div className="border-t border-hairline pt-4 space-y-3">
        <p className="text-eyebrow opacity-70">Webhook</p>
        <p className="text-sm opacity-70">
          Razorpay tells us a payment succeeded by calling this address. Without it, a customer who
          closes the tab straight after paying is charged and never gets their order. Add it under
          Account &amp; Settings → Webhooks and subscribe to payment.captured and payment.failed.
        </p>

        {form.razorpay_webhook_url ? (
          <div className="flex gap-2">
            <input
              readOnly
              value={form.razorpay_webhook_url}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full border border-hairline bg-transparent px-3 py-2 font-mono text-xs"
            />
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(form.razorpay_webhook_url ?? "")}
              className="shrink-0 border border-hairline px-3 text-eyebrow"
            >
              Copy
            </button>
          </div>
        ) : null}

        <Input
          label={
            form.razorpay_webhook_secret_set
              ? "Webhook secret — saved, type to replace"
              : "Webhook secret"
          }
          type="password"
          placeholder={form.razorpay_webhook_secret_set ? "••••••••••••" : "The secret you set in Razorpay"}
          value={form.razorpay_webhook_secret}
          onChange={(e) => set("razorpay_webhook_secret", e.target.value)}
        />

        {!form.razorpay_webhook_ready ? (
          <p className="text-sm text-amber-500">
            No webhook secret yet. Payments will still work, but an order is only confirmed while
            the customer stays on the page.
          </p>
        ) : null}
      </div>

      {mode === "live" ? (
        <p className="border border-amber-500/40 p-3 text-sm text-amber-500">
          These are live keys — real money will move. Take a test payment first, and check it shows
          as Captured in your Razorpay dashboard.
        </p>
      ) : null}
    </div>
  );
}
