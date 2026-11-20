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

/** Bolna's hangup reasons, with readable labels. */
export const terminationReasons: Record<string, string> = {
  user_hangup: "Caller hung up",
  llm_prompted_hangup: "Agent ended the call",
  silence_timeout: "Caller went silent",
  call_timeout: "Call time limit reached",
  voicemail_detected: "Voicemail detected",
  transferred: "Transferred to a human",
  no_answer: "Not answered",
  busy: "Line busy",
  error: "Error",
};

export const voicemailIcon = Voicemail;
