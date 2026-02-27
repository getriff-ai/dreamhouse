/**
 * POST /api/ingest
 *
 * Admin endpoint to trigger King County data ingestion and enrichment.
 *
 * Request body:
 *   {
 *     action: "fetch_parcels" | "enrich" | "full",
 *     zipCodes?: string[],
 *     limit?: number
 *   }
 *
 * Actions:
 *  - fetch_parcels: Downloads King County data, transforms, saves to real-properties.json
 *  - enrich:        Runs photo/listing/style enrichment on existing real-properties.json
 *  - full:          Both steps in sequence
 *
 * For MVP, persists results to src/data/real-properties.json. In production
 * this will write to Supabase.
 */

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { Property } from "@/types";
import {
  ingestKingCountyProperties,
  type IngestionResult,
} from "@/lib/ingestion/kingCounty";
import { MVP_ZIP_CODES } from "@/lib/ingestion/config";
import {
  enrichBatch,
  type BatchEnrichmentResult,
} from "@/lib/enrichment/propertyEnricher";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Path to the output file for real (non-seed) property data. */
const REAL_DATA_PATH = path.join(
  process.cwd(),
  "src",
  "data",
  "real-properties.json"
);

/** Default limit per ingestion run. */
const DEFAULT_LIMIT = 500;

/** Maximum allowed limit (safety). */
const MAX_LIMIT = 5000;

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

interface IngestRequestBody {
  action: "fetch_parcels" | "enrich" | "full";
  zipCodes?: string[];
  limit?: number;
}

function validateBody(
  body: unknown
): { valid: true; data: IngestRequestBody } | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object" };
  }

  const b = body as Record<string, unknown>;

  if (!["fetch_parcels", "enrich", "full"].includes(b.action as string)) {
    return {
      valid: false,
      error:
        'action must be one of: "fetch_parcels", "enrich", "full"',
    };
  }

  if (b.zipCodes !== undefined) {
    if (!Array.isArray(b.zipCodes)) {
      return { valid: false, error: "zipCodes must be an array of strings" };
    }
    for (const z of b.zipCodes) {
      if (typeof z !== "string" || !/^\d{5}$/.test(z)) {
        return {
          valid: false,
          error: `Invalid ZIP code: "${z}". Must be a 5-digit string.`,
        };
      }
    }
  }

  if (b.limit !== undefined) {
    if (typeof b.limit !== "number" || b.limit < 1 || b.limit > MAX_LIMIT) {
      return {
        valid: false,
        error: `limit must be a number between 1 and ${MAX_LIMIT}`,
      };
    }
  }

  return { valid: true, data: b as unknown as IngestRequestBody };
}

// ---------------------------------------------------------------------------
// File I/O helpers
// ---------------------------------------------------------------------------

async function loadExistingProperties(): Promise<Property[]> {
  try {
    const raw = await fs.readFile(REAL_DATA_PATH, "utf-8");
    return JSON.parse(raw) as Property[];
  } catch {
    return [];
  }
}

async function saveProperties(properties: Property[]): Promise<void> {
  // Ensure the directory exists
  const dir = path.dirname(REAL_DATA_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(REAL_DATA_PATH, JSON.stringify(properties, null, 2));
}

/**
 * Merge newly ingested properties with existing ones.
 * Uses property id as the dedup key; newer records overwrite older ones.
 */
function mergeProperties(
  existing: Property[],
  incoming: Property[]
): Property[] {
  const map = new Map<string, Property>();

  for (const p of existing) {
    map.set(p.id, p);
  }
  for (const p of incoming) {
    map.set(p.id, p);
  }

  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  const validation = validateBody(body);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { action, zipCodes, limit: rawLimit } = validation.data;
  const limit = Math.min(rawLimit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const zips = zipCodes ?? MVP_ZIP_CODES;

  const responseData: {
    action: string;
    ingestion?: {
      totalFetched: number;
      totalTransformed: number;
      errors: string[];
    };
    enrichment?: {
      totalEnriched: number;
      totalErrors: number;
      timeTakenMs: number;
    };
    totalProperties: number;
    dataFile: string;
    timeTakenMs: number;
  } = {
    action,
    totalProperties: 0,
    dataFile: REAL_DATA_PATH,
    timeTakenMs: 0,
  };

  try {
    let properties: Property[] = [];

    // -------------------------------------------------------------------
    // Step 1: Fetch parcels (if action is "fetch_parcels" or "full")
    // -------------------------------------------------------------------
    if (action === "fetch_parcels" || action === "full") {
      const ingestionResult: IngestionResult =
        await ingestKingCountyProperties(zips, limit);

      // Merge with existing data
      const existing = await loadExistingProperties();
      properties = mergeProperties(existing, ingestionResult.properties);
      await saveProperties(properties);

      responseData.ingestion = {
        totalFetched: ingestionResult.totalFetched,
        totalTransformed: ingestionResult.totalTransformed,
        errors: ingestionResult.errors,
      };
    }

    // -------------------------------------------------------------------
    // Step 2: Enrich (if action is "enrich" or "full")
    // -------------------------------------------------------------------
    if (action === "enrich" || action === "full") {
      // Load properties from file if we didn't just fetch them
      if (properties.length === 0) {
        properties = await loadExistingProperties();
      }

      if (properties.length === 0) {
        return NextResponse.json(
          {
            error:
              "No properties to enrich. Run fetch_parcels first or ensure real-properties.json exists.",
          },
          { status: 400 }
        );
      }

      // Limit enrichment batch size to avoid long-running requests
      const enrichmentBatchSize = Math.min(properties.length, limit);
      const toEnrich = properties.slice(0, enrichmentBatchSize);

      const enrichResult: BatchEnrichmentResult = await enrichBatch(toEnrich);

      // Replace enriched properties in the full list
      const enrichedMap = new Map(
        enrichResult.results.map((r) => [r.property.id, r.property])
      );
      properties = properties.map(
        (p) => enrichedMap.get(p.id) ?? p
      );

      await saveProperties(properties);

      responseData.enrichment = {
        totalEnriched: enrichResult.totalEnriched,
        totalErrors: enrichResult.totalErrors,
        timeTakenMs: enrichResult.timeTakenMs,
      };
    }

    responseData.totalProperties = properties.length;
    responseData.timeTakenMs = Date.now() - startTime;

    return NextResponse.json(responseData, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error during ingestion";
    console.error("[api/ingest] Error:", err);

    return NextResponse.json(
      {
        error: message,
        timeTakenMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
