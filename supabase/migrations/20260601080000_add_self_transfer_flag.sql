-- ============================================================
-- Add is_self_transfer flag to expenses and income tables.
--
-- Self-transfers are internal movements between your own
-- accounts (e.g. CBE/BOA -> Telebirr 127). They should not
-- count toward real spending/income totals.
--
-- Both SIDES of each transfer are tagged:
--   Expense side = the bank debit (CBE/BOA sending)
--   Income side  = the 127 credit (TeleBirr receiving)
-- ============================================================

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS is_self_transfer BOOLEAN DEFAULT false;
ALTER TABLE public.income   ADD COLUMN IF NOT EXISTS is_self_transfer BOOLEAN DEFAULT false;

-- ══════════════════════════════════════════════════════════════
-- EXPENSE SIDE — mark the bank-sending entries
-- ══════════════════════════════════════════════════════════════

-- 9 CBE -> Telebirr self-transfers (receipt shows "Tele Birr Settlement Account")
UPDATE public.expenses SET is_self_transfer = true
WHERE notes LIKE '%apps.cbe.com.et%' AND notes LIKE ANY(ARRAY[
  '%FT26130ZG2CZ%',   -- May 10, 3,000
  '%FT26132RYR9Y%',   -- May 12, 5,000
  '%FT261333VVL7%',   -- May 13, 10,000
  '%FT26136MXD1W%',   -- May 16, 5,000
  '%FT26139VNMKL%',   -- May 19, 18,000
  '%FT261423VTXX%',   -- May 22, 1,000
  '%FT26142207TH%',   -- May 22, 29,000
  '%FT26146TLXY9%',   -- May 26, 5,000
  '%FT26146G4GFF%'    -- May 26, 5,000
]);

-- 3 BOA -> Telebirr self-transfers (API shows Transaction Type = "telebirr")
UPDATE public.expenses SET is_self_transfer = true
WHERE notes LIKE '%cs.bankofabyssinia.com%' AND notes LIKE ANY(ARRAY[
  '%FT261504XZQS%',   -- May 30, 30,018 (transferred 30,000)
  '%FT26148DR5T3%',   -- May 27, 6,512.75 (transferred 6,500)
  '%FT26140RH88H%'    -- May 20, 1,512 (transferred 1,500)
]);

-- ══════════════════════════════════════════════════════════════
-- INCOME SIDE — mark the 127-receiving entries
-- ══════════════════════════════════════════════════════════════

-- These are "TeleBirr Received from Unknown" entries that match
-- the exact date + clean amount of each bank self-transfer above.
-- (Entries from named people like TEMIMA AHMED are real income.)
UPDATE public.income SET is_self_transfer = true
WHERE notes = 'TeleBirr Received from Unknown'
AND (
  (date = '2026-05-10' AND amount = 3000)  OR
  (date = '2026-05-12' AND amount = 5000)  OR
  (date = '2026-05-13' AND amount = 10000) OR
  (date = '2026-05-16' AND amount = 5000)  OR
  (date = '2026-05-19' AND amount = 18000) OR
  (date = '2026-05-20' AND amount = 1500)  OR
  (date = '2026-05-22' AND amount = 1000)  OR
  (date = '2026-05-22' AND amount = 29000) OR
  (date = '2026-05-26' AND amount = 5000)  OR
  (date = '2026-05-27' AND amount = 6500)  OR
  (date = '2026-05-30' AND amount = 30000)
);
