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

const CATEGORY_PATTERNS: Record<string, RegExp> = {
  Vegetables: /VEGETABLES|አትክልት/i,
  "Leafy Greens": /LEAFY GREENS|HERBS|ቅጠላ/i,
  Chilies: /CHILIES|ቃሪያ/i,
  Fruits: /FRUITS|ፍራፍሬ/i,
  Meat: /\bMEAT\b|ስጋ/i,
  Dairy: /DAIRY|ወተት/i,
};

// Fallback category for items that appear without a section header
// (e.g. a few meat/staple lines pasted after the produce list).
const ITEM_CATEGORY_HINTS: { re: RegExp; category: string }[] = [
  { re: /\b(meat|beef|lamb|chicken|fish|tibs)\b/i, category: "Meat" },
  { re: /\b(egg|milk|butter|cheese|yogurt)\b/i, category: "Dairy" },
  { re: /\b(injera|oil|flour|rice|pasta|sugar|salt|bread)\b/i, category: "Staples" },
];

// Normalize the captured unit token. Keeps the kind (kg/pcs/g/l/bunch),
// dropping any leading pack size like "5L" → "l" (price stays per the pasted pack).
function normalizePriceUnit(raw: string | undefined): string {
  if (!raw) return "kg";
  const u = raw.toLowerCase().replace(/^\d+(?:\.\d+)?/, ""); // strip leading "5" in "5l"
  if (/^kg|kilo/.test(u)) return "kg";
  if (/^g|gram/.test(u)) return "g";
  if (/^pcs|pc|piece|pcs?/.test(u)) return "pcs";
  if (/^l|lt|liter|litre/.test(u)) return "l";
  if (/^ml/.test(u)) return "ml";
  if (/^bunch|bdl|bundle/.test(u)) return "bunch";
  return u || "kg";
}

/**
 * Parse a price list (Telegram/ChipChip style) into structured rows.
 *
 * Tolerant of many shapes on a single line:
 *   🧅 Red Onion Habesha (ሽንኩርት ሀበሻ) = 133 ETB/kg   (emoji + Amharic + "=")
 *   🥕 Carrot = 90 ETB/kg                            (no Amharic)
 *   Egg 25 ETB/pcs                                   (no "=" separator)
 *   Lamb Meat 1400ETB/kg                             (no space before ETB)
 *   cooking oil 2400ETB/ 5L                          (pack-size unit)
 */
export function parsePriceList(text: string): ParsedPrice[] {
  const results: ParsedPrice[] = [];
  let currentCategory = "Other";

  // name (lazy) + optional (amharic) + optional "=" + price + ETB + optional /unit
  const LINE = /^[^\w]*(.+?)\s*(?:\(([^)]+)\)\s*)?=?\s*(\d+(?:\.\d+)?)\s*ETB\s*\/?\s*([\w]+)?/i;

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Category headers (no price on these lines).
    let isHeader = false;
    for (const [cat, pattern] of Object.entries(CATEGORY_PATTERNS)) {
      if (pattern.test(trimmed) && !/ETB/i.test(trimmed)) {
        currentCategory = cat;
        isHeader = true;
        break;
      }
    }
    if (isHeader) continue;

    const m = trimmed.match(LINE);
    if (!m) continue;

    const name = m[1].trim();
    if (!name) continue;

    // Item-level category fallback for non-produce lines pasted without a header.
    let category = currentCategory;
    const hint = ITEM_CATEGORY_HINTS.find((h) => h.re.test(name));
    if (hint) category = hint.category;

    results.push({
      name,
      nameAmharic: (m[2] ?? "").trim(),
      price: parseFloat(m[3]),
      unit: normalizePriceUnit(m[4]),
      category,
    });
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
