import {
  ArrowDownLeft,
  ArrowUpRight,
  Ban,
  CheckCircle2,
  Clock,
  Globe,
  Loader2,
  PhoneMissed,
  PhoneOff,
  Voicemail,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { Tone } from "@/theme/theme";

export type CallStatus = "queued" | "ringing" | "in-progress" | "completed" | "no-answer" | "busy" | "failed" | "canceled";
export type CallType = "outbound" | "inbound" | "web";
export type HangupBy = "agent" | "user" | "system";

export const callStatuses: Record<CallStatus, { label: string; tone: Tone; icon: LucideIcon }> = {
  queued: { label: "Queued", tone: "neutral", icon: Clock },
  ringing: { label: "Ringing", tone: "info", icon: Loader2 },
  "in-progress": { label: "In progress", tone: "info", icon: Loader2 },
  completed: { label: "Completed", tone: "success", icon: CheckCircle2 },
  "no-answer": { label: "No answer", tone: "warning", icon: PhoneMissed },
  busy: { label: "Busy", tone: "warning", icon: PhoneOff },
  failed: { label: "Failed", tone: "danger", icon: XCircle },
  canceled: { label: "Canceled", tone: "neutral", icon: Ban },
};

export const callTypes: Record<CallType, { label: string; icon: LucideIcon }> = {
  outbound: { label: "Outbound", icon: ArrowUpRight },
  inbound: { label: "Inbound", icon: ArrowDownLeft },
  web: { label: "Web call", icon: Globe },
};

export const hangupBy: Record<HangupBy, string> = {
  agent: "Agent",
  user: "Caller",
  system: "System",
};

/** Termination reasons stored by bolna-app (the engine's HangupReason, plus the unanswered states). */
export const terminationReasons: Record<string, string> = {
  user_hangup: "Caller hung up",
  llm_prompted_hangup: "Agent ended the call",
  end_call_tool: "Agent ended the call",
  inactivity_timeout: "Caller went silent",
  max_duration_reached: "Call time limit reached",
  web_call_max_duration_reached: "Call time limit reached",
  voicemail_detected: "Voicemail detected",
  transferred: "Transferred to a human",
  client_disconnected: "Line disconnected",
  transcriber_error: "Transcriber error",
  transcriber_connection_error: "Transcriber error",
  synthesizer_error: "Voice error",
  llm_error: "LLM error",
  no_answer: "Not answered",
  busy: "Line busy",
  canceled: "Canceled",
  error: "Error",
};

/** Telephony providers that can appear in Call History. */
export const callProviders: Record<string, string> = { plivo: "Plivo" };

export const voicemailIcon = Voicemail;
