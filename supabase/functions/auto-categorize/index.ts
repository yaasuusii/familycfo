import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ──────────────────────────────────────────────────────────────
// Receipt parsers — run server-side (no CORS restrictions)
// ──────────────────────────────────────────────────────────────

/** Parse Telebirr receipt HTML → { recipient, reason } */
function parseTelebirrHTML(html: string): { recipient: string; reason: string } {
  let recipient = "";
  let reason = "";

  // Recipient: "Credited Party name" → next <label> or <td>
  const m1 = html.match(/Credited [Pp]arty.*?<label[^>]*>(.*?)<\/label>/s);
  if (m1) {
    recipient = m1[1].trim();
  } else {
    const m2 = html.match(
      /Credited Party name\s*<\/td>\s*<td[^>]*>(.*?)<\/td>/s
    );
    if (m2) {
      recipient = m2[1].replace(/<[^>]+>/g, "").trim();
    }
  }

  // Payment Reason
  const m3 = html.match(
    /Payment Reason[^<]*(?:<\/td>)?\s*(?:<td[^>]*>)?\s*(.*?)(?:<\/td>|<br|\n)/si
  );
  if (m3) {
    reason = m3[1].replace(/<[^>]+>/g, "").trim();
  }

  return { recipient, reason };
}

/** Parse BOA JSON API → { receiver, txType } */
function parseBOAJson(json: any): { receiver: string; txType: string } {
  const body = json?.body?.[0] || {};
  return {
    receiver: body["Receiver's Name"] || "",
    txType: body["Transaction Type"] || "",
  };
}

/** Parse CBE PDF text → { receiver, reason }
 *  Note: We fetch the PDF as arraybuffer and use a simple text extraction
 *  since pdfminer isn't available in Deno. We look for ASCII text patterns.
 */
function parseCBEText(text: string): { receiver: string; reason: string } {
  let receiver = "";
  let reason = "";

  // The PDF text from CBE has a predictable structure.
  // After payer account "1****1321", next name-like line is receiver.
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("1****1321") && i + 1 < lines.length) {
      const candidate = lines[i + 1];
      if (/^[A-Z]/.test(candidate) && !candidate.includes("Payment")) {
        receiver = candidate;
      }
      break;
    }
  }

  // Find reason after "Reason / Type of service"
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("Reason") && lines[i].includes("Type of service")) {
      if (i + 1 < lines.length) {
        const candidate = lines[i + 1].replace(/ done via Mobile/i, "");
        if (candidate && !candidate.includes("Transferred")) {
          reason = candidate;
        }
      }
      break;
    }
  }

  return { receiver, reason };
}

// ──────────────────────────────────────────────────────────────
// Category matching logic
// ──────────────────────────────────────────────────────────────

interface CategoryRule {
  keyword: string;
  category: string;
  match_type: string | null;
}

function matchCategory(
  rules: CategoryRule[],
  recipient: string,
  reason: string
): string | null {
  // 1. Check recipient against recipient rules (exact, case-insensitive)
  if (recipient) {
    const recipientLower = recipient.toLowerCase();
    const recipientRules = rules.filter((r) => r.match_type === "recipient");
    for (const rule of recipientRules) {
      if (rule.keyword.toLowerCase() === recipientLower) {
        return rule.category;
      }
    }
  }

  // 2. Check reason against keyword rules (contains, case-insensitive)
  if (reason) {
    const reasonLower = reason.toLowerCase();
    // Sort by keyword length desc → "home paper" before "home"
    const keywordRules = rules
      .filter((r) => r.match_type === "keyword" || !r.match_type)
      .sort((a, b) => b.keyword.length - a.keyword.length);
    for (const rule of keywordRules) {
      if (reasonLower.includes(rule.keyword.toLowerCase())) {
        return rule.category;
      }
    }
  }

  // 3. Fallback rules for known Telebirr reasons
  if (reason.includes("Buy Goods")) return "Shopping";
  if (reason.includes("Airtime") || reason.includes("Telecom") || reason.includes("CRM Buy Package"))
    return "Utilities";
  if (reason.includes("Customer Transfer from Mobile Money to Bank"))
    return "Transfer";

  return null;
}

