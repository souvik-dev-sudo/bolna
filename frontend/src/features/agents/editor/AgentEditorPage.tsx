import { useState, type ComponentType, type KeyboardEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  BrainCircuit,
  CheckCircle2,
  Cog,
  FileText,
  Languages,
  ListChecks,
  PhoneCall,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { Breadcrumbs } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { Sheet, SheetContent } from "@/components/ui/overlays";
import { useDeleteAgent, useDuplicateAgent } from "@/hooks/queries";
import { downloadText } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getAgentJson } from "@/services/agents";
import { TestAgentPanel } from "@/features/testing/TestAgentPanel";
import type { AgentForm } from "@/types/agent";
import { agentPath } from "../CreateAgentDialog";
import { AgentHeader } from "./AgentHeader";
import { AgentJsonDialog } from "./AgentJsonDialog";
import { SaveBar } from "./SaveBar";
import { CallingSection } from "./sections/CallingSection";
import { EngineSection } from "./sections/EngineSection";
import { IntelligenceSection } from "./sections/IntelligenceSection";
import { LanguagesSection } from "./sections/LanguagesSection";
import { PostCallSection } from "./sections/PostCallSection";
import { PromptSection } from "./sections/PromptSection";
import { ToolsSection } from "./sections/ToolsSection";
import { AgentDraftProvider, useAgentDraftState, useDraft } from "./useAgentDraft";

interface SectionDef {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
  Component: ComponentType;
  /** Returns a short problem description, or null when the section is complete. */
  check?: (a: AgentForm) => string | null;
}

export const sections: SectionDef[] = [
  {
    id: "prompt",
    label: "Agent",
    icon: FileText,
    description: "Greeting, instructions and when to hang up",
    Component: PromptSection,
    check: (a) =>
      !a.welcomeMessage[a.defaultLanguage]?.trim()
        ? "Add a welcome message"
        : a.kind === "simple" && !a.prompts[a.defaultLanguage]?.trim()
          ? "Write the agent prompt"
          : null,
  },
  { id: "intelligence", label: "Intelligence", icon: BrainCircuit, description: "Model and parameters", Component: IntelligenceSection },
  {
    id: "languages",
    label: "Languages",
    icon: Languages,
    description: "Voices and speech recognition per language",
    Component: LanguagesSection,
    check: (a) => (a.languages.some((l) => !l.voice.voiceId) ? "Pick a voice for every language" : null),
  },
  { id: "calling", label: "Calling", icon: PhoneCall, description: "Telephony and call handling", Component: CallingSection },
  { id: "engine", label: "Engine", icon: Cog, description: "Timing, interruptions and limits", Component: EngineSection },
  {
    id: "tools",
    label: "Tools",
    icon: Wrench,
    description: "Functions the agent can call",
    Component: ToolsSection,
  },
  { id: "post-call", label: "Extractions", icon: ListChecks, description: "Webhook, summary and extraction", Component: PostCallSection },
];

