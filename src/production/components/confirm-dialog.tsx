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
} from "@/production/components/ui/alert-dialog";
import { cn } from "@/production/lib/utils";
interface ConfirmOptions {
  title?: string | undefined;
  description: string;
  confirmLabel?: string | undefined;
  cancelLabel?: string | undefined;
  destructive?: boolean | undefined;
}
interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}
let setState: ((state: ConfirmState | null) => void) | null = null;
export function confirmDialog(options: ConfirmOptions | string): Promise<boolean> {
  const resolved: ConfirmOptions = typeof options === "string" ? { description: options } : options;
  return new Promise((resolve) => {
    if (!setState) {
      throw new Error("The confirmation dialog is not available yet.");
    }
    setState({ ...resolved, resolve });
  });
}
export function ConfirmDialogHost() {
  const [state, setStateLocal] = React.useState<ConfirmState | null>(null);
  React.useEffect(() => {
    setState = setStateLocal;
    return () => {
      setState = null;
    };
  }, []);
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
