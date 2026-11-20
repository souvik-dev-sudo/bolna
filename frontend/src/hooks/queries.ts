// React Query hooks: the only way screens read or write data.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as agents from "@/services/agents";
import * as calls from "@/services/calls";
import * as kb from "@/services/knowledgeBase";
import * as platform from "@/services/platform";
import type { AgentForm, AgentKind } from "@/types/agent";
import type { CallFilters } from "@/types/call";

export const keys = {
  agents: (kind?: AgentKind) => ["agents", kind ?? "all"] as const,
  agent: (id: string) => ["agent", id] as const,
  calls: (f: CallFilters) => ["calls", f] as const,
  call: (id: string) => ["call", id] as const,
  callStats: (f: object) => ["call-stats", f] as const,
  callsPerDay: (days: number, agentId?: string) => ["calls-per-day", days, agentId] as const,
  knowledgeBases: ["knowledge-bases"] as const,
};

// ---- Agents ----------------------------------------------------------------------------------
export const useAgents = (kind?: AgentKind) => useQuery({ queryKey: keys.agents(kind), queryFn: () => agents.listAgents(kind) });

export const useAgent = (id: string | undefined) =>
  useQuery({ queryKey: keys.agent(id ?? ""), queryFn: () => agents.getAgent(id!), enabled: Boolean(id) });

function useInvalidateAgents() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["agents"] });
}

export function useCreateAgent() {
  const invalidate = useInvalidateAgents();
  return useMutation({ mutationFn: agents.createAgent, onSuccess: invalidate });
}

export function useSaveAgent() {
  const qc = useQueryClient();
  const invalidate = useInvalidateAgents();
  return useMutation({
    mutationFn: (form: AgentForm) => agents.saveAgent(form),
    onSuccess: (saved) => {
      qc.setQueryData(keys.agent(saved.id), saved);
      void invalidate();
    },
  });
}

export function useDuplicateAgent() {
  const invalidate = useInvalidateAgents();
  return useMutation({ mutationFn: agents.duplicateAgent, onSuccess: invalidate });
}

export function useImportAgent() {
  const invalidate = useInvalidateAgents();
  return useMutation({ mutationFn: agents.importAgent, onSuccess: invalidate });
}

export function useDeleteAgent() {
  const invalidate = useInvalidateAgents();
  return useMutation({ mutationFn: agents.deleteAgent, onSuccess: invalidate });
}

// ---- Calls -----------------------------------------------------------------------------------
export const useCalls = (filters: CallFilters) =>
  useQuery({ queryKey: keys.calls(filters), queryFn: () => calls.listCalls(filters), placeholderData: keepPreviousData });

export const useCall = (id: string | undefined) =>
  useQuery({ queryKey: keys.call(id ?? ""), queryFn: () => calls.getCall(id!), enabled: Boolean(id) });

export const useCallStats = (filters: Omit<CallFilters, "page" | "pageSize">) =>
  useQuery({ queryKey: keys.callStats(filters), queryFn: () => calls.callStats(filters), placeholderData: keepPreviousData });

export const useCallsPerDay = (days = 14, agentId?: string) =>
  useQuery({ queryKey: keys.callsPerDay(days, agentId), queryFn: () => calls.callsPerDay(days, agentId) });

export function useSetCallRating() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rating }: { id: string; rating: number | null }) => calls.setRating(id, rating),
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: keys.call(id) });
      void qc.invalidateQueries({ queryKey: ["calls"] });
    },
  });
}

// ---- Knowledge base --------------------------------------------------------------------------
export const useKnowledgeBases = () =>
  useQuery({
    queryKey: keys.knowledgeBases,
    queryFn: kb.listKnowledgeBases,
    // Poll while anything is still processing.
    refetchInterval: (q) => (q.state.data?.some((k) => k.status === "processing") ? 2000 : false),
  });

export function useUploadKnowledgeBase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { file?: File; url?: string }) =>
      input.file ? kb.uploadKnowledgeBase(input.file) : kb.addUrlKnowledgeBase(input.url!),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.knowledgeBases }),
  });
}

export function useDeleteKnowledgeBase() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: kb.deleteKnowledgeBase, onSuccess: () => qc.invalidateQueries({ queryKey: keys.knowledgeBases }) });
}

// ---- Platform (live) -------------------------------------------------------------------------
export const useAgentServerHealth = () =>
  useQuery({ queryKey: ["health", "agent-server"], queryFn: platform.checkAgentServer, refetchInterval: 30_000 });
export const useDatabaseHealth = () =>
  useQuery({ queryKey: ["health", "database"], queryFn: platform.checkDatabase, refetchInterval: 30_000 });
