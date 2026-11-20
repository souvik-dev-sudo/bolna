/**
 * Test-call service. Mock implementation.
 *
 * Backend integration:
 *   placeTestCall  -> POST /api/telephony/call  { agent_id, recipient_phone_number }  (returns call id, tracker A9.2)
 *   web call       -> WS   /api/bolna/chat/v1/web/{agent_id}                          (tracker A9.3)
 *   chat           -> WS   /api/bolna/chat/v1/text/{agent_id}                         (tracker A9.4)
 */
import type { AgentForm } from "@/types/agent";
import { delay, newId } from "./mock";

export async function placeTestCall(_agentId: string, phone: string): Promise<{ callId: string; phone: string }> {
  await delay(900);
  if (!/^\+?\d{10,15}$/.test(phone.replace(/[\s-]/g, ""))) {
    throw new Error("Enter the number with country code, e.g. +91 98765 43210");
  }
  return { callId: newId(), phone };
}

const cannedReplies = [
  "Sure, I can help with that. Could you tell me your full name?",
  "Thank you. I can see your appointment details. Would you like to reschedule?",
  "We have slots on Saturday at 10:30 AM or Monday at 4 PM. Which works better?",
  "Done! You'll receive an SMS confirmation shortly. Is there anything else?",
  "Thank you for your time. Have a great day!",
];

/** Simulates the agent replying to a chat message. */
export async function sendChatMessage(agent: AgentForm, turn: number): Promise<string> {
  await delay(700 + Math.random() * 600);
  if (turn === 0) return agent.welcomeMessage[agent.defaultLanguage] || "Hello! How can I help you today?";
  return cannedReplies[Math.min(turn - 1, cannedReplies.length - 1)];
}

/** Lines the simulated web call plays, alternating agent/user. */
export function webCallScript(agent: AgentForm) {
  const welcome = agent.welcomeMessage[agent.defaultLanguage] || "Hello! How can I help you today?";
  return [
    { role: "agent" as const, text: welcome },
    { role: "user" as const, text: "Hi, I missed my appointment last week." },
    { role: "agent" as const, text: "No problem. Would you like me to book a new slot for you this week?" },
    { role: "user" as const, text: "Yes, Saturday morning if possible." },
    { role: "agent" as const, text: "Saturday 10:30 AM is available. Shall I confirm it?" },
  ];
}
