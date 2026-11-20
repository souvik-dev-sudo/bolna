import type { CallStatus, CallType, HangupBy } from "@/config/calls";

export interface TranscriptTurn {
  role: "agent" | "user" | "system";
  text: string;
  /** Seconds from call start, when known (lets the transcript seek the recording). */
  at?: number;
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

/** One row of bolna-app's call_results table (Call History). */
export interface CallRecord {
  id: string; // Bolna run_id ("execution ID"); the call's ref when it never reached the agent
  callSid?: string; // Plivo CallUUID
  agentId: string;
  agentName: string;
  type: CallType;
  status: CallStatus;
  userNumber?: string;
  provider: string;
  startedAt: string;
  durationSeconds: number;
  hangupBy?: HangupBy;
  terminationReason?: string;
  /** Streams the Plivo recording through bolna-app; only completed calls have one. */
  recordingUrl?: string;
  transcript: TranscriptTurn[];
  latencies: TurnLatency[];
  summary?: string;
  extracted?: Record<string, unknown>;
  rating?: number;
  webhook?: { url: string; status?: number; error?: string };
}

export interface CallFilters {
  agentId?: string;
  status?: CallStatus;
  type?: CallType;
  provider?: string;
  /** "yes": only calls that reached voicemail; "no": all others. */
  voicemail?: "yes" | "no";
  from?: string; // ISO date
  to?: string;
  search?: string;
  page: number;
  pageSize: number;
  sort?: { field: "startedAt" | "durationSeconds"; dir: "asc" | "desc" };
}

export interface CallStats {
  total: number;
  completed: number;
  totalDurationSeconds: number;
  avgDurationSeconds: number;
  avgLatencyMs: number;
  byStatus: Partial<Record<CallStatus, number>>;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
