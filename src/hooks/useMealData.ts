import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type MealType = "breakfast" | "morning_snack" | "lunch" | "afternoon_snack" | "dinner";
export type Nutrient = "iron" | "folate" | "calcium" | "protein" | "fiber" | "vitamin_a" | "vitamin_c" | "omega3";

export const MEAL_TYPES: { key: MealType; label: string; short: string }[] = [
  { key: "breakfast", label: "Breakfast", short: "Bfast" },
  { key: "morning_snack", label: "Morning Snack", short: "Snack" },
  { key: "lunch", label: "Lunch", short: "Lunch" },
  { key: "afternoon_snack", label: "Afternoon Snack", short: "Snack" },
  { key: "dinner", label: "Dinner", short: "Dinner" },
];

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const NUTRIENTS: { key: Nutrient; label: string; emoji: string }[] = [
  { key: "iron", label: "Iron", emoji: "🩸" },
  { key: "folate", label: "Folate", emoji: "🥬" },
  { key: "calcium", label: "Calcium", emoji: "🦴" },
  { key: "protein", label: "Protein", emoji: "🥩" },
  { key: "fiber", label: "Fiber", emoji: "🌾" },
  { key: "vitamin_a", label: "Vitamin A", emoji: "🥕" },
  { key: "vitamin_c", label: "Vitamin C", emoji: "🍊" },
  { key: "omega3", label: "Omega-3", emoji: "🐟" },
];

export function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

export function useMealPlan(weekStart: string) {
  return useQuery({
    queryKey: ["meal_plan", weekStart],
    queryFn: async () => {
      const { data: plan } = await supabase
        .from("meal_plans")
        .select("*")
        .eq("week_start", weekStart)
        .maybeSingle();
      return plan;
    },
  });
}

export function useMeals(planId: string | undefined) {
  return useQuery({
    queryKey: ["meals", planId],
    enabled: !!planId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meals")
        .select("*, meal_nutrition(*), meal_ingredients(*)")
        .eq("plan_id", planId!)
        .order("day_of_week")
        .order("meal_type");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateMealPlan() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (weekStart: string) => {
      const { data, error } = await supabase
        .from("meal_plans")
        .insert({ week_start: weekStart, created_by: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["meal_plan", data.week_start] });
    },
  });
}

export function useUpsertMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (meal: {
      plan_id: string;
      day_of_week: number;
      meal_type: MealType;
      name: string;
      notes?: string;
      is_batch?: boolean;
      batch_days?: number;
      estimated_cost?: number;
      nutrients?: Nutrient[];
    }) => {
      const { nutrients, ...mealData } = meal;

      const { data, error } = await supabase
        .from("meals")
        .upsert(mealData, { onConflict: "plan_id,day_of_week,meal_type" })
        .select()
        .single();
      if (error) throw error;

      if (nutrients) {
        await supabase.from("meal_nutrition").delete().eq("meal_id", data.id);
        if (nutrients.length > 0) {
          await supabase.from("meal_nutrition").insert(
            nutrients.map((n) => ({ meal_id: data.id, nutrient: n }))
          );
        }
      }

      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["meals", data.plan_id] });
    },
  });
}

export function useDeleteMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, planId }: { id: string; planId: string }) => {
      const { error } = await supabase.from("meals").delete().eq("id", id);
      if (error) throw error;
      return planId;
    },
    onSuccess: (planId) => {
      qc.invalidateQueries({ queryKey: ["meals", planId] });
    },
  });
}

export function useFoodWarnings() {
  return useQuery({
    queryKey: ["food_warnings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("food_warnings").select("*");
      if (error) throw error;
      return data;
    },
    staleTime: Infinity,
  });
}

export function useWaterIntake(date: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["water_intake", date],
    queryFn: async () => {
      const { data } = await supabase
        .from("water_intake")
        .select("*")
        .eq("user_id", user!.id)
        .eq("date", date)
        .maybeSingle();
      return data;
    },
  });
}

export function useUpsertWater() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ date, glasses }: { date: string; glasses: number }) => {
      const { error } = await supabase
        .from("water_intake")
        .upsert(
          { user_id: user!.id, date, glasses, updated_at: new Date().toISOString() },
          { onConflict: "user_id,date" }
        );
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["water_intake", vars.date] });
    },
  });
}

