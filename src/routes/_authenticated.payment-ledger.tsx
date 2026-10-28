import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { PermissionDenied } from "@/components/require-role";
import { LoadError } from "@/components/load-error";
import { useLedgerAccess } from "@/features/payment-ledger/use-payment-ledger";

export const Route = createFileRoute("/_authenticated/payment-ledger")({
  head: () => ({
    meta: [{ title: "Payment Ledger | AIMS" }, { name: "robots", content: "noindex" }],
  }),
  component: PaymentLedgerLayout,
});

function PaymentLedgerLayout() {
  const access = useLedgerAccess();
  if (access.isPending) return <p>Loading payment ledger access...</p>;
  if (access.isError)
    return (
      <LoadError
        what="payment ledger access"
        error={access.error}
        onRetry={() => access.refetch()}
      />
    );
  if (!access.data?.read)
    return (
      <PermissionDenied message="Ask the CEO or system administrator for payment ledger access." />
    );
  const tabs = [
    { to: "/payment-ledger", label: "Transactions" },
    ...(access.data.write ? [{ to: "/payment-ledger/systems", label: "Payment systems" }] : []),
    ...(access.data.manageAccess ? [{ to: "/payment-ledger/access", label: "Module access" }] : []),
  ];
  return (
    <div className="space-y-5">
      <nav aria-label="Payment ledger" className="flex flex-wrap gap-4 border-b pb-3">
        {tabs.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            activeOptions={{ exact: true }}
            activeProps={{ className: "text-primary font-semibold" }}
            className="text-sm"
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
