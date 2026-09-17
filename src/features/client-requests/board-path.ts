import { departmentScopeFor, useAuth, type DepartmentCode } from "@/lib/auth";

const BOARD_BY_DEPARTMENT: Record<DepartmentCode, string> = {
  operations: "/operations/requests",
  hr: "/hr/pipeline",
  tender: "/tender/requests",
  finance: "/finance/pipeline",
  it: "/it/pipeline",
  marketing: "/marketing/pipeline",
};

/** Where this person's Client requests board lives in their own menu. */
export function useClientRequestsBoardPath() {
  const { roles } = useAuth();
  const scope = departmentScopeFor(roles);
  return scope ? BOARD_BY_DEPARTMENT[scope] : "/pipeline/engagements";
}
