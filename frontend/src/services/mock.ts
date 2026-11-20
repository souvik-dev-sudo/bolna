import { app } from "@/config/app";

/** Simulated network delay so loading states show while the UI runs on mock data. */
export const delay = (ms: number = app.mockLatencyMs) => new Promise((resolve) => setTimeout(resolve, ms));

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = "NotFoundError";
  }
}

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
