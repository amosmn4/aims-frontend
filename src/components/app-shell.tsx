import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  Briefcase,
  FolderKanban,
  FolderArchive,
  BarChart3,
  Shield,
  Menu,
  ChevronDown,
  Clock,
  X,
  Workflow,
  CalendarClock,
  Laptop2,
  Droplets,
  CircleHelp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useAuth,
  homeRouteFor,
  departmentScopeFor,
  type AppRole,
  type DepartmentCode,
} from "@/lib/auth";
import {
  buildDepartmentNav,
  buildSetupNav,
  buildWaterNav,
  DEPARTMENT_CODES,
} from "@/lib/department-nav";
import { NotificationBell } from "@/components/notification-bell";
import { HeaderSearch } from "@/components/header-search";
import { ViewAsBanner, ViewAsButton } from "@/components/view-as";
import { UserMenu } from "@/components/nav/user-menu";
import { WorkspaceSwitcher } from "@/components/nav/workspace-switcher";
import { useEffectiveLayout, useMediaQuery } from "@/components/nav/use-effective-layout";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface NavChild {
  to: string;
  label: string;
  /** Shown only to people who can read this department. */
  department?: DepartmentCode;
  exact?: boolean;
  /** Draw a separator above this child. */
  divider?: boolean;
}

export interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Path prefixes that light this item up; the longest match across the menu wins. */
  match?: string[];
  matchExclude?: string[];
  /** Active only on exactly `to`. */
  exact?: boolean;
  adminOnly?: boolean;
  extraRoles?: AppRole[];
  children?: NavChild[];
}

const PIPELINE_CHILDREN: NavChild[] = [
  { to: "/pipeline/engagements", label: "Client requests" },
  { to: "/pipeline/tenders", label: "Tenders" },
  { to: "/pipeline/projects", label: "Projects board" },
];

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: true },
  {
    to: "/departments",
    label: "Departments",
    icon: Building2,
    match: ["/departments", "/operations", "/finance", "/hr", "/it", "/marketing", "/tender"],
    matchExclude: ["/it/inventory"],
    children: [
      { to: "/departments", label: "All departments", exact: true },
      { to: "/operations", label: "Operations", department: "operations" },
      { to: "/finance", label: "Finance", department: "finance" },
      { to: "/hr", label: "Human Resources", department: "hr" },
      { to: "/it", label: "Information Technology", department: "it" },
      { to: "/marketing", label: "Marketing", department: "marketing" },
      { to: "/tender", label: "Tender", department: "tender" },
    ],
  },
  {
    to: "/pipeline",
    label: "Pipelines",
    icon: Workflow,
    match: ["/pipeline", "/requests", "/engagements"],
    children: PIPELINE_CHILDREN,
  },
  {
    to: "/clients",
    label: "Clients & contracts",
    icon: Briefcase,
    children: [
      { to: "/clients", label: "Clients", exact: true },
      { to: "/clients/contracts", label: "Contracts" },
    ],
  },
  {
    to: "/projects",
    label: "Projects",
    icon: FolderKanban,
    children: [
      { to: "/projects", label: "All projects", exact: true },
      { to: "/projects/mine", label: "My tasks" },
      { to: "/projects/department", label: "Department tasks" },
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
    match: ["/reports", "/department-reports"],
    children: [
      { to: "/reports/departments/finance", label: "Finance", department: "finance" },
      { to: "/reports/departments/hr", label: "Human Resources", department: "hr" },
      { to: "/reports/departments/it", label: "Information Technology", department: "it" },
      { to: "/reports/departments/marketing", label: "Marketing", department: "marketing" },
      { to: "/reports/departments/tender", label: "Tender", department: "tender" },
      { to: "/reports/departments/operations", label: "Operations", department: "operations" },
    ],
  },
  {
    to: "/admin/users",
    label: "Admin",
    icon: Shield,
    adminOnly: true,
    match: ["/admin"],
    children: [
      { to: "/admin/users", label: "Staff" },
      { to: "/admin/permissions", label: "Permissions" },
      { to: "/admin/departments", label: "Departments" },
      { to: "/admin/audit", label: "Audit Log" },
      { to: "/admin/company", label: "Company settings" },
    ],
  },
];

