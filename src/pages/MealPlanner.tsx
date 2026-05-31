import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ChevronLeft, ChevronRight, Plus, Copy, AlertTriangle, Droplets,
  UtensilsCrossed, Baby, Sparkles, Loader2, ShoppingCart, Check,
} from "lucide-react";
import {
  useMealPlan, useMeals, useCreateMealPlan, useUpsertMeal, useDeleteMeal,
  useFoodWarnings, useWaterIntake, useUpsertWater,
  usePregnancyProfile, useUpsertPregnancyProfile,
  useCopyWeek, useGenerateMealPlan, getTrimester, getWeekStart,
  MEAL_TYPES, DAYS, NUTRIENTS, type MealType, type Nutrient,
} from "@/hooks/useMealData";
import { formatETB } from "@/lib/format";
import { useMarketPrices, lookupPrice } from "@/hooks/useMarketPrices";

const TRIMESTER_TIPS: Record<number, string> = {
  1: "Focus on folate-rich foods (lentils, greens) and small frequent meals to manage nausea.",
  2: "Increase iron & calcium intake. Baby's bones are growing — dairy, eggs, dark leafy greens.",
  3: "Boost protein & omega-3. Frequent small meals help with reduced stomach space.",
};

const MEAL_SLOT_COLORS: Record<MealType, string> = {
  breakfast: "border-l-amber-400",
  morning_snack: "border-l-green-400",
  lunch: "border-l-blue-400",
  afternoon_snack: "border-l-green-400",
  dinner: "border-l-purple-400",
};

const GROCERY_CATEGORIES = [
  { label: "Protein", emoji: "\u{1F969}", keywords: ["chicken", "beef", "lamb", "fish", "tilapia", "salmon", "shrimp", "egg", "tuna", "turkey", "meatball", "mince", "ground meat", "steak", "cod"] },
  { label: "Produce", emoji: "\u{1F96C}", keywords: ["onion", "tomato", "garlic", "ginger", "carrot", "potato", "lettuce", "spinach", "kale", "avocado", "lemon", "lime", "orange", "banana", "apple", "mango", "papaya", "watermelon", "pepper", "cucumber", "broccoli", "asparagus", "zucchini", "mushroom", "corn", "cabbage", "celery", "pea", "beetroot", "sweet potato", "berry", "berries", "grape", "guava", "pineapple", "strawberry", "blueberry", "date", "fig", "peach", "pear", "mixed greens", "green"] },
  { label: "Dairy", emoji: "\u{1F9C0}", keywords: ["milk", "cheese", "yogurt", "butter", "cream", "ayib", "curd", "sour cream"] },
  { label: "Grains & Bread", emoji: "\u{1F33E}", keywords: ["bread", "toast", "injera", "pasta", "rice", "flour", "oat", "barley", "teff", "wheat", "tortilla", "noodle", "granola", "cereal", "kollo", "spaghetti", "penne", "macaroni", "kinche", "pancake", "cracker", "pita", "dough"] },
  { label: "Spices & Oils", emoji: "\u{1F9C2}", keywords: ["berbere", "salt", "cumin", "turmeric", "cinnamon", "oregano", "basil", "oil", "olive", "vinegar", "soy sauce", "mustard", "mitmita", "cardamom", "clove", "rosemary", "thyme", "paprika", "chili", "dressing", "vinaigrette", "sauce", "ketchup", "mayo", "mayonnaise", "syrup"] },
  { label: "Pantry & Legumes", emoji: "\u{1FAD8}", keywords: ["lentil", "chickpea", "bean", "split pea", "shiro", "peanut", "almond", "nut", "walnut", "cashew", "sesame", "sunflower", "canned", "paste", "broth", "stock", "honey", "sugar", "jam", "tea", "coffee", "hummus", "fava"] },
];

