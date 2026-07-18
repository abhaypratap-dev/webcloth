/**
 * Indian mobile number input: fixed +91 prefix, 10-digit field.
 * `value`/`onChange` always carry the canonical "+91XXXXXXXXXX" form (or ""
 * when empty) — matches what the backend stores and what an OTP gateway
 * will eventually need.
 */
export function PhoneInput({
  label,
  value,
  onChange,
  required = true,
  variant = "underline",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  variant?: "underline" | "boxed";
}) {
  const digits = value.startsWith("+91") ? value.slice(3) : value.replace(/\D/g, "").slice(-10);

  function setDigits(raw: string) {
    const clean = raw.replace(/\D/g, "").slice(0, 10);
    onChange(clean ? `+91${clean}` : "");
  }

  const inputClass =
    variant === "underline"
      ? "flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground/40"
      : "flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground/40";

  const wrapClass =
    variant === "underline"
      ? "flex items-center border-b border-hairline focus-within:border-bone transition-colors"
      : "flex items-center border border-hairline focus-within:border-bone transition-colors px-3";

  return (
    <label className="block">
      <span className="block text-eyebrow mb-2 opacity-70">{label}</span>
      <div className={wrapClass}>
        <span className={`text-sm text-muted-foreground select-none ${variant === "underline" ? "" : "pr-1"}`}>
          +91
        </span>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          required={required}
          value={digits}
          onChange={(e) => setDigits(e.target.value)}
          maxLength={10}
          placeholder="98765 43210"
          className={`${inputClass} pl-2`}
        />
      </div>
    </label>
  );
}
