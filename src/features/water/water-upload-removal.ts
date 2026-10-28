import { apiJson } from "@/lib/api-client";
import { confirmDialog } from "@/components/confirm-dialog";

export interface UploadRemovalPreview {
  fileName: string;
  token: string;
  counts: Record<string, number>;
  blockers: string[];
  warnings: string[];
  changedRecords: number;
  includeLegacyAccounts?: boolean;
  legacyCandidates?: { type: string; id: string; label: string }[];
}

export async function removeWaterUpload(kind: "ai" | "standard", id: string) {
  const path = kind === "ai" ? `/water/imports/${id}` : `/water/usage-uploads/${id}`;
  let preview = await apiJson<UploadRemovalPreview>(path + "/deletion-preview");
  if (preview.legacyCandidates?.length) {
    const include = await confirmDialog({
      title: "Include related accounts from this older upload?",
      description: `The older uploader did not log which accounts it created. These ${preview.legacyCandidates.length} related accounts were created during its recording window: ${preview.legacyCandidates
        .slice(0, 8)
        .map((item) => item.label)
        .join(
          ", ",
        )}${preview.legacyCandidates.length > 8 ? ", plus additional accounts" : ""}. Verify that they came from this file before including them. Later records from outside this upload will block removal.`,
      confirmLabel: "Include these related accounts",
      cancelLabel: "Keep these accounts",
      destructive: true,
    });
    if (include)
      preview = await apiJson<UploadRemovalPreview>(path + "/deletion-preview?includeLegacy=true");
  }
  if (preview.blockers.length) throw new Error(preview.blockers.join(" "));
  const labels: Record<string, string> = {
    reading: "readings",
    purchase: "payments",
    usage: "usage periods",
    meter: "meters",
    customer: "customers",
  };
  const counts =
    Object.entries(preview.counts)
      .filter(([, count]) => count > 0)
      .map(([key, count]) => `${count.toLocaleString()} ${labels[key] || key}`)
      .join(", ") || "the staged extraction";
  const approved = await confirmDialog({
    title: `Delete upload "${preview.fileName}" and its records?`,
    description: `This removes ${counts}, its extracted rows, and the uploaded source file where stored. Pre-existing and reused records remain. ${preview.changedRecords ? `${preview.changedRecords} imported records have been edited since import and will also be removed. ` : ""}${preview.warnings.join(" ")} A removal audit is retained. This cannot be undone.`,
    confirmLabel: "Delete upload and its records",
    destructive: true,
  });
  if (!approved) return null;
  return apiJson<{ id: string; counts: Record<string, number>; sourceFilePendingRemoval: boolean }>(
    path,
    {
      method: "DELETE",
      body: JSON.stringify({
        token: preview.token,
        includeLegacyAccounts: preview.includeLegacyAccounts === true,
      }),
    },
  );
}
