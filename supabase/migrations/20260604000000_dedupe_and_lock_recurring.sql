-- ============================================================
-- Permanent fix for duplicate income/expense rows.
--
-- Forensics (Jun 2026) showed the real cause: bank/Telebirr receipts were
-- IMPORTED TWICE. Every CBE/Telebirr receipt URL in `notes` carries a globally
-- unique transaction reference; 112 expense rows shared a reference with another
-- row. The first import (categorized) and a later re-import (all dumped as
-- "Personal") differ in category, so the earlier dedup — which keyed on
-- (date, amount, category, notes) — never caught them.
--
-- Two prevention layers:
--   1. Unique index on the receipt reference extracted from notes — the natural
--      key for an imported transaction. Blocks any re-import of the same receipt.
--   2. Unique index on (recurring_id, date) — blocks the OTHER dup source: the
--      process-recurring edge function does a non-atomic check-then-insert, so
--      two concurrent runs could double-post a recurring entry.
--
-- This migration is self-sufficient: it dedups by receipt reference (keeping the
-- older categorized row) BEFORE building the unique index, so it is safe to apply
-- on its own.
-- ============================================================

-- 0a. Collapse re-imported receipts FIRST so the unique index below can build.
--     Keep the OLDEST row per receipt reference (the first, categorized import);
--     delete the newer re-imports (the "Personal" dump). Receipt ref is a real
--     unique transaction id, so this never removes a genuinely distinct expense.
WITH exp_receipt_dupes AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY COALESCE(
             substring(notes from 'receipt/([A-Za-z0-9]+)'),
             substring(notes from '[?&]id=([A-Za-z0-9]+)')
           )
           ORDER BY created_at ASC
         ) AS rn
  FROM public.expenses
  WHERE notes ~ 'receipt/[A-Za-z0-9]+' OR notes ~ '[?&]id=[A-Za-z0-9]+'
)
DELETE FROM public.expenses WHERE id IN (SELECT id FROM exp_receipt_dupes WHERE rn > 1);

WITH inc_receipt_dupes AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY COALESCE(
             substring(notes from 'receipt/([A-Za-z0-9]+)'),
             substring(notes from '[?&]id=([A-Za-z0-9]+)')
           )
           ORDER BY created_at ASC
         ) AS rn
  FROM public.income
  WHERE notes ~ 'receipt/[A-Za-z0-9]+' OR notes ~ '[?&]id=[A-Za-z0-9]+'
)
DELETE FROM public.income WHERE id IN (SELECT id FROM inc_receipt_dupes WHERE rn > 1);

-- 0b. Normalized receipt reference, generated from notes. Immutable expression,
--    so it can back a generated column + unique index.
--    Matches Telebirr  …/receipt/<REF>  and CBE  …?id=<REF>.
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS receipt_ref text
  GENERATED ALWAYS AS (
    COALESCE(
      substring(notes from 'receipt/([A-Za-z0-9]+)'),
      substring(notes from '[?&]id=([A-Za-z0-9]+)')
    )
  ) STORED;

ALTER TABLE public.income
  ADD COLUMN IF NOT EXISTS receipt_ref text
  GENERATED ALWAYS AS (
    COALESCE(
      substring(notes from 'receipt/([A-Za-z0-9]+)'),
      substring(notes from '[?&]id=([A-Za-z0-9]+)')
    )
  ) STORED;

-- 1. One row per receipt reference (only where a receipt exists).
CREATE UNIQUE INDEX IF NOT EXISTS expenses_one_per_receipt
  ON public.expenses (receipt_ref) WHERE receipt_ref IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS income_one_per_receipt
  ON public.income (receipt_ref) WHERE receipt_ref IS NOT NULL;

-- 2. One auto-posted recurring row per rule per day. Partial so manual rows
--    (recurring_id IS NULL) are exempt — a family can legitimately log two
--    100 ETB grocery runs on the same day.
CREATE UNIQUE INDEX IF NOT EXISTS income_recurring_once_per_day
  ON public.income (recurring_id, date) WHERE recurring_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS expenses_recurring_once_per_day
  ON public.expenses (recurring_id, date) WHERE recurring_id IS NOT NULL;
