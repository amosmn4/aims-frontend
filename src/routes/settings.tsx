import { PasswordInput } from "@/components/PasswordInput";
import { LeaveSettings } from "@/components/LeaveSettings";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Card, PageHeader } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/lib/account";
import { useRole } from "@/lib/role";
import { perform, saveRecord } from "@/lib/workspace";
import { isDemo } from "@/lib/api";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "My account | Amsol Ops" }] }),
  component: Settings,
});
function Settings() {
  const { account, changePassword } = useAccount();
  const { me } = useRole();
  const [name, setName] = useState(me.name);
  const [oldPassword, setOldPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <PageHeader title="My account" subtitle="Profile and account password" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-display text-lg font-semibold">Profile</h2>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!name.trim()) return;
              perform(() => saveRecord("people", { ...me, name: name.trim() }));
            }}
          >
            <label className="field-label">
              Full name
              <input
                className="field-input"
                required
                maxLength={200}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <p className="text-sm text-muted-foreground">{account?.email}</p>
            <p className="text-sm text-muted-foreground">
              Role:{" "}
              {account?.role === "ceo"
                ? "CEO"
                : account?.role === "system_admin"
                  ? "System administrator"
                  : "Staff"}
            </p>
            <Button type="submit">Save profile</Button>
          </form>
        </Card>
        <Card>
          <h2 className="mb-4 font-display text-lg font-semibold">Change password</h2>
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError("");
              try {
                if (nextPassword !== confirm) throw new Error("The passwords do not match.");
                await changePassword(oldPassword, nextPassword);
                setOldPassword("");
                setNextPassword("");
                setConfirm("");
                toast.success("Password changed");
              } catch (error) {
                setError(error instanceof Error ? error.message : "Password could not be changed.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field-label">
              Current password
              <PasswordInput
                className="field-input"

                autoComplete="current-password"
                required
                value={oldPassword}
                onChange={(event) => setOldPassword(event.target.value)}
              />
            </label>
            <label className="field-label">
              New password
              <PasswordInput
                className="field-input"

                autoComplete="new-password"
                minLength={isDemo ? 8 : 12}
                maxLength={128}
                required
                value={nextPassword}
                onChange={(event) => setNextPassword(event.target.value)}
              />
            </label>
            <label className="field-label">
              Confirm new password
              <PasswordInput
                className="field-input"

                autoComplete="new-password"
                minLength={isDemo ? 8 : 12}
                maxLength={128}
                required
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? "Saving..." : "Change password"}
            </Button>
          </form>
        </Card>
      </div>
      <LeaveSettings />
    </div>
  );
}
