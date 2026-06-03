import { useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getEthiopianMonthDateRange, getEthiopianMonthName } from "@/lib/ethiopian-calendar";
import { realExpenses, incomeBreakdown, type ExpenseRow, type IncomeRow } from "@/lib/finance-calc";
import type { InsightAI } from "@/hooks/useFinancialInsights";

const HISTORY_MONTHS = 3; // prior Eth months averaged for the suggestion
const MARKUP = 1.05; // suggested limit = avg spend + 5% headroom
const ROUND_STEP = 50; // round suggested limits up to nearest 50 ETB

export type BudgetSuggestion = {
  category: string;
  avgSpend: number;
  lastSpend: number;
  trend: "up" | "down" | "flat";
  suggestedLimit: number;
  currentLimit: number | null;
  budgetId: string | null; // existing budget row id, if any
  monthsSeen: number;
};

type BudgetMetrics = {
  periodLabel: string;
  periodStart: string;
  currency: string;
  avgIncome: number;
  totalSuggested: number;
  categories: Omit<BudgetSuggestion, "budgetId">[];
};

type ExistingBudget = { id: string; category: string; monthly_limit: number | string };

const roundUp = (n: number) => Math.ceil((n * MARKUP) / ROUND_STEP) * ROUND_STEP;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function prevEthMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 13 };
  return { year, month: month - 1 };
}

/**
 * Budget Coach: the client computes per-category suggested limits from the last
 * few Ethiopian months of real spending (numbers stay trustworthy). The edge
 * function only narrates — it never changes a suggested limit. Suggestions are
 * applied per-category with explicit user approval (human-in-the-loop).
 */
