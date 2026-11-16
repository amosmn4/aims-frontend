import { createFileRoute } from "@tanstack/react-router";
import { PaymentLedgerPage } from "@/production/features/payment-ledger/payment-ledger-page";

export const Route = createFileRoute("/payment-ledger/")({
  component: PaymentLedgerPage,
});
