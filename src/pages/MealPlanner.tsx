import { useState, useMemo } from "react";
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
import {
  ChevronLeft, ChevronRight, Plus, Copy, AlertTriangle, Droplets,
  UtensilsCrossed, Baby,
} from "lucide-react";
import {
  useMealPlan, useMeals, useCreateMealPlan, useUpsertMeal, useDeleteMeal,
  useFoodWarnings, useWaterIntake, useUpsertWater,
  usePregnancyProfile, useUpsertPregnancyProfile,
  useCopyWeek, getTrimester, getWeekStart,
  MEAL_TYPES, DAYS, NUTRIENTS, type MealType, type Nutrient,
} from "@/hooks/useMealData";
import { formatETB } from "@/lib/format";

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
  const upsertProfile = useUpsertPregnancyProfile();

  const today = new Date().toISOString().slice(0, 10);
  const { data: waterData } = useWaterIntake(today);
  const upsertWater = useUpsertWater();

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

  const waterGlasses = waterData?.glasses ?? 0;
  const waterGoal = waterData?.goal ?? 10;

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

      {/* Weekly Grid */}
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
