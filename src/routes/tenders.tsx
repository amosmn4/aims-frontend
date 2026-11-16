import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, Card, PageHeader, Pill, fmtDate } from "@/components/kit";
import { EmptyState, RecordActions, SearchField } from "@/components/RecordDialog";
import { TenderForm } from "@/components/WorkspaceForms";
import { tenderStages, type Tender } from "@/lib/data";
import { canSeeTenders, fmtKes, visibleTenders } from "@/lib/business";
import { perform, useWorkspace } from "@/lib/workspace";
import { meta } from "@/lib/meta";
import { useRole } from "@/lib/role";
import { api, isDemo } from "@/lib/api";

export const Route = createFileRoute("/tenders")({
  head: () => ({ meta: meta("Tenders", "Log and manage the Amsol tender pipeline.") }),
  component: Tenders,
});
function Tenders() {
  return isDemo ? <DemoTenders /> : <ProductionTenders />;
}

type ProductionTender = {
  id: string;
  referenceNumber: string | null;
  title: string;
  description: string | null;
  client: { name: string } | null;
  prospectClientName: string | null;
  department: { name: string } | null;
  accountManager: { id: string; fullName: string | null } | null;
  stage: string;
  estimatedValue: number | string | null;
  currency: string;
  submissionDeadline: string | null;
  notes: string | null;
};

const productionStageLabel: Record<string, string> = {
  identified: "Identified",
  applying: "Under application",
  submitted: "Submitted",
  withdrawn: "Withdrawn",
  cancelled: "Cancelled",
  won: "Won",
  lost: "Lost",
};

