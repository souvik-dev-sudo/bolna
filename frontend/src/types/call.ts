import type { CallStatus, CallType, HangupBy } from "@/config/calls";

export interface TranscriptTurn {
  role: "agent" | "user" | "system";
  text: string;
  /** Seconds from call start. */
  at: number;
  language?: string;
  node?: string; // graph agents
}

export interface TurnLatency {
  turn: number;
  transcriberMs: number;
  llmMs: number;
  synthesizerMs: number;
  totalMs: number;
}

export interface CallRecord {
  id: string; // Bolna run_id ("execution ID")
  callSid?: string; // Plivo CallUUID
  agentId: string;
  agentName: string;
  type: CallType;
  status: CallStatus;
  userNumber: string;
  fromNumber?: string;
  provider: string;
  startedAt: string;
  durationSeconds: number;
  hangupBy?: HangupBy;
  terminationReason?: string;
  costUsd: number;
  recordingUrl?: string;
  transcript: TranscriptTurn[];
  latencies: TurnLatency[];
  summary?: string;
  extracted?: Record<string, string>;
  rating?: number;
  languages: string[];
}

export interface CallFilters {
  agentId?: string;
  status?: CallStatus;
  type?: CallType;
  provider?: string;
  from?: string; // ISO date
  to?: string;
  search?: string;
  page: number;
  pageSize: number;
  sort?: { field: "startedAt" | "durationSeconds" | "costUsd"; dir: "asc" | "desc" };
}

export interface CallStats {
  total: number;
  completed: number;
  totalDurationSeconds: number;
  avgDurationSeconds: number;
  totalCostUsd: number;
  avgCostUsd: number;
  avgLatencyMs: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
