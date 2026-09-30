import { useCallback, useRef } from "react";
import { useBlocker } from "@tanstack/react-router";
import { confirmDialog } from "@/components/confirm-dialog";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";

/**
 * Asks before leaving a page with unsaved edits, for in-app links and for closing the tab.
 * Call `allowLeave()` right before navigating away on purpose (e.g. after a delete).
 */
export function useLeaveGuard(dirty: boolean) {
  useUnsavedChanges(dirty);
  const allowed = useRef(false);

  useBlocker({
    disabled: !dirty,
    enableBeforeUnload: false,
    shouldBlockFn: async ({ current, next }) => {
      if (allowed.current || current.pathname === next.pathname) return false;
      const ok = await confirmDialog({
        title: "Leave without saving?",
        description: "Your changes on this page haven't been saved.",
        confirmLabel: "Leave without saving",
        cancelLabel: "Stay on this page",
        destructive: true,
      });
      return !ok;
    },
  });

  const allowLeave = useCallback(() => {
    allowed.current = true;
  }, []);

  return { allowLeave };
}
