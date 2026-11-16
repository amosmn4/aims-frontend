import { Eye } from "lucide-react";
import { cn } from "@/production/lib/utils";
export function ViewOnlyBanner({
  area,
  action = "add or change things here",
  className,
}: {
  area: string;
  action?: string | undefined;
  className?: string | undefined;
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
