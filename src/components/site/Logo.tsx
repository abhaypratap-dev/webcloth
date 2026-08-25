/**
 * Brand marks. Both render the supplied artwork (white-on-transparent PNGs
 * generated from the master logo), so they need a dark surface behind them —
 * every surface in this app is `--ink`.
 *
 * Sizing convention: callers set a height (`h-*`) and leave the width to
 * `w-auto`; the artwork is ~2.7:1 (lockup) and ~2:1 (mark), and pinning both
 * axes distorts it.
 */

export function Logo({ className = "" }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="Cut &amp; Cult"
      width={900}
      height={334}
      draggable={false}
      className={`block w-auto h-8 md:h-9 select-none ${className}`}
    />
  );
}

export function SkullMark({ className = "" }: { className?: string }) {
  return (
    <img
      src="/logo-mark.png"
      alt=""
      aria-hidden="true"
      width={320}
      height={163}
      draggable={false}
      className={`block w-auto select-none ${className}`}
    />
  );
}
