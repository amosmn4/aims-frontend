import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  Navigate,
  createRootRouteWithContext,
  useLocation,
  useRouter,
  HeadContent,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { ConfirmDialogHost } from "@/production/components/confirm-dialog";
import { AccountProvider, useAccount } from "@/lib/account";
import { RoleProvider } from "@/lib/role";
import { AppShell } from "@/components/AppShell";
import { Toaster } from "@/components/ui/sonner";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({ meta: [{ title: "Amsol Ops" }] }),
  component: RootComponent,
  notFoundComponent: () => (
    <div className="mx-auto max-w-md py-20 text-center">
      <h1 className="font-display text-3xl font-semibold">Page not found</h1>
      <p className="my-4 text-muted-foreground">Check the address or return to your dashboard.</p>
      <Link to="/" className="text-primary underline">
        Go to dashboard
      </Link>
    </div>
  ),
  errorComponent: ErrorComponent,
});

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-md p-8">
      <h1 className="text-xl font-semibold">This page could not load</h1>
      <p role="alert" className="my-4 text-muted-foreground">
        {error instanceof Error ? error.message : "An unexpected error occurred."}
      </p>
      <button
        className="action-button"
        onClick={() => {
          void router.invalidate();
          reset();
        }}
      >
        Try again
      </button>
      <a href="/" className="ml-4 text-primary underline">
        Go home
      </a>
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AccountProvider>
        <RoleProvider>
          <HeadContent />
          <ModuleCacheLifecycle />
          <AuthenticatedContent />
          <ConfirmDialogHost />
          <Toaster position="bottom-right" richColors={false} />
        </RoleProvider>
      </AccountProvider>
    </QueryClientProvider>
  );
}

function AuthenticatedContent() {
  const { account, ready, error, retry } = useAccount();
  const { pathname, href } = useLocation();
  if (pathname === "/login") return <Outlet />;
  if (!ready)
    return (
      <div role="status" className="p-8">
        Loading Amsol Ops...
      </div>
    );
  if (error && !account)
    return (
      <div className="mx-auto max-w-md p-8">
        <p role="alert" className="mb-4">
          {error}
        </p>
        <button className="action-button" onClick={retry}>
          Try again
        </button>
      </div>
    );
  if (!account) return <Navigate to="/login" search={{ redirect: href }} replace />;
  if (account.role === "system_admin" && pathname === "/")
    return <Navigate to="/system-admin" replace />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function ModuleCacheLifecycle() {
  const { account } = useAccount();
  const client = useQueryClient();
  const signature = JSON.stringify([account?.id, account?.role, account?.active, account?.modules]);
  const previous = useRef(signature);
  useEffect(() => {
    if (previous.current !== signature) {
      previous.current = signature;
      void client.cancelQueries();
      client.clear();
    }
  }, [client, signature]);
  useEffect(() => {
    const denied = () => {
      void client.cancelQueries();
      client.clear();
    };
    window.addEventListener("amsol-ops-module-denied", denied);
    return () => window.removeEventListener("amsol-ops-module-denied", denied);
  }, [client]);
  return null;
}
