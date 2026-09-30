import type { ComponentType, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { StatTile, type StatTone } from "@/features/finance/stat-tile";

/** A headline number that opens the page holding the detail behind it. */
export function StatLink({
  to,
  search,
  label,
  value,
  hint,
  tone,
  icon,
  emptyText,
}: {
  to: string;
  search?: Record<string, string | number | boolean>;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: StatTone;
  icon?: ComponentType<{ className?: string }>;
  emptyText?: string;
}) {
  return (
    <Link
      to={to}
      search={search}
      className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <StatTile
        label={label}
        value={value}
        hint={hint}
        tone={tone}
        icon={icon}
        emptyText={emptyText}
        className="h-full transition-colors group-hover:border-primary/50"
      />
    </Link>
  );
}
