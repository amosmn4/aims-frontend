import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useAccount } from "@/lib/account";
import { useModuleAccess } from "@/lib/modules";

export const Route = createFileRoute("/payment-ledger")({
  head: () => ({
    meta: [{ title: "Payment Ledger | Amsol Ops" }, { name: "robots", content: "noindex" }],
  }),
  component: LedgerLayout,
});
function LedgerLayout() {
  const access = useModuleAccess("ledger");
  const { account } = useAccount();
  if (!access) return <p role="alert">Ask the CEO to assign Payment Ledger to your account.</p>;
  const tabs = [
    { to: "/payment-ledger", label: "Transactions" },
    ...(access === "manage" ? [{ to: "/payment-ledger/systems", label: "Payment systems" }] : []),
    ...(account?.role === "ceo" ? [{ to: "/payment-ledger/access", label: "Module access" }] : []),
  ];
  return (
    <div className="production-module space-y-5">
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
      <Outlet key={`${account?.id}:${access}`} />
    </div>
  );
}
