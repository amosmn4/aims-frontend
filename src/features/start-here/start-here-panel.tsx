import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StartHereCode = "hr" | "finance" | "it" | "marketing" | "tender" | "operations" | "water";

const FIRST_DAYS = 14;
const storageKey = (userId: string) => `aims:start-here-hidden:${userId}`;

type StepLink = (children: ReactNode) => ReactNode;
interface Step {
  label: string;
  link: StepLink;
}

const MONTHLY_REPORT = "Send your monthly report";

const STEPS: Record<StartHereCode, Step[]> = {
  hr: [
    { label: "See your tasks", link: (c) => <Link to="/projects/mine">{c}</Link> },
    { label: "Open a project", link: (c) => <Link to="/hr/projects">{c}</Link> },
    { label: MONTHLY_REPORT, link: (c) => <Link to="/hr/reports">{c}</Link> },
  ],
  finance: [
    {
      label: "Record an invoice",
      link: (c) => (
        <Link to="/finance/invoices" search={{ new: 1 }}>
          {c}
        </Link>
      ),
    },
    { label: "Check who owes money", link: (c) => <Link to="/finance/debtors">{c}</Link> },
    { label: MONTHLY_REPORT, link: (c) => <Link to="/finance/reports">{c}</Link> },
  ],
  it: [
    { label: "See open tickets", link: (c) => <Link to="/it/tickets">{c}</Link> },
    { label: "Check systems & uptime", link: (c) => <Link to="/it/systems-sites">{c}</Link> },
    { label: MONTHLY_REPORT, link: (c) => <Link to="/it/reports">{c}</Link> },
  ],
  marketing: [
    { label: "Add a lead", link: (c) => <Link to="/marketing/leads">{c}</Link> },
    { label: "Plan a campaign", link: (c) => <Link to="/marketing/campaigns">{c}</Link> },
    { label: MONTHLY_REPORT, link: (c) => <Link to="/marketing/reports">{c}</Link> },
  ],
  tender: [
    { label: "Add a tender", link: (c) => <Link to="/tender">{c}</Link> },
    { label: "Check deadlines", link: (c) => <Link to="/tender/calendar">{c}</Link> },
    { label: MONTHLY_REPORT, link: (c) => <Link to="/tender/reports">{c}</Link> },
  ],
  operations: [
    { label: "Log a client request", link: (c) => <Link to="/operations/requests">{c}</Link> },
    { label: "Route new requests", link: (c) => <Link to="/requests">{c}</Link> },
    { label: MONTHLY_REPORT, link: (c) => <Link to="/operations/reports">{c}</Link> },
  ],
  water: [
    { label: "Record a meter reading", link: (c) => <Link to="/water/readings">{c}</Link> },
    { label: "Upload a usage file", link: (c) => <Link to="/water/upload">{c}</Link> },
    { label: "Check this month's report", link: (c) => <Link to="/water/reports">{c}</Link> },
  ],
};

const isCode = (code: string): code is StartHereCode => code in STEPS;

/** First-fortnight welcome with three department steps; hidden for good once dismissed. */
export function StartHerePanel({
  departmentCode,
  className,
}: {
  departmentCode: string;
  className?: string;
}) {
  const { user, profile } = useAuth();
  const userId = user?.id;
  const createdAt = (profile as { createdAt?: string | null } | null)?.createdAt ?? null;
  const [hidden, setHidden] = useState<boolean | null>(null);

  useEffect(() => {
    if (!userId) return;
    try {
      setHidden(window.localStorage.getItem(storageKey(userId)) === "1");
    } catch {
      setHidden(false);
    }
  }, [userId]);

  if (!userId || hidden !== false || !isCode(departmentCode)) return null;
  if (createdAt) {
    const joined = new Date(createdAt).getTime();
    if (!Number.isNaN(joined) && Date.now() - joined > FIRST_DAYS * 864e5) return null;
  }

  const hide = () => {
    setHidden(true);
    try {
      window.localStorage.setItem(storageKey(userId), "1");
    } catch {
      /* stays hidden for this visit only */
    }
  };

  return (
    <section
      aria-labelledby="start-here-heading"
      className={cn("rounded-xl border border-primary/30 bg-primary/5 p-4", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="start-here-heading" className="text-base font-semibold">
            Start here
          </h2>
          <p className="text-sm text-muted-foreground">Three things to do in your first week.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={hide} className="shrink-0">
          <X className="mr-1 h-4 w-4" aria-hidden="true" /> Hide this
        </Button>
      </div>
      <ol className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {STEPS[departmentCode].map((step, i) => (
          <li key={step.label}>
            <Button
              asChild
              variant="outline"
              className="h-auto w-full justify-start bg-card py-2.5"
            >
              {step.link(
                <>
                  <span
                    className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <span className="whitespace-normal text-left">{step.label}</span>
                </>,
              )}
            </Button>
          </li>
        ))}
      </ol>
      <Link
        to="/guide"
        search={{ role: departmentCode }}
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <BookOpen className="h-4 w-4" aria-hidden="true" /> How AIMS works
      </Link>
    </section>
  );
}
