import { lookupPrice, type MarketPrice } from "@/hooks/useMarketPrices";

// ── Category definitions ──

export const GROCERY_CATEGORIES = [
  { label: "Protein", emoji: "\u{1F969}", keywords: ["chicken", "beef", "lamb", "fish", "tilapia", "salmon", "shrimp", "egg", "tuna", "turkey", "meatball", "mince", "ground meat", "steak", "cod"] },
  { label: "Produce", emoji: "\u{1F96C}", keywords: ["onion", "tomato", "garlic", "ginger", "carrot", "potato", "lettuce", "spinach", "kale", "avocado", "lemon", "lime", "orange", "banana", "apple", "mango", "papaya", "watermelon", "pepper", "cucumber", "broccoli", "asparagus", "zucchini", "mushroom", "corn", "cabbage", "celery", "pea", "beetroot", "sweet potato", "berry", "berries", "grape", "guava", "pineapple", "strawberry", "blueberry", "date", "fig", "peach", "pear", "mixed greens", "green"] },
  { label: "Dairy", emoji: "\u{1F9C0}", keywords: ["milk", "cheese", "yogurt", "butter", "cream", "ayib", "curd", "sour cream"] },
  { label: "Grains & Bread", emoji: "\u{1F33E}", keywords: ["bread", "toast", "injera", "pasta", "rice", "flour", "oat", "barley", "teff", "wheat", "tortilla", "noodle", "granola", "cereal", "kollo", "spaghetti", "penne", "macaroni", "kinche", "pancake", "cracker", "pita", "dough"] },
  { label: "Spices & Oils", emoji: "\u{1F9C2}", keywords: ["berbere", "salt", "cumin", "turmeric", "cinnamon", "oregano", "basil", "oil", "olive", "vinegar", "soy sauce", "mustard", "mitmita", "cardamom", "clove", "rosemary", "thyme", "paprika", "chili", "dressing", "vinaigrette", "sauce", "ketchup", "mayo", "mayonnaise", "syrup"] },
  { label: "Pantry & Legumes", emoji: "\u{1FAD8}", keywords: ["lentil", "chickpea", "bean", "split pea", "shiro", "peanut", "almond", "nut", "walnut", "cashew", "sesame", "sunflower", "canned", "paste", "broth", "stock", "honey", "sugar", "jam", "tea", "coffee", "hummus", "fava"] },
];

// ── Shopping name groups ──

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

// ── Helper functions ──

export function getShoppingName(ingredientName: string): string {
  const name = ingredientName.toLowerCase();
  for (const group of SHOPPING_GROUPS) {
    if (group.match.test(name) && !group.exclude.test(name)) return group.name;
  }
  return ingredientName.charAt(0).toUpperCase() + ingredientName.slice(1).toLowerCase();
}

export function normalizeUnit(qty: number, unit: string): { qty: number; unit: string } {
  const u = unit.toLowerCase().trim().replace(/s$/, "");
  if (u === "kg") return { qty: qty * 1000, unit: "g" };
  if (u === "l" || u === "liter" || u === "litre") return { qty: qty * 1000, unit: "ml" };
  if (u === "cup") return { qty: qty * 240, unit: "ml" };
  if (u === "tbsp") return { qty: qty * 15, unit: "ml" };
  if (u === "tsp") return { qty: qty * 5, unit: "ml" };
  if (u === "piece" || u === "pc" || u === "pcs") return { qty, unit: "pcs" };
  if (u === "clove") return { qty, unit: "pcs" };
  return { qty, unit: u };
}

export function displayUnit(qty: number, unit: string): { qty: number; unit: string } {
  if (unit === "g" && qty >= 1000) return { qty: +(qty / 1000).toFixed(2), unit: "kg" };
  if (unit === "ml" && qty >= 1000) return { qty: +(qty / 1000).toFixed(1), unit: "L" };
  if (unit === "ml") return { qty: Math.round(qty), unit: "ml" };
  return { qty, unit };
}

export function categorizeIngredient(name: string): string {
  const lower = name.toLowerCase();
  for (const cat of GROCERY_CATEGORIES) {
    if (cat.keywords.some(kw => lower.includes(kw))) return cat.label;
  }
  return "Other";
}

export function getCategoryEmoji(label: string): string {
  return GROCERY_CATEGORIES.find(c => c.label === label)?.emoji ?? "\u{1F4E6}";
}

// ── Types ──

export type GroceryItem = {
  name: string;
  quantities: { qty: number; unit: string }[];
  mealCount: number;
  category: string;
};

export type GroceryItemWithCost = GroceryItem & {
  marketCost: number | null;
};

// ── Aggregation ──

/**
 * Aggregate meal ingredients into a deduplicated grocery list.
 * Pass 1: group by shopping name + normalized unit
 * Pass 2: merge same-name items with different units
 */
export function aggregateGroceryList(meals: any[]): GroceryItem[] {
  const byUnit = new Map<string, { name: string; qty: number; unit: string; mealCount: number; category: string }>();

  meals.forEach((m: any) => {
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

  const merged = new Map<string, GroceryItem>();
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
}

/**
 * Attach market-price-based costs to each grocery item.
 */
export function addMarketCosts(
  items: GroceryItem[],
  marketPrices: MarketPrice[]
): GroceryItemWithCost[] {
  if (marketPrices.length === 0) {
    return items.map(item => ({ ...item, marketCost: null }));
  }
  return items.map(item => {
    const match = lookupPrice(item.name, marketPrices);
    if (!match) return { ...item, marketCost: null };

    let totalCost = 0;
    for (const q of item.quantities) {
      if (match.unit === "kg") {
        if (q.unit === "kg") totalCost += q.qty * match.price;
        else if (q.unit === "g") totalCost += (q.qty / 1000) * match.price;
        else totalCost += q.qty * match.price;
      } else if (match.unit === "pcs") {
        totalCost += q.qty * match.price;
      } else {
        totalCost += q.qty * match.price;
      }
    }
    return { ...item, marketCost: Math.round(totalCost) };
  });
}

/**
 * Group grocery items by category in display order.
 */
export function groupByCategory<T extends GroceryItem>(items: T[]) {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    if (!grouped.has(item.category)) grouped.set(item.category, []);
    grouped.get(item.category)!.push(item);
  }
  const order = ["Protein", "Produce", "Dairy", "Grains & Bread", "Spices & Oils", "Pantry & Legumes", "Other"];
  return order
    .filter(cat => grouped.has(cat))
    .map(cat => ({
      category: cat,
      emoji: getCategoryEmoji(cat),
      items: grouped.get(cat)!,
      catCost: grouped.get(cat)!.reduce((s, i) => s + ((i as any).marketCost || 0), 0),
    }));
}
