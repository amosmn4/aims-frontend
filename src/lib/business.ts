// Pure helpers for tenders, client requests and sister-business visibility/aggregation.
// Local view selection does not grant production authorization.
import {
  businesses,
  businessFinance,
  businessAccess,
  staffBusiness,
  clientRequests,
  people,
  tenders,
  type Business,
  type BusinessFinance,
  type ClientRequest,
  type PersonBusiness,
  type Tender,
} from "./data";
import type { ViewMode } from "./role";

export const fmtKes = (n: number) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(n);
export const compactKes = (n: number) =>
  "KSh " + new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
export const monthLabel = (month: string) => {
  if (!month) return "No entries";
  const [y = 0, m = 1] = month.split("-").map(Number);
  return new Date(y, m - 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
};

// Where a person works and which extra businesses the CEO granted them.
export type BizAccess = { home: string | null; granted: string[]; permissions?: PersonBusiness[] };
export function accessFor(
  meId: string,
  home: PersonBusiness[] = staffBusiness,
  grants: PersonBusiness[] = businessAccess,
): BizAccess {
  return {
    home: home.find((h) => h.person === meId)?.business ?? null,
    granted: grants.filter((g) => g.person === meId).map((g) => g.business),
    permissions: grants.filter((g) => g.person === meId),
  };
}
// Everyone without a home business works for Amsol itself.
export const homeBusinessOf = (meId: string, access: BizAccess = accessFor(meId)) =>
  access.home ?? "b0";

// Business membership and financial access are assigned independently.
export function canSeeBusinesses(
  mode: ViewMode,
  meId: string,
  dept: string | null,
  list: Business[] = businesses,
  access: BizAccess = accessFor(meId),
): boolean {
  if (mode === "ceo") return true;
  return list.some((b) => canSeeBusiness(b, mode, meId, dept, access));
}
export function canSeeBusiness(
  b: Business,
  mode: ViewMode,
  meId: string,
  dept: string | null,
  access: BizAccess = accessFor(meId),
): boolean {
  if (mode === "ceo") return true;
  return (
    b.id === "b0" || (access.home !== null && b.id === access.home) || access.granted.includes(b.id)
  );
}

export function canReadBusinessFinance(mode: ViewMode, business: string, access: BizAccess) {
  return (
    mode === "ceo" || !!access.permissions?.find((grant) => grant.business === business)?.finance
  );
}

export function canManageBusinessFinance(mode: ViewMode, business: string, access: BizAccess) {
  return (
    mode === "ceo" ||
    access.permissions?.find((grant) => grant.business === business)?.finance === "manage"
  );
}

export type Totals = { revenue: number; expenses: number; profit: number };
export function businessTotals(rows: BusinessFinance[]): Totals {
  const revenue = rows.reduce((s, r) => s + r.revenue, 0);
  const expenses = rows.reduce((s, r) => s + r.expenses, 0);
  return { revenue, expenses, profit: revenue - expenses };
}
export function rowsFor(rows: BusinessFinance[], businessId: string): BusinessFinance[] {
  return rows.filter((r) => r.business === businessId);
}
// Group revenue rows: one per business with month-by-month revenue for the comparison chart.
export function revenueByBusiness(rows: BusinessFinance[], list: Business[] = businesses) {
  const months = [...new Set(rows.map((r) => r.month))].sort();
  return list.map((b) => {
    const entry: { business: string; name: string } & Record<string, number | string> = {
      business: b.id,
      name: b.name,
    };
    for (const m of months)
      entry[m] = rows
        .filter((r) => r.business === b.id && r.month === m)
        .reduce((s, r) => s + r.revenue, 0);
    return entry;
  });
}
export function latestMonth(rows: BusinessFinance[]): string {
  return [...new Set(rows.map((r) => r.month))].sort().at(-1) ?? "";
}

// Tenders: the CEO sees the whole pipeline; everyone else sees only tenders they are assigned to.
export function visibleTenders(mode: ViewMode, meId: string, list: Tender[] = tenders): Tender[] {
  if (mode === "ceo") return list;
  return list.filter((t) => t.members.includes(meId));
}
export function canSeeTenders(mode: ViewMode, meId: string, list: Tender[] = tenders): boolean {
  return mode === "ceo" || list.some((t) => t.members.includes(meId));
}

// The CEO sees all requests; each owning department sees its queue and other staff see assignments.
export function visibleRequests(
  mode: ViewMode,
  meId: string,
  dept: string | null,
  list: ClientRequest[] = clientRequests,
  staff = people,
  managedBusinesses: string[] = [],
): ClientRequest[] {
  if (mode === "ceo") return list;
  return list.filter(
    (r) =>
      r.handler === meId ||
      (!!dept && r.assignedDept === dept) ||
      managedBusinesses.includes(r.business ?? "b0"),
  );
}
export function canSeeRequests(
  mode: ViewMode,
  meId: string,
  dept: string | null,
  list: ClientRequest[] = clientRequests,
  staff = people,
  managedBusinesses: string[] = [],
): boolean {
  return (
    mode === "ceo" ||
    (!!dept && ["operations", "marketing"].includes(dept)) ||
    visibleRequests(mode, meId, dept, list, staff, managedBusinesses).length > 0
  );
}
export const peopleOf = people;
