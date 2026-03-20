-- Paraíso Ceylon Tours - production schema
-- Run this in Supabase Dashboard: SQL Editor -> New query -> Paste -> Run

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  reference TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT DEFAULT '',
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  destination TEXT,
  travel_date TEXT,
  pax INTEGER,
  accompanied_guest_name TEXT,
  notes TEXT,
  package_id TEXT,
  selected_accommodation_option_id TEXT,
  selected_accommodation_by_night JSONB,
  selected_transport_option_id TEXT,
  selected_meal_option_id TEXT,
  total_price NUMERIC,
  package_snapshot JSONB,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS packages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  duration TEXT NOT NULL,
  destination TEXT NOT NULL,
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  description TEXT NOT NULL,
  itinerary JSONB NOT NULL DEFAULT '[]',
  inclusions JSONB NOT NULL DEFAULT '[]',
  exclusions JSONB NOT NULL DEFAULT '[]',
  region TEXT,
  image_url TEXT,
  rating NUMERIC,
  review_count INTEGER,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  published BOOLEAN NOT NULL DEFAULT TRUE,
  cancellation_policy TEXT,
  meal_options JSONB NOT NULL DEFAULT '[]',
  transport_options JSONB NOT NULL DEFAULT '[]',
  accommodation_options JSONB NOT NULL DEFAULT '[]',
  custom_options JSONB NOT NULL DEFAULT '[]',
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tours (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL REFERENCES packages(id),
  package_name TEXT NOT NULL,
  lead_id TEXT NOT NULL REFERENCES leads(id),
  client_name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  pax INTEGER NOT NULL,
  status TEXT NOT NULL,
  total_value NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  package_snapshot JSONB,
  client_confirmation_sent_at TEXT,
  supplier_notifications_sent_at TEXT,
  payment_receipt_sent_at TEXT,
  availability_status TEXT,
  availability_warnings JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hotels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  location TEXT,
  email TEXT,
  contact TEXT,
  default_price_per_night NUMERIC,
  currency TEXT NOT NULL,
  max_concurrent_bookings INTEGER,
  star_rating NUMERIC,
  notes TEXT,
  bank_name TEXT,
  bank_branch TEXT,
  account_name TEXT,
  account_number TEXT,
  swift_code TEXT,
  bank_currency TEXT,
  payment_reference TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id),
  reference TEXT,
  invoice_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT,
  package_name TEXT NOT NULL,
  travel_date TEXT,
  pax INTEGER,
  base_amount NUMERIC NOT NULL,
  line_items JSONB NOT NULL DEFAULT '[]',
  total_amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  notes TEXT,
  paid_at TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL,
  department TEXT,
  pay_type TEXT NOT NULL,
  salary NUMERIC,
  commission_pct NUMERIC,
  hourly_rate NUMERIC,
  tax_pct NUMERIC,
  benefits_amount NUMERIC,
  currency TEXT NOT NULL,
  bank_name TEXT,
  account_number TEXT,
  status TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_runs (
  id TEXT PRIMARY KEY,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  pay_date TEXT NOT NULL,
  status TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  total_gross NUMERIC NOT NULL,
  total_deductions NUMERIC NOT NULL,
  total_net NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  paid_at TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  description TEXT NOT NULL,
  client_name TEXT,
  reference TEXT,
  lead_id TEXT REFERENCES leads(id),
  tour_id TEXT REFERENCES tours(id),
  invoice_id TEXT REFERENCES invoices(id),
  supplier_id TEXT REFERENCES hotels(id),
  payroll_run_id TEXT REFERENCES payroll_runs(id),
  payable_week_start TEXT,
  payable_week_end TEXT,
  supplier_name TEXT,
  status TEXT NOT NULL,
  date TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  summary TEXT NOT NULL,
  actor TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY,
  company JSONB NOT NULL DEFAULT '{}'::jsonb,
  portal JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_secrets (
  id TEXT PRIMARY KEY,
  ai_api_key_encrypted TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_knowledge_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_ref TEXT,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_interactions (
  id TEXT PRIMARY KEY,
  tool TEXT NOT NULL,
  request_text TEXT NOT NULL,
  response_text TEXT NOT NULL,
  planned_action JSONB NOT NULL DEFAULT '{}'::jsonb,
  executed_ok BOOLEAN,
  helpful BOOLEAN,
  feedback_notes TEXT,
  promoted_to_knowledge BOOLEAN,
  provider_label TEXT,
  model TEXT,
  model_mode TEXT,
  superpower_used BOOLEAN,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cache_creation_input_tokens INTEGER,
  cache_read_input_tokens INTEGER,
  estimated_cost_usd NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS ai JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE app_secrets
  ADD COLUMN IF NOT EXISTS ai_api_key_encrypted TEXT NOT NULL DEFAULT '';

ALTER TABLE ai_knowledge_documents
  ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE ai_knowledge_documents
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE ai_interactions
  ADD COLUMN IF NOT EXISTS planned_action JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE ai_interactions
  ADD COLUMN IF NOT EXISTS executed_ok BOOLEAN;

ALTER TABLE ai_interactions
  ADD COLUMN IF NOT EXISTS helpful BOOLEAN;

ALTER TABLE ai_interactions
  ADD COLUMN IF NOT EXISTS feedback_notes TEXT;

ALTER TABLE ai_interactions
  ADD COLUMN IF NOT EXISTS promoted_to_knowledge BOOLEAN;

ALTER TABLE ai_interactions
  ADD COLUMN IF NOT EXISTS provider_label TEXT;

ALTER TABLE ai_interactions
  ADD COLUMN IF NOT EXISTS model TEXT;

ALTER TABLE ai_interactions
  ADD COLUMN IF NOT EXISTS model_mode TEXT;

ALTER TABLE ai_interactions
  ADD COLUMN IF NOT EXISTS superpower_used BOOLEAN;

ALTER TABLE ai_interactions
  ADD COLUMN IF NOT EXISTS input_tokens INTEGER;

ALTER TABLE ai_interactions
  ADD COLUMN IF NOT EXISTS output_tokens INTEGER;

ALTER TABLE ai_interactions
  ADD COLUMN IF NOT EXISTS cache_creation_input_tokens INTEGER;

ALTER TABLE ai_interactions
  ADD COLUMN IF NOT EXISTS cache_read_input_tokens INTEGER;

ALTER TABLE ai_interactions
  ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS package_snapshot JSONB;

ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE tours
  ADD COLUMN IF NOT EXISTS availability_status TEXT;

ALTER TABLE tours
  ADD COLUMN IF NOT EXISTS availability_warnings JSONB NOT NULL DEFAULT '[]';

ALTER TABLE tours
  ADD COLUMN IF NOT EXISTS package_snapshot JSONB;

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS max_concurrent_bookings INTEGER;

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

UPDATE tours
SET availability_warnings = '[]'
WHERE availability_warnings IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tours_lead_id_unique
  ON tours(lead_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_lead_id_unique
  ON invoices(lead_id);
CREATE INDEX IF NOT EXISTS idx_leads_reference
  ON leads(UPPER(reference));
CREATE INDEX IF NOT EXISTS idx_leads_email
  ON leads(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_packages_published
  ON packages(published);
CREATE INDEX IF NOT EXISTS idx_packages_archived_at
  ON packages(archived_at);
CREATE INDEX IF NOT EXISTS idx_tours_start_date
  ON tours(start_date);
CREATE INDEX IF NOT EXISTS idx_tours_status
  ON tours(status);
CREATE INDEX IF NOT EXISTS idx_payments_tour_id
  ON payments(tour_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id
  ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_date
  ON payments(date);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_documents_active
  ON ai_knowledge_documents(active, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_updated_at
  ON ai_interactions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_hotels_type
  ON hotels(type);
CREATE INDEX IF NOT EXISTS idx_hotels_archived_at
  ON hotels(archived_at);
CREATE INDEX IF NOT EXISTS idx_employees_archived_at
  ON employees(archived_at);
CREATE INDEX IF NOT EXISTS idx_leads_archived_at
  ON leads(archived_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON audit_logs(entity_type, entity_id, created_at DESC);
