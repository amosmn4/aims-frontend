import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { FolderKanban, LayoutList, Loader2, Search, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useHrDepartment, useHrWork, isOpenProject } from "@/features/hr/use-hr";
import { HrProjectTable } from "@/features/hr/hr-project-table";
import { HrStatusBoard } from "@/features/hr/hr-status-board";
import { NewProjectDialog } from "@/features/projects/new-project-dialog";
import { PageHeader } from "@/components/app-shell";
import { LoadError } from "@/components/load-error";
import { ViewOnlyBanner } from "@/components/view-only-banner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  line: z.string().optional().catch(undefined),
  notLine: z.string().optional().catch(undefined),
  type: z.enum(["all", "ongoing", "one_off"]).optional().catch(undefined),
  status: z.enum(["open", "closed", "all"]).optional().catch(undefined),
  view: z.enum(["list", "board"]).optional().catch(undefined),
  noClient: z.boolean().optional().catch(undefined),
  q: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/_authenticated/hr/projects")({
  head: () => ({ meta: [{ title: "HR — Projects — AIMS" }] }),
  validateSearch: searchSchema,
  component: HrProjects,
});

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      className="inline-flex rounded-lg border bg-card p-0.5"
      role="radiogroup"
      aria-label={label}
    >
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            value === v
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function HrProjects() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { canWriteDepartment } = useAuth();
  const { department, lines, missing, loadFailed, error, retry } = useHrDepartment();
  const work = useHrWork(department?.id);
  const { projects, statsByProject, isLoading } = work;
  const [q, setQ] = useState(search.q ?? "");

  const line = search.line ?? "all";
  const notLine = search.notLine;
  const type = search.type ?? "all";
  const status = search.status ?? "open";
  const view = search.view ?? "list";
  const noClient = search.noClient === true;
  const setSearch = (patch: Partial<z.infer<typeof searchSchema>>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });
  const notLineName = lines.find((l) => l.code === notLine)?.name ?? notLine;

  // The board groups by status itself, so the status filter applies to the list only.
  const byStatus = useMemo(
    () =>
      projects.filter((p) =>
        view === "board" || status === "all"
          ? true
          : status === "open"
            ? isOpenProject(p)
            : !isOpenProject(p),
      ),
    [projects, status, view],
  );
  const lineCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of byStatus)
      if (p.service_line_code) m.set(p.service_line_code, (m.get(p.service_line_code) ?? 0) + 1);
    return m;
  }, [byStatus]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return byStatus.filter(
      (p) =>
        (line === "all" || p.service_line_code === line) &&
        (!notLine || p.service_line_code !== notLine) &&
        (type === "all" || p.engagement_type === type) &&
        (!noClient || !p.client_id) &&
        (!needle ||
          p.name.toLowerCase().includes(needle) ||
          (p.client_name ?? "").toLowerCase().includes(needle)),
    );
  }, [byStatus, line, notLine, type, noClient, q]);

  const clearFilters = () => {
    setQ("");
    setSearch({
      line: undefined,
      notLine: undefined,
      type: undefined,
      status: view === "board" ? status : "all",
      noClient: undefined,
      q: undefined,
    });
  };

  if (loadFailed) {
    return <LoadError what="HR" error={error} onRetry={retry} />;
  }

  if (missing) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        The HR department isn&apos;t set up yet. Ask the CEO to add it.
      </div>
    );
  }

  const canCreate = canWriteDepartment("hr");
  const newProject =
    canCreate && department ? <NewProjectDialog fixedDepartmentId={department.id} /> : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="HR projects"
        description="Every HR service-line project. Open one to manage its tasks, client and contract."
        actions={newProject}
      />
      {!canCreate && <ViewOnlyBanner area="HR projects" action="add or change projects" />}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search
            className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSearch({ q: e.target.value || undefined });
            }}
            placeholder="Search project or client"
            className="pl-8"
            aria-label="Search projects"
          />
        </div>
        <Segmented
          label="Type of work"
          value={type}
          onChange={(v) => setSearch({ type: v })}
          options={[
            ["all", "All types"],
            ["ongoing", "Recurring"],
            ["one_off", "One-off"],
          ]}
        />
        {view === "list" && (
          <Segmented
            label="Status"
            value={status}
            onChange={(v) => setSearch({ status: v })}
            options={[
              ["open", "Open"],
              ["closed", "Finished"],
              ["all", "All"],
            ]}
          />
        )}
        <Segmented
          label="View"
          value={view}
          onChange={(v) => setSearch({ view: v })}
          options={[
            ["list", "List"],
            ["board", "Board"],
          ]}
        />
        {noClient && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSearch({ noClient: undefined })}
            aria-label="Stop showing only projects without a client"
          >
            Without a client <X className="h-3.5 w-3.5 ml-1" aria-hidden="true" />
          </Button>
        )}
        {notLine && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSearch({ notLine: undefined })}
            aria-label={`Stop hiding projects on ${notLineName}`}
          >
            Not on {notLineName} <X className="h-3.5 w-3.5 ml-1" aria-hidden="true" />
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Service line">
        {[
          ["all", "All service lines", byStatus.length] as const,
          ...lines.map((l) => [l.code, l.name, lineCounts.get(l.code) ?? 0] as const),
        ].map(([code, name, count]) => (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={line === code}
            onClick={() => setSearch({ line: code === "all" ? undefined : code })}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
              line === code
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card hover:border-primary/60",
            )}
          >
            {name}
            <span
              className={cn(
                "rounded-full px-1.5 text-xs tabular-nums",
                line === code ? "bg-primary-foreground/20" : "bg-secondary text-muted-foreground",
              )}
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      {isLoading && !work.isError ? (
        <div className="flex justify-center rounded-lg border bg-card py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : work.isError ? (
        <LoadError what="HR projects" error={work.error} onRetry={work.retry} />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border bg-card px-6 py-12 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-primary">
            {projects.length === 0 ? (
              <FolderKanban className="h-5 w-5" aria-hidden="true" />
            ) : (
              <LayoutList className="h-5 w-5" aria-hidden="true" />
            )}
          </div>
          <div className="text-sm font-medium">
            {projects.length === 0 ? "No HR projects yet" : "No matches"}
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">
            {projects.length === 0
              ? "Capture your first project — recruitment drive, training, salary survey or ongoing HR support."
              : "No project fits these filters."}
          </p>
          {projects.length === 0 ? (
            newProject
          ) : (
            <Button size="sm" variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      ) : view === "board" ? (
        <HrStatusBoard projects={filtered} statsByProject={statsByProject} />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <HrProjectTable projects={filtered} statsByProject={statsByProject} />
        </div>
      )}
    </div>
  );
}
