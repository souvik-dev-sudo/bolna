import { PhoneForwarded, type LucideIcon } from "lucide-react";

// Calendar availability, Book appointment and Web search are skipped for now (tracker A7.5, A7.6):
// the engine has no support for them.
export type ToolKind = "transfer_call" | "custom";

export interface ToolCatalogItem {
  kind: Exclude<ToolKind, "custom">;
  name: string;
  description: string;
  icon: LucideIcon;
}

/** Prebuilt tools offered in the Tools section. */
export const toolCatalog: ToolCatalogItem[] = [
  {
    kind: "transfer_call",
    name: "Transfer Call",
    description: "Route call to human",
    icon: PhoneForwarded,
  },
];

export const httpMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