export function usePregnancyProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["pregnancy_profile"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pregnancy_profile")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });
}

export function useUpsertPregnancyProfile() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (dueDate: string) => {
      const { error } = await supabase
        .from("pregnancy_profile")
        .upsert({ user_id: user!.id, due_date: dueDate, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pregnancy_profile"] });
    },
  });
}

export function getTrimester(dueDate: string): { trimester: number; weeksPregnant: number } {
  const due = new Date(dueDate);
  const now = new Date();
  const conceptionDate = new Date(due);
  conceptionDate.setDate(conceptionDate.getDate() - 280);
  const diffMs = now.getTime() - conceptionDate.getTime();
  const weeksPregnant = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
  const trimester = weeksPregnant < 13 ? 1 : weeksPregnant < 27 ? 2 : 3;
  return { trimester, weeksPregnant: Math.max(0, Math.min(weeksPregnant, 42)) };
}

export function useCopyWeek() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ fromPlanId, toWeekStart }: { fromPlanId: string; toWeekStart: string }) => {
      // Create the new plan
      const { data: newPlan, error: planError } = await supabase
        .from("meal_plans")
        .upsert({ week_start: toWeekStart, created_by: user!.id }, { onConflict: "week_start" })
        .select()
        .single();
      if (planError) throw planError;

      // Get source meals with nutrition
      const { data: sourceMeals } = await supabase
        .from("meals")
        .select("*, meal_nutrition(*)")
        .eq("plan_id", fromPlanId);

      if (sourceMeals && sourceMeals.length > 0) {
        for (const meal of sourceMeals) {
          const { data: newMeal } = await supabase
            .from("meals")
            .upsert({
              plan_id: newPlan.id,
              day_of_week: meal.day_of_week,
              meal_type: meal.meal_type,
              name: meal.name,
              notes: meal.notes,
              is_batch: meal.is_batch,
              batch_days: meal.batch_days,
              estimated_cost: meal.estimated_cost,
            }, { onConflict: "plan_id,day_of_week,meal_type" })
            .select()
            .single();

          if (newMeal && meal.meal_nutrition?.length > 0) {
            await supabase.from("meal_nutrition").insert(
              meal.meal_nutrition.map((n: any) => ({ meal_id: newMeal.id, nutrient: n.nutrient }))
            );
          }
        }
      }

      return newPlan;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["meal_plan", data.week_start] });
      qc.invalidateQueries({ queryKey: ["meals"] });
    },
  });
}

export function useGenerateMealPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      planId,
      trimester,
      weeksPregnant,
      budget,
      previousMeals,
      cravings,
    }: {
      planId: string;
      trimester?: number;
      weeksPregnant?: number;
      budget?: number;
      previousMeals?: string[];
      cravings?: string[];
    }) => {
      const { data, error } = await supabase.functions.invoke("generate-meal-plan", {
        body: { trimester, weeksPregnant, budget, previousMeals, cravings },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const meals = data.meals as Array<{
        day: number;
        meal_type: MealType;
        name: string;
        nutrients: Nutrient[];
        estimated_cost?: number;
        ingredients?: Array<{ name: string; qty: number; unit: string }>;
      }>;

      for (const meal of meals) {
        const { data: saved } = await supabase
          .from("meals")
          .upsert({
            plan_id: planId,
            day_of_week: meal.day,
            meal_type: meal.meal_type,
            name: meal.name,
            estimated_cost: meal.estimated_cost ?? null,
          }, { onConflict: "plan_id,day_of_week,meal_type" })
          .select()
          .single();

        if (saved) {
          if (meal.nutrients?.length > 0) {
            await supabase.from("meal_nutrition").delete().eq("meal_id", saved.id);
            await supabase.from("meal_nutrition").insert(
              meal.nutrients.map((n) => ({ meal_id: saved.id, nutrient: n }))
            );
          }
          if (meal.ingredients?.length > 0) {
            await supabase.from("meal_ingredients").delete().eq("meal_id", saved.id);
            await supabase.from("meal_ingredients").insert(
              meal.ingredients.map((ing) => ({
                meal_id: saved.id,
                name: ing.name,
                quantity: ing.qty,
                unit: ing.unit,
              }))
            );
          }
        }
      }

      return planId;
    },
    onSuccess: (planId) => {
      qc.invalidateQueries({ queryKey: ["meals", planId] });
    },
  });
}
