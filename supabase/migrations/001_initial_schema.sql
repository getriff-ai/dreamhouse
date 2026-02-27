-- Dreamhouse Initial Schema
-- Supabase/PostgreSQL migration

-- ============================================================================
-- Extensions
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Markets
-- ============================================================================

CREATE TABLE markets (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  state         TEXT NOT NULL,
  geo_boundary  GEOMETRY(Polygon, 4326),
  active        BOOLEAN NOT NULL DEFAULT true,
  config        JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Properties
-- ============================================================================

CREATE TABLE properties (
  id                    TEXT PRIMARY KEY,
  market_id             TEXT NOT NULL REFERENCES markets(id),
  parcel_id             TEXT,
  address               TEXT NOT NULL,
  city                  TEXT NOT NULL,
  state                 TEXT NOT NULL,
  zip                   TEXT NOT NULL,
  lat                   DOUBLE PRECISION NOT NULL,
  lng                   DOUBLE PRECISION NOT NULL,
  location              GEOMETRY(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)) STORED,
  bedrooms              INTEGER NOT NULL,
  bathrooms             NUMERIC(3,1) NOT NULL,
  sqft                  INTEGER NOT NULL,
  lot_sqft              INTEGER,
  year_built            INTEGER,
  property_type         TEXT NOT NULL CHECK (property_type IN ('single_family', 'condo', 'townhouse', 'multi_family', 'land', 'other')),
  architectural_style   TEXT,
  features              JSONB NOT NULL DEFAULT '[]',
  last_sale_date        DATE,
  last_sale_price       BIGINT,
  estimated_value       BIGINT,
  owner_name            TEXT,
  owner_mailing_address TEXT,
  absentee_owner        BOOLEAN NOT NULL DEFAULT false,
  ownership_years       INTEGER,
  equity_estimate       BIGINT,
  tax_status            TEXT NOT NULL DEFAULT 'current' CHECK (tax_status IN ('current', 'delinquent', 'unknown')),
  permit_history        JSONB NOT NULL DEFAULT '[]',
  listing_status        TEXT NOT NULL DEFAULT 'off_market' CHECK (listing_status IN ('on_market', 'off_market', 'recently_sold')),
  listing_price         BIGINT,
  mls_number            TEXT,
  photo_urls            JSONB NOT NULL DEFAULT '[]',
  data_sources          JSONB NOT NULL DEFAULT '[]',
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Agents
-- ============================================================================

CREATE TABLE agents (
  id                  TEXT PRIMARY KEY,
  email               TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  brokerage           TEXT,
  license_number      TEXT,
  license_state       TEXT,
  license_verified    BOOLEAN NOT NULL DEFAULT false,
  subscription_status TEXT NOT NULL DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'past_due', 'canceled')),
  team_id             TEXT,
  role                TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('agent', 'team_admin', 'brokerage_admin')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Teams
-- ============================================================================

