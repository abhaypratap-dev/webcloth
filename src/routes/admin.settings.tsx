import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Btn, Input, PageHead, Toggle } from "@/components/admin/kit";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
});

type StoreSettings = {
  store_name: string;
  tagline: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  instagram_url: string;
  twitter_url: string;
  facebook_url: string;
  youtube_url: string;
  currency: string;
  currency_symbol: string;
  shipping_flat_rate: string;
  free_shipping_threshold: string | null;
  tax_percent: string;
  order_email_enabled: boolean;
  order_prefix: string;
  email_from_name: string;
  email_from_address: string;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_use_tls: boolean;
  smtp_configured: boolean;
  smtp_password?: string;
};

function AdminSettings() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["settings"], queryFn: () => api<StoreSettings>("/settings/") });
  const [form, setForm] = useState<StoreSettings | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (!form) return <div className="text-eyebrow">Loading</div>;

  const set = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await api("/settings/", { method: "PATCH", body: form });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setMessage("Settings saved.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHead title="Store settings" subtitle="Store info, shipping, tax and social links" />

      <div className="space-y-8">
        <Section title="Store information">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Store name" value={form.store_name} onChange={(e) => set("store_name", e.target.value)} />
            <Input label="Tagline" value={form.tagline} onChange={(e) => set("tagline", e.target.value)} />
            <Input label="Contact email" type="email" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} />
            <Input label="Contact phone" value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} />
          </div>
          <Input label="Address" value={form.address} onChange={(e) => set("address", e.target.value)} />
        </Section>

        <Section title="Social media">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Instagram" value={form.instagram_url} onChange={(e) => set("instagram_url", e.target.value)} />
            <Input label="Twitter / X" value={form.twitter_url} onChange={(e) => set("twitter_url", e.target.value)} />
            <Input label="Facebook" value={form.facebook_url} onChange={(e) => set("facebook_url", e.target.value)} />
            <Input label="YouTube" value={form.youtube_url} onChange={(e) => set("youtube_url", e.target.value)} />
          </div>
        </Section>

        <Section title="Shipping & GST">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Input label="Currency" value={form.currency} onChange={(e) => set("currency", e.target.value)} />
            <Input label="Symbol" value={form.currency_symbol} onChange={(e) => set("currency_symbol", e.target.value)} />
            <Input label="Flat shipping" type="number" step="0.01" value={form.shipping_flat_rate}
              onChange={(e) => set("shipping_flat_rate", e.target.value)} />
            <Input label="GST %" type="number" step="0.01" value={form.tax_percent}
              onChange={(e) => set("tax_percent", e.target.value)} />
          </div>
          <Input label="Free shipping over (blank to disable)" type="number" step="0.01"
            value={form.free_shipping_threshold ?? ""}
            onChange={(e) => set("free_shipping_threshold", e.target.value || null)} />
        </Section>

        <Section title="Email">
          <p className="text-xs text-muted-foreground">
            {form.smtp_configured
              ? "Order and account emails go out through your own mail server, under your name."
              : "No mail server yet — customers will not receive order or password-reset emails."}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Sender name" value={form.email_from_name} onChange={(e) => set("email_from_name", e.target.value)} />
            <Input label="Sender address" type="email" value={form.email_from_address}
              onChange={(e) => set("email_from_address", e.target.value)} />
            <Input label="SMTP server" placeholder="smtp.gmail.com" value={form.smtp_host}
              onChange={(e) => set("smtp_host", e.target.value)} />
            <Input label="Port" type="number" value={form.smtp_port}
              onChange={(e) => set("smtp_port", Number(e.target.value))} />
            <Input label="Username" value={form.smtp_username} onChange={(e) => set("smtp_username", e.target.value)} />
            <Input label={form.smtp_configured ? "Password (blank keeps it)" : "Password"} type="password"
              value={form.smtp_password ?? ""} onChange={(e) => set("smtp_password", e.target.value)} />
          </div>
          <Toggle label="Use TLS" checked={form.smtp_use_tls} onChange={(v) => set("smtp_use_tls", v)} />
          <Toggle label="Send order confirmation emails" checked={form.order_email_enabled}
            onChange={(v) => set("order_email_enabled", v)} />
          <Input label="Order number prefix" value={form.order_prefix}
            onChange={(e) => set("order_prefix", e.target.value.toUpperCase())} />
        </Section>

        {message && <p className="text-xs text-muted-foreground">{message}</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Btn variant="primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save settings"}</Btn>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-hairline p-6 space-y-4">
      <div className="text-eyebrow">{title}</div>
      {children}
    </div>
  );
}
