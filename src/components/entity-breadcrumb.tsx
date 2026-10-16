import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbSegment {
  label: string;
  /** A fully-built path, e.g. `/tender/${id}`. Omit for the current page (not a link). */
  to?: string;
}

// Shows the real chain leading to this record (e.g. Tenders / T-118 / "Acme Rollout"),
// not just the immediate parent — replaces the old ad-hoc "<- Back to X" links on the same
// pages RelatedRecords is wired into, since both draw from the same relationship data.
export function EntityBreadcrumb({ segments }: { segments: BreadcrumbSegment[] }) {
  if (segments.length === 0) return null;
  return (
    <nav className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
      {segments.map((s, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
          {s.to ? (
            <Link to={s.to} className="hover:text-foreground hover:underline">
              {s.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium">{s.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
