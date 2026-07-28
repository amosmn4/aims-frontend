import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import {
  Wallet,
  Users,
  Cpu,
  Megaphone,
  FileText,
  Crown,
  ArrowRight,
  ArrowDown,
} from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  role: z
    .union([
      z.literal("tender"),
      z.literal("finance"),
      z.literal("hr"),
      z.literal("it"),
      z.literal("marketing"),
      z.literal("ceo_admin"),
    ])
    .optional(),
});

export const Route = createFileRoute("/_authenticated/guide")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "How AIMS Works — AIMS" }, { name: "robots", content: "noindex" }],
  }),
  component: GuidePage,
});

type RoleKey = "tender" | "finance" | "hr" | "it" | "marketing" | "ceo_admin";

interface Step {
  label: string;
  description: string;
  to: string;
}

interface RoleGuide {
  key: RoleKey;
  title: string;
  icon: typeof Users;
  accent: string;
  intro: string;
  steps: Step[];
}

const ROLES: RoleGuide[] = [
  {
    key: "tender",
    title: "Tender",
    icon: FileText,
    accent: "bg-destructive/10 text-destructive",
    intro:
      "You run two things: AMSOL's bid pipeline, and the front door for every inbound client request. Both are pre-project pipelines that hand off to a delivering department once won.",
    steps: [
      { label: "Identify", description: "Log a new opportunity onto the Tender Pipeline board.", to: "/pipeline/tenders" },
      { label: "Prepare Application", description: "Work the requirements checklist — the board shows live % complete.", to: "/pipeline/tenders" },
      { label: "Submit", description: "Move the card to Submitted once the bid is in.", to: "/pipeline/tenders" },
      { label: "Under Evaluation", description: "Wait on the client's decision. Drop out (Lost/Withdrawn, with a reason) at any point via the card's quick action.", to: "/pipeline/tenders" },
      { label: "Awarded", description: "Won — forward it to the delivering department.", to: "/pipeline/tenders" },
      { label: "Becomes a Project", description: "The delivering department now runs it as a Project.", to: "/pipeline/projects" },
      { label: "Full tender record", description: "Resources, financials and requirement templates live on the tender's own page.", to: "/tender" },
      { label: "Client request intake", description: "Also log and route every inbound client request here — the other pre-project pipeline you own.", to: "/pipeline/engagements" },
      { label: "Route to department", description: "Assign it to whichever department owns that service.", to: "/pipeline/engagements" },
      { label: "Won → Project", description: "Onboard as a client or convert straight to a Project once won.", to: "/pipeline/engagements" },
    ],
  },
  {
    key: "finance",
    title: "Finance",
    icon: Wallet,
    accent: "bg-primary/10 text-primary",
    intro:
      "You bill clients, collect what's owed, and give the CEO visibility into revenue, margin and compliance.",
    steps: [
      { label: "Invoices & Billing", description: "Raise and track invoices against contracts and projects.", to: "/finance/invoices" },
      { label: "Debtors", description: "Chase outstanding and overdue balances.", to: "/finance/debtors" },
      { label: "Revenue & Margin", description: "Recurring vs one-off revenue, gross margin by service line.", to: "/finance/revenue" },
      { label: "Budgets", description: "Set department and project budgets.", to: "/finance/budgets" },
      { label: "Payroll Compliance", description: "Track statutory filing deadlines for clients.", to: "/finance/payroll-compliance" },
      { label: "Reports to CEO", description: "Submit a narrative report for executive visibility.", to: "/finance/reports" },
    ],
  },
  {
    key: "hr",
    title: "HR",
    icon: Users,
    accent: "bg-success/10 text-success",
    intro:
      "AMSOL's HR team doesn't manage AMSOL's own staff — you deliver AMSOL's HR service lines (salary surveys, recruitment, training, HRMS, retainers) to clients.",
    steps: [
      { label: "Win the engagement", description: "Salary surveys, recruitment, training and retainer work start as Tenders or Client Requests routed to HR.", to: "/pipeline/tenders" },
      { label: "Deliver as a Project", description: "Once won, it becomes a Project with tasks, milestones and a team.", to: "/projects" },
      { label: "Run recruitment delivery", description: "For Recruitment-service engagements, track candidates you're sourcing for the client's open role.", to: "/hr/recruitment" },
      { label: "HR Overview", description: "See every active HR engagement, pipeline value and the breakdown by service line.", to: "/hr" },
    ],
  },
  {
    key: "it",
    title: "IT",
    icon: Cpu,
    accent: "bg-warning/10 text-warning",
    intro:
      "You deliver systems and HRMS-licensing engagements, keep AMSOL's own infrastructure running, and build/manage the company website and internal systems.",
    steps: [
      { label: "Win the engagement", description: "HRMS licensing and systems work start as Tenders or Client Requests routed to IT.", to: "/pipeline/tenders" },
      { label: "Deliver as a Project", description: "Implementation/rollout work runs as a Project — tasks, Gantt timeline, team.", to: "/projects" },
      { label: "Register what you maintain", description: "Track every website, internal system and integration IT is responsible for.", to: "/it/systems-sites" },
      { label: "IT Overview", description: "Active projects, open tasks and a status breakdown of everything registered.", to: "/it" },
    ],
  },
  {
    key: "marketing",
    title: "Marketing",
    icon: Megaphone,
    accent: "bg-accent/10 text-accent",
    intro:
      "You generate and nurture leads, then hand qualified ones to Tender to become a real client request — plus you track how the website is performing.",
    steps: [
      { label: "New Lead", description: "Log a lead as it comes in — website, referral, campaign, event.", to: "/marketing/leads" },
      { label: "Contact → Qualify", description: "Work it through follow-ups, logged against the lead.", to: "/marketing/leads" },
      { label: "Nurture or drop", description: "Keep nurturing, or mark it Lost if it's not going anywhere.", to: "/marketing/leads" },
      { label: "Convert", description: "Once it's sales-ready, convert it into a Client Request — from there it's Tender's intake pipeline.", to: "/marketing/leads" },
      { label: "Website Analytics", description: "Visitors, page views and top sources for the company website.", to: "/marketing/website-analytics" },
      { label: "Write a blog post", description: "Draft, publish and track engagement (views, likes, shares, time spent) on posts served to the company website.", to: "/marketing/blog" },
      { label: "Marketing Overview", description: "Leads, conversion rate and website performance in one place.", to: "/marketing" },
    ],
  },
  {
    key: "ceo_admin",
    title: "CEO / Admin",
    icon: Crown,
    accent: "bg-secondary text-secondary-foreground",
    intro:
      "You see everything: revenue, pipeline, margin, every department's numbers — and you manage who has access to what.",
    steps: [
      { label: "Executive Dashboard", description: "Revenue vs target, pipeline funnels, margin, alerts — all at a glance.", to: "/dashboard" },
      { label: "Departments", description: "Drill into any department's clients and contracts.", to: "/departments" },
      { label: "Reports", description: "Narrative reports submitted by each department.", to: "/reports" },
      { label: "Admin", description: "Manage users, roles and departments.", to: "/admin/users" },
    ],
  },
];

