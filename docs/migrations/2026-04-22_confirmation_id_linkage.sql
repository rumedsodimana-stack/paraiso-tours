-- Add confirmation_id columns to invoices and payments so the system can
-- chain invoice → tour → payment in a single lookup.
--
-- Run once per environment. Safe to re-run (idempotent).

ALTER TABLE IF EXISTS public.invoices
  ADD COLUMN IF NOT EXISTS confirmation_id text;

ALTER TABLE IF EXISTS public.payments
  ADD COLUMN IF NOT EXISTS confirmation_id text;

-- Backfill from linked tours (best-effort, only for rows that already have tour_id / lead_id).
UPDATE public.invoices AS inv
SET confirmation_id = t.confirmation_id
FROM public.tours AS t
WHERE inv.confirmation_id IS NULL
  AND t.lead_id = inv.lead_id;

UPDATE public.payments AS p
SET confirmation_id = t.confirmation_id
FROM public.tours AS t
WHERE p.confirmation_id IS NULL
  AND p.tour_id = t.id;

CREATE INDEX IF NOT EXISTS idx_invoices_confirmation_id
  ON public.invoices (confirmation_id);

CREATE INDEX IF NOT EXISTS idx_payments_confirmation_id
  ON public.payments (confirmation_id);
