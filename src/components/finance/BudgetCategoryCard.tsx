import { cn } from "@/lib/utils";
import { Money } from "./Money";
import type { LucideIcon } from "lucide-react";

interface BudgetCategoryCardProps {
  category: string;
  spent: number;
  limit: number;
  icon?: LucideIcon;
  /** Optional accent colour for the circular emblem (defaults to category hue). */
  accent?: string;
  className?: string;
}

function statusColor(pct: number): string {
  if (pct >= 100) return "hsl(var(--destructive))";
  if (pct >= 80) return "hsl(var(--warning))";
  return "hsl(var(--success))";
}

/**
 * Dribbble-inspired budget card: a circular emblem (the "image circle"),
 * the category, an editorial spent/limit numeral, and a coloured progress
 * arc that turns amber → red as the budget is consumed.
 */
export function BudgetCategoryCard({
  category,
  spent,
  limit,
  icon: Icon,
  accent,
  className,
}: BudgetCategoryCardProps) {
  const pct = limit > 0 ? (spent / limit) * 100 : 0;
  const clamped = Math.min(pct, 100);
  const remaining = limit - spent;
  const color = statusColor(pct);
  const emblem = accent ?? "hsl(var(--primary))";

  return (
    <div
      className={cn(
        "card-soft lift flex flex-col gap-3 p-4",
        className
      )}
    >
      <div className="flex items-center gap-3">
        {/* circular emblem */}
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          style={{ background: `color-mix(in oklab, ${emblem} 16%, transparent)` }}
        >
          {Icon ? (
            <Icon className="h-5 w-5" style={{ color: emblem }} />
          ) : (
            <span className="font-display text-base font-semibold" style={{ color: emblem }}>
              {category.charAt(0)}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-semibold text-foreground">
            {category}
          </p>
          <p className="text-xs text-muted-foreground">
            {remaining >= 0 ? (
              <><Money amount={remaining} hideCents className="text-xs" /> left</>
            ) : (
              <span style={{ color }}>
                <Money amount={Math.abs(remaining)} hideCents className="text-xs" /> over
              </span>
            )}
          </p>
        </div>
        <span
          className="tnum shrink-0 text-sm font-semibold"
          style={{ color }}
        >
          {Math.round(pct)}%
        </span>
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <Money amount={spent} className="text-base text-foreground" />
          <span className="tnum text-xs text-muted-foreground">
            / <Money amount={limit} prefix="" hideCents className="text-xs" />
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-out"
            style={{ width: `${clamped}%`, background: color }}
          />
        </div>
      </div>
    </div>
  );
}