function FlowDiagram({ steps, accent }: { steps: Step[]; accent: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-2">
          <Link
            to={s.to}
            className={cn(
              "rounded-md border px-3 py-2 text-xs font-medium hover:border-primary/50 transition-colors",
              accent,
            )}
          >
            {s.label}
          </Link>
          {i < steps.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        </div>
      ))}
    </div>
  );
}

function RoleWalkthrough({ role }: { role: RoleGuide }) {
  const Icon = role.icon;
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className={cn("h-10 w-10 rounded-md flex items-center justify-center shrink-0", role.accent)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-semibold text-lg">{role.title}</h2>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">{role.intro}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
          Your flow
        </div>
        <FlowDiagram steps={role.steps} accent={role.accent} />
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        {role.steps.map((s, i) => (
          <Link
            key={s.label}
            to={s.to}
            className="flex items-start gap-4 p-4 border-b last:border-b-0 hover:bg-secondary/40 transition-colors"
          >
            <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center text-[0.6875rem] font-semibold shrink-0 mt-0.5">
              {i + 1}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">{s.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.description}</div>
            </div>
            <div className="text-xs text-primary shrink-0">Open →</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SystemMap() {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div>
        <h2 className="font-semibold">The whole system, end to end</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Two pipelines feed one delivery phase, which feeds Finance.
        </p>
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="rounded-md border bg-destructive/10 text-destructive px-3 py-2 text-xs font-medium">
            Tender identified
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="rounded-md border bg-destructive/10 text-destructive px-3 py-2 text-xs font-medium">
            Applied → Submitted → Awarded
          </div>
        </div>
        <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">or</div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="rounded-md border bg-accent/10 text-accent px-3 py-2 text-xs font-medium">
            Client Request (new)
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="rounded-md border bg-accent/10 text-accent px-3 py-2 text-xs font-medium">
            Assigned → Engaging → Proposal → Won
          </div>
        </div>

        <ArrowDown className="h-4 w-4 text-muted-foreground my-1" />

        <div className="rounded-md border bg-primary/10 text-primary px-4 py-2.5 text-sm font-semibold">
          Project (Onboarding → In Progress → Delivery/QA → Invoicing → Payment → Closed)
        </div>

        <ArrowDown className="h-4 w-4 text-muted-foreground my-1" />

        <div className="rounded-md border bg-success/10 text-success px-3 py-2 text-xs font-medium">
          Finance: Invoices, Payments, Revenue &amp; Margin reporting
        </div>
      </div>

      <p className="text-xs text-muted-foreground pt-2 border-t">
        Every department (Finance, HR, IT, Marketing &amp; Operations, Tender) owns tenders,
        requests and projects the same way — only the service lines and who's assigned differ.
        The Pipeline board shows the pre-project stages; Projects &amp; Tasks and the individual
        Project Workspace show delivery; Finance shows the money.
      </p>
    </div>
  );
}

function GuidePage() {
  const { role } = Route.useSearch();
  const navigate = Route.useNavigate();
  const selected = ROLES.find((r) => r.key === role) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="How AIMS Works"
        description="Pick your role to see exactly how your work flows through the system, with direct links to every real screen."
      />

      <div className="flex flex-wrap gap-2">
        {ROLES.map((r) => {
          const Icon = r.icon;
          const active = r.key === role;
          return (
            <button
              key={r.key}
              onClick={() => navigate({ search: { role: r.key }, replace: true })}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors",
                active ? "border-primary bg-primary/5" : "hover:border-primary/40",
              )}
            >
              <div className={cn("h-7 w-7 rounded-md flex items-center justify-center", r.accent)}>
                <Icon className="h-4 w-4" />
              </div>
              {r.title}
            </button>
          );
        })}
      </div>

      {selected ? <RoleWalkthrough role={selected} /> : <SystemMap />}

      {selected && (
        <div>
          <button
            onClick={() => navigate({ search: {}, replace: true })}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            ← Back to the full system map
          </button>
        </div>
      )}
    </div>
  );
}
