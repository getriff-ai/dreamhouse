/**
 * Property data access layer.
 *
 * Data source priority:
 *  1. Supabase (if configured and has data)
 *  2. Real properties from King County ingestion (real-properties.json)
 *  3. Seed data (seed-properties.json)
 *
 * The `getDataSource()` helper tells the UI which data is currently loaded.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type {
  Property,
  ParsedIntent,
  SearchResult,
} from "@/types";
import { computeMatchScore } from "@/lib/scoring/matchScore";
import { computeTransactScore } from "@/lib/scoring/transactScore";
import seedData from "@/data/seed-properties.json";

// ---------------------------------------------------------------------------
// Data source tracking
// ---------------------------------------------------------------------------

export type DataSourceType = "supabase" | "real-properties" | "seed";

let activeDataSource: DataSourceType = "seed";

/**
 * Returns which data source is currently being used to serve properties.
 * Useful for displaying a badge in the UI or debugging.
 */
export function getDataSource(): DataSourceType {
  return activeDataSource;
}

// ---------------------------------------------------------------------------
// In-memory caches
// ---------------------------------------------------------------------------

let cachedSeedProperties: Property[] | null = null;
let cachedRealProperties: Property[] | null = null;
let realPropertiesLoadAttempted = false;

function getSeedProperties(): Property[] {
  if (!cachedSeedProperties) {
    cachedSeedProperties = seedData as Property[];
  }
  return cachedSeedProperties;
}

/**
 * Attempt to load real (ingested) property data from real-properties.json.
 *
 * Uses a dynamic import wrapped in try/catch. The file may not exist if
 * ingestion has not been run yet. On failure, returns null and caches that
 * result so we don't re-attempt on every request.
 */
async function loadRealProperties(): Promise<Property[] | null> {
  if (realPropertiesLoadAttempted) return cachedRealProperties;
  realPropertiesLoadAttempted = true;

  try {
    const filePath = join(process.cwd(), "src", "data", "real-properties.json");
    if (!existsSync(filePath)) return null;

    const raw = readFileSync(filePath, "utf-8");
    const properties = JSON.parse(raw) as Property[];
    if (Array.isArray(properties) && properties.length > 0) {
      cachedRealProperties = properties;
      return cachedRealProperties;
    }
    return null;
  } catch {
    // File doesn't exist or is malformed - expected before first ingestion
    return null;
  }
}

/**
 * Force-reload real properties from disk on next access.
 * Call this after an ingestion run completes.
 */
export function invalidateRealPropertiesCache(): void {
  cachedRealProperties = null;
  realPropertiesLoadAttempted = false;
}

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------

function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

async function loadFromSupabase(marketId: string): Promise<Property[] | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    // Dynamic import to avoid errors when Supabase env vars are not set
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .eq("market_id", marketId)
      .limit(1000);

    if (error || !data || data.length === 0) {
      return null;
    }

    // Map snake_case DB columns to camelCase Property type
    return data.map(mapDbRowToProperty);
  } catch {
    // Supabase not available - fall back to other sources
    return null;
  }
}

/**
 * Map a Supabase row (snake_case) to our Property interface (camelCase).
 */
