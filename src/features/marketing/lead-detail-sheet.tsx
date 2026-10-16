import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Mail,
  Phone,
  Plus,
  StickyNote,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Thread, type ThreadItem, type ThreadTone } from "@/components/thread/thread";
import { FormField } from "@/components/form-field";
import { LoadError } from "@/components/load-error";
import { ActionHint } from "@/components/help-link";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useDepartments, useProfilesLite } from "@/features/clients/use-clients-contracts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  useConvertLeadToRequest,
  useLeadActivities,
  useLogLeadActivity,
  useUpdateLeadStage,
  LEAD_ACTIVITY_TYPE_LABELS,
  LEAD_SOURCE_LABELS,
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  type LeadActivityType,
  type LeadRow,
  type LeadStage,
} from "./use-leads";

const TYPE_ICON: Record<LeadActivityType, LucideIcon> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  note: StickyNote,
};
const TYPE_TONE: Record<LeadActivityType, ThreadTone> = {
  call: "primary",
  email: "neutral",
  meeting: "success",
  note: "neutral",
};

const pad = (n: number) => String(n).padStart(2, "0");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
// Today keeps the current time so same-day entries stay in order.
const occurredIso = (date: string) =>
  date === today() ? new Date().toISOString() : new Date(`${date}T12:00:00`).toISOString();

const errText = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

type Draft = { type: LeadActivityType; date: string; summary: string };

