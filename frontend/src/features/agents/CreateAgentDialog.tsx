import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Check, GitBranch } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { Field } from "@/components/form/fields";
import { agentTemplates } from "@/config/agent";
import { useCreateAgent } from "@/hooks/queries";
import { cn } from "@/lib/utils";
import type { AgentKind } from "@/types/agent";

export function agentPath(id: string, kind: AgentKind) {
  return kind === "graph" ? `/graphs/${id}` : `/agents/${id}`;
}

export function CreateAgentDialog({
  open,
  onOpenChange,
  kind,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: AgentKind;
}) {
  const templates = agentTemplates.filter((t) => t.kind === kind);
  const [templateId, setTemplateId] = useState(templates[0].id);
  const [name, setName] = useState("");
  const create = useCreateAgent();
  const navigate = useNavigate();

  const submit = () => {
    const finalName = name.trim() || templates.find((t) => t.id === templateId)!.name;
    create.mutate(
      { templateId, name: finalName },
      {
        onSuccess: (agent) => {
          toast.success(`Created “${agent.name}”`);
          onOpenChange(false);
          setName("");
          navigate(agentPath(agent.id, agent.kind));
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={kind === "graph" ? "Create a graph agent" : "Create an agent"}
        description="Start blank or from a template. You can change everything later."
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={submit} loading={create.isPending}>
              Create agent
            </Button>
          </>
        }
      >
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Field label="Agent name" htmlFor="agent-name">
            <Input
              id="agent-name"
              autoFocus
              placeholder={templates.find((t) => t.id === templateId)?.name}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-heading">Start from</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {templates.map((t) => {
                const selected = t.id === templateId;
                const Icon = t.kind === "graph" ? GitBranch : Bot;
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setTemplateId(t.id)}
                    className={cn(
                      "relative flex flex-col gap-2 rounded-lg border p-4 text-left transition-all",
                      selected ? "border-primary bg-primary-soft/60 shadow-focus" : "hover:border-border-strong",
                    )}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-card text-primary shadow-soft">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-semibold text-heading">{t.name}</span>
                    <span className="text-xs text-muted-foreground">{t.description}</span>
                    {selected && (
                      <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
