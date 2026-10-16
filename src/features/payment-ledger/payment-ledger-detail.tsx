import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { LoadError } from "@/components/load-error";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ledgerDate,
  ledgerMoney,
  useLedgerAccess,
  useLedgerData,
  useLedgerMutation,
  type LedgerApplication,
} from "./use-payment-ledger";

type Detail = {
  id: string;
  receipt: string;
  provider: string;
  paybill: string;
  reference: string;
  amount: string | null;
  currency: string;
  direction: string;
  destination: string;
  destination_name: string;
  channel: string;
  payment_status: string;
  status: string;
  payer_name: string;
  payer_phone: string;
  meter_number: string | null;
  transaction_at: string | null;
  received_at: string;
  processed_at: string | null;
  syncedAt: string;
  requires_review: boolean;
  error_message: string;
  dispatch: {
    status: string;
    attempt_count: number;
    next_retry_at: string | null;
    attempts: unknown[];
  } | null;
  water_tokens: {
    token_value: string;
    customer_name?: string;
    meter_id?: string;
  }[];
  metadata: {
    water_token?: {
      token_value?: string;
      customer_name?: string;
      meter_number?: string;
    };
    vend_by_units?: boolean;
    units?: unknown;
  };
  raw_payload: unknown;
  notifications: unknown;
  intent_detail: unknown;
  history: unknown;
  water_payment_detail: unknown;
};