function mapDbRowToProperty(row: Record<string, unknown>): Property {
  return {
    id: row.id as string,
    marketId: (row.market_id ?? row.marketId) as string,
    parcelId: (row.parcel_id ?? row.parcelId ?? null) as string | null,
    address: row.address as string,
    city: row.city as string,
    state: row.state as string,
    zip: row.zip as string,
    lat: row.lat as number,
    lng: row.lng as number,
    bedrooms: row.bedrooms as number,
    bathrooms: row.bathrooms as number,
    sqft: row.sqft as number,
    lotSqft: (row.lot_sqft ?? row.lotSqft ?? null) as number | null,
    yearBuilt: (row.year_built ?? row.yearBuilt ?? null) as number | null,
    propertyType: (row.property_type ?? row.propertyType) as Property["propertyType"],
    architecturalStyle: (row.architectural_style ?? row.architecturalStyle ?? null) as string | null,
    features: (row.features ?? []) as string[],
    lastSaleDate: (row.last_sale_date ?? row.lastSaleDate ?? null) as string | null,
    lastSalePrice: (row.last_sale_price ?? row.lastSalePrice ?? null) as number | null,
    estimatedValue: (row.estimated_value ?? row.estimatedValue ?? null) as number | null,
    ownerName: (row.owner_name ?? row.ownerName ?? null) as string | null,
    ownerMailingAddress: (row.owner_mailing_address ?? row.ownerMailingAddress ?? null) as string | null,
    absenteeOwner: (row.absentee_owner ?? row.absenteeOwner ?? false) as boolean,
    ownershipYears: (row.ownership_years ?? row.ownershipYears ?? null) as number | null,
    equityEstimate: (row.equity_estimate ?? row.equityEstimate ?? null) as number | null,
    taxStatus: (row.tax_status ?? row.taxStatus ?? "unknown") as Property["taxStatus"],
    permitHistory: (row.permit_history ?? row.permitHistory ?? []) as Property["permitHistory"],
    listingStatus: (row.listing_status ?? row.listingStatus ?? "off_market") as Property["listingStatus"],
    listingPrice: (row.listing_price ?? row.listingPrice ?? null) as number | null,
    mlsNumber: (row.mls_number ?? row.mlsNumber ?? null) as string | null,
    photoUrls: (row.photo_urls ?? row.photoUrls ?? []) as string[],
    dataSources: (row.data_sources ?? row.dataSources ?? []) as string[],
    updatedAt: (row.updated_at ?? row.updatedAt ?? new Date().toISOString()) as string,
    createdAt: (row.created_at ?? row.createdAt ?? new Date().toISOString()) as string,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get all properties for a given market.
 *
 * Priority:
 *  1. Supabase (if configured)
 *  2. Real ingested data (real-properties.json)
 *  3. Seed data (seed-properties.json)
 */
export async function getProperties(marketId: string): Promise<Property[]> {
  // 1. Try Supabase first
  const supabaseData = await loadFromSupabase(marketId);
  if (supabaseData && supabaseData.length > 0) {
    activeDataSource = "supabase";
    return supabaseData;
  }

  // 2. Try real ingested properties
  const realData = await loadRealProperties();
  if (realData && realData.length > 0) {
    activeDataSource = "real-properties";
    return realData.filter(
      (p) => p.marketId === marketId || marketId === "seattle"
    );
  }

  // 3. Fall back to seed data filtered by marketId
  activeDataSource = "seed";
  return getSeedProperties().filter(
    (p) => p.marketId === marketId || marketId === "seattle"
  );
}

/** Minimum match score to include in results */
const MIN_MATCH_SCORE = 25;

/** Results per page */
export const PAGE_SIZE = 25;

/**
 * Search properties based on a parsed buyer intent.
 * Returns ranked SearchResult[] sorted by weighted score.
 *
 * @param intent   Parsed buyer intent
 * @param marketId Market identifier
 * @param page     1-based page number (default 1)
 */
export async function searchProperties(
  intent: ParsedIntent,
  marketId: string,
  page: number = 1
): Promise<{ results: SearchResult[]; total: number; page: number; pageSize: number }> {
  const properties = await getProperties(marketId);

  const scored: SearchResult[] = properties.map((property) => {
    const { score: matchScore, explanation } = computeMatchScore(
      property,
      intent
    );
    const { level: transactLevel } = computeTransactScore(property);

    return {
      property,
      matchScore,
      transactScore: transactLevel,
      matchExplanation: explanation,
    };
  });

  // Filter out very low scores
  const filtered = scored.filter((r) => r.matchScore >= MIN_MATCH_SCORE);

  // Sort by weighted combination: 0.7 * matchScore + 0.3 * transactNumeric
  filtered.sort((a, b) => {
    const transactNumericA = transactToNumeric(a.transactScore);
    const transactNumericB = transactToNumeric(b.transactScore);
    const weightedA = 0.7 * a.matchScore + 0.3 * transactNumericA;
    const weightedB = 0.7 * b.matchScore + 0.3 * transactNumericB;
    return weightedB - weightedA;
  });

  const total = filtered.length;
  const offset = (page - 1) * PAGE_SIZE;
  const results = filtered.slice(offset, offset + PAGE_SIZE);

  return { results, total, page, pageSize: PAGE_SIZE };
}

/**
 * Map transact level to a numeric value for sorting purposes.
 */
function transactToNumeric(level: string): number {
  switch (level) {
    case "high":
      return 100;
    case "medium":
      return 50;
    case "low":
      return 20;
    default:
      return 0;
  }
}
