import { useAuth } from "@/lib/auth";

export type { Capability } from "@/lib/auth";

type WithDepartment = { department_code: string | null };
type ManagedProject = WithDepartment & { scope?: string; lead_id?: string | null };

/** Mirrors backend write rules so buttons only appear for people allowed to use them. */
export function usePermissions() {
  const { canWriteDepartment, hasCapability, hasRole, isAdminOrCeo, profile } = useAuth();
  const inDepartment = (code: string | null | undefined) => !!code && canWriteDepartment(code);
  const canManageIntake = hasCapability("log_client_requests") && canWriteDepartment("operations");

  return {
    hasCapability,
    /** Tender module: create, edit, move, delete, forward tenders. */
    canManageTenders: hasCapability("manage_tenders") && canWriteDepartment("tender"),
    /** Operations owns intake: log, route and delete client requests. */
    canManageIntake,
    canEditRequest: (r: WithDepartment) => canManageIntake || inDepartment(r.department_code),
    /** Onboarding/converting a request is done by the department it was routed to. */
    canOnboardRequest: (r: WithDepartment) =>
      hasCapability("onboard_clients") && inDepartment(r.department_code),
    /** Company projects: their lead and the CEO. Others: department write access. */
    canManageProject: (p: ManagedProject) =>
      p.scope === "company"
        ? isAdminOrCeo || (!!profile?.id && p.lead_id === profile.id)
        : inDepartment(p.department_code),
    /** Only the CEO and department heads set up company projects. */
    canCreateCompanyProject: isAdminOrCeo || hasRole("department_head"),
    /** Raise, edit and void invoices; record payments. */
    canInvoice: hasCapability("raise_invoices"),
    /** Prepare and send a department's reports to the CEO. */
    canSubmitReports: (code: string | null | undefined) =>
      hasCapability("submit_reports") && inDepartment(code),
  };
}
