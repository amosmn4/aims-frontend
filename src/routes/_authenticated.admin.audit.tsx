import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";
import { PageHeader } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";
import { usePagination, type PaginatedResponse } from "@/hooks/use-pagination";
import { PaginationBar } from "@/components/pagination-bar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldOff } from "lucide-react";

type AuditLogRow = {
  id: string;
  userId: string | null;
  user: { id: string; fullName: string | null; email: string } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
};

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({ meta: [{ title: "Audit Log — AIMS" }, { name: "robots", content: "noindex" }] }),
  component: AuditPage,
});

function AuditPage() {
  const { isAdminOrCeo } = useAuth();
  const { page, pageSize, setPage, setPageSize } = usePagination(25);

  const q = useQuery({
    queryKey: ["audit_log", page, pageSize],
    enabled: isAdminOrCeo,
    queryFn: () =>
      apiJson<PaginatedResponse<AuditLogRow>>(`/audit-log?page=${page}&pageSize=${pageSize}`),
  });
  const rows = q.data?.data ?? [];
  const total = q.data?.total ?? 0;

  if (!isAdminOrCeo) {
    return (
      <div>
        <PageHeader title="Audit Log" />
        <div className="rounded-lg border bg-card p-8 text-center">
          <ShieldOff className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Admin access required.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="Full audit trail of key actions across AIMS — who changed what, when."
      />
      <div className="rounded-lg border bg-card overflow-hidden">
        {q.isLoading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No audit entries yet. Actions across AIMS will appear here as departments start using
            the system.
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>User</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{row.action}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.entityType}
                      {row.entityId && (
                        <span className="text-muted-foreground"> · {row.entityId}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.user?.fullName || row.user?.email || "System"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationBar
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </div>
    </div>
  );
}
