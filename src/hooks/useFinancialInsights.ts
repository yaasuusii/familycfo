import { useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getFinancialPeriod, shiftPeriod } from "@/lib/finance-period";
import {
  incomeBreakdown,
  expenseBreakdown,
  realExpenses,
  type IncomeRow,
  type ExpenseRow,
} from "@/lib/finance-calc";
import { useUpcomingRecurringForMonth } from "@/hooks/useRecurringData";
import { useLoans } from "@/hooks/useLoanData";

const HISTORY_PERIODS = 3; // prior periods to include as context
const DUE_SOON_DAYS = 60;

export type InsightAI = {
  summary: string;
  outlook: "good" | "watch" | "tight";
  insights: string[];
  risks: string[];
  tips: string[];
};

export type InsightMetrics = {
  periodLabel: string;
  periodStart: string;
  current: {
    income: number; expenses: number; net: number;
    daysElapsed: number; daysInPeriod: number;
    projectedExpenses: number; projectedNet: number;
  };
  history: { label: string; income: number; expenses: number; net: number }[];
  upcoming: { recurringIncome: number; recurringExpenses: number };
  loans: {
    totalDebt: number; totalReceivable: number;
    dueSoon: { name: string; dueDate: string; balance: number; type: string }[];
  };
  topCategories: { category: string; amount: number }[];
  currency: string;
};

export type InsightPayload = { metrics: InsightMetrics; ai: InsightAI; generatedAt: string };

const MS_DAY = 86400000;
const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / MS_DAY);

/**
 * Forecast insights: the client computes every figure (so numbers stay
 * trustworthy), the edge function only narrates and caches one row per period.
 * Auto-refreshes once per period for an admin; manual refresh forces a rebuild.
 */
