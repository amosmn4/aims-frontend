import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, UserRound } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ReportsInbox } from "@/features/reports/reports-inbox";
import { useReportLinks } from "@/features/reports/report-links";
import { SectionHeading } from "@/components/section-heading";

const MY_REPORTS = "/reports/mine" as string;

export const Route = createFileRoute("/_authenticated/reports/")({
  component: ReportsIndex,
});

function ReportsIndex() {
  const { isAdminOrCeo } = useAuth();
  return (
    <div className="space-y-4">
      {isAdminOrCeo ? <ReportsInbox /> : <MyReportsCard />}
      <ReportCards />
    </div>
  );
}

/** Everyone who is not the CEO starts from their own month. */
function MyReportsCard() {
  return (
    <section aria-labelledby="my-reports-heading">
      <SectionHeading id="my-reports-heading">Your reports</SectionHeading>
      <Link
        to={MY_REPORTS}
        className="group flex items-start gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <UserRound className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">My reports</div>
          <div className="text-xs text-muted-foreground">
            Your own account of each month: what you finished, what you are carrying, what is in
            your way.
          </div>
        </div>
        <ArrowRight
          className="h-4 w-4 text-muted-foreground group-hover:text-primary"
          aria-hidden="true"
        />
      </Link>
    </section>
  );
}

function ReportCards() {
  const { all } = useReportLinks();
  return (
    <section aria-labelledby="report-cards-heading" className="space-y-2">
      <div>
        <h2 id="report-cards-heading" className="text-sm font-semibold">
          Reports by department
        </h2>
        <p className="text-xs text-muted-foreground">
          Figures for each department you can view, with the reports they send to the CEO.
        </p>
      </div>
      {all.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          You can't view any department's report yet. Ask the CEO if you need one for your work.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {all.map((i) => {
            const Icon = i.icon;
            return (
              <li key={i.to}>
                <Link
                  to={i.to}
                  className="group flex h-full items-start gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{i.label}</div>
                    <div className="text-xs text-muted-foreground">{i.hint}</div>
                  </div>
                  <ArrowRight
                    className="h-4 w-4 text-muted-foreground group-hover:text-primary"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
