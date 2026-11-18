import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "./ui/button";
import { PasswordInput } from "./PasswordInput";

export function PasswordRecovery({
  token,
  onBack,
}: {
  token?: string | undefined;
  onBack: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  return (
    <section className="w-full max-w-md rounded-2xl border bg-card p-8">
      <h1 className="font-display text-2xl font-semibold">
        {token ? "Reset your password" : "Forgot password"}
      </h1>
      <p className="my-4 text-sm text-muted-foreground">
        {token
          ? "Choose a new password of at least 12 characters."
          : "Enter your Ops account email to request a reset link."}
      </p>
      {done ? (
        <p role="status" className="my-5 text-sm">
          {token
            ? "Your password has been reset. Sign in with your new password."
            : "If an active Ops account matches this email, a reset link will be sent. Check your inbox and spam folder."}
        </p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            try {
              if (token && password !== confirm) throw new Error("The passwords do not match.");
              await api(
                token ? "/auth/reset-password" : "/auth/forgot-password",
                { method: "POST", body: JSON.stringify(token ? { token, password } : { email }) },
                false,
              );
              setDone(true);
            } catch (error) {
              setError(error instanceof Error ? error.message : "Password recovery failed.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {token ? (
            <>
              <label className="field-label">
                New password
                <PasswordInput
                  required
                  minLength={12}
                  maxLength={72}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <label className="field-label">
                Confirm new password
                <PasswordInput
                  required
                  minLength={12}
                  maxLength={72}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                />
              </label>
            </>
          ) : (
            <label className="field-label">
              Email
              <input
                className="field-input"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button disabled={busy} type="submit" className="w-full">
            {busy ? "Please wait..." : token ? "Reset password" : "Send reset link"}
          </Button>
        </form>
      )}
      <Button className="mt-4" variant="ghost" onClick={onBack}>
        Return to sign in
      </Button>
    </section>
  );
}
