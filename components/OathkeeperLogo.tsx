import { cn } from "@/lib/utils";

export function OathkeeperMark({ className, gradient = false }: { className?: string; gradient?: boolean }) {
  return (
    <svg viewBox="0 0 42 48" className={cn("size-5", className)} aria-hidden="true">
      {gradient ? <defs>
        <linearGradient id="oathkeeper-mark-gradient" x1="4" y1="4" x2="38" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#60a5fa"/>
          <stop offset="0.48" stopColor="#3b82f6"/>
          <stop offset="1" stopColor="#4338ca"/>
        </linearGradient>
      </defs> : null}
      <path
        fill={gradient ? "url(#oathkeeper-mark-gradient)" : "currentColor"}
        fillRule="evenodd"
        d="m22.102 20.86 9.9-9.9L29.88 8.84l-7.339 7.339V3h-3v13.178l-7.339-7.34-2.121 2.122 9.9 9.9 1.06 1.06zm2.12 2.121 9.9-9.9 2.121 2.122-7.339 7.339H42v3H28.904l7.34 7.339L34.121 35l-9.9-9.899-1.06-1.06zM7.96 35.001l9.9-9.899 1.06-1.06-1.06-1.061-9.9-9.9-2.121 2.122 7.339 7.339H.002v3h13.176l-7.34 7.339zm12.02-7.777-9.9 9.9 2.122 2.12 7.339-7.338V45h3V31.906l7.339 7.338L32 37.124l-9.9-9.9-1.06-1.061z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function OathkeeperLogo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <span className={cn("flex shrink-0 items-center justify-center", compact ? "size-[18px]" : "size-7")}>
        <OathkeeperMark gradient className={compact ? "size-[15px]" : "size-5"} />
      </span>
      {!compact ? <span className="truncate font-[family-name:var(--font-brand)] text-[19px] leading-none tracking-[-0.035em] text-ink">Oathkeeper</span> : null}
    </span>
  );
}
