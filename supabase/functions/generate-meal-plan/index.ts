import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!openrouterKey) {
      return new Response(JSON.stringify({ error: "OpenRouter API key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { trimester, weeksPregnant, budget, previousMeals, cravings } = await req.json();

    const prompt = buildPrompt({ trimester, weeksPregnant, budget, previousMeals, cravings });

    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openrouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://familycfo.lovable.app",
        "X-Title": "Family CFO Meal Planner",
      },
      body: JSON.stringify({
        model: "openrouter/owl-alpha",
        messages: [
          { role: "system", content: "You are an Ethiopian meal planning assistant for a pregnant woman. You MUST respond with ONLY valid JSON, no markdown, no explanation." },
          { role: "user", content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(JSON.stringify({ error: `OpenRouter error: ${err}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    // Extract JSON from response (handle possible markdown wrapping)
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

function buildPrompt({ trimester, weeksPregnant, budget, previousMeals, cravings }: {
  trimester?: number;
  weeksPregnant?: number;
  budget?: number;
  previousMeals?: string[];
  cravings?: string[];
}) {
  const nutrientsList = ["iron", "folate", "calcium", "protein", "fiber", "vitamin_a", "vitamin_c", "omega3"];
  const mealTypes = ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner"];

  let context = "Generate a weekly Ethiopian meal plan (7 days, Monday to Sunday).\n\n";

  if (trimester) {
    context += `The woman is in trimester ${trimester} (week ${weeksPregnant || "unknown"}).\n`;
    if (trimester === 1) context += "Focus on: folate-rich foods, easy-to-digest meals for nausea, small portions.\n";
    if (trimester === 2) context += "Focus on: iron and calcium-rich foods, increasing portions, energy-dense meals.\n";
    if (trimester === 3) context += "Focus on: high protein, omega-3, frequent smaller meals, fiber for digestion.\n";
  }

  if (budget) context += `Weekly grocery budget is approximately ${budget} ETB.\n`;
  if (previousMeals?.length) context += `Avoid repeating these from last week: ${previousMeals.slice(0, 10).join(", ")}.\n`;
  if (cravings?.length) context += `Current cravings to include: ${cravings.join(", ")}.\n`;

  context += `
IMPORTANT RULES:
- Use real Ethiopian dishes: Injera, Shiro, Misir Wot, Doro Wot, Tibs, Kitcha Fitfit, Genfo, Firfir, Chechebsa, Beyaynetu, Gomen, Kik Alicha, Ayib, Fatira, Sambusa, etc.
- Snacks can be fruits, yogurt, nuts, kollo (roasted barley), bread, avocado, banana, etc.
- NEVER suggest raw kitfo, alcohol, or high-mercury fish.
- Each meal should include relevant nutrition tags from: ${nutrientsList.join(", ")}
- Vary meals across the week — no same main dish two days in a row.

Respond with ONLY a JSON array of objects. Each object has:
- "day": 0-6 (0=Monday, 6=Sunday)
- "meal_type": one of ${JSON.stringify(mealTypes)}
- "name": the meal name (short, 2-5 words)
- "nutrients": array of relevant tags from ${JSON.stringify(nutrientsList)}
- "estimated_cost": approximate cost in ETB (number)

Generate exactly 35 meals (5 per day × 7 days). Respond with ONLY the JSON array, nothing else.`;

  return context;
}
