import { useCallback, useEffect } from "react";
import { confirmDialog } from "@/production/components/confirm-dialog";
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
