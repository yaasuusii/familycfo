// Budget Coach narration via Lovable AI gateway (Gemini 2.5 Flash).
//
// Standalone, dependency-free (pure fetch — same shape as generate-meal-plan).
// The CLIENT computes every number, including the suggested limits; this
// function only narrates and caches one row per period in `ai_insights`.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    const { metrics } = await req.json();
    if (!metrics?.periodStart) return json({ error: "metrics.periodStart required" }, 400);
    const currency = metrics.currency || "ETB";

    const response = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              `You are a budget coach for an Ethiopian household. All amounts are in ${currency}. ` +
              "You are given per-category spending history and code-computed suggested monthly limits — " +
              "DO NOT recompute or change any number, especially suggestedLimit. Reason only from the figures. " +
              "Be concrete, calm, and practical for a young family. " +
              "Respond with ONLY a valid JSON object, no markdown, no text outside the JSON, matching: " +
              `{"summary": string (1-2 sentences on the overall budget plan), "outlook": "good"|"watch"|"tight", ` +
              `"insights": string[] (2-4 per-category observations, name the category), "risks": string[] (0-3, empty if none), ` +
              `"tips": string[] (2-4 specific actions to stay within budget)}. Keep every string under 22 words. ` +
              `Reference real numbers from the metrics where useful (with the ${currency} prefix).`,
          },
          { role: "user", content: JSON.stringify(metrics) },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return json({ error: `AI gateway error: ${err}` }, 502);
    }

    const data = await response.json();
    let content = (data.choices?.[0]?.message?.content ?? "").trim();
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    const ai = JSON.parse(content);

    const payload = { metrics, ai, generatedAt: new Date().toISOString() };
    const cacheErr = await cacheInsight("budget", metrics.periodLabel, metrics.periodStart, payload, MODEL);
    if (cacheErr) return json({ error: `cache write failed: ${cacheErr}`, payload }, 200);

    return json({ payload }, 200);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

/** Upsert one row per (insight_type, period_start) via PostgREST (service role). */
async function cacheInsight(
  insightType: string,
  periodLabel: string,
  periodStart: string,
  payload: unknown,
  model: string,
): Promise<string | null> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return "service role not configured";
  const res = await fetch(`${url}/rest/v1/ai_insights?on_conflict=insight_type,period_start`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      insight_type: insightType,
      period_label: periodLabel,
      period_start: periodStart,
      payload,
      model,
    }),
  });
  if (!res.ok) return await res.text();
  return null;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
