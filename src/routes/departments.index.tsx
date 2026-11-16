import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, PageHeader, Pill } from "@/components/kit";
import { useWorkspace } from "@/lib/workspace";
import { meta } from "@/lib/meta";

export const Route = createFileRoute("/departments/")({
  head: () => ({
    meta: meta("Departments", "Amsol's HR, Finance, IT, Marketing and Operations departments."),
  }),
  component: Departments,
});

function Departments() {
  const { departments, people, projects } = useWorkspace();
  return (
    <div>
      <PageHeader title="Departments" subtitle="Everyone reports directly to the CEO" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {departments.map((d) => (
          <Link key={d.id} to="/departments/$id" params={{ id: d.id }}>
            <Card className="h-full hover:border-primary/40">
              <div className="font-display text-lg font-semibold">{d.name}</div>
              <p className="mt-1 text-sm text-muted-foreground">{d.blurb}</p>
              <div className="mt-4 flex gap-2">
                <Pill>{people.filter((p) => p.dept === d.id).length} staff</Pill>
                <Pill tone="primary">
                  {
                    projects.filter((p) => p.depts.includes(d.id) && p.status !== "completed")
                      .length
                  }{" "}
                  active projects
                </Pill>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
