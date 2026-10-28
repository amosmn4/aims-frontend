import { useMemo } from "react";
import {
  useLeads,
  type LeadRow,
  type LeadSource,
  type LeadStage,
} from "@/features/marketing/use-leads";

/** Stages where someone still has work to do on the lead. */
export const OPEN_STAGES: LeadStage[] = ["new", "contacted", "qualified", "nurturing"];

const monthKey = (iso: string) => iso.slice(0, 7);

const monthLabel = (key: string) =>
  new Date(`${key}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short" });

const monthsBack = (n: number) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** Everything the Marketing dashboard needs about leads, worked out once. */
export function useLeadInsights() {
  const query = useLeads();

  const data = useMemo(() => {
    const leads = query.data ?? [];
    const open = leads.filter((l) => OPEN_STAGES.includes(l.stage));
    const converted = leads.filter((l) => l.stage === "converted");
    const lost = leads.filter((l) => l.stage === "lost");
    const decided = converted.length + lost.length;

    const byStage = new Map<LeadStage, number>();
    for (const l of leads) byStage.set(l.stage, (byStage.get(l.stage) ?? 0) + 1);

    const bySource = new Map<LeadSource, number>();
    for (const l of leads) bySource.set(l.source, (bySource.get(l.source) ?? 0) + 1);

    const addedIn = (key: string) => leads.filter((l) => monthKey(l.created_at) === key).length;
    const monthly = Array.from({ length: 6 }, (_, i) => {
      const key = monthsBack(5 - i);
      return { month: monthLabel(key), added: addedIn(key) };
    });

    // A lead nobody has touched for two weeks is going cold.
    const coldBefore = new Date();
    coldBefore.setDate(coldBefore.getDate() - 14);
    const goingCold = open
      .filter((l) => l.updated_at < coldBefore.toISOString())
      .sort((a, b) => a.updated_at.localeCompare(b.updated_at));

    const newest = (a: LeadRow, b: LeadRow) => b.created_at.localeCompare(a.created_at);

    return {
      leads,
      open,
      converted,
      lost,
      byStage,
      bySource: Array.from(bySource.entries()).sort((a, b) => b[1] - a[1]),
      conversionRate: decided > 0 ? Math.round((converted.length / decided) * 100) : null,
      addedThisMonth: addedIn(monthsBack(0)),
      addedLastMonth: addedIn(monthsBack(1)),
      monthly,
      goingCold,
      recent: [...leads].sort(newest).slice(0, 5),
    };
  }, [query.data]);

  return { query, ...data };
}
