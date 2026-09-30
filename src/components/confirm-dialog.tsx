import * as React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface ConfirmOptions {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button destructive (red) — for deletes and other irreversible actions. */
  destructive?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

let setState: ((state: ConfirmState | null) => void) | null = null;

/**
 * Promise-based replacement for `window.confirm()` — same call shape (await it, get a boolean),
 * but renders as an app-styled modal via <ConfirmDialogHost/> instead of the browser's native
 * dialog. Call from anywhere; no local state or JSX needed at the call site.
 */
export function confirmDialog(options: ConfirmOptions | string): Promise<boolean> {
  const resolved: ConfirmOptions = typeof options === "string" ? { description: options } : options;
  return new Promise((resolve) => {
    if (!setState) {
      // Host not mounted (shouldn't happen — it's mounted at the app root) — fail open to the
      // native dialog rather than hanging the caller forever.
      resolve(window.confirm(resolved.description));
      return;
    }
    setState({ ...resolved, resolve });
  });
}

/** Mounted once at the app root — see routes/__root.tsx. */
export function ConfirmDialogHost() {
  const [state, setStateLocal] = React.useState<ConfirmState | null>(null);

  React.useEffect(() => {
    setState = setStateLocal;
    return () => {
      setState = null;
    };
  }, []);

  // Functional updater so this is safe to call twice (once from the Cancel/Action button's own
  // onClick, once from the onOpenChange Radix fires as it closes) — the second call finds
  // `current` already null and no-ops instead of double-resolving the promise.
  const close = (result: boolean) => {
    setStateLocal((current) => {
      current?.resolve(result);
      return null;
    });
  };

  return (
    <AlertDialog open={!!state} onOpenChange={(open) => !open && close(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state?.title ?? "Are you sure?"}</AlertDialogTitle>
          <AlertDialogDescription>{state?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>
            {state?.cancelLabel ?? "Cancel"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => close(true)}
            className={cn(
              state?.destructive &&
                "bg-destructive text-destructive-foreground hover:bg-destructive/90",
            )}
          >
            {state?.confirmLabel ?? "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
