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
          { role: "system", content: "You are a meal planning assistant for a pregnant Ethiopian woman. Respond with ONLY a valid JSON array. No markdown, no explanation, no text outside the JSON." },
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
FOOD VARIETY — mix these categories across the week:
- Ethiopian: Shiro, Misir Wot, Doro Wot, Tibs, Kitcha Fitfit, Genfo, Firfir, Chechebsa, Beyaynetu, Gomen, Kik Alicha, Ayib, Fatira, Sambusa, Kinche, Kategna, Atmit
- Chicken: grilled chicken, chicken soup, chicken stir-fry, roasted chicken
- Meat: beef stew, lamb tibs, meatballs, minced meat spaghetti
- Fish: grilled fish (tilapia, salmon), fish soup, baked fish (low-mercury only)
- International: pasta, rice dishes, omelets, sandwiches, salads, soup
- Snacks: fruits, yogurt, nuts, kollo, boiled eggs, avocado, banana, smoothies, toast, granola

SAFETY — NEVER include: raw meat/kitfo, alcohol, high-mercury fish (shark, swordfish, king mackerel), raw eggs, unpasteurized dairy.

Each meal needs nutrition tags from: ${nutrients}

Output format — JSON array of exactly 35 objects:
{"day":0,"meal_type":"breakfast","name":"Genfo with Butter","nutrients":["iron","calcium"],"estimated_cost":45}

day: 0=Mon to 6=Sun. meal_type: one of ${mealTypes}. name: 2-5 words. nutrients: relevant tags. estimated_cost: ETB number.

ONLY output the JSON array. No other text.`;

  return prompt;
}
