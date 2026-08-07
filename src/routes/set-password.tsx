import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useAuth, homeRouteFor } from "@/lib/auth";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const roles = await submitSetPassword(token, password);
      toast.success("Password set — welcome to AIMS.");
      navigate({ to: homeRouteFor(roles) });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "This link is invalid or has expired.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-sm text-center">
          <h2 className="text-2xl font-semibold">Missing setup link</h2>
          <p className="text-sm text-muted-foreground mt-2">
            This page needs a setup link from your invite email. Please use the link from that
            email, or contact your administrator for a new one.
          </p>
          <Link to="/auth" className="text-sm text-primary mt-4 inline-block">
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="h-9 w-9 rounded-md bg-white p-1 flex items-center justify-center border">
            <img src="/amsol-logo.png" alt="Amsol" className="h-full w-full object-contain" />
          </div>
          <div className="font-semibold">AIMS</div>
        </div>
        <h2 className="text-2xl font-semibold">Set your password</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose a password to finish setting up your account.
        </p>

        {error ? (
          <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
            <p className="text-sm text-destructive">{error}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Contact your administrator to request a new setup link.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="password">New password</Label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div>
              <Label htmlFor="confirm">Confirm password</Label>
              <PasswordInput
                id="confirm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Set password &amp; sign in
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
