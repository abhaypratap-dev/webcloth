import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AccountShell } from "@/components/site/AccountShell";
import { PhoneInput } from "@/components/site/PhoneInput";

export const Route = createFileRoute("/account_/profile")({
  head: () => ({ meta: [{ title: "Profile — Cut & Cult" }, { name: "robots", content: "noindex" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const auth = useAuth();
  return (
    <AccountShell eyebrow="You" title="Profile">
      <div className="grid md:grid-cols-2 gap-16 max-w-4xl">
        <ProfileForm key={auth.user?.id} />
        <PasswordForm />
      </div>
    </AccountShell>
  );
}

function ProfileForm() {
  const auth = useAuth();
  const [fullName, setFullName] = useState(auth.user?.full_name ?? "");
  const [mobile, setMobile] = useState(auth.user?.mobile ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await api("/auth/me/", { method: "PATCH", body: { full_name: fullName, mobile } });
      await auth.refreshUser();
      setMessage("Profile updated.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="text-eyebrow">Details</div>
      <Field label="Email">
        <input
          value={auth.user?.email ?? ""}
          disabled
          className="w-full bg-transparent border-b border-hairline py-3 text-sm text-muted-foreground"
        />
      </Field>
      <Field label="Full name">
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          className="w-full bg-transparent border-b border-hairline focus:border-bone py-3 outline-none text-sm"
        />
      </Field>
      <PhoneInput label="Mobile number" value={mobile} onChange={setMobile} required />

      {message && <p className="text-xs text-muted-foreground">{message}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <button disabled={saving} className="btn-cult">{saving ? "…" : "Save changes"}</button>
    </form>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await api("/auth/change-password/", {
        method: "POST",
        body: { current_password: current, new_password: next },
      });
      setMessage("Password updated.");
      setCurrent("");
      setNext("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="text-eyebrow">Change password</div>
      <Field label="Current password">
        <input
          type="password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className="w-full bg-transparent border-b border-hairline focus:border-bone py-3 outline-none text-sm"
        />
      </Field>
      <Field label="New password">
        <input
          type="password"
          required
          minLength={8}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className="w-full bg-transparent border-b border-hairline focus:border-bone py-3 outline-none text-sm"
        />
      </Field>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <button disabled={saving} className="btn-cult">{saving ? "…" : "Update password"}</button>
    </form>
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
