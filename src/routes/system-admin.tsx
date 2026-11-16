import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useEffect } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { Card, PageHeader, Pill } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { mutateApi, perform, saveRecord, useWorkspace } from "@/lib/workspace";
import { useAccount } from "@/lib/account";
import { api } from "@/lib/api";
import { meta } from "@/lib/meta";
import type { WeeklyReadiness } from "@/lib/weekly";

export const Route = createFileRoute("/system-admin")({
  head: () => ({
    meta: meta("System administration", "System health and CEO account assignment."),
  }),
  component: SystemAdmin,
});

function SystemAdmin() {
  const { account: me } = useAccount();
  const { accounts, people } = useWorkspace();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("Chief Executive Officer");
  const [email, setEmail] = useState("");
  const [invitationUrl, setInvitationUrl] = useState("");
  const [health, setHealth] = useState<"loading" | "ready" | "unavailable">("loading");
  const [deliveryReadiness, setDeliveryReadiness] = useState<WeeklyReadiness | null>(null);
  const ceos = accounts.filter((account) => account.role === "ceo");

  useEffect(() => {
    let active = true;
    void api<{ status: string }>("/health", {}, false)
      .then((result) => {
        if (active) setHealth(result.status === "ready" ? "ready" : "unavailable");
      })
      .catch(() => {
        if (active) setHealth("unavailable");
      });
    void api<WeeklyReadiness>("/weekly/readiness")
      .then((result) => {
        if (active) setDeliveryReadiness(result);
      })
      .catch(() => {
        if (active) setDeliveryReadiness(null);
      });
    return () => {
      active = false;
    };
  }, []);

  if (me?.role !== "system_admin")
    return <Card>System administration is restricted to the System Admin account.</Card>;

  const inviteCeo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const result = await mutateApi<{ invitationUrl: string; emailSent: boolean }>(
        "/invitations",
        {
          method: "POST",
          body: JSON.stringify({
            name,
            title,
            dept: null,
            email,
            role: "ceo",
          }),
        },
      );
      setInvitationUrl(result.invitationUrl);
      if (!result.emailSent) toast.info("Share the invitation link with the CEO.");
      setName("");
      setEmail("");
      toast.success("CEO invitation created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The invitation could not be created.");
    }
  };

  return (
    <div>
      <PageHeader
        title="System administration"
        subtitle="Manage system access and assign the CEO account."
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg font-semibold">System health</h2>
          <p className="mt-3 text-sm">
            Ops API and database:{" "}
            <span className="font-medium">
              {health === "loading" ? "Checking..." : health === "ready" ? "Ready" : "Unavailable"}
            </span>
          </p>
          <div className="mt-4 space-y-1 border-t pt-3 text-sm">
            <p>
              SMTP:{" "}
              {deliveryReadiness
                ? deliveryReadiness.smtpConfigured
                  ? "Configured"
                  : "Not configured"
                : "Unavailable"}
            </p>
            <p>
              Scheduled email worker:{" "}
              {deliveryReadiness
                ? deliveryReadiness.scheduledEmailsEnabled
                  ? "Enabled"
                  : "Disabled on this server"
                : "Unavailable"}
            </p>
            <p>
              Report link origin:{" "}
              {deliveryReadiness
                ? deliveryReadiness.originReady
                  ? "Ready"
                  : "Requires server configuration"
                : "Unavailable"}
            </p>
          </div>
        </Card>
        <Card>
          <h2 className="font-display text-lg font-semibold">CEO account</h2>
          {ceos.length ? (
            <div className="mt-4 space-y-3">
              {ceos.map((ceo) => (
                <div key={ceo.id} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">
                      {people.find((person) => person.id === ceo.personId)?.name ?? ceo.email}
                    </p>
                    <p className="text-sm text-muted-foreground">{ceo.email}</p>
                  </div>
                  <Pill>{ceo.active ? (ceo.hasPassword ? "Active" : "Invited") : "Inactive"}</Pill>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No CEO account is assigned. Invite the CEO below.
            </p>
          )}
          {accounts.filter((account) => account.role === "staff").length > 0 && (
            <div className="mt-5">
              <label className="field-label" htmlFor="ceo-assignment">
                Assign CEO from existing staff
              </label>
              <select
                id="ceo-assignment"
                className="field-input mt-2"
                value=""
                onChange={(event) => {
                  const target = accounts.find((item) => item.id === event.target.value);
                  if (target)
                    void perform(
                      () => saveRecord("accounts", { ...target, role: "ceo" }),
                      "CEO account assigned",
                    );
                }}
              >
                <option value="">Select an active staff account</option>
                {accounts
                  .filter(
                    (account) => account.role === "staff" && account.active && account.hasPassword,
                  )
                  .map((account) => (
                    <option key={account.id} value={account.id}>
                      {people.find((person) => person.id === account.personId)?.name ??
                        account.email}
                    </option>
                  ))}
              </select>
              <p className="mt-2 text-xs text-muted-foreground">
                Assigning a new CEO replaces the previous CEO role. The previous account remains
                active as staff.
              </p>
            </div>
          )}
        </Card>
        <Card>
          <h2 className="font-display text-lg font-semibold">Invite CEO</h2>
          <form className="mt-4 space-y-3" onSubmit={(event) => void inviteCeo(event)}>
            <label className="block">
              <span className="field-label">Full name</span>
              <input
                className="field-input mt-1"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="field-label">Job title</span>
              <input
                className="field-input mt-1"
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="field-label">Email</span>
              <input
                className="field-input mt-1"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <Button type="submit">Create CEO invitation</Button>
          </form>
          {invitationUrl && (
            <div className="mt-4">
              <label className="field-label" htmlFor="ceo-invitation">
                CEO invitation link
              </label>
              <input
                id="ceo-invitation"
                className="field-input mt-1"
                readOnly
                value={invitationUrl}
                onFocus={(event) => event.target.select()}
              />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
