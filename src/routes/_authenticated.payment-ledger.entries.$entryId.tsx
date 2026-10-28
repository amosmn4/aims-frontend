import { createFileRoute } from "@tanstack/react-router";
import { PaymentLedgerDetail } from "@/features/payment-ledger/payment-ledger-detail";

export const Route = createFileRoute("/_authenticated/payment-ledger/entries/$entryId")({
  component: Detail,
});

function Detail() {
  const { entryId } = Route.useParams();
  return <PaymentLedgerDetail id={entryId} />;
}