const CEO_NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    to: "/pipeline",
    label: "Pipelines",
    icon: Workflow,
    match: ["/pipeline", "/requests", "/tender", "/engagements"],
    children: PIPELINE_CHILDREN,
  },
  {
    to: "/projects",
    label: "Projects & Work",
    icon: FolderKanban,
    match: ["/projects", "/water", "/it/inventory"],
    children: [
      { to: "/projects", label: "All projects", exact: true },
      { to: "/water", label: "Water Project" },
      { to: "/it/inventory", label: "Inventory" },
    ],
  },
  {
    to: "/clients",
    label: "Clients & contracts",
    icon: Briefcase,
    children: [
      { to: "/clients", label: "Clients", exact: true },
      { to: "/clients/contracts", label: "Contracts" },
    ],
  },
  {
    to: "/reports",
    label: "Reports & Analytics",
    icon: BarChart3,
    match: ["/reports", "/department-reports", "/finance/reports", "/water/reports"],
    children: [
      { to: "/reports", label: "All reports", exact: true },
      { to: "/reports/departments/finance", label: "Finance" },
      { to: "/reports/departments/hr", label: "Human Resources" },
      { to: "/reports/departments/it", label: "Information Technology" },
      { to: "/reports/departments/marketing", label: "Marketing" },
      { to: "/reports/departments/tender", label: "Tender" },
      { to: "/reports/departments/operations", label: "Operations" },
      { to: "/water/reports", label: "Water Project" },
    ],
  },
  {
    to: "/admin/users",
    label: "Admin",
    icon: Shield,
    match: ["/admin", "/settings"],
    children: [
      { to: "/admin/users", label: "Staff" },
      { to: "/admin/permissions", label: "Roles & Permissions" },
      { to: "/admin/departments", label: "Departments & Offices" },
      { to: "/admin/audit", label: "Audit Log" },
      { to: "/admin/company", label: "Company settings" },
      { to: "/settings/profile", label: "My profile" },
      { to: "/settings/notifications", label: "My notifications" },
    ],
  },
];

const pathHits = (pathname: string, p: string) => pathname === p || pathname.startsWith(p + "/");

function navScore(item: NavItem, pathname: string): number {
  if (item.matchExclude?.some((p) => pathHits(pathname, p))) return -1;
  if (item.exact) {
    return pathname === item.to || pathname === `${item.to}/` ? item.to.length + 0.5 : -1;
  }
  const hits = (item.match ?? [item.to]).filter((p) => pathHits(pathname, p));
  return hits.length ? Math.max(...hits.map((p) => p.length)) : -1;
}

