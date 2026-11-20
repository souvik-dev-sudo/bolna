/**
 * Test calls from the dashboard.
 *
 *   placeTestCall  -> POST /api/telephony/call   { agent_id, recipient_phone_number, user_data }  -> { ref }
 *   getTrackedCall -> GET  /api/bolna/calls/{ref}  state + the stored result once completed
 *
 * The ref follows the call: plivo-app registers it with bolna-app, the Plivo stream carries it to
 * the agent (whose prompt gets user_data as its {variables}), and the result row is stored with it.
 * Web call (A9.3) and Chat (A9.4) are skipped for now.
 */
import { bolnaApi, telephonyApi } from "@/lib/api";
import { extractVariables } from "@/lib/format";
import type { AgentForm } from "@/types/agent";

export type TrackedCallState = "ringing" | "live" | "processing" | "completed" | "busy" | "no-answer" | "timeout" | "failed" | "canceled" | "cancel";

export interface TrackedCallResult {
  run_id: string;
  call_sid: string | null;
  conversation_time: number | null;
  transcript: { role: "user" | "assistant"; content: string }[];
  summary: string | null;
  extracted_data: Record<string, unknown> | null;
  hangup_reason: string | null;
  recording_url: string | null;
  webhook_url: string | null;
  webhook_status: number | null;
  webhook_error: string | null;
}

export interface TrackedCall {
  ref: string;
  agent_id: string;
  phone: string | null;
  state: TrackedCallState;
  created_at: string;
  started_at?: string;
  ended_at?: string;
  hangup_cause?: string;
  error?: string;
  result: TrackedCallResult | null;
}

/** States after which nothing changes any more. */
export const finalStates: TrackedCallState[] = ["completed", "busy", "no-answer", "timeout", "failed", "canceled", "cancel"];

export async function placeTestCall(agentId: string, phone: string, userData: Record<string, string>): Promise<{ ref: string }> {
  const digits = phone.replace(/[\s()+-]/g, "");
  if (!/^\d{10,15}$/.test(digits)) throw new Error("Enter the number with country code, e.g. +91 98765 43210");
  return telephonyApi.post("/call", { agent_id: agentId, recipient_phone_number: digits, user_data: userData });
}

export async function getTrackedCall(ref: string): Promise<TrackedCall> {
  return bolnaApi.get(`/calls/${encodeURIComponent(ref)}`);
}

/** Identifiers the server fills itself; never asked for. */
const SERVER_VARIABLES = new Set(["call_sid", "stream_sid"]);

/** The {variables} the call's texts use: welcome, prompts, final and user-online messages, graph nodes. */
export function agentVariables(agent: AgentForm): string[] {
  const texts = [
    ...Object.values(agent.welcomeMessage),
    ...Object.values(agent.prompts),
    ...Object.values(agent.engine.finalMessage),
    ...Object.values(agent.engine.userOnline.message),
  ];
  if (agent.graph) {
    texts.push(agent.graph.agentInformation, agent.graph.routingInstructions);
    for (const node of agent.graph.nodes) texts.push(node.prompt, ...Object.values(node.staticMessage));
  }
  return extractVariables(texts.filter(Boolean).join("\n")).filter((v) => !SERVER_VARIABLES.has(v));
}
