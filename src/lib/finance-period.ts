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

/** Step `n` periods back (n>0) or forward (n<0) from the given period's start. */
export function shiftPeriod(period: FinancePeriod, n: number, settings: FinanceSettings = loadFinanceSettings()): FinancePeriod {
  const startDate = new Date(period.start + "T00:00:00Z");
  startDate.setUTCMonth(startDate.getUTCMonth() - n);
  return getFinancialPeriod(startDate, settings);
}
