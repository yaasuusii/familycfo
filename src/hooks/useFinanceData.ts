import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentEthMonth, parseEthMonth, getEthiopianMonthDateRange } from "@/lib/ethiopian-calendar";

export function useIncome(ethMonth?: string) {
  return useQuery({
    queryKey: ["income", ethMonth],
    queryFn: async () => {
      let query = supabase.from("income").select("*").order("date", { ascending: false });
      if (ethMonth) {
        const { year, month } = parseEthMonth(ethMonth);
        const { start, end } = getEthiopianMonthDateRange(year, month);
        query = query.gte("date", start).lte("date", end);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useExpenses(ethMonth?: string) {
  return useQuery({
    queryKey: ["expenses", ethMonth],
    queryFn: async () => {
      let query = supabase.from("expenses").select("*").order("date", { ascending: false });
      if (ethMonth) {
        const { year, month } = parseEthMonth(ethMonth);
        const { start, end } = getEthiopianMonthDateRange(year, month);
        query = query.gte("date", start).lte("date", end);
      }
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
