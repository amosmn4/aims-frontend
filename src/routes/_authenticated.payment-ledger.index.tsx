import { createFileRoute } from "@tanstack/react-router";
import { PaymentLedgerPage } from "@/features/payment-ledger/payment-ledger-page";

export const Route = createFileRoute("/_authenticated/payment-ledger/")({
  component: PaymentLedgerPage,
});
