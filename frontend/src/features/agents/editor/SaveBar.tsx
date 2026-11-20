import type { ReactNode } from "react";
import { RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useDraft } from "./useAgentDraft";

/**
 * Footer with the save state. It floats over the content only while there are unsaved changes;
 * when everything is saved it sits quietly at the end of the section instead of covering it.
 */
export function SaveBar({ extra }: { extra?: ReactNode }) {
  const { dirty, saving, save, discard, saved } = useDraft();
  return (
    <div className={cn("z-20 mt-6", dirty && "sticky bottom-4 animate-in fade-in-0 slide-in-from-bottom-2")}>
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 shadow-card backdrop-blur transition-colors",
          dirty ? "border-primary-border bg-card/95" : "bg-card/90",
        )}
      >
        <div className="flex items-center gap-2 text-sm">
          {dirty ? (
            <>
              <span className="h-2 w-2 rounded-full bg-warning" />
              <span className="font-medium text-heading">Unsaved changes</span>
            </>
          ) : (
            <span className="text-muted-foreground">Updated {relativeTime(saved.updatedAt)}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {extra}
          {dirty && (
            <Button variant="ghost" onClick={discard} disabled={saving}>
              <RotateCcw /> Discard
            </Button>
          )}
          <Button onClick={() => void save()} loading={saving} disabled={!dirty}>
            <Save /> Save agent
          </Button>
        </div>
      </div>
    </div>
  );
}
