import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentEthMonth, parseEthMonth, getEthiopianMonthDateRange } from "@/lib/ethiopian-calendar";

export type DateRange = { start: string; end: string };

/** Resolve a period arg to an inclusive Gregorian date range, or null for "all". */
function resolveRange(period?: string | DateRange): DateRange | null {
  if (!period) return null;
  if (typeof period === "string") {
    const { year, month } = parseEthMonth(period);
    return getEthiopianMonthDateRange(year, month);
  }
  return period;
}

export function useIncome(period?: string | DateRange) {
  return useQuery({
    queryKey: ["income", period],
    queryFn: async () => {
      let query = supabase.from("income").select("*").order("date", { ascending: false });
      const range = resolveRange(period);
      if (range) query = query.gte("date", range.start).lte("date", range.end);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useExpenses(period?: string | DateRange) {
  return useQuery({
    queryKey: ["expenses", period],
    queryFn: async () => {
      let query = supabase.from("expenses").select("*").order("date", { ascending: false });
      const range = resolveRange(period);
      if (range) query = query.gte("date", range.start).lte("date", range.end);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useCategoryRules() {
  return useQuery({
    queryKey: ["category_rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("category_rules").select("*");
      if (error) throw error;
      return data;
    },
  });
}

export function useBudgets(ethMonth?: number, ethYear?: number) {
  const { year: cy, month: cm } = parseEthMonth(getCurrentEthMonth());
  const m = ethMonth ?? cm;
  const y = ethYear ?? cy;
  return useQuery({
    queryKey: ["budgets", m, y],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budgets")
        .select("*")
        .eq("month", m)
        .eq("year", y);
      if (error) throw error;
      return data;
    },
  });
}

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*");
      if (error) throw error;
      return data;
    },
  });
}

export function getCurrentMonth(): string {
  return getCurrentEthMonth();
}
