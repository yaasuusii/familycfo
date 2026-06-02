-- Allow "Loan Taken" as an income source and reclassify known loan entries.

-- 1. Widen the source CHECK constraint
ALTER TABLE public.income DROP CONSTRAINT IF EXISTS income_source_check;
ALTER TABLE public.income
  ADD CONSTRAINT income_source_check
  CHECK (source IN ('Salary', 'Business', 'Loan Taken', 'Other'));

-- 2. Reclassify existing loan entries (mislabeled as Salary / 127 on import)

-- CBE 30,000 loan from Amir Hussen
UPDATE public.income
SET source = 'Loan Taken',
    payment_method = 'CBE',
    notes = 'Loan from Amir Hussen | https://apps.cbe.com.et:100/?id=FT261409570K98501321'
WHERE id = '550a2e03-40f7-47b4-a4be-ea21e872976f';

-- TeleBirr 2,042 loan (received from Amir Redwan)
UPDATE public.income
SET source = 'Loan Taken'
WHERE id = 'de6523b9-6739-4b42-94f4-2e5d98d84f36';

-- TeleBirr 11,300 loan
UPDATE public.income
SET source = 'Loan Taken'
WHERE id = '0c8ed0f2-6f4f-4293-9a65-166007396004';

-- 3. Add the BOA 9,500 bank loan (no SMS was sent)
INSERT INTO public.income (user_id, date, source, amount, payment_method, notes, is_self_transfer)
VALUES (
  'ca413c7a-28bc-41b8-8615-fa0fa32e17d4',
  '2026-05-26',
  'Loan Taken',
  9500,
  'BOA',
  'Bank loan (no SMS)',
  false
);