function categorizeIngredient(name: string): string {
  const lower = name.toLowerCase();
  for (const cat of GROCERY_CATEGORIES) {
    if (cat.keywords.some(kw => lower.includes(kw))) return cat.label;
  }
  return "Other";
}

function getCategoryEmoji(label: string): string {
  return GROCERY_CATEGORIES.find(c => c.label === label)?.emoji ?? "\u{1F4E6}";
}

const SHOPPING_GROUPS: { name: string; match: RegExp; exclude: RegExp }[] = [
  // Proteins
  { name: "Beef", match: /\bbeef\b/i, exclude: /broth|stock/i },
  { name: "Chicken", match: /\bchicken\b/i, exclude: /broth|stock|noodle/i },
  { name: "Lamb", match: /\blamb\b/i, exclude: /broth|stock/i },
  { name: "Eggs", match: /\beggs?\b/i, exclude: /noodle|plant/i },
  { name: "Salmon", match: /\bsalmon\b/i, exclude: /^$/i },
  { name: "Tilapia", match: /\btilapia\b/i, exclude: /^$/i },
  { name: "Tuna", match: /\btuna\b/i, exclude: /^$/i },
  { name: "Cod", match: /\bcod\b/i, exclude: /^$/i },
  { name: "Fish", match: /\bfish\b/i, exclude: /sauce/i },
  // Produce
  { name: "Onion", match: /\bonions?\b/i, exclude: /powder|ring/i },
  { name: "Tomato", match: /\btomato(es)?\b/i, exclude: /paste|sauce|puree|ketchup/i },
  { name: "Garlic", match: /\bgarlic\b/i, exclude: /powder|bread/i },
  { name: "Carrot", match: /\bcarrots?\b/i, exclude: /cake/i },
  { name: "Sweet Potato", match: /\bsweet potato(es)?\b/i, exclude: /^$/i },
  { name: "Potato", match: /\bpotat(o|oes)\b/i, exclude: /chip|crisp|sweet/i },
  { name: "Bell Pepper", match: /\b(bell )?peppers?\b/i, exclude: /black|white|cayenne|chili|spice/i },
  { name: "Spinach", match: /\bspinach\b/i, exclude: /^$/i },
  { name: "Lettuce", match: /\blettuce\b/i, exclude: /^$/i },
  { name: "Mixed Greens", match: /\bmixed greens\b/i, exclude: /^$/i },
  { name: "Cabbage", match: /\bcabbage\b/i, exclude: /^$/i },
  { name: "Berries", match: /\b(berries|blueberr|strawberr|mixed berr)/i, exclude: /^$/i },
  { name: "Banana", match: /\bbananas?\b/i, exclude: /^$/i },
  { name: "Avocado", match: /\bavocados?\b/i, exclude: /^$/i },
  { name: "Mango", match: /\bmango(es|s)?\b/i, exclude: /chutney/i },
  { name: "Lemon", match: /\blemons?\b/i, exclude: /grass/i },
  { name: "Orange", match: /\boranges?\b/i, exclude: /juice/i },
  // Dairy
  { name: "Yogurt", match: /\byogurt\b/i, exclude: /^$/i },
  { name: "Milk", match: /\bmilk\b/i, exclude: /coconut/i },
  { name: "Cheese", match: /\bcheese\b/i, exclude: /cake/i },
  { name: "Butter", match: /\bbutter\b/i, exclude: /peanut|almond|nut/i },
  { name: "Cream", match: /\bcream\b/i, exclude: /ice/i },
  // Grains
  { name: "Rice", match: /\brice\b/i, exclude: /cake|paper|vinegar|wine/i },
  { name: "Pasta", match: /\b(pasta|spaghetti|penne|macaroni|fusilli|linguine|noodle)/i, exclude: /sauce/i },
  { name: "Bread", match: /\b(bread|toast)\b/i, exclude: /^$/i },
  { name: "Flour", match: /\bflour\b/i, exclude: /flower/i },
  { name: "Oats", match: /\boats?\b/i, exclude: /^$/i },
  // Oils
  { name: "Olive Oil", match: /\bolive oil\b/i, exclude: /^$/i },
];

