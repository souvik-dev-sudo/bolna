import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import {
  Background,
  BackgroundVariant,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  AlertCircle,
  Braces,
  CheckCircle2,
  Download,
  LayoutGrid,
  Maximize,
  Maximize2,
  MessageSquareQuote,
  Minimize2,
  PanelRightOpen,
  Plus,
  Redo2,
  Save,
  Search,
  Sparkles,
  Split,
  Undo2,
  Upload,
  WandSparkles,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { Breadcrumbs } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { CopyChip, Skeleton } from "@/components/ui/misc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
} from "@/components/ui/overlays";
import { AgentJsonDialog } from "@/features/agents/editor/AgentJsonDialog";
import { AgentDraftProvider, useAgentDraftState, useDraft } from "@/features/agents/editor/useAgentDraft";
import { fromBolna } from "@/lib/agentMapper";
import { downloadText, shortDate, shortId } from "@/lib/format";
import { cn } from "@/lib/utils";
import { aiEditGraph, getAgentJson } from "@/services/agents";
import { graphCanvas, graphNodes } from "@/theme/theme";
import type { GraphDefinition, GraphNodeType } from "@/types/agent";
import { GraphInspector } from "./GraphInspector";
import { GraphNodeCard, type FlowNode } from "./GraphNodeCard";
import { autoLayout, isTerminal, uniqueNodeId, validateGraph } from "./graphUtils";

const nodeTypes = { agentNode: GraphNodeCard };
const HISTORY_LIMIT = 50;

function ToolButton({ label, onClick, children, disabled, active }: { label: string; onClick?: () => void; children: ReactNode; disabled?: boolean; active?: boolean }) {
  return (
    <Tooltip content={label}>
      <Button variant="ghost" size="icon-sm" onClick={onClick} disabled={disabled} aria-label={label} className={cn(active && "bg-primary-soft text-primary")}>
        {children}
      </Button>
    </Tooltip>
  );
}

const Divider = () => <span className="mx-1 h-5 w-px bg-border" />;

