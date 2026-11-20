import { app } from "@/config/app";
import { gradients } from "@/theme/theme";
import { cn } from "@/lib/utils";

/** Soundwave mark on the brand gradient. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn("relative inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-[10px] shadow-soft", className)}
      style={{ background: gradients.indigo }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round">
        <path d="M5 10v4M9 7v10M13 4v16M17 8v8M21 11v2" />
      </svg>
    </span>
  );
}

/** "Nexa" + indigo "Neura", as on nexaneura.com. */
export function Wordmark({ className, showProduct = true }: { className?: string; showProduct?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark />
      <span className="flex flex-col leading-none">
        <span className="text-[17px] font-bold tracking-brand text-heading">
          {app.wordmark.lead}
          <span className="text-primary">{app.wordmark.accent}</span>
        </span>
        {showProduct && (
          <span className="mt-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{app.product}</span>
        )}
      </span>
    </span>
  );
}
