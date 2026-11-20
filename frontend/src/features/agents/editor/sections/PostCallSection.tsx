import { useState } from "react";
import { Activity, FileText, Library, ListChecks, Plus, Send, Trash2, Webhook } from "lucide-react";
import { toast } from "sonner";
import { Field, SectionCard, ToggleRow } from "@/components/form/fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/controls";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";
import { callStatuses, type CallStatus } from "@/config/calls";
import { delay, newId } from "@/services/mock";
import { cn } from "@/lib/utils";
import { useDraft } from "../useAgentDraft";

const extractionLibrary = [
  { name: "appointment_confirmed", description: "yes / no / reschedule: whether the patient confirmed the appointment" },
  { name: "new_slot", description: "The new date and time agreed, if rescheduled" },
  { name: "callback_requested", description: "yes if the caller asked to be called back, with the preferred time" },
  { name: "sentiment", description: "positive / neutral / negative overall tone of the caller" },
  { name: "pain_level", description: "Pain on a 0-10 scale as reported by the patient" },
  { name: "red_flag", description: "yes if severe pain, sudden vision loss or discharge was mentioned" },
  { name: "preferred_language", description: "The language the caller chose" },
];

const statusOptions: CallStatus[] = ["completed", "no-answer", "busy", "failed", "canceled"];

export function PostCallSection() {
  const { draft, patch } = useDraft();
  const w = draft.webhook;
  const [sending, setSending] = useState(false);

  const sendTest = async () => {
    if (!/^https?:\/\//.test(w.url)) {
      toast.error("Enter a webhook URL starting with https://");
      return;
    }
    setSending(true);
    await delay(900);
    setSending(false);
    toast.success("Sample ‘completed’ payload sent", { description: "Real delivery starts once the backend is connected (tracker A8.3)." });
  };

  return (
    <div className="flex flex-col gap-5">
      <SectionCard
        icon={Webhook}
        title="Webhook"
        description="We POST the call result (status, transcript, extracted data) to your URL after every call."
        actions={
          <Button variant="secondary" size="sm" onClick={() => toast.info("Delivery health appears once webhooks are live (tracker A8.4).")}>
            <Activity /> Delivery health
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Webhook URL">
            <div className="flex gap-2">
              <Input
                value={w.url}
                onChange={(e) => patch((d) => void (d.webhook.url = e.target.value))}
                placeholder="https://your-endpoint.com/webhook"
                className="font-mono"
              />
              <Button variant="secondary" onClick={sendTest} loading={sending}>
                <Send /> Send test
              </Button>
            </div>
          </Field>
          <Field label="Send for" info="Leave all unselected to send for every status.">
            <div className="flex flex-wrap gap-1.5">
              {statusOptions.map((s) => {
                const on = w.statuses.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      patch((d) => void (d.webhook.statuses = on ? d.webhook.statuses.filter((x) => x !== s) : [...d.webhook.statuses, s]))
                    }
                    className={cn(
                      "rounded-pill border px-3 py-1 text-xs font-medium transition-colors",
                      on ? "border-primary-border bg-primary-soft text-primary-hover" : "bg-card text-muted-foreground hover:border-border-strong",
                    )}
                  >
                    {callStatuses[s].label}
                  </button>
                );
              })}
              {w.statuses.length === 0 && <span className="self-center text-xs text-muted-foreground">All statuses</span>}
            </div>
          </Field>
          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <span className="text-sm font-medium text-heading">Custom headers</span>
            <Switch checked={w.headersEnabled} onCheckedChange={(v) => patch((d) => void (d.webhook.headersEnabled = v))} aria-label="Custom headers" />
          </div>
          {w.headersEnabled && (
            <div className="flex flex-col gap-2">
              {w.headers.map((h, i) => (
                <div key={i} className="grid grid-cols-[1fr_1.5fr_auto] gap-2">
                  <Input value={h.key} placeholder="X-Api-Key" onChange={(e) => patch((d) => void (d.webhook.headers[i].key = e.target.value))} />
                  <Input value={h.value} placeholder="value" onChange={(e) => patch((d) => void (d.webhook.headers[i].value = e.target.value))} />
                  <Button variant="danger-ghost" size="icon-sm" aria-label="Remove header" onClick={() => patch((d) => void d.webhook.headers.splice(i, 1))}>
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="self-start" onClick={() => patch((d) => void d.webhook.headers.push({ key: "", value: "" }))}>
                <Plus /> Add header
              </Button>
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard
        icon={ListChecks}
        title="Summary & extraction"
        description="After the call, an LLM reads the transcript and fills in these fields."
        actions={
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="secondary" size="sm">
                <Library /> Field library
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-1">
              {extractionLibrary.map((f) => {
                const added = draft.extractions.categories.some((c) => c.name === f.name);
                return (
                  <button
                    key={f.name}
                    disabled={added}
                    onClick={() => patch((d) => void d.extractions.categories.push({ id: newId(), ...f }))}
                    className="flex w-full flex-col rounded-sm px-2.5 py-2 text-left hover:bg-primary-soft disabled:opacity-50"
                  >
                    <span className="font-mono text-xs font-medium text-heading">{f.name}</span>
                    <span className="text-xs text-muted-foreground">{f.description}</span>
                  </button>
                );
              })}
            </PopoverContent>
          </Popover>
        }
      >
        <div className="flex flex-col gap-3">
          <ToggleRow
            icon={FileText}
            label="Call summary"
            description="A two-line summary of every call, shown in call history."
            checked={draft.extractions.summary}
            onCheckedChange={(v) => patch((d) => void (d.extractions.summary = v))}
          />
          {draft.extractions.categories.map((c, i) => (
            <div key={c.id} className="grid gap-2 rounded-lg border px-4 py-3 @xl:grid-cols-[220px_1fr_auto] @xl:items-center">
              <Input
                value={c.name}
                className="font-mono"
                placeholder="field_name"
                onChange={(e) => patch((d) => void (d.extractions.categories[i].name = e.target.value))}
              />
              <Input
                value={c.description}
                placeholder="What to extract and the allowed values"
                onChange={(e) => patch((d) => void (d.extractions.categories[i].description = e.target.value))}
              />
              <Button
                variant="danger-ghost"
                size="icon-sm"
                aria-label="Remove field"
                onClick={() => patch((d) => void d.extractions.categories.splice(i, 1))}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => patch((d) => void d.extractions.categories.push({ id: newId(), name: "", description: "" }))}
            className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary-hover"
          >
            <Plus className="h-4 w-4" /> Add field
          </button>
          {draft.extractions.categories.length > 0 && (
            <p className="text-xs text-muted-foreground">
              <Badge tone="info">{draft.extractions.categories.length}</Badge> fields will appear on each call's detail page.
            </p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
