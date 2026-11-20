/**
 * Dashboard login (TRACKER F7), backed by bolna-app (local_setup/dashboard_auth.py).
 *
 *   me     -> GET  /api/bolna/auth/me      { signed_in, configured }
 *   login  -> POST /api/bolna/auth/login   { username, password }   sets the HttpOnly session cookie
 *   logout -> POST /api/bolna/auth/logout                 clears it
 *
 * The login returns a token, kept in this browser (lib/session) and sent with every request as
 * "Authorization: Bearer"; both backends check it.
 */
import { bolnaApi } from "@/lib/api";
import { setToken } from "@/lib/session";

export interface AuthState {
  signedIn: boolean;
  configured: boolean;
}

export async function me(): Promise<AuthState> {
  // /auth/me answers without a token too (signed_in: false), which also tells us if sign-in is configured.
  const r = await bolnaApi.get<{ signed_in: boolean; configured: boolean }>("/auth/me");
  return { signedIn: r.signed_in, configured: r.configured };
}

export async function login(username: string, password: string): Promise<void> {
  const r = await bolnaApi.post<{ token: string }>("/auth/login", { username, password });
  setToken(r.token);
}

export async function logout(): Promise<void> {
  // The token lives only in this browser, so forgetting it signs out. The server call clears the
  // cookie used by same-origin setups; its failure doesn't matter.
  setToken(null);
  await bolnaApi.post("/auth/logout").catch(() => undefined);
}

/** Only same-app paths are followed after sign-in (never "//evil.com" or a full URL). */
export function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : "/";
}
