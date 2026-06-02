import { cn } from "@/lib/utils";
import { Money } from "./Money";
import type { LucideIcon } from "lucide-react";

interface ListRowProps {
  icon?: LucideIcon;
  /** Emblem tint colour (defaults to muted). */
  accent?: string;
  title: string;
  subtitle?: string;
  /** Money value rendered on the right with the editorial numeral. */
  amount?: number;
  /** Or free-form right-aligned value. */
  value?: string;
  /** Small caption under the amount (e.g. a date). */
  meta?: string;
  /** Colour the amount (e.g. income green / expense red). */
  amountColor?: string;
  /** Show a leading +/− sign on the amount. */
  sign?: "+" | "-";
  onClick?: () => void;
  className?: string;
}

/**
 * A rich editorial list row: circular emblem, title + subtitle, and a
 * right-aligned money figure with optional meta caption. Used for
 * transactions, recurring items, loans, meals.
 */
export function ListRow({
  icon: Icon,
  accent = "hsl(var(--muted-foreground))",
  title,
  subtitle,
  amount,
  value,
  meta,
  amountColor,
  sign,
  onClick,
  className,
}: ListRowProps) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "hover-surface flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
        onClick && "cursor-pointer",
        className
      )}
    >
      {Icon && (
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ background: `color-mix(in oklab, ${accent} 15%, transparent)` }}
        >
          <Icon className="h-4 w-4" style={{ color: accent }} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        {subtitle && (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <div className="shrink-0 text-right">
        {amount !== undefined ? (
          <span
            className="block text-sm font-semibold"
            style={amountColor ? { color: amountColor } : undefined}
          >
            {sign && <span className="mr-0.5">{sign}</span>}
            <Money amount={amount} />
          </span>
        ) : value ? (
          <span
            className="tnum block text-sm font-semibold text-foreground"
            style={amountColor ? { color: amountColor } : undefined}
          >
            {value}
          </span>
        ) : null}
        {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
      </div>
    </Comp>
  );
}
