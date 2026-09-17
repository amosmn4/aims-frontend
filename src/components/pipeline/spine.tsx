import type { PipelineStageDef } from "@/features/pipeline/pipeline-theme";

interface SpineProps {
  stages: PipelineStageDef[];
  counts: Record<string, number>;
}

// A dotted line with a count per stage; every colour is paired with its stage name.
export function Spine({ stages, counts }: SpineProps) {
  return (
    <div className="spine-wrap">
      <div
        className="p-mono mb-2.5 text-xs uppercase tracking-wide"
        style={{ color: "var(--pipeline-slate-light)" }}
      >
        Stage flow
      </div>
      <div className="overflow-x-auto">
        <ol className="relative flex min-w-max gap-2 sm:min-w-0">
          <li
            aria-hidden="true"
            className="pointer-events-none absolute left-11 right-11 top-[13px] border-t-2 border-dotted"
            style={{ borderColor: "#C9CDC1" }}
          />
          {stages.map((s) => {
            const count = counts[s.key] ?? 0;
            return (
              <li
                key={s.key}
                className="relative flex min-w-[88px] flex-1 flex-col items-center gap-1.5 text-center"
              >
                <span
                  aria-hidden="true"
                  className="p-mono flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-medium"
                  style={{ border: `2.5px solid ${s.color}`, color: s.color }}
                >
                  {count}
                </span>
                <span
                  aria-hidden="true"
                  className="text-xs font-semibold leading-tight"
                  style={{ color: "var(--pipeline-ink, #16233F)" }}
                >
                  {s.label}
                </span>
                <span className="sr-only">
                  {s.label}: {count}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
