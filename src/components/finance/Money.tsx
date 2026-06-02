import { cn } from "@/lib/utils";

interface MoneyProps {
  /** Numeric value in ETB. */
  amount: number;
  /** Currency prefix. Defaults to "ETB". Pass "" to hide. */
  prefix?: string;
  /** Render the decimal cents in a muted, lighter weight. Defaults to true. */
  cents?: boolean;
  /** Hide decimals entirely (rounds to whole birr). */
  hideCents?: boolean;
  className?: string;
}

/**
 * Editorial money numeral: big bold integer with quietly muted cents.
 *   ETB 22,250·00   →   "ETB 22,250" prominent + "00" faded
 * Always uses tabular-nums so columns of figures line up.
 */
export function Money({
  amount,
  prefix = "ETB",
  cents = true,
  hideCents = false,
  className,
}: MoneyProps) {
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const whole = Math.floor(abs);
  const frac = Math.round((abs - whole) * 100);

  const wholeStr = whole.toLocaleString("en-US");
  const fracStr = frac.toString().padStart(2, "0");

  return (
    <span className={cn("tnum inline-flex items-baseline", className)}>
      {negative && <span className="mr-0.5">−</span>}
      {prefix && (
        <span className="mr-1 text-[0.7em] font-medium tracking-wide opacity-70">
          {prefix}
        </span>
      )}
      <span className="font-semibold">{wholeStr}</span>
      {!hideCents && (
        <span className="cents">.{fracStr}</span>
      )}
    </span>
  );
}
