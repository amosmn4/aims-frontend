import type { PipelineStageDef } from "@/features/pipeline/pipeline-theme";

interface SpineProps {
  stages: PipelineStageDef[];
  counts: Record<string, number>;
}

// The prototype's signature element: a dotted horizontal line with a count-in-circle per
// stage. A live read of how many cards sit in each column — a cleaner flow diagram than
// drawing arrows between boxes.
export function Spine({ stages, counts }: SpineProps) {
  const w = 1000;
  const pad = 60;
  const n = stages.length;
  const gap = n > 1 ? (w - pad * 2) / (n - 1) : 0;

  return (
    <div className="spine-wrap">
      <div
        style={{
          fontFamily: "var(--pipeline-font-mono)",
          fontSize: 10.5,
          letterSpacing: 1,
          textTransform: "uppercase",
          color: "#8B93A0",
          marginBottom: 10,
        }}
      >
        Stage flow
      </div>
      <svg viewBox={`0 0 ${w} 60`} style={{ width: "100%", display: "block" }}>
        <line
          x1={pad}
          y1={26}
          x2={w - pad}
          y2={26}
          stroke="#D8DCD3"
          strokeWidth={2}
          strokeDasharray="1 7"
          strokeLinecap="round"
        />
        {stages.map((s, i) => {
          const x = pad + gap * i;
          const count = counts[s.key] ?? 0;
          return (
            <g key={s.key}>
              <circle cx={x} cy={26} r={11} fill="#fff" stroke={s.color} strokeWidth={2.5} />
              <text
                x={x}
                y={30}
                textAnchor="middle"
                fill={s.color}
                style={{ fontFamily: "var(--pipeline-font-mono)", fontSize: 15, fontWeight: 500 }}
              >
                {count}
              </text>
              <text
                x={x}
                y={52}
                textAnchor="middle"
                fill="#16233F"
                style={{ fontFamily: "var(--pipeline-font-body)", fontSize: 11.5, fontWeight: 600 }}
              >
                {s.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
