import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const reason = (error: unknown) => {
  const status = (error as { status?: number } | null)?.status;
  if (status === 403) return "You don't have access to this. Ask the CEO if you need it.";
  if (status === 404) return "It may have been deleted, or you don't have access to it.";
  if (status && status >= 500) return "The server had a problem. Try again in a moment.";
  if (typeof navigator !== "undefined" && !navigator.onLine) return "You seem to be offline.";
  return "Check your connection and try again.";
};

/** Shown in place of a list or page when its data failed to load, so failure never looks empty. */
export function LoadError({
  what,
  error,
  onRetry,
  className,
}: {
  /** Plain name of what failed, e.g. "invoices". */
  what: string;
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center",
        className,
      )}
    >
      <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
      <p className="text-sm font-medium">Couldn't load {what}</p>
      <p className="text-xs text-muted-foreground">{reason(error)}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RotateCw className="mr-1 h-4 w-4" /> Try again
        </Button>
      )}
    </div>
  );
}
