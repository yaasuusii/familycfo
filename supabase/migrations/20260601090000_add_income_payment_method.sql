-- Add payment_method column to income table to track which account
-- received the money (matching the expenses table structure).
ALTER TABLE public.income ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT '127';
