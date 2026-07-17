import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { RequireRole } from "@/components/require-role";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/finance", label: "Overview", exact: true },
  { to: "/finance/invoices", label: "Invoices & Billing" },
  { to: "/finance/debtors", label: "Debtors" },
  { to: "/finance/revenue", label: "Revenue & Margin" },
  { to: "/finance/budgets", label: "Budgets" },
  { to: "/finance/payroll-compliance", label: "Payroll Compliance" },
  { to: "/finance/upload", label: "Excel Upload" },
  { to: "/finance/reports", label: "Reports to CEO" },
];

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [{ title: "Finance — AIMS" }, { name: "robots", content: "noindex" }] }),
  component: FinanceLayout,
});

function FinanceLayout() {
  const location = useLocation();
  return (
    <RequireRole
      roles={["finance"]}
      message="Finance workspace is restricted to the Finance team, CEO and System Administrator."
    >
      <div>
        <PageHeader
          title="Finance"
          description="Invoicing, debtor management, revenue and margin reporting for Amsol."
        />
        <div className="border-b mb-4 flex gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const active = t.exact
              ? location.pathname === t.to
              : location.pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
        <Outlet />
      </div>
    </RequireRole>
  );
}
