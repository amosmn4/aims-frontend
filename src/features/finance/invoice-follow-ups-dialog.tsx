import { useState } from "react";
import { Loader2, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { FormField, RequiredNote } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { Thread, type ThreadItem, type ThreadTone } from "@/components/thread/thread";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { formatDate } from "@/lib/format-date";
import {
  useCreateFollowUp,
  useDeleteFollowUp,
  useFollowUps,
  type FollowUp,
  type FollowUpType,
} from "./use-finance-data";

// Words for the "What happened" choice in the form.
const WHAT_HAPPENED: { value: FollowUpType; label: string }[] = [
  { value: "reminder_sent", label: "Reminder sent" },
  { value: "promise_to_pay", label: "Promised to pay" },
  { value: "escalated", label: "Escalated" },
  { value: "note", label: "Note" },
];

// Words on each entry's badge.
const BADGE: Record<FollowUpType, { label: string; tone: ThreadTone }> = {
  reminder_sent: { label: "Reminder sent", tone: "primary" },
  promise_to_pay: { label: "Promise to pay", tone: "warning" },
  escalated: { label: "Escalated", tone: "danger" },
  note: { label: "Note", tone: "neutral" },
};

const CHANNELS = ["Email", "Phone call", "SMS", "WhatsApp", "In person", "Letter", "Other"];

type Draft = { type: FollowUpType | ""; channel: string; promisedDate: string; notes: string };
type DraftErrors = Partial<Record<keyof Draft, string>>;
const EMPTY: Draft = { type: "", channel: "", promisedDate: "", notes: "" };

const errorText = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

function toItem(f: FollowUp, canDelete: boolean): ThreadItem {
  const meta = [
    f.channel ? `Via ${f.channel}` : null,
    f.promised_date ? `Promised for ${formatDate(f.promised_date)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    id: f.id,
    parentId: f.parent_id,
    authorName: f.creator_name ?? "Finance",
    createdAt: f.created_at,
    body: f.notes ?? "",
    badge: f.parent_id ? undefined : BADGE[f.type],
    meta: meta || undefined,
    canDelete,
  };
}

/** The follow-up conversation for one unpaid invoice, with a form to log what happened. */
export function InvoiceFollowUpsDialog({
  invoiceId,
  invoiceNumber,
  summary,
  canPost,
  onClose,
}: {
  invoiceId: string;
  invoiceNumber: string;
  /** e.g. "Acme Ltd owes KES 116,000 · due 14 Feb 2026". */
  summary?: string;
  canPost: boolean;
  onClose: () => void;
}) {
  const followUpsQ = useFollowUps(invoiceId);
  const createFollowUp = useCreateFollowUp();
  const deleteFollowUp = useDeleteFollowUp();
  const { profile, isAdminOrCeo } = useAuth();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<DraftErrors>({});
  const dirty =
    draft.type !== "" || !!draft.channel || !!draft.promisedDate || !!draft.notes.trim();
  const { guardClose } = useUnsavedChanges(dirty);

  const update = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k as keyof Draft];
      return next;
    });
  };

  const logFollowUp = async () => {
    const found: DraftErrors = {};
    if (!draft.type) found.type = "Choose what happened";
    if (draft.type === "promise_to_pay" && !draft.promisedDate)
      found.promisedDate = "Choose the date they promised to pay";
    if (draft.type === "note" && !draft.notes.trim()) found.notes = "Write the note";
    setErrors(found);
    if (Object.keys(found).length > 0 || !draft.type) return;
    try {
      await createFollowUp.mutateAsync({
        invoiceId,
        type: draft.type,
        channel: draft.channel || undefined,
        promisedDate: draft.type === "promise_to_pay" ? draft.promisedDate : undefined,
        notes: draft.notes.trim() || undefined,
      });
      toast.success("Follow-up logged");
      setDraft(EMPTY);
    } catch (err) {
      toast.error(errorText(err, "Couldn't log the follow-up"));
    }
  };

  const composer = (
    <form
      className="space-y-3 rounded-md border bg-secondary/30 p-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void logFollowUp();
      }}
    >
      <RequiredNote />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField id="fu-type" label="What happened" required error={errors.type}>
          <Select value={draft.type} onValueChange={(v) => update({ type: v as FollowUpType })}>
            <SelectTrigger id="fu-type" aria-invalid={!!errors.type}>
              <SelectValue placeholder="Choose what happened" />
            </SelectTrigger>
            <SelectContent>
              {WHAT_HAPPENED.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField id="fu-channel" label="Channel">
          <Select
            value={draft.channel || "none"}
            onValueChange={(v) => update({ channel: v === "none" ? "" : v })}
          >
            <SelectTrigger id="fu-channel">
              <SelectValue placeholder="How you reached them" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not given</SelectItem>
              {CHANNELS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>
      {draft.type === "promise_to_pay" && (
        <FormField
          id="fu-promised-date"
          label="Promised date"
          required
          error={errors.promisedDate}
          className="sm:max-w-[50%]"
        >
          <Input
            id="fu-promised-date"
            type="date"
            value={draft.promisedDate}
            aria-invalid={!!errors.promisedDate}
            onChange={(e) => update({ promisedDate: e.target.value })}
          />
        </FormField>
      )}
      <FormField id="fu-notes" label="Notes" required={draft.type === "note"} error={errors.notes}>
        <Textarea
          id="fu-notes"
          rows={2}
          value={draft.notes}
          aria-invalid={!!errors.notes}
          placeholder="e.g. Spoke to their accountant, payment goes out Friday"
          onChange={(e) => update({ notes: e.target.value })}
        />
      </FormField>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => guardClose(onClose)}>
          Cancel
        </Button>
        <Button type="submit" disabled={createFollowUp.isPending}>
          {createFollowUp.isPending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <MessageSquarePlus className="mr-1 h-4 w-4" />
          )}
          Log follow-up
        </Button>
      </div>
    </form>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && guardClose(onClose)}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Follow-ups on invoice {invoiceNumber}</DialogTitle>
          {summary && <DialogDescription>{summary}</DialogDescription>}
        </DialogHeader>

        {followUpsQ.isError ? (
          <LoadError
            what="follow-ups"
            error={followUpsQ.error}
            onRetry={() => followUpsQ.refetch()}
          />
        ) : followUpsQ.isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2
              className="h-5 w-5 animate-spin text-primary"
              aria-label="Loading follow-ups"
            />
          </div>
        ) : (
          <Thread
            title="Follow-ups"
            headingLevel="h3"
            className="border-0 bg-transparent p-0"
            items={(followUpsQ.data ?? []).map((f) =>
              toItem(f, canPost && (isAdminOrCeo || f.created_by === profile?.id)),
            )}
            onDelete={(item) =>
              deleteFollowUp
                .mutateAsync({ id: item.id, invoiceId })
                .then(() => toast.success("Follow-up deleted"))
                .catch((err) => toast.error(errorText(err, "Couldn't delete the follow-up")))
            }
            emptyText="No follow-ups logged yet."
            newestFirst
            canPost={canPost}
            composer={composer}
            sending={createFollowUp.isPending}
            onSend={(body, parentId) =>
              createFollowUp.mutateAsync({ invoiceId, parentId, notes: body }).catch((err) => {
                toast.error(errorText(err, "Couldn't send the reply"));
                throw err;
              })
            }
          />
        )}

        {(!canPost || !followUpsQ.data) && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
