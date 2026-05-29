import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { getCurrentEthiopianMonth, getEthiopianDaysInMonth, toGregorian } from "@/lib/ethiopian-calendar";

export function useRecurringIncome() {
  return useQuery({
    queryKey: ["recurring_income"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_income")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useRecurringExpenses() {
  return useQuery({
    queryKey: ["recurring_expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_expenses")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateRecurringIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: {
      title: string;
      amount: number;
      frequency: string;
      start_date: string;
      end_date?: string | null;
      auto_post: boolean;
      created_by: string;
    }) => {
      const { error } = await supabase.from("recurring_income").insert(values);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring_income"] }),
  });
}

export function useCreateRecurringExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: {
      title: string;
      category: string;
      amount: number;
      frequency: string;
      start_date: string;
      end_date?: string | null;
      auto_post: boolean;
      created_by: string;
    }) => {
      const { error } = await supabase.from("recurring_expenses").insert(values);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring_expenses"] }),
  });
}

export function useUpdateRecurring(table: "recurring_income" | "recurring_expenses") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: { id: string; [key: string]: unknown }) => {
      const { error } = await supabase.from(table).update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [table] }),
  });
}

export function useDeleteRecurring(table: "recurring_income" | "recurring_expenses") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [table] }),
  });
}

function addPeriod(date: Date, frequency: string): Date {
  const d = new Date(date);
  if (frequency === "weekly") d.setDate(d.getDate() + 7);
  else if (frequency === "yearly") d.setFullYear(d.getFullYear() + 1);
  // "monthly" and any unrecognized frequency advance by one month.
  // This guarantees the date always moves forward, preventing the
  // `while (next <= endOfMonth)` loops below from never terminating.
  else d.setMonth(d.getMonth() + 1);
  return d;
}

function getNextDueDate(rule: { start_date: string; last_generated_date: string | null; frequency: string }): Date {
  if (rule.last_generated_date) {
    return addPeriod(new Date(rule.last_generated_date), rule.frequency);
  }
  return new Date(rule.start_date);
}

export type UpcomingItem = {
  id: string;
  title: string;
  amount: number;
  dueDate: Date;
  type: "income" | "expense";
  category?: string;
  isOverdue: boolean;
};

export function useUpcomingRecurring() {
  const { data: incomeRules = [] } = useRecurringIncome();
  const { data: expenseRules = [] } = useRecurringExpenses();

  return useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const sevenDaysLater = new Date(now);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    const items: UpcomingItem[] = [];

    for (const rule of incomeRules) {
      if (!rule.is_active) continue;
      const next = getNextDueDate(rule);
      if (rule.end_date && next > new Date(rule.end_date)) continue;
      if (next <= sevenDaysLater) {
        items.push({
          id: rule.id,
          title: rule.title,
          amount: Number(rule.amount),
          dueDate: next,
          type: "income",
          isOverdue: next < now,
        });
      }
    }

    for (const rule of expenseRules) {
      if (!rule.is_active) continue;
      const next = getNextDueDate(rule);
      if (rule.end_date && next > new Date(rule.end_date)) continue;
      if (next <= sevenDaysLater) {
        items.push({
          id: rule.id,
          title: rule.title,
          amount: Number(rule.amount),
          dueDate: next,
          type: "expense",
          category: rule.category,
          isOverdue: next < now,
        });
      }
    }

    return items.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [incomeRules, expenseRules]);
}

export function useUpcomingRecurringForMonth() {
  const { data: incomeRules = [] } = useRecurringIncome();
  const { data: expenseRules = [] } = useRecurringExpenses();

  return useMemo(() => {
    const now = new Date();
    // Use Ethiopian month end instead of Gregorian
    const eth = getCurrentEthiopianMonth();
    const daysInMonth = getEthiopianDaysInMonth(eth.month, eth.year);
    const endOfMonth = toGregorian(eth.year, eth.month, daysInMonth);

    let upcomingExpenses = 0;
    let upcomingIncome = 0;

    for (const rule of incomeRules) {
      if (!rule.is_active) continue;
      let next = getNextDueDate(rule);
      while (next <= endOfMonth) {
        if (rule.end_date && next > new Date(rule.end_date)) break;
        if (next > now) upcomingIncome += Number(rule.amount);
        next = addPeriod(next, rule.frequency);
      }
    }

    for (const rule of expenseRules) {
      if (!rule.is_active) continue;
      let next = getNextDueDate(rule);
      while (next <= endOfMonth) {
        if (rule.end_date && next > new Date(rule.end_date)) break;
        if (next > now) upcomingExpenses += Number(rule.amount);
        next = addPeriod(next, rule.frequency);
      }
    }

    return { upcomingExpenses, upcomingIncome };
  }, [incomeRules, expenseRules]);
}
