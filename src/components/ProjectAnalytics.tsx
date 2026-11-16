import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, HandHelping } from "@/components/icons";
import type { Status } from "@/lib/data";
import { useWorkspace } from "@/lib/workspace";
import { projectHealth } from "@/lib/analytics";
import { useRole } from "@/lib/role";
import { Card, Progress, SectionTitle } from "./kit";

const labels: Record<Status, string> = {
  "on-track": "On track",
  "at-risk": "At risk",
  delayed: "Delayed",
  completed: "Completed",
};
const colors: Record<Status, string> = {
  "on-track": "var(--success)",
  "at-risk": "var(--warning)",
  delayed: "var(--destructive)",
  completed: "var(--primary)",
};

export function ProjectAnalytics() {
  const { reports } = useRole();
  const { projects } = useWorkspace();
  const health = projectHealth(projects).map((item) => ({ ...item, name: labels[item.status] }));
  const support = reports.filter((r) => r.blockers && !r.reviewed);
  return (
    <div className="mb-8 grid gap-5 md:grid-cols-2">
      <Card>
        <SectionTitle>Portfolio health</SectionTitle>
        <div className="flex flex-wrap items-center justify-center gap-5">
          <div
            className="relative h-44 w-44 shrink-0"
            role="img"
            aria-label={health.map((h) => `${h.count} ${h.name}`).join(", ")}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={health}
                  dataKey="count"
                  innerRadius={57}
                  outerRadius={78}
                  paddingAngle={4}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {health.map((h) => (
                    <Cell key={h.status} fill={colors[h.status]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    borderColor: "var(--border)",
                    color: "var(--popover-foreground)",
                    borderRadius: 6,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <strong className="font-display text-3xl">{projects.length}</strong>
              <span className="text-xs text-muted-foreground">projects</span>
            </div>
          </div>
          <div className="space-y-3 text-xs">
            {health.map((h) => (
              <div key={h.status} className="flex items-center gap-2">
                <span className={`health-dot health-${h.status}`} />
                <span>{h.name}</span>
                <strong className="ml-auto pl-4">{h.count}</strong>
              </div>
            ))}
          </div>
        </div>
      </Card>
      <Card>
        <SectionTitle>Project delivery</SectionTitle>
        <div className="space-y-4">
          {projects
            .filter((p) => p.status !== "completed")
            .map((p) => (
              <Link key={p.id} to="/projects/$id" params={{ id: p.id }} className="block">
                <div className="mb-1.5 flex items-start justify-between gap-3 text-xs">
                  <span className="min-w-0">{p.name}</span>
                  <strong className="shrink-0 tabular-nums">{p.progress}%</strong>
                </div>
                <Progress value={p.progress} />
              </Link>
            ))}
        </div>
      </Card>
      <Card className="md:col-span-2">
        <SectionTitle>Where support helps</SectionTitle>
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <HandHelping className="h-4 w-4 text-primary" />
          {support.length} shared support needs
        </div>
        <div className="divide-y">
          {support.map((r) => (
            <Link key={r.id} to="/reports" hash={`report-${r.id}`} className="block py-3">
              <div className="flex items-start justify-between gap-2 text-xs font-semibold">
                {r.title}
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-primary" />
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{r.blockers}</p>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