CREATE TABLE teams (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  brokerage       TEXT,
  admin_agent_id  TEXT NOT NULL REFERENCES agents(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add FK from agents to teams (deferred because of circular reference)
ALTER TABLE agents
  ADD CONSTRAINT agents_team_id_fkey
  FOREIGN KEY (team_id) REFERENCES teams(id);

-- ============================================================================
-- Buyer Profiles
-- ============================================================================

CREATE TABLE buyer_profiles (
  id              TEXT PRIMARY KEY,
  agent_id        TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  raw_text        TEXT NOT NULL,
  parsed_intent   JSONB NOT NULL DEFAULT '{}',
  market_id       TEXT NOT NULL REFERENCES markets(id),
  alert_enabled   BOOLEAN NOT NULL DEFAULT false,
  last_run_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Search Results
-- ============================================================================

CREATE TABLE search_results (
  id                TEXT PRIMARY KEY DEFAULT 'sr-' || uuid_generate_v4()::text,
  buyer_profile_id  TEXT NOT NULL REFERENCES buyer_profiles(id) ON DELETE CASCADE,
  property_id       TEXT NOT NULL REFERENCES properties(id),
  match_score       NUMERIC(5,2) NOT NULL,
  transact_score    TEXT NOT NULL CHECK (transact_score IN ('low', 'medium', 'high')),
  match_explanation JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Audit Log
-- ============================================================================

CREATE TABLE audit_log (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  agent_id    TEXT REFERENCES agents(id),
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Properties: market + listing status for filtered queries
CREATE INDEX idx_properties_market_status ON properties(market_id, listing_status);

-- Properties: spatial index on the generated geometry column
CREATE INDEX idx_properties_location ON properties USING GIST (location);

-- Properties: lat/lng for non-PostGIS queries
CREATE INDEX idx_properties_lat ON properties(lat);
CREATE INDEX idx_properties_lng ON properties(lng);

-- Properties: property type and price for search filtering
CREATE INDEX idx_properties_type ON properties(property_type);
CREATE INDEX idx_properties_listing_price ON properties(listing_price) WHERE listing_price IS NOT NULL;
CREATE INDEX idx_properties_estimated_value ON properties(estimated_value) WHERE estimated_value IS NOT NULL;

-- Buyer profiles: agent lookup
CREATE INDEX idx_buyer_profiles_agent ON buyer_profiles(agent_id);
CREATE INDEX idx_buyer_profiles_market ON buyer_profiles(market_id);

-- Search results: buyer profile lookup
CREATE INDEX idx_search_results_profile ON search_results(buyer_profile_id);
CREATE INDEX idx_search_results_property ON search_results(property_id);

-- Audit log: entity lookups
CREATE INDEX idx_audit_log_agent ON audit_log(agent_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Markets: readable by all authenticated users
CREATE POLICY "Markets are readable by authenticated users"
  ON markets FOR SELECT
  TO authenticated
  USING (true);

-- Properties: readable by all authenticated users
CREATE POLICY "Properties are readable by authenticated users"
  ON properties FOR SELECT
  TO authenticated
  USING (true);

-- Agents: can only read/update their own record
CREATE POLICY "Agents can read own record"
  ON agents FOR SELECT
  TO authenticated
  USING (id = auth.uid()::text);

CREATE POLICY "Agents can update own record"
  ON agents FOR UPDATE
  TO authenticated
  USING (id = auth.uid()::text)
  WITH CHECK (id = auth.uid()::text);

-- Teams: members can read their team
CREATE POLICY "Team members can read their team"
  ON teams FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT team_id FROM agents WHERE agents.id = auth.uid()::text AND team_id IS NOT NULL
    )
  );

-- Teams: only team admins can update
CREATE POLICY "Team admins can update their team"
  ON teams FOR UPDATE
  TO authenticated
  USING (admin_agent_id = auth.uid()::text)
  WITH CHECK (admin_agent_id = auth.uid()::text);

-- Buyer profiles: agents can CRUD their own profiles
CREATE POLICY "Agents can read own buyer profiles"
  ON buyer_profiles FOR SELECT
  TO authenticated
  USING (agent_id = auth.uid()::text);

CREATE POLICY "Agents can insert own buyer profiles"
  ON buyer_profiles FOR INSERT
  TO authenticated
  WITH CHECK (agent_id = auth.uid()::text);

CREATE POLICY "Agents can update own buyer profiles"
  ON buyer_profiles FOR UPDATE
  TO authenticated
  USING (agent_id = auth.uid()::text)
  WITH CHECK (agent_id = auth.uid()::text);

CREATE POLICY "Agents can delete own buyer profiles"
  ON buyer_profiles FOR DELETE
  TO authenticated
  USING (agent_id = auth.uid()::text);

-- Search results: agents can read/write results for their own profiles
CREATE POLICY "Agents can read own search results"
  ON search_results FOR SELECT
  TO authenticated
  USING (
    buyer_profile_id IN (
      SELECT id FROM buyer_profiles WHERE agent_id = auth.uid()::text
    )
  );

CREATE POLICY "Agents can insert own search results"
  ON search_results FOR INSERT
  TO authenticated
  WITH CHECK (
    buyer_profile_id IN (
      SELECT id FROM buyer_profiles WHERE agent_id = auth.uid()::text
    )
  );

CREATE POLICY "Agents can delete own search results"
  ON search_results FOR DELETE
  TO authenticated
  USING (
    buyer_profile_id IN (
      SELECT id FROM buyer_profiles WHERE agent_id = auth.uid()::text
    )
  );

-- Audit log: agents can read their own audit entries
CREATE POLICY "Agents can read own audit log"
  ON audit_log FOR SELECT
  TO authenticated
  USING (agent_id = auth.uid()::text);

-- ============================================================================
-- Updated-at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- Seed Data: Seattle Market
-- ============================================================================

INSERT INTO markets (id, name, slug, state, active, config) VALUES (
  'market-seattle',
  'Seattle Metro',
  'seattle',
  'WA',
  true,
  '{
    "dataSources": ["county-records", "seed-data"],
    "scoringWeights": {
      "location": 25,
      "budget": 20,
      "style": 20,
      "features": 15,
      "bedsBaths": 10,
      "sqft": 10
    },
    "defaultCenter": [-122.3321, 47.6062],
    "defaultZoom": 11
  }'::jsonb
);
