import { CalendarCheck, CalendarSearch, Globe2, PhoneForwarded, type LucideIcon } from "lucide-react";

export type ToolKind = "transfer_call" | "calendar_availability" | "book_appointment" | "web_search" | "custom";

export interface ToolCatalogItem {
  kind: Exclude<ToolKind, "custom">;
  name: string;
  description: string;
  icon: LucideIcon;
  /** Shown as a note when the backend needs setup before the tool works. */
  requires?: string;
}

/** Prebuilt tools offered in the Tools section. */
export const toolCatalog: ToolCatalogItem[] = [
  {
    kind: "transfer_call",
    name: "Transfer call",
    description: "Hand the caller to a human on another number",
    icon: PhoneForwarded,
  },
  {
    kind: "calendar_availability",
    name: "Calendar availability",
    description: "Check open appointment slots",
    icon: CalendarSearch,
    requires: "Needs a Cal.com account",
  },
  {
    kind: "book_appointment",
    name: "Book appointment",
    description: "Create a calendar booking",
    icon: CalendarCheck,
    requires: "Needs a Cal.com account",
  },
  {
    kind: "web_search",
    name: "Web search",
    description: "Look up live information on the web",
    icon: Globe2,
    requires: "Needs a search provider key",
  },
];

export const httpMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