export function useBudgetCoach(selMonth: number, selYear: number, existing: ExistingBudget[]) {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();

  // The 3 prior Eth months (newest → oldest) and the overall date window.
  const months = useMemo(() => {
    const list: { year: number; month: number; range: { start: string; end: string }; label: string }[] = [];
    let cur = prevEthMonth(selYear, selMonth);
    for (let i = 0; i < HISTORY_MONTHS; i++) {
      list.push({
        year: cur.year,
        month: cur.month,
        range: getEthiopianMonthDateRange(cur.year, cur.month),
        label: `${getEthiopianMonthName(cur.month)} ${cur.year}`,
      });
      cur = prevEthMonth(cur.year, cur.month);
    }
    return list; // [prev1, prev2, prev3]
  }, [selMonth, selYear]);

  const earliestStart = months[months.length - 1].range.start;
  const latestEnd = months[0].range.end;
  const periodStart = getEthiopianMonthDateRange(selYear, selMonth).start;
  const periodLabel = `${getEthiopianMonthName(selMonth)} ${selYear}`;

  const { data: rows, isLoading } = useQuery({
    queryKey: ["budgetCoachRows", earliestStart, latestEnd],
    queryFn: async () => {
      const [exp, inc] = await Promise.all([
        supabase.from("expenses").select("*").gte("date", earliestStart).lte("date", latestEnd),
        supabase.from("income").select("*").gte("date", earliestStart).lte("date", latestEnd),
      ]);
      if (exp.error) throw exp.error;
      if (inc.error) throw inc.error;
      return { expenses: (exp.data ?? []) as (ExpenseRow & { date: string; category: string })[], income: (inc.data ?? []) as (IncomeRow & { date: string })[] };
    },
    staleTime: 5 * 60 * 1000,
  });

  const existingByCat = useMemo(() => {
    const m = new Map<string, ExistingBudget>();
    existing.forEach((b) => m.set(b.category, b));
    return m;
  }, [existing]);

  const { suggestions, avgIncome } = useMemo(() => {
    if (!rows) return { suggestions: [] as BudgetSuggestion[], avgIncome: 0 };

    // Per-category spend per month (real expenses only — no loans / transfers).
    const perCat: Record<string, Record<string, number>> = {};
    months.forEach(({ range }) => {
      const monthRows = realExpenses(
        rows.expenses.filter((r) => r.date >= range.start && r.date <= range.end) as any,
      );
      monthRows.forEach((e: any) => {
        const c = e.category || "Other";
        (perCat[c] ??= {})[range.start] = (perCat[c]?.[range.start] || 0) + Number(e.amount);
      });
    });

    const newestStart = months[0].range.start;
    const out: BudgetSuggestion[] = [];
    for (const [category, byMonth] of Object.entries(perCat)) {
      const spends = Object.values(byMonth);
      if (spends.length === 0) continue;
      const avg = median(spends);
      if (avg <= 0) continue;
      const last = byMonth[newestStart] ?? 0;
      const trend: BudgetSuggestion["trend"] =
        last > avg * 1.1 ? "up" : last > 0 && last < avg * 0.9 ? "down" : "flat";
      const ex = existingByCat.get(category);
      out.push({
        category,
        avgSpend: Math.round(avg),
        lastSpend: Math.round(last),
        trend,
        suggestedLimit: roundUp(avg),
        currentLimit: ex ? Number(ex.monthly_limit) : null,
        budgetId: ex ? ex.id : null,
        monthsSeen: spends.length,
      });
    }
    out.sort((a, b) => b.avgSpend - a.avgSpend);

    // Avg real monthly income across the history window (context for the model).
    const incomeByMonth = months.map(({ range }) =>
      incomeBreakdown(rows.income.filter((r) => r.date >= range.start && r.date <= range.end) as any).real,
    );
    const avgInc = incomeByMonth.length ? Math.round(median(incomeByMonth)) : 0;

    return { suggestions: out, avgIncome: avgInc };
  }, [rows, months, existingByCat]);

  const metrics = useMemo<BudgetMetrics | null>(() => {
    if (suggestions.length === 0) return null;
    return {
      periodLabel,
      periodStart,
      currency: "ETB",
      avgIncome,
      totalSuggested: suggestions.reduce((s, c) => s + c.suggestedLimit, 0),
      categories: suggestions.map(({ budgetId, ...rest }) => rest),
    };
  }, [suggestions, avgIncome, periodLabel, periodStart]);

  // Cached AI narration for this budget period.
  const cached = useQuery({
    queryKey: ["aiInsight", "budget", periodStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_insights")
        .select("payload, created_at")
        .eq("insight_type", "budget")
        .eq("period_start", periodStart)
        .maybeSingle();
      if (error) throw error;
      return data
        ? { ai: (data.payload as any).ai as InsightAI, generatedAt: data.created_at }
        : null;
    },
    staleTime: 60 * 1000,
  });

  const generate = useMutation({
    mutationFn: async (m: BudgetMetrics) => {
      const { data, error } = await supabase.functions.invoke("financial-insights", {
        body: { metrics: m, mode: "budget" },
      });
      if (error) throw error;
      if (data?.error && !data?.payload) throw new Error(data.error);
      return (data.payload as any).ai as InsightAI;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aiInsight", "budget", periodStart] });
    },
  });

  // Auto-narrate once per budget period (admin only) when nothing is cached.
  const autoTried = useRef<string>("");
  useEffect(() => {
    if (autoTried.current === periodStart) return;
    if (role !== "admin" || !user) return;
    if (cached.isLoading || cached.data) return;
    if (!metrics || generate.isPending) return;
    autoTried.current = periodStart;
    generate.mutate(metrics);
  }, [role, user, cached.isLoading, cached.data, metrics, generate, periodStart]);

  const refresh = () => {
    if (metrics) generate.mutate(metrics);
  };

  return {
    suggestions,
    coach: cached.data?.ai ?? generate.data ?? null,
    generatedAt: cached.data?.generatedAt ?? null,
    loading: isLoading,
    generating: generate.isPending,
    error: generate.error as Error | null,
    canRefresh: role === "admin" && !!metrics,
    refresh,
  };
}
