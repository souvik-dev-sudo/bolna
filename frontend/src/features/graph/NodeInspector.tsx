import { useState } from "react";
import { ArrowRight, Flag, Plus, Trash2 } from "lucide-react";
import { Field, LocalizedText } from "@/components/form/fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Segmented, Switch } from "@/components/ui/controls";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { graphNodes } from "@/theme/theme";
import type { AgentForm, GraphDefinition, GraphNode, GraphNodeType } from "@/types/agent";
import type { GraphIssue } from "./graphUtils";

export function NodeInspector({
  agent,
  node,
  issues,
  mutateGraph,
  onDelete,
}: {
  agent: AgentForm;
  node: GraphNode;
  issues: GraphIssue[];
  mutateGraph: (fn: (g: GraphDefinition) => void) => void;
  onDelete: () => void;
}) {
  const graph = agent.graph!;
  const codes = agent.languages.map((l) => l.code);
  // Keyed by node.id in the parent, so this resets whenever another node is selected or renamed.
  const [idDraft, setIdDraft] = useState(node.id);

  const update = (fn: (n: GraphNode) => void) =>
    mutateGraph((g) => {
      const n = g.nodes.find((x) => x.id === node.id);
      if (n) fn(n);
    });

  const rename = () => {
    const next = idDraft.trim().replace(/\s+/g, "_");
    if (!next || next === node.id || graph.nodes.some((n) => n.id === next)) {
      setIdDraft(node.id);
      return;
    }
    mutateGraph((g) => {
      g.nodes.forEach((n) => {
        if (n.id === node.id) n.id = next;
        n.edges.forEach((e) => {
          if (e.to === node.id) e.to = next;
        });
      });
      if (g.startNodeId === node.id) g.startNodeId = next;
    });
  };

  const others = graph.nodes.filter((n) => n.id !== node.id).map((n) => ({ value: n.id, label: n.id }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {graph.startNodeId === node.id ? (
          <Badge tone="info" icon={Flag}>
            Start node
          </Badge>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => mutateGraph((g) => void (g.startNodeId = node.id))}>
            <Flag /> Set as start
          </Button>
        )}
        <Button variant="danger-ghost" size="sm" className="ml-auto" onClick={onDelete}>
          <Trash2 /> Delete node
        </Button>
      </div>

      {issues.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning">
          {issues.map((i, k) => (
            <li key={k}>• {i.message}</li>
          ))}
        </ul>
      )}

      <Field label="Node ID" info="Referenced by edges and in call transcripts.">
        <Input
          id="node-id"
          className="font-mono"
          value={idDraft}
          onChange={(e) => setIdDraft(e.target.value)}
          onBlur={rename}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
      </Field>

      <Field label="Type">
        <Segmented<GraphNodeType>
          value={node.type}
          onChange={(v) => update((n) => void (n.type = v))}
          options={(["llm", "static", "router"] as const).map((t) => ({ value: t, label: graphNodes[t].label }))}
        />
      </Field>

      {node.type === "static" ? (
        <Field label="Message" info="Spoken word-for-word. Pre-rendered, so it plays instantly.">
          <LocalizedText
            value={node.staticMessage}
            onChange={(v) => update((n) => void (n.staticMessage = v))}
            codes={codes}
            defaultCode={agent.defaultLanguage}
            rows={3}
          />
        </Field>
      ) : node.type === "llm" ? (
        <>
          <Field label="Node prompt" info="Instructions for this step only. Agent information and routing rules apply on top.">
            <Textarea rows={10} value={node.prompt} onChange={(e) => update((n) => void (n.prompt = e.target.value))} className="leading-6" />
          </Field>
          <Field label="Example line" info="A sample of what the agent might say here, per language. Guides tone.">
            <LocalizedText
              value={node.examples}
              onChange={(v) => update((n) => void (n.examples = v))}
              codes={codes}
              defaultCode={agent.defaultLanguage}
              rows={2}
            />
          </Field>
        </>
      ) : (
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">Routers don't speak. They only pick the next node.</p>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Edges ({node.edges.length})</h4>
          <Button
            variant="ghost"
            size="sm"
            disabled={others.length === 0}
            onClick={() =>
              update((n) =>
                n.edges.push({
                  id: `${n.id}->${others[0].value}-${Date.now()}`,
                  to: others[0].value,
                  condition: "",
                  label: "",
                  unconditional: false,
                }),
              )
            }
          >
            <Plus /> Add edge
          </Button>
        </div>
        {node.edges.length === 0 && <p className="text-xs text-muted-foreground">No edges: the call ends after this node.</p>}
        {node.edges.map((edge, i) => (
          <div key={edge.id} className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
              <Select
                size="sm"
                value={edge.to}
                options={others.length ? others : [{ value: edge.to, label: edge.to }]}
                onValueChange={(v) => update((n) => void (n.edges[i].to = v))}
              />
              <Button variant="danger-ghost" size="icon-sm" aria-label="Delete edge" onClick={() => update((n) => void n.edges.splice(i, 1))}>
                <Trash2 />
              </Button>
            </div>
            <label className="flex items-center justify-between text-xs font-medium text-heading">
              Always take this edge
              <Switch checked={edge.unconditional} onCheckedChange={(v) => update((n) => void (n.edges[i].unconditional = v))} />
            </label>
            {!edge.unconditional && (
              <>
                <Input
                  value={edge.label}
                  onChange={(e) => update((n) => void (n.edges[i].label = e.target.value))}
                  placeholder="Short label, e.g. Wrong number"
                  className="h-8 text-xs"
                />
                <Textarea
                  rows={3}
                  value={edge.condition}
                  onChange={(e) => update((n) => void (n.edges[i].condition = e.target.value))}
                  placeholder="When should the call move here? e.g. The caller says this is the wrong number"
                  className="text-xs"
                />
                <Input
                  value={edge.functionName ?? ""}
                  onChange={(e) => update((n) => void (n.edges[i].functionName = e.target.value || undefined))}
                  placeholder="function_name (optional)"
                  className="h-8 font-mono text-xs"
                />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
