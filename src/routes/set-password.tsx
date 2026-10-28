import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Check, Circle, KeyRound, Loader2, Send } from "lucide-react";
import { useAuth, homeRouteFor } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { FormField } from "@/components/form-field";
import {
  LINK_TTL_HOURS,
  MIN_PASSWORD_LENGTH,
  requestErrorMessage,
} from "@/features/auth/auth-rules";
import { AuthBrand, AuthNotice, SupportContactLine } from "@/features/auth/public-company-info";

const searchSchema = z.object({
  token: z.string().catch(""),
});

export const Route = createFileRoute("/set-password")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Set your password — AIMS" }, { name: "robots", content: "noindex" }],
  }),
  component: SetPasswordPage,
});

function SetPasswordPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const { setPassword: submitSetPassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [linkInvalid, setLinkInvalid] = useState(false);

  const longEnough = password.length >= MIN_PASSWORD_LENGTH;
  const matches = confirm.length > 0 && confirm === password;
  // Flag a mismatch as soon as the typed part stops matching.
  const mismatch =
    confirm.length > 0 &&
    (confirm.length >= password.length ? confirm !== password : !password.startsWith(confirm));

  const passwordError =
    submitted && !longEnough ? `Use at least ${MIN_PASSWORD_LENGTH} characters.` : undefined;
  const confirmError = mismatch
    ? "Passwords don't match."
    : submitted && !confirm
      ? "Type the password again."
      : submitted && !matches
        ? "Passwords don't match."
        : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setFormError(null);
    if (!longEnough || !matches) {
      document.getElementById(!longEnough ? "password" : "confirm")?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const roles = await submitSetPassword(token, password);
      toast.success("Password set — welcome to AIMS");
      navigate({ to: homeRouteFor(roles) });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setLinkInvalid(true);
      else setFormError(requestErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!token || linkInvalid) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold">
          {token ? "This link is invalid or has expired" : "This page needs a link"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {token
            ? `Password links work once and expire after ${LINK_TTL_HOURS} hours.`
            : "Open the link from your invite or reset email. If you can't find it, ask for a new one."}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button asChild className="w-full">
            <Link to="/forgot-password">
              <Send className="mr-2 h-4 w-4" />
              Send me a new link
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/auth">Go to sign in</Link>
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-2xl font-semibold">Set your password</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose a password to finish setting up your account.
      </p>

      {formError && (
        <AuthNotice tone="error" className="mt-4">
          {formError}
        </AuthNotice>
      )}

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <FormField
          id="password"
          label="New password"
          required
          error={passwordError}
          hint={
            <span
              id="password-rule"
              className={`flex items-center gap-1 ${longEnough ? "text-success" : ""}`}
            >
              {longEnough ? (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Circle className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              At least {MIN_PASSWORD_LENGTH} characters
            </span>
          }
        >
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            aria-invalid={!!passwordError}
            aria-describedby={passwordError ? "password-error" : "password-rule"}
          />
        </FormField>
        <FormField
          id="confirm"
          label="Confirm password"
          required
          error={confirmError}
          hint={
            matches ? (
              <span className="flex items-center gap-1 text-success">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                Passwords match
              </span>
            ) : undefined
          }
        >
          <PasswordInput
            id="confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            aria-invalid={!!confirmError}
            aria-describedby={confirmError ? "confirm-error" : undefined}
          />
        </FormField>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <KeyRound className="mr-2 h-4 w-4" />
          )}
          Set password and sign in
        </Button>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm">
        <AuthBrand className="mb-6" />
        {children}
        <SupportContactLine className="mt-6 text-center" />
      </div>
    </div>
  );
}
