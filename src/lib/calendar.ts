// Build "Add to Google Calendar" links for planned meals.
// Uses Google's TEMPLATE render URL — no login/API, opens a prefilled event.
// Times are floating-local (no timezone suffix) so Google uses the user's tz.

import type { MealType } from "@/hooks/useMealData";

// Default time-of-day + duration per meal slot.
const SLOT_TIME: Record<MealType, { h: number; m: number; durMin: number }> = {
  breakfast:       { h: 8,  m: 0,  durMin: 30 },
  morning_snack:   { h: 10, m: 30, durMin: 15 },
  lunch:           { h: 13, m: 0,  durMin: 45 },
  afternoon_snack: { h: 16, m: 0,  durMin: 15 },
  dinner:          { h: 19, m: 30, durMin: 45 },
};

const pad = (n: number) => String(n).padStart(2, "0");

const fmtLocal = (d: Date) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

const fmtQty = (q: number) => (q % 1 === 0 ? String(q) : q.toFixed(2));

export type CalMeal = {
  name: string;
  meal_type: MealType;
  day_of_week: number; // 0 = Monday (matches weekStart)
  notes?: string | null;
  estimated_cost?: number | string | null;
  meal_ingredients?: { name: string; quantity?: number | string | null; unit?: string | null }[];
};

export function googleCalendarUrl(meal: CalMeal, weekStart: string, household = 1): string {
  const slot = SLOT_TIME[meal.meal_type] ?? SLOT_TIME.dinner;

  // weekStart = Monday ISO "YYYY-MM-DD"; add day_of_week days for this meal.
  const [y, m, d] = weekStart.split("-").map(Number);
  const start = new Date(y, m - 1, d + meal.day_of_week, slot.h, slot.m);
  const end = new Date(start.getTime() + slot.durMin * 60000);

  const lines: string[] = [];
  if (meal.notes) lines.push(meal.notes);
  if (meal.meal_ingredients?.length) {
    lines.push("Ingredients:");
    for (const ing of meal.meal_ingredients) {
      const q =
        ing.quantity != null
          ? `${fmtQty(Number(ing.quantity))} ${ing.unit ?? ""}`.trim()
          : "";
      lines.push(`• ${ing.name}${q ? ` — ${q}` : ""}`);
    }
  }
  const cost = Number(meal.estimated_cost) * household;
  if (cost > 0) lines.push(`Est. cost: ${cost.toFixed(0)} ETB (feeds ${household})`);
  lines.push("", "Added from Family CFO");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: meal.name,
    dates: `${fmtLocal(start)}/${fmtLocal(end)}`,
    details: lines.join("\n"),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
