import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BrandMark } from "@/components/brand/Wordmark";
import { AUTH_REQUIRED_EVENT } from "@/lib/api";
import { me } from "@/services/auth";

export const AUTH_QUERY_KEY = ["auth", "me"] as const;

/** Wraps every dashboard route: without a valid session the sign-in page is shown instead. */
export function RequireLogin() {
  const location = useLocation();
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: AUTH_QUERY_KEY, queryFn: me, staleTime: 60_000, retry: 1 });

  // Any API call answering 401 means the session ended (expired, password changed, signed out elsewhere).
  useEffect(() => {
    const onRequired = () => qc.setQueryData(AUTH_QUERY_KEY, (cur: { configured: boolean } | undefined) => ({ configured: cur?.configured ?? true, signedIn: false }));
    window.addEventListener(AUTH_REQUIRED_EVENT, onRequired);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, onRequired);
  }, [qc]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <BrandMark className="animate-pulse" />
      </div>
    );
  }
  if (isError || !data?.signedIn) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <Outlet />;
}
