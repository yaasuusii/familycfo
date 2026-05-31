const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { trimester, weeksPregnant, budget, previousMeals, cravings } = await req.json();
    const prompt = buildPrompt({ trimester, weeksPregnant, budget, previousMeals, cravings });

    const response = await fetch(AI_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a meal planning assistant creating a DIVERSE, international weekly menu for a pregnant woman who lives in Ethiopia but wants global variety — chicken, beef, lamb, fish, pasta, rice, eggs, sandwiches, salads, smoothies — NOT an all-Ethiopian menu. Ethiopian dishes are a small minority. Respond with ONLY a valid JSON array. No markdown, no explanation, no text outside the JSON." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(JSON.stringify({ error: `AI gateway error: ${err}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    let jsonStr = content.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const meals = JSON.parse(jsonStr);

    return new Response(JSON.stringify({ meals }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getWeekNutritionFocus(week: number): string {
  if (week <= 4) return "Folate is critical for neural tube development. Easy-to-digest foods, ginger for nausea.";
  if (week <= 8) return "Continue high folate. Small frequent meals to manage morning sickness. Vitamin B6 foods.";
  if (week <= 12) return "Iron needs increasing. Citrus with meals to boost iron absorption. Hydration important.";
  if (week <= 16) return "Baby's bones forming — increase calcium and vitamin D. Appetite may be returning, add more protein.";
  if (week <= 20) return "Baby growing fast — increase iron and protein. Add omega-3 for brain development. Energy-dense meals.";
  if (week <= 24) return "Blood volume expanding — iron-rich foods essential. Calcium for strong bones. Fiber to prevent constipation.";
  if (week <= 28) return "Third trimester approaching — boost protein and omega-3. Smaller meals more frequently. Iron and calcium remain key.";
  if (week <= 32) return "Baby gaining weight — high protein, healthy fats. Frequent small meals as stomach space reduces. Fiber important.";
  if (week <= 36) return "Final stretch — easily digestible, nutrient-dense meals. Keep iron and calcium high. Stay hydrated.";
  return "Preparing for delivery — light but nutritious meals. High energy snacks. Keep protein and iron up.";
}

function buildPrompt({ trimester, weeksPregnant, budget, previousMeals, cravings }: {
  trimester?: number;
  weeksPregnant?: number;
  budget?: number;
  previousMeals?: string[];
  cravings?: string[];
}) {
  const nutrients = "iron, folate, calcium, protein, fiber, vitamin_a, vitamin_c, omega3";
  const mealTypes = '["breakfast","morning_snack","lunch","afternoon_snack","dinner"]';

  let prompt = "Create a 7-day meal plan (Monday-Sunday) for a pregnant woman.\n\n";

  if (weeksPregnant) {
    prompt += `Pregnancy week: ${weeksPregnant} (trimester ${trimester || Math.ceil(weeksPregnant / 13)}).\n`;
    prompt += `Nutrition focus this week: ${getWeekNutritionFocus(weeksPregnant)}\n\n`;
  }

  if (budget) prompt += `Weekly budget: ~${budget} ETB.\n`;
  if (previousMeals?.length) prompt += `Don't repeat these from last week: ${previousMeals.slice(0, 10).join(", ")}.\n`;
  if (cravings?.length) prompt += `Include cravings: ${cravings.join(", ")}.\n`;

  prompt += `
VARIETY IS THE #1 PRIORITY. This must NOT be an all-Ethiopian plan. Rotate widely across these categories so no two days feel the same:
- Chicken: grilled chicken, chicken soup, chicken stir-fry, roasted chicken
- Meat: beef stew, lamb tibs, meatballs, minced-meat spaghetti
- Fish (LOW-MERCURY ONLY): grilled tilapia, baked salmon, fish soup
- International: pasta, rice bowls, omelets, sandwiches, big salads, vegetable soup, pancakes, oatmeal
- Snacks: smoothies, boiled eggs, granola, toast with avocado, fresh fruit, yogurt with honey, nuts, kollo
- Ethiopian (use SPARINGLY — see hard limits): Shiro, Beyaynetu, Gomen, Kik Alicha, Genfo, Chechebsa, Firfir, Tibs, Sambusa, Fatira, Kinche

HARD RULES (must all be satisfied):
1. NEVER repeat the same dish name anywhere in the week — all 35 meals are distinct.
2. AT MOST 1 Ethiopian "wot/wat" stew in the ENTIRE week (e.g. Doro Wot, Misir Wot, Key Wot). Prefer zero.
3. AT MOST 3 meals total may be served "with Injera" across the whole week.
4. Across the 14 lunches + dinners combined, include AT LEAST: 3 chicken dishes, 3 meat dishes (beef/lamb/meatballs/spaghetti), 2 fish dishes, and 3 international dishes. Ethiopian mains must be the minority (3 or fewer of the 14).
5. Breakfasts and snacks lean international and fresh (omelets, oatmeal, pancakes, smoothies, fruit, yogurt, toast, eggs) — NOT Ethiopian every day.

SAFETY — NEVER include: raw meat/kitfo, alcohol, high-mercury fish (shark, swordfish, king mackerel, tuna steak), raw eggs, unpasteurized dairy.

Each meal needs nutrition tags from: ${nutrients}

Output format — JSON array of exactly 35 objects:
{"day":0,"meal_type":"breakfast","name":"Genfo with Butter","nutrients":["iron","calcium"],"estimated_cost":45,"ingredients":[{"name":"barley flour","qty":250,"unit":"g"},{"name":"butter","qty":50,"unit":"g"},{"name":"berbere","qty":5,"unit":"g"}]}

day: 0=Mon to 6=Sun. meal_type: one of ${mealTypes}. name: 2-5 words. nutrients: relevant tags. estimated_cost: ETB total for the meal.

INGREDIENT RULES (critical for grocery list aggregation):
1. Use BASE SHOPPING NAMES — the item you buy at a store, not the preparation:
   - Write "chicken" not "grilled chicken breast" or "cooked chicken"
   - Write "beef" not "beef stew meat" or "minced beef"
   - Write "egg" not "boiled egg" or "hard-boiled egg"
   - Write "bread" not "whole wheat toast" or "whole grain bread"
   - Write "onion" not "diced red onion"
   - Write "tomato" not "chopped tomatoes"
   - Write "bell pepper" not "green bell pepper"
2. Use GRAMS (g) for ALL solids and produce (meat, vegetables, cheese, flour, nuts, butter, pasta, rice, etc.)
3. Use MILLILITERS (ml) for ALL liquids (milk, oil, broth, water, cream, yogurt, honey, soy sauce, vinegar)
4. Use PIECES (pcs) ONLY for whole countable items that you buy by count (egg, banana, apple, orange, mango, lemon, avocado, tortilla, bread, injera)
5. NEVER use cup, tbsp, tsp — always convert to g or ml
6. The SAME ingredient must use the SAME unit across all 35 meals. If "chicken" is in grams in one meal, it must be grams everywhere.

ONLY output the JSON array. No other text.`;

  return prompt;
}
