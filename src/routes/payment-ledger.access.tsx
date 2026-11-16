import { createFileRoute, Link } from "@tanstack/react-router";
import { useAccount } from "@/lib/account";
export const Route = createFileRoute("/payment-ledger/access")({ component: LedgerAccess });
function LedgerAccess() {
  const { account } = useAccount();
  return account?.role === "ceo" ? (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Payment Ledger access</h1>
      <p>Assign No access, View or Manage in Admin under Module access.</p>
      <Link to="/admin" search={{ tab: "Module access" }} className="text-primary underline">
        Manage module access
      </Link>
    </div>
  ) : (
    <p role="alert">Only the CEO can manage module access.</p>
  );
}
