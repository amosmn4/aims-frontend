import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { Briefcase, Users, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({
    meta: [{ title: "Clients & Contracts — AIMS" }, { name: "robots", content: "noindex" }],
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
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" /> Clients & Contracts
          </h1>
          <p className="text-xs text-muted-foreground">
            Central directory of clients, contacts and contracts. Manage from here or from any
            department view.
          </p>
        </div>
        <div className="flex gap-2">
          <Tab to="/clients" label="Clients" icon={Users} active={onClients && !onContracts} />
          <Tab to="/clients/contracts" label="Contracts" icon={FileText} active={onContracts} />
        </div>
      </div>
      <Outlet />
    </div>
  );
}
