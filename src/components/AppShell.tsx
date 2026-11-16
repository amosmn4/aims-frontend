import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import AssignmentOutlined from "@mui/icons-material/AssignmentOutlined";
import WaterDropOutlined from "@mui/icons-material/WaterDropOutlined";
import { Link, useLocation } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  FileText,
  Building2,
  Briefcase,
  FolderLock,
  Users,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Gavel,
  Inbox,
  Store,
  Logout,
} from "./icons";
import { canViewDepartments, useRole } from "@/lib/role";
import { canSeeBusinesses, canSeeRequests, canSeeTenders } from "@/lib/business";
import { useBusinessAccess } from "@/lib/access";
import { useWorkspace } from "@/lib/workspace";
import { useAccount } from "@/lib/account";
import { Avatar, Card } from "./kit";
import { cn } from "@/lib/utils";
import { moduleAccess } from "@/lib/modules";
import { Button } from "./ui/button";
import { isDemo } from "@/lib/api";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/reports", label: "General Reports", icon: FileText },
  { to: "/weekly-reports", label: "Weekly reporting", icon: AssignmentOutlined },
  { to: "/tenders", label: "Tenders", icon: Gavel },
  { to: "/client-requests", label: "Client requests", icon: Inbox },
  { to: "/departments", label: "Departments", icon: Building2 },
  { to: "/clients", label: "Clients", icon: Briefcase },
  { to: "/businesses", label: "Businesses", icon: Store },
  { to: "/documents", label: "Documents", icon: FolderLock },
  { to: "/people", label: "Staff", icon: Users },
  { to: "/water", label: "Water Project", icon: WaterDropOutlined },
  { to: "/marketing/blog", label: "Blog", icon: FileText },
  { to: "/payment-ledger", label: "Payment Ledger", icon: ReceiptLongOutlined },
] as const;
const systemAdminNav = [
  { to: "/system-admin", label: "System administration", icon: Settings },
  { to: "/settings", label: "My account", icon: Users },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { mode, setMode, me } = useRole();
  const { account, signOut, error: accountError, retry } = useAccount();
  const { pathname } = useLocation();
  const { businesses, tenders, clientRequests, people, deptName, settings, storageError } =
    useWorkspace();
  const access = useBusinessAccess();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const visible = (account?.role === "system_admin" ? systemAdminNav : nav).filter(
    (item) =>
      (item.to !== "/payment-ledger" || !!moduleAccess(account, "ledger")) &&
      (item.to !== "/water" || !!moduleAccess(account, "water")) &&
      (item.to !== "/marketing/blog" || !!moduleAccess(account, "blog")) &&
      (item.to !== "/departments" || canViewDepartments(mode)) &&
      (item.to !== "/people" || mode === "ceo") &&
      (item.to !== "/tenders" || !isDemo || canSeeTenders(mode, me.id, tenders)) &&
      (item.to !== "/client-requests" ||
        canSeeRequests(mode, me.id, me.dept, clientRequests, people)) &&
      (item.to !== "/businesses" || canSeeBusinesses(mode, me.id, me.dept, businesses, access)),
  );
  const restricted =
    (account?.role === "system_admin" &&
      pathname !== "/system-admin" &&
      pathname !== "/settings") ||
    (pathname.startsWith("/payment-ledger") && !moduleAccess(account, "ledger")) ||
    ((pathname === "/water" || pathname.startsWith("/water/")) &&
      !moduleAccess(account, "water")) ||
    (pathname.startsWith("/marketing/blog") && !moduleAccess(account, "blog")) ||
    (pathname.startsWith("/departments") && !canViewDepartments(mode)) ||
    (pathname === "/admin" && mode !== "ceo");
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {mobileOpen && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={cn(
          "top-0 z-40 h-screen shrink-0 flex-col overflow-y-auto bg-sidebar text-sidebar-foreground md:sticky md:flex",
          mobileOpen ? "fixed left-0 flex w-60" : "hidden",
          collapsed ? "md:w-16" : "md:w-56",
        )}
      >
        <div className={cn("pb-6 pt-6", collapsed ? "px-2" : "px-5")}>
          {!collapsed ? (
            <>
              <Link
                to="/"
                onClick={() => setMobileOpen(false)}
                aria-label="Amsol Ops home"
                className="inline-flex items-center rounded-md bg-white px-3 py-1.5"
              >
                <img src="/favicon.png" alt="Amsol" className="h-8 w-auto object-contain" />
              </Link>
              <div className="mt-3 text-xs text-sidebar-foreground/70">{settings.company}</div>
            </>
          ) : (
            <Link
              to="/"
              aria-label="Dashboard"
              className="block text-center font-display text-2xl font-bold"
            >
              A.
            </Link>
          )}
        </div>
        <nav aria-label="Main navigation" className="flex-1 space-y-0.5 px-3">
          {visible.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              onClick={() => setMobileOpen(false)}
              activeOptions={{ exact: item.to === "/" }}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              activeProps={{ className: "bg-sidebar-accent !text-sidebar-foreground font-medium" }}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && item.label}
            </Link>
          ))}
          {account?.role !== "system_admin" && mode === "ceo" && (
            <Link
              to="/admin"
              onClick={() => setMobileOpen(false)}
              className="nav-link"
              activeProps={{ className: "bg-sidebar-accent !text-sidebar-foreground font-medium" }}
              title="Settings"
            >
              <Settings className="h-4 w-4" />
              {!collapsed && "Settings"}
            </Link>
          )}
          {account?.role !== "system_admin" && (
            <Link
              to="/settings"
              onClick={() => setMobileOpen(false)}
              className="nav-link"
              activeProps={{ className: "bg-sidebar-accent !text-sidebar-foreground font-medium" }}
              title="My account"
            >
              <Settings className="h-4 w-4" />
              {!collapsed && "My account"}
            </Link>
          )}
        </nav>
        <div className="m-3 space-y-3 border-t border-sidebar-border pt-4">
          {!collapsed && (
            <>
              <div className="flex items-center gap-2">
                <Avatar name={me.name} size="sm" />
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium">{me.name}</div>
                  <div className="truncate text-[10px] text-sidebar-foreground/70">
                    {me.dept ? deptName(me.dept) : "Executive"}
                  </div>
                </div>
              </div>
              {mode !== "ceo" && account?.role !== "system_admin" && (
                <select
                  aria-label="Workspace view"
                  value={mode}
                  onChange={(event) => setMode(event.target.value as "staff" | "department")}
                  className="w-full rounded border border-sidebar-border bg-sidebar p-2 text-xs"
                >
                  <option value="staff">My workspace</option>
                  <option value="department">My department workspace</option>
                </select>
              )}
            </>
          )}
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            onClick={signOut}
            aria-label="Sign out"
          >
            <Logout className="h-4 w-4" />
            {!collapsed && "Sign out"}
          </Button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-5 py-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <PanelLeftOpen />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:inline-flex"
              aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
          </div>
        </header>
        <main className="min-w-0 px-5 py-7 lg:px-8">
          {accountError && (
            <div role="alert" className="mb-5 rounded-lg border p-4 text-sm">
              <p>{accountError}</p>
              <Button variant="outline" className="mt-3" onClick={retry}>
                Reload workspace
              </Button>
            </div>
          )}
          {storageError && (
            <p role="alert" className="mb-5 rounded-lg border p-4 text-sm text-destructive">
              {storageError}
            </p>
          )}
          {restricted ? (
            <Card>
              <h1 className="font-display text-xl font-semibold">Access restricted</h1>
              <p className="my-3 text-muted-foreground">
                {pathname.startsWith("/water") ||
                pathname.startsWith("/marketing/blog") ||
                pathname.startsWith("/payment-ledger")
                  ? "Ask the CEO to assign this module to your account in Settings."
                  : "This page is available to the CEO account."}
              </p>
              <Link to="/" className="text-primary underline">
                Return to dashboard
              </Link>
            </Card>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
