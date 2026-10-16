import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { PermissionDenied } from "@/components/require-role";
import { LoadError } from "@/components/load-error";
import { Input } from "@/components/ui/input";
import { useLedgerAccess, useLedgerData, useLedgerMutation } from "./use-payment-ledger";

type Person = {
  id: string;
  email: string;
  fullName: string | null;
  defaultAccess: boolean;
  level: "read" | "write" | null;
};

export function PaymentLedgerAccess() {
  const access = useLedgerAccess();
  const people = useLedgerData<Person[]>("access/people", access.data?.manageAccess);
  const mutation = useLedgerMutation();
  const [search, setSearch] = useState("");
  if (!access.data?.manageAccess)
    return (
      <PermissionDenied message="Only the CEO and system administrator can grant payment ledger access." />
    );
  return (
    <div className="max-w-4xl space-y-5">
      <PageHeader
        title="Payment ledger access"
        description="The CEO and system administrator have default access. Grant other individuals access to this module."
      />
      <p className="text-sm text-muted-foreground">
        View allows transaction details, totals, and exports. Manage also allows payment allocation,
        delivery retries, and payment system administration. Only the CEO and system administrator
        can change access.
      </p>
      <Input
        aria-label="Find a person"
        placeholder="Search by name or email"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {people.isError ? (
        <LoadError what="module access" error={people.error} onRetry={() => people.refetch()} />
      ) : (
        <ul className="divide-y rounded-lg border">
          {people.data
            ?.filter((person) =>
              `${person.fullName} ${person.email}`.toLowerCase().includes(search.toLowerCase()),
            )
            .map((person) => (
              <li key={person.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-medium">{person.fullName ?? person.email}</p>
                  <p className="text-xs text-muted-foreground">{person.email}</p>
                </div>
                {person.defaultAccess ? (
                  <span className="text-sm text-muted-foreground">Default full access</span>
                ) : (
                  <select
                    aria-label={`Payment ledger access for ${person.fullName ?? person.email}`}
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                    value={person.level ?? "none"}
                    disabled={mutation.isPending}
                    onChange={(event) =>
                      mutation.mutate(
                        {
                          path: `access/people/${person.id}`,
                          method: "PUT",
                          data: { level: event.target.value },
                        },
                        {
                          onSuccess: () => toast.success("Payment ledger access updated"),
                          onError: (error) => toast.error(error.message),
                        },
                      )
                    }
                  >
                    <option value="none">No access</option>
                    <option value="read">View</option>
                    <option value="write">Manage</option>
                  </select>
                )}
              </li>
            ))}
          {people.isPending && <li className="p-4 text-sm">Loading people...</li>}
        </ul>
      )}
    </div>
  );
}
