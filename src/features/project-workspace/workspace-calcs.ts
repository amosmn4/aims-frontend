// Percent-complete, EVM (PV/EV/AC/SPI/CPI) and days-left are deliberately computed here from
// real fetched data (Task hours, Project.budget, cost items) rather than via a dedicated
// backend endpoint — mirrors amsol_project_workspace.html's own client-side approach and avoids
// overbuilding backend surface for pure derived math.
import type { Task } from "@/features/projects/use-projects";
import { daysBetween } from "@/features/project-workspace/workspace-theme";

export function computePercentComplete(tasks: Task[]): number {
  const totalEst = tasks.reduce((a, t) => a + (t.estimated_hours ?? 0), 0);
  if (totalEst === 0) return 0;
  const doneEst = tasks.reduce((a, t) => {
    const est = t.estimated_hours ?? 0;
    if (t.status === "completed") return a + est;
    if (t.status === "in_progress" || t.status === "review") {
      const frac = est > 0 ? Math.min(1, t.actual_hours / est) : 0;
      return a + est * frac;
    }
    return a;
  }, 0);
  return Math.min(100, Math.round((doneEst / totalEst) * 100));
}

export interface EvmSnapshot {
  pv: number;
  ev: number;
  ac: number;
  spi: number;
  cpi: number;
}

export function computeEvm(opts: {
  budget: number;
  startDate: string | null;
  endDate: string | null;
  percentComplete: number;
  actualCost: number;
}): EvmSnapshot {
  const { budget, startDate, endDate, percentComplete, actualCost } = opts;
  let elapsedFrac = 0;
  if (startDate && endDate) {
    const total = daysBetween(startDate, endDate);
    elapsedFrac = total > 0 ? Math.max(0, Math.min(1, daysBetween(startDate, new Date()) / total)) : 0;
  }
  const pv = budget * elapsedFrac;
  const ev = (budget * percentComplete) / 100;
  const ac = actualCost;
  return {
    pv,
    ev,
    ac,
    spi: pv > 0 ? ev / pv : 0,
    cpi: ac > 0 ? ev / ac : 0,
  };
}

export function daysLeft(endDate: string | null): number | null {
  if (!endDate) return null;
  const d = daysBetween(new Date(), endDate);
  return d;
}
