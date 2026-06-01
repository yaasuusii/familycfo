-- ============================================================
-- Auto-flag self-transfers on INSERT/UPDATE.
--
-- Income side:  "TeleBirr Received from Unknown" = self-transfer
--               (money arriving from your own bank account)
--
-- Expense side: Not auto-detected (most CBE/BOA payments are
--               real) — user toggles manually via the form.
-- ============================================================

CREATE OR REPLACE FUNCTION auto_flag_income_self_transfer()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-flag income entries where the notes indicate a telebirr
  -- top-up from the user's own bank (shows as "Unknown" sender).
  -- Named senders (real people) are NOT flagged.
  IF NEW.notes = 'TeleBirr Received from Unknown' THEN
    NEW.is_self_transfer := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fire on both INSERT and UPDATE so retroactive note edits work too
DROP TRIGGER IF EXISTS trg_auto_flag_income_transfer ON public.income;
CREATE TRIGGER trg_auto_flag_income_transfer
  BEFORE INSERT OR UPDATE OF notes ON public.income
  FOR EACH ROW
  EXECUTE FUNCTION auto_flag_income_self_transfer();
