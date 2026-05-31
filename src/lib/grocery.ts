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

// Ingredients genuinely measured by volume — a "cup" of these stays ml.
const LIQUID_KEYWORDS = [
  "oil", "milk", "water", "broth", "stock", "juice", "vinegar",
  "sauce", "syrup", "honey", "wine", "cream",
];

function isLiquid(name: string): boolean {
  const lower = name.toLowerCase();
  return LIQUID_KEYWORDS.some(kw => lower.includes(kw));
}

// Approximate grams per single piece, keyed by substring of the shopping name.
// Used to reconcile pcs ↔ kg when an item is counted but priced by weight.
// Longer keys first so "sweet potato" wins over "potato".
const WEIGHT_PER_PIECE: [string, number][] = [
  ["sweet potato", 200], ["bell pepper", 120], ["red onion", 150],
  ["watermelon", 4000], ["pineapple", 1000], ["cabbage", 1000],
  ["broccoli", 350], ["lettuce", 300], ["cucumber", 300], ["eggplant", 250],
  ["zucchini", 200], ["avocado", 200], ["potato", 170], ["beetroot", 150],
  ["onion", 150], ["orange", 130], ["banana", 120], ["tomato", 120],
  ["mango", 200], ["lemon", 100], ["apple", 180], ["papaya", 1000],
  ["lime", 70], ["carrot", 65], ["egg", 50], ["garlic", 45],
  ["celery", 40], ["ginger", 30], ["chili", 15], ["pepper", 120],
];

// Approximate grams per cup for chopped/loose solids. Default 120g.
const GRAMS_PER_CUP: [string, number][] = [
  ["spinach", 30], ["lettuce", 55], ["kale", 65], ["mushroom", 70],
  ["broccoli", 90], ["cabbage", 90], ["oats", 90], ["cauliflower", 100],
  ["pepper", 150], ["berries", 150], ["onion", 160], ["corn", 165],
  ["tomato", 180], ["beans", 180], ["lentil", 190], ["chickpea", 200],
  ["rice", 200], ["sugar", 200], ["flour", 125], ["cheese", 110], ["carrot", 128],
];

function tableLookup(name: string, table: [string, number][]): number | null {
  const lower = name.toLowerCase();
  for (const [key, val] of table) {
    if (lower.includes(key)) return val;
  }
  return null;
}

export function pieceGrams(name: string): number | null {
  return tableLookup(name, WEIGHT_PER_PIECE);
}

export function cupGrams(name: string): number {
  return tableLookup(name, GRAMS_PER_CUP) ?? 120;
}

// ── Realistic purchase quantities ──
// You don't buy "1.5 bananas" or "6 g of garlic" — you buy in the chunks the
// market actually sells. Round each item UP to a sensible minimum/increment so
// the cost reflects what you'd really spend (surplus stays in the pantry).

const AROMATIC_KEYWORDS = ["garlic", "ginger", "chili", "chilli", "chile"];
const MEAT_FISH_KEYWORDS = [
  "chicken", "beef", "lamb", "goat", "mutton", "turkey", "meatball", "mince",
  "steak", "fish", "tilapia", "salmon", "tuna", "cod", "shrimp", "prawn",
];

/**
 * Grams to round UP to for a weight-priced item:
 *   aromatics (garlic, ginger, chili) → 100 g
 *   meat & fish                       → 500 g (0.5 kg)
 *   everything else (fruit & veg…)    → 1000 g (1 kg)
 */
export function buyIncrementGrams(name: string): number {
  const lower = name.toLowerCase();
  if (AROMATIC_KEYWORDS.some(k => lower.includes(k))) return 100;
  if (MEAT_FISH_KEYWORDS.some(k => lower.includes(k))) return 500;
  return 1000;
}

function roundUpTo(value: number, increment: number): number {
  if (value <= 0) return increment;
  return Math.ceil(value / increment) * increment;
}

/**
 * Normalize a raw ingredient quantity to a display base unit:
 *   solids → g, liquids → ml, countables → pcs
 * Volume units (cup/tbsp/tsp) on SOLIDS convert to grams (not ml),
 * so chopped broccoli shows "90 g" instead of "240 ml".
 */
