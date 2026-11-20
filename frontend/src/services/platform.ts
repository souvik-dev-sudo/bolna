// Live platform checks. These already hit the real backend.
import { bolnaApi } from "@/lib/api";

export interface DbHealth {
  status: "ok";
  database: string;
  server_version: string;
  latency_ms: number;
  write_check: "ok" | "failed";
}

export const checkAgentServer = () => bolnaApi.get<{ agents: unknown[] }>("/all");
export const checkDatabase = () => bolnaApi.get<DbHealth>("/db/health");
