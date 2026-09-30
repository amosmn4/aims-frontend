import { Link, useLocation, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { departmentScopeFor, useAuth } from "@/lib/auth";

export type ProjectBack = {
  href: string;
  to: string;
  search: Record<string, unknown>;
  label: string;
};

/** The current page, passed as `from` when opening a project so Back returns here. */
export function useHereHref() {
  return useLocation({ select: (l) => l.href });
}

const LABELS: [RegExp, string][] = [
  [/^\/hr\/projects/, "HR projects"],
  [/^\/hr\/recruitment/, "Recruitment"],
  [/^\/[a-z]+\/shared-projects/, "Shared with me"],
  [/^\/projects\/mine/, "My tasks"],
  [/^\/(projects\/department|[a-z]+\/tasks)/, "Tasks"],
  [/^\/pipeline\/projects/, "Projects board"],
  [/^\/projects/, "Projects"],
  [/^\/(departments|[a-z]+\/workspace)/, "Clients & contracts"],
  [/^\/([a-z]+\/)?reports/, "Reports"],
  [/^\/([a-z]+\/)?calendar/, "Calendar"],
  [/^\/(dashboard|hr|it|finance|marketing|tender|operations)\/?$/, "Home"],
  [/^\/(requests|pipeline\/engagements|[a-z]+\/pipeline)/, "Client requests"],
  [/^\/(tender|pipeline\/tenders)/, "Tenders"],
  [/^\/clients/, "Clients & contracts"],
];

const isSafePath = (p: string | undefined): p is string =>
  !!p && p.startsWith("/") && !p.startsWith("//");

/** Where Back goes on a project page: where the person came from, else their projects list. */
export function useProjectBack(
  departmentCode: string | null | undefined,
  from: string | undefined,
): ProjectBack {
  const router = useRouter();
  const { roles, isAdminOrCeo, canReadDepartment, workspace } = useAuth();

  if (isSafePath(from)) {
    const path = from.split("#")[0];
    const q = path.indexOf("?");
    const to = q === -1 ? path : path.slice(0, q);
    const search = q === -1 ? {} : router.options.parseSearch(path.slice(q));
    const label = LABELS.find(([re]) => re.test(to))?.[1] ?? "previous page";
    return { href: from, to, search, label };
  }

  const scope = workspace && workspace !== "water" ? workspace : departmentScopeFor(roles);
  if (scope && departmentCode && departmentCode !== scope) {
    const to = `/${scope}/shared-projects`;
    return { href: to, to, search: {}, label: "Shared with me" };
  }
  const hr =
    departmentCode === "hr" && (scope === "hr" || (!isAdminOrCeo && canReadDepartment("hr")));
  const to = hr ? "/hr/projects" : "/projects";
  return { href: to, to, search: {}, label: hr ? "HR projects" : "Projects" };
}

export function ProjectBackLink({ back }: { back: ProjectBack }) {
  return (
    <Link
      to={back.to}
      search={back.search}
      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to {back.label}
    </Link>
  );
}
