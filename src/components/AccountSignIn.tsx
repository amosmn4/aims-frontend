import { useEffect, useState } from "react";
import { api, isDemo } from "@/lib/api";
import { useAccount } from "@/lib/account";
import { useWorkspace } from "@/lib/workspace";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function AccountSignIn({ token }: { token?: string | undefined }) {
  const { signIn, acceptInvitation } = useAccount();
  const { accounts } = useWorkspace();
  const invitation = token
    ? accounts.find(
        (account) =>
          account.active &&
          account.invitation === token &&
          (account.invitationExpires ?? 0) > Date.now(),
      )
    : undefined;
  const [email, setEmail] = useState(invitation?.email ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [remoteInvitation, setRemoteInvitation] = useState<{ email: string } | null>(null);
  const [checking, setChecking] = useState(!!token && !isDemo);
  useEffect(() => {
    if (!token || isDemo) return;
    let active = true;
    setChecking(true);
    void api<{ email: string }>(`/auth/invitation?token=${encodeURIComponent(token)}`, {}, false)
      .then((value) => {
        if (active) {
          setRemoteInvitation(value);
          setEmail(value.email);
        }
      })
      .catch((error: unknown) => {
        if (active)
          setError(error instanceof Error ? error.message : "The invitation could not be checked.");
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [token]);
  return (
    <section className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-xl sm:p-10">
      <div className="mb-8 flex items-center justify-between">
        <img src="/favicon.png" alt="Amsol" className="h-10 w-auto object-contain" />
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold tracking-wide text-primary">
          OPERATIONS
        </span>
      </div>
      <h1 className="font-display text-2xl font-semibold">
        {token ? "Set up your account" : "Sign in to Amsol Ops"}
      </h1>
      <p className="mb-6 mt-2 text-sm text-muted-foreground">
        {token
          ? "Choose a password to accept your invitation."
          : "Your projects, people and business operations."}
      </p>
      {checking ? (
        <p role="status">Checking invitation...</p>
      ) : token && !(isDemo ? invitation : remoteInvitation) ? (
        <>
          <p role="alert" className="mb-4 text-destructive">
            {error ||
              "This invitation is invalid or expired. Ask your administrator for a new link."}
          </p>
          <a href="/login" className="text-primary underline">
            Return to sign in
          </a>
        </>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            try {
              if (token) {
                if (password !== confirm) throw new Error("The passwords do not match.");
                await acceptInvitation(token, password);
              } else await signIn(email, password, remember);
            } catch (error) {
              setError(
                error instanceof Error ? error.message : "Sign in failed. Please try again.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="field-label">
            Email
            <Input
              type="email"
              autoComplete="username"
              required
              maxLength={200}
              value={email}
              disabled={!!token}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="field-label">
            Password
            <Input
              type="password"
              autoComplete={token ? "new-password" : "current-password"}
              minLength={token ? (isDemo ? 8 : 12) : 1}
              maxLength={128}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {token ? (
            <label className="field-label">
              Confirm password
              <Input
                type="password"
                autoComplete="new-password"
                minLength={isDemo ? 8 : 12}
                required
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </label>
          ) : (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              Remember me for 7 days
            </label>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Please wait..." : token ? "Activate account" : "Sign in"}
          </Button>
        </form>
      )}
      {!token && isDemo && (
        <details className="mt-6 border-t pt-4 text-sm">
          <summary className="cursor-pointer font-medium">Local demo accounts</summary>
          <div className="mt-3 space-y-1 text-muted-foreground">
            <p>CEO: ceo@amsol.local</p>
            <p>Finance: finance@amsol.local</p>
            <p>HR: brian@amsol.local</p>
            <p>IT: it@amsol.local</p>
            <p>Operations: operations@amsol.local</p>
            <p>
              Password: <code>AmsolDemo2026!</code>
            </p>
            <p className="pt-2 text-xs">
              Records and accounts are saved in this browser. Use sample data until the backend is
              connected.
            </p>
          </div>
        </details>
      )}
    </section>
  );
}
