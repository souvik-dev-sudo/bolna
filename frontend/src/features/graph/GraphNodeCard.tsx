import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { AlertTriangle, Flag, MessageSquareQuote, PhoneOff, Sparkles, Split, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { graphNodes } from "@/theme/theme";
import type { GraphNode } from "@/types/agent";
import { NODE_HEIGHT, NODE_WIDTH } from "./graphUtils";

export type FlowNodeData = {
  node: GraphNode;
  isStart: boolean;
  isEnd: boolean;
  issue?: string;
  dimmed?: boolean;
};
export type FlowNode = Node<FlowNodeData, "agentNode">;

const icons: Record<string, LucideIcon> = { router: Split, llm: Sparkles, static: MessageSquareQuote, end: PhoneOff };

function preview(n: GraphNode) {
  if (n.type === "static") return Object.values(n.staticMessage)[0] ?? "";
  if (n.type === "router") return n.edges.length === 1 && n.edges[0].unconditional ? `Always → ${n.edges[0].to}` : "Routes by condition";
  return n.prompt;
}

function GraphNodeCardInner({ data, selected }: NodeProps<FlowNode>) {
  const { node, isStart, isEnd, issue, dimmed } = data;
  const style = isEnd ? graphNodes.end : graphNodes[node.type];
  const Icon = icons[isEnd ? "end" : node.type];
  const text = preview(node);

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border bg-card text-left shadow-soft transition-all",
        selected && "shadow-focus ring-2 ring-primary",
        dimmed && "opacity-35",
      )}
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT, borderColor: selected ? undefined : `${style.accent}40` }}
    >
      <Handle type="target" position={Position.Top} className="!h-2.5 !w-2.5 !border-2 !border-white !bg-[#A9B1C6]" />
      <div className="flex items-center gap-2 px-3 py-1.5" style={{ backgroundColor: style.soft }}>
        <Icon className="h-3.5 w-3.5" style={{ color: style.accent }} />
        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: style.accent }}>
          {isEnd && node.type !== "router" ? `${graphNodes[node.type].label} · End` : style.label}
        </span>
        <span className="ml-auto flex items-center gap-1">
          {issue && (
            <span title={issue}>
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            </span>
          )}
          {isStart && (
            <span className="flex items-center gap-1 rounded-pill bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">
              <Flag className="h-2.5 w-2.5" /> Start
            </span>
          )}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 px-3 py-2">
        <p className="truncate font-mono text-[13px] font-semibold text-heading">{node.id}</p>
        <p className="line-clamp-2 text-xs leading-snug text-muted-foreground text-indic">{text || <em className="text-placeholder">Empty</em>}</p>
      </div>
      <div className="flex items-center justify-between border-t px-3 py-1 text-[10px] text-placeholder">
        <span>
          {node.edges.length} {node.edges.length === 1 ? "edge" : "edges"}
        </span>
        {Object.keys(node.staticMessage).length > 1 && <span>{Object.keys(node.staticMessage).join(" · ")}</span>}
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-2.5 !w-2.5 !border-2 !border-white !bg-primary" />
    </div>
  );
}

export const GraphNodeCard = memo(GraphNodeCardInner);
