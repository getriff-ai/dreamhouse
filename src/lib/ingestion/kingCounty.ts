/**
 * King County public records data ingestion.
 *
 * Downloads parcel and sale records from King County's ArcGIS REST API
 * (gismaps.kingcounty.gov), transforms into our Property type.
 *
 * Parcel layer (Layer 2): PIN, address, lot sqft, assessed values, property type
 * Sales layer (Layer 3): PIN, sale date, sale price, buyer/seller
 *
 * The parcel layer returns polygon geometry. We compute centroids for lat/lng.
 * Detailed building characteristics (beds, baths, sqft, year built) are not in
 * this layer. We estimate from assessed values and enrich later with AI.
 */

import type { Property, PropertyType, ListingStatus, TaxStatus } from "@/types";
import {
  KC_PARCEL_ENDPOINT,
  KC_SALES_ENDPOINT,
  KC_PAGE_SIZE,
  KC_REQUEST_DELAY_MS,
  KC_MAX_RECORDS,
  SEATTLE_MARKET_ID,
} from "./config";

// ---------------------------------------------------------------------------
// Raw record types (King County ArcGIS field names)
// ---------------------------------------------------------------------------

export interface KCParcelRaw {
  PIN: string;
  MAJOR: string;
  MINOR: string;
  ADDR_FULL: string;
  ZIP5: string;
  CTYNAME: string;
  LOTSQFT: number;
  APPRLNDVAL: number;  // Appraised land value
  APPR_IMPR: number;   // Appraised improvement value
  PROPTYPE: string;     // R = Residential, C = Commercial, etc.
  PREUSE_DESC: string;  // Present use description
  [key: string]: unknown;
}

export interface KCSaleRaw {
  PIN: string;
  address: string;
  SaleDate: number;    // epoch milliseconds
  SalePrice: number;
  buyername: string;
  Property_Type: string;
  Principal_Use: string;
  [key: string]: unknown;
}

interface ArcGISFeature<T> {
  attributes: T;
  geometry?: {
    rings?: number[][][];
    x?: number;
    y?: number;
  };
}

interface ArcGISQueryResponse<T> {
  features: ArcGISFeature<T>[];
  exceededTransferLimit?: boolean;
  error?: { code: number; message: string };
}

// ---------------------------------------------------------------------------
// Ingestion progress
// ---------------------------------------------------------------------------

export interface IngestionProgress {
  phase: "fetching" | "transforming" | "complete" | "error";
  recordsFetched: number;
  recordsTransformed: number;
  currentZip: string | null;
  errors: string[];
}

