/**
 * Dashboard login (TRACKER F7), backed by bolna-app (local_setup/dashboard_auth.py).
 *
 *   me     -> GET  /api/bolna/auth/me      { signed_in, configured }
 *   login  -> POST /api/bolna/auth/login   { username, password }   sets the HttpOnly session cookie
 *   logout -> POST /api/bolna/auth/logout                 clears it
 *
 * The cookie is never readable here; every /api/* request carries it, and both backends check it.
 */
import { bolnaApi } from "@/lib/api";

export interface AuthState {
  signedIn: boolean;
  configured: boolean;
}

export async function me(): Promise<AuthState> {
  const r = await bolnaApi.get<{ signed_in: boolean; configured: boolean }>("/auth/me");
  return { signedIn: r.signed_in, configured: r.configured };
}

export async function login(username: string, password: string): Promise<void> {
  await bolnaApi.post("/auth/login", { username, password });
}

export async function logout(): Promise<void> {
  await bolnaApi.post("/auth/logout");
}

/** Only same-app paths are followed after sign-in (never "//evil.com" or a full URL). */
export function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : "/";
}
