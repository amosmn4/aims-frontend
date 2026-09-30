import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, LogIn } from "lucide-react";
import { useAuth, homeRouteFor, type AppRole } from "@/lib/auth";
import { ApiError, getAccessToken } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FormField } from "@/components/form-field";
import {
  MIN_PASSWORD_LENGTH,
  emailError,
  requestErrorMessage,
  safeRedirectPath,
} from "@/features/auth/auth-rules";
import {
  AuthBrand,
  AuthNotice,
  SupportContactLine,
  useAuthBrand,
} from "@/features/auth/public-company-info";

const searchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
  reason: z.enum(["expired"]).optional().catch(undefined),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — AIMS" },
      { name: "description", content: "Sign in to AMSOL Management System (AIMS)." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

type FieldErrors = { email?: string; password?: string };
type FormError = { message: string; setupIncomplete?: boolean };

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { session, roles, loading, login } = useAuth();
  const { logoSrc, companyName } = useAuthBrand();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<FormError | null>(null);

  const goToApp = (r: AppRole[]) => {
    const target = safeRedirectPath(search.redirect);
    if (target) navigate({ href: target, replace: true });
    else navigate({ to: homeRouteFor(r), replace: true });
  };

  // A profile can outlive an expired session, so also require a live token.
  useEffect(() => {
    if (!loading && session && getAccessToken()) goToApp(roles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session, roles]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: FieldErrors = { email: emailError(email) };
    if (!password) errors.password = "Enter your password.";
    else if (password.length < MIN_PASSWORD_LENGTH)
      errors.password = `Passwords have at least ${MIN_PASSWORD_LENGTH} characters. Check what you typed.`;
    setFieldErrors(errors);
    setFormError(null);
    if (errors.email || errors.password) {
      document.getElementById(errors.email ? "email" : "password")?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const newRoles = await login(email.trim(), password);
      toast.success("Welcome to AIMS");
      goToApp(newRoles);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (!(err instanceof ApiError) || err.status === 429 || err.status >= 500) {
        setFormError({ message: requestErrorMessage(err) });
      } else if (/setup/i.test(message)) {
        setFormError({ message, setupIncomplete: true });
      } else if (/password/i.test(message)) {
        setFieldErrors({ password: message });
      } else if (/email|registered/i.test(message)) {
        setFieldErrors({ email: message });
      } else {
        setFormError({ message: message || "Couldn't sign you in. Try again." });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Brand side */}
      <div className="hidden md:flex flex-col justify-between p-10 bg-brand-navy-dark text-white">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-md bg-white p-1.5 flex items-center justify-center">
            {logoSrc && (
              <img
                src={logoSrc}
                alt={`${companyName} logo`}
                className="h-full w-full object-contain"
              />
            )}
          </div>
          <div>
            <div className="text-lg font-semibold leading-tight">AIMS</div>
            <div className="text-xs text-white/70">{companyName}</div>
          </div>
        </div>
        <div className="max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">
            One platform. Every department. Real-time visibility.
          </h1>
          <p className="mt-4 text-white/80 text-sm leading-relaxed">
            Documentation, project management, reporting and executive analytics for Amsol — Africa
            Management Solutions Ltd. Unifying Finance, HR, IT, Marketing &amp; Operations and
            Tender across Nairobi HQ and our regional offices.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 text-xs text-white/70">
            <div>
              <div className="text-2xl font-semibold text-accent">6</div>
              Departments unified
            </div>
            <div>
              <div className="text-2xl font-semibold text-accent">1</div>
              CEO executive dashboard
            </div>
          </div>
        </div>
        <div className="text-xs text-white/50">Confidential — Internal Use Only</div>
      </div>

      {/* Form side */}
      <div className="flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-sm">
          <AuthBrand className="md:hidden mb-6" />
          <h2 className="text-2xl font-semibold">Sign in</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Use your work email to open your {companyName} workspace.
          </p>

          {search.reason === "expired" && (
            <AuthNotice tone="info" className="mt-4">
              Your session ended. Sign in again to continue.
            </AuthNotice>
          )}

          {formError && (
            <AuthNotice tone="error" className="mt-4">
              <p>{formError.message}</p>
              {formError.setupIncomplete && (
                <Link
                  to="/forgot-password"
                  search={{ email: email.trim() || undefined }}
                  className="mt-1 inline-block font-medium underline"
                >
                  Send me a new setup link
                </Link>
              )}
            </AuthNotice>
          )}

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <FormField id="email" label="Work email" required error={fieldErrors.email}>
              <Input
                id="email"
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFieldErrors((f) => ({ ...f, email: undefined }));
                  setFormError(null);
                }}
                autoComplete="email"
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? "email-error" : undefined}
              />
            </FormField>
            <div className="space-y-1">
              <FormField id="password" label="Password" required error={fieldErrors.password}>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setFieldErrors((f) => ({ ...f, password: undefined }));
                    setFormError(null);
                  }}
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="current-password"
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={fieldErrors.password ? "password-error" : undefined}
                />
              </FormField>
              <div className="flex justify-end">
                <Link
                  to="/forgot-password"
                  search={{ email: email.trim() || undefined }}
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4 mr-2" />
              )}
              Sign in
            </Button>
          </form>

          <p className="mt-4 text-xs text-muted-foreground text-center">
            New to AIMS? Open your invite email and use its link to set your password.
          </p>
          <SupportContactLine className="mt-2 text-center" />

          <div className="mt-8 text-center">
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
              ← Back home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
