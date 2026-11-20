import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { gradients } from "@/theme/theme";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-14 text-center", className)}>
      <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-2xl shadow-soft" style={{ background: gradients.brand }}>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-card/90">
          <Icon className="h-5 w-5 text-primary" />
        </span>
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
