import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";

/** Tells someone why they see no add or edit buttons on a page they can only view. */
export function ViewOnlyBanner({
  area,
  action = "add or change things here",
  className,
}: {
  /** What they're viewing, e.g. "Finance". */
  area: string;
  action?: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground",
        className,
      )}
    >
      <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
      You can view {area} but not {action}. Ask the CEO if you need to.
    </p>
  );
}
