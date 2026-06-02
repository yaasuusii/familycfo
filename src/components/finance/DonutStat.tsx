import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

export interface DonutSlice {
  name: string;
  value: number;
  color?: string;
}

interface DonutStatProps {
  data: DonutSlice[];
  /** Big centre value (already formatted). */
  centerValue?: string;
  centerLabel?: string;
  size?: number;
  thickness?: number;
  /** Show the legend list to the right / below. */
  showLegend?: boolean;
  formatValue?: (v: number) => string;
  className?: string;
}

const PALETTE = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6))",
];

/**
 * Donut with a centred editorial stat and an optional readable legend.
 * Uses the warm chart palette tokens.
 */
export function DonutStat({
  data,
  centerValue,
  centerLabel,
  size = 180,
  thickness = 22,
  showLegend = true,
  formatValue,
  className,
}: DonutStatProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const outer = size / 2;
  const inner = outer - thickness;

  return (
    <div className={cn("flex flex-col items-center gap-4 sm:flex-row sm:items-center", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={inner}
              outerRadius={outer}
              paddingAngle={data.length > 1 ? 2 : 0}
              stroke="none"
              startAngle={90}
              endAngle={-270}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.color ?? PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {(centerValue || centerLabel) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {centerValue && (
              <span className="font-display text-xl font-semibold tabular-nums tracking-tight text-foreground">
                {centerValue}
              </span>
            )}
            {centerLabel && (
              <span className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {centerLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {showLegend && (
        <ul className="w-full space-y-1.5">
          {data.map((d, i) => {
            const pct = total > 0 ? (d.value / total) * 100 : 0;
            return (
              <li key={d.name} className="flex items-center gap-2 text-sm">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: d.color ?? PALETTE[i % PALETTE.length] }}
                />
                <span className="flex-1 truncate text-foreground">{d.name}</span>
                <span className="tnum text-muted-foreground">
                  {formatValue ? formatValue(d.value) : `${pct.toFixed(0)}%`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
