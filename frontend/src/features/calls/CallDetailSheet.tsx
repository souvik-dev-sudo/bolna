import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis } from "recharts";
import { Bot, FileText, Gauge, MessageSquareText, Star, User } from "lucide-react";
import { toast } from "sonner";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { Badge } from "@/components/ui/badge";
import { CopyChip, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";
import { Sheet, SheetContent } from "@/components/ui/overlays";
import { callProviders, hangupBy, terminationReasons } from "@/config/calls";
import { useCall, useSetCallRating } from "@/hooks/queries";
import { formatDateTime, formatDuration, shortId } from "@/lib/format";
import { cn } from "@/lib/utils";
import { chart } from "@/theme/theme";
import type { CallRecord } from "@/types/call";
import { CallStatusBadge, CallTypeLabel } from "./CallStatusBadge";

/** The call's recording, streamed from Plivo through bolna-app (seekable). */
function RecordingPlayer({ call }: { call: CallRecord }) {
  const [failed, setFailed] = useState(false);
  if (!call.recordingUrl || failed) {
    return (
      <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
        {call.status !== "completed" ? "No recording: the call wasn't answered." : "No recording for this call."}
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-muted/40 px-3 py-2">
      <audio key={call.id} controls preload="metadata" src={call.recordingUrl} onError={() => setFailed(true)} className="h-10 w-full">
        <track kind="captions" />
      </audio>
    </div>
  );
}

function Transcript({ call }: { call: CallRecord }) {
  if (call.transcript.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {call.status === "completed" ? "Nothing was said on this call." : "No conversation: the call wasn't answered."}
      </p>
    );
  }
  return (
    <ol className="flex flex-col gap-3">
      {call.transcript.map((t, i) => {
        const agent = t.role === "agent";
        return (
          <li key={i} className={cn("flex gap-3", !agent && "flex-row-reverse")}>
            <span className={cn("mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", agent ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground")}>
              {agent ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
            </span>
            <div
              className={cn(
                "max-w-[80%] rounded-lg px-3 py-2 text-sm leading-relaxed text-indic",
                agent ? "bg-card text-heading shadow-soft ring-1 ring-border" : "bg-primary text-white",
              )}
            >
              {t.text}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// totalMs = how long the caller waited for each reply. LLM = first token, Voice = first audio;
// the rest is transcription, end-of-turn detection and the Engine tab's linear delay.
const latencySeries = [
  { key: "transcriberMs", label: "Transcription & wait", color: chart.categorical[0] },
  { key: "llmMs", label: "LLM", color: chart.categorical[1] },
  { key: "synthesizerMs", label: "Voice", color: chart.categorical[2] },
] as const;

function Latency({ call }: { call: CallRecord }) {
  if (call.latencies.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">No agent replies to measure.</p>;
  const avg = (k: (typeof latencySeries)[number]["key"] | "totalMs") => Math.round(call.latencies.reduce((s, l) => s + l[k], 0) / call.latencies.length);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[{ label: "Avg response", value: avg("totalMs") }, ...latencySeries.map((s) => ({ label: s.label, value: avg(s.key), color: s.color }))].map((m) => (
          <div key={m.label} className="rounded-lg border px-3 py-2">
            <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
              {"color" in m && <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: m.color }} />}
              {m.label}
            </p>
            <p className="text-lg font-semibold tabular-nums text-heading">{m.value} ms</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Caller stops → agent starts speaking, per reply</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={call.latencies} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={chart.grid} strokeDasharray="3 3" />
            <XAxis dataKey="turn" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: chart.axis }} tickFormatter={(t) => `#${t}`} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: chart.axis }} tickFormatter={(v) => `${v}`} />
            <ReTooltip
              cursor={{ fill: "rgba(79,70,229,0.06)" }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <ChartTooltip
                    title={`Reply ${label} · ${payload.reduce((s, p) => s + Number(p.value), 0)} ms`}
                    rows={latencySeries.map((s) => ({ label: s.label, color: s.color, value: `${payload.find((p) => p.dataKey === s.key)?.value ?? 0} ms` }))}
                  />
                ) : null
              }
            />
            {latencySeries.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                stackId="t"
                fill={s.color}
                stroke={chart.surface}
                strokeWidth={2}
                maxBarSize={28}
                radius={i === latencySeries.length - 1 ? [4, 4, 0, 0] : 0}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
          {latencySeries.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} /> {s.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 1-5 stars, saved on the call. Clicking the current rating clears it. */
export function Rating({ call, size = "md" }: { call: CallRecord; size?: "sm" | "md" }) {
  const save = useSetCallRating();
  const value = save.isPending ? (save.variables?.rating ?? 0) : (call.rating ?? 0);
  return (
    <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            save.mutate(
              { id: call.id, rating: value === n ? null : n },
              { onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save the rating") },
            );
          }}
          className="text-border-strong transition-colors hover:text-warning"
        >
          <Star className={cn(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4", n <= value && "fill-warning text-warning")} />
        </button>
      ))}
    </div>
  );
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm text-heading">{children}</dd>
    </div>
  );
}

export function CallDetailSheet({ callId, onClose }: { callId: string | null; onClose: () => void }) {
  const { data: call, isLoading, error } = useCall(callId ?? undefined);
  const extracted = Object.entries(call?.extracted ?? {});

  return (
    <Sheet open={Boolean(callId)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        title={call ? (call.userNumber ?? "Call") : "Call"}
        description={call ? `${call.agentName} · ${formatDateTime(call.startedAt)}` : undefined}
        className="max-w-2xl"
      >
        {error ? (
          <p className="p-5 text-sm text-danger">{error instanceof Error ? error.message : "Could not load this call."}</p>
        ) : isLoading || !call ? (
          <div className="flex flex-col gap-3 p-5">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <div className="flex flex-col gap-5 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <CallStatusBadge status={call.status} />
              <Badge tone="neutral">
                <CallTypeLabel type={call.type} />
              </Badge>
              <span className="ml-auto">
                <Rating call={call} />
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-4 rounded-lg border p-4 sm:grid-cols-3">
              <Meta label="Agent">
                <Link to={`/agents/${call.agentId}`} className="text-primary hover:underline">
                  {call.agentName}
                </Link>
              </Meta>
              <Meta label="User Number">{call.userNumber ?? "–"}</Meta>
              <Meta label="Duration">{call.durationSeconds ? formatDuration(call.durationSeconds) : "–"}</Meta>
              <Meta label="Hangup By">{call.hangupBy ? hangupBy[call.hangupBy] : "–"}</Meta>
              <Meta label="Termination Reason">{call.terminationReason ? (terminationReasons[call.terminationReason] ?? call.terminationReason) : "–"}</Meta>
              <Meta label="Provider">{callProviders[call.provider] ?? call.provider}</Meta>
              <Meta label="Execution ID">
                <CopyChip value={call.id} display={shortId(call.id, 8)} />
              </Meta>
              {call.callSid && (
                <Meta label="Provider call ID">
                  <CopyChip value={call.callSid} display={shortId(call.callSid, 8)} />
                </Meta>
              )}
              {call.webhook && (
                <Meta label="Webhook">
                  <span className={call.webhook.error ? "text-danger" : "text-success"} title={call.webhook.error ?? call.webhook.url}>
                    {call.webhook.error ? "Failed" : `Delivered (${call.webhook.status})`}
                  </span>
                </Meta>
              )}
            </dl>

            <RecordingPlayer call={call} />

            <Tabs defaultValue="transcript">
              <TabsList className="flex w-full">
                <TabsTrigger value="transcript">
                  <MessageSquareText /> Transcript
                </TabsTrigger>
                <TabsTrigger value="data">
                  <FileText /> Conversation Data
                </TabsTrigger>
                <TabsTrigger value="latency">
                  <Gauge /> Latency
                </TabsTrigger>
              </TabsList>
              <TabsContent value="transcript" className="mt-4">
                <Transcript call={call} />
              </TabsContent>
              <TabsContent value="data" className="mt-4 flex flex-col gap-4">
                <div className="rounded-lg border p-4">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Call Summary</p>
                  <p className="text-sm leading-relaxed text-heading text-indic">{call.summary ?? "No summary for this call (Call Summary is off in the agent's Extractions tab)."}</p>
                </div>
                {extracted.length > 0 ? (
                  <div className="overflow-hidden rounded-lg border">
                    <p className="border-b bg-muted/60 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Extractions</p>
                    <dl className="divide-y">
                      {extracted.map(([k, v]) => (
                        <div key={k} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-3 px-4 py-2 text-sm">
                          <dt className="truncate font-mono text-xs text-muted-foreground">{k}</dt>
                          <dd className="break-words font-medium text-heading text-indic">{typeof v === "string" ? v || "—" : JSON.stringify(v)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No extractions for this call.</p>
                )}
              </TabsContent>
              <TabsContent value="latency" className="mt-4">
                <Latency call={call} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
