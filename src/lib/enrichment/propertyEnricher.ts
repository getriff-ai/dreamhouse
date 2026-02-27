/**
 * Property enrichment orchestrator.
 *
 * Takes raw Property records (from King County or other sources) and enriches
 * them with:
 *  1. Street view / satellite photo URLs
 *  2. Listing status detection (via Brave Search)
 *  3. Architectural style inference (via Claude API)
 *
 * Each enrichment step is independent and fails gracefully when its
 * required API key is not configured.
 */

import type { Property, ListingStatus } from "@/types";
import { getPropertyImageUrls } from "@/lib/ingestion/streetView";
import {
  detectListingStatus,
  detectListingStatusBatch,
  type ListingDetectionResult,
} from "./listingDetector";
import { neighborhoodsForZip } from "@/lib/ingestion/config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EnrichmentResult {
  property: Property;
  enrichments: {
    photos: boolean;
    listing: boolean;
    style: boolean;
  };
  errors: string[];
}

export interface BatchEnrichmentResult {
  results: EnrichmentResult[];
  totalEnriched: number;
  totalErrors: number;
  timeTakenMs: number;
}

export interface EnrichmentOptions {
  /** Enable photo URL generation. Default true. */
  photos?: boolean;
  /** Enable listing detection via Brave. Default true. */
  listing?: boolean;
  /** Enable architectural style inference via Claude. Default true. */
  style?: boolean;
}

// ---------------------------------------------------------------------------
// Style inference via Claude
// ---------------------------------------------------------------------------

/**
 * Use the Claude API to infer an architectural style from property attributes.
 *
 * Returns null if the API key is not configured or inference fails.
 */
