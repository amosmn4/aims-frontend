import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The small label that names a block of a dashboard, e.g. "At a glance". */
export function SectionHeading({
  children,
  action,
  className,
  id,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div className={cn("mb-2 flex items-center justify-between gap-2", className)}>
      <h2 id={id} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {children}
      </h2>
      {action}
    </div>
  );
}
