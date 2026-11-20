import { Link, isRouteErrorResponse, useRouteError } from "react-router-dom";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

/** Shown instead of a blank screen or stack trace when a page crashes. */
export function RouteErrorPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : "Unknown error";
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <h1 className="text-xl font-semibold">Something went wrong on this page</h1>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">Your saved work is safe. Reload to try again, or go back to the overview.</p>
      <code className="mt-4 max-w-lg truncate rounded-md bg-muted px-3 py-1.5 font-mono text-xs text-muted-foreground">{message}</code>
      <div className="mt-6 flex gap-2">
        <Button variant="secondary" onClick={() => window.location.reload()}>
          <RotateCcw /> Reload
        </Button>
        <Link to="/" className={buttonVariants()}>
          Back to overview
        </Link>
      </div>
    </div>
  );
}
