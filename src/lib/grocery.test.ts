import { describe, it, expect } from "vitest";
import { aggregateGroceryList, addMarketCosts, normalizeUnit } from "@/lib/grocery";
import type { MarketPrice } from "@/hooks/useMarketPrices";

// Market prices mirroring the user's ChipChip list (per kg unless noted)
const PRICES: MarketPrice[] = [
  { id: "1", name: "broccoli", name_amharic: null, price: 167, unit: "kg", category: "Vegetables", source: "t", updated_at: "" },
  { id: "2", name: "lettuce", name_amharic: null, price: 189, unit: "kg", category: "Leafy Greens", source: "t", updated_at: "" },
  { id: "3", name: "carrot", name_amharic: null, price: 90, unit: "kg", category: "Vegetables", source: "t", updated_at: "" },
  { id: "4", name: "garlic", name_amharic: null, price: 167, unit: "kg", category: "Vegetables", source: "t", updated_at: "" },
  { id: "5", name: "lemon", name_amharic: null, price: 159, unit: "kg", category: "Fruits", source: "t", updated_at: "" },
  { id: "6", name: "avocado", name_amharic: null, price: 122, unit: "kg", category: "Fruits", source: "t", updated_at: "" },
  { id: "7", name: "banana", name_amharic: null, price: 106, unit: "kg", category: "Fruits", source: "t", updated_at: "" },
  { id: "8", name: "apple", name_amharic: null, price: 1172, unit: "pcs", category: "Fruits", source: "t", updated_at: "" },
  { id: "9", name: "green chili", name_amharic: null, price: 159, unit: "kg", category: "Chilies", source: "t", updated_at: "" },
];

function meal(ingredients: { name: string; quantity: number; unit: string }[]) {
  return { meal_ingredients: ingredients.map(i => ({ name: i.name, quantity: i.quantity, unit: i.unit })) };
}

describe("normalizeUnit — solids never become ml", () => {
  it("converts a cup of broccoli (solid) to grams, not ml", () => {
    expect(normalizeUnit(1, "cup", "broccoli")).toEqual({ qty: 90, unit: "g" });
  });
  it("keeps a cup of milk (liquid) as ml", () => {
    expect(normalizeUnit(1, "cup", "milk")).toEqual({ qty: 240, unit: "ml" });
  });
  it("converts garlic cloves to grams", () => {
    expect(normalizeUnit(2, "cloves", "garlic")).toEqual({ qty: 6, unit: "g" });
  });
});

describe("addMarketCosts — realistic, not inflated", () => {
  const cost = (name: string, qty: number, unit: string) => {
    const list = aggregateGroceryList([meal([{ name, quantity: qty, unit }])]);
    return addMarketCosts(list, PRICES)[0].marketCost;
  };

  it("broccoli: 1 cup ≈ 15 ETB (was 40,080)", () => {
    expect(cost("broccoli", 1, "cup")).toBe(15); // 90g → 0.09kg × 167
  });
  it("lettuce: 1 cup ≈ 10 ETB (was 45,360)", () => {
    expect(cost("lettuce", 1, "cup")).toBe(10); // 55g × 189/kg
  });
  it("garlic: 2 cloves ≈ 1 ETB (was 835)", () => {
    expect(cost("garlic", 2, "cloves")).toBe(1); // 6g × 167/kg
  });
  it("avocado: 0.5 pcs ≈ 12 ETB (was 61)", () => {
    expect(cost("avocado", 0.5, "pcs")).toBe(12); // 0.5 × 200g × 122/kg
  });
  it("banana: 1.5 pcs ≈ 19 ETB (was 159)", () => {
    expect(cost("banana", 1.5, "pcs")).toBe(19); // 1.5 × 120g × 106/kg
  });
  it("apple: 0.5 pcs = 586 ETB (priced per pcs, stays correct)", () => {
    expect(cost("apple", 0.5, "pcs")).toBe(586); // 0.5 × 1172/pcs
  });
  it("carrot: 4 pcs + 0.5 cup reconciles both units", () => {
    const list = aggregateGroceryList([
      meal([{ name: "carrot", quantity: 4, unit: "pcs" }]),
      meal([{ name: "carrot", quantity: 0.5, unit: "cup" }]),
    ]);
    // 4×65g + 0.5×128g = 260 + 64 = 324g → 0.324kg × 90 = 29
    expect(addMarketCosts(list, PRICES)[0].marketCost).toBe(29);
  });
  it("returns null (no wrong number) when no price match exists", () => {
    expect(cost("quinoa", 200, "g")).toBeNull();
  });
});

describe("lookupPrice — no false matches", () => {
  it("does NOT match 'Mixed Greens' to 'Green Chili'", () => {
    const list = aggregateGroceryList([meal([{ name: "mixed greens", quantity: 100, unit: "g" }])]);
    // No mixed-greens price → should be null, NOT the green chili price
    expect(addMarketCosts(list, PRICES)[0].marketCost).toBeNull();
  });
});
