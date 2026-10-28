import { createFileRoute } from "@tanstack/react-router";
import { PaymentLedgerSystems } from "@/features/payment-ledger/payment-ledger-systems";

export const Route = createFileRoute("/_authenticated/payment-ledger/systems")({
  component: PaymentLedgerSystems,
});
