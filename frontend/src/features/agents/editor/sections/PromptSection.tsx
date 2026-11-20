import { useState } from "react";
import { Link } from "react-router-dom";
import { Braces, GitBranch, Hand, Maximize2, MessageSquareText, PhoneOff, ScrollText, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { LanguageChips, LocalizedText, SectionCard, SliderField, ToggleRow } from "@/components/form/fields";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/controls";
import { Textarea } from "@/components/ui/input";
import { Kbd } from "@/components/ui/misc";
import { Dialog, DialogContent, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";
import { limits } from "@/config/agent";
import { languageName } from "@/config/languages";
import { estimateTokens, extractVariables } from "@/lib/format";
import { aiEditPrompt } from "@/services/agents";
import { agentVariables } from "@/services/testing";
import { useDraft } from "../useAgentDraft";

/** AI Edit: rewrites the prompt on the server, shows the result, and applies it only on request. */
function AiEditButton({ prompt, onApply }: { prompt: string; onApply: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const rewrite = async () => {
    setLoading(true);
    try {
      const { prompt: rewritten } = await aiEditPrompt(prompt, instruction.trim());
      setResult(rewritten);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI Edit failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="soft" size="sm">
            <Sparkles /> AI Edit
            <span className="rounded-sm bg-primary/10 px-1 text-[10px] font-medium text-primary">Beta</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <p className="mb-2 text-sm font-medium text-heading">What should change?</p>
          <Textarea
            rows={3}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="e.g. Make it more empathetic and ask for the patient's age"
          />
          <Button className="mt-3 w-full" size="sm" disabled={!instruction.trim()} loading={loading} onClick={() => void rewrite()}>
            <Sparkles /> Rewrite prompt
          </Button>
        </PopoverContent>
      </Popover>
      <Dialog open={result !== null} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent
          title="AI Edit"
          description={instruction}
          className="max-w-3xl"
          footer={
            <>
              <Button variant="ghost" onClick={() => setResult(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  onApply(result ?? "");
                  setResult(null);
                  setInstruction("");
                  toast.success("Prompt updated. Save the agent to keep it.");
                }}
              >
                Apply
              </Button>
            </>
          }
        >
          <Textarea value={result ?? ""} onChange={(e) => setResult(e.target.value)} rows={18} className="leading-7" />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PromptSection() {
  const { draft, patch } = useDraft();
  const codes = draft.languages.map((l) => l.code);
  const [promptLang, setPromptLang] = useState(draft.defaultLanguage);
  const [expanded, setExpanded] = useState(false);
  const lang = codes.includes(promptLang) ? promptLang : draft.defaultLanguage;
  // A graph agent's Canvas is its shared prompt (agent_information), one text that every node sees;
  // node prompts, per language, stay in the graph editor.
  const isGraph = draft.kind === "graph" && Boolean(draft.graph);
  const prompt = isGraph ? (draft.graph?.agentInformation ?? "") : (draft.prompts[lang] ?? "");
  const variables = isGraph ? agentVariables(draft) : extractVariables([prompt, ...Object.values(draft.welcomeMessage)].join("\n"));
  const setPrompt = (text: string) =>
    patch((d) => {
      if (isGraph && d.graph) d.graph.agentInformation = text;
      else d.prompts[lang] = text;
    });

  return (
    <div className="flex flex-col gap-5">
      <SectionCard
        icon={MessageSquareText}
        title="Agent Welcome Message"
        info="The first thing the agent says when the call connects. Values for {{variables}} are passed when the call is placed."
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <LocalizedText
              value={draft.welcomeMessage}
              onChange={(v) => patch((d) => void (d.welcomeMessage = v))}
              codes={codes}
              defaultCode={draft.defaultLanguage}
              rows={2}
              placeholder="Good morning! I'm Priya from Dr. Agarwal's Eye Hospital…"
            />
            <p className="text-xs text-muted-foreground">You can define variables using {"{{variable_name}}"}</p>
          </div>
          <div className="grid gap-4 @xl:grid-cols-2">
            <ToggleRow
              icon={Hand}
              label="Ignore user speech before welcome message"
              info="Stops the greeting being cut off by background noise or a 'hello'."
              checked={draft.ignoreSpeechBeforeWelcome}
              onCheckedChange={(v) => patch((d) => void (d.ignoreSpeechBeforeWelcome = v))}
            />
            <SliderField
              label="Welcome Message Delay (in ms)"
              info="Pause after the call connects, so the caller has the phone at their ear."
              value={draft.welcomeDelayMs}
              onChange={(v) => patch((d) => void (d.welcomeDelayMs = v))}
              unit="ms"
              {...limits.welcomeDelayMs}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        icon={ScrollText}
        title="Canvas"
        info={
          isGraph
            ? "Shared by every node of the graph: who the agent is, the call's details and rules that always apply."
            : "The agent prompt: who the agent is, what it must achieve, and how it should behave."
        }
        actions={
          <>
            {isGraph && (
              <Button variant="secondary" size="sm" asChild>
                <Link to={`/graphs/${draft.id}`}>
                  <GitBranch /> Open in Graph editor
                </Link>
              </Button>
            )}
            <AiEditButton prompt={prompt} onApply={setPrompt} />
            <Button variant="ghost" size="icon-sm" onClick={() => setExpanded(true)} aria-label="Expand editor">
              <Maximize2 />
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {isGraph ? (
            <p className="text-xs text-muted-foreground">
              Node prompts and routing ({draft.graph?.nodes.length ?? 0} nodes) are edited in the Graph editor.
            </p>
          ) : (
            <LanguageChips codes={codes} value={lang} onChange={setPromptLang} defaultCode={draft.defaultLanguage} filled={draft.prompts} />
          )}
          {!isGraph && lang !== draft.defaultLanguage && !prompt && (
            <p className="text-xs text-muted-foreground">
              Empty means the {languageName(draft.defaultLanguage)} prompt is used for {languageName(lang)} too.
            </p>
          )}
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={14}
            className="font-[450] leading-7"
            placeholder={"# Role\nYou are Priya, a friendly coordinator at…\n\n# Goal\nConfirm the appointment…\n\n# Rules\n- Keep replies under two sentences"}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-1.5">
              <Braces className="h-3.5 w-3.5" />
              {variables.length ? (
                variables.map((v) => (
                  <span key={v} className="rounded-sm bg-primary-soft px-1.5 py-0.5 font-mono text-[11px] text-primary-hover">
                    {`{{${v}}}`}
                  </span>
                ))
              ) : (
                <span>
                  No variables. Type <Kbd>{"{{name}}"}</Kbd> to add one.
                </span>
              )}
            </div>
            <span className="tabular-nums">{estimateTokens(prompt)} tokens</span>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        icon={PhoneOff}
        title="Hangup using a prompt"
        info="After each reply, a small model checks whether the conversation is finished and hangs up."
        actions={
          <Switch
            checked={draft.hangupPrompt.enabled}
            onCheckedChange={(v) => patch((d) => void (d.hangupPrompt.enabled = v))}
            aria-label="Hangup using a prompt"
          />
        }
      >
        {draft.hangupPrompt.enabled && (
          <Textarea
            rows={8}
            value={draft.hangupPrompt.prompt}
            onChange={(e) => patch((d) => void (d.hangupPrompt.prompt = e.target.value))}
            aria-label="Hangup using a prompt"
          />
        )}
      </SectionCard>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent title={isGraph ? "Canvas" : `Canvas · ${languageName(lang)}`} className="max-w-4xl">
          <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={26} className="leading-7" autoFocus />
          <p className="mt-2 text-right text-xs text-muted-foreground">{estimateTokens(prompt)} tokens</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
