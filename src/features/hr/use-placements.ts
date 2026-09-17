import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "@/lib/api-client";

export interface PlacementRow {
  id: string;
  projectId: string;
  candidateName: string;
  position: string | null;
  placedAt: string;
  notes: string | null;
  createdAt: string;
}

const placementsKey = (projectId: string) => ["recruitment-placements", projectId] as const;

/** People placed on one recruitment project, newest first. */
export function usePlacements(projectId: string | undefined) {
  return useQuery({
    queryKey: placementsKey(projectId ?? ""),
    enabled: !!projectId,
    queryFn: () => apiJson<PlacementRow[]>(`/recruitment-funnels/${projectId}/placements`),
  });
}

// Placements can raise the funnel's "placed" count, so funnels refetch too.
function useInvalidatePlacements(projectId: string) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: placementsKey(projectId) }),
      qc.invalidateQueries({ queryKey: ["recruitment-funnels"] }),
    ]);
}

export function useAddPlacement(projectId: string) {
  const invalidate = useInvalidatePlacements(projectId);
  return useMutation({
    mutationFn: (input: {
      candidateName: string;
      position?: string;
      placedAt: string;
      notes?: string;
    }) =>
      apiJson<PlacementRow>(`/recruitment-funnels/${projectId}/placements`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  });
}

export function useRemovePlacement(projectId: string) {
  const invalidate = useInvalidatePlacements(projectId);
  return useMutation({
    mutationFn: (placementId: string) =>
      apiJson(`/recruitment-funnels/placements/${placementId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}
