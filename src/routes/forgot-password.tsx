import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { ApiError, apiJson } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { LINK_TTL_HOURS, emailError, requestErrorMessage } from "@/features/auth/auth-rules";
import { AuthBrand, AuthNotice, SupportContactLine } from "@/features/auth/public-company-info";

const searchSchema = z.object({
  email: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/forgot-password")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Reset your password — AIMS" }, { name: "robots", content: "noindex" }],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { email: emailFromLink } = Route.useSearch();
  const [email, setEmail] = useState(emailFromLink ?? "");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = emailError(email);
    setFieldError(error);
    setFormError(null);
    if (error) {
      document.getElementById("email")?.focus();
      return;
    }
    const address = email.trim();
    setSubmitting(true);
    try {
      await apiJson("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: address }),
      });
      setSentTo(address);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) setFieldError(err.message);
      else setFormError(requestErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm">
        <AuthBrand className="mb-6" />

        {sentTo ? (
          <>
            <h1 className="text-2xl font-semibold">Check your email</h1>
            <AuthNotice tone="info" className="mt-4">
              If an account exists for <span className="font-medium">{sentTo}</span>, we've emailed
              a link to reset your password. It expires in {LINK_TTL_HOURS} hours.
            </AuthNotice>
            <p className="mt-3 text-xs text-muted-foreground">
              Nothing after a few minutes? Check your spam folder, or{" "}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => setSentTo(null)}
              >
                try a different email
              </button>
              .
            </p>
            <Button asChild className="mt-6 w-full">
              <Link to="/auth">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to sign in
              </Link>
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold">Reset your password</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your work email and we'll send you a link to set a new password.
            </p>

            {formError && (
              <AuthNotice tone="error" className="mt-4">
                {formError}
              </AuthNotice>
            )}

            <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
              <FormField id="email" label="Work email" required error={fieldError}>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setFieldError(undefined);
                    setFormError(null);
                  }}
                  aria-invalid={!!fieldError}
                  aria-describedby={fieldError ? "email-error" : undefined}
                />
              </FormField>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send reset link
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Link to="/auth" className="text-sm text-primary hover:underline">
                Back to sign in
              </Link>
            </div>
          </>
        )}

        <SupportContactLine className="mt-6 text-center" />
      </div>
    </div>
  );
}
