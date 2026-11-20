import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

/** A headline number. Not a chart: one value, a label, and optional context. */
export function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  loading,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  loading?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-soft", className)}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-soft text-primary">
          <Icon className="h-4 w-4" />
        </span>
        {label}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <div className="text-[28px] font-semibold leading-none tracking-tightish text-heading tabular-nums">{value}</div>
      )}
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
