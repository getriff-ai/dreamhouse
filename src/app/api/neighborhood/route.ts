import { NextRequest, NextResponse } from "next/server";
import {
  fetchNeighborhoodIntel,
  fetchMultiNeighborhoodIntel,
} from "@/lib/enrichment/braveSearch";

/**
 * GET /api/neighborhood?name=Capitol+Hill&city=Seattle&state=WA
 *
 * Returns neighborhood intelligence powered by Brave Search.
 * Provides agents with local context: news, lifestyle signals, market info.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  const city = searchParams.get("city") || "Seattle";
  const state = searchParams.get("state") || "WA";

  if (!name) {
    return NextResponse.json(
      { error: "Missing required parameter: name" },
      { status: 400 }
    );
  }

  if (!process.env.BRAVE_SEARCH_API_KEY) {
    return NextResponse.json(
      {
        error: "Brave Search API not configured",
        hint: "Set BRAVE_SEARCH_API_KEY in .env.local",
      },
      { status: 503 }
    );
  }

  const intel = await fetchNeighborhoodIntel(name, city, state);

  if (!intel) {
    return NextResponse.json(
      { error: "No results found for this neighborhood" },
      { status: 404 }
    );
  }

  return NextResponse.json(intel);
}

/**
 * POST /api/neighborhood
 * Body: { neighborhoods: string[], city?: string, state?: string }
 *
 * Batch fetch intel for multiple neighborhoods at once.
 * Used when search results span several areas.
 */
export async function POST(request: NextRequest) {
  let body: { neighborhoods?: string[]; city?: string; state?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { neighborhoods, city = "Seattle", state = "WA" } = body;

  if (
    !neighborhoods ||
    !Array.isArray(neighborhoods) ||
    neighborhoods.length === 0
  ) {
    return NextResponse.json(
      { error: "Missing required field: neighborhoods (string array)" },
      { status: 400 }
    );
  }

  if (neighborhoods.length > 10) {
    return NextResponse.json(
      { error: "Maximum 10 neighborhoods per request" },
      { status: 400 }
    );
  }

  if (!process.env.BRAVE_SEARCH_API_KEY) {
    return NextResponse.json(
      {
        error: "Brave Search API not configured",
        hint: "Set BRAVE_SEARCH_API_KEY in .env.local",
      },
      { status: 503 }
    );
  }

  const intelMap = await fetchMultiNeighborhoodIntel(
    neighborhoods,
    city,
    state
  );

  // Convert Map to plain object for JSON serialization
  const result: Record<string, unknown> = {};
  for (const [key, value] of intelMap.entries()) {
    result[key] = value;
  }

  return NextResponse.json({
    neighborhoods: result,
    count: intelMap.size,
  });
}
