/**
 * Agents service, backed by bolna-app.
 *
 *   listAgents     -> GET    /api/bolna/all              (then fromBolna + summarize)
 *   getAgent       -> GET    /api/bolna/agent/{id}       { agent_id, agent_config, agent_prompts }
 *   createAgent    -> POST   /api/bolna/agent            body: toBolna(form, template)
 *   saveAgent      -> PUT    /api/bolna/agent/{id}       body: toBolna(form, original)
 *   duplicateAgent -> GET + POST                         (copies the stored JSON as is)
 *   deleteAgent    -> DELETE /api/bolna/agent/{id}
 *   aiEditGraph    -> POST   /api/bolna/agent/graph-ai-edit  { instruction, graph }  (nothing is saved)
 *
 * bolna-app stores created_at / updated_at inside agent_config; they are read into the form and
 * stripped from every payload we send back, since the server owns them.
 */
import { newAgentForm } from "@/config/agent";
import { ensureLayout } from "@/features/graph/graphUtils";
import { bolnaApi } from "@/lib/api";
import { fromBolna, summarize, toBolna } from "@/lib/agentMapper";
import { formProblems } from "@/lib/agentValidation";
import counsellor from "@/mocks/fixtures/hospital-counsellor.json";
import noShowV4 from "@/mocks/fixtures/no-show-v4.json";
import type { AgentForm, AgentKind, AgentSummary, BolnaAgentPayload, GraphDefinition } from "@/types/agent";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

interface StoredAgent {
  agent_id: string;
  agent_config: Json;
  agent_prompts: BolnaAgentPayload["agent_prompts"] | null;
}

interface AgentListResponse {
  agents: { agent_id: string; data: Json }[];
}

const SERVER_FIELDS = ["created_at", "updated_at", "assistant_status"];

/**
 * The last stored payload per agent. Saves merge the form onto it, so config keys the form does
 * not edit (and the mapper does not know) are kept rather than dropped.
 */
const originals = new Map<string, BolnaAgentPayload>();

function stripServerFields(config: Json): Json {
  const copy = { ...config };
  for (const key of SERVER_FIELDS) delete copy[key];
  return copy;
}

function meta(id: string, config: Json) {
  return { id, createdAt: config.created_at ?? undefined, updatedAt: config.updated_at ?? undefined };
}

export async function listAgents(kind?: AgentKind): Promise<AgentSummary[]> {
  const { agents } = await bolnaApi.get<AgentListResponse>("/all");
  const summaries: AgentSummary[] = [];
  for (const { agent_id, data } of agents) {
    try {
      const form = fromBolna({ agent_config: stripServerFields(data), agent_prompts: {} }, meta(agent_id, data));
      summaries.push(summarize(form));
    } catch (e) {
      // One unreadable agent should not hide the rest of the list.
      console.warn(`Skipping agent ${agent_id}: could not read its config`, e);
    }
  }
  return summaries
    .filter((a) => !kind || a.kind === kind)
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
}

export async function getAgent(id: string): Promise<AgentForm> {
  const stored = await bolnaApi.get<StoredAgent>(`/agent/${encodeURIComponent(id)}`);
  const payload: BolnaAgentPayload = {
    agent_config: stripServerFields(stored.agent_config),
    agent_prompts: stored.agent_prompts ?? {},
  };
  originals.set(id, payload);
  const form = fromBolna(payload, meta(id, stored.agent_config));
  ensureLayout(form);
  return form;
}

/** The raw Bolna JSON as it would be stored (for the "Advanced JSON" view and export). */
export async function getAgentJson(form: AgentForm): Promise<BolnaAgentPayload> {
  return toBolna(form, originals.get(form.id));
}

const templatePayloads: Record<string, BolnaAgentPayload> = {
  counsellor: counsellor as BolnaAgentPayload,
  "no-show": noShowV4 as BolnaAgentPayload,
};

async function postAgent(payload: BolnaAgentPayload): Promise<AgentForm> {
  const body = { ...payload, agent_config: stripServerFields(payload.agent_config) };
  const { agent_id } = await bolnaApi.post<{ agent_id: string }>("/agent", body);
  return getAgent(agent_id);
}

export async function createAgent(input: { templateId: string; name: string }): Promise<AgentForm> {
  const template = templatePayloads[input.templateId];
  const form = template
    ? fromBolna(template, { id: "" })
    : newAgentForm(input.templateId === "blank-graph" ? "graph" : "simple", input.name);
  form.name = input.name;
  // New agents start in "requested or auto detected", so a caller answering in another language is
  // understood (templates store a fixed starting language, which reads back as "requested").
  form.languageSwitchMode = "auto";
  ensureLayout(form);
  return postAgent(toBolna(form, template));
}

