import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";

export type ComplianceStatus = "pending" | "filed_on_time" | "filed_late" | "overdue";

export type ComplianceRecord = {
  id: string;
  client_id: string;
  client_name: string;
  period: string;
  filing_type: string;
  due_date: string;
  filed_date: string | null;
  status: ComplianceStatus;
  effective_status: ComplianceStatus;
  notes: string | null;
};

type BackendRecord = {
  id: string;
  clientId: string;
  client: { name: string } | null;
  period: string;
  filingType: string;
  dueDate: string;
  filedDate: string | null;
  status: ComplianceStatus;
  effectiveStatus: ComplianceStatus;
  notes: string | null;
};

function mapRecord(r: BackendRecord): ComplianceRecord {
  return {
    id: r.id,
    client_id: r.clientId,
    client_name: r.client?.name ?? "—",
    period: r.period.slice(0, 10),
    filing_type: r.filingType,
    due_date: r.dueDate.slice(0, 10),
    filed_date: r.filedDate ? r.filedDate.slice(0, 10) : null,
    status: r.status,
    effective_status: r.effectiveStatus,
    notes: r.notes,
  };
}

export function useComplianceRecords() {
  return useQuery({
    queryKey: ["finance", "payroll-compliance"],
    queryFn: async () => (await apiJson<BackendRecord[]>("/payroll-compliance")).map(mapRecord),
  });
}

export function useCreateComplianceRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      clientId: string;
      period: string;
      filingType: string;
      dueDate: string;
      notes?: string;
    }) => apiJson("/payroll-compliance", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance", "payroll-compliance"] }),
  });
}

export function useMarkFiled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, filedDate }: { id: string; filedDate: string }) =>
      apiJson(`/payroll-compliance/${id}/mark-filed`, {
        method: "PATCH",
        body: JSON.stringify({ filedDate }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance", "payroll-compliance"] }),
  });
}
