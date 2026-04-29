-- =====================================================================
-- Paraíso Ceylon Tours — production schema catch-up (2026-04-29)
-- =====================================================================
--
-- Run this ONCE in the Supabase SQL Editor (Dashboard → SQL Editor → New
-- query → paste the entire contents → Run).
--
-- WHY THIS EXISTS
-- The production database was provisioned from an older version of
-- supabase/schema.sql that pre-dates several ALTER blocks. The codebase
-- has since added columns the prod schema is missing — most visibly
-- packages.reference (PGRST204 on tour scheduling). This file is a
-- comprehensive `ADD COLUMN IF NOT EXISTS` sweep covering every column
-- used by the application, plus the 2026-04-22 confirmation_id linkage
-- migration. It is fully idempotent: re-running it is a no-op.
--
-- AFTER RUNNING THIS
-- Tell Claude "schema catch-up applied" and the codebase will re-enable
-- the package-reference write that was temporarily disabled in commit
-- 6a211ff as a defensive workaround.
-- =====================================================================

BEGIN;

-- ---------- leads ----------
ALTER TABLE leads ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS accompanied_guest_name TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS selected_accommodation_option_id TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS selected_accommodation_by_night JSONB;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS selected_transport_option_id TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS selected_meal_option_id TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS total_price NUMERIC;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS package_snapshot JSONB;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ---------- packages ----------
ALTER TABLE packages ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS rating NUMERIC;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS review_count INTEGER;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS cancellation_policy TEXT;
ALTER TABLE packages ADD COLUMN IF NOT EXISTS meal_options JSONB NOT NULL DEFAULT '[]';
ALTER TABLE packages ADD COLUMN IF NOT EXISTS transport_options JSONB NOT NULL DEFAULT '[]';
ALTER TABLE packages ADD COLUMN IF NOT EXISTS accommodation_options JSONB NOT NULL DEFAULT '[]';
ALTER TABLE packages ADD COLUMN IF NOT EXISTS custom_options JSONB NOT NULL DEFAULT '[]';
ALTER TABLE packages ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- packages.reference must be unique once it exists. Skipped if the
-- index already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'packages_reference_key'
  ) THEN
    BEGIN
      ALTER TABLE packages ADD CONSTRAINT packages_reference_key UNIQUE (reference);
    EXCEPTION WHEN duplicate_table THEN
      -- already exists under a different name; ignore
      NULL;
    END;
  END IF;
END$$;

-- ---------- tours ----------
ALTER TABLE tours ADD COLUMN IF NOT EXISTS confirmation_id TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS package_snapshot JSONB;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS client_confirmation_sent_at TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS supplier_notifications_sent_at TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS payment_receipt_sent_at TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS availability_status TEXT;
ALTER TABLE tours ADD COLUMN IF NOT EXISTS availability_warnings JSONB NOT NULL DEFAULT '[]';
ALTER TABLE tours ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'tours_confirmation_id_key'
  ) THEN
    BEGIN
      ALTER TABLE tours ADD CONSTRAINT tours_confirmation_id_key UNIQUE (confirmation_id);
    EXCEPTION WHEN duplicate_table THEN
      NULL;
    END;
  END IF;
END$$;

-- ---------- invoices ----------
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS confirmation_id TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_phone TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS travel_date TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pax INTEGER;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS line_items JSONB NOT NULL DEFAULT '[]';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ---------- payments ----------
ALTER TABLE payments ADD COLUMN IF NOT EXISTS confirmation_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS lead_id TEXT REFERENCES leads(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS tour_id TEXT REFERENCES tours(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS invoice_id TEXT REFERENCES invoices(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS supplier_id TEXT REFERENCES hotels(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payroll_run_id TEXT REFERENCES payroll_runs(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payable_week_start TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payable_week_end TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS supplier_name TEXT;

-- ---------- hotels ----------
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS contact TEXT;
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS default_price_per_night NUMERIC;
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS max_concurrent_bookings INTEGER;
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS star_rating NUMERIC;
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS bank_branch TEXT;
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS account_name TEXT;
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS account_number TEXT;
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS swift_code TEXT;
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS bank_currency TEXT;
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS destination_id TEXT;

-- ---------- employees ----------
ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary NUMERIC;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS commission_pct NUMERIC;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS tax_pct NUMERIC;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS benefits_amount NUMERIC;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS account_number TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS start_date TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS end_date TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- =====================================================================
-- Best-effort backfills (only for rows that already have the linkage data)
-- =====================================================================

UPDATE invoices AS inv
SET confirmation_id = t.confirmation_id
FROM tours AS t
WHERE inv.confirmation_id IS NULL
  AND t.lead_id = inv.lead_id;

UPDATE payments AS p
SET confirmation_id = t.confirmation_id
FROM tours AS t
WHERE p.confirmation_id IS NULL
  AND p.tour_id = t.id;

UPDATE tours
SET availability_warnings = '[]'
WHERE availability_warnings IS NULL;

-- =====================================================================
-- Indexes (idempotent)
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_invoices_confirmation_id ON invoices (confirmation_id);
CREATE INDEX IF NOT EXISTS idx_payments_confirmation_id ON payments (confirmation_id);
CREATE INDEX IF NOT EXISTS idx_leads_archived_at ON leads(archived_at);
CREATE INDEX IF NOT EXISTS idx_packages_archived_at ON packages(archived_at);
CREATE INDEX IF NOT EXISTS idx_hotels_archived_at ON hotels(archived_at);
CREATE INDEX IF NOT EXISTS idx_employees_archived_at ON employees(archived_at);
CREATE INDEX IF NOT EXISTS idx_hotels_destination ON hotels(destination_id);

COMMIT;

-- =====================================================================
-- VERIFICATION
-- After running, the following should all return 't' (true):
-- =====================================================================
SELECT 'packages.reference exists'                  AS check, EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='packages' AND column_name='reference') AS ok
UNION ALL
SELECT 'tours.confirmation_id exists',              EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='tours' AND column_name='confirmation_id')
UNION ALL
SELECT 'invoices.confirmation_id exists',           EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='confirmation_id')
UNION ALL
SELECT 'payments.confirmation_id exists',           EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='payments' AND column_name='confirmation_id')
UNION ALL
SELECT 'leads.selected_accommodation_by_night',     EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='selected_accommodation_by_night')
UNION ALL
SELECT 'leads.package_snapshot exists',             EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='package_snapshot')
UNION ALL
SELECT 'tours.package_snapshot exists',             EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='tours' AND column_name='package_snapshot');
