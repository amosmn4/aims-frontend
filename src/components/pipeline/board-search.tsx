import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

/** Search box shown above a pipeline board; filtering happens in the parent. */
export function BoardSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative mb-3 w-full max-w-sm">
      <Search
        className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-8 pr-8"
        aria-label={placeholder}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** Shown in place of a board when a search matches nothing. */
export function BoardNoMatches({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center">
      <p className="text-sm font-medium">No matches</p>
      <p className="text-xs text-muted-foreground">Nothing on this board matches your search.</p>
      <button
        type="button"
        onClick={onClear}
        className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
      >
        Clear search
      </button>
    </div>
  );
}

/** Case-insensitive match of a query against any of the given fields. */
export function matchesQuery(query: string, ...fields: (string | null | undefined)[]) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((f) => (f ?? "").toLowerCase().includes(needle));
}
