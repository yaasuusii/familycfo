import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SavingsGoal = {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  created_at: string;
};

export function useSavingsGoals() {
  return useQuery({
    queryKey: ["savings_goals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("savings_goals")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SavingsGoal[];
    },
  });
}

export function useSaveSavingsGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (g: { id?: string; name: string; target_amount: number; current_amount: number }) => {
      const { id, ...fields } = g;
      const { error } = id
        ? await supabase.from("savings_goals").update(fields).eq("id", id)
        : await supabase.from("savings_goals").insert(fields);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["savings_goals"] }),
  });
}

export function useDeleteSavingsGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("savings_goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["savings_goals"] }),
  });
}
