import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useModuleAccess } from "@/lib/modules";
import { perform } from "@/lib/workspace";
import { downloadBlob } from "@/lib/file-storage";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { RecordDialog } from "./RecordDialog";
import { Card, Pill, Stat } from "./kit";
import { Button } from "./ui/button";

export type TenderRecord = {
  id: string;
  title: string;
  referenceNumber: string | null;
  description: string | null;
  notes: string | null;
  estimatedValue: string | number | null;
  currency: string;
  submissionDeadline: string | null;
  prospectClientName: string | null;
  department: { id?: string; name: string } | null;
  stage: string;
};
type Detail = {
  tender: TenderRecord;
  financials: { bidPrice: number; bondsTotal: number; totalCostToPursue: number };
  costs: { budgetedHours: number; actualHours: number; actualCost: number };
  resources: {
    id: string;
    user: { fullName: string };
    roleNote: string | null;
    allocatedHours: string | null;
    hourlyRate: string | null;
  }[];
  requirements: { id: string; title: string; status: string; notes: string | null }[];
  bonds: {
    id: string;
    bondType: string;
    amount: string;
    provider: string | null;
    status: string;
    expiryDate: string | null;
  }[];
  pricing: { id: string; description: string; quantity: string; unitPrice: string }[];
  activities: { id: string; type: string; summary: string; occurredAt: string }[];
  timeEntries: {
    id: string;
    hours: string;
    notes: string | null;
    entryDate: string;
    user: { fullName: string };
  }[];
  documents: {
    id: string;
    title: string;
    latestVersion: { versionNo: number; fileName: string } | null;
  }[];
};
const stages = ["identified", "applying", "submitted", "won", "lost", "withdrawn", "cancelled"];