export async function saveAgent(form: AgentForm): Promise<AgentForm> {
  const problems = formProblems(form);
  if (problems.length) throw new Error(problems[0]);
  if (!originals.has(form.id)) await getAgent(form.id);
  const payload = toBolna(form, originals.get(form.id));
  await bolnaApi.put(`/agent/${encodeURIComponent(form.id)}`, {
    ...payload,
    agent_config: stripServerFields(payload.agent_config),
  });
  return getAgent(form.id);
}

export async function duplicateAgent(id: string): Promise<AgentForm> {
  const source = await getAgent(id);
  const payload = structuredClone(originals.get(id)!);
  payload.agent_config.agent_name = `${source.name} (copy)`;
  return postAgent(payload);
}

/** Fields Bolna's API returns next to the agent's settings; this server assigns its own. */
const API_ONLY_FIELDS = ["id", "agent_id", "agent_status", "created_at", "updated_at", "agent_prompts"];

/**
 * An agent JSON in either shape, as { agent_config, agent_prompts }:
 *   - an export ({ agent_config, agent_prompts }), from this dashboard or Bolna's "Export";
 *   - Bolna's API response (GET api.bolna.ai/v2/agent/{id}), with the settings at the top level.
 */
export function normalizeAgentJson(raw: unknown): BolnaAgentPayload {
  if (!raw || typeof raw !== "object") throw new Error("Not an agent JSON");
  const json = raw as Json;
  if (json.agent_config && typeof json.agent_config === "object") {
    return { agent_config: json.agent_config, agent_prompts: json.agent_prompts ?? {} };
  }
  if (Array.isArray(json.tasks)) {
    const config = Object.fromEntries(Object.entries(json).filter(([k]) => !API_ONLY_FIELDS.includes(k)));
    return { agent_config: config, agent_prompts: json.agent_prompts ?? {} };
  }
  throw new Error("Not an agent JSON (no agent_config or tasks)");
}

export function isGraphPayload(payload: BolnaAgentPayload): boolean {
  const config = payload.agent_config ?? {};
  return (
    config.agent_type === "graph_agent" ||
    (config.tasks ?? []).some((t: Json) => t?.tools_config?.llm_agent?.agent_type === "graph_agent")
  );
}

export async function importAgent(payload: BolnaAgentPayload): Promise<AgentForm> {
  return postAgent({ agent_config: payload.agent_config, agent_prompts: payload.agent_prompts ?? {} });
}

/** AI Edit: bolna-app rewrites the prompt with an LLM (AI_EDIT_MODEL). Nothing is saved. */
export async function aiEditPrompt(prompt: string, instruction: string): Promise<{ prompt: string; model: string }> {
  return bolnaApi.post("/agent/ai-edit", { prompt, instruction });
}

const GRAPH_KEYS = ["agent_information", "routing_instructions", "current_node_id", "nodes"] as const;

/**
 * Magic wand: bolna-app edits the graph with an LLM (AI_EDIT_MODEL) and checks the engine can run it.
 * The graph is sent in Bolna's JSON (with the per-node settings our form doesn't show), and the
 * edited graph comes back the same way; nothing is saved.
 */
export async function aiEditGraph(form: AgentForm, instruction: string): Promise<{ graph: GraphDefinition; model: string }> {
  const payload = toBolna(form, originals.get(form.id));
  const task = (payload.agent_config.tasks ?? []).find((t: Json) => t.task_type === "conversation");
  const llmConfig: Json = task?.tools_config?.llm_agent?.llm_config ?? {};
  const graph = Object.fromEntries(GRAPH_KEYS.map((k) => [k, llmConfig[k]]));
  const res = await bolnaApi.post<{ graph: Json; model: string }>("/agent/graph-ai-edit", { instruction, graph });
  Object.assign(llmConfig, res.graph);
  const edited = ensureLayout(fromBolna(payload, { id: form.id, createdAt: form.createdAt, updatedAt: form.updatedAt }));
  if (!edited.graph) throw new Error("AI Edit returned no graph");
  return { graph: edited.graph, model: res.model };
}

export async function deleteAgent(id: string): Promise<void> {
  await bolnaApi.delete(`/agent/${encodeURIComponent(id)}`);
  originals.delete(id);
}
