import { useState } from "react";
import { Braces, FlaskConical, MousePointerClick, Settings2, Workflow, Wrench } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Field, LocalizedText } from "@/components/form/fields";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Accordion, AccordionItem, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";
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

export function GraphInspector({
  selectedId,
  issues,
  mutateGraph,
  onDeleteNode,
  tab,
  onTabChange,
}: {
  selectedId: string | null;
  issues: GraphIssue[];
  mutateGraph: (fn: (g: GraphDefinition) => void) => void;
  onDeleteNode: (id: string) => void;
  tab: string;
  onTabChange: (tab: string) => void;
}) {
  const { draft, dirty } = useDraft();
  const [jsonOpen, setJsonOpen] = useState(false);
  const node = draft.graph?.nodes.find((n) => n.id === selectedId);

  return (
    <Tabs value={tab} onValueChange={onTabChange} className="flex h-full flex-col">
      <div className="border-b px-4 pb-3 pt-4">
        <TabsList className="flex w-full">
          <TabsTrigger value="node">
            <Workflow /> Node
          </TabsTrigger>
          <TabsTrigger value="setup">
            <Settings2 /> Setup
          </TabsTrigger>
          <TabsTrigger value="tools">
            <Wrench /> Tools
          </TabsTrigger>
          <TabsTrigger value="test">
            <FlaskConical /> Test
          </TabsTrigger>
        </TabsList>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin @container">
        <TabsContent value="node" className="mt-0">
          {node ? (
            <NodeInspector
              key={node.id}
              agent={draft}
              node={node}
              issues={issues.filter((i) => i.nodeId === node.id)}
              mutateGraph={mutateGraph}
              onDelete={() => onDeleteNode(node.id)}
            />
          ) : (
            <EmptyState
              icon={MousePointerClick}
              title="Select a node"
              description="Click a node on the canvas to edit its prompt, message and edges. Drag from a node's bottom dot to connect it."
              className="border-none shadow-none"
            />
          )}
        </TabsContent>
        <TabsContent value="setup" className="mt-0">
          <Accordion type="multiple" defaultValue={["basics"]}>
            <AccordionItem value="basics" title="Agent basics">
              <AgentBasics mutateGraph={mutateGraph} />
            </AccordionItem>
            <AccordionItem value="languages" title="Languages and voice">
              <LanguagesSection />
            </AccordionItem>
            <AccordionItem value="llm" title="LLM">
              <IntelligenceSection />
            </AccordionItem>
            <AccordionItem value="conversation" title="Conversation settings">
              <EngineSection />
            </AccordionItem>
            <AccordionItem value="calling" title="Calling">
              <CallingSection />
            </AccordionItem>
            <AccordionItem value="post-call" title="Post-call">
              <PostCallSection />
            </AccordionItem>
          </Accordion>
          <Button variant="secondary" className="mt-4 w-full" onClick={() => setJsonOpen(true)}>
            <Braces /> Advanced JSON
          </Button>
          <AgentJsonDialog open={jsonOpen} onOpenChange={setJsonOpen} agent={draft} />
        </TabsContent>
        <TabsContent value="tools" className="mt-0">
          <ToolsSection nodeIds={draft.graph?.nodes.map((n) => n.id)} />
        </TabsContent>
        <TabsContent value="test" className="mt-0">
          <TestAgentPanel agent={draft} dirty={dirty} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
