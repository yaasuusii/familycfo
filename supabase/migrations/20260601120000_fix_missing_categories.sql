-- ============================================================
-- Fix: Add missing categories used by auto-categorize migration.
--
-- The auto-categorize migration set these categories that
-- didn't exist in the categories table:
--   "Family"  → new (family member transfers)
--   "Dining"  → remap to existing "Food & Drinks"
--   "Shopping" → new (merchant purchases)
-- ============================================================

-- Add missing categories
INSERT INTO public.categories (name) VALUES ('Family')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.categories (name) VALUES ('Shopping')
ON CONFLICT (name) DO NOTHING;

-- Remap "Dining" → "Food & Drinks" (which already exists)
UPDATE public.expenses SET category = 'Food & Drinks'
WHERE category = 'Dining';

-- Also update the category_rules to use "Food & Drinks" instead of "Dining"
UPDATE public.category_rules SET category = 'Food & Drinks'
WHERE category = 'Dining';
