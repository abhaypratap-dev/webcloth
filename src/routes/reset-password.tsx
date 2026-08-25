import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "@/lib/api";
import { SkullMark } from "@/components/site/Logo";

type ResetSearch = { uid?: string; token?: string };

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>): ResetSearch => ({
    uid: typeof search.uid === "string" ? search.uid : undefined,
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  head: () => ({ meta: [{ title: "Reset password — Cut & Cult" }, { name: "robots", content: "noindex" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const { uid, token } = Route.useSearch();
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!uid || !token) {
    return (
      <div className="pt-40 text-center">
        <p className="text-eyebrow">Invalid link</p>
        <h1 className="mt-4 text-large-display text-[2rem]">This reset link is incomplete.</h1>
        <Link to="/auth" className="btn-cult mt-10">Back to sign in</Link>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api("/auth/reset-password/", {
        method: "POST",
        body: { uid, token, new_password: password },
      });
      setDone(true);
      setTimeout(() => nav({ to: "/auth" }), 1800);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-5 pt-24 pb-16">
      <div className="w-full max-w-sm">
        <div className="text-center mb-12">
          <SkullMark className="mx-auto h-10 mb-6" />
          <p className="text-eyebrow">Members</p>
          <h1 className="mt-4 text-large-display text-[2rem]">New password</h1>
        </div>

        {done ? (
          <p className="text-center text-sm text-muted-foreground">
            Password updated. Taking you to sign in…
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-6">
            <label className="block">
              <span className="block text-eyebrow mb-2 opacity-70">New password</span>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent border-b border-hairline focus:border-bone py-3 outline-none text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-eyebrow mb-2 opacity-70">Confirm password</span>
              <input
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full bg-transparent border-b border-hairline focus:border-bone py-3 outline-none text-sm"
              />
            </label>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button disabled={loading} className="btn-cult w-full">{loading ? "…" : "Set new password"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