export function normalizeUnit(qty: number, unit: string, name = ""): { qty: number; unit: string } {
  const u = unit.toLowerCase().trim().replace(/s$/, "");
  const liquid = isLiquid(name);

  // Weight
  if (u === "kg") return { qty: qty * 1000, unit: "g" };
  if (u === "g" || u === "gram" || u === "gm") return { qty, unit: "g" };

  // Volume → ml for liquids, grams for solids
  if (u === "l" || u === "liter" || u === "litre") return { qty: qty * 1000, unit: liquid ? "ml" : "g" };
  if (u === "ml") return { qty, unit: liquid ? "ml" : "g" };
  if (u === "cup") return liquid ? { qty: qty * 240, unit: "ml" } : { qty: qty * cupGrams(name), unit: "g" };
  if (u === "tbsp") return liquid ? { qty: qty * 15, unit: "ml" } : { qty: qty * 15, unit: "g" };
  if (u === "tsp") return liquid ? { qty: qty * 5, unit: "ml" } : { qty: qty * 5, unit: "g" };

  // Count
  if (u === "piece" || u === "pc" || u === "pcs") return { qty, unit: "pcs" };
  if (u === "clove") return { qty: qty * 3, unit: "g" };   // a garlic clove ≈ 3 g
  if (u === "stalk" || u === "stick") return { qty, unit: "pcs" };

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
  marketCost: number | null;   // precise cost of exactly what the recipes need
  buyCost: number | null;      // realistic cost of what you'd actually purchase
  buyQty: number | null;       // purchase amount, rounded up to a realistic minimum
  buyUnit: string | null;      // "kg" | "g" | "pcs"
  neededQty: number | null;    // recipe requirement, displayed in the buyUnit family
  neededUnit: string | null;
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
      const norm = normalizeUnit(Number(ing.quantity || 0), ing.unit || "", shoppingName);
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

/** Convert a display quantity to grams. Returns null if not reconcilable. */
function toGrams(name: string, qty: number, unit: string): number | null {
  switch (unit) {
    case "g": return qty;
    case "kg": return qty * 1000;
    case "ml": return qty;          // 1 ml ≈ 1 g (water-like approximation)
    case "L": return qty * 1000;
    case "pcs": {
      const pg = pieceGrams(name);
      return pg != null ? qty * pg : null;
    }
    default: return null;
  }
}

/** Convert a display quantity to a piece count. Returns null if not reconcilable. */
function toPcs(name: string, qty: number, unit: string): number | null {
  if (unit === "pcs") return qty;
  const grams = toGrams(name, qty, unit);
  const pg = pieceGrams(name);
  return grams != null && pg ? grams / pg : null;
}

/**
 * Attach market-price-based costs to each grocery item.
 *
 * Market prices are stored per kg or per pcs. We reconcile the grocery
 * quantity to the SAME unit the price uses (converting via weight-per-piece
 * estimates when needed). If ANY portion can't be reconciled, the costs are
 * null (the UI shows "—") rather than a misleading number.
 *
 * Two costs are produced per item:
 *   - marketCost: the precise cost of exactly what the recipes consume
 *   - buyCost:    the cost of the realistic purchase amount (rounded UP to how
 *                 you actually shop — 1 kg of bananas, not 1.5 pieces)
 */
export function addMarketCosts(
  items: GroceryItem[],
  marketPrices: MarketPrice[]
): GroceryItemWithCost[] {
  const nullCost = (item: GroceryItem): GroceryItemWithCost => ({
    ...item,
    marketCost: null, buyCost: null,
    buyQty: null, buyUnit: null, neededQty: null, neededUnit: null,
  });

  if (marketPrices.length === 0) {
    return items.map(nullCost);
  }
  return items.map(item => {
    const match = lookupPrice(item.name, marketPrices);
    if (!match) return nullCost(item);

    if (match.unit === "kg") {
      let grams = 0;
      for (const q of item.quantities) {
        const g = toGrams(item.name, q.qty, q.unit);
        if (g == null) return nullCost(item);
        grams += g;
      }
      const buyGrams = roundUpTo(grams, buyIncrementGrams(item.name));
      const buyD = displayUnit(buyGrams, "g");
      const needD = displayUnit(Math.round(grams), "g");
      return {
        ...item,
        marketCost: Math.round((grams / 1000) * match.price),
        buyCost: Math.round((buyGrams / 1000) * match.price),
        buyQty: buyD.qty, buyUnit: buyD.unit,
        neededQty: needD.qty, neededUnit: needD.unit,
      };
    }

    if (match.unit === "pcs") {
      let pcs = 0;
      for (const q of item.quantities) {
        const p = toPcs(item.name, q.qty, q.unit);
        if (p == null) return nullCost(item);
        pcs += p;
      }
      const buyPcs = Math.max(1, Math.ceil(pcs));
      return {
        ...item,
        marketCost: Math.round(pcs * match.price),
        buyCost: Math.round(buyPcs * match.price),
        buyQty: buyPcs, buyUnit: "pcs",
        neededQty: +pcs.toFixed(1), neededUnit: "pcs",
      };
    }

    return nullCost(item);
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
      catCost: grouped.get(cat)!.reduce(
        (s, i) => s + ((i as any).buyCost ?? (i as any).marketCost ?? 0), 0),
    }));
}
