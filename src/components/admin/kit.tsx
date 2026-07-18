/** Shared building blocks for the admin dashboard. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { api, type Paginated } from "@/lib/api";

// ---------------------------------------------------------------------------
// Data hooks
// ---------------------------------------------------------------------------

export function useAdminList<T>(key: string, path: string) {
  return useQuery({
    queryKey: ["admin", key, path],
    queryFn: async () => {
      const data = await api<Paginated<T> | T[]>(path);
      return Array.isArray(data) ? data : data.results;
    },
  });
}

export function useInvalidate(keys: string[]) {
  const queryClient = useQueryClient();
  return () => {
    for (const key of keys) queryClient.invalidateQueries({ queryKey: ["admin", key] });
  };
}

export function useAdminMutation(keys: string[]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ path, method, body }: { path: string; method: string; body?: unknown }) =>
      api(path, { method, body }),
    onSuccess: () => {
      for (const key of keys) queryClient.invalidateQueries({ queryKey: ["admin", key] });
    },
  });
}

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

export function PageHead({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
      <div>
        <h1 className="text-large-display text-[2rem]">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="border border-hairline overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-hairline">
            {headers.map((h) => (
              <th key={h} className="text-left px-4 py-3 text-eyebrow font-normal whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}

export function Chip({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "good" | "bad" | "warn" }) {
  const tones = {
    default: "border-hairline text-bone/80",
    good: "border-emerald-500/50 text-emerald-400",
    bad: "border-destructive/50 text-destructive",
    warn: "border-amber-500/50 text-amber-400",
  };
  return (
    <span className={`inline-block border px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Btn({
  children,
  onClick,
  variant = "ghost",
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const styles = {
    primary: "bg-bone text-ink border-bone hover:bg-bone/85",
    ghost: "border-hairline text-bone/80 hover:text-bone hover:border-bone/50",
    danger: "border-destructive/40 text-destructive hover:border-destructive",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] border transition disabled:opacity-40 ${styles[variant]}`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Form primitives
// ---------------------------------------------------------------------------

export function Input({
  label,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="block text-eyebrow mb-1.5 opacity-70">{label}</span>
      <input
        {...rest}
        className="w-full bg-transparent border border-hairline focus:border-bone px-3 py-2 outline-none text-sm transition-colors placeholder:text-muted-foreground/40"
      />
    </label>
  );
}

export function TextArea({
  label,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="block">
      <span className="block text-eyebrow mb-1.5 opacity-70">{label}</span>
      <textarea
        {...rest}
        className="w-full bg-transparent border border-hairline focus:border-bone px-3 py-2 outline-none text-sm transition-colors min-h-24"
      />
    </label>
  );
}

export function Select({
  label,
  options,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="block text-eyebrow mb-1.5 opacity-70">{label}</span>
      <select
        {...rest}
        className="w-full bg-ink border border-hairline focus:border-bone px-3 py-2 outline-none text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-eyebrow cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-current" />
      {label}
    </label>
  );
}

/** Slide-in editor panel used by every CRUD screen. */
export function EditorPanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <div className="fixed inset-0 z-[80] bg-ink/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-[81] w-full max-w-xl bg-ink border-l border-hairline overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-hairline sticky top-0 bg-ink z-10">
          <span className="text-eyebrow">{title}</span>
          <button onClick={onClose} className="text-lg leading-none">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </>
  );
}

export function useEditor<T>() {
  const [editing, setEditing] = useState<T | "new" | null>(null);
  return { editing, open: (item: T | "new") => setEditing(item), close: () => setEditing(null) };
}

export function money(n: number | string): string {
  return `$${Number(n).toFixed(2)}`;
}
