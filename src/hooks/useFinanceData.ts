import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useIncome(month?: string) {
  return useQuery({
    queryKey: ["income", month],
    queryFn: async () => {
      let query = supabase.from("income").select("*").order("date", { ascending: false });
      if (month) {
        const start = `${month}-01`;
        const end = `${month}-31`;
        query = query.gte("date", start).lte("date", end);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useExpenses(month?: string) {
  return useQuery({
    queryKey: ["expenses", month],
    queryFn: async () => {
      let query = supabase.from("expenses").select("*").order("date", { ascending: false });
      if (month) {
        const start = `${month}-01`;
        const end = `${month}-31`;
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

export function useBudgets() {
  return useQuery({
    queryKey: ["budgets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("budgets").select("*");
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
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
