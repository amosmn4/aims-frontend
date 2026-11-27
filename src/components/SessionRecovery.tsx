import { useState } from "react";
import { useAccount } from "@/lib/account";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { PasswordInput } from "./PasswordInput";
import { Button } from "./ui/button";

export function SessionRecovery() {
  const { account, sessionExpired, signIn, signOut } = useAccount();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!account || !sessionExpired) return null;
  return (
    <Dialog open>
      <DialogContent
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        className="max-w-md [&>button]:hidden"
      >
        <DialogHeader>
          <DialogTitle>Welcome back</DialogTitle>
          <DialogDescription>
            Your session has expired. Sign in to continue. Your open form stays here while you sign
            in.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (busy) return;
            setBusy(true);
            setError("");
            try {
              await signIn(
                account.email,
                password,
                localStorage.getItem("amsol-ops-api-session") === "1",
              );
              setPassword("");
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : "We could not sign you in. Check your password and connection.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="text-sm text-muted-foreground">{account.email}</p>
          <label className="field-label">
            Password
            <PasswordInput
              aria-label="Password to continue"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={busy}
              autoComplete="current-password"
              autoFocus
            />
          </label>
          {error && (
            <p role="alert" className="text-sm">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={signOut}>
              Sign out
            </Button>
            <Button type="submit" disabled={busy || !password}>
              {busy ? "Signing in..." : "Continue working"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
