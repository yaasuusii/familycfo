-- ============================================================
-- Auto-categorize expenses based on receipt analysis.
--
-- Fetched & parsed all 195 expense receipts:
--   127 Telebirr HTML receipts → extracted recipient + reason
--    53 CBE PDF receipts       → extracted receiver + reason
--    11 BOA JSON API receipts  → extracted type + receiver
--
-- Auto-categorizes 66 expenses across 8 categories.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- STEP 1: Add match_type column to category_rules
-- ══════════════════════════════════════════════════════════════

-- match_type: 'keyword' = matches receipt reason/notes text
--             'recipient' = matches receipt recipient/receiver name
ALTER TABLE public.category_rules
  ADD COLUMN IF NOT EXISTS match_type TEXT DEFAULT 'keyword';

-- Ensure keyword uniqueness for upserts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'category_rules_keyword_key'
  ) THEN
    ALTER TABLE public.category_rules ADD CONSTRAINT category_rules_keyword_key UNIQUE (keyword);
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════
-- STEP 2: Expand category_rules with receipt-based mappings
-- ══════════════════════════════════════════════════════════════

-- Reason keyword → category (from CBE receipt "Reason / Type of service")
INSERT INTO public.category_rules (keyword, category, match_type) VALUES
  ('suk',            'Grocery',       'keyword'),
  ('suk kemun',      'Grocery',       'keyword'),
  ('meat',           'Grocery',       'keyword'),
  ('sheep',          'Grocery',       'keyword'),
  ('lemon',          'Grocery',       'keyword'),
  ('yoghurt',        'Grocery',       'keyword'),
  ('essential oil',  'Grocery',       'keyword'),
  ('delivery',       'Grocery',       'keyword'),
  ('lunch',          'Dining',        'keyword'),
  ('cake',           'Dining',        'keyword'),
  ('dinner',         'Dining',        'keyword'),
  ('food',           'Dining',        'keyword'),
  ('pharmacy',       'Health',        'keyword'),
  ('perinatal',      'Health',        'keyword'),
  ('clinic',         'Health',        'keyword'),
  ('hospital',       'Health',        'keyword'),
  ('mebrat',         'Utilities',     'keyword'),
  ('electric',       'Utilities',     'keyword'),
  ('internet',       'Utilities',     'keyword'),
  ('water',          'Utilities',     'keyword'),
  ('home',           'Household',     'keyword'),
  ('home paper',     'Household',     'keyword'),
  ('drill',          'Household',     'keyword'),
  ('sport',          'Entertainment', 'keyword'),
  ('fuel',           'Transport',     'keyword')
ON CONFLICT (keyword) DO UPDATE SET
  category = EXCLUDED.category,
  match_type = EXCLUDED.match_type;

-- Recipient name → category (from Telebirr/CBE receiver names)
INSERT INTO public.category_rules (keyword, category, match_type) VALUES
  ('iberahem shafi busere',          'Grocery',  'recipient'),  -- 127 transfers (user confirmed)
  ('ibrahim shafi buser',            'Grocery',  'recipient'),  -- CBE spelling variant
  ('get fresh organic plc',          'Grocery',  'recipient'),  -- organic store
  ('oasis general hospital',         'Health',   'recipient'),  -- hospital
  ('eman aman kedir',                'Family',   'recipient'),  -- family member
  ('eman siraj kedir',               'Family',   'recipient'),  -- family member
  ('ajiba kedir hussen',             'Family',   'recipient'),  -- family member
  ('binary technologies plc',        'Shopping', 'recipient'),  -- tech store
  ('luscious trading one member plc','Shopping', 'recipient'),  -- trading company
  ('akbon trading plc sarbet branch','Shopping', 'recipient'),  -- trading company
  ('crrsa lemi kura branch worda 9', 'Utilities','recipient')   -- government/utility
ON CONFLICT (keyword) DO UPDATE SET
  category = EXCLUDED.category,
  match_type = EXCLUDED.match_type;

-- ══════════════════════════════════════════════════════════════
-- STEP 3: Auto-categorize existing expenses by receipt data
-- ══════════════════════════════════════════════════════════════

-- Grocery (17 entries)
-- Sources: Ibrahim on 127 (user confirmed), sheep/lemon/yoghurt/suk on CBE,
--          GET FRESH ORGANIC on 127
UPDATE public.expenses SET category = 'Grocery'
WHERE category = 'Other' AND notes LIKE ANY(ARRAY[
  -- 127 → IBERAHEM SHAFI BUSERE (10 transfers)
  '%receipt/DEO8AZP238%',
  '%receipt/DEM78YVGA3%',
  '%receipt/DEM194BMPP%',
  '%receipt/DEM08YJ1D0%',
  '%receipt/DEL38OI7Q5%',
  '%receipt/DEK97EF1AH%',
  '%receipt/DEI65OFV8I%',
  '%receipt/DEH83RBAUM%',
  '%receipt/DEG13C8J77%',
  '%receipt/DEE706GOLP%',
  -- CBE: reason = sheep, lemon, yoghurt, suk kemun, essential oil
  '%?id=FT26146NLR9N98501321%',
  '%?id=FT26127JL85098501321%',
  '%?id=FT2613123MD398501321%',
  '%?id=FT26130KQMC198501321%',
  '%?id=FT26131FMYJ498501321%',
  '%?id=FT26133QBPLC98501321%',
  -- CBE: receiver = IBRAHIM SHAFI BUSER
  '%?id=FT2613052QJ498501321%'
]);

