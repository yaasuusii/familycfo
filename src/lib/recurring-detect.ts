// Deterministic recurring-transaction detector.
//
// Pure client-side pattern matching — no AI, no data leaves the device. Finds
// income/expense items that repeat on a regular cadence so the user can turn
// them into recurring rules with one tap. Suggestions only; never auto-creates.

import {
  isTransfer,
  isIncomeLoan,
  isExpenseLoan,
  LOAN_INCOME_SOURCE,
} from "@/lib/finance-calc";

export type DetectTxn = {
  amount: number;
  date: string; // YYYY-MM-DD
  label: string; // notes (or fallback to group)
  group: string; // category (expense) or source (income)
};

export type RecurringSuggestion = {
  key: string; // stable id for dismiss / dedupe
  kind: "income" | "expense";
  title: string;
  group: string; // category or source
  amount: number; // median
  frequency: "weekly" | "monthly" | "yearly";
  occurrences: number;
  months: number; // distinct months seen
  lastDate: string;
  confidence: "high" | "medium";
};

type RuleLike = { amount: number; category?: string; source?: string; is_active: boolean };

const MS_DAY = 86400000;
const AMOUNT_TOLERANCE = 0.1; // ±10% groups same item
const MIN_MONTHS = 3; // must appear in at least this many distinct months
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function cleanTitle(label: string, group: string): string {
  const t = (label || "").trim();
  if (!t || t.toLowerCase() === group.toLowerCase()) return group;
  // First line, capped — notes can be long.
  return t.split("\n")[0].slice(0, 40);
}

function freqFromGaps(dates: string[]): RecurringSuggestion["frequency"] {
  if (dates.length < 2) return "monthly";
  const sorted = [...dates].sort();
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(
      (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / MS_DAY,
    );
  }
  const g = median(gaps);
  if (g <= 10) return "weekly";
  if (g >= 200) return "yearly";
  return "monthly";
}

/** Cluster a group's transactions by amount (±tolerance), in sorted order. */
function clusterByAmount(txns: DetectTxn[]): DetectTxn[][] {
  const sorted = [...txns].sort((a, b) => a.amount - b.amount);
  const clusters: DetectTxn[][] = [];
  for (const t of sorted) {
    const last = clusters[clusters.length - 1];
    if (last) {
      const ref = median(last.map((x) => x.amount));
      if (Math.abs(t.amount - ref) <= ref * AMOUNT_TOLERANCE) {
        last.push(t);
        continue;
      }
    }
    clusters.push([t]);
  }
  return clusters;
}

function matchesExisting(amount: number, group: string, kind: "income" | "expense", rules: RuleLike[]): boolean {
  return rules.some((r) => {
    if (!r.is_active) return false;
    const g = kind === "expense" ? r.category : r.source;
    if (g !== group) return false;
    return Math.abs(Number(r.amount) - amount) <= Number(r.amount) * 0.15;
  });
}

function detect(
  txns: DetectTxn[],
  kind: "income" | "expense",
  existing: RuleLike[],
): RecurringSuggestion[] {
  const byGroup: Record<string, DetectTxn[]> = {};
  for (const t of txns) (byGroup[t.group] ??= []).push(t);

  const out: RecurringSuggestion[] = [];
  for (const [group, rows] of Object.entries(byGroup)) {
    for (const cluster of clusterByAmount(rows)) {
      const months = new Set(cluster.map((t) => t.date.slice(0, 7)));
      if (months.size < MIN_MONTHS) continue;

      const amount = Math.round(median(cluster.map((t) => t.amount)));
      if (matchesExisting(amount, group, kind, existing)) continue;

      const dates = cluster.map((t) => t.date);
      const lastDate = dates.sort()[dates.length - 1];
      // Most common label in the cluster.
      const labelCount: Record<string, number> = {};
      cluster.forEach((t) => { labelCount[t.label] = (labelCount[t.label] || 0) + 1; });
      const topLabel = Object.entries(labelCount).sort(([, a], [, b]) => b - a)[0][0];

      out.push({
        key: `${kind}:${group}:${amount}`,
        kind,
        title: cleanTitle(topLabel, group),
        group,
        amount,
        frequency: freqFromGaps(dates),
        occurrences: cluster.length,
        months: months.size,
        lastDate,
        confidence: months.size >= 4 ? "high" : "medium",
      });
    }
  }
  // Strongest first.
  return out.sort((a, b) => b.months - a.months || b.amount - a.amount);
}

/** Detect recurring expense candidates (excludes loan repayments & transfers). */
export function detectRecurringExpenses(
  rows: { amount: number; date: string; notes?: string | null; category?: string | null; is_self_transfer?: boolean | null }[],
  existing: RuleLike[],
): RecurringSuggestion[] {
  const txns: DetectTxn[] = rows
    .filter((r) => !isTransfer(r) && !isExpenseLoan(r as any))
    .map((r) => ({
      amount: Number(r.amount),
      date: r.date,
      label: r.notes || r.category || "Expense",
      group: r.category || "Other",
    }));
  return detect(txns, "expense", existing);
}

/** Detect recurring income candidates (excludes loans taken & transfers). */
export function detectRecurringIncome(
  rows: { amount: number; date: string; notes?: string | null; source?: string | null; is_self_transfer?: boolean | null }[],
  existing: RuleLike[],
): RecurringSuggestion[] {
  const txns: DetectTxn[] = rows
    .filter((r) => !isTransfer(r) && !isIncomeLoan(r as any) && r.source !== LOAN_INCOME_SOURCE)
    .map((r) => ({
      amount: Number(r.amount),
      date: r.date,
      label: r.notes || r.source || "Income",
      group: r.source || "Other",
    }));
  return detect(txns, "income", existing);
}
