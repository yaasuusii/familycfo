-- ============================================================
-- Add is_self_transfer flag to expenses and income tables.
--
-- Self-transfers are internal movements between your own
-- accounts (e.g. CBE/BOA -> Telebirr 127). They should not
-- count toward real spending/income totals.
-- ============================================================

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS is_self_transfer BOOLEAN DEFAULT false;
ALTER TABLE public.income   ADD COLUMN IF NOT EXISTS is_self_transfer BOOLEAN DEFAULT false;

-- ── Mark the 9 CBE -> Telebirr self-transfers ──
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

-- ── Mark the 3 BOA -> Telebirr self-transfers ──
UPDATE public.expenses SET is_self_transfer = true
WHERE notes LIKE '%cs.bankofabyssinia.com%' AND notes LIKE ANY(ARRAY[
  '%FT261504XZQS%',   -- May 30, 30,018
  '%FT26148DR5T3%',   -- May 27, 6,512.75
  '%FT26140RH88H%'    -- May 20, 1,512
]);
