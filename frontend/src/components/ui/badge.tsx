import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { tones, type Tone } from "@/theme/theme";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  icon?: LucideIcon;
  dot?: boolean;
  spin?: boolean;
}

/** Status/label pill. Colors come from theme.tones; always pair color with text (and icon). */
export function Badge({ tone = "neutral", icon: Icon, dot, spin, className, style, children, ...props }: BadgeProps) {
  const t = tones[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border px-2 py-0.5 text-xs font-medium",
        className,
      )}
      style={{ color: t.fg, backgroundColor: t.bg, borderColor: t.border, ...style }}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.fg }} />}
      {Icon && <Icon className={cn("h-3.5 w-3.5", spin && "animate-spin")} />}
      {children}
    </span>
  );
}
