import { useState } from "react";
import { Braces, Hand, Maximize2, MessageSquareText, PhoneOff, ScrollText, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Field, LanguageChips, LocalizedText, SectionCard, SliderField, ToggleRow } from "@/components/form/fields";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/controls";
import { Textarea } from "@/components/ui/input";
import { Kbd } from "@/components/ui/misc";
import { Dialog, DialogContent, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";
import { limits } from "@/config/agent";
import { languageName } from "@/config/languages";
import { estimateTokens, extractVariables } from "@/lib/format";
import { useDraft } from "../useAgentDraft";

function AiEditButton() {
  const [instruction, setInstruction] = useState("");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="soft" size="sm">
          <Sparkles /> AI edit
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
        <Button
          className="mt-3 w-full"
          size="sm"
          disabled={!instruction.trim()}
          onClick={() => toast.info("AI edit will rewrite the prompt once the backend is connected (tracker A2.7).")}
        >
          <Sparkles /> Rewrite prompt
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export function PromptSection() {
  const { draft, patch } = useDraft();
  const codes = draft.languages.map((l) => l.code);
  const [promptLang, setPromptLang] = useState(draft.defaultLanguage);
  const [expanded, setExpanded] = useState(false);
  const lang = codes.includes(promptLang) ? promptLang : draft.defaultLanguage;
  const prompt = draft.prompts[lang] ?? "";
  const variables = extractVariables([prompt, ...Object.values(draft.welcomeMessage)].join("\n"));
  const setPrompt = (text: string) => patch((d) => void (d.prompts[lang] = text));

  return (
    <div className="flex flex-col gap-5">
      <SectionCard
        icon={MessageSquareText}
        title="Welcome message"
        description="The first thing the agent says when the call connects."
        info="Use {{variable}} to personalise, e.g. {{name}}. Values are passed when the call is placed."
      >
        <div className="flex flex-col gap-5">
          <LocalizedText
            value={draft.welcomeMessage}
            onChange={(v) => patch((d) => void (d.welcomeMessage = v))}
            codes={codes}
            defaultCode={draft.defaultLanguage}
            rows={2}
            placeholder="Good morning! I'm Priya from Dr. Agarwal's Eye Hospital…"
          />
          <div className="grid gap-4 @xl:grid-cols-2">
            <ToggleRow
              icon={Hand}
              label="Ignore the caller until the welcome finishes"
              description="Stops the greeting being cut off by background noise or a 'hello'."
              checked={draft.ignoreSpeechBeforeWelcome}
              onCheckedChange={(v) => patch((d) => void (d.ignoreSpeechBeforeWelcome = v))}
            />
            <SliderField
              label="Wait before speaking"
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
        title="Agent prompt"
        description="Who the agent is, what it must achieve, and how it should behave."
        actions={
          <>
            <AiEditButton />
            <Button variant="ghost" size="icon-sm" onClick={() => setExpanded(true)} aria-label="Expand editor">
              <Maximize2 />
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <LanguageChips codes={codes} value={lang} onChange={setPromptLang} defaultCode={draft.defaultLanguage} filled={draft.prompts} />
          {lang !== draft.defaultLanguage && !prompt && (
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
            <span className="tabular-nums">~{estimateTokens(prompt)} tokens</span>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        icon={PhoneOff}
        title="End the call with a prompt"
        description="After each reply, a small model checks whether the conversation is finished and hangs up."
        actions={
          <Switch
            checked={draft.hangupPrompt.enabled}
            onCheckedChange={(v) => patch((d) => void (d.hangupPrompt.enabled = v))}
            aria-label="End the call with a prompt"
          />
        }
      >
        {draft.hangupPrompt.enabled && (
          <Field label="Completion check">
            <Textarea
              rows={8}
              value={draft.hangupPrompt.prompt}
              onChange={(e) => patch((d) => void (d.hangupPrompt.prompt = e.target.value))}
            />
          </Field>
        )}
      </SectionCard>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent title={`Agent prompt · ${languageName(lang)}`} className="max-w-4xl">
          <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={26} className="leading-7" autoFocus />
          <p className="mt-2 text-right text-xs text-muted-foreground">~{estimateTokens(prompt)} tokens</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
