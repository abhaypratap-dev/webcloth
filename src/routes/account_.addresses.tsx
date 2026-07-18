import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  createAddress,
  deleteAddress,
  listAddresses,
  updateAddress,
  type Address,
  type AddressInput,
} from "@/lib/account";
import { AccountShell } from "@/components/site/AccountShell";
import { PhoneInput } from "@/components/site/PhoneInput";

export const Route = createFileRoute("/account_/addresses")({
  head: () => ({ meta: [{ title: "Addresses — Cut & Cult" }, { name: "robots", content: "noindex" }] }),
  component: AddressesPage,
});

const EMPTY_FORM: AddressInput = {
  full_name: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "India",
  is_default: false,
};

function AddressesPage() {
  const queryClient = useQueryClient();
  const { data: addresses, isLoading } = useQuery({ queryKey: ["addresses"], queryFn: listAddresses });
  const [editing, setEditing] = useState<Address | "new" | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["addresses"] });
  const removeMutation = useMutation({ mutationFn: deleteAddress, onSuccess: invalidate });

  return (
    <AccountShell eyebrow="Shipping" title="Addresses">
      {isLoading ? (
        <p className="text-eyebrow">Loading</p>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-4">
            {(addresses ?? []).map((address) => (
              <div key={address.id} className="border border-hairline p-6 flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-medium">{address.full_name}</div>
                  {address.is_default && (
                    <span className="text-eyebrow border border-hairline px-2 py-1">Default</span>
                  )}
                </div>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  {address.line1}{address.line2 ? `, ${address.line2}` : ""}<br />
                  {address.city}{address.state ? `, ${address.state}` : ""} {address.postal_code}<br />
                  {address.country}<br />
                  {address.phone}
                </p>
                <div className="mt-auto pt-6 flex gap-4 text-eyebrow">
                  <button onClick={() => setEditing(address)} className="link-underline">Edit</button>
                  <button
                    onClick={() => removeMutation.mutate(address.id)}
                    className="link-underline text-destructive"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={() => setEditing("new")}
              className="border border-dashed border-hairline p-6 min-h-40 grid place-items-center text-eyebrow hover:border-bone/60 transition"
            >
              + Add address
            </button>
          </div>

          {editing !== null && (
            <AddressForm
              initial={editing === "new" ? EMPTY_FORM : editing}
              onDone={() => { setEditing(null); invalidate(); }}
              onCancel={() => setEditing(null)}
              addressId={editing === "new" ? null : editing.id}
            />
          )}
        </>
      )}
    </AccountShell>
  );
}

export function AddressForm({
  initial,
  addressId,
  onDone,
  onCancel,
}: {
  initial: AddressInput;
  addressId: number | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<AddressInput>({ ...initial });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof AddressInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (addressId === null) await createAddress(form);
      else await updateAddress(addressId, form);
      onDone();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-10 border border-hairline p-6 space-y-4 max-w-2xl">
      <div className="text-eyebrow mb-2">{addressId === null ? "New address" : "Edit address"}</div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Full name" required value={form.full_name} onChange={set("full_name")} />
        <PhoneInput
          label="Phone"
          value={form.phone}
          onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
          required
        />
      </div>
      <Input label="Address line 1" required value={form.line1} onChange={set("line1")} />
      <Input label="Address line 2" value={form.line2} onChange={set("line2")} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Input label="City" required value={form.city} onChange={set("city")} />
        <Input label="State" value={form.state} onChange={set("state")} placeholder="e.g. Maharashtra" />
        <Input label="PIN code" required value={form.postal_code} onChange={set("postal_code")} maxLength={6} inputMode="numeric" />
        <Input label="Country" required value={form.country} onChange={set("country")} />
      </div>
      <label className="flex items-center gap-3 text-eyebrow pt-2">
        <input
          type="checkbox"
          checked={form.is_default}
          onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))}
          className="accent-current"
        />
        Set as default
      </label>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-3 pt-2">
        <button disabled={saving} className="btn-cult">{saving ? "…" : "Save address"}</button>
        <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
      </div>
    </form>
  );
}

function Input({ label, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="block text-eyebrow mb-2 opacity-70">{label}</span>
      <input
        {...rest}
        className="w-full bg-transparent border-b border-hairline focus:border-bone py-3 outline-none text-sm transition-colors placeholder:text-muted-foreground/40"
      />
    </label>
  );
}
