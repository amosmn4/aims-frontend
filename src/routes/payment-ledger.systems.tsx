import { createFileRoute } from "@tanstack/react-router";
import { PaymentLedgerSystems } from "@/production/features/payment-ledger/payment-ledger-systems";

export const Route = createFileRoute("/payment-ledger/systems")({
  component: PaymentLedgerSystems,
});
