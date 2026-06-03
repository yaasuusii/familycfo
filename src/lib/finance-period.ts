/**
 * Pay-cycle financial period.
 *
 * The family's month is anchored to the salary date (default the 6th) rather
 * than the calendar 1st. Salary sometimes lands a few days early, so a grace
 * window pulls the cutoff back by `graceDays`. Periods tile without overlap:
 * the effective cutoff day is `startDay - graceDays`.
 *
 * Example: startDay = 6, graceDays = 5  ->  cutoff = 1st.
 *   A txn dated 2026-05-03 belongs to the period labelled "May" (the 6th's month).
 */

export interface FinancePeriod {
  /** inclusive ISO date (YYYY-MM-DD) */
  start: string;
  /** inclusive ISO date (YYYY-MM-DD) */
  end: string;
  /** human label, e.g. "May 2026" (month containing the nominal start day) */
  label: string;
}

export interface FinanceSettings {
  startDay: number; // day of month salary nominally arrives (1-28)
  graceDays: number; // how many days early salary may arrive
}

export const DEFAULT_FINANCE_SETTINGS: FinanceSettings = { startDay: 6, graceDays: 5 };

const STORAGE_KEY = "familycfo.financeSettings";

export function loadFinanceSettings(): FinanceSettings {
  if (typeof localStorage === "undefined") return DEFAULT_FINANCE_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FINANCE_SETTINGS;
    const parsed = JSON.parse(raw);
    const startDay = clampDay(parsed.startDay ?? DEFAULT_FINANCE_SETTINGS.startDay);
    const graceDays = Math.max(0, Math.min(startDay - 1, Number(parsed.graceDays ?? DEFAULT_FINANCE_SETTINGS.graceDays)));
    return { startDay, graceDays };
  } catch {
    return DEFAULT_FINANCE_SETTINGS;
  }
}

export function saveFinanceSettings(s: FinanceSettings) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function clampDay(d: number): number {
  return Math.max(1, Math.min(28, Math.round(Number(d) || DEFAULT_FINANCE_SETTINGS.startDay)));
}

function iso(y: number, m: number, d: number): string {
  // m is 0-based month
  const dt = new Date(Date.UTC(y, m, d));
  return dt.toISOString().slice(0, 10);
}

/**
 * Returns the financial period containing `ref` (default today).
 */
export function getFinancialPeriod(
  ref: Date = new Date(),
  settings: FinanceSettings = loadFinanceSettings(),
): FinancePeriod {
  const cutoff = clampDay(settings.startDay) - Math.max(0, settings.graceDays); // effective boundary day

  const y = ref.getFullYear();
  const m = ref.getMonth(); // 0-based
  const day = ref.getDate();

  // Period starts on `cutoff` of this month if we're at/after it, else previous month.
  let startY = y, startM = m;
  if (day < cutoff) {
    startM = m - 1;
    if (startM < 0) { startM = 11; startY = y - 1; }
  }

  // End = day before next period's cutoff.
  let endY = startY, endM = startM + 1;
  if (endM > 11) { endM = 0; endY = startY + 1; }

  const start = iso(startY, startM, cutoff);
  // end = day before next period's cutoff
  const endDate = new Date(Date.UTC(endY, endM, cutoff));
  endDate.setUTCDate(endDate.getUTCDate() - 1);
  const endIso = endDate.toISOString().slice(0, 10);

  // Label by the month containing the nominal start day (cutoff + grace == startDay).
  const labelDate = new Date(Date.UTC(startY, startM, settings.startDay));
  const label = labelDate.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  return { start, end: endIso, label };
}

export interface PeriodProjection {
  /** total days in the pay-cycle window */
  daysInMonth: number;
  /** elapsed days through today, clamped to [1, daysInMonth] */
  dayOfMonth: number;
  /** days left in the window */
  daysRemaining: number;
  /** average real spend per elapsed day */
  dailyRate: number;
  /** dailyRate extrapolated across the full window */
  projectedExpenses: number;
  /** (income + upcoming income) − (projected expenses + upcoming expenses) */
  projectedBalance: number;
}

/**
 * Single source of truth for end-of-period projection. Both Dashboard and
 * Forecasting must use this so their numbers can't drift. Day math runs over
 * the pay-cycle window (not the Ethiopian calendar month); upcoming recurring
 * income/expenses are folded into the projected balance.
 */
export function projectPeriod(
  period: FinancePeriod,
  totalIncome: number,
  totalExpenses: number,
  upcomingIncome = 0,
  upcomingExpenses = 0,
  ref: Date = new Date(),
): PeriodProjection {
  const MS_DAY = 86400000;
  const start = new Date(period.start + "T00:00:00Z");
  const end = new Date(period.end + "T00:00:00Z");
  const today = new Date(ref.toISOString().slice(0, 10) + "T00:00:00Z");

  const daysInMonth = Math.round((end.getTime() - start.getTime()) / MS_DAY) + 1;
  const dayOfMonth = Math.min(
    Math.max(Math.floor((today.getTime() - start.getTime()) / MS_DAY) + 1, 1),
    daysInMonth,
  );
  const daysRemaining = daysInMonth - dayOfMonth;

  const dailyRate = dayOfMonth > 0 ? totalExpenses / dayOfMonth : 0;
  const projectedExpenses = dailyRate * daysInMonth;
  const projectedBalance =
    totalIncome + upcomingIncome - (projectedExpenses + upcomingExpenses);

  return { daysInMonth, dayOfMonth, daysRemaining, dailyRate, projectedExpenses, projectedBalance };
}

/** Step `n` periods back (n>0) or forward (n<0) from the given period's start. */
export function shiftPeriod(period: FinancePeriod, n: number, settings: FinanceSettings = loadFinanceSettings()): FinancePeriod {
  const startDate = new Date(period.start + "T00:00:00Z");
  startDate.setUTCMonth(startDate.getUTCMonth() - n);
  return getFinancialPeriod(startDate, settings);
}
