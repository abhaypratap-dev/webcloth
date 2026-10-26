import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { SkullMark } from "@/components/site/Logo";
import { OtpLogin } from "@/components/site/OtpLogin";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ title: "Account — Cut & Cult" }, { name: "robots", content: "noindex" }],
  }),
  component: Auth,
});

// Customers sign in by code only. The password form stays for staff, whose
// accounts were made with one, and for anyone who prefers it.
type Mode = "code" | "password" | "forgot";

const HEADINGS: Record<Mode, { eyebrow: string; title: string }> = {
  code: { eyebrow: "Members", title: "Sign in" },
  password: { eyebrow: "Members", title: "Sign in with password" },
  forgot: { eyebrow: "Members", title: "Reset password" },
};

function Auth() {
  const nav = useNavigate();
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>("code");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (auth.isAuthenticated) nav({ to: "/account" });
  }, [auth.isAuthenticated, nav]);

  function switchTo(next: Mode) {
    setMode(next);
    setError(null);
    setInfo(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "password") {
        await auth.login(email, password);
        nav({ to: "/account" });
      } else {
        const res = await api<{ detail: string }>("/auth/forgot-password/", {
          method: "POST",
          body: { email },
        });
        setInfo(res.detail);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const heading = HEADINGS[mode];

  return (
    <div className="min-h-screen grid place-items-center px-5 pt-24 pb-16">
      <div className="w-full max-w-sm">
        <div className="text-center mb-12">
          <SkullMark className="mx-auto h-10 mb-6" />
          <p className="text-eyebrow">{heading.eyebrow}</p>
          <h1 className="mt-4 text-large-display text-[2rem]">{heading.title}</h1>
        </div>

        {mode === "code" ? (
          <OtpLogin onDone={() => nav({ to: "/account" })} />
        ) : (
          <form onSubmit={submit} className="space-y-6">
            <Field label={mode === "password" ? "Email or mobile" : "Email"}>
              <input
                type={mode === "password" ? "text" : "email"}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent border-b border-hairline focus:border-bone py-3 outline-none text-sm"
              />
            </Field>
            {mode === "password" && (
              <Field label="Password">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent border-b border-hairline focus:border-bone py-3 outline-none text-sm"
                />
              </Field>
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
            {info && <p className="text-xs text-muted-foreground">{info}</p>}
            <button disabled={loading} className="btn-cult w-full">
              {loading ? "…" : mode === "password" ? "Sign in" : "Send reset link"}
            </button>
          </form>
        )}

        <div className="mt-8 text-center text-xs text-muted-foreground space-y-3">
          {mode === "code" ? (
            <button
              onClick={() => switchTo("password")}
              className="link-underline uppercase tracking-widest"
            >
              Sign in with password
            </button>
          ) : (
            <>
              <div>
                <button
                  onClick={() => switchTo("code")}
                  className="link-underline text-bone uppercase tracking-widest"
                >
                  Sign in with a code instead
                </button>
              </div>
              {mode === "password" && (
                <div>
                  <button
                    onClick={() => switchTo("forgot")}
                    className="link-underline uppercase tracking-widest"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-eyebrow mb-2 opacity-70">{label}</span>
      {children}
    </label>
  );
}
