import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail, Phone, Plus } from "lucide-react";
import {
  useLeads,
  useSaveLead,
  useUpdateLeadStage,
  useLeadActivities,
  useLogLeadActivity,
  useConvertLeadToRequest,
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  LEAD_SOURCE_LABELS,
  LEAD_ACTIVITY_TYPE_LABELS,
  type LeadRow,
  type LeadStage,
  type LeadSource,
  type LeadActivityType,
} from "@/features/marketing/use-leads";
import { useCampaigns } from "@/features/marketing/use-campaigns";
import { useDepartments, useProfilesLite } from "@/features/clients/use-clients-contracts";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated/marketing/leads")({
  head: () => ({ meta: [{ title: "Leads — AIMS" }] }),
  component: LeadsBoard,
});

function LeadsBoard() {
  const { isAdminOrCeo, hasRole } = useAuth();
  const canManage = isAdminOrCeo || hasRole("marketing");
  const leadsQ = useLeads();
  const updateStage = useUpdateLeadStage();
  const [openId, setOpenId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<LeadStage | null>(null);

  const leads = leadsQ.data ?? [];
  const open = leads.find((l) => l.id === openId) ?? null;

  const move = (id: string, stage: LeadStage) => {
    updateStage.mutate(
      { id, stage },
      {
        onSuccess: () => toast.success(`Moved to ${LEAD_STAGE_LABELS[stage]}`),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Move failed"),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Leads</h1>
          <p className="text-xs text-muted-foreground">
            New contacts through to a qualified sale — convert to a client request when ready.
          </p>
        </div>
        {canManage && (
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> New lead
              </Button>
            </DialogTrigger>
            <DialogContent>
              <NewLeadForm onDone={() => setNewOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {leadsQ.isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 overflow-x-auto sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {LEAD_STAGES.map((stage) => {
            const columnLeads = leads.filter((l) => l.stage === stage);
            return (
              <div
                key={stage}
                className={`rounded-lg border bg-muted/30 p-2 min-h-[200px] ${
                  dragOverStage === stage ? "border-primary bg-primary/5" : ""
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverStage(stage);
                }}
                onDragLeave={() => setDragOverStage((cur) => (cur === stage ? null : cur))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverStage(null);
                  if (dragId) move(dragId, stage);
                  setDragId(null);
                }}
              >
                <div className="flex items-center justify-between px-1 pb-2 text-xs font-semibold">
                  <span>{LEAD_STAGE_LABELS[stage]}</span>
                  <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {columnLeads.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {columnLeads.length === 0 ? (
                    <div className="py-6 text-center text-[11px] text-muted-foreground">
                      No leads
                    </div>
                  ) : (
                    columnLeads.map((l) => (
                      <div
                        key={l.id}
                        draggable={canManage}
                        onDragStart={() => setDragId(l.id)}
                        onDragEnd={() => setDragId(null)}
                        onClick={() => setOpenId(l.id)}
                        className={`cursor-pointer rounded-lg border bg-card p-2.5 shadow-sm hover:border-primary/50 ${
                          dragId === l.id ? "opacity-50" : ""
                        }`}
                      >
                        <div className="text-[13px] font-medium leading-snug">{l.name}</div>
                        {l.company && (
                          <div className="text-[11px] text-muted-foreground">{l.company}</div>
                        )}
                        <div className="mt-1.5 flex items-center justify-between">
                          <Badge variant="secondary" className="text-[10px]">
                            {LEAD_SOURCE_LABELS[l.source]}
                          </Badge>
                          {(l.contact_email || l.contact_phone) && (
                            <span className="text-muted-foreground">
                              {l.contact_email ? (
                                <Mail className="h-3 w-3" />
                              ) : (
                                <Phone className="h-3 w-3" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <LeadDetailSheet lead={open} canManage={canManage} onClose={() => setOpenId(null)} />
    </div>
  );
}

function LeadDetailSheet({
  lead,
  canManage,
  onClose,
}: {
  lead: LeadRow | null;
  canManage: boolean;
  onClose: () => void;
}) {
  const updateStage = useUpdateLeadStage();
  const convert = useConvertLeadToRequest();
  const activitiesQ = useLeadActivities(lead?.id);
  const logActivity = useLogLeadActivity(lead?.id ?? "");
  const [activityType, setActivityType] = useState<LeadActivityType>("note");
  const [activityText, setActivityText] = useState("");

  if (!lead) {
    return (
      <Sheet open={false} onOpenChange={(o) => !o && onClose()}>
        <SheetContent />
      </Sheet>
    );
  }

  const submitActivity = () => {
    if (!activityText.trim()) return;
    logActivity.mutate(
      { type: activityType, summary: activityText.trim() },
      {
        onSuccess: () => setActivityText(""),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to log"),
      },
    );
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{lead.name}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="space-y-1 text-sm">
            {lead.company && <div>{lead.company}</div>}
            {lead.contact_email && (
              <div className="text-muted-foreground">{lead.contact_email}</div>
            )}
            {lead.contact_phone && (
              <div className="text-muted-foreground">{lead.contact_phone}</div>
            )}
            <div className="flex items-center gap-2 pt-1">
              <Badge variant="secondary">{LEAD_SOURCE_LABELS[lead.source]}</Badge>
              <Badge variant="secondary">{LEAD_STAGE_LABELS[lead.stage]}</Badge>
            </div>
          </div>

          {lead.notes && <p className="text-sm text-muted-foreground">{lead.notes}</p>}

          {canManage && (
            <div className="space-y-2 border-t pt-3">
              <Label>Stage</Label>
              <Select
                value={lead.stage}
                onValueChange={(v) =>
                  updateStage.mutate(
                    { id: lead.id, stage: v as LeadStage },
                    {
                      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
                    },
                  )
                }
              >
                <SelectTrigger>
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

              {lead.converted_request_id ? (
                <Link
                  to="/requests/$requestId"
                  params={{ requestId: lead.converted_request_id }}
                  className="text-xs text-success underline hover:opacity-80"
                >
                  ✓ Converted to client request →
                </Link>
              ) : (
                <ConvertToRequestDialog leadId={lead.id} convert={convert} />
              )}
            </div>
          )}

          <div className="border-t pt-3">
            <div className="text-sm font-semibold mb-2">Follow-up log</div>
            {activitiesQ.isLoading ? (
              <div className="py-4 flex justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            ) : (activitiesQ.data ?? []).length === 0 ? (
              <div className="text-xs text-muted-foreground py-2">No follow-ups logged yet.</div>
            ) : (
              <div className="divide-y rounded-md border">
                {(activitiesQ.data ?? []).map((a) => (
                  <div key={a.id} className="flex items-start gap-2.5 px-2.5 py-2">
                    <Badge variant="secondary" className="mt-0.5 shrink-0 text-[10px]">
                      {LEAD_ACTIVITY_TYPE_LABELS[a.type]}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm">{a.summary}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {new Date(a.occurred_at).toLocaleString()}
                        {a.created_by_name && ` · ${a.created_by_name}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {canManage && (
              <div className="mt-2.5 flex gap-2">
                <Select
                  value={activityType}
                  onValueChange={(v) => setActivityType(v as LeadActivityType)}
                >
                  <SelectTrigger className="w-[110px] shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LEAD_ACTIVITY_TYPE_LABELS).map(([v, label]) => (
                      <SelectItem key={v} value={v}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={activityText}
                  onChange={(e) => setActivityText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitActivity()}
                  placeholder="Log a follow-up…"
                />
                <Button
                  size="sm"
                  onClick={submitActivity}
                  disabled={logActivity.isPending || !activityText.trim()}
                >
                  Add
                </Button>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Lets the converting marketer route the new request straight to a department (skipping the
// separate Operations/Tender "Route" step) when they already know who owns it — leaving the
// department blank keeps today's behavior of an unrouted request for Tender/Ops to triage.
function ConvertToRequestDialog({
  leadId,
  convert,
}: {
  leadId: string;
  convert: ReturnType<typeof useConvertLeadToRequest>;
}) {
  const [open, setOpen] = useState(false);
  const [departmentId, setDepartmentId] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const departmentsQ = useDepartments();
  const profilesQ = useProfilesLite();

  const submit = () => {
    convert.mutate(
      { leadId, departmentId: departmentId || undefined, assignedToId: assignedToId || undefined },
      {
        onSuccess: () => {
          toast.success(
            departmentId
              ? "Converted and routed to department"
              : "Converted — now in Tender's intake queue",
          );
          setOpen(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Conversion failed"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="w-full">
          Convert to client request
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert to client request</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Department (optional)</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Leave unrouted for Tender/Operations to triage" />
              </SelectTrigger>
              <SelectContent>
                {(departmentsQ.data ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {departmentId && (
            <div>
              <Label>Assign to (optional)</Label>
              <Select value={assignedToId} onValueChange={setAssignedToId}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  {(profilesQ.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name ?? p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={convert.isPending}>
            {convert.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Convert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewLeadForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [source, setSource] = useState<LeadSource>("other");
  const [notes, setNotes] = useState("");
  const [campaignId, setCampaignId] = useState<string>("");
  const save = useSaveLead();
  const campaignsQ = useCampaigns();

  const submit = () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    save.mutate(
      {
        name: name.trim(),
        company: company || undefined,
        contact_email: contactEmail || undefined,
        contact_phone: contactPhone || undefined,
        source,
        notes: notes || undefined,
        campaign_id: campaignId || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Lead added");
          onDone();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save"),
      },
    );
  };

  return (
    <div>
      <DialogHeader>
        <DialogTitle>New lead</DialogTitle>
      </DialogHeader>
      <div className="space-y-3 py-2">
        <div>
          <Label>Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contact name"
          />
        </div>
        <div>
          <Label>Company (optional)</Label>
          <Input value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Source</Label>
          <Select value={source} onValueChange={(v) => setSource(v as LeadSource)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(LEAD_SOURCE_LABELS).map(([v, label]) => (
                <SelectItem key={v} value={v}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
        {(campaignsQ.data ?? []).length > 0 && (
          <div>
            <Label>Campaign (optional)</Label>
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger>
                <SelectValue placeholder="Not attributed" />
              </SelectTrigger>
              <SelectContent>
                {(campaignsQ.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={save.isPending}>
          {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save
        </Button>
      </DialogFooter>
    </div>
  );
}
