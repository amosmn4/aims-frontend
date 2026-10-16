import { createFileRoute } from "@tanstack/react-router";
import { PaymentLedgerAccess } from "@/features/payment-ledger/payment-ledger-access";

export const Route = createFileRoute("/_authenticated/payment-ledger/access")({
  component: PaymentLedgerAccess,
});