// ──────────────────────────────────────────────────────────────
// Main handler — called via HTTP (from DB webhook or frontend)
// ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();

    // Support two modes:
    // 1. DB webhook: { type: "INSERT", record: { id, notes, category, ... } }
    // 2. Manual call: { expense_id: "uuid" }
    // 3. Batch call:  { batch: true } — re-categorize all "Other" expenses
    let expenseIds: string[] = [];

    if (body.batch) {
      // Batch mode: find all "Other" expenses with receipt URLs
      const { data: otherExpenses } = await supabase
        .from("expenses")
        .select("id")
        .eq("category", "Other")
        .like("notes", "http%");
      expenseIds = (otherExpenses || []).map((e: any) => e.id);
    } else if (body.record) {
      // DB webhook mode
      const record = body.record;
      if (
        record.category !== "Other" ||
        !record.notes?.startsWith("http")
      ) {
        return new Response(
          JSON.stringify({ skipped: true, reason: "Not 'Other' or no receipt URL" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      expenseIds = [record.id];
    } else if (body.expense_id) {
      expenseIds = [body.expense_id];
    } else {
      return new Response(
        JSON.stringify({ error: "Provide record, expense_id, or batch:true" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (expenseIds.length === 0) {
      return new Response(
        JSON.stringify({ updated: 0, message: "No eligible expenses" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load category rules
    const { data: rules } = await supabase
      .from("category_rules")
      .select("keyword, category, match_type");
    if (!rules || rules.length === 0) {
      return new Response(
        JSON.stringify({ error: "No category rules found" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load the expenses
    const { data: expenses } = await supabase
      .from("expenses")
      .select("id, notes, category, payment_method")
      .in("id", expenseIds);

    let updated = 0;
    let skipped = 0;
    const results: Array<{ id: string; category: string | null; source: string }> = [];

    for (const expense of expenses || []) {
      const notes = expense.notes || "";
      let recipient = "";
      let reason = "";
      let source = "";

      try {
        // ── Telebirr receipt ──
        if (notes.includes("transactioninfo.ethiotelecom.et/receipt/")) {
          source = "telebirr";
          const res = await fetch(notes, {
            signal: AbortSignal.timeout(10000),
          });
          const html = await res.text();
          if (html.length > 200) {
            const parsed = parseTelebirrHTML(html);
            recipient = parsed.recipient;
            reason = parsed.reason;
          }
        }

        // ── BOA receipt ──
        else if (notes.includes("cs.bankofabyssinia.com/slip/")) {
          source = "boa";
          const trxMatch = notes.match(/trx=([A-Za-z0-9]+)/);
          if (trxMatch) {
            const apiUrl = `https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=${trxMatch[1]}`;
            const res = await fetch(apiUrl, {
              signal: AbortSignal.timeout(10000),
            });
            const json = await res.json();
            const parsed = parseBOAJson(json);
            recipient = parsed.receiver;
            reason = parsed.txType;
          }
        }

        // ── CBE receipt ──
        else if (notes.includes("apps.cbe.com.et")) {
          source = "cbe";
          // CBE returns PDFs — we can't parse PDFs in Deno Edge Functions easily.
          // Instead, use the notes text itself for keyword matching.
          // The user often types the reason in notes for CBE (e.g. "suk", "lunch")
          // For PDF-based CBE receipts, we rely on the category_rules keyword match
          // against the full URL, which won't help. Skip CBE PDF parsing for now.
          // But if the notes contain extra text beyond the URL, try that.
          reason = notes.replace(/https?:\/\/[^\s]+/, "").trim();
        }
      } catch {
        // Receipt fetch failed — skip this expense
        results.push({ id: expense.id, category: null, source: `${source}-error` });
        skipped++;
        continue;
      }

      // Match against rules
      const category = matchCategory(rules as CategoryRule[], recipient, reason);

      if (category && category !== expense.category) {
        const { error } = await supabase
          .from("expenses")
          .update({ category })
          .eq("id", expense.id);

        if (!error) {
          updated++;
          results.push({ id: expense.id, category, source });
        } else {
          results.push({ id: expense.id, category: null, source: `update-error: ${error.message}` });
          skipped++;
        }
      } else {
        results.push({
          id: expense.id,
          category: category || null,
          source: category ? "already-set" : `no-match (${source}: ${recipient || "?"} / ${reason || "?"})`,
        });
        skipped++;
      }
    }

    return new Response(
      JSON.stringify({ updated, skipped, total: expenseIds.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
