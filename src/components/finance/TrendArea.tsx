import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";

interface TrendAreaProps {
  data: Array<Record<string, any>>;
  /** Key for the x-axis category (e.g. "date"). */
  xKey: string;
  /** Key for the plotted value (e.g. "amount"). */
  yKey: string;
  height?: number;
  /** Stroke / fill colour. Defaults to terracotta accent. */
  color?: string;
  formatValue?: (v: number) => string;
  className?: string;
}

/**
 * Gradient-filled area chart with a vertical crosshair tooltip — the
 * Warm Editorial trend visual. Soft grid, muted axes, accent gradient.
 */
export function TrendArea({
  data,
  xKey,
  yKey,
  height = 240,
  color = "hsl(var(--chart-1))",
  formatValue,
  className,
}: TrendAreaProps) {
  const gradId = `trend-${yKey}-${Math.round(Math.random() * 1e6)}`;

  return (
    <div className={cn("w-full", className)}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.34} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="hsl(var(--border))"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            dy={6}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v) => (formatValue ? formatValue(v) : String(v))}
          />
          <Tooltip
            cursor={{ stroke: color, strokeWidth: 1.5, strokeDasharray: "4 4" }}
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.75rem",
              boxShadow: "var(--shadow-lift)",
              fontSize: 12,
              color: "hsl(var(--popover-foreground))",
            }}
            labelStyle={{ color: "hsl(var(--muted-foreground))", fontWeight: 600 }}
            formatter={(v: number) => [formatValue ? formatValue(v) : v, ""]}
          />
          <Area
            type="monotone"
            dataKey={yKey}
            stroke={color}
            strokeWidth={2.5}
            fill={`url(#${gradId})`}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
