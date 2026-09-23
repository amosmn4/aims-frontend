import { useAuth } from "@/lib/auth";
import { useAccessGrants } from "@/features/permissions/use-access-grants";

export type ProjectAccess = {
  /** True when the viewer may edit the project, its tasks and its notes. */
  canEdit: boolean;
  /** False while we're still checking, so pages don't flash a view-only message. */
  isResolved: boolean;
  /** Plain sentence for a badge, e.g. on the Shared with me page. */
  label: "You can view" | "You can view and edit";
};

/**
 * What the viewer may do with one project. Mirrors the backend: write access to the owning
 * department, or a "Can view and edit" share with them or their department.
 */
export function useProjectAccess(
  projectId: string | undefined,
  departmentCode: string | null | undefined,
): ProjectAccess {
  const { canWriteDepartment, profile } = useAuth();
  const byDepartment = !!departmentCode && canWriteDepartment(departmentCode);
  // Skip the lookup when department access already answers it.
  const grantsQ = useAccessGrants("projects", byDepartment ? undefined : projectId);

  const sharedForEditing = (grantsQ.data ?? []).some(
    (g) =>
      g.level === "write" &&
      (g.user ? g.user.id === profile?.id : g.department?.id === profile?.departmentId),
  );
  const canEdit = byDepartment || sharedForEditing;
  return {
    canEdit,
    isResolved: byDepartment || !projectId || !grantsQ.isPending,
    label: canEdit ? "You can view and edit" : "You can view",
  };
}
