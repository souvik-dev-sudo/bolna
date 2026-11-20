import { useState } from "react";
import { Hourglass, MessageCircleQuestion, MessageSquareOff, Mic2, Timer } from "lucide-react";
import { Field, LocalizedText, SectionCard, SliderField, ToggleRow } from "@/components/form/fields";
import { Segmented, Switch } from "@/components/ui/controls";
import { limits } from "@/config/agent";
import { formatDuration } from "@/lib/format";
import { useDraft } from "../useAgentDraft";

const responsePresets = [
  { value: "fast", label: "Fast", ms: 100 },
  { value: "balanced", label: "Balanced", ms: 200 },
  { value: "relaxed", label: "Relaxed", ms: 400 },
] as const;

/** Bolna's "Response rate": pick a preset, or Custom to set the pause yourself. */
function ResponseRate() {
  const { draft, patch } = useDraft();
  const ms = draft.engine.linearDelayMs;
  const matched = responsePresets.find((p) => p.ms === ms)?.value;
  const [custom, setCustom] = useState(!matched);
  const value = custom ? "custom" : (matched ?? "custom");
  return (
    <div className="flex flex-col gap-4">
      <Field label="Response rate" info="How quickly the agent replies after the caller stops talking.">
        <Segmented
          value={value}
          onChange={(v) => {
            if (v === "custom") return setCustom(true);
            setCustom(false);
            const preset = responsePresets.find((p) => p.value === v)!;
            patch((d) => void (d.engine.linearDelayMs = preset.ms));
          }}
          options={[...responsePresets.map((p) => ({ value: p.value as string, label: p.label })), { value: "custom", label: "Custom" }]}
        />
      </Field>
      {value === "custom" ? (
        <SliderField
          label="Wait after the caller stops"
          info="Extra pause before replying, so the agent doesn't jump in mid-thought."
          value={ms}
          onChange={(v) => patch((d) => void (d.engine.linearDelayMs = v))}
          unit="ms"
          {...limits.linearDelayMs}
        />
      ) : (
        <p className="text-xs text-muted-foreground">Waits {ms} ms after the caller stops before replying.</p>
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
        <SectionCard icon={Timer} title="Response timing" info="Agent-wide; applies to every language.">
          <div className="flex flex-col gap-3">
            <ResponseRate />
            {turnDetectingAsr && (
              <p className="text-xs text-muted-foreground">saaras:v3 detects the end of a turn itself, so only this pause applies.</p>
            )}
          </div>
        </SectionCard>
        <SectionCard icon={Mic2} title="Interruptions">
          <SliderField
            label="Words before the caller can interrupt"
            info="How many words the caller must say before the agent stops talking. 0 = any sound interrupts."
            value={e.wordsBeforeInterrupt}
            onChange={(v) => patch((d) => void (d.engine.wordsBeforeInterrupt = v))}
            {...limits.wordsBeforeInterrupt}
          />
        </SectionCard>
      </div>

      <SectionCard
        icon={MessageCircleQuestion}
        title="Check the caller is still there"
        description="If the line goes quiet, the agent asks whether the caller is still on."
        actions={
          <Switch
            checked={e.userOnline.enabled}
            onCheckedChange={(v) => patch((d) => void (d.engine.userOnline.enabled = v))}
            aria-label="Check the caller is still there"
          />
        }
      >
        {e.userOnline.enabled && (
          <div className="grid gap-5 @3xl:grid-cols-[1fr_320px]">
            <Field label="Message">
              <LocalizedText
                value={e.userOnline.message}
                onChange={(v) => patch((d) => void (d.engine.userOnline.message = v))}
                codes={codes}
                defaultCode={draft.defaultLanguage}
                rows={2}
                showCount
                placeholder="Hello, are you still on the line?"
              />
            </Field>
            <SliderField
              label="Ask after"
              value={e.userOnline.afterSeconds}
              onChange={(v) => patch((d) => void (d.engine.userOnline.afterSeconds = v))}
              unit="s"
              {...limits.userOnlineAfterSeconds}
            />
          </div>
        )}
      </SectionCard>

      <div className="grid gap-5 @3xl:grid-cols-2">
        <SectionCard icon={MessageSquareOff} title="Final message" description="Said just before the agent hangs up.">
          <div className="flex flex-col gap-4">
            <LocalizedText
              value={e.finalMessage}
              onChange={(v) => patch((d) => void (d.engine.finalMessage = v))}
              codes={codes}
              defaultCode={draft.defaultLanguage}
              rows={2}
              showCount
              placeholder="Thank you for your time. Goodbye!"
            />
            <ToggleRow
              label="Caller can interrupt the final message"
              checked={e.finalMessageInterruptible}
              onCheckedChange={(v) => patch((d) => void (d.engine.finalMessageInterruptible = v))}
            />
          </div>
        </SectionCard>

        <SectionCard icon={Hourglass} title="Call limits">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-heading">Hang up when the caller is silent</span>
                <Switch
                  checked={e.hangupOnSilence.enabled}
                  onCheckedChange={(v) => patch((d) => void (d.engine.hangupOnSilence.enabled = v))}
                  aria-label="Hang up on silence"
                />
              </div>
              <SliderField
                label="Silence limit"
                disabled={!e.hangupOnSilence.enabled}
                value={e.hangupOnSilence.seconds}
                onChange={(v) => patch((d) => void (d.engine.hangupOnSilence.seconds = v))}
                unit="s"
                {...limits.hangupOnSilenceSeconds}
              />
            </div>
            <SliderField
              label={`Maximum call length · ${formatDuration(e.callTimeoutSeconds)}`}
              info="The call ends automatically at this length."
              value={e.callTimeoutSeconds}
              onChange={(v) => patch((d) => void (d.engine.callTimeoutSeconds = v))}
              unit="s"
              {...limits.callTimeoutSeconds}
            />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
