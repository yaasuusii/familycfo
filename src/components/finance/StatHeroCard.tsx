import { cn } from "@/lib/utils";
import { Money } from "./Money";
import type { LucideIcon } from "lucide-react";

export type HeroState = "good" | "warn" | "bad" | "brand";

const stateClass: Record<HeroState, string> = {
  good: "hero-good",
  warn: "hero-warn",
  bad: "hero-bad",
  brand: "hero-brand",
};

interface StatHeroCardProps {
  /** Drives the gradient: green / amber / red / terracotta. */
  state: HeroState;
  label: string;
  /** Numeric money value — rendered with the editorial Money numeral. */
  amount?: number;
  /** Or a free-form value (percent, count) when not money. */
  value?: string;
  subtitle?: string;
  icon?: LucideIcon;
  /** Optional small footer (e.g. a progress hint). */
  footer?: React.ReactNode;
  className?: string;
}

/**
 * The signature status hero. A bold gradient panel whose colour reflects
 * financial health. Big editorial numeral, decorative circular glow,
 * floating icon. Used for Safe-to-Spend, Budget health, Net position.
 */
export function StatHeroCard({
  state,
  label,
  amount,
  value,
  subtitle,
  icon: Icon,
  footer,
  className,
}: StatHeroCardProps) {
  return (
    <div
      className={cn(
        stateClass[state],
        "lift relative overflow-hidden rounded-2xl p-5 shadow-[var(--shadow-lift)]",
        className
      )}
    >
      {/* decorative circular glow */}
      <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/15 blur-xl" />
      <div className="pointer-events-none absolute -bottom-12 -right-2 h-28 w-28 rounded-full border border-white/20" />

      <div className="relative flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
          {label}
        </p>
        {Icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
            <Icon className="h-5 w-5 text-white" />
          </div>
        )}
      </div>

      <div className="relative mt-3 font-display text-[2rem] leading-none tracking-tight text-white">
        {amount !== undefined ? (
          <Money amount={amount} />
        ) : (
          <span className="tnum font-semibold">{value}</span>
        )}
      </div>

      {subtitle && (
        <p className="relative mt-2 text-sm text-white/80">{subtitle}</p>
      )}

      {footer && <div className="relative mt-3">{footer}</div>}
    </div>
  );
}
