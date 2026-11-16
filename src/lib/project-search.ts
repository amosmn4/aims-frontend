import type { Project, Report } from "./data";

const ignored = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "does",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "of",
  "on",
  "our",
  "show",
  "stand",
  "the",
  "this",
  "to",
  "up",
  "what",
  "where",
  "which",
  "with",
]);

export function searchProjects(query: string, projects: Project[], reports: Report[]) {
  const terms = query
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((term) => term && !ignored.has(term));
  const support = terms.some((term) => /block|holding|support|risk|delay/.test(term));
  const keywords = terms.filter((term) => !/block|holding|support|risk|delay/.test(term));
  const score = (text: string) =>
    keywords.reduce((sum, term) => sum + (text.toLowerCase().includes(term) ? 1 : 0), 0);
  const selectedProjects = projects
    .filter((project) =>
      keywords.length
        ? score(`${project.name} ${project.summary}`) > 0
        : support
          ? project.status === "at-risk" || project.status === "delayed"
          : terms.length > 0,
    )
    .sort((a, b) => score(`${b.name} ${b.summary}`) - score(`${a.name} ${a.summary}`));
  const selectedReports = reports
    .filter(
      (report) =>
        (!support || !!report.blockers?.trim()) &&
        (keywords.length
          ? score(
              `${report.title} ${report.progress ?? ""} ${report.blockers ?? ""} ${report.next ?? ""}`,
            ) > 0 || selectedProjects.some((project) => project.id === report.project)
          : terms.length > 0),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  return { projects: selectedProjects, reports: selectedReports };
}
