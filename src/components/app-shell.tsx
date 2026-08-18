import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  Briefcase,
  FolderKanban,
  FolderArchive,
  BarChart3,
  Shield,
  LogOut,
  Menu,
  Crown,
  ChevronDown,
  Clock,
  X,
  PanelLeft,
  PanelTop,
  Workflow,
  Compass,
  CalendarClock,
  Laptop2,
  Droplets,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, homeRouteFor, departmentScopeFor, ROLE_LABELS, type AppRole } from "@/lib/auth";
import { buildDepartmentNav } from "@/lib/department-nav";
import { useLayoutPreference } from "@/lib/layout-preference";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notification-bell";
import { HeaderSearch } from "@/components/header-search";

export interface NavChild {
  to: string;
  label: string;
  role?: AppRole;
}

export interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  match?: string[];
  // Paths that should NOT count toward this item being "active" even though they'd otherwise
  // match a `match` prefix — e.g. Inventory lives at /it/inventory for historical reasons, but
  // it's its own top-level nav item, not part of the Departments/IT hub, so Departments shouldn't
  // light up while you're on it.
  matchExclude?: string[];
  adminOnly?: boolean;
  extraRoles?: AppRole[];
  children?: NavChild[];
}

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: true },
  { to: "/guide", label: "How It Works", icon: Compass, match: ["/guide"] },
  {
    to: "/departments",
    label: "Departments",
    icon: Building2,
    match: ["/departments", "/operations", "/finance", "/hr", "/it", "/marketing", "/tender"],
    matchExclude: ["/it/inventory"],
    children: [
      { to: "/departments", label: "All Departments" },
      { to: "/operations", label: "Operations", role: "operations" },
      { to: "/finance", label: "Finance", role: "finance" },
      { to: "/hr", label: "Human Resources", role: "hr" },
      { to: "/it", label: "Information Technology", role: "it" },
      { to: "/marketing", label: "Marketing", role: "marketing" },
      { to: "/tender", label: "Tender", role: "tender" },
    ],
  },
  {
    to: "/pipeline",
    label: "Pipeline",
    icon: Workflow,
    match: ["/pipeline"],
  },
  {
    to: "/clients",
    label: "Clients & Contracts",
    icon: Briefcase,
    children: [
      { to: "/clients", label: "Clients" },
      { to: "/clients/contracts", label: "Contracts" },
    ],
  },
  {
    to: "/projects",
    label: "Projects & Tasks",
    icon: FolderKanban,
    children: [
      { to: "/projects", label: "All Projects" },
      { to: "/projects/mine", label: "My Tasks" },
      { to: "/projects/department", label: "Department Board" },
    ],
  },
  { to: "/documents", label: "Documents", icon: FolderArchive },
  { to: "/calendar", label: "Calendar", icon: CalendarClock },
  { to: "/it/inventory", label: "Inventory", icon: Laptop2, adminOnly: true },
  {
    to: "/water",
    label: "Water Project",
    icon: Droplets,
    adminOnly: true,
    extraRoles: ["water"],
    match: ["/water"],
  },
  {
    to: "/reports",
    label: "Reports",
    icon: BarChart3,
    match: ["/reports"],
    children: [
      {
        to: "/reports/departments/finance",
        label: "Finance — Financial Management",
        role: "finance",
      },
      { to: "/reports/departments/hr", label: "Human Resources", role: "hr" },
      { to: "/reports/departments/it", label: "Information Technology", role: "it" },
      {
        to: "/reports/departments/marketing",
        label: "Marketing",
        role: "marketing",
      },
      { to: "/reports/departments/tender", label: "Tender", role: "tender" },
      { to: "/reports/projects", label: "Projects — All submissions" },
    ],
  },
  {
    to: "/admin/users",
    label: "Admin",
    icon: Shield,
    adminOnly: true,
    match: ["/admin"],
    children: [
      { to: "/admin/users", label: "Users" },
      { to: "/admin/departments", label: "Departments" },
      { to: "/admin/audit", label: "Audit Log" },
    ],
  },
];

function LiveClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="hidden xl:flex items-center gap-1.5 text-xs text-sidebar-foreground/80 tabular-nums shrink-0"
      title={now.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })}
    >
      <Clock className="h-3.5 w-3.5" />
      <span>
        {now.toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}
      </span>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { profile, roles, signOut, isAdminOrCeo, hasRole } = useAuth();
  const { mode, setMode } = useLayoutPreference();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const visibleChildren = (item: NavItem) =>
    (item.children ?? []).filter((c) => !c.role || isAdminOrCeo || hasRole(c.role));

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  const primaryRoleLabel = roles[0] ? ROLE_LABELS[roles[0]] : "Staff";
  const isActive = (item: NavItem) => {
    const matchesPath = (p: string) =>
      location.pathname === p || location.pathname.startsWith(p + "/");
    if (item.matchExclude?.some(matchesPath)) return false;
    const paths = item.match ?? [item.to];
    return paths.some(matchesPath);
  };
  const isChildActive = (child: NavChild) =>
    location.pathname === child.to || location.pathname.startsWith(child.to + "/");

  // A user scoped to exactly one department (not admin/CEO) gets that department's own nav —
  // Dashboard/domain-dropdown/Reports/Projects & Tasks/Calendar/Clients & Contracts/Documents,
  // every item already scoped to just that department — instead of the global/central nav.
  // Admin/CEO and anyone spanning multiple departments (or none) keep the nav below unchanged.
  const departmentScope = departmentScopeFor(roles);
  const visibleNav = departmentScope
    ? buildDepartmentNav(departmentScope, hasRole("water"))
    : NAV.filter(
        (i) => !i.adminOnly || isAdminOrCeo || (i.extraRoles ? hasRole(i.extraRoles) : false),
      );

  const LayoutToggle = (
    <button
      onClick={() => setMode(mode === "top" ? "sidebar" : "top")}
      className="hidden lg:flex shrink-0 items-center gap-1.5 px-2 py-1 rounded text-[0.6875rem] bg-white/10 hover:bg-white/20 text-sidebar-foreground"
      title={`Switch to ${mode === "top" ? "sidebar" : "top"} layout`}
    >
      {mode === "top" ? (
        <PanelLeft className="h-3.5 w-3.5" />
      ) : (
        <PanelTop className="h-3.5 w-3.5" />
      )}
      <span>{mode === "top" ? "Sidebar" : "Top nav"}</span>
    </button>
  );

  // Search/clock/layout-toggle/full-name only show once there's room for them — same breakpoint
  // the sidebar/top-nav switch and inline nav use, so this block never has to compete with the
  // nav links for space. Notifications and sign-out stay compact but always visible at every
  // width (shrink-0 so they're never the thing that gets squeezed off-screen).
  const UserBlock = (
    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
      <HeaderSearch inputRef={searchInputRef} />
      <LiveClock />
      <div className="shrink-0">
        <NotificationBell />
      </div>
      {LayoutToggle}
      <div className="hidden lg:flex items-center gap-2 text-xs text-sidebar-foreground/80 shrink-0 max-w-40 xl:max-w-56">
        <div className="h-7 w-7 shrink-0 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-semibold">
          {(profile?.fullName || profile?.email || "?").charAt(0).toUpperCase()}
        </div>
        <div className="leading-tight min-w-0">
          <div className="font-medium text-sidebar-foreground truncate">
            {profile?.fullName || profile?.email}
          </div>
          <div className="flex items-center gap-1 truncate">
            {roles.includes("ceo") && <Crown className="h-3 w-3 shrink-0 text-accent" />}
            <span className="truncate">{primaryRoleLabel}</span>
          </div>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 text-sidebar-foreground hover:bg-white/10"
        onClick={handleSignOut}
      >
        <LogOut className="h-4 w-4 md:mr-2" />
        <span className="hidden md:inline">Sign out</span>
      </Button>
    </div>
  );

  /* ---------------- SIDEBAR MODE ---------------- */
  if (mode === "sidebar") {
    return (
      <div className="min-h-screen flex bg-secondary/40">
        <aside className="hidden lg:flex flex-col w-60 bg-sidebar text-sidebar-foreground border-r border-sidebar-border sticky top-0 h-screen">
          <Link
            to={homeRouteFor(roles)}
            className="flex items-center gap-2 h-14 px-4 border-b border-sidebar-border"
          >
            <div className="h-8 w-8 rounded-md bg-white p-1 flex items-center justify-center">
              <img src="/amsol-logo.png" alt="Amsol" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="font-semibold text-sm leading-tight">AIMS</div>
              <div className="text-[0.625rem] text-sidebar-foreground/70 leading-tight">Amsol</div>
            </div>
          </Link>
          <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {visibleNav.map((item) => {
              const Icon = item.icon;
              const active = isActive(item);
              return (
                <div key={item.to}>
                  <Link
                    to={item.to}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm",
                      active
                        ? "bg-accent text-accent-foreground font-medium"
                        : "hover:bg-white/10 text-sidebar-foreground/90",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                  {active && visibleChildren(item).length > 0 && (
                    <div className="ml-6 mt-1 space-y-0.5">
                      {visibleChildren(item).map((c) => (
                        <Link
                          key={c.to}
                          to={c.to}
                          className={cn(
                            "block px-3 py-1.5 rounded text-xs text-sidebar-foreground/80 hover:bg-white/10",
                            isChildActive(c) && "bg-white/10 font-medium text-sidebar-foreground",
                          )}
                        >
                          {c.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
            <div className="flex items-center gap-2 h-14 px-4 md:px-6">
              <button
                className="lg:hidden p-2 -ml-2 rounded hover:bg-white/10"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <Link to={homeRouteFor(roles)} className="lg:hidden flex items-center gap-2">
                <div className="h-8 w-8 rounded-md bg-white p-1 flex items-center justify-center">
                  <img src="/amsol-logo.png" alt="Amsol" className="h-full w-full object-contain" />
                </div>
                <div className="font-semibold text-sm">AIMS</div>
              </Link>
              <div className="ml-auto">{UserBlock}</div>
            </div>
          </header>
          {mobileOpen && (
            <MobileDrawer
              onClose={() => setMobileOpen(false)}
              items={visibleNav}
              isActive={isActive}
            />
          )}
          <main className="flex-1 p-4 md:p-6 w-full">{children}</main>
        </div>
      </div>
    );
  }

  /* ---------------- TOP NAV MODE (default) ---------------- */
  return (
    <div className="min-h-screen flex flex-col bg-secondary/40">
      <header className="sticky top-0 z-30 bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
        <div className="flex items-center gap-2 h-14 px-4 md:px-6">
          <button
            className="2xl:hidden p-2 -ml-2 rounded hover:bg-white/10 shrink-0"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link to={homeRouteFor(roles)} className="flex items-center gap-2 mr-4 shrink-0">
            <div className="h-8 w-8 rounded-md bg-white p-1 flex items-center justify-center">
              <img src="/amsol-logo.png" alt="Amsol" className="h-full w-full object-contain" />
            </div>
            <div className="hidden sm:block">
              <div className="font-semibold text-sm leading-tight">AIMS</div>
              <div className="text-[0.625rem] text-sidebar-foreground/70 leading-tight">Amsol</div>
            </div>
          </Link>

          {/* Only shown once there's genuinely room for every top-level item (2xl+) — below that,
              the hamburger + MobileDrawer below covers the exact same links. The overflow-x-auto
              here is just a safety net for in-between widths (e.g. a maximized-but-not-huge
              browser window at exactly 2xl): nav scrolls within its own strip instead of ever
              pushing notifications/sign-out off the right edge of the screen. */}
          <nav className="hidden 2xl:flex items-center gap-0.5 ml-2 flex-1 min-w-0 overflow-x-auto">
            {visibleNav.map((item) => {
              const active = isActive(item);
              const Icon = item.icon;
              if (item.children) {
                const open = openMenu === item.to;
                return (
                  <div
                    key={item.to}
                    className="relative shrink-0"
                    onMouseEnter={() => setOpenMenu(item.to)}
                    onMouseLeave={() => setOpenMenu(null)}
                  >
                    <button
                      className={cn(
                        "flex items-center gap-1.5 px-3 h-9 rounded-md text-sm transition-colors whitespace-nowrap",
                        active
                          ? "bg-accent text-accent-foreground font-medium"
                          : "text-sidebar-foreground/90 hover:bg-white/10",
                      )}
                      onClick={() => setOpenMenu(open ? null : item.to)}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    </button>
                    {open && (
                      <div className="absolute left-0 top-full mt-1 min-w-65 rounded-md border bg-popover text-popover-foreground shadow-lg py-1 z-40">
                        {visibleChildren(item).map((c) => (
                          <Link
                            key={c.to}
                            to={c.to}
                            onClick={() => setOpenMenu(null)}
                            className={cn(
                              "block px-3 py-2 text-sm hover:bg-secondary",
                              isChildActive(c) && "bg-secondary font-medium text-primary",
                            )}
                          >
                            {c.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 px-3 h-9 rounded-md text-sm whitespace-nowrap transition-colors",
                    active
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-sidebar-foreground/90 hover:bg-white/10",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto">{UserBlock}</div>
        </div>
      </header>

      {mobileOpen && (
        <MobileDrawer onClose={() => setMobileOpen(false)} items={visibleNav} isActive={isActive} />
      )}

      <main className="flex-1 p-4 md:p-6 max-w-[1600px] 2xl:max-w-[1800px] 3xl:max-w-[2400px] w-full mx-auto">
        {children}
      </main>
    </div>
  );
}

function MobileDrawer({
  onClose,
  items,
  isActive,
}: {
  onClose: () => void;
  items: NavItem[];
  isActive: (i: NavItem) => boolean;
}) {
  const { isAdminOrCeo, hasRole } = useAuth();
  const location = useLocation();
  const visibleChildren = (item: NavItem) =>
    (item.children ?? []).filter((c) => !c.role || isAdminOrCeo || hasRole(c.role));
  const isChildActive = (child: NavChild) =>
    location.pathname === child.to || location.pathname.startsWith(child.to + "/");

  return (
    <div className="fixed inset-0 z-40 2xl:hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-sidebar text-sidebar-foreground p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold">Menu</div>
          <button onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.to}>
                <Link
                  to={item.to}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm",
                    isActive(item)
                      ? "bg-accent text-accent-foreground font-medium"
                      : "hover:bg-white/10",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
                {visibleChildren(item).length > 0 && (
                  <div className="ml-6 mt-1 space-y-0.5">
                    {visibleChildren(item).map((c) => (
                      <Link
                        key={c.to}
                        to={c.to}
                        onClick={onClose}
                        className={cn(
                          "block px-3 py-1.5 rounded text-xs text-sidebar-foreground/80 hover:bg-white/10",
                          isChildActive(c) && "bg-white/10 font-medium text-sidebar-foreground",
                        )}
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        {description && <p className="text-xs text-muted-foreground max-w-3xl">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function ModulePlaceholder({
  title,
  description,
  bullets,
}: {
  title: string;
  description: string;
  bullets: string[];
}) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground mb-3">Planned capabilities</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {bullets.map((b) => (
            <li key={b} className="flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 rounded-md bg-secondary p-4 text-sm text-muted-foreground">
          This module is scaffolded and will be built out in a later development phase.
        </div>
      </div>
    </div>
  );
}
