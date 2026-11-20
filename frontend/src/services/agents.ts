/**
 * Agents service. Mock implementation over src/mocks/agents.ts.
 *
 * Backend integration (bolna-app):
 *   listAgents     -> GET    /api/bolna/all              (then fromBolna + summarize)
 *   getAgent       -> GET    /api/bolna/agent/{id}
 *   createAgent    -> POST   /api/bolna/agent            body: toBolna(form)
 *   saveAgent      -> PUT    /api/bolna/agent/{id}       body: toBolna(form, original)
 *   deleteAgent    -> DELETE /api/bolna/agent/{id}
 */
import { newAgentForm } from "@/config/agent";
import { ensureLayout } from "@/features/graph/graphUtils";
import { fromBolna, summarize, toBolna } from "@/lib/agentMapper";
import { agentStore } from "@/mocks/agents";
import counsellor from "@/mocks/fixtures/hospital-counsellor.json";
import noShowV4 from "@/mocks/fixtures/no-show-v4.json";
import type { AgentForm, AgentKind, AgentSummary, BolnaAgentPayload } from "@/types/agent";
import { delay, newId, NotFoundError } from "./mock";

export async function listAgents(kind?: AgentKind): Promise<AgentSummary[]> {
  await delay();
  return [...agentStore.values()]
    .map(({ form }) => summarize(form))
    .filter((a) => !kind || a.kind === kind)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getAgent(id: string): Promise<AgentForm> {
  await delay();
  const entry = agentStore.get(id);
  if (!entry) throw new NotFoundError("Agent");
  ensureLayout(entry.form);
  return structuredClone(entry.form);
}

/** The raw Bolna JSON as it would be stored (for the "Advanced JSON" view). */
export async function getAgentJson(form: AgentForm): Promise<BolnaAgentPayload> {
  return toBolna(form, agentStore.get(form.id)?.payload);
}

const templatePayloads: Record<string, BolnaAgentPayload> = {
  counsellor: counsellor as BolnaAgentPayload,
  "no-show": noShowV4 as BolnaAgentPayload,
};

export async function createAgent(input: { templateId: string; name: string }): Promise<AgentForm> {
  await delay();
  const id = newId();
  const now = new Date().toISOString();
  const template = templatePayloads[input.templateId];
  const form = template
    ? fromBolna(template, { id, createdAt: now, updatedAt: now })
    : newAgentForm(input.templateId === "blank-graph" ? "graph" : "simple", input.name);
  form.id = id;
  form.name = input.name;
  form.createdAt = now;
  form.updatedAt = now;
  ensureLayout(form);
  agentStore.set(id, { form, payload: toBolna(form, template) });
  return structuredClone(form);
}

export async function saveAgent(form: AgentForm): Promise<AgentForm> {
  await delay();
  const entry = agentStore.get(form.id);
  if (!entry) throw new NotFoundError("Agent");
  const saved = { ...structuredClone(form), updatedAt: new Date().toISOString() };
  agentStore.set(form.id, { form: saved, payload: toBolna(saved, entry.payload) });
  return structuredClone(saved);
}

export async function duplicateAgent(id: string): Promise<AgentForm> {
  const source = await getAgent(id);
  return createAgentFromForm({ ...source, name: `${source.name} (copy)` });
}

async function createAgentFromForm(form: AgentForm): Promise<AgentForm> {
  const id = newId();
  const now = new Date().toISOString();
  const copy = { ...structuredClone(form), id, createdAt: now, updatedAt: now };
  agentStore.set(id, { form: copy, payload: toBolna(copy) });
  return structuredClone(copy);
}

export async function importAgent(payload: BolnaAgentPayload): Promise<AgentForm> {
  const now = new Date().toISOString();
  return createAgentFromForm(fromBolna(payload, { id: "", createdAt: now, updatedAt: now }));
}

export async function deleteAgent(id: string): Promise<void> {
  await delay();
  agentStore.delete(id);
}
