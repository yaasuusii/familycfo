import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type MarketPrice = {
  id: string;
  name: string;
  name_amharic: string | null;
  price: number;
  unit: string;
  category: string | null;
  source: string;
  updated_at: string;
};

export type ParsedPrice = {
  name: string;
  nameAmharic: string;
  price: number;
  unit: string;
  category: string;
};

export function useMarketPrices() {
  return useQuery({
    queryKey: ["market_prices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("market_prices")
        .select("*")
        .order("category")
        .order("name");
      if (error) throw error;
      return data as MarketPrice[];
    },
  });
}

export function useSaveMarketPrices() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (prices: ParsedPrice[]) => {
      // Upsert all parsed prices
      const rows = prices.map((p) => ({
        name: p.name.toLowerCase(),
        name_amharic: p.nameAmharic || null,
        price: p.price,
        unit: p.unit,
        category: p.category,
        source: "telegram",
        updated_at: new Date().toISOString(),
        created_by: user!.id,
      }));

      const { error } = await supabase
        .from("market_prices")
        .upsert(rows, { onConflict: "name" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["market_prices"] });
    },
  });
}

/**
 * Parse a price list text (from Telegram channel format) into structured data.
 *
 * Expected format per line:
 *   🧅 Red Onion Habesha (ሽንኩርት ሀበሻ) = 126 ETB/kg
 *   🍅 Tomato A (ቲማቲም A) = 86 ETB/kg
 *
 * Also handles lines without Amharic:
 *   🥕 Carrot = 90 ETB/kg
 */
export function parsePriceList(text: string): ParsedPrice[] {
  const results: ParsedPrice[] = [];
  let currentCategory = "Other";

  const categoryPatterns: Record<string, RegExp> = {
    Vegetables: /VEGETABLES|አትክልት/i,
    "Leafy Greens": /LEAFY GREENS|HERBS|ቅጠላ/i,
    Chilies: /CHILIES|ቃሪያ/i,
    Fruits: /FRUITS|ፍራፍሬ/i,
  };

  for (const line of text.split("\n")) {
    const trimmed = line.trim();

    // Detect category headers
    for (const [cat, pattern] of Object.entries(categoryPatterns)) {
      if (pattern.test(trimmed)) {
        currentCategory = cat;
        break;
      }
    }

    // Parse price lines: emoji + Name (Amharic) = Price ETB/unit
    // With Amharic: 🧅 Red Onion Habesha (ሽንኩርት ሀበሻ) = 126 ETB/kg
    const withAmharic = trimmed.match(
      /^[^\w]*(.+?)\s*\(([^)]+)\)\s*=\s*(\d+(?:\.\d+)?)\s*ETB\/(kg|pcs)/i
    );
    if (withAmharic) {
      results.push({
        name: withAmharic[1].trim(),
        nameAmharic: withAmharic[2].trim(),
        price: parseFloat(withAmharic[3]),
        unit: withAmharic[4].toLowerCase(),
        category: currentCategory,
      });
      continue;
    }

    // Without Amharic: 🥕 Carrot = 90 ETB/kg
    const withoutAmharic = trimmed.match(
      /^[^\w]*(.+?)\s*=\s*(\d+(?:\.\d+)?)\s*ETB\/(kg|pcs)/i
    );
    if (withoutAmharic) {
      results.push({
        name: withoutAmharic[1].trim(),
        nameAmharic: "",
        price: parseFloat(withoutAmharic[2]),
        unit: withoutAmharic[3].toLowerCase(),
        category: currentCategory,
      });
    }
  }

  return results;
}

/**
 * Look up the market price for a grocery item by fuzzy matching.
 * Returns the best matching price or null.
 */
export function lookupPrice(
  itemName: string,
  prices: MarketPrice[]
): { price: number; unit: string; matchedName: string } | null {
  const lower = itemName.toLowerCase().trim();
  const result = (p: MarketPrice) => ({ price: Number(p.price), unit: p.unit, matchedName: p.name });

  // 1. Exact match
  const exact = prices.find((p) => p.name.toLowerCase().trim() === lower);
  if (exact) return result(exact);

  // 2. Substring match — grocery name contained in price name or vice versa
  //    (e.g. "onion" ↔ "red onion habesha"). Guard against very short names.
  const groceryTokens = lower.split(/\s+/).filter((t) => t.length >= 4);
  const matches = prices.filter((p) => {
    const pn = p.name.toLowerCase().trim();
    if (pn.includes(lower) || lower.includes(pn)) return true;
    // 3. Share a significant whole word (≥4 chars) — avoids "greens" ⊃ "green" false hits
    const pTokens = pn.split(/\s+/);
    return groceryTokens.some((gt) => pTokens.includes(gt));
  });

  if (matches.length === 0) return null;

  // Prefer the cheapest matching variety
  const cheapest = matches.reduce((best, p) => (Number(p.price) < Number(best.price) ? p : best));
  return result(cheapest);
}
