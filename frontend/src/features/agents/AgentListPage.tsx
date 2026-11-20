import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bot,
  ChevronDown,
  Copy,
  FileJson,
  GitBranch,
  LayoutTemplate,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProviderIcon } from "@/components/ProviderIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { languageName } from "@/config/languages";
import {
  useAgents,
  useDeleteAgent,
  useDuplicateAgent,
  useImportAgent,
} from "@/hooks/queries";
import { relativeTime } from "@/lib/format";
import type { AgentKind, AgentSummary } from "@/types/agent";
import { isGraphPayload, normalizeAgentJson } from "@/services/agents";
import { agentPath, CreateAgentDialog } from "./CreateAgentDialog";

/** "Graph agent" / "Simple agent", as Bolna labels an agent's type. */
const typeLabel = (kind: AgentKind) =>
  kind === "graph" ? "Graph agent" : "Simple agent";

function AgentCard({
  agent,
  onDelete,
  inStudio,
}: {
  agent: AgentSummary;
  onDelete: () => void;
  inStudio: boolean;
}) {
  const navigate = useNavigate();
  const duplicate = useDuplicateAgent();
  // Agent Studio opens every agent (graph ones too) in its tabbed editor; the Graph Agent page opens the graph editor.
  const path = inStudio
    ? `/agents/${agent.id}`
    : agentPath(agent.id, agent.kind);
  const graphPath = agentPath(agent.id, "graph");

  return (
    <Card interactive className="group relative flex flex-col">
      <Link
        to={path}
        className="flex flex-1 flex-col gap-4 p-5"
        aria-label={`Open ${agent.name}`}
      >
        <div className="flex items-start gap-3 pr-8">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            {agent.kind === "graph" ? (
              <GitBranch className="h-5 w-5" />
            ) : (
              <Bot className="h-5 w-5" />
            )}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold text-heading group-hover:text-primary-hover">
              {agent.name}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {typeLabel(agent.kind)} · Updated {relativeTime(agent.updatedAt)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {agent.languages.map((code) => (
            <Badge key={code} tone="neutral">
              {languageName(code)}
            </Badge>
          ))}
          {agent.kind === "graph" && agent.nodeCount != null && (
            <Badge tone="info" icon={Workflow}>
              {agent.nodeCount} nodes
            </Badge>
          )}
        </div>
        <div className="mt-auto flex items-center gap-3 border-t pt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ProviderIcon id={agent.transcriberProvider} /> STT
          </span>
          <span className="flex items-center gap-1.5">
            <ProviderIcon
              id={agent.llmModel.startsWith("gemini") ? "google" : "openai"}
            />{" "}
            {agent.llmModel}
          </span>
          <span className="flex items-center gap-1.5">
            <ProviderIcon id={agent.voiceProvider} /> Voice
          </span>
        </div>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute right-3 top-3"
            aria-label="Agent actions"
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => navigate(path)}>
            <Bot /> Open
          </DropdownMenuItem>
          {agent.kind === "graph" && (
            <DropdownMenuItem
              onSelect={() =>
                navigate(inStudio ? graphPath : `/agents/${agent.id}`)
              }
            >
              <GitBranch />{" "}
              {inStudio ? "Open in Graph editor" : "Open in Agent Studio"}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() =>
              duplicate.mutate(agent.id, {
                onSuccess: (copy) =>
                  toast.success(`Duplicated as “${copy.name}”`),
              })
            }
          >
            <Copy /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={onDelete}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Card>
  );
}

export function AgentListPage({ kind }: { kind: AgentKind }) {
  // Agent Studio lists every agent (as Bolna does); the Graph Agent page lists graph agents only.
  const { data, isLoading } = useAgents(kind === "graph" ? "graph" : undefined);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [toDelete, setToDelete] = useState<AgentSummary | null>(null);
  const remove = useDeleteAgent();
  const importAgent = useImportAgent();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);

  /**
   * Create ▾ → Import JSON: an agent JSON (this dashboard's or Bolna's export, or Bolna's API
   * response) becomes a new agent. The Graph Agent page takes graph agents only.
   */
  const importFile = async (file: File) => {
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        throw new Error("That file isn't valid JSON");
      }
      const payload = normalizeAgentJson(parsed);
      const graphJson = isGraphPayload(payload);
      if (kind === "graph" && !graphJson)
        throw new Error(
          "This JSON is not a graph agent. Import it from Agent Studio.",
        );
      const agent = await importAgent.mutateAsync(payload);
      toast.success(`Imported ${agent.name}`);
      navigate(
        kind === "graph" ? agentPath(agent.id, "graph") : `/agents/${agent.id}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not import");
    }
  };

  const filtered = useMemo(
    () =>
      (data ?? []).filter((a) =>
        a.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [data, query],
  );
  const isGraph = kind === "graph";

  return (
    <>
      <PageHeader
        title={isGraph ? "Graph Agents" : "Agent Studio"}
        description={
          isGraph
            ? undefined
            : "All your voice agents, simple and graph. Configure, test and deploy."
        }
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button loading={importAgent.isPending}>
                  <Plus /> {isGraph ? "Create" : "New agent"} <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setCreateOpen(true)}>
                  <LayoutTemplate /> From template
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => fileInput.current?.click()}>
                  <FileJson /> Import JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importFile(f);
                e.target.value = "";
              }}
            />
          </>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          icon={<Search />}
          placeholder="Search agents..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:w-80"
        />
        {data && (
          <p className="text-sm text-muted-foreground">
            Showing {filtered.length} of {data.length}{" "}
            {data.length === 1 ? "agent" : "agents"}
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[178px] rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={isGraph ? GitBranch : Bot}
          title={
            query
              ? "No agents match your search"
              : isGraph
                ? "No graph agents yet"
                : "No agents yet"
          }
          description={
            query
              ? "Try a different name."
              : "Create your first agent from a template in under a minute."
          }
          action={
            !query && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus /> Create agent
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onDelete={() => setToDelete(agent)}
              inStudio={!isGraph}
            />
          ))}
        </div>
      )}

      <CreateAgentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        kind={kind}
      />
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete agent?"
        description={
          <>
            <strong className="text-heading">{toDelete?.name}</strong> will be
            deleted. Calls already made keep their history.
          </>
        }
        loading={remove.isPending}
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.id, {
            onSuccess: () => {
              toast.success("Agent deleted");
              setToDelete(null);
            },
          })
        }
      />
    </>
  );
}
