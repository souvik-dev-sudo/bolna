import { useState } from "react";
import { Code2, PencilLine, Plus, Settings2, SquareFunction, Terminal, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Field, PendingNote, SectionCard } from "@/components/form/fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import { Input, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { Select } from "@/components/ui/select";
import { httpMethods, toolCatalog, type ToolKind } from "@/config/tools";
import { parseCurl } from "@/lib/curl";
import { newId } from "@/services/mock";
import type { ToolConfig } from "@/types/agent";
import { useDraft } from "../useAgentDraft";

const iconFor = (kind: ToolKind) => toolCatalog.find((t) => t.kind === kind)?.icon ?? SquareFunction;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

function blankTool(kind: ToolKind): ToolConfig {
  const item = toolCatalog.find((t) => t.kind === kind);
  return {
    id: newId(),
    kind,
    name: kind === "custom" ? "" : slug(item?.name ?? kind),
    description: item?.description ?? "",
    transferNumber: kind === "transfer_call" ? "" : undefined,
    method: kind === "custom" ? "POST" : undefined,
    url: kind === "custom" ? "" : undefined,
    parameters: kind === "custom" ? [] : undefined,
    headers: kind === "custom" ? [] : undefined,
  };
}

function ToolDialog({
  tool,
  onClose,
  onSave,
  nodeIds,
}: {
  tool: ToolConfig;
  onClose: () => void;
  onSave: (tool: ToolConfig) => void;
  nodeIds?: string[];
}) {
  const [t, setT] = useState<ToolConfig>(tool);
  const set = (fn: (x: ToolConfig) => void) =>
    setT((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  const catalog = toolCatalog.find((c) => c.kind === t.kind);
  const valid =
    /^[a-z][a-z0-9_]*$/.test(t.name) &&
    (t.kind !== "transfer_call" || /^\+\d{8,15}$/.test(t.transferNumber ?? "")) &&
    (t.kind !== "custom" || /^https?:\/\//.test(t.url ?? ""));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={catalog?.name ?? "Custom function"}
        description={catalog?.description ?? "Call any HTTP API during the conversation."}
        className="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!valid} onClick={() => onSave(t)}>
              Save tool
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {catalog?.requires && <PendingNote>{catalog.requires}. It will work once that's configured on the backend.</PendingNote>}
          <div className="grid gap-4 @xl:grid-cols-2">
            <Field label="Function name" info="What the model calls. Lowercase letters, digits and underscores." hint={!/^[a-z][a-z0-9_]*$/.test(t.name) && t.name ? "Use lowercase letters, digits and _" : undefined}>
              <Input value={t.name} onChange={(e) => set((x) => void (x.name = e.target.value))} placeholder="check_report_status" className="font-mono" />
            </Field>
            {t.kind === "transfer_call" && (
              <Field label="Transfer to" hint="E.164 format, e.g. +919876543210">
                <Input value={t.transferNumber ?? ""} onChange={(e) => set((x) => void (x.transferNumber = e.target.value.trim()))} placeholder="+919876543210" />
              </Field>
            )}
          </div>
          <Field label="When should the agent use it?" info="The model reads this to decide when to call the tool.">
            <Textarea rows={2} value={t.description} onChange={(e) => set((x) => void (x.description = e.target.value))} />
          </Field>

          {t.kind === "custom" && (
            <>
              <div className="grid gap-4 @xl:grid-cols-[140px_1fr]">
                <Field label="Method">
                  <Select value={t.method} options={httpMethods.map((m) => ({ value: m, label: m }))} onValueChange={(v) => set((x) => void (x.method = v))} />
                </Field>
                <Field label="URL">
                  <Input value={t.url ?? ""} onChange={(e) => set((x) => void (x.url = e.target.value))} placeholder="https://api.example.com/reports" className="font-mono" />
                </Field>
              </div>
              <Field
                label="Parameters"
                info="Values the model fills in from the conversation."
                aside={
                  <Button size="sm" variant="ghost" onClick={() => set((x) => x.parameters!.push({ name: "", type: "string", description: "", required: true }))}>
                    <Plus /> Add
                  </Button>
                }
              >
                <div className="flex flex-col gap-2">
                  {(t.parameters ?? []).length === 0 && <p className="text-xs text-muted-foreground">No parameters.</p>}
                  {(t.parameters ?? []).map((p, i) => (
                    <div key={i} className="grid grid-cols-[1fr_110px_1.5fr_auto_auto] items-center gap-2">
                      <Input value={p.name} placeholder="name" className="font-mono" onChange={(e) => set((x) => void (x.parameters![i].name = e.target.value))} />
                      <Select
                        value={p.type}
                        options={["string", "number", "boolean"].map((v) => ({ value: v, label: v }))}
                        onValueChange={(v) => set((x) => void (x.parameters![i].type = v as "string"))}
                      />
                      <Input value={p.description} placeholder="description" onChange={(e) => set((x) => void (x.parameters![i].description = e.target.value))} />
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Checkbox checked={p.required} onCheckedChange={(v) => set((x) => void (x.parameters![i].required = v === true))} /> Req.
                      </label>
                      <Button variant="danger-ghost" size="icon-sm" aria-label="Remove parameter" onClick={() => set((x) => void x.parameters!.splice(i, 1))}>
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>
              </Field>
              <Field
                label="Headers"
                aside={
                  <Button size="sm" variant="ghost" onClick={() => set((x) => x.headers!.push({ key: "", value: "" }))}>
                    <Plus /> Add
                  </Button>
                }
              >
                <div className="flex flex-col gap-2">
                  {(t.headers ?? []).map((h, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1.5fr_auto] gap-2">
                      <Input value={h.key} placeholder="Authorization" onChange={(e) => set((x) => void (x.headers![i].key = e.target.value))} />
                      <Input value={h.value} placeholder="Bearer …" onChange={(e) => set((x) => void (x.headers![i].value = e.target.value))} />
                      <Button variant="danger-ghost" size="icon-sm" aria-label="Remove header" onClick={() => set((x) => void x.headers!.splice(i, 1))}>
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>
              </Field>
            </>
          )}

          {nodeIds && nodeIds.length > 0 && (
            <Field label="Available on" info="Limit the tool to specific nodes so it is only callable where it makes sense.">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => set((x) => void (x.nodes = []))}
                  className={`rounded-pill border px-3 py-1 text-xs font-medium ${!t.nodes?.length ? "border-primary-border bg-primary-soft text-primary-hover" : "text-muted-foreground"}`}
                >
                  All nodes
                </button>
                {nodeIds.map((id) => {
                  const on = t.nodes?.includes(id);
                  return (
                    <button
                      type="button"
                      key={id}
                      onClick={() => set((x) => void (x.nodes = on ? (x.nodes ?? []).filter((n) => n !== id) : [...(x.nodes ?? []), id]))}
                      className={`rounded-pill border px-3 py-1 font-mono text-xs ${on ? "border-primary-border bg-primary-soft text-primary-hover" : "text-muted-foreground hover:border-border-strong"}`}
                    >
                      {id}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CurlDialog({ open, onOpenChange, onParsed }: { open: boolean; onOpenChange: (o: boolean) => void; onParsed: (t: ToolConfig) => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const parse = () => {
    try {
      const p = parseCurl(text);
      const tool = blankTool("custom");
      let path = "";
      try {
        path = new URL(p.url).pathname.split("/").filter(Boolean).pop() ?? "";
      } catch {
        /* keep empty */
      }
      tool.name = slug(path || "api_call") || "api_call";
      tool.method = p.method;
      tool.url = p.url;
      tool.headers = p.headers;
      tool.parameters = p.params.map((name) => ({ name, type: "string", description: "", required: true }));
      setError("");
      setText("");
      onParsed(tool);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the command");
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Generate from cURL"
        description="Paste a working curl command; we'll fill in the method, URL, headers and parameters."
        className="max-w-2xl"
        footer={
          <Button onClick={parse} disabled={!text.trim()}>
            <Code2 /> Generate
          </Button>
        }
      >
        <Textarea
          rows={8}
          className="font-mono text-xs"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`curl -X POST https://api.example.com/appointments \\\n  -H 'Authorization: Bearer …' \\\n  -d '{"patient_id": "123", "date": "2026-11-22"}'`}
        />
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}

export function ToolsSection({ nodeIds }: { nodeIds?: string[] }) {
  const { draft, patch } = useDraft();
  const [editing, setEditing] = useState<ToolConfig | null>(null);
  const [curlOpen, setCurlOpen] = useState(false);

  const save = (tool: ToolConfig) => {
    patch((d) => {
      const i = d.tools.findIndex((x) => x.id === tool.id);
      if (i >= 0) d.tools[i] = tool;
      else d.tools.push(tool);
    });
    setEditing(null);
    toast.success(`Tool “${tool.name}” saved`);
  };

  return (
    <div className="flex flex-col gap-5">
      <SectionCard
        icon={Wrench}
        title="Active tools"
        description="Functions the model can call during the conversation."
        actions={<Badge tone={draft.tools.length ? "info" : "neutral"}>{draft.tools.length} active</Badge>}
      >
        {draft.tools.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">No tools yet. Add one below.</p>
        ) : (
          <div className="grid gap-3 @xl:grid-cols-2">
            {draft.tools.map((tool) => {
              const Icon = iconFor(tool.kind);
              return (
                <div key={tool.id} className="flex items-center gap-3 rounded-lg border border-primary-border bg-primary-soft/40 px-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-card text-primary shadow-soft">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-sm font-medium text-heading">{tool.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {tool.kind === "transfer_call" ? tool.transferNumber : tool.kind === "custom" ? `${tool.method} ${tool.url}` : tool.description}
                      {tool.nodes?.length ? ` · ${tool.nodes.length} node${tool.nodes.length > 1 ? "s" : ""}` : ""}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon-sm" aria-label="Configure tool" onClick={() => setEditing(tool)}>
                    <Settings2 />
                  </Button>
                  <Button
                    variant="danger-ghost"
                    size="icon-sm"
                    aria-label="Remove tool"
                    onClick={() => patch((d) => void (d.tools = d.tools.filter((x) => x.id !== tool.id)))}
                  >
                    <Trash2 />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard icon={Plus} title="Add a tool">
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 @xl:grid-cols-2">
            {toolCatalog.map((item) => (
              <div key={item.kind} className="flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:border-primary-border">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <item.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-heading">{item.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setEditing(blankTool(item.kind))}>
                  <Plus /> Add
                </Button>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3 rounded-lg border border-dashed px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-soft text-primary">
                <SquareFunction className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-heading">Custom function</p>
                <p className="text-xs text-muted-foreground">Connect any API endpoint</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditing(blankTool("custom"))}>
                <PencilLine /> Write manually
              </Button>
              <span className="text-xs text-muted-foreground">or</span>
              <Button variant="secondary" size="sm" onClick={() => setCurlOpen(true)}>
                <Terminal /> From cURL
              </Button>
            </div>
          </div>
        </div>
      </SectionCard>

      {editing && <ToolDialog key={editing.id} tool={editing} onClose={() => setEditing(null)} onSave={save} nodeIds={nodeIds} />}
      <CurlDialog
        open={curlOpen}
        onOpenChange={setCurlOpen}
        onParsed={(tool) => {
          setCurlOpen(false);
          setEditing(tool);
        }}
      />
    </div>
  );
}

