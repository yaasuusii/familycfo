import { cn } from "@/lib/utils";

interface RadialGaugeProps {
  /** 0–100 (values above 100 clamp the arc but recolour to "over"). */
  value: number;
  /** Big centre label, e.g. "78%". Defaults to rounded value%. */
  centerLabel?: string;
  /** Small caption under the centre label. */
  caption?: string;
  size?: number;
  stroke?: number;
  className?: string;
}

function colorFor(pct: number): string {
  if (pct >= 100) return "hsl(var(--destructive))";
  if (pct >= 80) return "hsl(var(--warning))";
  return "hsl(var(--success))";
}

/**
 * Editorial ring gauge. A thick rounded arc that fills clockwise and
 * recolours by financial health (green → amber → red).
 */
export function RadialGauge({
  value,
  centerLabel,
  caption,
  size = 132,
  stroke = 12,
  className,
}: RadialGaugeProps) {
  const clamped = Math.max(0, Math.min(value, 100));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  const color = colorFor(value);

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(0.2,0.7,0.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-semibold tabular-nums tracking-tight text-foreground">
          {centerLabel ?? `${Math.round(value)}%`}
        </span>
        {caption && (
          <span className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {caption}
          </span>
        )}
      </div>
    </div>
  );
}
