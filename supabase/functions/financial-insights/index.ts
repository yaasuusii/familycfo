// Financial insights via Lovable AI gateway (Gemini 2.5 Flash).
//
// Design: the CLIENT computes every number (reusing finance-calc / finance-period)
// and sends a `metrics` snapshot. This function only (a) asks the model to narrate
// — summary, risks, tips — and (b) caches the result in `ai_insights`, one row per
// (insight_type, period_start). Numbers are never computed by the model.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

type Metrics = {
  periodLabel: string;
  periodStart: string; // YYYY-MM-DD
  current: {
    income: number; expenses: number; net: number;
    daysElapsed: number; daysInPeriod: number;
    projectedExpenses: number; projectedNet: number;
  };
  history: { label: string; income: number; expenses: number; net: number }[];
  upcoming: { recurringIncome: number; recurringExpenses: number };
  loans: {
    totalDebt: number; totalReceivable: number;
    dueSoon: { name: string; dueDate: string; balance: number; type: string }[];
  };
  topCategories: { category: string; amount: number }[];
  currency?: string;
};

// Budget Coach metrics. Every number here is pre-computed by the client; the
// model only narrates. Suggested limits are NOT changed by the model.
type BudgetMetrics = {
  periodLabel: string;
  periodStart: string; // YYYY-MM-DD
  currency?: string;
  avgIncome: number;
  totalSuggested: number;
  categories: {
    category: string;
    avgSpend: number;
    lastSpend: number;
    trend: "up" | "down" | "flat";
    suggestedLimit: number;
    currentLimit: number | null;
    monthsSeen: number;
  }[];
};

type Mode = "forecast" | "budget";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return json({ error: "LOVABLE_API_KEY not configured" }, 500);
    }

    const body = (await req.json()) as { metrics: Metrics | BudgetMetrics; mode?: Mode };
    const mode: Mode = body.mode === "budget" ? "budget" : "forecast";
    const metrics = body.metrics;
    if (!metrics?.periodStart) return json({ error: "metrics.periodStart required" }, 400);
    const currency = metrics.currency || "ETB";

    const systemPrompt =
      mode === "budget"
        ? `You are a budget coach for an Ethiopian household. All amounts are in ${currency}. ` +
          "You are given per-category spending history and code-computed suggested monthly limits — " +
          "DO NOT recompute or change any number, especially suggestedLimit. Reason only from the figures. " +
          "Be concrete, calm, and practical for a young family. " +
          "Respond with ONLY a valid JSON object, no markdown, no text outside the JSON, matching: " +
          `{"summary": string (1-2 sentences on the overall budget plan), "outlook": "good"|"watch"|"tight", ` +
          `"insights": string[] (2-4 per-category observations, name the category), "risks": string[] (0-3, empty if none), ` +
          `"tips": string[] (2-4 specific actions to stay within budget)}. Keep every string under 22 words. ` +
          `Reference real numbers from the metrics where useful (with the ${currency} prefix).`
        : `You are the CFO of an Ethiopian household. All amounts are in ${currency}. ` +
          "You are given pre-computed financial metrics — DO NOT recompute or invent any numbers; " +
          "reason only from the figures provided. Be concrete, calm, and practical for a young family. " +
          "Respond with ONLY a valid JSON object, no markdown, no text outside the JSON, matching: " +
          `{"summary": string (1-2 sentences), "outlook": "good"|"watch"|"tight", ` +
          `"insights": string[] (2-4 short observations), "risks": string[] (0-3, empty if none), ` +
          `"tips": string[] (2-4 specific actions)}. Keep every string under 22 words. ` +
          `Reference real numbers from the metrics where useful (with the ${currency} prefix).`;

    const response = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
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

    // Cache: upsert one row per (insight_type, period_start). Service role bypasses RLS.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error: upErr } = await supabase
      .from("ai_insights")
      .upsert(
        {
          insight_type: mode,
          period_label: metrics.periodLabel,
          period_start: metrics.periodStart,
          payload,
          model: MODEL,
        },
        { onConflict: "insight_type,period_start" },
      );
    if (upErr) return json({ error: `cache write failed: ${upErr.message}`, payload }, 200);

    return json({ payload }, 200);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
