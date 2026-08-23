/**
 * Server-rendered single-series bar chart. One hue (identity is the chart
 * title, so no legend), thin marks with rounded data-ends anchored to the
 * baseline, recessive grid, native per-bar tooltips, selective direct labels
 * (peak value only).
 */
export interface Bar {
  label: string; // axis tick label ("" to skip the tick)
  tooltip: string;
  value: number;
}

const W = 560;
const H = 180;
const PAD = { top: 18, right: 8, bottom: 22, left: 8 };
const MARK = "#818cf8";
const GRID = "#27272a";
const INK_MUTED = "#71717a";

function roundedTopBar(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): string {
  const rr = Math.min(r, w / 2, h);
  return [
    `M ${x} ${y + h}`,
    `V ${y + rr}`,
    `Q ${x} ${y} ${x + rr} ${y}`,
    `H ${x + w - rr}`,
    `Q ${x + w} ${y} ${x + w} ${y + rr}`,
    `V ${y + h}`,
    "Z",
  ].join(" ");
}

export default function AdminBarChart({ bars }: { bars: Bar[] }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const gap = 2;
  const barW = Math.max(2, innerW / bars.length - gap);
  const peak = bars.reduce((best, b, i) => (b.value > bars[best].value ? i : best), 0);
  const baseline = PAD.top + innerH;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      className="w-full"
      aria-label="Bar chart"
    >
      {[0.5, 1].map((f) => (
        <line
          key={f}
          x1={PAD.left}
          x2={W - PAD.right}
          y1={PAD.top + innerH * (1 - f)}
          y2={PAD.top + innerH * (1 - f)}
          stroke={GRID}
          strokeWidth={1}
        />
      ))}
      {bars.map((b, i) => {
        const h = Math.max(b.value > 0 ? 3 : 0, (b.value / max) * innerH);
        const x = PAD.left + i * (innerW / bars.length) + gap / 2;
        return (
          <g key={i}>
            {h > 0 ? (
              <path
                d={roundedTopBar(x, baseline - h, barW, h, 4)}
                fill={MARK}
                opacity={0.85}
              />
            ) : null}
            {/* Oversized invisible hit target carrying the native tooltip */}
            <rect
              x={x - gap / 2}
              y={PAD.top}
              width={barW + gap}
              height={innerH}
              fill="transparent"
            >
              <title>{b.tooltip}</title>
            </rect>
            {i === peak && b.value > 0 ? (
              <text
                x={x + barW / 2}
                y={baseline - h - 6}
                textAnchor="middle"
                fontSize={11}
                fill="#d4d4d8"
              >
                {b.value.toLocaleString()}
              </text>
            ) : null}
            {b.label ? (
              <text
                x={x + barW / 2}
                y={H - 6}
                textAnchor="middle"
                fontSize={10}
                fill={INK_MUTED}
              >
                {b.label}
              </text>
            ) : null}
          </g>
        );
      })}
      <line
        x1={PAD.left}
        x2={W - PAD.right}
        y1={baseline}
        y2={baseline}
        stroke={GRID}
        strokeWidth={1}
      />
    </svg>
  );
}
