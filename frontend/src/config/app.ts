// Product identity and app-wide settings.

export const app = {
  company: "NexaNeura",
  /** The wordmark is drawn as "Nexa" + highlighted "Neura" (see components/brand/Wordmark). */
  wordmark: { lead: "Nexa", accent: "Neura" },
  product: "Voice Studio",
  workspace: { name: "NexaNeura", plan: "Pilot workspace" },
  supportEmail: "support@nexaneura.com",
  website: "https://nexaneura.com",
  /** Simulated network delay for mock services, so loading states are visible while designing. */
  mockLatencyMs: 350,
  /** Rows per page offered in tables. */
  pageSizes: [10, 20, 50] as const,
  defaultPageSize: 20,
} as const;
