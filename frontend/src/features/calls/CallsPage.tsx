import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleDollarSign,
  Clock,
  Download,
  PhoneCall,
  PhoneIncoming,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatTile } from "@/components/StatTile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton, Table, Td, Th } from "@/components/ui/misc";
import { Tooltip } from "@/components/ui/overlays";
import { Select } from "@/components/ui/select";
import { app } from "@/config/app";
import { callStatuses, callTypes, terminationReasons, type CallStatus, type CallType } from "@/config/calls";
import { useAgents, useCalls, useCallStats } from "@/hooks/queries";
import { downloadText, formatDateTime, formatDuration, formatMoney, formatNumber, formatPercent, relativeTime, shortId } from "@/lib/format";
import { cn } from "@/lib/utils";
import { exportCallsCsv } from "@/services/calls";
import type { CallFilters } from "@/types/call";
import { CallDetailSheet } from "./CallDetailSheet";
import { CallStatusBadge, CallTypeLabel } from "./CallStatusBadge";

const ranges = [
  { value: "1", label: "Today" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

type SortField = NonNullable<CallFilters["sort"]>["field"];

export function CallsPage() {
  const [params, setParams] = useSearchParams();
  const { data: agents = [] } = useAgents();

  const get = (k: string) => params.get(k) ?? undefined;
  const range = get("range") ?? "30";
  const page = Number(get("page") ?? 1);
  const pageSize = Number(get("size") ?? app.defaultPageSize);
  const sortField = (get("sort") as SortField) ?? "startedAt";
  const sortDir = (get("dir") as "asc" | "desc") ?? "desc";

  const base = useMemo(() => {
    const from = range === "all" ? undefined : new Date(Date.now() - Number(range) * 86_400_000).toISOString();
    return {
      agentId: get("agent"),
      status: get("status") as CallStatus | undefined,
      type: get("type") as CallType | undefined,
      search: get("q"),
      from,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const filters: CallFilters = { ...base, page, pageSize, sort: { field: sortField, dir: sortDir } };
  const calls = useCalls(filters);
  const stats = useCallStats(base);
  const callId = get("call") ?? null;

  const set = (patch: Record<string, string | undefined>, resetPage = true) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "" || v === "all-agents" || v === "any") next.delete(k);
      else next.set(k, v);
    }
    if (resetPage && !("page" in patch)) next.delete("page");
    setParams(next, { replace: true });
  };

  const hasFilters = ["agent", "status", "type", "q"].some((k) => params.has(k));
  const total = calls.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const s = stats.data;

  const sortHeader = (field: SortField, label: string) => (
    <button className="inline-flex items-center gap-1 uppercase hover:text-heading" onClick={() => set({ sort: field, dir: sortField === field && sortDir === "desc" ? "asc" : "desc" }, false)}>
      {label}
      {sortField === field && (sortDir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
    </button>
  );

  return (
    <>
      <PageHeader
        title="Call history"
        description="Every conversation your agents have had, with transcripts, recordings and latency."
        actions={
          <>
            <Tooltip content="Refresh">
              <Button variant="secondary" size="icon" onClick={() => void calls.refetch()} aria-label="Refresh">
                <RefreshCw className={cn(calls.isFetching && "animate-spin")} />
              </Button>
            </Tooltip>
            <Button
              variant="secondary"
              onClick={async () => {
                downloadText(`calls-${new Date().toISOString().slice(0, 10)}.csv`, await exportCallsCsv(base), "text/csv");
                toast.success(`Exported ${formatNumber(total)} calls`);
              }}
            >
              <Download /> Download CSV
            </Button>
          </>
        }
      />

      {/* Filters */}
      <div className="mb-5 flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-soft lg:flex-row lg:items-center">
        <div className="grid flex-1 grid-cols-2 gap-2 md:grid-cols-4">
          <Select
            aria-label="Agent"
            value={get("agent") ?? "all-agents"}
            onValueChange={(v) => set({ agent: v })}
            options={[{ value: "all-agents", label: "All agents" }, ...agents.map((a) => ({ value: a.id, label: a.name }))]}
          />
          <Select aria-label="Date range" value={range} onValueChange={(v) => set({ range: v === "30" ? undefined : v })} options={ranges} />
          <Select
            aria-label="Status"
            value={get("status") ?? "any"}
            onValueChange={(v) => set({ status: v })}
            options={[{ value: "any", label: "Any status" }, ...Object.entries(callStatuses).map(([k, v]) => ({ value: k, label: v.label }))]}
          />
          <Select
            aria-label="Call type"
            value={get("type") ?? "any"}
            onValueChange={(v) => set({ type: v })}
            options={[{ value: "any", label: "Any type" }, ...Object.entries(callTypes).map(([k, v]) => ({ value: k, label: v.label }))]}
          />
        </div>
        <div className="flex gap-2">
          <Input
            icon={<Search />}
            placeholder="Execution ID or number"
            defaultValue={get("q")}
            key={get("q") ?? ""}
            onKeyDown={(e) => e.key === "Enter" && set({ q: (e.target as HTMLInputElement).value.trim() })}
            onBlur={(e) => e.target.value.trim() !== (get("q") ?? "") && set({ q: e.target.value.trim() })}
            className="lg:w-64"
          />
          {hasFilters && (
            <Button variant="ghost" onClick={() => setParams(new URLSearchParams(range !== "30" ? { range } : {}), { replace: true })}>
              <X /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={PhoneCall} label="Total calls" loading={!s} value={s && formatNumber(s.total)} sub={s && `${formatNumber(s.completed)} completed`} />
        <StatTile icon={PhoneIncoming} label="Connect rate" loading={!s} value={s && (s.total ? formatPercent(s.completed / s.total) : "–")} sub="Answered and completed" />
        <StatTile icon={Clock} label="Talk time" loading={!s} value={s && formatDuration(s.totalDurationSeconds)} sub={s && `Avg ${formatDuration(s.avgDurationSeconds)} per call`} />
        <StatTile icon={CircleDollarSign} label="Est. spend" loading={!s} value={s && formatMoney(s.totalCostUsd)} sub={s && `${formatMoney(s.avgCostUsd, 3)} per call · ${Math.round(s.avgLatencyMs)} ms avg latency`} />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-soft">
        {calls.isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : total === 0 ? (
          <EmptyState
            icon={PhoneCall}
            title="No calls found"
            description={hasFilters ? "No calls match these filters. Try clearing them." : "Calls will appear here as soon as your agents start talking."}
            className="rounded-none border-0 shadow-none"
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Execution ID</Th>
                <Th>Agent</Th>
                <Th>Number</Th>
                <Th>Type</Th>
                <Th>{sortHeader("durationSeconds", "Duration")}</Th>
                <Th>Status</Th>
                <Th>Ended because</Th>
                <Th>{sortHeader("startedAt", "Started")}</Th>
                <Th className="text-right">{sortHeader("costUsd", "Cost")}</Th>
              </tr>
            </thead>
            <tbody className={cn(calls.isFetching && "opacity-60 transition-opacity")}>
              {calls.data!.items.map((c) => (
                <tr
                  key={c.id}
                  tabIndex={0}
                  onClick={() => set({ call: c.id }, false)}
                  onKeyDown={(e) => e.key === "Enter" && set({ call: c.id }, false)}
                  className={cn("cursor-pointer transition-colors hover:bg-primary-soft/40 focus:bg-primary-soft/40 focus:outline-none", callId === c.id && "bg-primary-soft/60")}
                >
                  <Td className="font-mono text-xs text-muted-foreground">{shortId(c.id, 8)}</Td>
                  <Td className="max-w-[200px] truncate font-medium" title={c.agentName}>{c.agentName}</Td>
                  <Td className="tabular-nums">{c.userNumber}</Td>
                  <Td>
                    <CallTypeLabel type={c.type} />
                  </Td>
                  <Td className="tabular-nums">{c.durationSeconds ? formatDuration(c.durationSeconds) : "–"}</Td>
                  <Td>
                    <CallStatusBadge status={c.status} />
                  </Td>
                  <Td className="max-w-[200px] truncate text-muted-foreground">
                    {c.terminationReason ? (terminationReasons[c.terminationReason] ?? c.terminationReason) : "–"}
                  </Td>
                  <Td>
                    <Tooltip content={formatDateTime(c.startedAt)}>
                      <span className="text-muted-foreground">{relativeTime(c.startedAt)}</span>
                    </Tooltip>
                  </Td>
                  <Td className="text-right tabular-nums">{c.costUsd ? formatMoney(c.costUsd, 3) : "–"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {total > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 text-sm sm:flex-row">
            <div className="flex items-center gap-2 text-muted-foreground">
              Rows per page
              <Select
                size="sm"
                className="w-20"
                value={String(pageSize)}
                onValueChange={(v) => set({ size: v })}
                options={app.pageSizes.map((n) => ({ value: String(n), label: String(n) }))}
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">
                {formatNumber((page - 1) * pageSize + 1)}–{formatNumber(Math.min(page * pageSize, total))} of {formatNumber(total)}
              </span>
              <div className="flex gap-1">
                <Button variant="secondary" size="icon-sm" disabled={page <= 1} onClick={() => set({ page: undefined }, false)} aria-label="First page">
                  <ChevronsLeft />
                </Button>
                <Button variant="secondary" size="icon-sm" disabled={page <= 1} onClick={() => set({ page: String(page - 1) }, false)} aria-label="Previous page">
                  <ChevronLeft />
                </Button>
                <Button variant="secondary" size="icon-sm" disabled={page >= pages} onClick={() => set({ page: String(page + 1) }, false)} aria-label="Next page">
                  <ChevronRight />
                </Button>
                <Button variant="secondary" size="icon-sm" disabled={page >= pages} onClick={() => set({ page: String(pages) }, false)} aria-label="Last page">
                  <ChevronsRight />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <CallDetailSheet callId={callId} onClose={() => set({ call: undefined }, false)} />
    </>
  );
}
