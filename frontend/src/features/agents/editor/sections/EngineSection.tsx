import { useState } from "react";
import { Keyboard, MessageSquareText, MicOff, PhoneOff, Radio, Timer } from "lucide-react";
import { Field, LocalizedText, SectionCard, SliderField, ToggleRow } from "@/components/form/fields";
import { Switch } from "@/components/ui/controls";
import { Select } from "@/components/ui/select";
import { limits } from "@/config/agent";
import { useDraft } from "../useAgentDraft";

const responsePresets = [
  { value: "fast", label: "Fast", ms: 100 },
  { value: "balanced", label: "Balanced", ms: 200 },
  { value: "relaxed", label: "Relaxed", ms: 400 },
] as const;

/** Bolna's "Response Rate": pick a preset, or Custom to set the linear delay yourself. */
function ResponseRate() {
  const { draft, patch } = useDraft();
  const ms = draft.engine.linearDelayMs;
  const matched = responsePresets.find((p) => p.ms === ms)?.value;
  const [custom, setCustom] = useState(!matched);
  const value = custom ? "custom" : (matched ?? "custom");
  return (
    <div className="flex flex-col gap-4">
      <Field label="Response Rate">
        <Select
          value={value}
          options={[...responsePresets.map((p) => ({ value: p.value as string, label: p.label, hint: `${p.ms} ms` })), { value: "custom", label: "Custom" }]}
          onValueChange={(v) => {
            if (v === "custom") return setCustom(true);
            setCustom(false);
            const preset = responsePresets.find((p) => p.value === v)!;
            patch((d) => void (d.engine.linearDelayMs = preset.ms));
          }}
        />
      </Field>
      {value === "custom" && (
        <SliderField
          label="Linear delay (in ms)"
          info="Extra pause after the caller stops talking before the agent replies, so it doesn't jump in mid-thought."
          value={ms}
          onChange={(v) => patch((d) => void (d.engine.linearDelayMs = v))}
          unit="ms"
          {...limits.linearDelayMs}
        />
      )}
    </div>
  );
}

export function EngineSection() {
  const { draft, patch } = useDraft();
  const e = draft.engine;
  const codes = draft.languages.map((l) => l.code);
  const turnDetectingAsr = draft.languages.some((l) => l.transcriber.model === "saaras:v3");

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 @3xl:grid-cols-2">
        <SectionCard icon={Timer} title="Response Latency" info="How quickly the agent replies after the caller stops talking.">
          <div className="flex flex-col gap-3">
            <ResponseRate />
            <p className="text-xs text-muted-foreground">These timings are agent-wide and apply to every language on this agent.</p>
            {turnDetectingAsr && (
              <p className="text-xs text-muted-foreground">
                saaras:v3 detects end of turn on its own, so endpointing does not apply. Linear delay still does.
              </p>
            )}
          </div>
        </SectionCard>
        <SectionCard icon={Keyboard} title="Transcription & Interruptions" info="When the caller's speech stops the agent mid-sentence.">
          <SliderField
            label="Number of words to wait for before interrupting"
            info="How many words the caller must say before the agent stops talking. 0 = any sound interrupts."
            value={e.wordsBeforeInterrupt}
            onChange={(v) => patch((d) => void (d.engine.wordsBeforeInterrupt = v))}
            {...limits.wordsBeforeInterrupt}
          />
        </SectionCard>
      </div>

      <SectionCard
        icon={Radio}
        title={
          <span className="flex items-center gap-3">
            User Online Detection
            <Switch
              checked={e.userOnline.enabled}
              onCheckedChange={(v) => patch((d) => void (d.engine.userOnline.enabled = v))}
              aria-label="User Online Detection"
            />
          </span>
        }
      >
        {e.userOnline.enabled && (
          <div className="grid gap-5 @3xl:grid-cols-2">
            <LocalizedText
              value={e.userOnline.message}
              onChange={(v) => patch((d) => void (d.engine.userOnline.message = v))}
              codes={codes}
              defaultCode={draft.defaultLanguage}
              rows={2}
              showCount
              placeholder="Hello, are you still on the line?"
            />
            <SliderField
              label="Invoke message after (in s)"
              value={e.userOnline.afterSeconds}
              onChange={(v) => patch((d) => void (d.engine.userOnline.afterSeconds = v))}
              {...limits.userOnlineAfterSeconds}
            />
          </div>
        )}
      </SectionCard>

      <div className="grid gap-5 @3xl:grid-cols-2">
        <SectionCard icon={MessageSquareText} title="Final Call Message" info="Said just before the agent hangs up.">
          <div className="flex flex-col gap-4">
            <LocalizedText
              value={e.finalMessage}
              onChange={(v) => patch((d) => void (d.engine.finalMessage = v))}
              codes={codes}
              defaultCode={draft.defaultLanguage}
              rows={2}
              showCount
              placeholder="e.g. Thank you for your time. Goodbye!"
            />
            <ToggleRow
              label="Allow interruption"
              info="Let the caller talk over the final message."
              checked={e.finalMessageInterruptible}
              onCheckedChange={(v) => patch((d) => void (d.engine.finalMessageInterruptible = v))}
            />
          </div>
        </SectionCard>

        <SectionCard icon={PhoneOff} title="Call Management" info="When the agent ends the call on its own.">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-medium text-heading">
                  <MicOff className="h-4 w-4 text-muted-foreground" /> Hangup on User Silence (in s)
                </span>
                <Switch
                  checked={e.hangupOnSilence.enabled}
                  onCheckedChange={(v) => patch((d) => void (d.engine.hangupOnSilence.enabled = v))}
                  aria-label="Hangup on User Silence"
                />
              </div>
              <SliderField
                label={null}
                disabled={!e.hangupOnSilence.enabled}
                value={e.hangupOnSilence.seconds}
                onChange={(v) => patch((d) => void (d.engine.hangupOnSilence.seconds = v))}
                {...limits.hangupOnSilenceSeconds}
              />
            </div>
            <SliderField
              label="Total Call Timeout (in s)"
              info="The call ends automatically at this length."
              value={e.callTimeoutSeconds}
              onChange={(v) => patch((d) => void (d.engine.callTimeoutSeconds = v))}
              {...limits.callTimeoutSeconds}
            />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
