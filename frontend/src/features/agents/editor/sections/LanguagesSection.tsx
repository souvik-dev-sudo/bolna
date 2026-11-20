import { useState } from "react";
import { AudioLines, Languages, Mic, Plus, Star, UsersRound, X } from "lucide-react";
import { Field, SectionCard } from "@/components/form/fields";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { Input, Textarea } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger, Tooltip } from "@/components/ui/overlays";
import { Select } from "@/components/ui/select";
import { defaultLanguageSettings } from "@/config/agent";
import { languageName, languages, languageSwitchModes } from "@/config/languages";
import { autoDetectProviders } from "@/lib/agentMapper";
import { findTranscriberProvider, findVoiceProvider, transcriberProviders, voiceProviders, voicesFor } from "@/config/providers";
import { cn } from "@/lib/utils";
import { useDraft } from "../useAgentDraft";
import { modelOptions, providerOptions } from "./IntelligenceSection";

function LanguageManager() {
  const { draft, patch } = useDraft();
  const used = new Set(draft.languages.map((l) => l.code));
  const others = draft.languages.filter((l) => l.code !== draft.defaultLanguage).map((l) => languageName(l.code));
  const defaultTranscriber = draft.languages.find((l) => l.code === draft.defaultLanguage)?.transcriber.provider;

  const add = (code: string) =>
    patch((d) => {
      d.languages.push(defaultLanguageSettings(code));
    });
  const remove = (code: string) =>
    patch((d) => {
      d.languages = d.languages.filter((l) => l.code !== code);
      if (d.defaultLanguage === code) d.defaultLanguage = d.languages[0].code;
      delete d.prompts[code];
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {draft.languages.map((l) => {
          const isDefault = l.code === draft.defaultLanguage;
          return (
            <span
              key={l.code}
              className={cn(
                "inline-flex items-center gap-1 rounded-pill border py-1 pl-3 pr-1 text-sm font-medium",
                isDefault ? "border-primary-border bg-primary-soft text-primary-hover" : "bg-card text-heading",
              )}
            >
              {languageName(l.code)}
              {isDefault ? (
                <span className="ml-1 text-[11px] font-normal opacity-80">(Default)</span>
              ) : (
                <Tooltip content="Make default">
                  <button
                    onClick={() => patch((d) => void (d.defaultLanguage = l.code))}
                    className="rounded-full p-1 text-placeholder hover:bg-muted hover:text-primary"
                    aria-label={`Make ${languageName(l.code)} the default`}
                  >
                    <Star className="h-3.5 w-3.5" />
                  </button>
                </Tooltip>
              )}
              {draft.languages.length > 1 && (
                <button
                  onClick={() => remove(l.code)}
                  className="rounded-full p-1 text-placeholder hover:bg-danger-soft hover:text-danger"
                  aria-label={`Remove ${languageName(l.code)}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </span>
          );
        })}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="secondary" size="sm">
              <Plus /> Add language
            </Button>
          </PopoverTrigger>
          <PopoverContent className="grid w-72 grid-cols-2 gap-1 p-1.5">
            {languages
              .filter((l) => !used.has(l.code))
              .map((l) => (
                <button
                  key={l.code}
                  onClick={() => add(l.code)}
                  className="flex flex-col rounded-sm px-2.5 py-1.5 text-left hover:bg-primary-soft"
                >
                  <span className="text-sm font-medium text-heading">{l.name}</span>
                  <span className="text-xs text-muted-foreground text-indic">{l.native}</span>
                </button>
              ))}
          </PopoverContent>
        </Popover>
      </div>
      {others.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {/* One span, so flex gap doesn't put a space before the comma */}
          <span>
            Starts in <strong className="text-heading">{languageName(draft.defaultLanguage)}</strong>, can move to{" "}
            <strong className="text-heading">{others.join(", ")}</strong> when
          </span>
          <Select
            size="sm"
            className="w-auto min-w-[220px]"
            value={draft.languageSwitchMode}
            options={languageSwitchModes.map((m) => ({ value: m.value, label: m.label }))}
            onValueChange={(v) => patch((d) => void (d.languageSwitchMode = v as typeof d.languageSwitchMode))}
          />
        </div>
      )}
      {others.length > 0 && draft.languageSwitchMode === "auto" && !autoDetectProviders.includes(defaultTranscriber ?? "") && (
        <p className="text-xs text-warning">
          Auto detection needs sarvam or gemini transcription for {languageName(draft.defaultLanguage)}. With {defaultTranscriber} this
          saves as "requested".
        </p>
      )}
    </div>
  );
}

export function LanguagesSection() {
  const { draft, patch } = useDraft();
  const [active, setActive] = useState(draft.defaultLanguage);
  const code = draft.languages.some((l) => l.code === active) ? active : draft.defaultLanguage;
  const index = draft.languages.findIndex((l) => l.code === code);
  const lang = draft.languages[index];
  const voiceProvider = findVoiceProvider(lang.voice.provider);
  const transcriberProvider = findTranscriberProvider(lang.transcriber.provider);
  const voices = voicesFor(lang.voice.provider, code);
  const allVoices = voicesFor(lang.voice.provider);
  const voiceList = voices.length ? voices : allVoices;
  const voiceSelectOptions = voiceList.map((v) => ({
    value: v.id,
    label: v.name,
    hint: v.gender === "female" ? "Female" : v.gender === "male" ? "Male" : undefined,
  }));
  // A voice saved outside our catalog (e.g. a Cartesia id set by hand) still shows, as its id.
  if (lang.voice.voiceId && !voiceSelectOptions.some((o) => o.value === lang.voice.voiceId)) {
    voiceSelectOptions.unshift({ value: lang.voice.voiceId, label: lang.voice.voiceId, hint: undefined });
  }
  // Bolna shows transcription providers by id ("sarvam"); Gemini speech-to-text needs Vertex (VM only).
  const transcriberOptions = providerOptions(transcriberProviders.map((p) => ({ ...p, label: p.id }))).map((o) =>
    o.value === "gemini" ? { ...o } : o,
  );
  const set = (fn: (l: typeof lang) => void) => patch((d) => fn(d.languages[index]));

  return (
    <div className="flex flex-col gap-5">
      <SectionCard icon={Languages} title="Languages" info="Which languages the agent can speak, and when it switches.">
        <LanguageManager />
      </SectionCard>

      <SectionCard
        icon={AudioLines}
        title="Settings for"
        info="Each language can use its own voice and speech recognition."
        actions={
          draft.languages.length > 1 && (
            <Segmented
              size="sm"
              value={code}
              onChange={setActive}
              options={draft.languages.map((l) => ({ value: l.code, label: languageName(l.code) }))}
            />
          )
        }
      >
        <div className="flex flex-col gap-6">
          <div>
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <AudioLines className="h-4 w-4 text-primary" /> Voice
            </h4>
            <div className="grid gap-4 @xl:grid-cols-3">
              <Field label="Provider">
                <Select
                  value={lang.voice.provider}
                  options={providerOptions(voiceProviders)}
                  onValueChange={(v) =>
                    set((l) => {
                      const p = findVoiceProvider(v);
                      l.voice = { provider: v, model: p?.models[0]?.id ?? "", voiceId: voicesFor(v, code)[0]?.id ?? p?.voices[0]?.id ?? "" };
                    })
                  }
                />
              </Field>
              <Field label="Model">
                <Select
                  value={lang.voice.model}
                  options={modelOptions(voiceProvider?.models ?? [])}
                  onValueChange={(v) => set((l) => void (l.voice.model = v))}
                />
              </Field>
              <Field label="Voice">
                <Select
                  value={lang.voice.voiceId}
                  options={voiceSelectOptions}
                  onValueChange={(v) => set((l) => void (l.voice.voiceId = v))}
                />
              </Field>
            </div>
          </div>

          <div className="border-t pt-5">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Mic className="h-4 w-4 text-primary" /> Transcription
            </h4>
            <div className="grid gap-4 @xl:grid-cols-2">
              <Field label="Provider">
                <Select
                  value={lang.transcriber.provider}
                  options={transcriberOptions}
                  onValueChange={(v) =>
                    set((l) => {
                      l.transcriber.provider = v;
                      l.transcriber.model = findTranscriberProvider(v)?.models[0]?.id ?? "";
                    })
                  }
                />
              </Field>
              <Field label="Model">
                <Select
                  value={lang.transcriber.model}
                  options={modelOptions(transcriberProvider?.models ?? [])}
                  onValueChange={(v) => set((l) => void (l.transcriber.model = v))}
                />
              </Field>
              <Field
                label="Keywords"
                info="Words the recogniser should expect: names, places, medicines. Comma separated. Sarvam does not use keywords; give it the Context instead."
              >
                <Textarea
                  rows={3}
                  value={lang.transcriber.keywords}
                  onChange={(e) => set((l) => void (l.transcriber.keywords = e.target.value))}
                  placeholder="Bolna, account number, customer service"
                />
              </Field>
              <Field label="Context" info="One or two sentences describing the call, to improve accuracy. Sarvam receives it as its prompt.">
                <Textarea
                  rows={3}
                  value={lang.transcriber.context}
                  onChange={(e) => set((l) => void (l.transcriber.context = e.target.value))}
                  placeholder="Inbound support line for an electronics retailer. Callers ask about order status, returns and warranty claims."
                />
              </Field>
            </div>
          </div>

          {draft.languages.length > 1 && (
            <div className="border-t pt-5">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <UsersRound className="h-4 w-4 text-primary" /> Hand-in <span className="font-normal text-muted-foreground">optional</span>
              </h4>
              <div className="grid gap-4 @xl:grid-cols-2">
                <Field label="Agent name" info="The name the agent uses after switching to this language; fills {agent_name} in the hand-in message.">
                  <Input value={lang.handIn.agentName} onChange={(e) => set((l) => void (l.handIn.agentName = e.target.value))} placeholder="Priya" />
                </Field>
                <Field label="Hand-in message" info="Said once when the call switches to this language. {agent_name} and {language} are filled in.">
                  <Input
                    className="text-indic"
                    value={lang.handIn.message}
                    onChange={(e) => set((l) => void (l.handIn.message = e.target.value))}
                    placeholder={`Connecting you to {agent_name}, who speaks ${languageName(code)}.`}
                  />
                </Field>
              </div>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
