import { useState, type ComponentType } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Field, LocalizedText } from "@/components/form/fields";
import { Textarea } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";
import { llmProviders } from "@/config/providers";
import { TestAgentPanel } from "@/features/testing/TestAgentPanel";
import { AgentJsonDialog } from "@/features/agents/editor/AgentJsonDialog";
import { CallingSection } from "@/features/agents/editor/sections/CallingSection";
import { EngineSection } from "@/features/agents/editor/sections/EngineSection";
import { IntelligenceSection } from "@/features/agents/editor/sections/IntelligenceSection";
import { LanguagesSection } from "@/features/agents/editor/sections/LanguagesSection";
import { PostCallSection } from "@/features/agents/editor/sections/PostCallSection";
import { ToolsSection } from "@/features/agents/editor/sections/ToolsSection";
import { useDraft } from "@/features/agents/editor/useAgentDraft";
import type { GraphDefinition } from "@/types/agent";
import type { GraphIssue } from "./graphUtils";
import { NodeInspector } from "./NodeInspector";

const routingModels = llmProviders
  .filter((p) => p.configured)
  .flatMap((p) => p.models.map((m) => ({ value: m.id, label: m.label, hint: p.label })));

function AgentBasics({ mutateGraph }: { mutateGraph: (fn: (g: GraphDefinition) => void) => void }) {
  const { draft, patch } = useDraft();
  const g = draft.graph!;
  const codes = draft.languages.map((l) => l.code);
  return (
    <div className="flex flex-col gap-4">
      <Field label="Welcome message">
        <LocalizedText
          value={draft.welcomeMessage}
          onChange={(v) => patch((d) => void (d.welcomeMessage = v))}
          codes={codes}
          defaultCode={draft.defaultLanguage}
          rows={2}
        />
      </Field>
      <Field label="Agent information" info="Who the agent is and the facts it can use, shared by every node.">
        <Textarea rows={6} value={g.agentInformation} onChange={(e) => patch((d) => void (d.graph!.agentInformation = e.target.value))} />
      </Field>
      <Field label="Routing instructions" info="Rules the router follows when choosing the next node.">
        <Textarea rows={6} value={g.routingInstructions} onChange={(e) => patch((d) => void (d.graph!.routingInstructions = e.target.value))} />
      </Field>
      <div className="grid gap-4 @xl:grid-cols-2">
        <Field label="Routing model" info="A fast model decides transitions while the reply is generated in parallel.">
          <Select value={g.routingModel} options={routingModels} onValueChange={(v) => patch((d) => void (d.graph!.routingModel = v))} />
        </Field>
        <Field label="Start node">
          <Select
            value={g.startNodeId}
            options={g.nodes.map((n) => ({ value: n.id, label: n.id }))}
            onValueChange={(v) => mutateGraph((gr) => void (gr.startNodeId = v))}
          />
        </Field>
      </div>
    </div>
  );
}

type MutateGraph = (fn: (g: GraphDefinition) => void) => void;

/** Agent setup rows, in Bolna's order; Calling and Extractions are ours (they work for graph agents too). */
const setupSections: { id: string; title: string; Component: ComponentType<{ mutateGraph: MutateGraph }> }[] = [
  { id: "basics", title: "Agent Basics", Component: AgentBasics },
  { id: "languages", title: "Languages and Voice", Component: LanguagesSection },
  { id: "llm", title: "LLM", Component: IntelligenceSection },
  { id: "conversation", title: "Conversation Settings", Component: EngineSection },
  { id: "calling", title: "Calling", Component: CallingSection },
  { id: "post-call", title: "Extractions", Component: PostCallSection },
];

function BackHeader({ title, onBack, mono }: { title: string; onBack: () => void; mono?: boolean }) {
  return (
    <button type="button" onClick={onBack} className="mb-4 flex w-full items-center gap-2 text-left text-base font-semibold text-heading hover:text-primary">
      <ArrowLeft className="h-4 w-4 shrink-0" />
      <span className={mono ? "truncate font-mono text-sm" : "truncate"}>{title}</span>
    </button>
  );
}

function SetupRow({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between border-b py-4 text-left text-[15px] text-heading hover:text-primary">
      {title}
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

export function GraphInspector({
  selectedId,
  onCloseNode,
  issues,
  mutateGraph,
  onDeleteNode,
  tab,
  onTabChange,
}: {
  selectedId: string | null;
  onCloseNode: () => void;
  issues: GraphIssue[];
  mutateGraph: MutateGraph;
  onDeleteNode: (id: string) => void;
  tab: string;
  onTabChange: (tab: string) => void;
}) {
  const { draft, dirty } = useDraft();
  const [jsonOpen, setJsonOpen] = useState(false);
  const [section, setSection] = useState<string | null>(null);
  const node = draft.graph?.nodes.find((n) => n.id === selectedId);
  const open = setupSections.find((x) => x.id === section);

  // A clicked node replaces the tabs; the back arrow (or a click on the empty canvas) returns to them.
  if (node) {
    return (
      <div className="h-full overflow-y-auto px-4 py-4 scrollbar-thin @container">
        <BackHeader title={node.id} onBack={onCloseNode} mono />
        <NodeInspector
          key={node.id}
          agent={draft}
          node={node}
          issues={issues.filter((i) => i.nodeId === node.id)}
          mutateGraph={mutateGraph}
          onDelete={() => onDeleteNode(node.id)}
        />
      </div>
    );
  }

  return (
    <Tabs value={tab} onValueChange={onTabChange} className="flex h-full flex-col">
      <div className="px-4 pb-2 pt-4">
        <TabsList className="flex w-full">
          <TabsTrigger value="setup" className="flex-1">
            Agent setup
          </TabsTrigger>
          <TabsTrigger value="tools" className="flex-1">
            Tools
          </TabsTrigger>
          <TabsTrigger value="test" className="flex-1">
            Test agent
          </TabsTrigger>
        </TabsList>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2 scrollbar-thin @container">
        <TabsContent value="setup" className="mt-0">
          {open ? (
            <>
              <BackHeader title={open.title} onBack={() => setSection(null)} />
              <open.Component mutateGraph={mutateGraph} />
            </>
          ) : (
            <div className="flex flex-col">
              {setupSections.map((x) => (
                <SetupRow key={x.id} title={x.title} onClick={() => setSection(x.id)} />
              ))}
              <SetupRow title="Advanced JSON" onClick={() => setJsonOpen(true)} />
            </div>
          )}
          <AgentJsonDialog open={jsonOpen} onOpenChange={setJsonOpen} agent={draft} />
        </TabsContent>
        <TabsContent value="tools" className="mt-0">
          <ToolsSection nodeIds={draft.graph?.nodes.map((n) => n.id)} />
        </TabsContent>
        <TabsContent value="test" className="mt-0">
          <TestAgentPanel agent={draft} dirty={dirty} buttonLabel="Get call from agent" note="Calls the last saved version." />
        </TabsContent>
      </div>
    </Tabs>
  );
}
