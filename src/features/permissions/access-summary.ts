import type { AppRole, Capability } from "@/lib/auth";
import type {
  DepartmentCapabilitiesStaffRow,
  RoleCapabilities,
} from "@/features/permissions/use-permissions";

// These roles only count in the person's home department.
const HOME_SCOPED: AppRole[] = ["department_head", "account_manager", "general_staff"];

type Department = { id: string; code: string; name: string };

function joinList(parts: string[]) {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** One plain sentence saying what a person can do in a department. */
export function describeAccess(
  person: DepartmentCapabilitiesStaffRow,
  department: Department,
  matrix: RoleCapabilities | undefined,
): string {
  const name = person.full_name || person.email;
  if (person.roles.includes("ceo")) return `${name} can see and do everything in AIMS.`;

  const roleCan = (role: AppRole, capability: Capability) =>
    !!matrix?.roles.find((r) => r.role === role)?.capabilities[capability];
  // Everyone listed for a department is treated as belonging to it.
  const inDepartment = (role: AppRole) => role === department.code || HOME_SCOPED.includes(role);

  const { read, write } = person.capabilities;
  const canDo = (capability: Capability) =>
    write.source === "override"
      ? write.effective
      : write.effective && person.roles.some((r) => roleCan(r, capability) && inDepartment(r));

  const parts: string[] = [];
  if (read.effective && write.effective) parts.push(`view and edit ${department.name}`);
  else if (read.effective) parts.push(`view ${department.name}`);
  else if (write.effective) parts.push(`edit ${department.name}`);
  if (department.code === "tender" && canDo("manage_tenders")) parts.push("manage tenders");
  if (department.code === "operations" && canDo("log_client_requests"))
    parts.push("log and route client requests");
  if (person.roles.some((r) => roleCan(r, "raise_invoices"))) parts.push("raise invoices");
  if (canDo("onboard_clients")) parts.push(`onboard won ${department.name} clients`);
  if (canDo("submit_reports")) parts.push(`submit ${department.name} reports`);

  return parts.length > 0
    ? `${name} can ${joinList(parts)}.`
    : `${name} has no access to ${department.name}.`;
}
