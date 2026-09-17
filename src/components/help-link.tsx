import { Link } from "@tanstack/react-router";
import { CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";

/** A small "?" that opens the guide already searched for this topic. */
export function HelpLink({
  topic,
  label,
  className,
}: {
  /** Words to search the guide for, e.g. "recruitment service line". */
  topic: string;
  /** Visible text; omit for an icon-only link. */
  label?: string;
  className?: string;
}) {
  return (
    <Link
      to="/guide"
      search={{ q: topic }}
      className={cn(
        "inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary",
        className,
      )}
      aria-label={label ? undefined : `Help: ${topic}`}
      title={label ? undefined : "How this works"}
    >
      <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </Link>
  );
}

/** A plain hint shown at the point of action, with a link to the guide. */
export function ActionHint({
  children,
  topic,
  className,
}: {
  children: React.ReactNode;
  topic?: string;
  className?: string;
}) {
  return (
    <p
      className={cn("flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground", className)}
    >
      <span>{children}</span>
      {topic && <HelpLink topic={topic} label="How this works" />}
    </p>
  );
}
