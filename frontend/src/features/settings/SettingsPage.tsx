import { AudioLines, BrainCircuit, Building2, CheckCircle2, CircleDashed, Hash, Mic, PhoneCall, Plug } from "lucide-react";
import { toast } from "sonner";
import { Field, PendingNote, SectionCard } from "@/components/form/fields";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProviderIcon } from "@/components/ProviderIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, Tabs, TabsContent, TabsList, TabsTrigger, Td, Th } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";
import { languages } from "@/config/languages";
import { llmProviders, telephonyProviders, transcriberProviders, voiceProviders } from "@/config/providers";
import { useAgents } from "@/hooks/queries";
import { useHospital } from "@/hooks/useHospital";

function ProviderGroup({ icon, title, providers }: { icon: typeof Plug; title: string; providers: readonly { id: string; label: string; configured: boolean }[] }) {
  return (
    <SectionCard icon={icon} title={title}>
      <div className="grid gap-2">
        {providers.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
            <ProviderIcon id={p.id} className="h-7 w-7 text-[11px]" />
            <span className="flex-1 text-sm font-medium text-heading">{p.label}</span>
            {p.configured ? (
              <Badge tone="success" icon={CheckCircle2}>
                Connected
              </Badge>
            ) : (
              <Badge tone="neutral" icon={CircleDashed}>
                Not configured
              </Badge>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

const numbers = [
  { number: "+91 80 4718 2290", provider: "plivo", region: "Bengaluru", agentId: "9c11a4e2-5b7d-4f0e-9a51-3e0c8d2f6b10" },
  { number: "+91 44 6677 8899", provider: "plivo", region: "Chennai", agentId: "" },
];

export function SettingsPage() {
  const [hospital] = useHospital();
  const { data: agents = [] } = useAgents();
  return (
    <>
      <PageHeader title="Settings" description="Providers, phone numbers and workspace preferences." />
      <Tabs defaultValue="providers">
        <TabsList className="mb-5">
          <TabsTrigger value="providers">
            <Plug /> Providers
          </TabsTrigger>
          <TabsTrigger value="numbers">
            <Hash /> Phone numbers
          </TabsTrigger>
          <TabsTrigger value="workspace">
            <Building2 /> Workspace
          </TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="flex flex-col gap-5 @container">
          <PendingNote>Keys are managed on the server (Secret Manager) and never shown here. This page shows which providers are available.</PendingNote>
          <div className="grid gap-5 xl:grid-cols-2">
            <ProviderGroup icon={BrainCircuit} title="Language models" providers={llmProviders} />
            <ProviderGroup icon={AudioLines} title="Voices" providers={voiceProviders} />
            <ProviderGroup icon={Mic} title="Speech recognition" providers={transcriberProviders} />
            <ProviderGroup icon={PhoneCall} title="Telephony" providers={telephonyProviders} />
          </div>
        </TabsContent>

        <TabsContent value="numbers">
          <div className="overflow-hidden rounded-xl border bg-card shadow-soft">
            <Table>
              <thead>
                <tr>
                  <Th>Number</Th>
                  <Th>Provider</Th>
                  <Th>Region</Th>
                  <Th>Inbound agent</Th>
                </tr>
              </thead>
              <tbody>
                {numbers.map((n) => (
                  <tr key={n.number}>
                    <Td className="font-medium tabular-nums">{n.number}</Td>
                    <Td>
                      <span className="flex items-center gap-2">
                        <ProviderIcon id={n.provider} /> Plivo
                      </span>
                    </Td>
                    <Td className="text-muted-foreground">{n.region}</Td>
                    <Td>
                      <Select
                        size="sm"
                        className="w-64"
                        value={n.agentId || "none"}
                        onValueChange={() => toast.info("Inbound routing connects in tracker A5.6.")}
                        options={[{ value: "none", label: "Not answering" }, ...agents.map((a) => ({ value: a.id, label: a.name }))]}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="workspace">
          <SectionCard icon={Building2} title="Workspace" className="max-w-2xl">
            <div className="flex flex-col gap-4">
              <Field label="Workspace name">
                <Input key={hospital.id} defaultValue={hospital.name} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Time zone">
                  <Select value="Asia/Kolkata" onValueChange={() => undefined} options={[{ value: "Asia/Kolkata", label: "India (IST, UTC+5:30)" }]} />
                </Field>
                <Field label="Default language for new agents">
                  <Select value="en" onValueChange={() => undefined} options={languages.map((l) => ({ value: l.code, label: l.name }))} />
                </Field>
              </div>
              <Button className="self-start" onClick={() => toast.success("Workspace settings saved")}>
                Save changes
              </Button>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </>
  );
}
