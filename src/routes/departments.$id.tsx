import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Avatar, Card, PageHeader, Pill, SectionTitle, StatusBadge } from "@/components/kit";
import type { DeptId } from "@/lib/data";
import { getWorkspace, useWorkspace } from "@/lib/workspace";
import { DepartmentModules } from "@/components/DepartmentModules";
import { useRole } from "@/lib/role";

export const Route = createFileRoute("/departments/$id")({
  loader: ({ params }) => {
    const d = getWorkspace().departments.find((x) => x.id === params.id);
    if (!d) throw notFound();
    return { name: d.name, blurb: d.blurb };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.name ?? "Department"} · Amsol` },
      { name: "description", content: loaderData?.blurb ?? "Amsol department" },
      { property: "og:title", content: `${loaderData?.name ?? "Department"} · Amsol` },
      { property: "og:description", content: loaderData?.blurb ?? "Amsol department" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DeptPage,
});

function DeptPage() {
  const { id } = Route.useParams();
  const { departments, people, projects } = useWorkspace();
  const d = departments.find((x) => x.id === id)!;
  const { reports } = useRole();
  const dp = projects.filter((p) => p.depts.includes(id as DeptId));
  return (
    <div>
      <Link to="/departments" className="text-sm text-muted-foreground">
        ← Departments
      </Link>
      <PageHeader title={d.name} subtitle={d.blurb} />
      <DepartmentModules key={id} dept={id as DeptId} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div>
            <SectionTitle>Projects</SectionTitle>
            <Card className="divide-y p-0">
              {dp.map((p) => (
                <Link
                  key={p.id}
                  to="/projects/$id"
                  params={{ id: p.id }}
                  className="flex items-center justify-between px-5 py-3 text-sm hover:bg-muted/50"
                >
                  <span>{p.name}</span>
                  <StatusBadge status={p.status} />
                </Link>
              ))}
            </Card>
          </div>
          <div>
            <SectionTitle>Recent reports</SectionTitle>
            <Card className="divide-y p-0">
              {reports
                .filter((r) => r.dept === id)
                .map((r) => (
                  <div key={r.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <Link to="/reports" hash={`report-${r.id}`} className="text-primary">
                      {r.title}
                    </Link>
                    <Pill>{r.type}</Pill>
                  </div>
                ))}
            </Card>
          </div>
        </div>
        <div>
          <SectionTitle>Team</SectionTitle>
          <Card className="space-y-3">
            {people
              .filter((p) => p.dept === id)
              .map((p) => (
                <div key={p.id} className="flex items-center gap-3">
                  <Avatar name={p.name} size="sm" />
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.title}</div>
                  </div>
                </div>
              ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
