import { useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, User } from "lucide-react";
import { Wordmark } from "@/components/brand/Wordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { app } from "@/config/app";
import { ApiError } from "@/lib/api";
import { login, me, safeNext } from "@/services/auth";
import { AUTH_QUERY_KEY } from "./RequireLogin";

export function LoginPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: AUTH_QUERY_KEY, queryFn: me, staleTime: 60_000, retry: 1 });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (data?.signedIn) return <Navigate to={next} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setBusy(true);
    setError("");
    try {
      await login(username.trim(), password);
      // Start clean: nothing cached from before sign-in is reused.
      qc.clear();
      qc.setQueryData(AUTH_QUERY_KEY, { signedIn: true, configured: true });
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError && err.status !== 0 ? err.message : "Cannot reach the server");
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Wordmark />
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-card">
          <div>
            <h1 className="text-lg font-semibold text-heading">Sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">Enter your username and password to continue.</p>
          </div>
          {data && !data.configured && (
            <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning">
              Sign-in isn't set up on this server yet: DASHBOARD_USERNAME or DASHBOARD_PASSWORD is missing.
            </p>
          )}
          <Input
            autoFocus
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            icon={<User />}
            placeholder="Username"
            aria-label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Input
            type="password"
            autoComplete="current-password"
            icon={<Lock />}
            placeholder="Password"
            aria-label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" loading={busy} disabled={!username.trim() || !password}>
            Sign in
          </Button>
        </form>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          {app.company} {app.product}
        </p>
      </div>
    </div>
  );
}
