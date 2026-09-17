import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PromptOptions {
  title: string;
  description?: string;
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  inputType?: "text" | "textarea" | "date";
  confirmLabel?: string;
  required?: boolean;
}

interface PromptState extends PromptOptions {
  resolve: (value: string | null) => void;
}

let setState: ((state: PromptState | null) => void) | null = null;

/** Modal replacement for `window.prompt()`: resolves the entered value, or null if cancelled. */
export function promptDialog(options: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    if (!setState) {
      resolve(window.prompt(options.title, options.defaultValue ?? ""));
      return;
    }
    setState({ ...options, resolve });
  });
}

/** Mounted once at the app root, next to ConfirmDialogHost. */
export function PromptDialogHost() {
  const [state, setStateLocal] = React.useState<PromptState | null>(null);
  const [value, setValue] = React.useState("");

  React.useEffect(() => {
    setState = (next) => {
      setValue(next?.defaultValue ?? "");
      setStateLocal(next);
    };
    return () => {
      setState = null;
    };
  }, []);

  // Functional updater guards against double-resolve when Radix also fires onOpenChange.
  const close = (result: string | null) => {
    setStateLocal((current) => {
      current?.resolve(result);
      return null;
    });
  };

  const canSubmit = !state?.required || value.trim().length > 0;
  const Field = state?.inputType === "textarea" ? Textarea : Input;

  return (
    <Dialog open={!!state} onOpenChange={(open) => !open && close(null)}>
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) close(value.trim());
          }}
        >
          <DialogHeader>
            <DialogTitle>{state?.title}</DialogTitle>
            {state?.description && <DialogDescription>{state.description}</DialogDescription>}
          </DialogHeader>
          <div className="space-y-1.5 py-3">
            {state?.label && <Label htmlFor="prompt-dialog-input">{state.label}</Label>}
            <Field
              id="prompt-dialog-input"
              type={state?.inputType === "date" ? "date" : undefined}
              value={value}
              placeholder={state?.placeholder}
              onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                setValue(e.target.value)
              }
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {state?.confirmLabel ?? "OK"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
