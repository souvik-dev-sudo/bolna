import { Braces, Copy, Download, FlaskConical, MoreHorizontal, Trash2 } from "lucide-react";
import { ProviderIcon } from "@/components/ProviderIcon";
import { Button } from "@/components/ui/button";
import { CopyChip } from "@/components/ui/misc";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Tooltip } from "@/components/ui/overlays";
import { shortId } from "@/lib/format";
import { useDraft } from "./useAgentDraft";

function StackChips() {
  const { draft } = useDraft();
  const lang = draft.languages.find((l) => l.code === draft.defaultLanguage) ?? draft.languages[0];
  const chips = [
    { label: "Speech-to-text", provider: lang.transcriber.provider, value: lang.transcriber.model },
    { label: "LLM", provider: draft.llm.provider, value: draft.llm.model },
    { label: "Voice", provider: lang.voice.provider, value: lang.voice.model },
    { label: "Telephony", provider: draft.calling.telephonyProvider, value: draft.calling.telephonyProvider },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <span key={c.label} className="flex items-center gap-2 rounded-md border bg-muted/50 px-2.5 py-1.5">
          <ProviderIcon id={c.provider} />
          <span className="flex flex-col leading-tight">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{c.label}</span>
            <span className="text-xs font-medium text-heading">{c.value}</span>
          </span>
        </span>
      ))}
    </div>
  );
}

export function AgentHeader({
  onTest,
  onJson,
  onDuplicate,
  onDelete,
  onExport,
}: {
  onTest: () => void;
  onJson: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onExport: () => void;
}) {
  const { draft, patch } = useDraft();
  return (
    <div className="mb-6 rounded-xl border bg-card p-5 shadow-soft">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <input
              value={draft.name}
              onChange={(e) => patch((d) => void (d.name = e.target.value))}
              aria-label="Agent name"
              placeholder="Agent name"
              className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 -ml-1 text-2xl font-semibold tracking-tightish text-heading hover:border-border focus:border-primary focus:shadow-focus"
            />
            <CopyChip value={draft.id} display={shortId(draft.id)} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Tooltip content="View agent JSON">
            <Button variant="secondary" size="icon" onClick={onJson} aria-label="View agent JSON">
              <Braces />
            </Button>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={onDuplicate}>
                <Copy /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onExport}>
                <Download /> Export JSON
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={onDelete}>
                <Trash2 /> Delete agent
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={onTest}>
            <FlaskConical /> Test agent
          </Button>
        </div>
      </div>
      <div className="mt-5 border-t pt-5">
        <StackChips />
      </div>
    </div>
  );
}
