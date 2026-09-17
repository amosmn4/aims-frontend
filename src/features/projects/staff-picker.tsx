import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { useProfilesLite } from "@/features/clients/use-clients-contracts";
import { useAuth } from "@/lib/auth";
import { LoadError } from "@/components/load-error";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const NOBODY = "__nobody";

export type StaffOption = { id: string; name: string; email: string };

/** Active staff sorted by name, with the viewer listed first. */
export function useStaffOptions() {
  const profilesQ = useProfilesLite();
  const { profile } = useAuth();
  const meId = profile?.id;
  const options = useMemo(() => {
    const list: StaffOption[] = (profilesQ.data ?? [])
      .map((p) => ({ id: p.id, name: p.full_name ?? p.email, email: p.email }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const me = list.find((p) => p.id === meId);
    return me ? [me, ...list.filter((p) => p !== me)] : list;
  }, [profilesQ.data, meId]);
  const nameOf = (id: string | null | undefined) =>
    id ? (options.find((p) => p.id === id)?.name ?? null) : null;
  return { options, meId, nameOf, query: profilesQ };
}

/** Dropdown of staff for "Assign to"; an empty value means nobody. */
export function StaffSelect({
  id,
  value,
  onChange,
  emptyLabel = "Not assigned",
  placeholder,
  className,
  ariaLabel,
  disabled,
}: {
  id?: string;
  value: string;
  onChange: (id: string) => void;
  emptyLabel?: string;
  /** Shown instead of emptyLabel while nobody is picked. */
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const { options, meId } = useStaffOptions();
  return (
    <Select
      value={value || (placeholder ? "" : NOBODY)}
      onValueChange={(v) => onChange(v === NOBODY ? "" : v)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={className} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder ?? emptyLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NOBODY}>{emptyLabel}</SelectItem>
        {options.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.id === meId ? `Me (${p.name})` : p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Search-by-name list of staff accounts; picks one. */
export function StaffSearchList({
  id,
  value,
  onChange,
  excludeIds,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (id: string) => void;
  excludeIds?: Set<string>;
  invalid?: boolean;
}) {
  const { options, meId, query } = useStaffOptions();
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const available = options.filter((p) => !excludeIds?.has(p.id));
  const matches = available.filter(
    (p) =>
      !needle || p.name.toLowerCase().includes(needle) || p.email.toLowerCase().includes(needle),
  );

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id={id}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search staff by name"
          className="pl-8"
          aria-invalid={invalid}
        />
      </div>
      {query.isError ? (
        <LoadError what="staff" error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <div
          role="listbox"
          aria-label="Staff accounts"
          className="max-h-52 overflow-y-auto rounded-md border"
        >
          {query.isLoading ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">Loading staff…</p>
          ) : matches.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              {available.length === 0
                ? "Everyone with an AIMS account is already on this team."
                : `No staff match "${q.trim()}".`}
            </p>
          ) : (
            matches.map((p) => {
              const selected = value === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => onChange(p.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-sm last:border-0",
                    selected ? "bg-primary/10" : "hover:bg-secondary/60",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {p.id === meId ? `Me (${p.name})` : p.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{p.email}</span>
                  </span>
                  {selected && (
                    <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