/** Section tabs: a vertical list on desktop, a horizontal scrollable row on small screens. */
function SectionTabs({ active, onChange }: { active: string; onChange: (id: string) => void }) {
  const { draft } = useDraft();
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const i = sections.findIndex((s) => s.id === active);
    const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1;
    const next = sections[(i + step + sections.length) % sections.length].id;
    onChange(next);
    document.getElementById(`tab-${next}`)?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label="Agent settings"
      aria-orientation="vertical"
      onKeyDown={onKeyDown}
      className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 scrollbar-thin lg:sticky lg:top-6 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
    >
      {sections.map((s) => {
        const issue = s.check?.(draft);
        const isActive = active === s.id;
        return (
          <button
            key={s.id}
            id={`tab-${s.id}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${s.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(s.id)}
            className={cn(
              // Same font weight in both states, so tab widths never change on selection.
              "flex shrink-0 items-center gap-3 whitespace-nowrap rounded-md px-3 py-2 text-left text-sm font-medium transition-colors",
              isActive
                ? "bg-card text-primary-hover shadow-soft ring-1 ring-primary-border"
                : "text-muted-foreground hover:bg-card/70 hover:text-heading",
            )}
          >
            <s.icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />
            <span className="lg:flex-1">{s.label}</span>
            {s.check &&
              (issue ? (
                <AlertCircle className="h-3.5 w-3.5 text-warning" aria-label={issue} />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-label="Complete" />
              ))}
          </button>
        );
      })}
    </div>
  );
}

function EditorBody() {
  const { draft, dirty } = useDraft();
  const navigate = useNavigate();
  const [testOpen, setTestOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const duplicate = useDuplicateAgent();
  const remove = useDeleteAgent();
  // The open tab lives in the URL (?tab=tools), so a refresh or shared link keeps it.
  const [params, setParams] = useSearchParams();
  const current = sections.find((s) => s.id === params.get("tab")) ?? sections[0];
  const selectTab = (id: string) => {
    const next = new URLSearchParams(params);
    if (id === sections[0].id) next.delete("tab");
    else next.set("tab", id);
    setParams(next, { replace: true });
  };

  return (
    <>
      <div className="mb-4">
        <Breadcrumbs items={[{ label: "Agent Studio", to: "/agents" }, { label: draft.name || "Untitled" }]} />
      </div>
      <AgentHeader
        onTest={() => setTestOpen(true)}
        onJson={() => setJsonOpen(true)}
        onDuplicate={() =>
          duplicate.mutate(draft.id, {
            onSuccess: (copy) => {
              toast.success(`Duplicated as “${copy.name}”`);
              navigate(agentPath(copy.id, copy.kind));
            },
          })
        }
        onExport={async () => downloadText(`${draft.name.replace(/\W+/g, "-").toLowerCase()}.json`, JSON.stringify(await getAgentJson(draft), null, 2))}
        onDelete={() => setDeleteOpen(true)}
      />
      {/* grid-cols-1 + min-w-0: without them the scrollable tab row widens the column past the phone screen. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
        <div className="min-w-0">
          <SectionTabs active={current.id} onChange={selectTab} />
        </div>
        <section
          key={current.id}
          id={`panel-${current.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${current.id}`}
          className="min-w-0 animate-in fade-in-0 duration-200 @container"
        >
          <div className="mb-4">
            <h2 className="text-lg font-semibold">{current.label}</h2>
            <p className="text-sm text-muted-foreground">{current.description}</p>
          </div>
          <current.Component />
          <SaveBar
            extra={
              <Button variant="secondary" onClick={() => setTestOpen(true)}>
                <PhoneCall /> Get a call from agent
              </Button>
            }
          />
        </section>
      </div>

      <Sheet open={testOpen} onOpenChange={setTestOpen}>
        <SheetContent title="Get a call from agent" description={draft.name} className="max-w-md">
          <div className="p-5">
            <TestAgentPanel agent={draft} dirty={dirty} />
          </div>
        </SheetContent>
      </Sheet>
      <AgentJsonDialog open={jsonOpen} onOpenChange={setJsonOpen} agent={draft} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete agent?"
        description={`“${draft.name}” will be deleted. Its call history stays.`}
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(draft.id, {
            onSuccess: () => {
              toast.success("Agent deleted");
              navigate("/agents");
            },
          })
        }
      />
    </>
  );
}

export function AgentEditorPage() {
  const { id } = useParams();
  const { query, value } = useAgentDraftState(id);

  if (query.isError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Agent not found"
        description="It may have been deleted. Go back to the agent list."
      />
    );
  }
  if (!value) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-[210px_1fr]">
          <Skeleton className="hidden h-72 lg:block" />
          <Skeleton className="h-[480px] rounded-xl" />
        </div>
      </div>
    );
  }
  return (
    <AgentDraftProvider value={value}>
      <EditorBody />
    </AgentDraftProvider>
  );
}
