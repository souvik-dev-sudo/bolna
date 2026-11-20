import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, Bot, Clock, Database, Gauge, GitBranch, PhoneCall, Plus, Server, TrendingUp } from "lucide-react";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { StatTile } from "@/components/StatTile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { app } from "@/config/app";
import { callStatuses, type CallStatus } from "@/config/calls";
import { CallStatusBadge } from "@/features/calls/CallStatusBadge";
import { agentPath } from "@/features/agents/CreateAgentDialog";
import { useAgents, useAgentServerHealth, useCalls, useCallsPerDay, useCallStats, useDatabaseHealth } from "@/hooks/queries";
import { formatDay, formatDuration, formatNumber, formatPercent, relativeTime } from "@/lib/format";
import { chart, gradients, tones } from "@/theme/theme";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function CallsPerDayChart() {
  const { data, isLoading } = useCallsPerDay(14);
  if (isLoading || !data) return <Skeleton className="h-[240px] w-full" />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={chart.grid} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: chart.axis }}
          tickFormatter={(d: string) => formatDay(d)}
          interval="preserveStartEnd"
          minTickGap={16}
        />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: chart.axis }} />
        <ReTooltip
          cursor={{ fill: "rgba(79,70,229,0.06)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as { date: string; total: number; completed: number };
            return (
              <ChartTooltip
                title={formatDay(d.date)}
                rows={[
                  { label: "Calls", value: d.total, color: chart.single },
                  { label: "Completed", value: `${d.completed} (${d.total ? formatPercent(d.completed / d.total) : "–"})` },
                ]}
              />
            );
          }}
        />
        <Bar dataKey="total" fill={chart.single} radius={[4, 4, 0, 0]} maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const outcomeOrder: CallStatus[] = ["completed", "no-answer", "busy", "failed", "canceled"];

function Outcomes() {
  const { data, isLoading } = useCalls({ page: 1, pageSize: 1000, from: new Date(Date.now() - 30 * 86_400_000).toISOString() });
  const counts = useMemo(() => {
    const m = new Map<CallStatus, number>();
    data?.items.forEach((c) => m.set(c.status, (m.get(c.status) ?? 0) + 1));
    return m;
  }, [data]);
  if (isLoading || !data) return <Skeleton className="h-48 w-full" />;
  const total = data.total || 1;
  return (
    <ul className="flex flex-col gap-3">
      {outcomeOrder.map((status) => {
        const s = callStatuses[status];
        const n = counts.get(status) ?? 0;
        return (
          <li key={status} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-heading">
                <s.icon className="h-4 w-4" style={{ color: tones[s.tone].fg }} />
                {s.label}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {formatNumber(n)} · {formatPercent(n / total)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-pill bg-muted">
              <div className="h-full rounded-pill" style={{ width: `${(n / total) * 100}%`, backgroundColor: tones[s.tone].fg }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function HealthRow({ icon: Icon, label, ok, loading, detail }: { icon: typeof Server; label: string; ok: boolean; loading: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="flex items-center gap-2.5 text-sm text-heading">
        <Icon className="h-4 w-4 text-muted-foreground" /> {label}
      </span>
      {loading ? (
        <Badge tone="neutral">Checking…</Badge>
      ) : ok ? (
        <Badge tone="success" dot title={detail}>
          Online
        </Badge>
      ) : (
        <Badge tone="danger" dot title={detail}>
          Offline
        </Badge>
      )}
    </div>
  );
}

export function OverviewPage() {
  const weekAgo = useMemo(() => new Date(Date.now() - 7 * 86_400_000).toISOString(), []);
  const stats = useCallStats({ from: weekAgo });
  const recent = useCalls({ page: 1, pageSize: 6 });
  const { data: agents } = useAgents();
  const server = useAgentServerHealth();
  const db = useDatabaseHealth();
  const s = stats.data;

  return (
    <div className="flex flex-col gap-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl border p-6 shadow-soft md:p-8" style={{ background: gradients.brand }}>
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/85 to-white/30" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">{app.workspace.name}</p>
            <h1 className="mt-1 text-[28px] font-semibold leading-tight md:text-[32px]">{greeting()}</h1>
            <p className="mt-1.5 max-w-lg text-sm text-muted-foreground">
              Your voice agents handled <strong className="text-heading">{s ? formatNumber(s.total) : "…"} calls</strong> in the last 7 days.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" asChild>
              <Link to="/calls">
                <PhoneCall /> View calls
              </Link>
            </Button>
            <Button asChild>
              <Link to="/agents">
                <Plus /> New agent
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={PhoneCall} label="Calls · 7 days" loading={!s} value={s && formatNumber(s.total)} sub={s && `${formatNumber(s.completed)} completed`} />
        <StatTile icon={TrendingUp} label="Connect rate" loading={!s} value={s && (s.total ? formatPercent(s.completed / s.total) : "–")} sub="Answered & completed" />
        <StatTile icon={Clock} label="Avg duration" loading={!s} value={s && formatDuration(s.avgDurationSeconds)} sub="Completed calls" />
        <StatTile icon={Gauge} label="Avg response" loading={!s} value={s && `${Math.round(s.avgLatencyMs)} ms`} sub="Caller stops → agent speaks" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>Calls per day</CardTitle>
              <CardDescription>Last 14 days, all agents</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <CallsPerDayChart />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Outcomes</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <Outcomes />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent calls</CardTitle>
            <Button variant="link" asChild>
              <Link to="/calls">
                All calls <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {recent.isLoading ? (
              <div className="flex flex-col gap-2 p-5 pt-0">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : (
              <ul className="divide-y border-t">
                {recent.data?.items.map((c) => (
                  <li key={c.id}>
                    <Link to={`/calls?call=${c.id}`} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-primary-soft/40">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-heading">{c.agentName}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.userNumber} · {relativeTime(c.startedAt)}
                        </p>
                      </div>
                      <span className="hidden text-sm tabular-nums text-muted-foreground sm:block">{c.durationSeconds ? formatDuration(c.durationSeconds) : "–"}</span>
                      <CallStatusBadge status={c.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Your agents <Badge tone="info">{agents?.length ?? "–"}</Badge>
              </CardTitle>
              <Button variant="link" asChild>
                <Link to="/agents">
                  View all <ArrowRight />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              {agents?.slice(0, 4).map((a) => (
                <Link key={a.id} to={agentPath(a.id, a.kind)} className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-soft text-primary">
                    {a.kind === "graph" ? <GitBranch className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-heading">{a.name}</span>
                    <span className="block text-xs text-muted-foreground">Updated {relativeTime(a.updatedAt)}</span>
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Platform health</CardTitle>
              <CardDescription>Live checks against the backend</CardDescription>
            </CardHeader>
            <CardContent className="divide-y py-0 pb-3">
              <HealthRow icon={Server} label="Agent server" loading={server.isLoading} ok={server.isSuccess} detail={server.error?.message} />
              <HealthRow
                icon={Database}
                label="Database"
                loading={db.isLoading}
                ok={db.isSuccess}
                detail={db.data ? `Postgres ${db.data.server_version} · ${db.data.latency_ms} ms` : db.error?.message}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
