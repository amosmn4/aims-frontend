import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";

export type AccessGrantResource = "tenders" | "client-requests";

export interface AccessGrantRow {
  id: string;
  user: { id: string; full_name: string | null; email: string } | null;
  department: { id: string; name: string; code: string } | null;
  level: "read" | "write";
  created_at: string;
  creator: { id: string; full_name: string | null; email: string } | null;
}

type BackendGrant = {
  id: string;
  user: { id: string; fullName: string | null; email: string } | null;
  department: { id: string; name: string; code: string } | null;
  level: "read" | "write";
  createdAt: string;
  creator: { id: string; fullName: string | null; email: string } | null;
};

function mapGrant(g: BackendGrant): AccessGrantRow {
  return {
    id: g.id,
    user: g.user ? { id: g.user.id, full_name: g.user.fullName, email: g.user.email } : null,
    department: g.department,
    level: g.level,
    created_at: g.createdAt,
    creator: g.creator
      ? { id: g.creator.id, full_name: g.creator.fullName, email: g.creator.email }
      : null,
  };
}

export function useAccessGrants(resource: AccessGrantResource, resourceId: string | undefined) {
  return useQuery({
    queryKey: [resource, resourceId, "access-grants"],
    enabled: !!resourceId,
    queryFn: async () =>
      (await apiJson<BackendGrant[]>(`/${resource}/${resourceId}/access-grants`)).map(mapGrant),
  });
}

export function useCreateAccessGrant(resource: AccessGrantResource, resourceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId?: string; departmentId?: string; level: "read" | "write" }) =>
      apiJson(`/${resource}/${resourceId}/access-grants`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [resource, resourceId, "access-grants"] }),
  });
}

export function useDeleteAccessGrant(resource: AccessGrantResource, resourceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (grantId: string) =>
      apiJson(`/${resource}/${resourceId}/access-grants/${grantId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [resource, resourceId, "access-grants"] }),
  });
}