export function TenderDetails({ id, onClose }: { id: string; onClose: () => void }) {
  const client = useQueryClient();
  const access = useModuleAccess("tender");
  const query = useQuery({
    queryKey: ["tender-detail", id],
    queryFn: () => api<Detail>(`/tenders/${id}`),
  });
  const [editing, setEditing] = useState(false);
  const [stage, setStage] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const data = query.data;
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["tender-detail", id] });
    await client.invalidateQueries({ queryKey: ["ops-production-tenders"] });
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{data?.tender.title ?? "Tender details"}</DialogTitle>
          <DialogDescription>
            Bid details, requirements, financials, people and documents
          </DialogDescription>
        </DialogHeader>
        {query.error && <p role="alert">{query.error.message}</p>}
        {query.isPending && <p role="status">Loading tender...</p>}
        {data && (
          <div className="space-y-5">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <Pill>{data.tender.stage}</Pill>
                <p className="mt-2 text-sm">
                  {data.tender.referenceNumber} | {data.tender.department?.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {data.tender.submissionDeadline
                    ? `Closes ${new Date(data.tender.submissionDeadline).toLocaleDateString("en-GB")}`
                    : "No closing date"}
                </p>
              </div>
              {access === "manage" && (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  Edit tender
                </Button>
              )}
            </div>
            <p className="whitespace-pre-wrap text-sm">{data.tender.description}</p>
            <p className="whitespace-pre-wrap text-sm">{data.tender.notes}</p>
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat
                label="Estimated value"
                value={`${data.tender.currency} ${Number(data.tender.estimatedValue ?? 0).toLocaleString("en-KE")}`}
              />
              <Stat
                label="Quoted bid price"
                value={Number(data.financials.bidPrice).toLocaleString("en-KE")}
              />
              <Stat
                label="Cost to pursue"
                value={Number(data.financials.totalCostToPursue).toLocaleString("en-KE")}
              />
              <Stat
                label="Bonds"
                value={Number(data.financials.bondsTotal).toLocaleString("en-KE")}
              />
            </div>
            {access === "manage" && (
              <form
                className="flex flex-wrap items-end gap-2 rounded-lg border p-3"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setBusy(true);
                  await perform(async () => {
                    await api(`/tenders/${id}/stage`, {
                      method: "PATCH",
                      body: JSON.stringify({
                        stage,
                        ...(stage === "lost"
                          ? { lostReason: reason }
                          : stage === "won"
                            ? { wonReason: reason }
                            : {}),
                      }),
                    });
                    await refresh();
                  }, "Tender stage updated");
                  setBusy(false);
                }}
              >
                <label className="field-label">
                  Update stage
                  <select
                    className="field-input"
                    value={stage}
                    onChange={(event) => setStage(event.target.value)}
                    required
                  >
                    <option value="">Select stage</option>
                    {stages.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label className="field-label flex-1">
                  Reason / outcome
                  <input
                    className="field-input"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </label>
                <Button disabled={busy || !stage}>Save stage</Button>
              </form>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <h3 className="mb-3 font-semibold">Requirements</h3>
                {!data.requirements.length && (
                  <p className="text-sm text-muted-foreground">No requirements recorded.</p>
                )}
                {data.requirements.map((row) => (
                  <div key={row.id} className="border-t py-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <p>{row.title}</p>
                      <Pill>{row.status.replaceAll("_", " ")}</Pill>
                    </div>
                    <p className="text-muted-foreground">{row.notes}</p>
                  </div>
                ))}
              </Card>
              <Card>
                <h3 className="mb-3 font-semibold">Team and time</h3>
                <p className="mb-2 text-xs text-muted-foreground">
                  {data.costs.actualHours} actual hours | {data.costs.budgetedHours} allocated hours
                </p>
                {data.resources.map((row) => (
                  <p key={row.id} className="border-t py-2 text-sm">
                    {row.user?.fullName} | {row.roleNote || "Team member"} |{" "}
                    {row.allocatedHours ?? 0} hours
                  </p>
                ))}
                {data.timeEntries.map((row) => (
                  <p key={row.id} className="border-t py-2 text-sm">
                    {row.user?.fullName} | {row.hours} hours | {row.entryDate.slice(0, 10)}
                    {row.notes ? ` | ${row.notes}` : ""}
                  </p>
                ))}
              </Card>
              <Card>
                <h3 className="mb-3 font-semibold">Pricing</h3>
                {!data.pricing.length && (
                  <p className="text-sm text-muted-foreground">No pricing items.</p>
                )}
                {data.pricing.map((row) => (
                  <div key={row.id} className="flex justify-between gap-2 border-t py-2 text-sm">
                    <p>
                      {row.description}
                      <span className="block text-xs text-muted-foreground">
                        {row.quantity} at {row.unitPrice}
                      </span>
                    </p>
                    <span>
                      {(Number(row.quantity) * Number(row.unitPrice)).toLocaleString("en-KE")}
                    </span>
                  </div>
                ))}
              </Card>
              <Card>
                <h3 className="mb-3 font-semibold">Bonds</h3>
                {!data.bonds.length && (
                  <p className="text-sm text-muted-foreground">No bonds recorded.</p>
                )}
                {data.bonds.map((row) => (
                  <div key={row.id} className="border-t py-2 text-sm">
                    <p>
                      {row.bondType.replaceAll("_", " ")} |{" "}
                      {Number(row.amount).toLocaleString("en-KE")} | {row.status}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.provider}
                      {row.expiryDate ? ` | expires ${row.expiryDate.slice(0, 10)}` : ""}
                    </p>
                  </div>
                ))}
              </Card>
            </div>
            <Card>
              <h3 className="mb-3 font-semibold">Documents</h3>
              {!data.documents.length && (
                <p className="text-sm text-muted-foreground">No documents attached.</p>
              )}
              <div className="flex flex-wrap gap-2">
                {data.documents
                  .filter((doc) => doc.latestVersion)
                  .map((doc) => (
                    <Button
                      key={doc.id}
                      variant="outline"
                      onClick={() =>
                        perform(async () => {
                          downloadBlob(
                            await api<Blob>(`/tenders/${id}/documents/${doc.id}/content`, {
                              headers: { Accept: "application/octet-stream" },
                            }),
                            doc.latestVersion!.fileName,
                          );
                        }, "Download started")
                      }
                    >
                      {doc.title} | Version {doc.latestVersion!.versionNo}
                    </Button>
                  ))}
              </div>
            </Card>
            <Card>
              <h3 className="mb-3 font-semibold">Activity and communication</h3>
              {!data.activities.length && (
                <p className="text-sm text-muted-foreground">No activity recorded.</p>
              )}
              {data.activities.map((row) => (
                <div key={row.id} className="border-t py-3 text-sm">
                  <p className="text-xs text-muted-foreground">
                    {row.type} |{" "}
                    {new Date(row.occurredAt).toLocaleString("en-GB", {
                      timeZone: "Africa/Nairobi",
                    })}
                  </p>
                  <p className="whitespace-pre-wrap">{row.summary}</p>
                </div>
              ))}
            </Card>
          </div>
        )}
        {editing && data && (
          <ProductionTenderEditor
            tender={data.tender}
            onClose={() => setEditing(false)}
            onSaved={refresh}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ProductionTenderEditor({
  tender,
  onClose,
  onSaved,
}: {
  tender?: TenderRecord | undefined;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const options = useQuery({
    queryKey: ["tender-options"],
    queryFn: () => api<{ departments: { id: string; name: string }[] }>("/tenders/options"),
  });
  return (
    <RecordDialog
      title={tender ? "Edit tender" : "New tender"}
      onClose={onClose}
      initial={{
        title: tender?.title ?? "",
        referenceNumber: tender?.referenceNumber ?? "",
        description: tender?.description ?? "",
        departmentId: tender?.department?.id ?? "",
        prospectClientName: tender?.prospectClientName ?? "",
        estimatedValue: tender?.estimatedValue == null ? "" : Number(tender.estimatedValue),
        currency: tender?.currency ?? "KES",
        submissionDeadline: tender?.submissionDeadline?.slice(0, 10) ?? "",
        notes: tender?.notes ?? "",
      }}
      fields={[
        { name: "title", label: "Tender title", required: true },
        { name: "referenceNumber", label: "Reference number" },
        {
          name: "departmentId",
          label: "Department",
          type: "select",
          required: true,
          options: [
            { value: "", label: "Choose department" },
            ...(options.data?.departments ?? []).map((row) => ({ value: row.id, label: row.name })),
          ],
        },
        { name: "prospectClientName", label: "Prospective client" },
        { name: "description", label: "Description", type: "textarea" },
        { name: "estimatedValue", label: "Estimated value", type: "number", min: 0 },
        { name: "currency", label: "Currency", required: true },
        { name: "submissionDeadline", label: "Submission deadline", type: "date" },
        { name: "notes", label: "Notes", type: "textarea" },
      ]}
      extra={options.error ? <p role="alert">{options.error.message}</p> : undefined}
      onSave={async (values) => {
        const body = {
          ...values,
          estimatedValue: values.estimatedValue === "" ? undefined : Number(values.estimatedValue),
          submissionDeadline: values.submissionDeadline || undefined,
          prospectClientName: values.prospectClientName || undefined,
        };
        await api(tender ? `/tenders/${tender.id}` : "/tenders", {
          method: tender ? "PATCH" : "POST",
          body: JSON.stringify(body),
        });
        await onSaved();
      }}
    />
  );
}