function getShoppingName(ingredientName: string): string {
  const name = ingredientName.toLowerCase();
  for (const group of SHOPPING_GROUPS) {
    if (group.match.test(name) && !group.exclude.test(name)) return group.name;
  }
  // Capitalize first letter for unmatched items
  return ingredientName.charAt(0).toUpperCase() + ingredientName.slice(1).toLowerCase();
}

function normalizeUnit(qty: number, unit: string): { qty: number; unit: string } {
  const u = unit.toLowerCase().trim().replace(/s$/, ""); // strip trailing 's' (cups→cup, tbsps→tbsp)
  // Weight → grams
  if (u === "kg") return { qty: qty * 1000, unit: "g" };
  // Volume → ml
  if (u === "l" || u === "liter" || u === "litre") return { qty: qty * 1000, unit: "ml" };
  if (u === "cup") return { qty: qty * 240, unit: "ml" };
  if (u === "tbsp") return { qty: qty * 15, unit: "ml" };
  if (u === "tsp") return { qty: qty * 5, unit: "ml" };
  // Count
  if (u === "piece" || u === "pc" || u === "pcs" || u === "pc") return { qty, unit: "pcs" };
  if (u === "clove") return { qty, unit: "pcs" };
  return { qty, unit: u };
}

function displayUnit(qty: number, unit: string): { qty: number; unit: string } {
  if (unit === "g" && qty >= 1000) return { qty: +(qty / 1000).toFixed(2), unit: "kg" };
  if (unit === "ml" && qty >= 1000) return { qty: +(qty / 1000).toFixed(1), unit: "L" };
  if (unit === "ml") return { qty: Math.round(qty), unit: "ml" };
  return { qty, unit };
}

