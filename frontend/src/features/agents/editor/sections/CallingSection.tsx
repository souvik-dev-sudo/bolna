import { Clock, Grid3x3, PhoneCall, PhoneIncoming, Play, Voicemail, Waves } from "lucide-react";
import { toast } from "sonner";
import { Field, PendingNote, SectionCard, SliderField, ToggleRow } from "@/components/form/fields";
import { ProviderIcon } from "@/components/ProviderIcon";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/controls";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/overlays";
import { Select } from "@/components/ui/select";
import { limits } from "@/config/agent";
import { ambientNoiseOptions, telephonyProviders } from "@/config/providers";
import { cn } from "@/lib/utils";
import { useDraft } from "../useAgentDraft";

const DAYS = [
  { id: "mon", label: "M" },
  { id: "tue", label: "T" },
  { id: "wed", label: "W" },
  { id: "thu", label: "T" },
  { id: "fri", label: "F" },
  { id: "sat", label: "S" },
  { id: "sun", label: "S" },
];

/** Numbers available on our Plivo account (mock until "My numbers" is connected). */
const ourNumbers = ["+91 80 4718 2290", "+91 44 6677 8899"];

export function CallingSection() {
  const { draft, patch } = useDraft();
  const c = draft.calling;

  return (
    <div className="flex flex-col gap-5">
      <SectionCard icon={PhoneCall} title="Call configuration">
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 @xl:grid-cols-2">
            <Field label="Telephony provider">
              <Select
                value={c.telephonyProvider}
                options={telephonyProviders.map((p) => ({
                  value: p.id,
                  label: (
                    <span className="flex items-center gap-2">
                      <ProviderIcon id={p.id} /> {p.label}
                    </span>
                  ),
                  hint: "note" in p ? p.note : p.configured ? undefined : "No key",
                  disabled: !p.configured,
                }))}
                onValueChange={(v) => patch((d) => void (d.calling.telephonyProvider = v))}
              />
            </Field>
            <Field label="Ambient noise" info="Soft background sound so silences feel natural.">
              <div className="flex gap-2">
                <Select
                  value={c.ambientNoise}
                  options={ambientNoiseOptions.map((o) => ({ value: o.id, label: o.label }))}
                  onValueChange={(v) => patch((d) => void (d.calling.ambientNoise = v))}
                />
                <Tooltip content="Preview">
                  <Button
                    variant="secondary"
                    size="icon"
                    disabled={c.ambientNoise === "none"}
                    aria-label="Preview ambient noise"
                    onClick={() => toast.info("Ambient previews play once the backend is connected.")}
                  >
                    <Play />
                  </Button>
                </Tooltip>
              </div>
            </Field>
          </div>
          <div className="grid gap-3 @xl:grid-cols-2">
            <ToggleRow
              icon={Waves}
              label="Noise cancellation"
              description="Filter street and crowd noise before transcription."
              checked={c.noiseCancellation}
              onCheckedChange={(v) => patch((d) => void (d.calling.noiseCancellation = v))}
            />
            <ToggleRow
              icon={Grid3x3}
              label="Keypad input (DTMF)"
              description="Let callers press digits, e.g. to confirm with 1."
              checked={c.dtmf}
              onCheckedChange={(v) => patch((d) => void (d.calling.dtmf = v))}
            />
            <ToggleRow
              icon={Voicemail}
              label="Voicemail detection"
              description="Hang up when an answering machine picks up."
              checked={c.voicemailDetection}
              onCheckedChange={(v) => patch((d) => void (d.calling.voicemailDetection = v))}
            />
            {c.voicemailDetection && (
              <div className="rounded-lg border px-4 py-3">
                <SliderField
                  label="Listen for voicemail during the first"
                  value={c.voicemailSeconds}
                  onChange={(v) => patch((d) => void (d.calling.voicemailSeconds = v))}
                  unit="s"
                  {...limits.voicemailSeconds}
                />
              </div>
            )}
          </div>
          {c.noiseCancellation && <PendingNote>Noise cancellation still needs to be confirmed in our Bolna build (tracker A5.4).</PendingNote>}
        </div>
      </SectionCard>

      <SectionCard
        icon={PhoneIncoming}
        title="Inbound calls"
        description="Answer calls to one of your numbers with this agent."
        actions={
          <Switch
            checked={c.inbound.enabled}
            onCheckedChange={(v) => patch((d) => void (d.calling.inbound.enabled = v))}
            aria-label="Inbound calls"
          />
        }
      >
        {c.inbound.enabled && (
          <div className="flex flex-col gap-3">
            <Field label="Answer calls on">
              <Select
                className="@xl:w-1/2"
                placeholder="Choose a number"
                value={c.inbound.number || undefined}
                options={ourNumbers.map((n) => ({ value: n, label: n }))}
                onValueChange={(v) => patch((d) => void (d.calling.inbound.number = v))}
              />
            </Field>
            <PendingNote>Inbound routing needs a Plivo answer URL per number (tracker A5.6).</PendingNote>
          </div>
        )}
      </SectionCard>

      <SectionCard
        icon={Clock}
        title="Outbound calling hours"
        description="Only place calls inside these hours, in the patient's time zone."
        actions={
          <Switch
            checked={c.callingHours.enabled}
            onCheckedChange={(v) => patch((d) => void (d.calling.callingHours.enabled = v))}
            aria-label="Outbound calling hours"
          />
        }
      >
        {c.callingHours.enabled && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-4">
              <Field label="From">
                <Input type="time" value={c.callingHours.start} onChange={(e) => patch((d) => void (d.calling.callingHours.start = e.target.value))} className="w-32" />
              </Field>
              <Field label="To">
                <Input type="time" value={c.callingHours.end} onChange={(e) => patch((d) => void (d.calling.callingHours.end = e.target.value))} className="w-32" />
              </Field>
              <Field label="Days">
                <div className="flex gap-1">
                  {DAYS.map((day) => {
                    const on = c.callingHours.days.includes(day.id);
                    return (
                      <button
                        key={day.id}
                        type="button"
                        aria-pressed={on}
                        aria-label={day.id}
                        onClick={() =>
                          patch((d) => {
                            const days = d.calling.callingHours.days;
                            d.calling.callingHours.days = on ? days.filter((x) => x !== day.id) : [...days, day.id];
                          })
                        }
                        className={cn(
                          "h-9 w-9 rounded-md border text-sm font-medium transition-colors",
                          on ? "border-primary bg-primary text-white" : "bg-card text-muted-foreground hover:border-border-strong",
                        )}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
            <PendingNote>Calling hours take effect with campaigns (tracker D1).</PendingNote>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
