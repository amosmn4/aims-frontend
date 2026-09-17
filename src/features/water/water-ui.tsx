import type { ReactNode } from "react";
import { Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";

/** Plain-words meaning of each technical water term shown in the UI. */
export const WATER_TERMS = {
  nrw: {
    title: "Non-revenue water (NRW)",
    body: "Water that leaves the main meter but isn't paid for (leaks, theft, faulty meters).",
  },
  main: {
    title: "Main meter",
    body: "Measures water entering the network from the borehole.",
  },
  bulk: {
    title: "Bulk meter",
    body: "Measures water going into one zone.",
  },
  household: {
    title: "Household meter",
    body: "A customer's own meter.",
  },
  m3: {
    title: "m³",
    body: "Cubic metres. 1 m³ = 1,000 litres.",
  },
  units: {
    title: "Units",
    body: "m³ bought on a token.",
  },
  vending: {
    title: "Vending system",
    body: "The platform the meter's tokens are bought through (Amsol or mPaya).",
  },
} as const;

export type WaterTerm = keyof typeof WATER_TERMS;

/** A tap-friendly "i" that explains a water term in plain words. */
export function TermInfo({ term, className }: { term: WaterTerm; className?: string }) {
  const t = WATER_TERMS[term];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`What does "${t.title}" mean?`}
          className={cn(
            "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full align-middle text-muted-foreground hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 text-xs" side="top">
        <p className="font-semibold text-foreground">{t.title}</p>
        <p className="mt-1 text-muted-foreground">{t.body}</p>
      </PopoverContent>
    </Popover>
  );
}

/** Text followed by its term explanation, e.g. a label or column header. */
export function WithTerm({ term, children }: { term: WaterTerm; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {children}
      <TermInfo term={term} />
    </span>
  );
}

/** A hint line naming the terms used on a page, each with its explanation. */
export function TermsHint({ terms, className }: { terms: WaterTerm[]; className?: string }) {
  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground",
        className,
      )}
    >
      <span>What these mean:</span>
      {terms.map((term) => (
        <WithTerm key={term} term={term}>
          {WATER_TERMS[term].title}
        </WithTerm>
      ))}
    </p>
  );
}

/** Nothing recorded yet, with the button that adds the first one. */
export function ListEmpty({
  message,
  action,
  className,
}: {
  message: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 py-12 text-center text-sm text-muted-foreground",
        className,
      )}
    >
      <span>{message}</span>
      {action}
    </div>
  );
}

/** Filters hid everything: say so and offer to clear them. */
export function ListNoMatches({ onClear, className }: { onClear: () => void; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 py-12 text-center text-sm text-muted-foreground",
        className,
      )}
    >
      <span>No matches</span>
      <Button size="sm" variant="outline" onClick={onClear}>
        <X className="mr-1 h-4 w-4" /> Clear filters
      </Button>
    </div>
  );
}

/** "Sep 2026" from "2026-09", "6 Sep 2026" from "2026-09-06"; other values pass through. */
export function formatPeriodKey(key: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString("en-GB", {
      month: "short",
      year: "numeric",
    });
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? formatDate(key) : key;
}