export default function MealPlanner() {
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return getWeekStart(d);
  }, [weekOffset]);

  const { data: plan } = useMealPlan(weekStart);
  const { data: meals = [] } = useMeals(plan?.id);
  const { data: warnings = [] } = useFoodWarnings();
  const { data: pregnancyProfile } = usePregnancyProfile();
  const createPlan = useCreateMealPlan();
  const upsertMeal = useUpsertMeal();
  const deleteMeal = useDeleteMeal();
  const copyWeek = useCopyWeek();
  const generatePlan = useGenerateMealPlan();
  const upsertProfile = useUpsertPregnancyProfile();

  const today = new Date().toISOString().slice(0, 10);
  const { data: waterData } = useWaterIntake(today);
  const upsertWater = useUpsertWater();

  const { data: marketPrices = [] } = useMarketPrices();
  const [showTwoWeeks, setShowTwoWeeks] = useState(false);
  const nextWeekStart = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }, [weekStart]);
  const { data: nextPlan } = useMealPlan(nextWeekStart);
  const { data: nextMeals = [] } = useMeals(nextPlan?.id);

  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const groceryStorageKey = `grocery-${plan?.id ?? ""}`;
  useEffect(() => {
    try {
      const saved = localStorage.getItem(groceryStorageKey);
      setCheckedItems(saved ? new Set(JSON.parse(saved)) : new Set());
    } catch { setCheckedItems(new Set()); }
  }, [groceryStorageKey]);

  const toggleChecked = (itemKey: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemKey)) next.delete(itemKey);
      else next.add(itemKey);
      localStorage.setItem(groceryStorageKey, JSON.stringify([...next]));
      return next;
    });
  };

  const [editingSlot, setEditingSlot] = useState<{ day: number; type: MealType } | null>(null);
  const [showDueDate, setShowDueDate] = useState(false);
  const [dueDateInput, setDueDateInput] = useState("");

  const trimesterInfo = pregnancyProfile?.due_date ? getTrimester(pregnancyProfile.due_date) : null;

  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d.toISOString().slice(0, 10);
  }, [weekStart]);

  const prevWeekStart = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  }, [weekStart]);

  const getMeal = (day: number, type: MealType) =>
    meals.find((m: any) => m.day_of_week === day && m.meal_type === type);

  const filledCount = meals.length;
  const totalSlots = 35;

  const dailyNutrients = useMemo(() => {
    const todayDow = (new Date().getDay() + 6) % 7;
    const todayMeals = meals.filter((m: any) => m.day_of_week === todayDow);
    const covered = new Set<string>();
    todayMeals.forEach((m: any) => {
      m.meal_nutrition?.forEach((n: any) => covered.add(n.nutrient));
    });
    return covered;
  }, [meals]);

  const matchWarnings = (name: string) => {
    const lower = name.toLowerCase();
    return warnings.filter((w: any) => lower.includes(w.keyword.toLowerCase()));
  };

  const handleEnsurePlan = async () => {
    if (!plan) {
      await createPlan.mutateAsync(weekStart);
    }
  };

  const handleCopyPrevWeek = async () => {
    const { data: prevPlan } = await (await import("@/integrations/supabase/client")).supabase
      .from("meal_plans")
      .select("id")
      .eq("week_start", prevWeekStart)
      .maybeSingle();

    if (!prevPlan) {
      toast.error("No meal plan found for previous week");
      return;
    }

    await handleEnsurePlan();
    await copyWeek.mutateAsync({ fromPlanId: prevPlan.id, toWeekStart: weekStart });
    toast.success("Copied previous week's meals");
  };

  const handleGenerate = async () => {
    await handleEnsurePlan();
    const currentPlan = plan ?? (await createPlan.mutateAsync(weekStart));
    const prevMealNames = meals.map((m: any) => m.name);

    generatePlan.mutate({
      planId: currentPlan.id,
      trimester: trimesterInfo?.trimester,
      weeksPregnant: trimesterInfo?.weeksPregnant,
      previousMeals: prevMealNames.length > 0 ? prevMealNames : undefined,
    }, {
      onSuccess: () => toast.success("Meal plan generated!"),
      onError: (e) => toast.error(`AI generation failed: ${e.message}`),
    });
  };

  const waterGlasses = waterData?.glasses ?? 0;
  const waterGoal = waterData?.goal ?? 10;

  const groceryList = useMemo(() => {
    const allMeals = showTwoWeeks ? [...meals, ...nextMeals] : meals;

    // Pass 1: aggregate by shopping name + unit
    const byUnit = new Map<string, { name: string; qty: number; unit: string; mealCount: number; category: string }>();
    allMeals.forEach((m: any) => {
      m.meal_ingredients?.forEach((ing: any) => {
        const shoppingName = getShoppingName(ing.name);
        const norm = normalizeUnit(Number(ing.quantity || 0), ing.unit || "");
        const key = `${shoppingName.toLowerCase()}_${norm.unit}`;
        const existing = byUnit.get(key);
        if (existing) {
          existing.qty += norm.qty;
          existing.mealCount += 1;
        } else {
          byUnit.set(key, {
            name: shoppingName,
            qty: norm.qty,
            unit: norm.unit,
            mealCount: 1,
            category: categorizeIngredient(shoppingName),
          });
        }
      });
    });

    // Pass 2: merge same-name items with different units into one entry
    const merged = new Map<string, { name: string; quantities: { qty: number; unit: string }[]; mealCount: number; category: string }>();
    for (const item of byUnit.values()) {
      const key = item.name.toLowerCase();
      const d = displayUnit(item.qty, item.unit);
      const existing = merged.get(key);
      if (existing) {
        existing.quantities.push({ qty: d.qty, unit: d.unit });
        existing.mealCount += item.mealCount;
      } else {
        merged.set(key, {
          name: item.name,
          quantities: [{ qty: d.qty, unit: d.unit }],
          mealCount: item.mealCount,
          category: item.category,
        });
      }
    }

    return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [meals, nextMeals, showTwoWeeks]);

  const groceryByCategory = useMemo(() => {
    const grouped = new Map<string, typeof groceryList>();
    for (const item of groceryList) {
      if (!grouped.has(item.category)) grouped.set(item.category, []);
      grouped.get(item.category)!.push(item);
    }
    const order = ["Protein", "Produce", "Dairy", "Grains & Bread", "Spices & Oils", "Pantry & Legumes", "Other"];
    return order
      .filter(cat => grouped.has(cat))
      .map(cat => ({ category: cat, emoji: getCategoryEmoji(cat), items: grouped.get(cat)! }));
  }, [groceryList]);

  const totalEstimatedCost = useMemo(() => {
    const allMeals = showTwoWeeks ? [...meals, ...nextMeals] : meals;
    return allMeals.reduce((s: number, m: any) => s + Number(m.estimated_cost || 0), 0);
  }, [meals, nextMeals, showTwoWeeks]);

  // Calculate market-price-based costs for each grocery item
  const groceryWithPrices = useMemo(() => {
    if (marketPrices.length === 0) return groceryList.map(item => ({ ...item, marketCost: null as number | null }));
    return groceryList.map(item => {
      const match = lookupPrice(item.name, marketPrices);
      if (!match) return { ...item, marketCost: null as number | null };
      // Find the quantity in kg or pcs to compute cost
      let totalCost = 0;
      for (const q of item.quantities) {
        if (match.unit === "kg") {
          if (q.unit === "kg") totalCost += q.qty * match.price;
          else if (q.unit === "g") totalCost += (q.qty / 1000) * match.price;
          else totalCost += q.qty * match.price; // fallback: treat as kg
        } else if (match.unit === "pcs") {
          if (q.unit === "pcs") totalCost += q.qty * match.price;
          else totalCost += q.qty * match.price; // fallback
        } else {
          totalCost += q.qty * match.price;
        }
      }
      return { ...item, marketCost: Math.round(totalCost) };
    });
  }, [groceryList, marketPrices]);

  const totalMarketCost = useMemo(() => {
    return groceryWithPrices.reduce((s, item) => s + (item.marketCost || 0), 0);
  }, [groceryWithPrices]);

  const groceryByCategoryWithPrices = useMemo(() => {
    const grouped = new Map<string, typeof groceryWithPrices>();
    for (const item of groceryWithPrices) {
      if (!grouped.has(item.category)) grouped.set(item.category, []);
      grouped.get(item.category)!.push(item);
    }
    const order = ["Protein", "Produce", "Dairy", "Grains & Bread", "Spices & Oils", "Pantry & Legumes", "Other"];
    return order
      .filter(cat => grouped.has(cat))
      .map(cat => {
        const items = grouped.get(cat)!;
        const catCost = items.reduce((s, i) => s + (i.marketCost || 0), 0);
        return { category: cat, emoji: getCategoryEmoji(cat), items, catCost };
      });
  }, [groceryWithPrices]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <UtensilsCrossed className="h-6 w-6" /> Meal Planner
          </h2>
          <p className="text-sm text-muted-foreground">
            {filledCount}/{totalSlots} meals planned this week
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={handleGenerate}
            disabled={generatePlan.isPending}
          >
            {generatePlan.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1" />
            )}
            {generatePlan.isPending ? "Generating..." : "Generate with AI"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyPrevWeek} disabled={copyWeek.isPending}>
            <Copy className="h-4 w-4 mr-1" />Copy Last Week
          </Button>
          {!pregnancyProfile && (
            <Button variant="outline" size="sm" onClick={() => setShowDueDate(true)}>
              <Baby className="h-4 w-4 mr-1" />Set Due Date
            </Button>
          )}
        </div>
      </div>

      {/* Pregnancy & Trimester Info */}
      {trimesterInfo && (
        <Alert className="border-pink-200 bg-pink-50 dark:border-pink-900 dark:bg-pink-950/30">
          <Baby className="h-4 w-4 text-pink-500" />
          <AlertDescription className="text-sm">
            <span className="font-semibold">Trimester {trimesterInfo.trimester}</span> · Week {trimesterInfo.weeksPregnant} · Due {pregnancyProfile!.due_date}
            <br />
            <span className="text-muted-foreground">{TRIMESTER_TIPS[trimesterInfo.trimester]}</span>
          </AlertDescription>
        </Alert>
      )}

      {/* Week Navigator + Water Tracker */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset((o) => o - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[180px] text-center">
            {weekStart} → {weekEnd}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset((o) => o + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {weekOffset !== 0 && (
            <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>Today</Button>
          )}
        </div>

        {/* Water Tracker */}
        <div className="flex items-center gap-2">
          <Droplets className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium">{waterGlasses}/{waterGoal}</span>
          <div className="flex gap-0.5">
            {Array.from({ length: waterGoal }, (_, i) => (
              <button
                key={i}
                onClick={() => upsertWater.mutate({ date: today, glasses: i + 1 })}
                className={`w-3.5 h-5 rounded-sm transition-colors ${
                  i < waterGlasses ? "bg-blue-500" : "bg-secondary hover:bg-blue-200"
                }`}
                title={`${i + 1} glasses`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Today's Nutrition Checklist */}
      <div className="flex flex-wrap gap-2">
        {NUTRIENTS.map((n) => (
          <Badge
            key={n.key}
            variant={dailyNutrients.has(n.key) ? "default" : "outline"}
            className={`text-xs ${dailyNutrients.has(n.key) ? "bg-green-600" : "opacity-60"}`}
          >
            {n.emoji} {n.label}
          </Badge>
        ))}
      </div>

      {/* Tabs: Meal Plan / Grocery List */}
      <Tabs defaultValue="meal-plan">
        <TabsList>
          <TabsTrigger value="meal-plan" className="gap-1.5">
            <UtensilsCrossed className="h-3.5 w-3.5" /> Meal Plan
          </TabsTrigger>
          <TabsTrigger value="grocery" className="gap-1.5">
            <ShoppingCart className="h-3.5 w-3.5" /> Grocery List
            {groceryList.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{groceryList.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="meal-plan" className="mt-4">
          <div className="grid grid-cols-7 gap-2">
            {/* Day headers */}
            {DAYS.map((day, i) => {
              const d = new Date(weekStart);
              d.setDate(d.getDate() + i);
              const isToday = d.toISOString().slice(0, 10) === today;
              return (
                <div key={day} className={`text-center text-sm font-semibold py-1.5 rounded-t-md ${isToday ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {day}
                  <div className="text-[10px] font-normal opacity-75">{d.toISOString().slice(5, 10)}</div>
                </div>
              );
            })}

            {/* Meal slots */}
            {MEAL_TYPES.map((slot) => (
              DAYS.map((_, dayIdx) => {
                const meal = getMeal(dayIdx, slot.key);
                const mealWarnings = meal ? matchWarnings(meal.name) : [];
                return (
                  <button
                    key={`${dayIdx}-${slot.key}`}
                    onClick={async () => {
                      await handleEnsurePlan();
                      setEditingSlot({ day: dayIdx, type: slot.key });
                    }}
                    className={`border-l-4 ${MEAL_SLOT_COLORS[slot.key]} min-h-[60px] rounded-md border bg-card p-1.5 text-left hover:bg-accent/50 transition-colors relative`}
                  >
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{slot.short}</div>
                    {meal ? (
                      <>
                        <div className="text-xs font-medium truncate mt-0.5">{meal.name}</div>
                        {meal.is_batch && <Badge variant="outline" className="text-[9px] px-1 py-0 mt-0.5">Batch</Badge>}
                        {meal.estimated_cost && <div className="text-[10px] text-muted-foreground">{formatETB(Number(meal.estimated_cost))}</div>}
                        {mealWarnings.length > 0 && (
                          <AlertTriangle className="h-3 w-3 text-destructive absolute top-1.5 right-1.5" />
                        )}
                      </>
                    ) : (
                      <Plus className="h-3 w-3 text-muted-foreground mt-1 mx-auto" />
                    )}
                  </button>
                );
              })
            ))}
          </div>
        </TabsContent>

        <TabsContent value="grocery" className="mt-4 space-y-4">
          {groceryList.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No ingredients yet</p>
                <p className="text-sm mt-1">Generate a meal plan with AI to automatically populate the grocery list.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Switch checked={showTwoWeeks} onCheckedChange={setShowTwoWeeks} />
                  <Label className="text-sm">Include next week</Label>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {checkedItems.size}/{groceryList.length} items
                  </span>
                  {totalMarketCost > 0 ? (
                    <Badge variant="default" className="bg-green-600">Market: {formatETB(totalMarketCost)}</Badge>
                  ) : totalEstimatedCost > 0 ? (
                    <Badge variant="outline">Est. {formatETB(totalEstimatedCost)}</Badge>
                  ) : null}
                </div>
              </div>

              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${groceryList.length > 0 ? (checkedItems.size / groceryList.length) * 100 : 0}%` }}
                />
              </div>

              {groceryByCategoryWithPrices.map(({ category, emoji, items, catCost }) => {
                const doneCount = items.filter(i => checkedItems.has(i.name)).length;
                return (
                  <Card key={category}>
                    <CardHeader className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <span>{emoji}</span> {category}
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{items.length}</Badge>
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {catCost > 0 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{formatETB(catCost)}</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">{doneCount}/{items.length}</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y">
                        {items.map((item, i) => {
                          const itemKey = item.name;
                          const isChecked = checkedItems.has(itemKey);
                          return (
                            <button
                              key={i}
                              onClick={() => toggleChecked(itemKey)}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent/50 transition-colors ${isChecked ? "opacity-50" : ""}`}
                            >
                              <div className={`h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isChecked ? "bg-green-500 border-green-500" : "border-muted-foreground/30"}`}>
                                {isChecked && <Check className="h-3 w-3 text-white" />}
                              </div>
                              <span className={`flex-1 text-sm capitalize ${isChecked ? "line-through text-muted-foreground" : "font-medium"}`}>
                                {item.name}
                              </span>
                              <span className="text-sm text-muted-foreground tabular-nums">
                                {item.quantities.map((q) => {
                                  const val = q.qty % 1 === 0 ? q.qty : q.qty.toFixed(1);
                                  return `${val} ${q.unit}`;
                                }).join(", ")}
                              </span>
                              {item.marketCost != null && item.marketCost > 0 ? (
                                <span className="text-xs font-medium text-green-600 w-16 text-right">{formatETB(item.marketCost)}</span>
                              ) : (
                                <span className="text-xs text-muted-foreground w-16 text-right">{item.mealCount}x</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Meal Dialog */}
      {editingSlot && plan && (
        <MealDialog
          planId={plan.id}
          day={editingSlot.day}
          mealType={editingSlot.type}
          existing={getMeal(editingSlot.day, editingSlot.type)}
          warnings={warnings}
          onClose={() => setEditingSlot(null)}
          onSave={upsertMeal}
          onDelete={deleteMeal}
        />
      )}

      {/* Due Date Dialog */}
      <Dialog open={showDueDate} onOpenChange={setShowDueDate}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Set Due Date</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Expected due date</Label>
            <Input type="date" value={dueDateInput} onChange={(e) => setDueDateInput(e.target.value)} />
            <Button className="w-full" onClick={() => {
              if (dueDateInput) {
                upsertProfile.mutate(dueDateInput);
                setShowDueDate(false);
                toast.success("Due date saved");
              }
            }}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MealDialog({
  planId, day, mealType, existing, warnings, onClose, onSave, onDelete,
}: {
  planId: string;
  day: number;
  mealType: MealType;
  existing: any;
  warnings: any[];
  onClose: () => void;
  onSave: any;
  onDelete: any;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [isBatch, setIsBatch] = useState(existing?.is_batch ?? false);
  const [batchDays, setBatchDays] = useState(existing?.batch_days ?? 1);
  const [cost, setCost] = useState(existing?.estimated_cost?.toString() ?? "");
  const [selectedNutrients, setSelectedNutrients] = useState<Nutrient[]>(
    existing?.meal_nutrition?.map((n: any) => n.nutrient) ?? []
  );

  const mealWarnings = name ? warnings.filter((w: any) => name.toLowerCase().includes(w.keyword.toLowerCase())) : [];

  const toggleNutrient = (n: Nutrient) => {
    setSelectedNutrients((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]
    );
  };

  const handleSave = () => {
    if (!name.trim()) { toast.error("Meal name required"); return; }
    onSave.mutate({
      plan_id: planId,
      day_of_week: day,
      meal_type: mealType,
      name: name.trim(),
      notes: notes || null,
      is_batch: isBatch,
      batch_days: isBatch ? batchDays : 1,
      estimated_cost: cost ? parseFloat(cost) : null,
      nutrients: selectedNutrients,
    }, {
      onSuccess: () => { toast.success("Meal saved"); onClose(); },
      onError: (e: any) => toast.error(e.message),
    });
  };

  const handleDelete = () => {
    if (!existing) return;
    onDelete.mutate({ id: existing.id, planId }, {
      onSuccess: () => { toast.success("Meal removed"); onClose(); },
    });
  };

  const label = MEAL_TYPES.find((m) => m.key === mealType)?.label ?? mealType;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{DAYS[day]} — {label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Warnings */}
          {mealWarnings.length > 0 && (
            <Alert variant="destructive" className="py-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {mealWarnings.map((w: any) => (
                  <div key={w.id}>
                    <span className="font-semibold capitalize">{w.severity}:</span> {w.warning}
                  </div>
                ))}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Meal Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Shiro with Injera" autoFocus />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." className="h-16" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Est. Cost (ETB)</Label>
              <Input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Switch checked={isBatch} onCheckedChange={setIsBatch} />
                <Label className="text-sm">Batch cook</Label>
              </div>
              {isBatch && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Lasts</Label>
                  <Input type="number" min={1} max={7} value={batchDays} onChange={(e) => setBatchDays(parseInt(e.target.value) || 1)} className="w-16 h-8" />
                  <Label className="text-xs text-muted-foreground">days</Label>
                </div>
              )}
            </div>
          </div>

          {/* Nutrition Tags */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Nutrition Tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {NUTRIENTS.map((n) => (
                <button
                  key={n.key}
                  type="button"
                  onClick={() => toggleNutrient(n.key)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    selectedNutrients.includes(n.key)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary hover:bg-accent"
                  }`}
                >
                  {n.emoji} {n.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ingredients (from AI) */}
          {existing?.meal_ingredients?.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Ingredients</Label>
              <div className="rounded-md border divide-y text-sm max-h-40 overflow-y-auto">
                {existing.meal_ingredients.map((ing: any) => (
                  <div key={ing.id} className="flex items-center justify-between px-3 py-1.5">
                    <span className="capitalize">{ing.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {ing.quantity && (Number(ing.quantity) % 1 === 0 ? Number(ing.quantity) : Number(ing.quantity).toFixed(2))}{" "}
                      {ing.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={handleSave} disabled={onSave.isPending}>Save</Button>
            {existing && (
              <Button variant="destructive" onClick={handleDelete} disabled={onDelete.isPending}>Remove</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
