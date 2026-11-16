import type { ReactNode } from "react";
import { cn } from "@/production/lib/utils";
export function SectionHeading({
  children,
  action,
  className,
  id,
}: {
  children: ReactNode;
  action?: ReactNode | undefined;
  className?: string | undefined;
  id?: string | undefined;
}) {
  return (
    <div className={cn("mb-2 flex items-center justify-between gap-2", className)}>
      <h2 id={id} className="text-sm font-semibold text-foreground">
        {children}
      </h2>
      {action}
    </div>
  );
}
