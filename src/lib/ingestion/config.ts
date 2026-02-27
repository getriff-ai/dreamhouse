/**
 * King County / Seattle data ingestion configuration.
 *
 * ZIP codes grouped by neighborhood for targeted parcel downloads.
 * ArcGIS REST API endpoints for King County Open Data portal.
 */

// ---------------------------------------------------------------------------
// Neighborhood ZIP code mappings
// ---------------------------------------------------------------------------

export interface NeighborhoodZipGroup {
  name: string;
  zipCodes: string[];
}

export const SEATTLE_NEIGHBORHOODS: NeighborhoodZipGroup[] = [
  { name: "Capitol Hill", zipCodes: ["98102", "98112"] },
  { name: "Queen Anne", zipCodes: ["98109", "98119"] },
  { name: "Ballard", zipCodes: ["98107", "98117"] },
  { name: "Wallingford / Fremont", zipCodes: ["98103"] },
  { name: "Madison Park / Laurelhurst", zipCodes: ["98112"] },
  { name: "Mercer Island", zipCodes: ["98040"] },
  { name: "Bellevue", zipCodes: ["98004", "98005", "98006", "98007", "98008"] },
  { name: "Kirkland", zipCodes: ["98033", "98034"] },
  { name: "Green Lake / Ravenna", zipCodes: ["98103", "98115"] },
  { name: "Magnolia", zipCodes: ["98199"] },
  { name: "West Seattle", zipCodes: ["98116", "98126", "98136"] },
  { name: "Medina / Hunts Point / Clyde Hill", zipCodes: ["98039", "98004"] },
];

/** Core Seattle ZIP codes for MVP ingestion. */
export const MVP_ZIP_CODES: string[] = [
  "98102", // Capitol Hill
  "98103", // Wallingford / Fremont / Green Lake
  "98107", // Ballard
  "98109", // Queen Anne (lower)
  "98112", // Madison Park / Capitol Hill (east)
  "98115", // Ravenna / Wedgwood
  "98116", // West Seattle (Admiral)
  "98119", // Queen Anne (upper)
  "98199", // Magnolia
];

/** All unique ZIP codes across every defined neighborhood. */
export const ALL_ZIP_CODES: string[] = Array.from(
  new Set(SEATTLE_NEIGHBORHOODS.flatMap((n) => n.zipCodes))
).sort();

/** Look up which neighborhoods a ZIP code belongs to. */
export function neighborhoodsForZip(zip: string): string[] {
  return SEATTLE_NEIGHBORHOODS.filter((n) => n.zipCodes.includes(zip)).map(
    (n) => n.name
  );
}

// ---------------------------------------------------------------------------
// ArcGIS REST API endpoints (King County Open Data Portal)
// ---------------------------------------------------------------------------

const KC_ARCGIS_BASE =
  "https://gismaps.kingcounty.gov/arcgis/rest/services/Property/KingCo_PropertyInfo/MapServer";

/** Parcels layer (Layer 2) with property characteristics. */
export const KC_PARCEL_ENDPOINT = `${KC_ARCGIS_BASE}/2/query`;

/** Property sales in last 3 years (Layer 3). */
export const KC_SALES_ENDPOINT = `${KC_ARCGIS_BASE}/3/query`;

// ---------------------------------------------------------------------------
// API pagination and rate-limit defaults
// ---------------------------------------------------------------------------

/** Maximum records King County returns per request. */
export const KC_PAGE_SIZE = 1000;

/** Delay (ms) between paginated requests to be a good API citizen. */
export const KC_REQUEST_DELAY_MS = 250;

/** Maximum total records to fetch in a single ingestion run (safety cap). */
export const KC_MAX_RECORDS = 10_000;

// ---------------------------------------------------------------------------
// Market ID used in the Property type
// ---------------------------------------------------------------------------

export const SEATTLE_MARKET_ID = "market-seattle";