export function useFinancialInsights() {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();

  // Current + prior period windows.
  const periods = useMemo(() => {
    const cur = getFinancialPeriod();
    const list = [cur];
    for (let i = 1; i <= HISTORY_PERIODS; i++) list.push(shiftPeriod(cur, i));
    return list; // [current, prev1, prev2, prev3]
  }, []);
  const current = periods[0];
  const earliestStart = periods[periods.length - 1].start;

  // One query for all rows since the earliest window; bucket client-side.
  const { data: rows } = useQuery({
    queryKey: ["insightRows", earliestStart],
    queryFn: async () => {
      const [inc, exp] = await Promise.all([
        supabase.from("income").select("*").gte("date", earliestStart),
        supabase.from("expenses").select("*").gte("date", earliestStart),
      ]);
      if (inc.error) throw inc.error;
      if (exp.error) throw exp.error;
      return { income: (inc.data ?? []) as IncomeRow[] & { date: string }[], expenses: (exp.data ?? []) as ExpenseRow[] & { date: string; category: string }[] };
    },
    staleTime: 5 * 60 * 1000,
  });

  const { upcomingIncome, upcomingExpenses } = useUpcomingRecurringForMonth(current);
  const { data: activeLoans = [] } = useLoans("active");

  const metrics = useMemo<InsightMetrics | null>(() => {
    if (!rows) return null;

    const bucket = (start: string, end: string) => {
      const inc = rows.income.filter((r: any) => r.date >= start && r.date <= end);
      const exp = rows.expenses.filter((r: any) => r.date >= start && r.date <= end);
      const income = incomeBreakdown(inc).real;
      const expenses = expenseBreakdown(exp).real;
      return { income, expenses, net: income - expenses, inc, exp };
    };

    const cur = bucket(current.start, current.end);
    const todayStr = new Date().toISOString().slice(0, 10);
    const daysInPeriod = daysBetween(current.start, current.end) + 1;
    const daysElapsed = Math.min(Math.max(daysBetween(current.start, todayStr) + 1, 1), daysInPeriod);
    const dailyRate = daysElapsed > 0 ? cur.expenses / daysElapsed : 0;
    const projectedExpenses = dailyRate * daysInPeriod;

    const history = periods.slice(1).map((p) => {
      const b = bucket(p.start, p.end);
      return { label: p.label, income: round(b.income), expenses: round(b.expenses), net: round(b.net) };
    });

    // Top expense categories this period (real spend only).
    const catMap: Record<string, number> = {};
    realExpenses(cur.exp as any).forEach((e: any) => {
      const c = e.category || "Other";
      catMap[c] = (catMap[c] || 0) + Number(e.amount);
    });
    const topCategories = Object.entries(catMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([category, amount]) => ({ category, amount: round(amount) }));

    // Loans
    const taken = activeLoans.filter((l: any) => l.loan_type === "taken");
    const given = activeLoans.filter((l: any) => l.loan_type === "given");
    const totalDebt = taken.reduce((s: number, l: any) => s + Number(l.remaining_balance), 0);
    const totalReceivable = given.reduce((s: number, l: any) => s + Number(l.remaining_balance), 0);
    const soonCutoff = new Date(Date.now() + DUE_SOON_DAYS * MS_DAY).toISOString().slice(0, 10);
    const dueSoon = activeLoans
      .filter((l: any) => l.end_date && l.end_date <= soonCutoff)
      .map((l: any) => ({
        name: l.lender_or_borrower_name,
        dueDate: l.end_date,
        balance: round(Number(l.remaining_balance)),
        type: l.loan_type,
      }));

    return {
      periodLabel: current.label,
      periodStart: current.start,
      current: {
        income: round(cur.income),
        expenses: round(cur.expenses),
        net: round(cur.net),
        daysElapsed,
        daysInPeriod,
        projectedExpenses: round(projectedExpenses),
        projectedNet: round(cur.income + upcomingIncome - (projectedExpenses + upcomingExpenses)),
      },
      history,
      upcoming: { recurringIncome: round(upcomingIncome), recurringExpenses: round(upcomingExpenses) },
      loans: { totalDebt: round(totalDebt), totalReceivable: round(totalReceivable), dueSoon },
      topCategories,
      currency: "ETB",
    };
  }, [rows, periods, current, activeLoans, upcomingIncome, upcomingExpenses]);

  // Cached insight for the current period.
  const cached = useQuery({
    queryKey: ["aiInsight", "forecast", current.start],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_insights")
        .select("payload, created_at")
        .eq("insight_type", "forecast")
        .eq("period_start", current.start)
        .maybeSingle();
      if (error) throw error;
      return data ? { ...(data.payload as unknown as InsightPayload), _createdAt: data.created_at } : null;
    },
    staleTime: 60 * 1000,
  });

  const generate = useMutation({
    mutationFn: async (m: InsightMetrics) => {
      const { data, error } = await supabase.functions.invoke("forecast-insights", {
        body: { metrics: m },
      });
      if (error) throw new Error(await fnErrorDetail(error));
      if (data?.error && !data?.payload) throw new Error(data.error);
      return data.payload as InsightPayload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aiInsight", "forecast", current.start] });
    },
  });

  // Auto-generate once per period (admin only) when nothing is cached yet.
  const autoTried = useRef(false);
  useEffect(() => {
    if (autoTried.current) return;
    if (role !== "admin" || !user) return;
    if (cached.isLoading || cached.data) return;
    if (!metrics || generate.isPending) return;
    autoTried.current = true;
    generate.mutate(metrics);
  }, [role, user, cached.isLoading, cached.data, metrics, generate]);

  const refresh = () => {
    if (metrics) generate.mutate(metrics);
  };

  return {
    metrics,
    insight: cached.data ?? generate.data ?? null,
    loading: cached.isLoading || (generate.isPending && !cached.data),
    generating: generate.isPending,
    error: generate.error as Error | null,
    canRefresh: role === "admin" && !!metrics,
    refresh,
  };
}

function round(n: number): number {
  return Math.round(n);
}

/**
 * Read-only: the cached forecast narration for the current period, if any.
 * Cheap (single row, no metric computation) — for surfacing the AI summary
 * on the dashboard without triggering generation.
 */
export function useCachedForecast() {
  const start = useMemo(() => getFinancialPeriod().start, []);
  return useQuery({
    queryKey: ["aiInsight", "forecast", start],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_insights")
        .select("payload")
        .eq("insight_type", "forecast")
        .eq("period_start", start)
        .maybeSingle();
      if (error) throw error;
      return data ? (data.payload as unknown as InsightPayload).ai : null;
    },
    staleTime: 60 * 1000,
  });
}

/**
 * `supabase.functions.invoke` rejects with a generic "non-2xx" message and
 * hides the function's JSON body on `error.context`. Pull the real `error`
 * string out so the UI can show the actual cause.
 */
export async function fnErrorDetail(error: unknown): Promise<string> {
  const e = error as { message?: string; context?: Response };
  try {
    const body = await e.context?.clone().json();
    if (body?.error) return String(body.error);
  } catch {
    /* body not JSON or already consumed */
  }
  return e.message || "Edge function call failed";
}