/** The one menu item for this page: the most specific match wins. */
export function activeNavItem(items: NavItem[], pathname: string): NavItem | null {
  let best: NavItem | null = null;
  let bestScore = -1;
  for (const item of items) {
    const score = navScore(item, pathname);
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return best;
}

function LiveClock({ className = "hidden xl:flex" }: { className?: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className={cn(
        "items-center gap-1.5 text-xs text-sidebar-foreground/80 tabular-nums shrink-0",
        className,
      )}
      title={now.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })}
    >
      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
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

function TopNavDropdown({
  item,
  active,
  visibleChildren,
  isChildActive,
  compact,
}: {
  item: NavItem;
  active: boolean;
  visibleChildren: NavChild[];
  isChildActive: (child: NavChild) => boolean;
  compact: boolean;
}) {
  const Icon = item.icon;
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-current={active ? "true" : undefined}
          className={cn(
            "flex shrink-0 items-center gap-1.5 h-9 rounded-md text-sm transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
            compact ? "px-2 min-[1600px]:px-3" : "px-3",
            active
              ? "bg-accent text-accent-foreground font-medium"
              : "text-sidebar-foreground/90 hover:bg-white/10",
          )}
        >
          <Icon className={cn("h-4 w-4", compact && "hidden min-[2100px]:block")} />
          {item.label}
          <ChevronDown className="h-3 w-3 opacity-70" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        {visibleChildren.map((c) => (
          <Fragment key={c.to}>
            {c.divider && <DropdownMenuSeparator />}
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link
                to={c.to}
                aria-current={isChildActive(c) ? "page" : undefined}
                className={cn(isChildActive(c) && "font-semibold")}
              >
                {c.label}
              </Link>
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function HelpButton() {
  return (
    <Link
      to="/guide"
      aria-label="Help"
      title="Help"
      className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full text-sidebar-foreground hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
    >
      <CircleHelp className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

function ShellLogo({
  to,
  className,
  textClassName = "block",
}: {
  to: string;
  className?: string;
  textClassName?: string;
}) {
  return (
    <Link to={to} className={cn("flex items-center gap-2 shrink-0", className)}>
      <div className="h-8 w-8 rounded-md bg-white p-1 flex items-center justify-center">
        <img src="/amsol-logo.png" alt="" className="h-full w-full object-contain" />
      </div>
      <div className={textClassName}>
        <div className="font-semibold text-sm leading-tight">AIMS</div>
        <div className="text-xs text-sidebar-foreground/70 leading-tight">Amsol</div>
      </div>
      <span className="sr-only">Go to your home page</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Ctrl/Cmd+K is handled inside HeaderSearch.
  const searchInputRef = useRef<HTMLInputElement>(null);
  const {
    roles,
    isAdminOrCeo,
    hasRole,
    isCeo,
    isSystemAdmin,
    viewAs,
    canReadDepartment,
    workspace,
  } = useAuth();
  const { mode, setMode } = useEffectiveLayout(!isCeo);
  const isLarge = useMediaQuery("(min-width: 1024px)");
  const location = useLocation();
  const home = homeRouteFor(roles, workspace);

  const visibleChildren = (item: NavItem) =>
    (item.children ?? []).filter((c) => !c.department || canReadDepartment(c.department));

  // The workspace someone picked wins; otherwise their only department.
  const departmentScope =
    workspace && workspace !== "water" ? workspace : departmentScopeFor(roles);
  const hasAnyDepartment = isAdminOrCeo || DEPARTMENT_CODES.some((c) => canReadDepartment(c));
  const visibleNav = isCeo
    ? CEO_NAV
    : departmentScope
      ? buildDepartmentNav(departmentScope, hasRole("water"), hasRole("department_head"))
      : workspace === "water" || home === "/water"
        ? buildWaterNav()
        : !hasAnyDepartment
          ? buildSetupNav()
          : NAV.filter(
              (i) => !i.adminOnly || isAdminOrCeo || (i.extraRoles ? hasRole(i.extraRoles) : false),
            );

  const activeItem = activeNavItem(visibleNav, location.pathname);
  const isActive = (item: NavItem) => item === activeItem;
  const isChildActive = (child: NavChild) =>
    location.pathname === child.to ||
    (!child.exact && location.pathname.startsWith(child.to + "/"));
  const isExpanded = (item: NavItem) => expanded[item.to] ?? isActive(item);

  // Seven items fit a 1280px laptop; longer menus need 1536px.
  const compactNav = visibleNav.length <= 7;
  const tightHeader = compactNav && mode === "top";

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const UserBlock = (
    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
      <WorkspaceSwitcher className="shrink-0" />
      <HeaderSearch
        inputRef={searchInputRef}
        className={tightHeader ? "xl:w-36 2xl:w-56" : undefined}
      />
      <LiveClock className={tightHeader ? "hidden min-[1700px]:flex" : undefined} />
      <NotificationBell />
      <HelpButton />
      {isSystemAdmin && !viewAs && <ViewAsButton />}
      <UserMenu
        layoutMode={mode}
        onLayoutChange={setMode}
        showLayoutSwitch={isLarge}
        nameClassName={tightHeader ? "hidden min-[1600px]:inline" : "hidden lg:inline"}
      />
    </div>
  );

  /* ---------------- SIDEBAR MODE ---------------- */
  if (mode === "sidebar") {
    return (
      <div className="min-h-screen flex bg-secondary/40">
        <aside className="hidden lg:flex flex-col w-60 bg-sidebar text-sidebar-foreground border-r border-sidebar-border sticky top-0 h-screen">
          <ShellLogo to={home} className="h-14 px-4 border-b border-sidebar-border" />
          <nav aria-label="Main menu" className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {visibleNav.map((item) => {
              const Icon = item.icon;
              const active = isActive(item);
              const kids = visibleChildren(item);
              const rowClass = cn(
                "flex w-full items-center gap-2 px-3 py-2 rounded-md text-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
                active
                  ? "bg-accent text-accent-foreground font-medium"
                  : "hover:bg-white/10 text-sidebar-foreground/90",
              );
              if (kids.length === 0) {
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    aria-current={active ? "page" : undefined}
                    className={rowClass}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              }
              const open = isExpanded(item);
              const groupId = `nav-group-${item.to.replace(/\W+/g, "-")}`;
              return (
                <div key={item.to}>
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={groupId}
                    onClick={() => setExpanded((s) => ({ ...s, [item.to]: !open }))}
                    className={rowClass}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1">{item.label}</span>
                    <ChevronDown
                      className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
                      aria-hidden="true"
                    />
                  </button>
                  {open && (
                    <div id={groupId} className="ml-6 mt-1 mb-1 space-y-0.5">
                      {kids.map((c) => (
                        <Fragment key={c.to}>
                          {c.divider && (
                            <div className="my-1 mx-3 h-px bg-white/15" aria-hidden="true" />
                          )}
                          <Link
                            to={c.to}
                            aria-current={isChildActive(c) ? "page" : undefined}
                            className={cn(
                              "block px-3 py-1.5 rounded text-sm text-sidebar-foreground/85 hover:bg-white/10",
                              isChildActive(c) &&
                                "bg-white/15 font-semibold text-sidebar-foreground",
                            )}
                          >
                            {c.label}
                          </Link>
                        </Fragment>
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
            <ViewAsBanner />
            <div className="flex items-center gap-2 h-14 px-4 md:px-6">
              <button
                type="button"
                className="lg:hidden p-2 -ml-2 rounded hover:bg-white/10"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <ShellLogo to={home} className="lg:hidden" />
              <div className="ml-auto">{UserBlock}</div>
            </div>
          </header>
          {mobileOpen && (
            <MobileDrawer
              onClose={() => setMobileOpen(false)}
              items={visibleNav}
              isActive={isActive}
              isChildActive={isChildActive}
              visibleChildren={visibleChildren}
              hiddenFrom="lg:hidden"
            />
          )}
          <main className="flex-1 p-4 md:p-6 w-full">{children}</main>
        </div>
      </div>
    );
  }

  /* ---------------- TOP NAV MODE ---------------- */
  return (
    <div className="min-h-screen flex flex-col bg-secondary/40">
      <header className="sticky top-0 z-30 bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
        <ViewAsBanner />
        <div className="flex items-center gap-2 h-14 px-4 md:px-6">
          <button
            type="button"
            className={cn(
              "p-2 -ml-2 rounded hover:bg-white/10 shrink-0",
              compactNav ? "xl:hidden" : "2xl:hidden",
            )}
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <ShellLogo to={home} className="mr-4" textClassName="hidden sm:block" />

          {/* overflow-x-auto only guards in-between widths; dropdowns portal out of it. */}
          <nav
            aria-label="Main menu"
            className={cn(
              "hidden items-center gap-0.5 ml-2 flex-1 min-w-0 overflow-x-auto",
              compactNav ? "xl:flex" : "2xl:flex",
            )}
          >
            {visibleNav.map((item) => {
              const active = isActive(item);
              const Icon = item.icon;
              const kids = visibleChildren(item);
              if (kids.length > 0) {
                return (
                  <TopNavDropdown
                    key={item.to}
                    item={item}
                    active={active}
                    visibleChildren={kids}
                    isChildActive={isChildActive}
                    compact={compactNav}
                  />
                );
              }
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 h-9 rounded-md text-sm whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
                    compactNav ? "px-2 min-[1600px]:px-3" : "px-3",
                    active
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-sidebar-foreground/90 hover:bg-white/10",
                  )}
                >
                  <Icon className={cn("h-4 w-4", compactNav && "hidden min-[2100px]:block")} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto">{UserBlock}</div>
        </div>
      </header>

      {mobileOpen && (
        <MobileDrawer
          onClose={() => setMobileOpen(false)}
          items={visibleNav}
          isActive={isActive}
          isChildActive={isChildActive}
          visibleChildren={visibleChildren}
          hiddenFrom={compactNav ? "xl:hidden" : "2xl:hidden"}
        />
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
  isChildActive,
  visibleChildren,
  hiddenFrom,
}: {
  onClose: () => void;
  items: NavItem[];
  isActive: (i: NavItem) => boolean;
  isChildActive: (c: NavChild) => boolean;
  visibleChildren: (i: NavItem) => NavChild[];
  hiddenFrom: string;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={cn("fixed inset-0 z-40", hiddenFrom)}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-sidebar text-sidebar-foreground p-4 overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold">Menu</div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            title="Close menu"
            className="p-1 -mr-1 rounded hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav aria-label="Main menu" className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const kids = visibleChildren(item);
            return (
              <div key={item.to}>
                {kids.length === 0 ? (
                  <Link
                    to={item.to}
                    onClick={onClose}
                    aria-current={isActive(item) ? "page" : undefined}
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
                ) : (
                  <div
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium",
                      isActive(item) && "bg-white/10",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </div>
                )}
                {kids.length > 0 && (
                  <div className="ml-6 mt-1 space-y-0.5">
                    {kids.map((c) => (
                      <Link
                        key={c.to}
                        to={c.to}
                        onClick={onClose}
                        aria-current={isChildActive(c) ? "page" : undefined}
                        className={cn(
                          "block px-3 py-1.5 rounded text-sm text-sidebar-foreground/85 hover:bg-white/10",
                          isChildActive(c) && "bg-white/15 font-semibold text-sidebar-foreground",
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
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
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
