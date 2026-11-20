import dagre from "@dagrejs/dagre";
import type { AgentForm, GraphDefinition, GraphNode } from "@/types/agent";

export const NODE_WIDTH = 260;
export const NODE_HEIGHT = 118;

/** Top-to-bottom layout with dagre. Returns a position for every node. */
export function autoLayout(graph: GraphDefinition): Record<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 70, ranksep: 110, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));
  graph.nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  graph.nodes.forEach((n) => n.edges.forEach((e) => graph.nodes.some((x) => x.id === e.to) && g.setEdge(n.id, e.to)));
  dagre.layout(g);
  return Object.fromEntries(
    graph.nodes.map((n) => {
      const p = g.node(n.id);
      return [n.id, { x: Math.round(p.x - NODE_WIDTH / 2), y: Math.round(p.y - NODE_HEIGHT / 2) }];
    }),
  );
}

export const isTerminal = (n: GraphNode) => n.edges.length === 0;

export interface GraphIssue {
  nodeId?: string;
  level: "error" | "warning";
  message: string;
}

/** Structural checks run by the ✓ button and shown on the canvas. */
export function validateGraph(graph: GraphDefinition): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const ids = new Set(graph.nodes.map((n) => n.id));
  if (!ids.has(graph.startNodeId)) issues.push({ level: "error", message: `Start node “${graph.startNodeId}” doesn't exist` });

  // Reachability from the start node
  const reached = new Set<string>();
  const queue = ids.has(graph.startNodeId) ? [graph.startNodeId] : [];
  while (queue.length) {
    const id = queue.shift()!;
    if (reached.has(id)) continue;
    reached.add(id);
    graph.nodes.find((n) => n.id === id)?.edges.forEach((e) => queue.push(e.to));
  }

  for (const n of graph.nodes) {
    for (const e of n.edges) {
      if (!ids.has(e.to)) issues.push({ nodeId: n.id, level: "error", message: `${n.id} links to missing node “${e.to}”` });
      if (!e.unconditional && !e.condition.trim()) issues.push({ nodeId: n.id, level: "warning", message: `${n.id} → ${e.to} has no condition` });
    }
    if (!reached.has(n.id) && ids.has(graph.startNodeId)) issues.push({ nodeId: n.id, level: "warning", message: `${n.id} can't be reached from the start` });
    if (n.type === "static" && !Object.values(n.staticMessage).some((t) => t.trim()))
      issues.push({ nodeId: n.id, level: "error", message: `${n.id} is a static node with no message` });
    if (n.type === "llm" && !n.prompt.trim()) issues.push({ nodeId: n.id, level: "warning", message: `${n.id} has an empty prompt` });
    if (n.type === "router" && n.edges.length === 0) issues.push({ nodeId: n.id, level: "error", message: `Router ${n.id} has no outgoing edges` });
  }
  const dupes = graph.nodes.map((n) => n.id).filter((id, i, arr) => arr.indexOf(id) !== i);
  dupes.forEach((id) => issues.push({ nodeId: id, level: "error", message: `Duplicate node ID “${id}”` }));
  return issues;
}

/** A node ID not already used, e.g. "New_node_2". */
export function uniqueNodeId(graph: GraphDefinition, base = "New_node") {
  const ids = new Set(graph.nodes.map((n) => n.id));
  if (!ids.has(base)) return base;
  let i = 2;
  while (ids.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

/** Gives every graph node a position (Bolna JSON stores none), so a freshly loaded agent isn't "unsaved". */
export function ensureLayout(form: AgentForm): AgentForm {
  if (!form.graph || form.graph.nodes.every((n) => n.position)) return form;
  const pos = autoLayout(form.graph);
  form.graph.nodes.forEach((n) => (n.position ??= pos[n.id]));
  return form;
}