function JsonRecord({ title, data }: { title: string; data: unknown }) {
  return (
    <details className="rounded-lg border p-4">
      <summary className="cursor-pointer text-sm font-medium">{title}</summary>
      <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-all text-xs">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}

export function PaymentLedgerDetail({ id }: { id: string }) {
  const access = useLedgerAccess();
  const detail = useLedgerData<Detail>(`entries/${id}`, access.data?.read);
  const applications = useLedgerData<LedgerApplication[]>("applications", access.data?.write);
  const [destination, setDestination] = useState("water");
  const [meterSearch, setMeterSearch] = useState("");
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const mutation = useLedgerMutation<Detail>();
  const queryClient = useQueryClient();
  const event = detail.data;
  const meters = useLedgerData<{ id: string; meter_number: string }[]>(
    `meters?${new URLSearchParams({ paybill: event?.paybill ?? "", search: meterSearch })}`,
    !!(access.data?.write && event?.destination === "unallocated" && destination === "water"),
  );
  const submit = (form: FormEvent, action: string) => {
    form.preventDefault();
    mutation.mutate(
      {
        path: `entries/${id}/${action}`,
        data:
          action === "allocate"
            ? {
                destination,
                reason,
                [destination === "water" ? "meter_id" : "application_id"]: target,
              }
            : { reason },
      },
      {
        onSuccess: (result) => {
          queryClient.setQueriesData(
            {
              predicate: (query) =>
                query.queryKey[0] === "payment-ledger" && query.queryKey[3] === `entries/${id}`,
            },
            result,
          );
          toast.success("Payment action saved. Ledger synchronization will update the record.");
          setReason("");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };
  if (detail.isError)
    return (
      <LoadError what="transaction details" error={detail.error} onRetry={() => detail.refetch()} />
    );
  if (!event) return <p>Loading transaction details...</p>;
  const token = event.water_tokens?.[0] ?? event.metadata?.water_token;
  const fields = {
    Receipt: event.receipt,
    "Ledger ID": event.id,
    Provider: event.provider,
    Paybill: event.paybill,
    "Original account": event.reference,
    System: event.destination_name,
    Destination: event.destination,
    Amount: event.metadata?.vend_by_units
      ? `${event.metadata.units ?? ""} units granted`
      : ledgerMoney(event.amount, event.currency),
    Direction: event.direction === "in" ? "Incoming" : "Outgoing",
    Channel: event.channel.toUpperCase(),
    "Payment status": event.payment_status,
    "Processing status": event.status,
    "Payer or recipient": event.payer_name,
    Phone: event.payer_phone,
    Meter:
      event.meter_number ??
      (token && "meter_id" in token ? token.meter_id : event.metadata?.water_token?.meter_number),
    Customer: token?.customer_name,
    Token: token?.token_value,
    "Needs review": event.requires_review ? "Yes" : "No",
    "Transaction time": ledgerDate(event.transaction_at),
    Received: ledgerDate(event.received_at),
    Processed: ledgerDate(event.processed_at),
    Synchronized: ledgerDate(event.syncedAt),
  };
  return (
    <div className="space-y-5">
      <PageHeader title="Transaction details" description={event.receipt} />
      <Link to="/payment-ledger" className="text-sm text-primary underline">
        Back to ledger
      </Link>
      <dl className="grid gap-4 rounded-lg border bg-card p-5 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(fields).map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 break-all text-sm font-medium">{value || "Unavailable"}</dd>
          </div>
        ))}
      </dl>
      {event.error_message && <p className="text-sm text-destructive">{event.error_message}</p>}
      {access.data?.write && event.destination === "unallocated" && (
        <form
          onSubmit={(form) => submit(form, "allocate")}
          className="max-w-xl space-y-3 rounded-lg border p-4"
        >
          <h2 className="font-semibold">Allocate payment</h2>
          <label className="grid gap-1 text-sm">
            Destination
            <select
              className="h-10 rounded-md border bg-background px-2"
              value={destination}
              onChange={(input) => {
                setDestination(input.target.value);
                setTarget("");
              }}
            >
              <option value="water">Water</option>
              <option value="external">Other system</option>
            </select>
          </label>
          {destination === "water" && (
            <label className="grid gap-1 text-sm">
              Search meter
              <Input
                value={meterSearch}
                onChange={(input) => {
                  setMeterSearch(input.target.value);
                  setTarget("");
                }}
              />
            </label>
          )}
          <label className="grid gap-1 text-sm">
            {destination === "water" ? "Meter" : "Payment system"}
            <select
              required
              className="h-10 rounded-md border bg-background px-2"
              value={target}
              onChange={(input) => setTarget(input.target.value)}
            >
              <option value="">Select</option>
              {destination === "water"
                ? meters.data?.map((meter) => (
                    <option key={meter.id} value={meter.id}>
                      {meter.meter_number}
                    </option>
                  ))
                : applications.data
                    ?.filter((app) => app.is_active && app.paybill === event.paybill)
                    .map((app) => (
                      <option key={app.id} value={app.id}>
                        {app.name}
                      </option>
                    ))}
            </select>
          </label>
          {(meters.isError || applications.isError) && (
            <p className="text-sm text-destructive">
              Could not load allocation destinations. Refresh and retry.
            </p>
          )}
          <label className="grid gap-1 text-sm">
            Reason
            <Input
              required
              minLength={5}
              maxLength={1000}
              value={reason}
              onChange={(input) => setReason(input.target.value)}
            />
          </label>
          <Button
            disabled={
              mutation.isPending ||
              !target ||
              event.amount === null ||
              event.payment_status !== "succeeded"
            }
          >
            Allocate payment
          </Button>
        </form>
      )}
      {access.data?.write &&
        event.dispatch?.status === "failed" &&
        event.status !== "succeeded" && (
          <form
            onSubmit={(form) => submit(form, "retry")}
            className="max-w-xl space-y-3 rounded-lg border p-4"
          >
            <h2 className="font-semibold">Retry exhausted delivery</h2>
            <label className="grid gap-1 text-sm">
              Reason
              <Input
                required
                minLength={5}
                maxLength={1000}
                value={reason}
                onChange={(input) => setReason(input.target.value)}
              />
            </label>
            <Button disabled={mutation.isPending}>Queue another delivery cycle</Button>
          </form>
        )}
      {event.dispatch && (
        <section className="space-y-3">
          <h2 className="font-semibold">Processing attempts</h2>
          <p className="text-sm">
            {event.dispatch.attempt_count} attempts. Delivery: {event.dispatch.status}. Next retry:{" "}
            {ledgerDate(event.dispatch.next_retry_at)}
          </p>
          {event.dispatch.attempts.map((attempt, index) => (
            <JsonRecord
              key={index}
              title={`Attempt ${index + 1}: request and response`}
              data={attempt}
            />
          ))}
        </section>
      )}
      <section className="space-y-3">
        <h2 className="font-semibold">Transaction records</h2>
        {[
          ["Original provider payload", event.raw_payload],
          ["All received notifications", event.notifications],
          ["Payment intent and order", event.intent_detail],
          ["Water payment", event.water_payment_detail],
          ["Water tokens and SMS delivery", event.water_tokens],
          ["Metadata", event.metadata],
          ["Audit history", event.history],
        ].map(([title, data]) => (
          <JsonRecord key={String(title)} title={String(title)} data={data} />
        ))}
      </section>
    </div>
  );
}
