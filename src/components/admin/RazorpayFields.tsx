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
import { useState } from "react";

import { Input } from "@/components/admin/kit";

/** A webhook secret is not issued by Razorpay — you invent one and type the
 *  same value into both their dashboard and ours. Generating it here means
 *  nobody has to think one up, and nobody reuses a password. */
function generateSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export type RazorpayForm = {
  razorpay_key_id: string;
  razorpay_key_secret: string;
  razorpay_webhook_secret: string;
  razorpay_key_secret_set?: boolean;
  razorpay_webhook_secret_set?: boolean;
  razorpay_mode?: string;
  razorpay_webhook_ready?: boolean;
  razorpay_webhook_url?: string;
  razorpay_webhook_events?: string[];
  razorpay_last_event?: { type: string; at: string } | null;
};

export function RazorpayFields({
  form,
  set,
}: {
  form: RazorpayForm;
  set: (key: keyof RazorpayForm, value: string) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const mode = form.razorpay_mode ?? "";
  const events = form.razorpay_webhook_events ?? [];
  const copy = (value: string) => void navigator.clipboard?.writeText(value);

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
              onClick={() => copy(form.razorpay_webhook_url ?? "")}
              className="shrink-0 border border-hairline px-3 text-eyebrow"
            >
              Copy
            </button>
          </div>
        ) : null}

        {events.length ? (
          <div>
            <p className="text-eyebrow opacity-70 mb-1.5">Tick exactly these under Active Events</p>
            <div className="flex flex-wrap gap-1.5">
              {events.map((name) => (
                <code key={name} className="border border-hairline px-2 py-1 text-xs">
                  {name}
                </code>
              ))}
              <button
                type="button"
                onClick={() => copy(events.join("\n"))}
                className="border border-hairline px-2 py-1 text-eyebrow"
              >
                Copy
              </button>
            </div>
            <p className="mt-2 text-sm opacity-70">
              Ticking more is harmless; ticking fewer means a paid order never gets marked paid. Put
              your own address in Alert Email so Razorpay tells you if delivery starts failing.
            </p>
          </div>
        ) : null}

        <div>
          <p className="text-eyebrow opacity-70 mb-1.5">
            {form.razorpay_webhook_secret_set
              ? "Webhook secret — saved, type or generate to replace"
              : "Webhook secret"}
          </p>
          <p className="mb-2 text-sm opacity-70">
            Razorpay does not give you this one — you choose it. Generate it here, paste the same
            value into the Secret box in Razorpay, and save both.
          </p>
          <div className="flex gap-2">
            <input
              type={revealed ? "text" : "password"}
              value={form.razorpay_webhook_secret}
              onChange={(e) => set("razorpay_webhook_secret", e.target.value)}
              placeholder={form.razorpay_webhook_secret_set ? "••••••••••••" : "Generate one, or paste your own"}
              className="w-full border border-hairline bg-transparent px-3 py-2 font-mono text-xs outline-none"
            />
            <button
              type="button"
              onClick={() => {
                const secret = generateSecret();
                set("razorpay_webhook_secret", secret);
                setRevealed(true);
                copy(secret);
              }}
              className="shrink-0 border border-hairline px-3 text-eyebrow"
            >
              Generate
            </button>
            {form.razorpay_webhook_secret ? (
              <button
                type="button"
                onClick={() => setRevealed((r) => !r)}
                className="shrink-0 border border-hairline px-3 text-eyebrow"
              >
                {revealed ? "Hide" : "Show"}
              </button>
            ) : null}
          </div>
          {revealed && form.razorpay_webhook_secret ? (
            <p className="mt-2 text-sm text-amber-500">
              Copied. Paste it into Razorpay before you save — once saved it is never shown again.
            </p>
          ) : null}
        </div>

        {form.razorpay_last_event ? (
          <p className="border border-hairline p-2.5 text-sm">
            Working — last event {form.razorpay_last_event.type} on{" "}
            {new Date(form.razorpay_last_event.at).toLocaleString()}.
          </p>
        ) : form.razorpay_webhook_ready ? (
          <p className="text-sm opacity-70">
            Nothing received yet. Take one test payment and this will say when the last event
            arrived.
          </p>
        ) : (
          <p className="text-sm text-amber-500">
            No webhook secret yet. Payments will still work, but an order is only confirmed while
            the customer stays on the page — close the tab mid-payment and it is never marked paid.
          </p>
        )}
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
