import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Mail, Phone, Search, X } from "lucide-react";
import {
  useLeads,
  useUpdateLeadStage,
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  LEAD_SOURCE_LABELS,
  type LeadStage,
} from "@/features/marketing/use-leads";
import { NewLeadDialog } from "@/features/marketing/new-lead-dialog";
import { LeadDetailSheet } from "@/features/marketing/lead-detail-sheet";
import { PageHeader } from "@/components/app-shell";
import { LoadError } from "@/components/load-error";
import { ActionHint } from "@/components/help-link";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  lead: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/_authenticated/marketing/leads")({
  head: () => ({ meta: [{ title: "Leads — AIMS" }] }),
  validateSearch: searchSchema,
  component: LeadsBoard,
});

type Whose = "all" | "mine";

function LeadsBoard() {
  const { isAdminOrCeo, hasRole, profile } = useAuth();
  const canManage = isAdminOrCeo || hasRole("marketing");
  const { lead: openId } = Route.useSearch();
  const navigate = Route.useNavigate();
  const leadsQ = useLeads();
  const updateStage = useUpdateLeadStage();
  const [search, setSearch] = useState("");
  const [whose, setWhose] = useState<Whose>("all");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<LeadStage | null>(null);
  const q = useDebouncedValue(search.trim().toLowerCase(), 200);

  const leads = leadsQ.data ?? [];
  const mineCount = leads.filter((l) => l.created_by === profile?.id).length;
  const filtered = useMemo(
    () =>
      leads.filter(
        (l) =>
          (whose === "all" || l.created_by === profile?.id) &&
          (!q ||
            l.name.toLowerCase().includes(q) ||
            (l.company ?? "").toLowerCase().includes(q) ||
            (l.contact_email ?? "").toLowerCase().includes(q)),
      ),
    [leads, whose, q, profile?.id],
  );
  const hasFilters = !!search.trim() || whose !== "all";
  const openLead = leads.find((l) => l.id === openId) ?? null;

  const setOpen = (id: string | null) =>
    navigate({ search: id ? { lead: id } : {}, replace: true });
  const clearFilters = () => {
    setSearch("");
    setWhose("all");
  };

  const move = (id: string, stage: LeadStage) => {
    updateStage.mutate(
      { id, stage },
      {
        onSuccess: () => toast.success(`Moved to ${LEAD_STAGE_LABELS[stage]}`),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Couldn't move the lead"),
      },
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Leads"
        description="People and companies who might buy from us, from first contact until they become a client request."
        actions={canManage ? <NewLeadDialog onCreated={(id) => setOpen(id)} /> : undefined}
      />
      {canManage ? (
        <ActionHint topic="convert lead to client request">
          When a lead is ready, use Convert to client request so Operations can route it.
        </ActionHint>
      ) : (
        <ViewOnlyBanner area="leads" />
      )}

      {leadsQ.isError ? (
        <LoadError what="leads" error={leadsQ.error} onRetry={() => leadsQ.refetch()} />
      ) : leadsQ.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : leads.length === 0 ? (
        <div className="rounded-lg border bg-card px-4 py-12 text-center">
          <p className="text-sm font-medium">No leads yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add the first person or company who showed interest.
          </p>
          {canManage && (
            <div className="mt-3 flex justify-center">
              <NewLeadDialog onCreated={(id) => setOpen(id)} />
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search
                className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                className="h-9 pl-8"
                placeholder="Search name, company or email"
                aria-label="Search leads"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={whose} onValueChange={(v) => setWhose(v as Whose)}>
              <SelectTrigger className="h-9 w-full sm:w-44" aria-label="Whose leads">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All leads</SelectItem>
                <SelectItem value="mine">Leads I added ({mineCount})</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-9" onClick={clearFilters}>
                <X className="mr-1 h-4 w-4" /> Clear filters
              </Button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-lg border bg-card px-4 py-10 text-center">
              <p className="text-sm font-medium">No matches</p>
              <p className="mt-1 text-xs text-muted-foreground">No leads match these filters.</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {LEAD_STAGES.map((stage) => {
                const columnLeads = filtered.filter((l) => l.stage === stage);
                return (
                  <section
                    key={stage}
                    aria-label={`${LEAD_STAGE_LABELS[stage]} leads`}
                    className={cn(
                      "min-h-30 rounded-lg border bg-muted/30 p-2",
                      dragOverStage === stage && "border-primary bg-primary/5",
                    )}
                    onDragOver={(e) => {
                      if (!canManage || !dragId) return;
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
                    <h2 className="flex items-center justify-between px-1 pb-2 text-xs font-semibold">
                      <span>{LEAD_STAGE_LABELS[stage]}</span>
                      <span className="rounded-full bg-background px-1.5 py-0.5 text-xs text-muted-foreground">
                        {columnLeads.length}
                      </span>
                    </h2>
                    <div className="space-y-2">
                      {columnLeads.length === 0 ? (
                        <p className="py-4 text-center text-xs text-muted-foreground">No leads</p>
                      ) : (
                        columnLeads.map((l) => (
                          <div
                            key={l.id}
                            role="button"
                            tabIndex={0}
                            draggable={canManage}
                            onDragStart={() => setDragId(l.id)}
                            onDragEnd={() => setDragId(null)}
                            onClick={() => setOpen(l.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setOpen(l.id);
                              }
                            }}
                            className={cn(
                              "cursor-pointer rounded-lg border bg-card p-2.5 shadow-sm hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              dragId === l.id && "opacity-50",
                              openId === l.id && "border-primary",
                            )}
                          >
                            <div className="text-sm font-medium leading-snug">{l.name}</div>
                            {l.company && (
                              <div className="text-xs text-muted-foreground">{l.company}</div>
                            )}
                            <div className="mt-1.5 flex items-center justify-between gap-2">
                              <Badge variant="secondary" className="text-xs font-normal">
                                {LEAD_SOURCE_LABELS[l.source]}
                              </Badge>
                              <span className="flex items-center gap-1 text-muted-foreground">
                                {l.converted_request_id && (
                                  <>
                                    <CheckCircle2
                                      className="h-3.5 w-3.5 text-success"
                                      aria-hidden="true"
                                    />
                                    <span className="sr-only">Converted to a client request</span>
                                  </>
                                )}
                                {l.contact_email && (
                                  <>
                                    <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                                    <span className="sr-only">Has email</span>
                                  </>
                                )}
                                {l.contact_phone && (
                                  <>
                                    <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                                    <span className="sr-only">Has phone</span>
                                  </>
                                )}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
          {canManage && (
            <p className="text-xs text-muted-foreground">
              Open a lead to move it to another stage, or drag it between columns.
            </p>
          )}
        </>
      )}

      <LeadDetailSheet
        lead={openLead}
        missing={!!openId && leadsQ.isSuccess && !openLead}
        canManage={canManage}
        onClose={() => setOpen(null)}
      />
    </div>
  );
}
