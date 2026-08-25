import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { SkullMark } from "@/components/site/Logo";
import { PhoneInput } from "@/components/site/PhoneInput";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Account — Cut & Cult" }, { name: "robots", content: "noindex" }] }),
  component: Auth,
});

type Mode = "signin" | "signup" | "forgot";

const HEADINGS: Record<Mode, { eyebrow: string; title: string }> = {
  signin: { eyebrow: "Members", title: "Sign in" },
  signup: { eyebrow: "Join the cult", title: "Create account" },
  forgot: { eyebrow: "Members", title: "Reset password" },
};

function Auth() {
  const nav = useNavigate();
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (auth.isAuthenticated) nav({ to: "/account" });
  }, [auth.isAuthenticated, nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "signup") {
        await auth.register({
          full_name: fullName,
          email,
          mobile,
          password,
          confirm_password: confirmPassword,
        });
        nav({ to: "/account" });
      } else if (mode === "signin") {
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

        <form onSubmit={submit} className="space-y-6">
          {mode === "signup" && (
            <>
              <Field label="Full name">
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-transparent border-b border-hairline focus:border-bone py-3 outline-none text-sm"
                />
              </Field>
              <PhoneInput label="Mobile number" value={mobile} onChange={setMobile} required />

            </>
          )}
          <Field label="Email">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent border-b border-hairline focus:border-bone py-3 outline-none text-sm"
            />
          </Field>
          {mode !== "forgot" && (
            <Field label="Password">
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent border-b border-hairline focus:border-bone py-3 outline-none text-sm"
              />
            </Field>
          )}
          {mode === "signup" && (
            <Field label="Confirm password">
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-transparent border-b border-hairline focus:border-bone py-3 outline-none text-sm"
              />
            </Field>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          {info && <p className="text-xs text-muted-foreground">{info}</p>}
          <button disabled={loading} className="btn-cult w-full">
            {loading ? "…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-muted-foreground space-y-3">
          <div>
            {mode === "signin" ? "New here? " : "Already have an account? "}
            <button
              onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); setInfo(null); }}
              className="link-underline text-bone uppercase tracking-widest"
            >
              {mode === "signin" ? "Create account" : "Sign in"}
            </button>
          </div>
          {mode === "signin" && (
            <div>
              <button
                onClick={() => { setMode("forgot"); setError(null); setInfo(null); }}
                className="link-underline uppercase tracking-widest"
              >
                Forgot password?
              </button>
            </div>
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
