import { useAuth } from "@/lib/auth";

export type { Capability } from "@/lib/auth";

type WithDepartment = { department_code: string | null };

/** Mirrors backend write rules so buttons only appear for people allowed to use them. */
export function usePermissions() {
  const { canWriteDepartment, hasCapability } = useAuth();
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
    canManageProject: (p: WithDepartment) => inDepartment(p.department_code),
    /** Raise, edit and void invoices; record payments. */
    canInvoice: hasCapability("raise_invoices"),
    /** Prepare and send a department's reports to the CEO. */
    canSubmitReports: (code: string | null | undefined) =>
      hasCapability("submit_reports") && inDepartment(code),
  };
}
