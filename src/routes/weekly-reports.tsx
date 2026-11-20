import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAccount } from "@/lib/account";
import { reportingWeek, type WeeklyPhase } from "@/lib/weekly";

export const Route = createFileRoute("/weekly-reports")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { week?: string; staff?: string; phase?: WeeklyPhase } => ({
    ...(typeof search["week"] === "string" ? { week: search["week"] } : {}),
    ...(typeof search["staff"] === "string" ? { staff: search["staff"] } : {}),
    ...(search["phase"] === "plan" || search["phase"] === "report"
      ? { phase: search["phase"] }
      : {}),
  }),
  component: WeeklyReports,
  head: () => ({
    meta: [{ title: "Weekly reporting | Amsol Ops" }, { name: "robots", content: "noindex" }],
  }),
});
function WeeklyReports() {
  const { account, ready } = useAccount();
  const search = Route.useSearch();
  const phase = search.phase ?? "plan";
  const week = search.week ?? reportingWeek();
  if (!ready || !account) return <p role="status">Loading reporting...</p>;
  return (
    <Navigate
      to="/reporting"
      replace
      search={
        account?.role === "ceo"
          ? {
              view: search.staff ? "detail" : phase === "plan" ? "team-plans" : "team-reports",
              week,
              phase,
              ...(search.staff ? { staff: search.staff } : {}),
            }
          : { view: phase === "plan" ? "weekly-plan" : "weekly-report", week }
      }
    />
  );
}
