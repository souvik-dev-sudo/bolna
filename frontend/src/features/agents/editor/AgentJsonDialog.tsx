import { useEffect, useState } from "react";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { downloadText } from "@/lib/format";
import { getAgentJson } from "@/services/agents";
import type { AgentForm } from "@/types/agent";

/** Shows the Bolna JSON the current draft would save as. */
export function AgentJsonDialog({ open, onOpenChange, agent }: { open: boolean; onOpenChange: (o: boolean) => void; agent: AgentForm }) {
  const [json, setJson] = useState("");
  useEffect(() => {
    if (open) void getAgentJson(agent).then((p) => setJson(JSON.stringify(p, null, 2)));
  }, [open, agent]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Agent JSON"
        description="Exactly what gets stored for this agent. Useful for debugging and the API."
        className="max-w-3xl"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(json);
                toast.success("JSON copied");
              }}
            >
              <Copy /> Copy
            </Button>
            <Button onClick={() => downloadText(`${agent.name.replace(/\W+/g, "-").toLowerCase()}.json`, json, "application/json")}>
              <Download /> Download
            </Button>
          </>
        }
      >
        <pre className="max-h-[60vh] overflow-auto rounded-lg bg-hero p-4 font-mono text-xs leading-relaxed text-[#C9CDF6] scrollbar-thin">
          {json || "Loading…"}
        </pre>
      </DialogContent>
    </Dialog>
  );
}
