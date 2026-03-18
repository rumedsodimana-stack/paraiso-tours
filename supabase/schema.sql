-- Paraíso Ceylon Tours - Supabase schema
-- Run this in Supabase Dashboard: SQL Editor → New query → Paste → Run

-- Leads
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
  notes TEXT,
  package_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Packages
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tours
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
  currency TEXT NOT NULL
);

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_leads_reference ON leads(UPPER(reference));
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_tours_lead_id ON tours(lead_id);