function ProductionTenders() {
  const { mode } = useRole();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");
  const query = useQuery({
    queryKey: ["ops-production-tenders"],
    queryFn: () => api<ProductionTender[]>("/tenders"),
    staleTime: 30_000,
  });
  const assignees = useQuery({
    queryKey: ["ops-tender-assignees"],
    queryFn: () => api<{ id: string; name: string }[]>("/tenders/assignees"),
    enabled: mode === "ceo",
  });
  const tenders = query.data ?? [];
  const list = tenders.filter((tender) => {
    const label = productionStageLabel[tender.stage] ?? tender.stage;
    return (
      (stage === "all" || label === stage) &&
      `${tender.title} ${tender.referenceNumber ?? ""} ${tender.client?.name ?? tender.prospectClientName ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  });
  return (
    <div>
      <PageHeader
        title="Tenders"
        subtitle="Live production tender records. CEO assignments update only the existing owner field."
      />
      {query.error && (
        <p role="alert" className="mb-4 rounded-lg border p-4">
          {query.error instanceof Error
            ? query.error.message
            : "Production tenders could not load."}
        </p>
      )}
      {mode === "ceo" && assignees.error && (
        <p role="alert" className="mb-4 rounded-lg border p-4">
          Staff assignments could not load: {assignees.error.message}
        </p>
      )}
      {query.isPending && <p role="status">Loading production tenders...</p>}
      {!query.error && (
        <>
          <div className="mb-5 flex flex-wrap gap-2">
            <button
              className="rounded-md border px-3 py-1 text-sm"
              aria-pressed={stage === "all"}
              onClick={() => setStage("all")}
            >
              All ({tenders.length})
            </button>
            {Object.values(productionStageLabel).map((value) => (
              <button
                key={value}
                aria-pressed={stage === value}
                className={`rounded-md border px-3 py-1 text-sm ${stage === value ? "bg-muted font-semibold" : ""}`}
                onClick={() => setStage(value)}
              >
                {value} (
                {tenders.filter((tender) => productionStageLabel[tender.stage] === value).length})
              </button>
            ))}
          </div>
          <SearchField value={search} onChange={setSearch} placeholder="Search tenders" />
          {!query.isPending && !list.length && (
            <EmptyState>
              {tenders.length
                ? "No tenders match your selection."
                : "No production tenders are visible to your account."}
            </EmptyState>
          )}
          <div className="space-y-3">
            {list.map((tender) => (
              <Card key={tender.id}>
                <div className="flex flex-wrap justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-medium">{tender.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {tender.referenceNumber ? `${tender.referenceNumber} | ` : ""}
                      {tender.client?.name ?? tender.prospectClientName ?? "No client recorded"}
                      {tender.department?.name ? ` | ${tender.department.name}` : ""}
                      {tender.submissionDeadline
                        ? ` | closes ${fmtDate(tender.submissionDeadline)}`
                        : " | no closing date"}
                    </p>
                    {(tender.description || tender.notes) && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                        {tender.description || tender.notes}
                      </p>
                    )}
                    {tender.accountManager?.fullName && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Owner: {tender.accountManager.fullName}
                      </p>
                    )}
                    {mode === "ceo" && (
                      <label className="mt-3 flex max-w-sm items-center gap-2 text-xs">
                        Assign to
                        <select
                          className="field-input"
                          aria-label={`Assign ${tender.title}`}
                          value={tender.accountManager?.id ?? ""}
                          disabled={assignees.isPending || !!assignees.error}
                          onChange={async (event) => {
                            const accountManagerId = event.target.value;
                            if (!accountManagerId) return;
                            await perform(async () => {
                              await api(`/tenders/${encodeURIComponent(tender.id)}/assignment`, {
                                method: "PATCH",
                                body: JSON.stringify({ accountManagerId }),
                              });
                              await queryClient.invalidateQueries({
                                queryKey: ["ops-production-tenders"],
                              });
                            }, "Tender assignment updated");
                          }}
                        >
                          <option value="" disabled>
                            Choose staff
                          </option>
                          {tender.accountManager &&
                            !assignees.data?.some(
                              (person) => person.id === tender.accountManager?.id,
                            ) && (
                              <option value={tender.accountManager.id}>
                                {tender.accountManager.fullName ?? "Current owner"}
                              </option>
                            )}
                          {assignees.data?.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-display text-lg font-semibold">
                      {tender.estimatedValue == null
                        ? "Value not set"
                        : `${tender.currency} ${Number(tender.estimatedValue).toLocaleString("en-KE")}`}
                    </div>
                    <Pill>{productionStageLabel[tender.stage] ?? tender.stage}</Pill>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DemoTenders() {
  const { mode, me } = useRole();
  const { tenders, person } = useWorkspace();
  const [edit, setEdit] = useState<Tender | "new" | null>(null);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");
  if (!canSeeTenders(mode, me.id, tenders))
    return <Card>You are not assigned to tenders. Ask the CEO to assign you to a tender.</Card>;
  const visible = visibleTenders(mode, me.id, tenders);
  const list = visible.filter(
    (tender) =>
      (stage === "all" || tender.stage === stage) &&
      `${tender.title} ${tender.issuer}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div>
      <PageHeader
        title="Tenders"
        subtitle="From identified opportunities to won contracts"
        action={
          <button className="action-button" onClick={() => setEdit("new")}>
            Log tender
          </button>
        }
      />
      <div className="mb-5 flex flex-wrap gap-2">
        <button
          className="rounded-md border px-3 py-1 text-sm"
          aria-pressed={stage === "all"}
          onClick={() => setStage("all")}
        >
          All ({visible.length})
        </button>
        {tenderStages.map((value) => (
          <button
            key={value}
            aria-pressed={stage === value}
            className={`rounded-md border px-3 py-1 text-sm ${stage === value ? "bg-muted font-semibold" : ""}`}
            onClick={() => setStage(value)}
          >
            {value} ({visible.filter((tender) => tender.stage === value).length})
          </button>
        ))}
      </div>
      <SearchField value={search} onChange={setSearch} placeholder="Search tenders" />
      {!list.length && <EmptyState>No tenders match your selection.</EmptyState>}
      <div className="space-y-3">
        {list.map((tender) => (
          <Card key={tender.id}>
            <div className="flex flex-wrap justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h2 className="font-medium">{tender.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {tender.issuer} | closes {fmtDate(tender.due)}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {tender.notes}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {tender.members.map((member) => (
                    <span key={member} className="flex items-center gap-1.5 text-xs">
                      <Avatar name={person(member).name} size="sm" />
                      {person(member).name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-lg font-semibold">{fmtKes(tender.value)}</div>
                <Pill>{tender.stage}</Pill>
                <div className="mt-3">
                  <RecordActions
                    collection="tenders"
                    id={tender.id}
                    label={tender.title}
                    onEdit={() => setEdit(tender)}
                  />
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {edit && (
        <TenderForm record={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} />
      )}
    </div>
  );
}
