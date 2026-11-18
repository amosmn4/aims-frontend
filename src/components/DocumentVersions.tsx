import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRole } from "@/lib/role";
import type { StoredDocument } from "@/lib/models";
import { mutateApi, perform } from "@/lib/workspace";
import { downloadBlob } from "@/lib/file-storage";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { UploadField } from "./UploadField";
import { Button } from "./ui/button";

type Version = { id: string; version: number; name: string; size: number; createdAt: string };
export function DocumentVersions({ doc, onClose }: { doc: StoredDocument; onClose: () => void }) {
  const { mode, me } = useRole();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ["document-versions", doc.id],
    queryFn: () => api<Version[]>(`/documents/${doc.id}/versions`),
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Document versions</DialogTitle>
          <DialogDescription>
            {doc.name}. Older files remain available to staff with document access.
          </DialogDescription>
        </DialogHeader>
        {!doc.weeklyRef && !doc.report && (mode === "ceo" || doc.owner === me.id) && (
          <label className="field-label">
            Upload updated version
            <UploadField
              busy={busy}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setBusy(true);
                await perform(async () => {
                  if (file.size > 25 * 1024 * 1024) throw new Error("Choose a file up to 25 MB.");
                  const body = new FormData();
                  body.append("file", file);
                  await mutateApi(`/documents/${doc.id}/versions`, { method: "POST", body });
                  await client.invalidateQueries({ queryKey: ["document-versions", doc.id] });
                }, "New version uploaded");
                setBusy(false);
              }}
            />
          </label>
        )}
        {query.error && <p role="alert">{query.error.message}</p>}
        {query.isPending && <p role="status">Loading versions...</p>}
        <div className="divide-y">
          {query.data?.map((version) => (
            <div key={version.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div>
                <p className="font-medium">Version {version.version}</p>
                <p>{version.name}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(version.createdAt).toLocaleString("en-GB", {
                    timeZone: "Africa/Nairobi",
                  })}{" "}
                  | {(version.size / 1024).toFixed(0)} KB
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  perform(async () => {
                    const blob = await api<Blob>(
                      `/documents/${doc.id}/versions/${version.version}/content`,
                      { headers: { Accept: "application/octet-stream" } },
                    );
                    downloadBlob(blob, version.name);
                  }, "Download started")
                }
              >
                Download
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
