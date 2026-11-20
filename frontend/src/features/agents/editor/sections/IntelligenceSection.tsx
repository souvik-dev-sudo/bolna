import { BookOpenText, BrainCircuit, Check, ChevronsUpDown, SlidersHorizontal, X } from "lucide-react";
import { Field, PendingNote, SectionCard, SliderField } from "@/components/form/fields";
import { ProviderIcon } from "@/components/ProviderIcon";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";
import { Select } from "@/components/ui/select";
import { limits } from "@/config/agent";
import { findLlmProvider, llmProviders } from "@/config/providers";
import { useKnowledgeBases } from "@/hooks/queries";
import { cn } from "@/lib/utils";
import { useDraft } from "../useAgentDraft";

export function providerOptions(list: { id: string; label: string; configured: boolean }[]) {
  return list.map((p) => ({
    value: p.id,
    label: (
      <span className="flex items-center gap-2">
        <ProviderIcon id={p.id} /> {p.label}
      </span>
    ),
    hint: p.configured ? undefined : "No key",
    disabled: !p.configured,
  }));
}

export function modelOptions(models: { id: string; label: string; note?: string }[]) {
  return models.map((m) => ({ value: m.id, label: m.label, hint: m.note }));
}

function KnowledgeBasePicker() {
  const { draft, patch } = useDraft();
  const { data: kbs = [] } = useKnowledgeBases();
  const selected = kbs.filter((k) => draft.knowledgeBaseIds.includes(k.id));
  const toggle = (id: string) =>
    patch((d) => {
      d.knowledgeBaseIds = d.knowledgeBaseIds.includes(id) ? d.knowledgeBaseIds.filter((x) => x !== id) : [...d.knowledgeBaseIds, id];
    });

  return (
    <div className="flex flex-col gap-3">
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex h-9 w-full items-center justify-between rounded-md border bg-card px-3 text-left text-sm text-placeholder hover:border-border-strong @xl:w-1/2">
            {selected.length ? `${selected.length} selected` : "Select knowledge bases…"}
            <ChevronsUpDown className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-1">
          {kbs.filter((k) => k.status === "processed").map((k) => {
            const on = draft.knowledgeBaseIds.includes(k.id);
            return (
              <button
                key={k.id}
                onClick={() => toggle(k.id)}
                className={cn("flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm hover:bg-primary-soft", on && "text-primary-hover")}
              >
                <span className={cn("flex h-4 w-4 items-center justify-center rounded-[5px] border", on && "border-primary bg-primary text-white")}>
                  {on && <Check className="h-3 w-3" />}
                </span>
                <span className="truncate">{k.name}</span>
              </button>
            );
          })}
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((k) => (
            <Badge key={k.id} tone="info" className="pr-1">
              {k.name}
              <button onClick={() => toggle(k.id)} className="rounded-full p-0.5 hover:bg-primary-border" aria-label={`Remove ${k.name}`}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <PendingNote>Answers from documents need our RAG service, which isn't connected yet (tracker §5).</PendingNote>
    </div>
  );
}

export function IntelligenceSection() {
  const { draft, patch } = useDraft();
  const provider = findLlmProvider(draft.llm.provider);

  return (
    <div className="flex flex-col gap-5">
      <SectionCard icon={BrainCircuit} title="Language model" description="The model that decides what the agent says.">
        <div className="grid gap-4 @xl:grid-cols-2">
          <Field label="Provider">
            <Select
              value={draft.llm.provider}
              options={providerOptions(llmProviders)}
              onValueChange={(v) =>
                patch((d) => {
                  d.llm.provider = v;
                  d.llm.model = findLlmProvider(v)?.models[0]?.id ?? "";
                })
              }
            />
          </Field>
          <Field label="Model">
            <Select
              value={draft.llm.model}
              options={modelOptions(provider?.models ?? [])}
              onValueChange={(v) => patch((d) => void (d.llm.model = v))}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard icon={SlidersHorizontal} title="Model parameters">
        <div className="grid gap-6 @xl:grid-cols-2">
          <SliderField
            label="Max tokens per reply"
            info="Caps reply length. Voice replies should be short; 150–300 is typical."
            value={draft.llm.maxTokens}
            onChange={(v) => patch((d) => void (d.llm.maxTokens = v))}
            {...limits.maxTokens}
          />
          <SliderField
            label="Temperature"
            info="Lower is more predictable; higher is more varied. 0.2–0.4 suits most calls."
            value={draft.llm.temperature}
            onChange={(v) => patch((d) => void (d.llm.temperature = Number(v.toFixed(2))))}
            {...limits.temperature}
          />
        </div>
      </SectionCard>

      <SectionCard icon={BookOpenText} title="Knowledge base" description="Documents the agent can look up during a call.">
        <KnowledgeBasePicker />
      </SectionCard>
    </div>
  );
}