export interface IngestionResult {
  properties: Property[];
  totalFetched: number;
  totalTransformed: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// ArcGIS query helpers
// ---------------------------------------------------------------------------

function buildArcGISParams(
  where: string,
  outFields: string,
  offset: number,
  resultRecordCount: number,
  returnGeometry: boolean = true
): URLSearchParams {
  return new URLSearchParams({
    where,
    outFields,
    f: "json",
    resultRecordCount: String(resultRecordCount),
    resultOffset: String(offset),
    returnGeometry: String(returnGeometry),
    outSR: "4326",
  });
}

async function fetchArcGISPage<T>(
  endpoint: string,
  where: string,
  outFields: string = "*",
  offset: number = 0,
  pageSize: number = KC_PAGE_SIZE,
  returnGeometry: boolean = true
): Promise<{ features: ArcGISFeature<T>[]; hasMore: boolean }> {
  const params = buildArcGISParams(where, outFields, offset, pageSize, returnGeometry);
  const url = `${endpoint}?${params.toString()}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `ArcGIS request failed: ${response.status} ${response.statusText}`
    );
  }

  const data: ArcGISQueryResponse<T> = await response.json();

  if (data.error) {
    throw new Error(
      `ArcGIS error ${data.error.code}: ${data.error.message}`
    );
  }

  const features = data.features ?? [];
  const hasMore = data.exceededTransferLimit === true || features.length === pageSize;

  return { features, hasMore };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAllFeatures<T>(
  endpoint: string,
  where: string,
  outFields: string = "*",
  limit: number = KC_MAX_RECORDS,
  returnGeometry: boolean = true,
  onPage?: (fetched: number) => void
): Promise<ArcGISFeature<T>[]> {
  const allFeatures: ArcGISFeature<T>[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore && allFeatures.length < limit) {
    const remaining = limit - allFeatures.length;
    const pageSize = Math.min(KC_PAGE_SIZE, remaining);

    const { features, hasMore: more } = await fetchArcGISPage<T>(
      endpoint, where, outFields, offset, pageSize, returnGeometry
    );

    allFeatures.push(...features);
    hasMore = more && features.length > 0;
    offset += features.length;

    onPage?.(allFeatures.length);

    if (hasMore && allFeatures.length < limit) {
      await sleep(KC_REQUEST_DELAY_MS);
    }
  }

  return allFeatures;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function computeCentroid(geometry: ArcGISFeature<unknown>["geometry"]): { lat: number; lng: number } | null {
  if (!geometry) return null;

  // Point geometry
  if (geometry.x !== undefined && geometry.y !== undefined) {
    return { lat: geometry.y, lng: geometry.x };
  }

  // Polygon geometry: compute centroid from rings
  if (geometry.rings && geometry.rings.length > 0) {
    const ring = geometry.rings[0]; // outer ring
    if (ring.length === 0) return null;

    let sumX = 0, sumY = 0;
    for (const point of ring) {
      sumX += point[0];
      sumY += point[1];
    }
    return {
      lat: sumY / ring.length,
      lng: sumX / ring.length,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Fetch parcels
// ---------------------------------------------------------------------------

const PARCEL_FIELDS = [
  "PIN", "MAJOR", "MINOR", "ADDR_FULL", "ZIP5", "CTYNAME",
  "LOTSQFT", "APPRLNDVAL", "APPR_IMPR", "PROPTYPE", "PREUSE_DESC",
].join(",");

export async function fetchKingCountyParcels(
  zipCodes: string[] = [],
  limit: number = KC_MAX_RECORDS,
  onProgress?: (progress: IngestionProgress) => void
): Promise<{ raw: KCParcelRaw; centroid: { lat: number; lng: number } | null }[]> {
  const progress: IngestionProgress = {
    phase: "fetching",
    recordsFetched: 0,
    recordsTransformed: 0,
    currentZip: null,
    errors: [],
  };

  const allRecords: { raw: KCParcelRaw; centroid: { lat: number; lng: number } | null }[] = [];

  const zipGroups = zipCodes.length > 0 ? zipCodes : ["__all__"];
  const perZipLimit = zipCodes.length > 0
    ? Math.ceil(limit / zipCodes.length)
    : limit;

  for (const zip of zipGroups) {
    progress.currentZip = zip === "__all__" ? null : zip;
    onProgress?.({ ...progress });

    // Filter to residential properties with addresses
    const where =
      zip === "__all__"
        ? "PROPTYPE = 'R' AND ADDR_FULL <> ''"
        : `ZIP5 = '${zip}' AND PROPTYPE = 'R' AND ADDR_FULL <> ''`;

    try {
      const features = await fetchAllFeatures<KCParcelRaw>(
        KC_PARCEL_ENDPOINT,
        where,
        PARCEL_FIELDS,
        perZipLimit,
        true, // need geometry for centroid
        (fetched) => {
          progress.recordsFetched = allRecords.length + fetched;
          onProgress?.({ ...progress });
        }
      );

      for (const f of features) {
        allRecords.push({
          raw: f.attributes,
          centroid: computeCentroid(f.geometry),
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      progress.errors.push(`ZIP ${zip}: ${message}`);
      console.error(`[kingCounty] Error for ZIP ${zip}:`, err);
    }

    if (allRecords.length >= limit) break;
  }

  progress.phase = "complete";
  progress.recordsFetched = allRecords.length;
  onProgress?.({ ...progress });

  return allRecords.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Fetch sales
// ---------------------------------------------------------------------------

const SALE_FIELDS = [
  "PIN", "address", "SaleDate", "SalePrice", "buyername",
  "Property_Type", "Principal_Use",
].join(",");

export async function fetchKingCountySales(
  limit: number = KC_MAX_RECORDS
): Promise<KCSaleRaw[]> {
  try {
    const features = await fetchAllFeatures<KCSaleRaw>(
      KC_SALES_ENDPOINT,
      "SalePrice > 100000", // Filter noise (very low prices are usually non-arms-length)
      SALE_FIELDS,
      limit,
      false // no geometry needed for sales
    );
    return features.map(f => f.attributes);
  } catch (err) {
    console.error("[kingCounty] Error fetching sales:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------

function mapPropertyType(propType: string | null, preUseDesc: string | null): PropertyType {
  if (!propType && !preUseDesc) return "other";

  const desc = (preUseDesc ?? "").toLowerCase();

  if (desc.includes("single family")) return "single_family";
  if (desc.includes("condo")) return "condo";
  if (desc.includes("townhouse")) return "townhouse";
  if (desc.includes("duplex") || desc.includes("triplex") || desc.includes("apartment")) return "multi_family";
  if (desc.includes("vacant")) return "land";

  const type = (propType ?? "").toUpperCase();
  if (type === "R") return "single_family";
  if (type === "C") return "condo";

  return "other";
}

function makePropertyId(pin: string): string {
  return `kc-${pin.replace(/\s/g, "")}`;
}

function estimateFromAssessedValues(landVal: number, imprVal: number): {
  estimatedValue: number | null;
  estimatedSqft: number | null;
  estimatedBeds: number | null;
  estimatedBaths: number | null;
} {
  const totalAssessed = landVal + imprVal;
  if (totalAssessed <= 0) {
    return { estimatedValue: null, estimatedSqft: null, estimatedBeds: null, estimatedBaths: null };
  }

  // King County assessed values are typically 90-100% of market value
  const estimatedValue = Math.round(totalAssessed * 1.05);

  // Very rough estimates from improvement value (will be refined by AI enrichment)
  // Seattle average is ~$350/sqft for improvements
  const estimatedSqft = imprVal > 0 ? Math.round(imprVal / 300) : null;

  // Rough bed/bath estimates from sqft (will be refined)
  let estimatedBeds: number | null = null;
  let estimatedBaths: number | null = null;
  if (estimatedSqft) {
    if (estimatedSqft < 800) { estimatedBeds = 1; estimatedBaths = 1; }
    else if (estimatedSqft < 1200) { estimatedBeds = 2; estimatedBaths = 1; }
    else if (estimatedSqft < 1800) { estimatedBeds = 3; estimatedBaths = 2; }
    else if (estimatedSqft < 2500) { estimatedBeds = 3; estimatedBaths = 2.5; }
    else if (estimatedSqft < 3500) { estimatedBeds = 4; estimatedBaths = 3; }
    else { estimatedBeds = 5; estimatedBaths = 3.5; }
  }

  return { estimatedValue, estimatedSqft, estimatedBeds, estimatedBaths };
}

export function transformParcelToProperty(
  raw: KCParcelRaw,
  centroid: { lat: number; lng: number } | null,
  saleLookup?: Map<string, { date: string; price: number; buyer: string }>
): Property {
  const pin = (raw.PIN ?? "").trim();
  const sale = saleLookup?.get(pin);
  const now = new Date().toISOString();

  const landVal = Number(raw.APPRLNDVAL) || 0;
  const imprVal = Number(raw.APPR_IMPR) || 0;
  const estimates = estimateFromAssessedValues(landVal, imprVal);

  // Determine listing status from sale data
  let listingStatus: ListingStatus = "off_market";
  if (sale) {
    const saleDate = new Date(sale.date);
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    if (saleDate > sixMonthsAgo) {
      listingStatus = "recently_sold";
    }
  }

  // Infer features
  const features: string[] = [];
  const lotSqft = Number(raw.LOTSQFT) || 0;
  if (lotSqft > 10000) features.push("large lot");
  if (lotSqft > 20000) features.push("estate-size lot");
  if (imprVal > 1000000) features.push("luxury construction");
  if (imprVal > 500000) features.push("high-value improvements");

  return {
    id: makePropertyId(pin),
    marketId: SEATTLE_MARKET_ID,
    parcelId: pin,
    address: (raw.ADDR_FULL ?? "").trim() || "Unknown",
    city: (raw.CTYNAME ?? "Seattle").trim(),
    state: "WA",
    zip: (raw.ZIP5 ?? "").trim(),
    lat: centroid?.lat ?? 0,
    lng: centroid?.lng ?? 0,
    bedrooms: estimates.estimatedBeds ?? 0,
    bathrooms: estimates.estimatedBaths ?? 0,
    sqft: estimates.estimatedSqft ?? 0,
    lotSqft: lotSqft || null,
    yearBuilt: null, // Not available in this layer
    propertyType: mapPropertyType(raw.PROPTYPE, raw.PREUSE_DESC),
    architecturalStyle: null, // Enriched later
    features,
    lastSaleDate: sale?.date ?? null,
    lastSalePrice: sale?.price ?? null,
    estimatedValue: estimates.estimatedValue,
    ownerName: null, // Not in this layer
    ownerMailingAddress: null,
    absenteeOwner: false,
    ownershipYears: null,
    equityEstimate: null,
    taxStatus: "unknown" as TaxStatus,
    permitHistory: [],
    listingStatus,
    listingPrice: null,
    mlsNumber: null,
    photoUrls: [],
    dataSources: ["king-county-gis"],
    updatedAt: now,
    createdAt: now,
  };
}

// ---------------------------------------------------------------------------
// Build sale lookup
// ---------------------------------------------------------------------------

export function buildSaleLookup(
  sales: KCSaleRaw[]
): Map<string, { date: string; price: number; buyer: string }> {
  const lookup = new Map<string, { date: string; price: number; buyer: string }>();

  for (const s of sales) {
    const pin = (s.PIN ?? "").trim();
    if (!pin) continue;

    const date = s.SaleDate
      ? new Date(s.SaleDate).toISOString().split("T")[0]
      : "";
    const price = Number(s.SalePrice) || 0;
    const buyer = (s.buyername ?? "").trim();

    if (!date || price <= 0) continue;

    const existing = lookup.get(pin);
    if (!existing || date > existing.date) {
      lookup.set(pin, { date, price, buyer });
    }
  }

  return lookup;
}

// ---------------------------------------------------------------------------
// Full pipeline
// ---------------------------------------------------------------------------

export async function ingestKingCountyProperties(
  zipCodes: string[] = [],
  limit: number = KC_MAX_RECORDS,
  onProgress?: (progress: IngestionProgress) => void
): Promise<IngestionResult> {
  const errors: string[] = [];

  // 1. Fetch parcels with geometry
  const parcelsWithGeometry = await fetchKingCountyParcels(zipCodes, limit, onProgress);

  // 2. Fetch sales (best effort)
  let saleLookup = new Map<string, { date: string; price: number; buyer: string }>();
  try {
    const rawSales = await fetchKingCountySales(Math.min(limit * 2, 5000));
    saleLookup = buildSaleLookup(rawSales);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    errors.push(`Sales fetch: ${msg}`);
  }

  // 3. Transform
  const properties: Property[] = [];
  for (const { raw, centroid } of parcelsWithGeometry) {
    try {
      const prop = transformParcelToProperty(raw, centroid, saleLookup);
      // Filter out records with no usable address or coordinates
      if (prop.address !== "Unknown" && prop.lat !== 0 && prop.lng !== 0) {
        properties.push(prop);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown transform error";
      errors.push(`Transform: ${msg}`);
    }
  }

  return {
    properties,
    totalFetched: parcelsWithGeometry.length,
    totalTransformed: properties.length,
    errors,
  };
}
