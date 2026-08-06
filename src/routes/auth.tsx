import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, homeRouteFor } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — AIMS" },
      { name: "description", content: "Sign in to Amsol Integrated Management System (AIMS)." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, roles, loading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: homeRouteFor(roles) });
  }, [loading, session, roles, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const newRoles = await login(email, password);
      toast.success("Welcome back.");
      navigate({ to: homeRouteFor(newRoles) });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Brand side */}
      <div className="hidden md:flex flex-col justify-between p-10 bg-brand-navy-dark text-white">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-white p-1.5 flex items-center justify-center">
              <img src="/amsol-logo.png" alt="Amsol" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="text-lg font-semibold leading-tight">AIMS</div>
              <div className="text-xs text-white/70">Amsol Integrated Management System</div>
            </div>
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
          <div className="md:hidden mb-6 flex items-center gap-2">
            <div className="h-9 w-9 rounded-md bg-white p-1 flex items-center justify-center border">
              <img src="/amsol-logo.png" alt="Amsol" className="h-full w-full object-contain" />
            </div>
            <div className="font-semibold">AIMS</div>
          </div>
          <h2 className="text-2xl font-semibold">Sign in</h2>
          <p className="text-sm text-muted-foreground mt-1">Access your Amsol workspace.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sign in
            </Button>
          </form>

          <p className="mt-4 text-xs text-muted-foreground text-center">
            Accounts are created by your System Administrator — check your email for an invite link.
            Trouble signing in? Ask your admin for a password reset.
          </p>

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
