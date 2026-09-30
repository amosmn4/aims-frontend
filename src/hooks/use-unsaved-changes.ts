import { useCallback, useEffect } from "react";
import { confirmDialog } from "@/components/confirm-dialog";

/**
 * Protects a form with changes: warns before the tab closes and asks before a dialog closes.
 * Use `guardClose(onClose)` for the dialog's onOpenChange / Cancel instead of calling onClose directly.
 */
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const guardClose = useCallback(
    async (onClose: () => void) => {
      if (!dirty) {
        onClose();
        return;
      }
      const ok = await confirmDialog({
        title: "Discard your changes?",
        description: "What you typed in this form hasn't been saved.",
        confirmLabel: "Discard changes",
        cancelLabel: "Keep editing",
        destructive: true,
      });
      if (ok) onClose();
    },
    [dirty],
  );

  return { guardClose };
}