function GraphCanvas() {
  const { draft, patch, replace, dirty, saving, save, saved } = useDraft();
  const graph = draft.graph!;
  const flow = useReactFlow();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState("setup");
  const [wandOpen, setWandOpen] = useState(false);
  const [wandText, setWandText] = useState("");
  const [wandBusy, setWandBusy] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [inspectorWide, setInspectorWide] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [search, setSearch] = useState("");
  const past = useRef<GraphDefinition[]>([]);
  const future = useRef<GraphDefinition[]>([]);
  const [, force] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const issues = useMemo(() => validateGraph(graph), [graph]);
  const errorCount = issues.filter((i) => i.level === "error").length;

  /** Every graph edit goes through here so undo/redo works. */
  const mutateGraph = useCallback(
    (fn: (g: GraphDefinition) => void) => {
      past.current = [...past.current.slice(-HISTORY_LIMIT + 1), structuredClone(graph)];
      future.current = [];
      patch((d) => fn(d.graph!));
      force((x) => x + 1);
    },
    [graph, patch],
  );

  const undo = () => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(structuredClone(graph));
    patch((d) => void (d.graph = prev));
    force((x) => x + 1);
  };
  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(structuredClone(graph));
    patch((d) => void (d.graph = next));
    force((x) => x + 1);
  };

  // Lay out once if positions are missing (Bolna JSON has none).
  useEffect(() => {
    if (graph.nodes.some((n) => !n.position)) {
      const pos = autoLayout(graph);
      patch((d) => d.graph!.nodes.forEach((n) => (n.position ??= pos[n.id])));
      setTimeout(() => flow.fitView({ padding: 0.15 }), 50);
    }
  }, [graph, patch, flow]);

  const issueByNode = useMemo(() => {
    const m = new Map<string, string>();
    issues.forEach((i) => i.nodeId && !m.has(i.nodeId) && m.set(i.nodeId, i.message));
    return m;
  }, [issues]);

  const q = search.trim().toLowerCase();
  const buildNodes = useCallback(
    (): FlowNode[] =>
      graph.nodes.map((n) => ({
        id: n.id,
        type: "agentNode",
        position: n.position ?? { x: 0, y: 0 },
        selected: n.id === selectedId,
        data: {
          node: n,
          isStart: n.id === graph.startNodeId,
          isEnd: isTerminal(n),
          issue: issueByNode.get(n.id),
          dimmed: Boolean(q) && !n.id.toLowerCase().includes(q),
        },
      })),
    [graph, selectedId, issueByNode, q],
  );
  const [nodes, setNodes] = useState<FlowNode[]>(buildNodes);
  useEffect(() => {
    setNodes(buildNodes());
  }, [buildNodes]);

  const edges: Edge[] = useMemo(
    () =>
      graph.nodes.flatMap((n) =>
        n.edges.map((e) => {
          const active = selectedId === n.id || selectedId === e.to;
          return {
            id: e.id,
            source: n.id,
            target: e.to,
            label: e.unconditional ? undefined : e.label || undefined,
            animated: active,
            style: { stroke: active ? graphCanvas.edgeActive : graphCanvas.edge, strokeWidth: active ? 2 : 1.4 },
            labelStyle: { fontSize: 10, fill: active ? graphCanvas.edgeActive : "#3C4866", fontWeight: 500 },
            labelBgStyle: { fill: graphCanvas.edgeLabelBg },
            labelBgPadding: [6, 3] as [number, number],
            labelBgBorderRadius: 6,
            markerEnd: { type: MarkerType.ArrowClosed, color: active ? graphCanvas.edgeActive : graphCanvas.edge, width: 16, height: 16 },
          };
        }),
      ),
    [graph, selectedId],
  );

  const onNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => setNodes((ns) => applyNodeChanges(changes, ns)), []);

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target || c.source === c.target) return;
      mutateGraph((g) => {
        const n = g.nodes.find((x) => x.id === c.source);
        n?.edges.push({ id: `${c.source}->${c.target}-${Date.now()}`, to: c.target!, condition: "", label: "New condition", unconditional: false });
      });
      setSelectedId(c.source);
      setInspectorOpen(true);
      toast.success(`Connected ${c.source} → ${c.target}. Describe the condition in the inspector.`);
    },
    [mutateGraph],
  );

  const addNode = (type: GraphNodeType) => {
    const id = uniqueNodeId(graph, type === "static" ? "Message" : type === "router" ? "Router" : "Step");
    const center = flow.screenToFlowPosition({ x: window.innerWidth / 2 - 200, y: window.innerHeight / 2 });
    mutateGraph((g) =>
      g.nodes.push({ id, type, prompt: "", staticMessage: {}, examples: {}, edges: [], position: { x: center.x - 130, y: center.y - 60 } }),
    );
    setSelectedId(id);
    setInspectorOpen(true);
  };

  const deleteNode = (id: string) => {
    mutateGraph((g) => {
      g.nodes = g.nodes.filter((n) => n.id !== id);
      g.nodes.forEach((n) => (n.edges = n.edges.filter((e) => e.to !== id)));
    });
    setSelectedId(null);
    toast.success(`Deleted ${id}`);
  };

  /** Magic wand: the edited graph replaces the canvas as one undoable change; nothing is saved. */
  const runWand = async () => {
    if (!wandText.trim()) return;
    setWandBusy(true);
    try {
      const { graph: edited } = await aiEditGraph(draft, wandText.trim());
      mutateGraph((g) => Object.assign(g, edited));
      setSelectedId(null);
      setWandOpen(false);
      setWandText("");
      toast.success(`Graph updated (${edited.nodes.length} nodes). Review it, then save.`);
      setTimeout(() => flow.fitView({ padding: 0.15, duration: 400 }), 80);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI Edit failed");
    } finally {
      setWandBusy(false);
    }
  };

  const relayout = () => {
    const pos = autoLayout(graph);
    mutateGraph((g) => g.nodes.forEach((n) => (n.position = pos[n.id])));
    setTimeout(() => flow.fitView({ padding: 0.15, duration: 400 }), 30);
  };

  const focusNode = (id: string) => {
    setSelectedId(id);
    setInspectorOpen(true);
    flow.fitView({ nodes: [{ id }], duration: 500, maxZoom: 1.1, padding: 0.6 });
  };

  const importJson = async (file: File) => {
    try {
      const payload = JSON.parse(await file.text());
      if (!payload.agent_config) throw new Error("Not an agent JSON (missing agent_config)");
      const form = fromBolna(payload, { id: draft.id, createdAt: draft.createdAt, updatedAt: draft.updatedAt });
      if (form.kind !== "graph") throw new Error("This JSON is not a graph agent");
      past.current.push(structuredClone(graph));
      replace({ ...form, id: draft.id });
      setSelectedId(null);
      toast.success(`Imported ${form.graph?.nodes.length ?? 0} nodes. Review and save.`);
      setTimeout(() => flow.fitView({ padding: 0.15 }), 80);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not import");
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = ["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      } else if (!typing && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const searchMatches = q ? graph.nodes.filter((n) => n.id.toLowerCase().includes(q)) : [];

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col lg:h-screen">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-3 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Breadcrumbs items={[{ label: "Graph Agents", to: "/graphs" }, { label: draft.name }]} />
          <CopyChip value={draft.id} display={shortId(draft.id)} />
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {dirty ? (
              <span className="flex items-center gap-1.5 text-warning">
                <span className="h-1.5 w-1.5 rounded-full bg-warning" /> Unsaved · saved {shortDate(saved.updatedAt)}
              </span>
            ) : (
              `Saved ${shortDate(saved.updatedAt)}`
            )}
          </span>
        </div>
        {!inspectorOpen && (
          <Button variant="secondary" onClick={() => setInspectorOpen(true)} className="hidden md:inline-flex">
            <PanelRightOpen /> Inspector
          </Button>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Canvas */}
        <div className="relative min-w-0 flex-1" style={{ background: graphCanvas.background }}>
          <ReactFlow<FlowNode, Edge>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeDragStop={(_, node) =>
              mutateGraph((g) => {
                const n = g.nodes.find((x) => x.id === node.id);
                if (n) n.position = { x: Math.round(node.position.x), y: Math.round(node.position.y) };
              })
            }
            onNodeClick={(_, node) => {
              setSelectedId(node.id);
              setInspectorOpen(true);
            }}
            onEdgeClick={(_, edge) => {
              setSelectedId(edge.source);
              setInspectorOpen(true);
            }}
            onPaneClick={() => setSelectedId(null)}
            onConnect={onConnect}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.1}
            maxZoom={1.75}
            deleteKeyCode={null}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1.4} color={graphCanvas.dots} />
            <MiniMap
              pannable
              zoomable
              className="!bottom-4 !right-4 hidden md:block"
              nodeColor={(n) => {
                const d = (n as FlowNode).data;
                return d.isEnd ? graphNodes.end.accent : graphNodes[d.node.type].accent;
              }}
              nodeStrokeWidth={0}
              maskColor="rgba(244,246,251,0.7)"
            />
          </ReactFlow>

          {/* Floating toolbar */}
          <div className="absolute left-4 top-4 flex flex-wrap items-center gap-0.5 rounded-lg border bg-card p-1 shadow-card">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="mr-1">
                  <Plus /> Add node
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={() => addNode("llm")}>
                  <Sparkles /> LLM step (agent speaks)
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => addNode("static")}>
                  <MessageSquareQuote /> Static message
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => addNode("router")}>
                  <Split /> Router
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={relayout}>
                  <LayoutGrid /> Auto-arrange
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Divider />
            <ToolButton label="Import JSON" onClick={() => fileInput.current?.click()}>
              <Upload />
            </ToolButton>
            <ToolButton
              label="Export JSON"
              onClick={async () => downloadText(`${draft.name.replace(/\W+/g, "-").toLowerCase()}.json`, JSON.stringify(await getAgentJson(draft), null, 2))}
            >
              <Download />
            </ToolButton>
            <Popover open={wandOpen} onOpenChange={(o) => !wandBusy && setWandOpen(o)}>
              <PopoverTrigger asChild>
                <span>
                  <ToolButton label="AI edit" active={wandOpen}>
                    <WandSparkles />
                  </ToolButton>
                </span>
              </PopoverTrigger>
              <PopoverContent className="w-96 p-3">
                <p className="mb-1 text-sm font-semibold text-heading">AI edit</p>
                <p className="mb-2 text-xs text-muted-foreground">Describe the change. The graph updates here; review it, then save.</p>
                <Textarea
                  autoFocus
                  rows={4}
                  value={wandText}
                  disabled={wandBusy}
                  onChange={(e) => setWandText(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void runWand();
                  }}
                  placeholder="e.g. Add a node that asks for the caller's email before Thank_you"
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{wandBusy ? "Editing… large graphs take up to a minute." : ""}</span>
                  <Button size="sm" onClick={() => void runWand()} loading={wandBusy} disabled={!wandText.trim()}>
                    <Sparkles /> Apply
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <Divider />
            <ToolButton label="Undo (Ctrl+Z)" onClick={undo} disabled={past.current.length === 0}>
              <Undo2 />
            </ToolButton>
            <ToolButton label="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={future.current.length === 0}>
              <Redo2 />
            </ToolButton>
            <Popover>
              <PopoverTrigger asChild>
                <span>
                  <ToolButton label="Find node" active={Boolean(q)}>
                    <Search />
                  </ToolButton>
                </span>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2">
                <Input autoFocus icon={<Search />} placeholder="Node ID…" value={search} onChange={(e) => setSearch(e.target.value)} />
                <div className="mt-1 max-h-56 overflow-y-auto">
                  {searchMatches.map((n) => (
                    <button key={n.id} onClick={() => focusNode(n.id)} className="block w-full truncate rounded-sm px-2 py-1.5 text-left font-mono text-xs hover:bg-primary-soft">
                      {n.id}
                    </button>
                  ))}
                  {q && searchMatches.length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">No match</p>}
                </div>
              </PopoverContent>
            </Popover>
            <ToolButton label="View JSON" onClick={() => setJsonOpen(true)}>
              <Braces />
            </ToolButton>
            <Divider />
            <ToolButton label="Zoom out" onClick={() => flow.zoomOut({ duration: 200 })}>
              <ZoomOut />
            </ToolButton>
            <ToolButton label="Zoom in" onClick={() => flow.zoomIn({ duration: 200 })}>
              <ZoomIn />
            </ToolButton>
            <ToolButton label="Fit to screen" onClick={() => flow.fitView({ padding: 0.15, duration: 400 })}>
              <Maximize />
            </ToolButton>
            <Divider />
            <Popover open={showIssues} onOpenChange={setShowIssues}>
              <PopoverTrigger asChild>
                <span>
                  <ToolButton label="Validate graph" active={showIssues}>
                    {issues.length === 0 ? <CheckCircle2 className="text-success" /> : <AlertCircle className={errorCount ? "text-danger" : "text-warning"} />}
                  </ToolButton>
                </span>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0">
                <div className="border-b px-3 py-2 text-sm font-semibold">
                  {issues.length === 0 ? "No problems found" : `${errorCount} errors · ${issues.length - errorCount} warnings`}
                </div>
                <ul className="max-h-72 overflow-y-auto p-1">
                  {issues.map((i, k) => (
                    <li key={k}>
                      <button
                        onClick={() => i.nodeId && focusNode(i.nodeId)}
                        className="flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-muted"
                      >
                        <AlertCircle className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", i.level === "error" ? "text-danger" : "text-warning")} />
                        {i.message}
                      </button>
                    </li>
                  ))}
                  {issues.length === 0 && <li className="px-3 py-3 text-xs text-muted-foreground">Every node is reachable and every edge points somewhere.</li>}
                </ul>
              </PopoverContent>
            </Popover>
            <ToolButton label={dirty ? "Save (Ctrl+S)" : "Saved"} onClick={() => void save()} disabled={!dirty || saving} active={dirty}>
              <Save className={cn(saving && "animate-pulse")} />
            </ToolButton>
            <AgentJsonDialog open={jsonOpen} onOpenChange={setJsonOpen} agent={draft} />
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importJson(f);
                e.target.value = "";
              }}
            />
          </div>

          {/* Legend */}
          <div className="absolute bottom-4 left-4 hidden items-center gap-3 rounded-md border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-soft sm:flex">
            {(["llm", "static", "router", "end"] as const).map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: graphNodes[t].accent }} />
                {graphNodes[t].label}
              </span>
            ))}
            <span className="text-placeholder">· {graph.nodes.length} nodes</span>
          </div>
        </div>

        {/* Inspector */}
        {inspectorOpen && (
          <aside className={cn("hidden shrink-0 flex-col border-l bg-card md:flex", inspectorWide ? "w-[640px]" : "w-[420px]")}>
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="text-base font-semibold text-heading">Inspector</span>
              <div className="flex items-center gap-1">
                <ToolButton label={inspectorWide ? "Collapse" : "Expand"} onClick={() => setInspectorWide((w) => !w)}>
                  {inspectorWide ? <Minimize2 /> : <Maximize2 />}
                </ToolButton>
                <ToolButton label="Close" onClick={() => setInspectorOpen(false)}>
                  <X />
                </ToolButton>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <GraphInspector
                selectedId={selectedId}
                onCloseNode={() => setSelectedId(null)}
                issues={issues}
                mutateGraph={mutateGraph}
                onDeleteNode={deleteNode}
                tab={inspectorTab}
                onTabChange={setInspectorTab}
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

export function GraphEditorPage() {
  const { id } = useParams();
  const { query, value } = useAgentDraftState(id);

  if (query.isError) {
    return (
      <div className="p-8">
        <EmptyState icon={AlertCircle} title="Graph agent not found" description="It may have been deleted." />
      </div>
    );
  }
  if (!value) {
    return (
      <div className="flex h-screen flex-col gap-4 p-6">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="flex-1 rounded-xl" />
      </div>
    );
  }
  if (!value.draft.graph) {
    return (
      <div className="p-8">
        <EmptyState icon={AlertCircle} title="Not a graph agent" description="Open this agent from the Agents page instead." />
      </div>
    );
  }
  return (
    <AgentDraftProvider value={value}>
      <ReactFlowProvider>
        <GraphCanvas />
      </ReactFlowProvider>
    </AgentDraftProvider>
  );
}
