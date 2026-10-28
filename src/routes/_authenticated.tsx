import { createFileRoute, Outlet, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { ensureSession } from "@/lib/api-client";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  // Client-side session check on load (SSR-safe: skip on server).
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;
    const authenticated = await ensureSession();
    if (!authenticated) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();

  // Also runs after signing out, so no return path is kept.
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  // Background refresh failed mid-use: send them to sign in, then back here.
  useEffect(() => {
    const onExpired = () =>
      navigate({
        to: "/auth",
        search: { reason: "expired", redirect: router.state.location.href },
        replace: true,
      });
    window.addEventListener("aims:session-expired", onExpired);
    return () => window.removeEventListener("aims:session-expired", onExpired);
  }, [navigate, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return null;

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
