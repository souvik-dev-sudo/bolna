import type { ReactNode } from "react";

/** Shared tooltip body for Recharts: text in ink colors, a colored swatch carries identity. */
export function ChartTooltip({
  title,
  rows,
}: {
  title: ReactNode;
  rows: { label: string; value: ReactNode; color?: string }[];
}) {
  return (
    <div className="min-w-[150px] rounded-lg border bg-card px-3 py-2 shadow-lift">
      <p className="mb-1.5 text-xs font-semibold text-heading">{title}</p>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            {r.color && <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: r.color }} />}
            {r.label}
          </span>
          <span className="font-medium tabular-nums text-heading">{r.value}</span>
        </div>
      ))}
    </div>
  );
}
