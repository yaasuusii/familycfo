import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function addPeriod(date: Date, frequency: string): Date {
  const d = new Date(date);
  if (frequency === "weekly") d.setDate(d.getDate() + 7);
  else if (frequency === "monthly") d.setMonth(d.getMonth() + 1);
  else if (frequency === "yearly") d.setFullYear(d.getFullYear() + 1);
  return d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];
  let generated = 0;

  // Process recurring income
  const { data: incomeRules } = await supabase
    .from("recurring_income")
    .select("*")
    .eq("is_active", true)
    .eq("auto_post", true);

  for (const rule of incomeRules ?? []) {
    let nextDate = rule.last_generated_date
      ? addPeriod(new Date(rule.last_generated_date), rule.frequency)
      : new Date(rule.start_date);

    while (nextDate <= today) {
      if (rule.end_date && nextDate > new Date(rule.end_date)) break;

      const dateStr = nextDate.toISOString().split("T")[0];
      await supabase.from("income").insert({
        user_id: rule.created_by,
        source: rule.title,
        amount: rule.amount,
        date: dateStr,
        notes: "Auto-generated from recurring rule",
        is_auto_generated: true,
        recurring_id: rule.id,
      });

      await supabase
        .from("recurring_income")
        .update({ last_generated_date: dateStr })
        .eq("id", rule.id);

      generated++;
      nextDate = addPeriod(nextDate, rule.frequency);
    }
  }

  // Process recurring expenses
  const { data: expenseRules } = await supabase
    .from("recurring_expenses")
    .select("*")
    .eq("is_active", true)
    .eq("auto_post", true);

  for (const rule of expenseRules ?? []) {
    let nextDate = rule.last_generated_date
      ? addPeriod(new Date(rule.last_generated_date), rule.frequency)
      : new Date(rule.start_date);

    while (nextDate <= today) {
      if (rule.end_date && nextDate > new Date(rule.end_date)) break;

      const dateStr = nextDate.toISOString().split("T")[0];
      await supabase.from("expenses").insert({
        user_id: rule.created_by,
        category: rule.category,
        amount: rule.amount,
        date: dateStr,
        payment_method: "CBE",
        notes: "Auto-generated from recurring rule",
        is_auto_generated: true,
        recurring_id: rule.id,
      });

      await supabase
        .from("recurring_expenses")
        .update({ last_generated_date: dateStr })
        .eq("id", rule.id);

      generated++;
      nextDate = addPeriod(nextDate, rule.frequency);
    }
  }

  return new Response(JSON.stringify({ success: true, generated }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