async function inferArchitecturalStyle(
  property: Property
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const neighborhoods = neighborhoodsForZip(property.zip);
  const neighborhoodStr =
    neighborhoods.length > 0 ? neighborhoods.join(", ") : property.city;

  const prompt = `Based on these property characteristics, what is the most likely architectural style? Reply with ONLY the style name in lowercase (e.g., "craftsman", "modern", "tudor", "colonial", "mid-century modern", "contemporary", "victorian", "cape cod", "split-level", "ranch", "northwest contemporary", "farmhouse").

Property details:
- Year built: ${property.yearBuilt ?? "unknown"}
- Square footage: ${property.sqft}
- Bedrooms: ${property.bedrooms}
- Bathrooms: ${property.bathrooms}
- Property type: ${property.propertyType}
- Neighborhood: ${neighborhoodStr}
- City: ${property.city}, ${property.state}
- Features: ${property.features.length > 0 ? property.features.join(", ") : "none listed"}

Reply with just the style name, nothing else.`;

  try {
    // Use the Anthropic SDK
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 50,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;

    // Clean up: trim whitespace, remove quotes, lowercase
    const style = textBlock.text
      .trim()
      .replace(/^["']|["']$/g, "")
      .toLowerCase();

    // Validate it looks like a reasonable style name (not a full sentence)
    if (style.length > 40 || style.includes(".")) return null;

    return style;
  } catch (err) {
    console.warn("[enricher] Style inference failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Single property enrichment
// ---------------------------------------------------------------------------

/**
 * Enrich a single Property with photos, listing status, and style.
 *
 * Each enrichment step runs independently. Failures in one step do not
 * block other steps.
 */
export async function enrichProperty(
  property: Property,
  options: EnrichmentOptions = {}
): Promise<EnrichmentResult> {
  const { photos = true, listing = true, style = true } = options;
  const errors: string[] = [];
  const enrichments = { photos: false, listing: false, style: false };

  let enriched = { ...property };

  // 1. Photos
  if (photos && enriched.lat !== 0 && enriched.lng !== 0) {
    try {
      const imageUrls = await getPropertyImageUrls(enriched.lat, enriched.lng);

      const newPhotoUrls: string[] = [...enriched.photoUrls];
      if (imageUrls.streetView) newPhotoUrls.push(imageUrls.streetView);
      if (imageUrls.satellite) newPhotoUrls.push(imageUrls.satellite);

      if (newPhotoUrls.length > enriched.photoUrls.length) {
        enriched = {
          ...enriched,
          photoUrls: newPhotoUrls,
          dataSources: addDataSource(enriched.dataSources, imageUrls.source),
        };
        enrichments.photos = true;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Photo enrichment error";
      errors.push(msg);
    }
  }

  // 2. Listing status
  if (listing && enriched.address !== "Unknown") {
    try {
      const result = await detectListingStatus(
        enriched.address,
        enriched.city,
        enriched.state
      );

      enriched = applyListingResult(enriched, result);
      if (!result.error) {
        enrichments.listing = true;
      } else {
        errors.push(result.error);
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Listing detection error";
      errors.push(msg);
    }
  }

  // 3. Architectural style
  if (style && !enriched.architecturalStyle) {
    try {
      const inferred = await inferArchitecturalStyle(enriched);
      if (inferred) {
        enriched = {
          ...enriched,
          architecturalStyle: inferred,
          dataSources: addDataSource(enriched.dataSources, "claude-inference"),
        };
        enrichments.style = true;
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Style inference error";
      errors.push(msg);
    }
  }

  enriched = { ...enriched, updatedAt: new Date().toISOString() };

  return { property: enriched, enrichments, errors };
}

// ---------------------------------------------------------------------------
// Batch enrichment
// ---------------------------------------------------------------------------

/**
 * Enrich a batch of properties with progress tracking.
 *
 * Listing detection is batched with concurrency control. Photo and style
 * enrichment runs sequentially per-property to avoid overwhelming APIs.
 *
 * @param properties  Array of properties to enrich.
 * @param options     Which enrichment steps to enable.
 * @param onProgress  Optional callback with (completed, total).
 */
export async function enrichBatch(
  properties: Property[],
  options: EnrichmentOptions = {},
  onProgress?: (completed: number, total: number) => void
): Promise<BatchEnrichmentResult> {
  const start = Date.now();
  const { photos = true, listing = true, style = true } = options;

  const results: EnrichmentResult[] = [];
  let totalErrors = 0;

  // Pre-batch listing detection for all properties at once
  let listingResults = new Map<string, ListingDetectionResult>();
  if (listing) {
    const addresses = properties
      .filter((p) => p.address !== "Unknown")
      .map((p) => ({
        address: p.address,
        city: p.city,
        state: p.state,
      }));

    listingResults = await detectListingStatusBatch(addresses);
  }

  // Enrich each property
  for (let i = 0; i < properties.length; i++) {
    const property = properties[i];
    const errors: string[] = [];
    const enrichments = { photos: false, listing: false, style: false };
    let enriched = { ...property };

    // Apply pre-fetched listing result
    if (listing) {
      const listingResult = listingResults.get(property.address);
      if (listingResult) {
        enriched = applyListingResult(enriched, listingResult);
        if (!listingResult.error) enrichments.listing = true;
        else errors.push(listingResult.error);
      }
    }

    // Photos (sequential to avoid hammering the API)
    if (photos && enriched.lat !== 0 && enriched.lng !== 0) {
      try {
        const imageUrls = await getPropertyImageUrls(
          enriched.lat,
          enriched.lng
        );

        const newPhotoUrls: string[] = [...enriched.photoUrls];
        if (imageUrls.streetView) newPhotoUrls.push(imageUrls.streetView);
        if (imageUrls.satellite) newPhotoUrls.push(imageUrls.satellite);

        if (newPhotoUrls.length > enriched.photoUrls.length) {
          enriched = {
            ...enriched,
            photoUrls: newPhotoUrls,
            dataSources: addDataSource(enriched.dataSources, imageUrls.source),
          };
          enrichments.photos = true;
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Photo enrichment error";
        errors.push(msg);
      }
    }

    // Style inference (sequential to respect Claude rate limits)
    if (style && !enriched.architecturalStyle) {
      try {
        const inferred = await inferArchitecturalStyle(enriched);
        if (inferred) {
          enriched = {
            ...enriched,
            architecturalStyle: inferred,
            dataSources: addDataSource(
              enriched.dataSources,
              "claude-inference"
            ),
          };
          enrichments.style = true;
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Style inference error";
        errors.push(msg);
      }
    }

    enriched = { ...enriched, updatedAt: new Date().toISOString() };

    const result: EnrichmentResult = { property: enriched, enrichments, errors };
    results.push(result);
    totalErrors += errors.length;

    onProgress?.(i + 1, properties.length);
  }

  return {
    results,
    totalEnriched: results.filter(
      (r) => r.enrichments.photos || r.enrichments.listing || r.enrichments.style
    ).length,
    totalErrors,
    timeTakenMs: Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Apply listing detection results to a property.
 */
function applyListingResult(
  property: Property,
  result: ListingDetectionResult
): Property {
  const listingStatus: ListingStatus = result.isListed
    ? "on_market"
    : property.listingStatus;

  // Collect listing URLs into photoUrls or a dedicated field.
  // For now we just update the listing status.
  const dataSources = result.isListed
    ? addDataSource(property.dataSources, "brave-listing-detection")
    : property.dataSources;

  return {
    ...property,
    listingStatus,
    dataSources,
  };
}

/**
 * Add a data source tag if not already present.
 */
function addDataSource(existing: string[], source: string): string[] {
  if (existing.includes(source)) return existing;
  return [...existing, source];
}
