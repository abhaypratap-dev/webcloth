import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { useAuth, type CodeSent, type User } from "@/lib/auth";

/**
 * Sign in or sign up with nothing but an email address or mobile number and
 * the 6-digit code sent to it. One form for both: the API creates the account
 * the first time a code is verified.
 *
 * Mobile numbers are offered only when the brand sends codes on WhatsApp.
 */
const VERIFY_TIMEOUT_MS = 20_000;

export function OtpLogin({ onDone }: { onDone?: (user: User) => void }) {
  const auth = useAuth();
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<{ mobile_otp_enabled?: boolean }>("/settings/"),
    staleTime: 5 * 60 * 1000,
  });
  const mobileAllowed = settings?.mobile_otp_enabled ?? false;

  const [identifier, setIdentifier] = useState("");
  const [sent, setSent] = useState<CodeSent | null>(null);
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function send(value: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await auth.requestCode(value.trim());
      setSent(res);
      setResendIn(res.retry_after || 60);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(value: string) {
    if (!sent) return;
    setBusy(true);
    setError(null);
    // Never leave the customer stuck on "Verifying…": a request the browser
    // or network silently drops would otherwise never settle. If it does
    // succeed later, the session still starts and the page moves on.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("This is taking too long. Check your connection and try again.")),
        VERIFY_TIMEOUT_MS,
      );
    });
    try {
      onDone?.(await Promise.race([auth.verifyCode(sent.identifier, value), timeout]));
    } catch (e: any) {
      setError(e.message);
      setCode("");
      setBusy(false);
    } finally {
      clearTimeout(timer);
    }
  }

  if (!sent) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(identifier);
        }}
        className="space-y-6"
      >
        <label className="block">
          <span className="block text-eyebrow mb-2 opacity-70">
            {mobileAllowed ? "Mobile number or email" : "Email"}
          </span>
          <input
            type={mobileAllowed ? "text" : "email"}
            inputMode={mobileAllowed ? "text" : "email"}
            autoComplete={mobileAllowed ? "username" : "email"}
            required
            autoFocus
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={mobileAllowed ? "98765 43210 or you@example.com" : "you@example.com"}
            className="w-full bg-transparent border-b border-hairline focus:border-bone py-3 outline-none text-sm placeholder:text-muted-foreground/40"
          />
        </label>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <button disabled={busy || !identifier.trim()} className="btn-cult w-full">
          {busy ? "Sending…" : "Send code"}
        </button>
        <p className="text-xs text-muted-foreground text-center">
          {mobileAllowed
            ? "We'll send a one-time code to your WhatsApp or inbox. New here? This creates your account."
            : "We'll email you a one-time code. New here? This creates your account."}
        </p>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        verify(code);
      }}
      className="space-y-6"
    >
      <p className="text-xs text-muted-foreground">{sent.detail}</p>
      <label className="block">
        <span className="block text-eyebrow mb-2 opacity-70">6-digit code</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
          value={code}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            setCode(digits);
            // Autofilled or pasted in full: no need to press the button.
            if (digits.length === 6 && !busy) verify(digits);
          }}
          className="w-full bg-transparent border-b border-hairline focus:border-bone py-3 outline-none text-2xl tracking-[0.5em] text-center"
        />
      </label>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <button disabled={busy || code.length !== 6} className="btn-cult w-full">
        {busy ? "Verifying…" : "Verify and continue"}
      </button>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <button
          type="button"
          onClick={() => {
            setSent(null);
            setCode("");
            setError(null);
          }}
          className="link-underline uppercase tracking-widest"
        >
          Change
        </button>
        <button
          type="button"
          onClick={() => send(sent.identifier)}
          disabled={resendIn > 0 || busy}
          className="link-underline uppercase tracking-widest disabled:opacity-50"
        >
          {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
        </button>
      </div>
    </form>
  );
}
