export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-bold tracking-[0.08em] text-[1rem] md:text-[1.05rem] ${className}`}>
      CUT<span className="mx-1 opacity-60">&amp;</span>CULT
    </span>
  );
}

export function SkullMark({ className = "" }: { className?: string }) {
  // Simple stylized skull mark — brand watermark
  return (
    <svg viewBox="0 0 64 48" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M18 4c-6 3-10 9-10 17 0 5 2 9 5 12v6c0 2 1 3 3 3h4v-4h4v4h8v-4h4v4h4c2 0 3-1 3-3v-6c3-3 5-7 5-12 0-8-4-14-10-17-4-2-11-2-15 0zm2 15a3 3 0 110 6 3 3 0 010-6zm18 0a3 3 0 110 6 3 3 0 010-6zM26 30h8l-2 4h-4l-2-4z"
      />
    </svg>
  );
}
