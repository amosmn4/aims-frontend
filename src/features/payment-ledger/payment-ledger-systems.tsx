import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { PermissionDenied } from "@/components/require-role";
import { LoadError } from "@/components/load-error";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  useLedgerAccess,
  useLedgerData,
  useLedgerMutation,
  type LedgerApplication,
} from "./use-payment-ledger";

const emptyForm = {
  name: "",
  code: "",
  paybill: "",
  reference_prefix: "",
  callback_url: "",
  is_active: true,
};
type Credentials = { api_key: string; signing_secret: string };

export function PaymentLedgerSystems() {
  const access = useLedgerAccess();
  const applications = useLedgerData<LedgerApplication[]>("applications", access.data?.write);
  const mutation = useLedgerMutation<Partial<Credentials>>();
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [rotation, setRotation] = useState<string | null>(null);
  const saved = (result: Partial<Credentials>) => {
    if (result.api_key && result.signing_secret) setCredentials(result as Credentials);
    setForm(emptyForm);
    setEditing(null);
    setRotation(null);
    toast.success("Payment system saved");
  };
  const save = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate(
      {
        path: editing ? `applications/${editing}` : "applications",
        method: editing ? "PATCH" : "POST",
        data: form,
      },
      { onSuccess: saved, onError: (error) => toast.error(error.message) },
    );
  };
  if (!access.data?.write)
    return (
      <PermissionDenied message="Payment system administration requires manage access to the payment ledger." />
    );
  return (
    <div className="space-y-5">
      <PageHeader
        title="Payment systems"
        description="Register the systems that receive shared paybill payments."
      />
      {credentials && (
        <section className="space-y-3 rounded-lg border bg-card p-4">
          <h2 className="font-semibold">Save these credentials now</h2>
          <p className="text-sm text-muted-foreground">
            Credentials are displayed once. Store them in the receiving system's server
            configuration.
          </p>
          <label className="grid gap-1 text-sm">
            API key
            <Input readOnly value={credentials.api_key} />
          </label>
          <label className="grid gap-1 text-sm">
            Callback signing secret
            <Input readOnly value={credentials.signing_secret} />
          </label>
          <Button variant="outline" onClick={() => setCredentials(null)}>
            Dismiss credentials
          </Button>
        </section>
      )}
      <form onSubmit={save} className="grid max-w-3xl gap-4 rounded-lg border p-4 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">
          {editing ? "Edit payment system" : "Register payment system"}
        </h2>
        {[
          ["name", "System name"],
          ["code", "System code"],
          ["paybill", "Paybill"],
          ["reference_prefix", "Account prefix"],
          ["callback_url", "HTTPS callback URL"],
        ].map(([key, label]) => (
          <label key={key} className="grid gap-1 text-sm">
            {label}
            <Input
              required
              disabled={!!editing && ["code", "paybill", "reference_prefix"].includes(key)}
              value={String(form[key as keyof typeof form])}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  [key]:
                    key === "reference_prefix"
                      ? event.target.value.toUpperCase()
                      : event.target.value,
                }))
              }
              type={key === "callback_url" ? "url" : "text"}
              maxLength={
                key === "reference_prefix"
                  ? 8
                  : key === "callback_url"
                    ? 500
                    : key === "name"
                      ? 100
                      : key === "code"
                        ? 50
                        : 12
              }
            />
          </label>
        ))}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                is_active: event.target.checked,
              }))
            }
          />
          Active
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <Button disabled={mutation.isPending}>
            {editing ? "Save changes" : "Register system"}
          </Button>
          {editing && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditing(null);
                setForm(emptyForm);
              }}
            >
              Cancel edit
            </Button>
          )}
        </div>
      </form>
      {applications.isError ? (
        <LoadError
          what="payment systems"
          error={applications.error}
          onRetry={() => applications.refetch()}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted">
              <tr>
                {["System", "Paybill", "Prefix", "Callback", "Status", "Actions"].map((label) => (
                  <th key={label} className="p-3">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {applications.data?.map((app) => (
                <tr key={app.id} className="border-t">
                  <td className="p-3">
                    {app.name}
                    <p className="text-xs text-muted-foreground">{app.code}</p>
                  </td>
                  <td className="p-3">{app.paybill}</td>
                  <td className="p-3">{app.reference_prefix}</td>
                  <td className="max-w-sm break-all p-3">{app.callback_url}</td>
                  <td className="p-3">{app.is_active ? "Active" : "Disabled"}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        disabled={mutation.isPending}
                        onClick={() => {
                          setEditing(app.id);
                          setForm({
                            name: app.name,
                            code: app.code,
                            paybill: app.paybill,
                            reference_prefix: app.reference_prefix,
                            callback_url: app.callback_url,
                            is_active: app.is_active,
                          });
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        disabled={mutation.isPending}
                        onClick={() => setRotation(app.id)}
                      >
                        Rotate keys
                      </Button>
                    </div>
                    {rotation === app.id && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs">
                          This revokes the current API key and signing secret.
                        </p>
                        <Button
                          disabled={mutation.isPending}
                          onClick={() =>
                            mutation.mutate(
                              {
                                path: `applications/${app.id}/rotate-credentials`,
                              },
                              {
                                onSuccess: saved,
                                onError: (error) => toast.error(error.message),
                              },
                            )
                          }
                        >
                          Confirm rotation
                        </Button>
                        <Button variant="outline" onClick={() => setRotation(null)}>
                          Cancel
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!applications.data?.length && (
                <tr>
                  <td colSpan={6} className="p-4 text-center">
                    {applications.isPending
                      ? "Loading systems..."
                      : "No payment systems registered."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
