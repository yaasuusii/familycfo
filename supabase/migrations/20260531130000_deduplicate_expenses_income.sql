-- ============================================================
-- Remove duplicate rows from expenses and income tables.
--
-- Root causes:
--   1. No submit guard → double-clicks create identical rows
--   2. process-recurring edge function has no idempotency check →
--      concurrent invocations insert the same entry twice
--
-- Strategy: for each group of identical rows keep the OLDEST
-- (by created_at) and delete the rest.
-- ============================================================

-- ── Expenses duplicates ──
-- A duplicate = same (user_id, date, category, amount, payment_method, notes)
WITH expense_dupes AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, date, category, amount, payment_method,
                        COALESCE(notes, '')
           ORDER BY created_at ASC
         ) AS rn
  FROM public.expenses
)
DELETE FROM public.expenses
WHERE id IN (SELECT id FROM expense_dupes WHERE rn > 1);

-- ── Income duplicates ──
-- A duplicate = same (user_id, date, source, amount, notes)
WITH income_dupes AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, date, source, amount,
                        COALESCE(notes, '')
           ORDER BY created_at ASC
         ) AS rn
  FROM public.income
)
DELETE FROM public.income
WHERE id IN (SELECT id FROM income_dupes WHERE rn > 1);
