import { Grid3x3, PhoneCall, Voicemail } from "lucide-react";
import { Field, SectionCard, SliderField, ToggleRow } from "@/components/form/fields";
import { ProviderIcon } from "@/components/ProviderIcon";
import { Select } from "@/components/ui/select";
import { limits } from "@/config/agent";
import { telephonyProviders } from "@/config/providers";
import { useDraft } from "../useAgentDraft";

/*
 * Skipped for now (tracker): Ambient Noise (A5.2) and Noise Cancellation (A5.4) have no engine
 * support; Auto Reschedule (A5.5), Inbound Calling (A5.6) and Outbound call timing restrictions
 * (A5.7) need a scheduler, campaigns or Plivo number routing.
 */
export function CallingSection() {
  const { draft, patch } = useDraft();
  const c = draft.calling;

  return (
    <div className="flex flex-col gap-5">
      <SectionCard icon={PhoneCall} title="Call Configuration">
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 @xl:grid-cols-2">
            <Field label="Telephony Provider">
              <Select
                value={c.telephonyProvider}
                options={telephonyProviders.map((p) => ({
                  value: p.id,
                  label: (
                    <span className="flex items-center gap-2">
                      <ProviderIcon id={p.id} /> {p.label}
                    </span>
                  ),
                  hint: "note" in p ? p.note : p.configured ? undefined : "Not configured",
                  disabled: !p.configured,
                }))}
                onValueChange={(v) => patch((d) => void (d.calling.telephonyProvider = v))}
              />
            </Field>
          </div>
          <div className="grid gap-3 @xl:grid-cols-2">
            <ToggleRow
              icon={Grid3x3}
              label="Keypad Input (DTMF)"
              info="Let callers press digits on their keypad, e.g. 1 to confirm. The digits reach the agent as text."
              checked={c.dtmf}
              onCheckedChange={(v) => patch((d) => void (d.calling.dtmf = v))}
            />
            <div className="flex flex-col gap-3">
              <ToggleRow
                icon={Voicemail}
                label="Voicemail Detection (in s)"
                info="Hang up when an answering machine picks up. The agent checks what it hears during the first seconds of the call."
                checked={c.voicemailDetection}
                onCheckedChange={(v) => patch((d) => void (d.calling.voicemailDetection = v))}
              />
              {c.voicemailDetection && (
                <SliderField
                  label={null}
                  className="px-1"
                  value={c.voicemailSeconds}
                  onChange={(v) => patch((d) => void (d.calling.voicemailSeconds = v))}
                  unit="s"
                  {...limits.voicemailSeconds}
                />
              )}
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
