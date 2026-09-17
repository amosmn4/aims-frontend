import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { Briefcase, Users, FileText, FolderArchive } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({
    meta: [{ title: "Clients & contracts — AIMS" }, { name: "robots", content: "noindex" }],
  }),
  component: ClientsLayout,
});

function Tab({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: typeof Users;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card hover:bg-secondary border-border text-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </Link>
  );
}

function ClientsLayout() {
  const { pathname } = useLocation();
  const onClients = pathname === "/clients" || pathname.startsWith("/clients/list");
  const onContracts = pathname.startsWith("/clients/contracts");
  // A contract record has its own title and breadcrumb.
  const onRecord = /^\/clients\/contracts\/[^/]+\/?$/.test(pathname);
  const { isAdminOrCeo } = useAuth();

  if (onRecord) return <Outlet />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" aria-hidden="true" /> Clients & contracts
          </h1>
          <p className="text-xs text-muted-foreground">
            Every client, their contacts and their contracts, across all departments.
          </p>
        </div>
        <nav aria-label="Clients and contracts pages" className="flex gap-2">
          <Tab to="/clients" label="Clients" icon={Users} active={onClients && !onContracts} />
          <Tab to="/clients/contracts" label="Contracts" icon={FileText} active={onContracts} />
          {isAdminOrCeo && (
            <Tab to="/documents" label="Documents" icon={FolderArchive} active={false} />
          )}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
