import { createFileRoute, Link } from "@tanstack/react-router";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { z } from "zod";
import { ArrowDown, ArrowRight, BookOpen, Lightbulb, Search, Sparkles } from "lucide-react";
import { useAuth, departmentScopeFor } from "@/lib/auth";
import {
  EVERYONE_HOW_TO,
  GLOSSARY,
  ROLE_GUIDES,
  type HowTo,
  type RoleGuide,
  type RoleKey,
} from "@/features/guide/guide-content";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

const ROLE_KEYS = [
  "hr",
  "tender",
  "operations",
  "finance",
  "it",
  "marketing",
  "water",
  "ceo_admin",
] as const;

const searchSchema = z.object({
  role: z.enum(ROLE_KEYS).optional().catch(undefined),
  q: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/_authenticated/guide")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "How AIMS Works — AIMS" }, { name: "robots", content: "noindex" }],
  }),
  component: GuidePage,
});

/** Renders **Label** as a chip that looks like the on-screen button. */
function StepText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span
            key={i}
            className="mx-px inline-flex items-center rounded-md border bg-background px-1.5 py-0.5 text-[0.8125rem] font-medium text-foreground shadow-sm"
          >
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function HowToList({ items, idPrefix }: { items: HowTo[]; idPrefix: string }) {
  return (
    <Accordion type="multiple" className="rounded-xl border bg-card px-4">
      {items.map((h, i) => (
        <AccordionItem key={h.q} value={`${idPrefix}-${i}`} className="last:border-b-0">
          <AccordionTrigger className="text-base hover:no-underline">
            <span className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              {h.q}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <ol className="ml-10 space-y-2.5">
              {h.steps.map((step, n) => (
                <li key={n} className="flex gap-3 leading-relaxed text-muted-foreground">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[0.6875rem] font-semibold text-foreground">
                    {n + 1}
                  </span>
                  <span>
                    <StepText text={step} />
                  </span>
                </li>
              ))}
            </ol>
            {h.to && (
              <Link
                to={h.to}
                className="ml-10 mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Take me there <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof BookOpen;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4" /> {title}
      </h2>
      {children}
    </section>
  );
}

function RoleGuideView({ role }: { role: RoleGuide }) {
  const Icon = role.icon;
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 sm:flex-row sm:items-start">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
            role.accent,
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold">{role.title}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {role.intro}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {role.start.map((s) => (
              <Link
                key={s.to}
                to={s.to}
                className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm hover:border-primary/60 hover:text-primary"
              >
                {s.label} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      <Section icon={Sparkles} title="How do I…">
        <HowToList items={role.howTo} idPrefix={role.key} />
      </Section>

      {role.goodToKnow.length > 0 && (
        <Section icon={Lightbulb} title="Good to know">
          <ul className="space-y-2 rounded-xl border bg-card p-4 text-sm">
            {role.goodToKnow.map((tip) => (
              <li key={tip} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span className="text-muted-foreground">{tip}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function SharedHelp() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Section icon={BookOpen} title="For everyone">
        <HowToList items={EVERYONE_HOW_TO} idPrefix="everyone" />
      </Section>
      <Section icon={Lightbulb} title="Words you'll see">
        <dl className="divide-y rounded-xl border bg-card">
          {GLOSSARY.map((g) => (
            <div key={g.term} className="px-4 py-3">
              <dt className="text-sm font-medium">{g.term}</dt>
              <dd className="mt-0.5 text-sm text-muted-foreground">{g.meaning}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </div>
  );
}

function FlowBox({ children, tone }: { children: ReactNode; tone: string }) {
  return (
    <div className={cn("rounded-lg border px-3 py-2 text-center text-sm font-medium", tone)}>
      {children}
    </div>
  );
}

function SystemMap() {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div>
        <h2 className="font-semibold">How work moves through AMSOL</h2>
        <p className="text-sm text-muted-foreground">
          New work arrives two ways, becomes a project in a department, and is billed by Finance.
        </p>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="grid w-full max-w-3xl gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <FlowBox tone="bg-accent/10 text-accent">Marketing lead</FlowBox>
            <ArrowDown className="mx-auto h-4 w-4 text-muted-foreground" />
            <FlowBox tone="bg-accent/10 text-accent">Client request — Operations routes it</FlowBox>
          </div>
          <div className="space-y-2">
            <FlowBox tone="bg-destructive/10 text-destructive">Tender identified</FlowBox>
            <ArrowDown className="mx-auto h-4 w-4 text-muted-foreground" />
            <FlowBox tone="bg-destructive/10 text-destructive">
              Bid prepared, submitted and awarded
            </FlowBox>
          </div>
        </div>
        <ArrowDown className="h-4 w-4 text-muted-foreground" />
        <FlowBox tone="bg-primary/10 text-primary">
          Project in the delivering department — one-off or recurring, with its client and an
          optional contract
        </FlowBox>
        <ArrowDown className="h-4 w-4 text-muted-foreground" />
        <FlowBox tone="bg-success/10 text-success">
          Finance: invoices, payments, revenue and margin
        </FlowBox>
        <ArrowDown className="h-4 w-4 text-muted-foreground" />
        <FlowBox tone="bg-secondary text-secondary-foreground">
          Reports and the CEO dashboard
        </FlowBox>
      </div>
    </section>
  );
}

// Matches when every typed word appears somewhere in the question or steps.
function matches(h: HowTo, needle: string) {
  const text = (h.q + " " + h.steps.join(" ")).toLowerCase().replace(/\*\*/g, "");
  return needle
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.includes(word));
}

const SCOPE_TO_ROLE: Record<string, RoleKey> = {
  finance: "finance",
  hr: "hr",
  it: "it",
  marketing: "marketing",
  tender: "tender",
  operations: "operations",
};

function GuidePage() {
  const { role, q } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { roles, isAdminOrCeo, hasRole } = useAuth();
  const [query, setQuery] = useState(q ?? "");

  // Single-department users only see their own guide; admin/CEO can browse every role.
  const scope = isAdminOrCeo ? null : departmentScopeFor(roles);
  const scopedKey = scope
    ? SCOPE_TO_ROLE[scope]
    : !isAdminOrCeo && hasRole("water")
      ? "water"
      : null;
  const available = scopedKey ? ROLE_GUIDES.filter((r) => r.key === scopedKey) : ROLE_GUIDES;
  const selected = scopedKey ? available[0] : (ROLE_GUIDES.find((r) => r.key === role) ?? null);

  const needle = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!needle) return [];
    const found: { role: string; items: HowTo[] }[] = available
      .map((r) => ({ role: r.title, items: r.howTo.filter((h) => matches(h, needle)) }))
      .filter((g) => g.items.length > 0);
    const shared = EVERYONE_HOW_TO.filter((h) => matches(h, needle));
    if (shared.length) found.push({ role: "Everyone", items: shared });
    return found;
  }, [needle, available]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">How AIMS works</h1>
          <p className="text-sm text-muted-foreground">
            Short, step-by-step answers for everyday jobs, with a button to take you to the right
            screen.
          </p>
        </div>
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What do you want to do? e.g. add a contract"
            className="h-10 pl-9 text-base"
            aria-label="Search the guide"
          />
        </div>
      </div>

      {needle ? (
        results.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
            Nothing matches “{query}”. Try a simpler word, like “client”, “task” or “invoice”.
          </div>
        ) : (
          <div className="space-y-5">
            {results.map((g) => (
              <Section key={g.role} icon={Sparkles} title={g.role}>
                <HowToList items={g.items} idPrefix={`search-${g.role}`} />
              </Section>
            ))}
          </div>
        )
      ) : (
        <>
          {!scopedKey && (
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Choose a team">
              {ROLE_GUIDES.map((r) => {
                const Icon = r.icon;
                const active = r.key === selected?.key;
                return (
                  <button
                    key={r.key}
                    role="tab"
                    aria-selected={active}
                    onClick={() => navigate({ search: { role: r.key }, replace: true })}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      active ? "border-primary bg-primary/5" : "bg-card hover:border-primary/40",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-md",
                        r.accent,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    {r.title}
                  </button>
                );
              })}
            </div>
          )}

          {selected ? <RoleGuideView role={selected} /> : <SystemMap />}
          {!scopedKey && selected && (
            <button
              onClick={() => navigate({ search: {}, replace: true })}
              className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              ← Back to the overview
            </button>
          )}
          <SharedHelp />
        </>
      )}
    </div>
  );
}