/** One lead: contact details, stage, conversion and its Activity thread. */
export function LeadDetailSheet({
  lead,
  missing,
  canManage,
  onClose,
}: {
  lead: LeadRow | null;
  /** True when a lead was asked for but isn't in the list. */
  missing?: boolean;
  canManage: boolean;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Draft>({ type: "call", date: today(), summary: "" });
  const { guardClose } = useUnsavedChanges(!!lead && !!draft.summary.trim());
  const open = !!lead || !!missing;

  const close = () => {
    setDraft({ type: "call", date: today(), summary: "" });
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && guardClose(close)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {lead ? (
          <LeadDetail
            key={lead.id}
            lead={lead}
            canManage={canManage}
            draft={draft}
            setDraft={setDraft}
          />
        ) : (
          <SheetHeader>
            <SheetTitle>Lead not found</SheetTitle>
            <SheetDescription>
              It may have been deleted, or the link is out of date.
            </SheetDescription>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}

function LeadDetail({
  lead,
  canManage,
  draft,
  setDraft,
}: {
  lead: LeadRow;
  canManage: boolean;
  draft: Draft;
  setDraft: (d: Draft) => void;
}) {
  const updateStage = useUpdateLeadStage();
  const activitiesQ = useLeadActivities(lead.id);
  const log = useLogLeadActivity(lead.id);
  const [convertOpen, setConvertOpen] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<"date" | "summary", string>>>({});

  const items: ThreadItem[] = (activitiesQ.data ?? []).map((a) => {
    const Icon = TYPE_ICON[a.type];
    return {
      id: a.id,
      parentId: a.parent_id,
      authorName: a.created_by_name ?? "AIMS",
      createdAt: a.parent_id ? a.created_at : a.occurred_at,
      body: a.summary,
      badge: a.parent_id
        ? undefined
        : {
            label: LEAD_ACTIVITY_TYPE_LABELS[a.type],
            tone: TYPE_TONE[a.type],
            icon: <Icon className="h-3 w-3" aria-hidden="true" />,
          },
    };
  });

  const submitActivity = () => {
    const next: typeof errors = {};
    if (!draft.summary.trim()) next.summary = "Say what happened, e.g. what was agreed";
    if (!draft.date) next.date = "Choose when it happened";
    else if (draft.date > today()) next.date = "Choose today or an earlier date";
    setErrors(next);
    if (Object.keys(next).length) return;
    log.mutate(
      { type: draft.type, summary: draft.summary.trim(), occurred_at: occurredIso(draft.date) },
      {
        onSuccess: () => {
          toast.success(`${LEAD_ACTIVITY_TYPE_LABELS[draft.type]} logged`);
          setDraft({ type: draft.type, date: today(), summary: "" });
        },
        onError: (err) => toast.error(errText(err, "Couldn't log the activity")),
      },
    );
  };

  const composer = (
    <form
      className="space-y-3 rounded-md border bg-secondary/30 p-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submitActivity();
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField id="activity-type" label="Type" required>
          <Select
            value={draft.type}
            onValueChange={(v) => setDraft({ ...draft, type: v as LeadActivityType })}
          >
            <SelectTrigger id="activity-type" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(LEAD_ACTIVITY_TYPE_LABELS) as LeadActivityType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {LEAD_ACTIVITY_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField id="activity-date" label="Date" required error={errors.date}>
          <Input
            id="activity-date"
            type="date"
            className="h-9"
            max={today()}
            value={draft.date}
            aria-invalid={!!errors.date}
            onChange={(e) => {
              setDraft({ ...draft, date: e.target.value });
              setErrors((x) => ({ ...x, date: undefined }));
            }}
          />
        </FormField>
      </div>
      <FormField id="activity-summary" label="What happened" required error={errors.summary}>
        <Textarea
          id="activity-summary"
          rows={3}
          placeholder="e.g. Called Jane, she wants a payroll proposal by Friday"
          value={draft.summary}
          aria-invalid={!!errors.summary}
          onChange={(e) => {
            setDraft({ ...draft, summary: e.target.value });
            setErrors((x) => ({ ...x, summary: undefined }));
          }}
        />
      </FormField>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={log.isPending}>
          {log.isPending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-1 h-4 w-4" />
          )}
          Log activity
        </Button>
      </div>
    </form>
  );

  return (
    <div className="space-y-4">
      <SheetHeader>
        <SheetTitle>{lead.name}</SheetTitle>
        <SheetDescription>
          {[lead.company, LEAD_STAGE_LABELS[lead.stage]].filter(Boolean).join(" · ")}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-1.5 text-sm">
        {lead.contact_email && (
          <a
            href={`mailto:${lead.contact_email}`}
            className="flex items-center gap-2 text-primary hover:underline"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            {lead.contact_email}
          </a>
        )}
        {lead.contact_phone && (
          <a
            href={`tel:${lead.contact_phone}`}
            className="flex items-center gap-2 text-primary hover:underline"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            {lead.contact_phone}
          </a>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge variant="secondary">From: {LEAD_SOURCE_LABELS[lead.source]}</Badge>
          <Badge variant="secondary">Stage: {LEAD_STAGE_LABELS[lead.stage]}</Badge>
        </div>
        {lead.notes && (
          <p className="whitespace-pre-wrap pt-1 text-muted-foreground">{lead.notes}</p>
        )}
      </div>

      {canManage && (
        <div className="space-y-3 border-t pt-3">
          <FormField id="lead-stage" label="Move to stage">
            <Select
              value={lead.stage}
              onValueChange={(v) =>
                updateStage.mutate(
                  { id: lead.id, stage: v as LeadStage },
                  {
                    onSuccess: () => toast.success(`Moved to ${LEAD_STAGE_LABELS[v as LeadStage]}`),
                    onError: (err) => toast.error(errText(err, "Couldn't move the lead")),
                  },
                )
              }
            >
              <SelectTrigger id="lead-stage" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {LEAD_STAGE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {lead.converted_request_id ? (
            <Link
              to="/requests/$requestId"
              params={{ requestId: lead.converted_request_id }}
              className="inline-flex items-center gap-1.5 text-sm text-success hover:underline"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Converted — open the client request
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          ) : (
            <div className="space-y-1.5">
              <Button size="sm" className="w-full" onClick={() => setConvertOpen(true)}>
                Convert to client request
              </Button>
              <ActionHint topic="convert lead to client request">
                When a lead is ready, use Convert to client request so Operations can route it.
              </ActionHint>
            </div>
          )}
        </div>
      )}

      {activitiesQ.isError ? (
        <LoadError
          what="this lead's activity"
          error={activitiesQ.error}
          onRetry={() => activitiesQ.refetch()}
        />
      ) : activitiesQ.isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (
        <Thread
          title="Activity"
          headingLevel="h3"
          items={items}
          newestFirst
          canPost={canManage}
          composer={composer}
          sending={log.isPending}
          emptyText="No activity yet. Log each call, email and meeting so the team knows where things stand."
          onSend={(body, parentId) =>
            log
              .mutateAsync({ type: "note", summary: body, parent_id: parentId })
              .then(() => toast.success("Reply sent"))
              .catch((err) => toast.error(errText(err, "Couldn't send the reply")))
          }
        />
      )}

      {convertOpen && <ConvertToRequestDialog lead={lead} onClose={() => setConvertOpen(false)} />}
    </div>
  );
}

const NONE = "__none__";

// The department is optional; left blank, Operations routes the request.
function ConvertToRequestDialog({ lead, onClose }: { lead: LeadRow; onClose: () => void }) {
  const convert = useConvertLeadToRequest();
  const departmentsQ = useDepartments();
  const profilesQ = useProfilesLite();
  const [departmentId, setDepartmentId] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const { guardClose } = useUnsavedChanges(!!departmentId || !!assignedToId);

  const submit = () => {
    convert.mutate(
      {
        leadId: lead.id,
        departmentId: departmentId || undefined,
        assignedToId: assignedToId || undefined,
      },
      {
        onSuccess: () => {
          toast.success(
            departmentId
              ? "Client request created and routed"
              : "Client request created — Operations will route it",
          );
          onClose();
        },
        onError: (err) => toast.error(errText(err, "Couldn't create the client request")),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && guardClose(onClose)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert to client request</DialogTitle>
          <DialogDescription>
            Creates a client request for {lead.name}. Leave the department blank and Operations will
            route it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <FormField id="convert-department" label="Department">
            <Select
              value={departmentId || NONE}
              onValueChange={(v) => {
                setDepartmentId(v === NONE ? "" : v);
                setAssignedToId("");
              }}
            >
              <SelectTrigger id="convert-department">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Let Operations route it</SelectItem>
                {(departmentsQ.data ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          {departmentId && (
            <FormField id="convert-assignee" label="Assign to">
              <Select
                value={assignedToId || NONE}
                onValueChange={(v) => setAssignedToId(v === NONE ? "" : v)}
              >
                <SelectTrigger id="convert-assignee">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nobody yet</SelectItem>
                  {(profilesQ.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name ?? p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => guardClose(onClose)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={convert.isPending}>
            {convert.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Convert to client request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
