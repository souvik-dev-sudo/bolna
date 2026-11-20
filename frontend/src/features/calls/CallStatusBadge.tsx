import { Badge } from "@/components/ui/badge";
import { callStatuses, callTypes, type CallStatus, type CallType } from "@/config/calls";

export function CallStatusBadge({ status }: { status: CallStatus }) {
  // A status this build doesn't know (added on the server later) still shows, as plain text.
  const s = callStatuses[status] ?? { label: status, tone: "neutral" as const, icon: undefined };
  return (
    <Badge tone={s.tone} icon={s.icon} spin={status === "in-progress" || status === "ringing"}>
      {s.label}
    </Badge>
  );
}

export function CallTypeLabel({ type }: { type: CallType }) {
  const t = callTypes[type] ?? callTypes.outbound;
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <t.icon className="h-3.5 w-3.5" />
      {t.label}
    </span>
  );
}
