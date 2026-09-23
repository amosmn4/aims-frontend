import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { LoadError } from "@/components/load-error";
import { ReportEditor } from "@/features/reports/report-editor";
import { useReport } from "@/features/reports/use-reports";

export const Route = createFileRoute("/_authenticated/reports_/$reportId")({
  head: () => ({ meta: [{ title: "Report — AIMS" }, { name: "robots", content: "noindex" }] }),
  component: ReportPage,
});

function ReportPage() {
  const { reportId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const reportQ = useReport(reportId);

  if (reportQ.isLoading) {
    return (
      <div className="flex justify-center py-12" role="status" aria-label="Loading the report">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const report = reportQ.data;
  const status = (reportQ.error as { status?: number } | null)?.status;
  if (reportQ.isError && status !== 404 && status !== 403) {
    return (
      <div className="mx-auto max-w-5xl">
        <LoadError what="this report" error={reportQ.error} onRetry={() => reportQ.refetch()} />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="mx-auto max-w-5xl rounded-lg border bg-card p-8 text-center">
        <p className="text-sm font-medium">This report isn't available</p>
        <p className="mt-1 text-xs text-muted-foreground">
          It may have been deleted, or it isn't one you can open.
        </p>
        <Link to="/reports" className="mt-3 inline-block text-sm text-primary hover:underline">
          Go to Reports
        </Link>
      </div>
    );
  }

  const backTo =
    report.kind === "individual" && report.subjectUserId === user?.id
      ? "/reports/mine"
      : "/reports";

  return <ReportEditor report={report} onLeave={() => void navigate({ to: backTo })} />;
}
