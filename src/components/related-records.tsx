import { Link } from "@tanstack/react-router";

export interface RelatedRecordItem {
  /** The relationship, e.g. "Source Lead", "Converted Contract". */
  label: string;
  /** The related record's display name. */
  title: string;
  /** A fully-built path, e.g. `/projects/${id}`. */
  to: string;
}

// A small, reusable "related records" panel — the same shape reused on every record detail
// page that sits somewhere in the Lead -> Client Request -> Tender/Project -> Contract chain,
// so a user can always see and jump to whatever this record is connected to without hunting
// through the right department's nav tree first.
export function RelatedRecords({ items, engagementTo }: { items: RelatedRecordItem[]; engagementTo?: string }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold">Related</div>
        {items.length > 1 && engagementTo && (
          <Link to={engagementTo} className="text-xs text-primary hover:underline">
            View full engagement timeline →
          </Link>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex flex-col rounded-md border px-2.5 py-1.5 text-xs hover:border-primary/50 hover:bg-secondary/40 transition-colors"
          >
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{item.label}</span>
            <span className="font-medium">{item.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
