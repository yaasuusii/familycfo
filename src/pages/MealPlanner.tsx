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
  UtensilsCrossed, Baby, Sparkles, Loader2, ShoppingCart, Check, CalendarPlus,
} from "lucide-react";
import { googleCalendarUrl } from "@/lib/calendar";
import {
  useMealPlan, useMeals, useCreateMealPlan, useUpsertMeal, useDeleteMeal,
  useFoodWarnings, useWaterIntake, useUpsertWater,
  usePregnancyProfile, useUpsertPregnancyProfile,
  useCopyWeek, useGenerateMealPlan, getTrimester, getWeekStart,
  MEAL_TYPES, DAYS, NUTRIENTS, type MealType, type Nutrient,
} from "@/hooks/useMealData";
import { formatETB } from "@/lib/format";
import { loadHouseholdSize, scaleMealsForHousehold } from "@/lib/household";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import {
  GROCERY_CATEGORIES, getCategoryEmoji,
  aggregateGroceryList, addMarketCosts, groupByCategory,
} from "@/lib/grocery";

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

// Grocery aggregation logic is in @/lib/grocery

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

  const householdSize = useMemo(() => loadHouseholdSize(), []);

  const allMealsForGrocery = useMemo(
    () => scaleMealsForHousehold(showTwoWeeks ? [...meals, ...nextMeals] : meals, householdSize),
    [meals, nextMeals, showTwoWeeks, householdSize]
  );

  const groceryList = useMemo(
    () => aggregateGroceryList(allMealsForGrocery),
    [allMealsForGrocery]
  );

  const groceryWithPrices = useMemo(
    () => addMarketCosts(groceryList, marketPrices),
    [groceryList, marketPrices]
  );

  const totalMarketCost = useMemo(
    () => groceryWithPrices.reduce((s, item) => s + (item.buyCost ?? item.marketCost ?? 0), 0),
    [groceryWithPrices]
  );

  const totalEstimatedCost = useMemo(
    () => allMealsForGrocery.reduce((s: number, m: any) => s + Number(m.estimated_cost || 0), 0),
    [allMealsForGrocery]
  );

  const groceryByCategoryWithPrices = useMemo(
    () => groupByCategory(groceryWithPrices),
    [groceryWithPrices]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Family CFO</p>
          <h2 className="flex items-center gap-2 font-display text-3xl font-semibold tracking-tight">
            <UtensilsCrossed className="h-6 w-6 text-primary" /> Meal Planner
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {filledCount}/{totalSlots} meals planned · feeds {householdSize} {householdSize === 1 ? "person" : "people"}
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
                        {meal.estimated_cost && <div className="text-[10px] text-muted-foreground">{formatETB(Number(meal.estimated_cost) * householdSize)}</div>}
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

              <div className="columns-1 lg:columns-2 gap-4 [column-fill:_balance]">
              {groceryByCategoryWithPrices.map(({ category, emoji, items, catCost }) => {
                const doneCount = items.filter(i => checkedItems.has(i.name)).length;
                return (
                  <Card key={category} className="break-inside-avoid mb-4">
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
                          const fmt = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(1));
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
                              <div className="flex flex-col items-end leading-tight">
                                {item.buyQty != null ? (
                                  <>
                                    <span className="text-sm text-foreground tabular-nums">
                                      Buy {fmt(item.buyQty)} {item.buyUnit}
                                    </span>
                                    {item.neededQty != null && (
                                      <span className="text-[11px] text-muted-foreground/70 tabular-nums">
                                        needs ~{fmt(item.neededQty)} {item.neededUnit}
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-sm text-muted-foreground tabular-nums">
                                    {item.quantities.map((q) => `${fmt(q.qty)} ${q.unit}`).join(", ")}
                                  </span>
                                )}
                              </div>
                              {item.buyCost != null && item.buyCost > 0 ? (
                                <span className="text-xs font-medium text-green-600 w-16 text-right">{formatETB(item.buyCost)}</span>
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
              </div>
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
          weekStart={weekStart}
          household={householdSize}
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
  planId, day, mealType, existing, warnings, weekStart, household, onClose, onSave, onDelete,
}: {
  planId: string;
  day: number;
  mealType: MealType;
  existing: any;
  warnings: any[];
  weekStart: string;
  household: number;
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

          {existing && (
            <Button asChild variant="outline" className="w-full">
              <a
                href={googleCalendarUrl(
                  {
                    name: name.trim() || existing.name,
                    meal_type: mealType,
                    day_of_week: day,
                    notes,
                    estimated_cost: cost ? parseFloat(cost) : existing.estimated_cost,
                    meal_ingredients: existing.meal_ingredients,
                  },
                  weekStart,
                  household,
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                <CalendarPlus className="mr-2 h-4 w-4" /> Add to Google Calendar
              </a>
            </Button>
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
