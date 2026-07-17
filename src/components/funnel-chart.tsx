import { useState } from "react";

export interface FunnelStage {
  stage: string;
  value: number;
  color: string;
}

interface FunnelChartProps {
  stages: FunnelStage[];
  formatValue: (v: number) => string;
  /** When set, the hover panel also shows an estimated "impact" value for stages before the last, using this win-rate. */
  winRate?: number;
}

export function FunnelChart({ stages, formatValue, winRate }: FunnelChartProps) {
  const [hoverStage, setHoverStage] = useState<number | null>(null);

  const funnel = stages.map((f, i) => {
    const prev = i === 0 ? f.value : stages[i - 1].value;
    const conversion = prev > 0 ? (f.value / prev) * 100 : 0;
    const impact =
      winRate == null
        ? undefined
        : i === stages.length - 1
          ? f.value
          : Math.round(f.value * winRate);
    return { ...f, conversion, impact };
  });
  // Stage counts aren't guaranteed to be monotonically decreasing (e.g. more tenders can be
  // "Submitted" right now than are "In Progress"), so the bar width has to scale against the
  // true max across all stages — scaling against just the first stage let later, larger bars
  // overflow past 100% width and spill out of the container.
  const funnelMax = Math.max(...funnel.map((f) => f.value), 1);
  const overallConversion =
    funnel[0]?.value > 0 ? (funnel[funnel.length - 1].value / funnel[0].value) * 100 : 0;
  const active = hoverStage !== null ? funnel[hoverStage] : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2 text-[0.625rem] text-muted-foreground">
        <span>Hover a stage for details</span>
        <span>Conv. {overallConversion.toFixed(0)}%</span>
      </div>
      <div className="relative flex flex-col items-center gap-1.5 py-1">
        {funnel.map((f, i) => {
          const widthPct = 40 + (f.value / funnelMax) * 60;
          const isHover = hoverStage === i;
          return (
            <div key={f.stage} className="w-full flex flex-col items-center">
              <div
                role="button"
                tabIndex={0}
                aria-label={`${f.stage}: ${formatValue(f.value)}, conversion ${f.conversion.toFixed(0)}%`}
                onMouseEnter={() => setHoverStage(i)}
                onMouseLeave={() => setHoverStage((s) => (s === i ? null : s))}
                onFocus={() => setHoverStage(i)}
                onBlur={() => setHoverStage(null)}
                className="text-white text-[0.625rem] font-medium flex flex-col items-center justify-center gap-0.5 rounded-sm transition-all cursor-pointer px-2 mx-auto"
                style={{
                  width: `${widthPct}%`,
                  height: 40,
                  backgroundColor: f.color,
                  opacity: hoverStage === null || isHover ? 1 : 0.55,
                  transform: isHover ? "scale(1.03)" : "scale(1)",
                  clipPath:
                    i < funnel.length - 1
                      ? "polygon(0 0, 100% 0, 97% 100%, 3% 100%)"
                      : "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
                }}
              >
                <span className="leading-none truncate max-w-full">{f.stage}</span>
                <span className="tabular-nums font-semibold leading-none truncate max-w-full">
                  {formatValue(f.value)}
                </span>
              </div>
              {i < funnel.length - 1 && (
                <div className="text-[0.5625rem] text-muted-foreground tabular-nums mt-0.5">
                  ↓ {funnel[i + 1].conversion.toFixed(0)}% to {funnel[i + 1].stage}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {active && (
        <div className="mt-2 rounded border bg-secondary/50 px-2 py-1.5 text-[0.625rem] space-y-0.5">
          <div className="font-semibold text-foreground">{active.stage}</div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Value</span>
            <span className="tabular-nums">{formatValue(active.value)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Stage conversion</span>
            <span className="tabular-nums">{active.conversion.toFixed(1)}%</span>
          </div>
          {winRate != null && active.impact != null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Est. impact</span>
              <span className="tabular-nums text-success font-semibold">
                {formatValue(active.impact)}
              </span>
            </div>
          )}
          {winRate != null && hoverStage! < funnel.length - 1 && (
            <div className="text-muted-foreground pt-0.5 border-t border-border/50">
              Advancing all {active.stage.toLowerCase()} at {(winRate * 100).toFixed(0)}% win-rate ≈{" "}
              {formatValue(Math.round(active.value * winRate))} won.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