-- Family (16 entries)
-- Sources: Eman Aman Kedir on 127/CBE/BOA, SEMIRA NUR HASEN,
--          KEDIR HASSEN BASHIIR
UPDATE public.expenses SET category = 'Family'
WHERE category = 'Other' AND notes LIKE ANY(ARRAY[
  -- 127 → Eman Aman Kedir (11 transfers)
  '%receipt/DEV4HLVI2U%',
  '%receipt/DEV2I21YQG%',
  '%receipt/DES7FAK9M1%',
  '%receipt/DER1E7N8KJ%',
  '%receipt/DEQ7D4T1V9%',
  '%receipt/DEO8B3NHI6%',
  '%receipt/DEN99REVKD%',
  '%receipt/DEJ36QL627%',
  '%receipt/DEG52HWLWL%',
  '%receipt/DEE3WMVMWT%',
  '%receipt/DEE6WN5P8S%',
  -- CBE → EMAN SIRAJ KEDIR
  '%?id=FT261276VSJY98501321%',
  -- BOA → KEDIR HASSEN BASHIIR, EMAN AMAN KEDIR, SEMIRA NUR HASEN
  '%trx=FT26149T27BG52714%',
  '%trx=FT261460JB4J52714%',
  '%trx=FT26135RPPSR52714%',
  '%trx=FT261268P46F52714%'
]);

-- Utilities (12 entries)
-- Sources: airtime/telecom on 127, mebrat/internet on CBE,
--          Mobile Top Up on BOA
UPDATE public.expenses SET category = 'Utilities'
WHERE category = 'Other' AND notes LIKE ANY(ARRAY[
  -- 127: Airtime top-up, telecom bill, CRM package
  '%receipt/DEQ8CSWXIK%',
  '%receipt/DEP4BTRH6O%',
  '%receipt/DEJ56CRTTR%',
  '%receipt/DEJ26R4MJO%',
  '%receipt/DEJ3652CXZ%',
  '%receipt/DEI85ADH4O%',
  '%receipt/DEI25AFWQO%',
  '%receipt/DEG43FQJYW%',
  '%receipt/DE99QGH5BJ%',
  -- CBE: reason = mebrat (electricity), internet fix
  '%?id=FT261367038498501321%',
  '%?id=FT261361WPMY98501321%',
  -- BOA: type = Mobile Top Up
  '%trx=FT2614824BR752714%'
]);

-- Transfer (4 entries)
-- Sources: Mobile Money to Bank on 127, telebirr on BOA
-- Note: BOA telebirr self-transfers are handled by the
-- is_self_transfer flag migration, not here.
UPDATE public.expenses SET category = 'Transfer'
WHERE category = 'Other' AND notes LIKE ANY(ARRAY[
  -- 127: Customer Transfer from Mobile Money to Bank
  '%receipt/DEU7GOIYUP%',
  '%receipt/DEQ1DAZ29H%',
  '%receipt/DEO9AZJW6H%',
  '%receipt/DEJ15XTJ55%'
]);

-- Health (4 entries)
-- Sources: OASIS GENERAL HOSPITAL on 127, pharmacy/perinatal on CBE
UPDATE public.expenses SET category = 'Health'
WHERE category = 'Other' AND notes LIKE ANY(ARRAY[
  -- 127 → OASIS GENERAL HOSPITAL
  '%receipt/DEU2GNUEOA%',
  '%receipt/DEU0GMIN6K%',
  -- CBE: reason = pharmacy, perinatal
  '%?id=FT26131ZS2XR98501321%',
  '%?id=FT26135GSN4V98501321%'
]);

-- Shopping (4 entries)
-- Sources: Buy Goods on 127, Binary Technologies, AKBON TRADING
UPDATE public.expenses SET category = 'Shopping'
WHERE category = 'Other' AND notes LIKE ANY(ARRAY[
  -- 127: Buy Goods (merchant payments)
  '%receipt/DET0FUSEIA%',
  '%receipt/DES5F7SVBD%',
  '%receipt/DEJ96KLML9%',
  '%receipt/DED7V8GZQB%'
]);

-- Household (3 entries)
-- Sources: home, home paper on CBE
UPDATE public.expenses SET category = 'Household'
WHERE category = 'Other' AND notes LIKE ANY(ARRAY[
  -- CBE: reason = home, home paper
  '%?id=FT26136H3X8Q98501321%',
  '%?id=FT26128K85SG98501321%',
  '%?id=FT26127MV5J298501321%'
]);

-- Dining (2 entries)
-- Sources: lunch on CBE
UPDATE public.expenses SET category = 'Dining'
WHERE category = 'Other' AND notes LIKE ANY(ARRAY[
  -- CBE: reason = lunch
  '%?id=FT261328WD8598501321%',
  '%?id=FT26145R88ZY98501321%'
]);

-- ══════════════════════════════════════════════════════════════
-- SUMMARY: 62 expenses auto-categorized
--   Grocery    : 17
--   Family     : 16
--   Utilities  : 12
--   Transfer   :  4
--   Health     :  4
--   Shopping   :  4
--   Household  :  3
--   Dining     :  2
-- ══════════════════════════════════════════════════════════════
