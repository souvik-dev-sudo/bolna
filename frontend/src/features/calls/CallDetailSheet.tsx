import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis } from "recharts";
import { Bot, FileText, Gauge, MessageSquareText, Pause, Play, Star, User } from "lucide-react";
import { toast } from "sonner";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyChip, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";
import { Sheet, SheetContent } from "@/components/ui/overlays";
import { hangupBy, terminationReasons } from "@/config/calls";
import { languageName } from "@/config/languages";
import { useCall } from "@/hooks/queries";
import { clock, formatDateTime, formatDuration, formatMoney, shortId } from "@/lib/format";
import { cn } from "@/lib/utils";
import { chart } from "@/theme/theme";
import type { CallRecord } from "@/types/call";
import { CallStatusBadge, CallTypeLabel } from "./CallStatusBadge";

/** Recording player. Plays a simulated timeline until recordings are served (GCS signed URLs). */
function RecordingPlayer({ call, position, setPosition }: { call: CallRecord; position: number; setPosition: (s: number) => void }) {
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number>();
  const duration = call.durationSeconds;

  useEffect(() => {
    if (!playing) return;
    timer.current = window.setInterval(() => {
      setPosition(Math.min(duration, position + 1));
    }, 1000);
    return () => window.clearInterval(timer.current);
  }, [playing, position, duration, setPosition]);
  useEffect(() => {
    if (position >= duration) setPlaying(false);
  }, [position, duration]);

  if (!call.recordingUrl) {
    return (
      <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
        {call.type === "web" ? "Web calls aren't recorded." : "No recording for this call."}
      </div>
    );
  }
  // Fake waveform bars, stable per call
  const bars = Array.from({ length: 64 }, (_, i) => 0.25 + Math.abs(Math.sin(i * 1.7 + call.id.charCodeAt(i % call.id.length))) * 0.75);
  const progress = duration ? position / duration : 0;

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-3">
      <Button size="icon" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}>
        {playing ? <Pause /> : <Play />}
      </Button>
      <button
        className="flex h-10 flex-1 items-center gap-[2px]"
        aria-label="Seek"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setPosition(Math.round(((e.clientX - rect.left) / rect.width) * duration));
        }}
      >
        {bars.map((h, i) => (
          <span
            key={i}
            className={cn("flex-1 rounded-full", i / bars.length <= progress ? "bg-primary" : "bg-border-strong")}
            style={{ height: `${h * 100}%` }}
          />
        ))}
      </button>
      <span className="w-20 text-right text-xs tabular-nums text-muted-foreground">
        {clock(position)} / {clock(duration)}
      </span>
    </div>
  );
}

