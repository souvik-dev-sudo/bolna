import { Library, ListChecks, Plus, Trash2, Webhook } from "lucide-react";
import { Field, SectionCard, ToggleRow } from "@/components/form/fields";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/controls";
import { Input, Textarea } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";
import { categoryProblem, webhookUrlProblem } from "@/lib/agentValidation";
import { newId } from "@/services/mock";
import { useDraft } from "../useAgentDraft";

/** Prebuilt categories (front-end templates). Names become the keys of extracted_data. */
const extractionLibrary = [
  { name: "appointment_confirmed", description: "yes / no / reschedule: whether the patient confirmed the appointment" },
  { name: "new_slot", description: "The new date and time agreed, if rescheduled" },
  { name: "callback_requested", description: "yes if the caller asked to be called back, with the preferred time" },
  { name: "sentiment", description: "positive / neutral / negative overall tone of the caller" },
  { name: "pain_level", description: "Pain on a 0-10 scale as reported by the patient" },
  { name: "red_flag", description: "yes if severe pain, sudden vision loss or discharge was mentioned" },
  { name: "preferred_language", description: "The language the caller chose" },
];

/*
 * Skipped for now (tracker): Trigger on statuses (A8.2), Send test (A8.3), Delivery health (A8.4)
 * and the extraction Test button (A8.6).
 */
export function PostCallSection() {
  const { draft, patch } = useDraft();
  const w = draft.webhook;
  const categories = draft.extractions.categories;
  const urlProblem = webhookUrlProblem(w.url);

  return (
    <div className="flex flex-col gap-5">
      <SectionCard
        icon={Webhook}
        title="Webhook Configuration"
        info="After every call we POST the call result (status, transcript, summary, extracted data) to this URL."
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 @xl:grid-cols-[1fr_auto] @xl:items-end">
            <Field label="Webhook URL" info="Must accept a POST with a JSON body. Leave empty to send nothing.">
              <Input
                value={w.url}
                onChange={(e) => patch((d) => void (d.webhook.url = e.target.value))}
                placeholder="https://your-endpoint.com/webhook"
                className="font-mono"
                aria-invalid={Boolean(urlProblem)}
              />
            </Field>
            <label className="flex h-10 items-center gap-3 text-sm font-medium text-heading">
              Add headers
              <Switch
                checked={w.headersEnabled}
                onCheckedChange={(v) =>
                  patch((d) => {
                    d.webhook.headersEnabled = v;
                    if (v && d.webhook.headers.length === 0) d.webhook.headers.push({ key: "", value: "" });
                  })
                }
                aria-label="Add headers"
              />
            </label>
          </div>
          {urlProblem && <p className="-mt-2 text-xs text-danger">{urlProblem}</p>}
          {w.headersEnabled && (
            <div className="flex flex-col gap-2">
              {w.headers.map((h, i) => (
                <div key={i} className="grid grid-cols-[1fr_1.5fr_auto] gap-2">
                  <Input value={h.key} placeholder="Authorization" onChange={(e) => patch((d) => void (d.webhook.headers[i].key = e.target.value))} />
                  <Input value={h.value} placeholder="Bearer …" onChange={(e) => patch((d) => void (d.webhook.headers[i].value = e.target.value))} />
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
        title="Extractions"
        info="After the call, an LLM reads the transcript and fills in each category. The results are saved with the call and sent to your webhook as extracted_data."
        actions={
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="secondary" size="sm">
                <Library /> Extraction Library
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-1">
              {extractionLibrary.map((f) => {
                const added = categories.some((c) => c.name.trim() === f.name);
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
            label="Call Summary"
            description="Generate a call summary after each call"
            checked={draft.extractions.summary}
            onCheckedChange={(v) => patch((d) => void (d.extractions.summary = v))}
          />
          {categories.map((c, i) => {
            const problem = categoryProblem(c, categories);
            return (
              <div key={c.id} className="flex flex-col gap-2 rounded-lg border px-4 py-3">
                <div className="grid gap-2 @xl:grid-cols-[240px_1fr_auto] @xl:items-start">
                  <Input
                    value={c.name}
                    className="font-mono"
                    placeholder="category_name"
                    aria-label="Category name"
                    aria-invalid={Boolean(problem)}
                    onChange={(e) => patch((d) => void (d.extractions.categories[i].name = e.target.value))}
                  />
                  <Textarea
                    rows={2}
                    value={c.description}
                    placeholder="What to extract, and the allowed values (e.g. yes / no / reschedule)"
                    aria-label="Category description"
                    onChange={(e) => patch((d) => void (d.extractions.categories[i].description = e.target.value))}
                  />
                  <Button
                    variant="danger-ghost"
                    size="icon-sm"
                    aria-label="Remove category"
                    onClick={() => patch((d) => void d.extractions.categories.splice(i, 1))}
                  >
                    <Trash2 />
                  </Button>
                </div>
                {problem && <p className="text-xs text-danger">{problem}</p>}
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => patch((d) => void d.extractions.categories.push({ id: newId(), name: "", description: "" }))}
            className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary-hover"
          >
            <Plus className="h-4 w-4" /> New Category
          </button>
        </div>
      </SectionCard>
    </div>
  );
}
