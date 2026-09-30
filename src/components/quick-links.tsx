import type { ComponentType } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SectionHeading } from "@/components/section-heading";
import { cn } from "@/lib/utils";

export interface QuickLink {
  to: string;
  search?: Record<string, string | number | boolean>;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}

/** The pages a department opens most, as one row of labelled shortcuts. */
export function QuickLinks({
  links,
  title = "Quick links",
  className,
}: {
  links: QuickLink[];
  title?: string;
  className?: string;
}) {
  if (links.length === 0) return null;
  return (
    <section aria-labelledby="quick-links-heading" className={className}>
      <SectionHeading id="quick-links-heading">{title}</SectionHeading>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {links.map((link) => (
          <QuickLinkTile key={`${link.to}-${link.label}`} {...link} />
        ))}
      </div>
    </section>
  );
}

function QuickLinkTile({ to, search, label, description, icon: Icon }: QuickLink) {
  return (
    <Link
      to={to}
      search={search}
      className={cn(
        "group flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors",
        "hover:border-primary/50 hover:bg-accent/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-primary"
        aria-hidden="true"
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-sm font-medium text-foreground">
          <span className="truncate">{label}</span>
          <ArrowRight
            className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
            aria-hidden="true"
          />
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
          {description}
        </span>
      </span>
    </Link>
  );
}
