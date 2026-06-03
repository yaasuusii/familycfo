import { useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  detectRecurringExpenses,
  detectRecurringIncome,
  type RecurringSuggestion,
} from "@/lib/recurring-detect";
import { useRecurringIncome, useRecurringExpenses } from "@/hooks/useRecurringData";

const LOOKBACK_MONTHS = 6;
const DISMISS_KEY = "familycfo.recurringDismissed";

function loadDismissed(): Set<string> {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

/**
 * Suggests recurring rules by detecting repeating transactions in the last
 * few months. Fully client-side (no AI). Dismissals persist in localStorage.
 */
export function useRecurringSuggestions() {
  const since = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - LOOKBACK_MONTHS);
    return d.toISOString().slice(0, 10);
  }, []);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["recurringScan", since],
    queryFn: async () => {
      const [inc, exp] = await Promise.all([
        supabase.from("income").select("amount,date,notes,source,is_self_transfer").gte("date", since),
        supabase.from("expenses").select("amount,date,notes,category,is_self_transfer").gte("date", since),
      ]);
      if (inc.error) throw inc.error;
      if (exp.error) throw exp.error;
      return { income: inc.data ?? [], expenses: exp.data ?? [] };
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: incomeRules = [] } = useRecurringIncome();
  const { data: expenseRules = [] } = useRecurringExpenses();

  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed);

  const dismiss = useCallback((key: string) => {
    setDismissed((prev) => {
      const next = new Set(prev).add(key);
      localStorage.setItem(DISMISS_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  const { incomeSuggestions, expenseSuggestions } = useMemo(() => {
    if (!rows) return { incomeSuggestions: [] as RecurringSuggestion[], expenseSuggestions: [] as RecurringSuggestion[] };
    const inc = detectRecurringIncome(rows.income as any, incomeRules as any).filter((s) => !dismissed.has(s.key));
    const exp = detectRecurringExpenses(rows.expenses as any, expenseRules as any).filter((s) => !dismissed.has(s.key));
    return { incomeSuggestions: inc, expenseSuggestions: exp };
  }, [rows, incomeRules, expenseRules, dismissed]);

  return { incomeSuggestions, expenseSuggestions, loading: isLoading, dismiss };
}
