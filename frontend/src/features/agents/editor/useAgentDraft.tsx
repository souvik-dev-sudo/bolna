import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useAgent, useSaveAgent } from "@/hooks/queries";
import type { AgentForm } from "@/types/agent";

export interface AgentDraft {
  draft: AgentForm;
  saved: AgentForm;
  dirty: boolean;
  saving: boolean;
  /** Mutate a copy of the draft: patch(d => { d.llm.model = "x" }) */
  patch: (fn: (d: AgentForm) => void) => void;
  replace: (form: AgentForm) => void;
  discard: () => void;
  save: () => Promise<void>;
}

/** Loads an agent and keeps an editable draft with unsaved-change tracking. */
export function useAgentDraftState(id: string | undefined) {
  const query = useAgent(id);
  const saveMutation = useSaveAgent();
  const [draft, setDraft] = useState<AgentForm | null>(null);

  useEffect(() => {
    if (query.data && (!draft || draft.id !== query.data.id)) setDraft(structuredClone(query.data));
  }, [query.data, draft]);

  const saved = query.data;
  const dirty = useMemo(() => Boolean(draft && saved && JSON.stringify(draft) !== JSON.stringify(saved)), [draft, saved]);

  // Warn before leaving the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const patch = useCallback((fn: (d: AgentForm) => void) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  }, []);

  const save = useCallback(async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast.error("Give the agent a name before saving");
      return;
    }
    try {
      const result = await saveMutation.mutateAsync(draft);
      setDraft(structuredClone(result));
      toast.success("Agent saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }, [draft, saveMutation]);

  const value: AgentDraft | null =
    draft && saved
      ? {
          draft,
          saved,
          dirty,
          saving: saveMutation.isPending,
          patch,
          replace: (form) => setDraft(structuredClone(form)),
          discard: () => setDraft(structuredClone(saved)),
          save,
        }
      : null;

  return { query, value };
}

const AgentDraftContext = createContext<AgentDraft | null>(null);

export function AgentDraftProvider({ value, children }: { value: AgentDraft; children: ReactNode }) {
  return <AgentDraftContext.Provider value={value}>{children}</AgentDraftContext.Provider>;
}

export function useDraft() {
  const ctx = useContext(AgentDraftContext);
  if (!ctx) throw new Error("useDraft must be used inside AgentDraftProvider");
  return ctx;
}
