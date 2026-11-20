/**
 * Calls service. Mock implementation over src/mocks/calls.ts.
 *
 * Backend integration (to build, tracker §4): bolna-app + Postgres `calls` table
 *   listCalls     -> GET /api/bolna/calls?agent_id=&status=&type=&from=&to=&q=&page=&page_size=&sort=
 *   getCall       -> GET /api/bolna/calls/{id}
 *   callStats     -> GET /api/bolna/calls/stats?<same filters>
 *   callsPerDay   -> GET /api/bolna/calls/timeseries?days=
 */
import { callStatuses, callTypes, hangupBy, terminationReasons } from "@/config/calls";
import { callStore } from "@/mocks/calls";
import type { CallFilters, CallRecord, CallStats, Page } from "@/types/call";
import { delay, NotFoundError } from "./mock";

function applyFilters(calls: CallRecord[], f: Omit<CallFilters, "page" | "pageSize">) {
  const q = f.search?.trim().toLowerCase();
  return calls.filter((c) => {
    if (f.agentId && c.agentId !== f.agentId) return false;
    if (f.status && c.status !== f.status) return false;
    if (f.type && c.type !== f.type) return false;
    if (f.provider && c.provider !== f.provider) return false;
    if (f.from && c.startedAt < f.from) return false;
    if (f.to && c.startedAt > f.to) return false;
    if (q && !(c.id.includes(q) || c.userNumber.replace(/\s/g, "").includes(q.replace(/\s/g, "")) || c.callSid?.includes(q)))
      return false;
    return true;
  });
}

export async function listCalls(filters: CallFilters): Promise<Page<CallRecord>> {
  await delay();
  let rows = applyFilters(callStore, filters);
  if (filters.sort) {
    const { field, dir } = filters.sort;
    rows = [...rows].sort((a, b) => {
      const av = a[field];
      const bv = b[field];
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return dir === "asc" ? cmp : -cmp;
    });
  }
  const start = (filters.page - 1) * filters.pageSize;
  return { items: rows.slice(start, start + filters.pageSize), total: rows.length, page: filters.page, pageSize: filters.pageSize };
}

export async function getCall(id: string): Promise<CallRecord> {
  await delay(200);
  const call = callStore.find((c) => c.id === id);
  if (!call) throw new NotFoundError("Call");
  return call;
}

export async function callStats(filters: Omit<CallFilters, "page" | "pageSize">): Promise<CallStats> {
  await delay();
  const rows = applyFilters(callStore, filters);
  const completed = rows.filter((c) => c.status === "completed");
  const totalDurationSeconds = rows.reduce((s, c) => s + c.durationSeconds, 0);
  const totalCostUsd = rows.reduce((s, c) => s + c.costUsd, 0);
  const latencies = rows.flatMap((c) => c.latencies.map((l) => l.totalMs));
  return {
    total: rows.length,
    completed: completed.length,
    totalDurationSeconds,
    avgDurationSeconds: completed.length ? totalDurationSeconds / completed.length : 0,
    totalCostUsd,
    avgCostUsd: rows.length ? totalCostUsd / rows.length : 0,
    avgLatencyMs: latencies.length ? latencies.reduce((s, v) => s + v, 0) / latencies.length : 0,
  };
}

export interface DayBucket {
  date: string; // YYYY-MM-DD
  total: number;
  completed: number;
}

export async function callsPerDay(days = 14, agentId?: string): Promise<DayBucket[]> {
  await delay();
  const buckets = new Map<string, DayBucket>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, { date: key, total: 0, completed: 0 });
  }
  for (const c of callStore) {
    if (agentId && c.agentId !== agentId) continue;
    const b = buckets.get(c.startedAt.slice(0, 10));
    if (!b) continue;
    b.total += 1;
    if (c.status === "completed") b.completed += 1;
  }
  return [...buckets.values()];
}

export async function exportCallsCsv(filters: Omit<CallFilters, "page" | "pageSize">): Promise<string> {
  const rows = applyFilters(callStore, filters);
  const header = [
    "execution_id",
    "agent",
    "user_number",
    "call_type",
    "status",
    "started_at",
    "duration_s",
    "hangup_by",
    "termination_reason",
    "cost_usd",
    "summary",
  ];
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((c) =>
    [
      c.id,
      c.agentName,
      c.userNumber,
      callTypes[c.type].label,
      callStatuses[c.status].label,
      c.startedAt,
      c.durationSeconds,
      c.hangupBy ? hangupBy[c.hangupBy] : "",
      c.terminationReason ? (terminationReasons[c.terminationReason] ?? c.terminationReason) : "",
      c.costUsd.toFixed(4),
      c.summary ?? "",
    ]
      .map(escape)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}
