import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, homeRouteFor } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { BarChart3, Wallet, Users, Cpu, Megaphone, FileText, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AIMS — AMSOL Management System" },
      {
        name: "description",
        content:
          "AIMS is Amsol's internal platform for documentation, project management, reporting and executive analytics across Finance, HR, IT, Marketing & Operations and Tender.",
      },
      { property: "og:title", content: "AIMS — AMSOL Management System" },
      {
        property: "og:description",
        content:
          "Unified platform for Amsol's departments with a real-time CEO executive dashboard.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { session, roles, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) navigate({ to: homeRouteFor(roles) });
  }, [loading, session, roles, navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-16 border-b bg-brand-navy-dark text-white">
        <div className="max-w-6xl mx-auto h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md bg-white p-1 flex items-center justify-center">
              <img src="/amsol-logo.png" alt="Amsol" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="font-semibold leading-tight">AIMS</div>
              <div className="text-[0.6875rem] text-white/70 leading-tight">
                AMSOL Management System
              </div>
            </div>
          </div>
          <Link to="/auth">
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">Sign in</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-brand-navy-dark text-white">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-block text-[0.6875rem] uppercase tracking-wider bg-accent text-accent-foreground px-2 py-1 rounded font-semibold">
              Version 1.0 · Confidential
            </div>
            <h1 className="mt-4 text-4xl md:text-5xl font-semibold leading-tight">
              One system for every Amsol department.
            </h1>
            <p className="mt-4 text-white/80 text-lg max-w-lg">
              Documentation, projects, tenders and finances unified — with a real-time CEO executive
              dashboard and decision-support built in.
            </p>
            <div className="mt-8 flex gap-3">
              <Link to="/auth">
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  Get started
                </Button>
              </Link>
            </div>
          </div>
          <div className="rounded-lg bg-white/5 border border-white/10 p-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                { icon: Wallet, label: "Finance" },
                { icon: Users, label: "Human Resources" },
                { icon: Cpu, label: "Information Technology" },
                { icon: Megaphone, label: "Marketing & Ops" },
                { icon: FileText, label: "Tender" },
                { icon: BarChart3, label: "CEO Dashboard" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="bg-primary/40 rounded-md p-4 flex items-center gap-3">
                  <Icon className="h-5 w-5 text-accent" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-semibold text-center">
          Built for how Amsol works today — and tomorrow
        </h2>
        <p className="mt-2 text-center text-muted-foreground max-w-2xl mx-auto">
          Nairobi HQ and every regional office, from tender to delivery to renewal.
        </p>
        <div className="mt-10 grid md:grid-cols-3 gap-6">
          {[
            {
              icon: BarChart3,
              title: "CEO Executive Dashboard",
              body: "Monthly revenue, MRR, pipeline, conversion, debtors and margins in one interactive view with drill-down and forecasting.",
            },
            {
              icon: FileText,
              title: "Tender → Delivery workflow",
              body: "Standardised tender lifecycle with automatic hand-off to Project Management and Finance on award.",
            },
            {
              icon: ShieldCheck,
              title: "Role-based access & audit",
              body: "Department- and role-based access control with full audit trail for governance and compliance.",
            },
          ].map((c) => (
            <div key={c.title} className="rounded-lg border bg-card p-6">
              <div className="h-10 w-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center mb-4">
                <c.icon className="h-5 w-5" />
              </div>
              <div className="font-semibold">{c.title}</div>
              <p className="mt-2 text-sm text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t bg-secondary/50">
        <div className="max-w-6xl mx-auto px-6 py-6 text-xs text-muted-foreground flex justify-between">
          <span>© Amsol — Africa Management Solutions Ltd</span>
          <span>Confidential · Internal Use Only</span>
        </div>
      </footer>
    </div>
  );
}
