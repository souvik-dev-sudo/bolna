import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Download,
  Eye,
  PhoneCall,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { StatTile } from "@/components/StatTile";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton, Table, Td, Th } from "@/components/ui/misc";
import { Tooltip } from "@/components/ui/overlays";
import { Select } from "@/components/ui/select";
import { app } from "@/config/app";
import { callProviders, callStatuses, callTypes, hangupBy, terminationReasons, type CallStatus, type CallType } from "@/config/calls";
import { useAgents, useCalls, useCallStats } from "@/hooks/queries";
import { formatDateTime, formatDuration, formatNumber, relativeTime, shortId } from "@/lib/format";
import { cn } from "@/lib/utils";
import { fetchBlobUrl } from "@/lib/api";
import { csvPath } from "@/services/calls";
import type { CallFilters } from "@/types/call";
import { CallDetailSheet, Rating } from "./CallDetailSheet";
import { CallStatusBadge, CallTypeLabel } from "./CallStatusBadge";

const ranges = [
  { value: "1", label: "Today" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

// Statuses a stored call can have (queued / ringing / in progress are only live states).
const historyStatuses: CallStatus[] = ["completed", "no-answer", "busy", "failed", "canceled"];

type SortField = NonNullable<CallFilters["sort"]>["field"];

export function CallsPage() {
  const [params, setParams] = useSearchParams();
  const { data: agents = [] } = useAgents();
  const [downloading, setDownloading] = useState(false);

  const get = (k: string) => params.get(k) ?? undefined;
  const range = get("range") ?? "30";
  const page = Number(get("page") ?? 1);
  const pageSize = Number(get("size") ?? app.defaultPageSize);
  const sortField = (get("sort") as SortField) ?? "startedAt";
  const sortDir = (get("dir") as "asc" | "desc") ?? "desc";
  const searchBy = get("by") ?? "id";

  const base = useMemo(() => {
    const from = range === "all" ? undefined : new Date(Date.now() - Number(range) * 86_400_000).toISOString();
    return {
      agentId: get("agent"),
      status: get("status") as CallStatus | undefined,
      type: get("type") as CallType | undefined,
      voicemail: get("voicemail") as CallFilters["voicemail"],
      provider: get("provider"),
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

  const hasFilters = ["agent", "status", "type", "voicemail", "provider", "q"].some((k) => params.has(k));
  const total = calls.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const s = stats.data;
  const showAgent = !get("agent");

  const sortHeader = (field: SortField, label: string) => (
    <button
      className="inline-flex items-center gap-1 uppercase hover:text-heading"
      onClick={() => set({ sort: field, dir: sortField === field && sortDir === "desc" ? "asc" : "desc" }, false)}
    >
      {label}
      {sortField === field && (sortDir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
    </button>
  );

  return (
    <>
      <PageHeader title="Agent Conversations" />

      {/* Agent + date range */}
      <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:max-w-2xl">
        <Select
          aria-label="Agent"
          value={get("agent") ?? "all-agents"}
          onValueChange={(v) => set({ agent: v })}
          options={[{ value: "all-agents", label: "All agents" }, ...agents.map((a) => ({ value: a.id, label: a.name }))]}
        />
        <Select aria-label="Date range" value={range} onValueChange={(v) => set({ range: v === "30" ? undefined : v })} options={ranges} />
      </div>

      {/* Stats (cost is not shown: no real cost data reaches this stack) */}
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatTile icon={PhoneCall} label="TOTAL EXECUTIONS" loading={!s} value={s && formatNumber(s.total)} sub="All call attempts" />
        <StatTile icon={Clock} label="TOTAL DURATION" loading={!s} value={s && formatDuration(s.totalDurationSeconds)} sub="Talk time" />
        <StatTile icon={BarChart3} label="AVG DURATION" loading={!s} value={s && formatDuration(s.avgDurationSeconds)} sub="per call" />
      </div>

      {/* Status / Call type / Voice mail / Provider */}
      <div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-4 lg:max-w-4xl">
        <Select
          aria-label="Status"
          placeholder="Status"
          value={get("status") ?? ""}
          onValueChange={(v) => set({ status: v })}
          options={[{ value: "any", label: "All statuses" }, ...historyStatuses.map((k) => ({ value: k, label: callStatuses[k].label }))]}
        />
        <Select
          aria-label="Call type"
          placeholder="Call type"
          value={get("type") ?? ""}
          onValueChange={(v) => set({ type: v })}
          options={[{ value: "any", label: "All call types" }, ...Object.entries(callTypes).map(([k, v]) => ({ value: k, label: v.label }))]}
        />
        <Select
          aria-label="Voice mail"
          placeholder="Voice mail"
          value={get("voicemail") ?? ""}
          onValueChange={(v) => set({ voicemail: v })}
          options={[
            { value: "any", label: "All calls" },
            { value: "yes", label: "Voicemail detected" },
            { value: "no", label: "No voicemail" },
          ]}
        />
        <Select
          aria-label="Provider"
          placeholder="Provider"
          value={get("provider") ?? ""}
          onValueChange={(v) => set({ provider: v })}
          options={[{ value: "any", label: "All providers" }, ...Object.entries(callProviders).map(([k, v]) => ({ value: k, label: v }))]}
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-soft">
        <div className="flex flex-col gap-3 border-b p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2">
            <Select
              size="sm"
              className="w-40"
              aria-label="Search by"
              value={searchBy}
              onValueChange={(v) => set({ by: v === "id" ? undefined : v }, false)}
              options={[
                { value: "id", label: "Execution ID" },
                { value: "number", label: "User Number" },
              ]}
            />
            <Input
              icon={<Search />}
              placeholder={searchBy === "number" ? "Search user number" : "Search execution ID"}
              defaultValue={get("q")}
              key={get("q") ?? ""}
              onKeyDown={(e) => e.key === "Enter" && set({ q: (e.target as HTMLInputElement).value.trim() })}
              onBlur={(e) => e.target.value.trim() !== (get("q") ?? "") && set({ q: e.target.value.trim() })}
              className="lg:w-72"
            />
            {hasFilters && (
              <Button variant="ghost" onClick={() => setParams(new URLSearchParams(range !== "30" ? { range } : {}), { replace: true })}>
                <X /> Clear
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Tooltip content="Refresh">
              <Button
                variant="secondary"
                size="icon"
                onClick={() => {
                  void calls.refetch();
                  void stats.refetch();
                }}
                aria-label="Refresh"
              >
                <RefreshCw className={cn(calls.isFetching && "animate-spin")} />
              </Button>
            </Tooltip>
            <Button
              variant="secondary"
              loading={downloading}
              onClick={async () => {
                // Fetched with the login token, then saved; a plain link couldn't send it.
                setDownloading(true);
                try {
                  const url = await fetchBlobUrl(csvPath(base));
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `call-history-${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 10_000);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Could not download records");
                } finally {
                  setDownloading(false);
                }
              }}
            >
              <Download /> Download Records
            </Button>
          </div>
        </div>

        {calls.isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : calls.error ? (
          <p className="px-4 py-12 text-center text-sm text-danger">
            {calls.error instanceof Error ? calls.error.message : "Could not load calls."}
          </p>
        ) : total === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-heading">No records found</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Execution ID</Th>
                {showAgent && <Th>Agent</Th>}
                <Th>User Number</Th>
                <Th>Call Type</Th>
                <Th>{sortHeader("durationSeconds", "Duration")}</Th>
                <Th>Hangup By</Th>
                <Th>Termination Reason</Th>
                <Th>{sortHeader("startedAt", "Initiated At")}</Th>
                <Th>Status</Th>
                <Th>Conversation Data</Th>
                <Th>Rating</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className={cn(calls.isFetching && "opacity-60 transition-opacity")}>
              {calls.data!.items.map((c) => {
                const open = () => set({ call: c.id }, false);
                const data = [c.summary && "Summary", c.extracted && Object.keys(c.extracted).length && `${Object.keys(c.extracted).length} fields`].filter(Boolean);
                return (
                  <tr
                    key={c.id}
                    tabIndex={0}
                    onClick={open}
                    onKeyDown={(e) => e.key === "Enter" && open()}
                    className={cn("cursor-pointer transition-colors hover:bg-primary-soft/40 focus:bg-primary-soft/40 focus:outline-none", callId === c.id && "bg-primary-soft/60")}
                  >
                    <Td className="font-mono text-xs text-muted-foreground">{shortId(c.id, 8)}</Td>
                    {showAgent && (
                      <Td className="max-w-[180px] truncate font-medium" title={c.agentName}>
                        {c.agentName}
                      </Td>
                    )}
                    <Td className="tabular-nums">{c.userNumber ?? "–"}</Td>
                    <Td>
                      <CallTypeLabel type={c.type} />
                    </Td>
                    <Td className="tabular-nums">{c.durationSeconds ? formatDuration(c.durationSeconds) : "–"}</Td>
                    <Td className="text-muted-foreground">{c.hangupBy ? hangupBy[c.hangupBy] : "–"}</Td>
                    <Td className="max-w-[180px] truncate text-muted-foreground">
                      {c.terminationReason ? (terminationReasons[c.terminationReason] ?? c.terminationReason) : "–"}
                    </Td>
                    <Td>
                      <Tooltip content={formatDateTime(c.startedAt)}>
                        <span className="whitespace-nowrap text-muted-foreground">{relativeTime(c.startedAt)}</span>
                      </Tooltip>
                    </Td>
                    <Td>
                      <CallStatusBadge status={c.status} />
                    </Td>
                    <Td className="text-xs text-muted-foreground">{data.length ? data.join(" · ") : "–"}</Td>
                    <Td>
                      <Rating call={c} size="sm" />
                    </Td>
                    <Td className="text-right">
                      <Tooltip content="View conversation">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="View conversation"
                          onClick={(e) => {
                            e.stopPropagation();
                            open();
                          }}
                        >
                          <Eye />
                        </Button>
                      </Tooltip>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}

        <div className="flex flex-col items-center justify-end gap-4 border-t px-4 py-3 text-sm sm:flex-row">
          <div className="flex items-center gap-2 text-heading">
            Rows per page
            <Select
              size="sm"
              className="w-20"
              value={String(pageSize)}
              onValueChange={(v) => set({ size: v })}
              options={app.pageSizes.map((n) => ({ value: String(n), label: String(n) }))}
            />
          </div>
          <span className="text-heading">
            Page {formatNumber(Math.min(page, pages))} of {formatNumber(pages)}
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

      <CallDetailSheet callId={callId} onClose={() => set({ call: undefined }, false)} />
    </>
  );
}
