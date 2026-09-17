import type { ReactNode } from "react";
import { useCompanySettings } from "@/features/settings/use-company-settings";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { formatCurrency } from "./finance";

export type CurrencyTotals = Map<string, number>;

/** The company's default currency from Company settings. */
export function useCompanyCurrency() {
  const settingsQ = useCompanySettings();
  return settingsQ.data?.currencyCode || "KES";
}

/** Who may act in Finance: raise invoices, or add and edit other Finance records. */
export function useFinanceAccess() {
  const { hasCapability, canWriteDepartment } = useAuth();
  return {
    canRaiseInvoices: hasCapability("raise_invoices"),
    canWrite: canWriteDepartment("finance"),
  };
}

/** Adds amounts into one bucket per currency, so KES and USD are never summed together. */
export function totalsByCurrency<T>(
  items: T[],
  currencyOf: (item: T) => string,
  amountOf: (item: T) => number,
): CurrencyTotals {
  const totals = new Map<string, number>();
  for (const item of items) {
    const code = currencyOf(item) || "";
    totals.set(code, (totals.get(code) ?? 0) + amountOf(item));
  }
  return totals;
}

function sortedEntries(totals: CurrencyTotals, companyCurrency: string) {
  return Array.from(totals.entries())
    .filter(([, v]) => Math.abs(v) > 0.005)
    .sort(([a], [b]) =>
      a === companyCurrency ? -1 : b === companyCurrency ? 1 : a.localeCompare(b),
    );
}

/** "KES 120,000 · USD 3,000" for plain-text places like confirm dialogs. */
export function formatTotals(totals: CurrencyTotals, companyCurrency: string) {
  const entries = sortedEntries(totals, companyCurrency);
  if (entries.length === 0) return formatCurrency(0, companyCurrency);
  return entries.map(([c, v]) => formatCurrency(v, c)).join(" · ");
}

/** Shows a total with one line per currency. */
export function MoneyTotal({
  totals,
  companyCurrency,
  className,
}: {
  totals: CurrencyTotals;
  companyCurrency: string;
  className?: string;
}) {
  const entries = sortedEntries(totals, companyCurrency);
  if (entries.length <= 1) {
    const [code, value] = entries[0] ?? [companyCurrency, 0];
    return <span className={className}>{formatCurrency(value, code)}</span>;
  }
  return (
    <span className={cn("flex flex-col", className)}>
      {entries.map(([code, value]) => (
        <span key={code}>{formatCurrency(value, code)}</span>
      ))}
    </span>
  );
}

/** Splits records into those in the company currency and a count of the rest. */
export function splitByCurrency<T>(
  items: T[],
  currencyOf: (item: T) => string,
  companyCurrency: string,
) {
  const inCompany: T[] = [];
  const otherCodes = new Set<string>();
  let otherCount = 0;
  for (const item of items) {
    if ((currencyOf(item) || companyCurrency) === companyCurrency) inCompany.push(item);
    else {
      otherCount += 1;
      otherCodes.add(currencyOf(item));
    }
  }
  return { inCompany, otherCount, otherCodes: Array.from(otherCodes).sort() };
}

/** Says a figure is in the company currency and what was left out. */
export function CurrencyNote({
  companyCurrency,
  otherCount,
  otherCodes,
  what = "invoice",
  className,
}: {
  companyCurrency: string;
  otherCount: number;
  otherCodes: string[];
  what?: string;
  className?: string;
}) {
  let text: ReactNode = `Amounts in ${companyCurrency}.`;
  if (otherCount > 0) {
    const noun = otherCount === 1 ? what : `${what}s`;
    text = `Amounts in ${companyCurrency}. ${otherCount} ${noun} in ${otherCodes.join(", ")} ${
      otherCount === 1 ? "isn't" : "aren't"
    } included.`;
  }
  return <p className={cn("text-xs text-muted-foreground", className)}>{text}</p>;
}
