import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ROLE_LABELS, type AppRole } from "@/lib/auth";
import { LoadError } from "@/components/load-error";
import { Switch } from "@/components/ui/switch";
import {
  useRoleCapabilities,
  useSetRoleCapability,
  type RoleCapabilities,
} from "@/features/permissions/use-permissions";

const MATRIX_ROLES: AppRole[] = [
  "finance",
  "hr",
  "it",
  "marketing",
  "tender",
  "operations",
  "water",
  "department_head",
  "account_manager",
  "general_staff",
];

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** Rows are roles, columns are things a role can do; each switch saves immediately. */
export function RoleCapabilityMatrix() {
  const matrixQ = useRoleCapabilities();
  const setCell = useSetRoleCapability();

  const toggle = (
    role: AppRole,
    capability: RoleCapabilities["capabilities"][number],
    allowed: boolean,
  ) => {
    setCell
      .mutateAsync({ role, capability: capability.key, allowed })
      .then(() =>
        toast.success(
          `${ROLE_LABELS[role]} ${allowed ? "can now" : "can no longer"} ${lowerFirst(capability.label)}`,
        ),
      )
      .catch((err: unknown) =>
        toast.error(err instanceof Error ? err.message : "Couldn't save that change"),
      );
  };

  const capabilities = matrixQ.data?.capabilities ?? [];
  const rows = MATRIX_ROLES.flatMap((role) => {
    const row = matrixQ.data?.roles.find((r) => r.role === role);
    return row ? [row] : [];
  });

  return (
    <section className="rounded-lg border bg-card" aria-labelledby="role-matrix-heading">
      <div className="border-b px-4 py-3">
        <h2 id="role-matrix-heading" className="text-sm font-semibold">
          What each role can do
        </h2>
        <p className="text-xs text-muted-foreground">
          Switch something on or off and it's saved straight away for everyone with that role.
        </p>
      </div>

      {matrixQ.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : matrixQ.isError ? (
        <LoadError
          what="what each role can do"
          error={matrixQ.error}
          onRetry={() => matrixQ.refetch()}
          className="m-4"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/40">
                <th
                  scope="col"
                  className="sticky left-0 z-10 bg-secondary px-4 py-2 text-left text-xs font-medium text-muted-foreground"
                >
                  Role
                </th>
                {capabilities.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    className="min-w-30 px-2 py-2 text-center align-bottom text-xs font-medium text-muted-foreground"
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.role} className="border-t hover:bg-secondary/20">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 whitespace-nowrap bg-card px-4 py-2 text-left font-medium"
                  >
                    {ROLE_LABELS[row.role]}
                  </th>
                  {capabilities.map((c) => (
                    <td key={c.key} className="px-2 py-2 text-center">
                      <Switch
                        checked={!!row.capabilities[c.key]}
                        onCheckedChange={(v) => toggle(row.role, c, v)}
                        aria-label={`${ROLE_LABELS[row.role]}: ${c.label}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="border-t px-4 py-2 text-xs text-muted-foreground">
        Department roles only apply in their own department — for example, Finance rights never
        reach HR.
      </p>
    </section>
  );
}
