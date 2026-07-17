import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ensureSession } from "@/lib/api-client";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  // Client-side session check on load (SSR-safe: skip on server).
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const authenticated = await ensureSession();
    if (!authenticated) {
      throw redirect({ to: "/auth" });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

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
