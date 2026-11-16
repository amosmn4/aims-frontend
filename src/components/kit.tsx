import type { ReactNode } from "react";
import { Lock, Users, Building2, Globe } from "@/components/icons";
import type { Access, Status } from "@/lib/data";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card p-5 shadow-soft", className)}>{children}</div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </h2>
  );
}

const statusMap: Record<Status, { label: string; cls: string }> = {
  "on-track": { label: "On track", cls: "text-success" },
  "at-risk": { label: "At risk", cls: "text-warning-foreground" },
  delayed: { label: "Delayed", cls: "text-destructive" },
  completed: { label: "Completed", cls: "text-muted-foreground" },
};
export function StatusBadge({ status }: { status: Status }) {
  const s = statusMap[status];
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium",
        s.cls,
      )}
    >
      {s.label}
    </span>
  );
}

export function Pill({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "primary" | "accent";
}) {
  const t = { muted: "text-muted-foreground", primary: "text-primary", accent: "text-foreground" }[
    tone
  ];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
        t,
      )}
    >
      {children}
    </span>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
  return (
    <span
      title={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-secondary-foreground ring-2 ring-card",
        size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs",
      )}
    >
      {initials}
    </span>
  );
}

const accessMap: Record<Access, { label: string; icon: typeof Lock }> = {
  public: { label: "All staff", icon: Globe },
  department: { label: "Department", icon: Building2 },
  project: { label: "Project members", icon: Users },
  restricted: { label: "Restricted", icon: Lock },
};
export function AccessBadge({ access }: { access: Access }) {
  const a = accessMap[access];
  return (
    <Pill tone={access === "restricted" ? "accent" : "muted"}>
      <a.icon className="h-3 w-3" />
      {a.label}
    </Pill>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-3xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

export const fmtDate = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
