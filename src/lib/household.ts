// Household size — how many people the meal plan feeds. Meal costs and
// ingredient quantities are stored per-person; the UI multiplies by this.

const STORAGE_KEY = "familycfo.householdSize";
export const DEFAULT_HOUSEHOLD_SIZE = 3;

export function loadHouseholdSize(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_HOUSEHOLD_SIZE;
    const n = Math.round(Number(raw));
    return n >= 1 && n <= 20 ? n : DEFAULT_HOUSEHOLD_SIZE;
  } catch {
    return DEFAULT_HOUSEHOLD_SIZE;
  }
}

export function saveHouseholdSize(size: number): void {
  const n = Math.max(1, Math.min(20, Math.round(size) || DEFAULT_HOUSEHOLD_SIZE));
  try {
    localStorage.setItem(STORAGE_KEY, String(n));
  } catch {
    /* ignore */
  }
}

/** Scale per-person meal ingredient quantities by household size before aggregation. */
export function scaleMealsForHousehold<T extends { estimated_cost?: number | null; meal_ingredients?: Array<{ quantity: number | null }> }>(
  meals: T[],
  size: number,
): T[] {
  if (size === 1) return meals;
  return meals.map((m) => ({
    ...m,
    estimated_cost: m.estimated_cost != null ? Number(m.estimated_cost) * size : m.estimated_cost,
    meal_ingredients: m.meal_ingredients?.map((ing) => ({
      ...ing,
      quantity: ing.quantity != null ? Number(ing.quantity) * size : ing.quantity,
    })),
  }));
}