function Transcript({ call, onSeek, position }: { call: CallRecord; onSeek: (s: number) => void; position: number }) {
  if (call.transcript.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">No conversation: the call wasn't answered.</p>;
  return (
    <ol className="flex flex-col gap-3">
      {call.transcript.map((t, i) => {
        const next = call.transcript[i + 1]?.at ?? Infinity;
        const current = position >= t.at && position < next && position > 0;
        const agent = t.role === "agent";
        return (
          <li key={i} className={cn("flex gap-3", !agent && "flex-row-reverse")}>
            <span className={cn("mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", agent ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground")}>
              {agent ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
            </span>
            <div className={cn("flex max-w-[80%] flex-col gap-1", !agent && "items-end")}>
              <div
                className={cn(
                  "rounded-lg px-3 py-2 text-sm leading-relaxed text-indic transition-shadow",
                  agent ? "bg-card text-heading shadow-soft ring-1 ring-border" : "bg-primary text-white",
                  current && "ring-2 ring-primary",
                )}
              >
                {t.text}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-placeholder">
                <button onClick={() => onSeek(t.at)} className="tabular-nums hover:text-primary" aria-label={`Play from ${clock(t.at)}`}>
                  {clock(t.at)}
                </button>
                {t.language && <span>{languageName(t.language)}</span>}
                {t.node && <span className="rounded-sm bg-muted px-1 font-mono">{t.node}</span>}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const latencySeries = [
  { key: "transcriberMs", label: "Transcriber", color: chart.categorical[0] },
  { key: "llmMs", label: "LLM", color: chart.categorical[1] },
  { key: "synthesizerMs", label: "Voice", color: chart.categorical[2] },
] as const;

function Latency({ call }: { call: CallRecord }) {
  if (call.latencies.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">No turns to measure.</p>;
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
        <p className="mb-2 text-xs font-medium text-muted-foreground">Response time per agent turn</p>
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
                  title={`Turn ${label} · ${payload.reduce((s, p) => s + Number(p.value), 0)} ms`}
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

function Rating({ initial }: { initial?: number }) {
  const [value, setValue] = useState(initial ?? 0);
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rate this call">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onClick={() => {
            setValue(n);
            toast.success("Rating saved");
          }}
          className="text-border-strong transition-colors hover:text-warning"
        >
          <Star className={cn("h-4 w-4", n <= value && "fill-warning text-warning")} />
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
  const { data: call, isLoading } = useCall(callId ?? undefined);
  const [position, setPosition] = useState(0);
  useEffect(() => {
    setPosition(0);
  }, [callId]);

  return (
    <Sheet open={Boolean(callId)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        title={call ? call.userNumber : "Call"}
        description={call ? `${call.agentName} · ${formatDateTime(call.startedAt)}` : undefined}
        className="max-w-2xl"
      >
        {isLoading || !call ? (
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
              {call.languages.map((l) => (
                <Badge key={l} tone="info">
                  {languageName(l)}
                </Badge>
              ))}
              <span className="ml-auto">
                <Rating initial={call.rating} />
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-4 rounded-lg border p-4 sm:grid-cols-3">
              <Meta label="Agent">
                <Link to={`/agents/${call.agentId}`} className="text-primary hover:underline">
                  {call.agentName}
                </Link>
              </Meta>
              <Meta label="Duration">{call.durationSeconds ? formatDuration(call.durationSeconds) : "–"}</Meta>
              <Meta label="Est. cost">{call.costUsd ? formatMoney(call.costUsd, 3) : "–"}</Meta>
              <Meta label="Hung up by">{call.hangupBy ? hangupBy[call.hangupBy] : "–"}</Meta>
              <Meta label="Reason">{call.terminationReason ? (terminationReasons[call.terminationReason] ?? call.terminationReason) : "–"}</Meta>
              <Meta label="From">{call.fromNumber ?? "Browser"}</Meta>
              <Meta label="Execution ID">
                <CopyChip value={call.id} display={shortId(call.id, 8)} />
              </Meta>
              {call.callSid && (
                <Meta label="Provider call ID">
                  <CopyChip value={call.callSid} display={shortId(call.callSid, 8)} />
                </Meta>
              )}
            </dl>

            <RecordingPlayer call={call} position={position} setPosition={setPosition} />

            <Tabs defaultValue="transcript">
              <TabsList className="flex w-full">
                <TabsTrigger value="transcript">
                  <MessageSquareText /> Transcript
                </TabsTrigger>
                <TabsTrigger value="data">
                  <FileText /> Summary & data
                </TabsTrigger>
                <TabsTrigger value="latency">
                  <Gauge /> Latency
                </TabsTrigger>
              </TabsList>
              <TabsContent value="transcript" className="mt-4">
                <Transcript call={call} position={position} onSeek={setPosition} />
              </TabsContent>
              <TabsContent value="data" className="mt-4 flex flex-col gap-4">
                <div className="rounded-lg border p-4">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Summary</p>
                  <p className="text-sm leading-relaxed text-heading">{call.summary ?? "No summary for this call."}</p>
                </div>
                {call.extracted && (
                  <div className="overflow-hidden rounded-lg border">
                    <p className="border-b bg-muted/60 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Extracted data</p>
                    <dl className="divide-y">
                      {Object.entries(call.extracted).map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between px-4 py-2 text-sm">
                          <dt className="font-mono text-xs text-muted-foreground">{k}</dt>
                          <dd className="font-medium text-heading">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
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
