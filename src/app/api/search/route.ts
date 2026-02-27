import { NextRequest, NextResponse } from "next/server";
import type { ParsedIntent, SearchResult } from "@/types";
import { searchProperties } from "@/lib/data/properties";

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

interface SearchRequest {
  intent: ParsedIntent;
  marketId: string;
  page?: number;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  pageSize: number;
  marketId: string;
}

interface SearchErrorResponse {
  error: string;
  details?: string;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest
): Promise<NextResponse<SearchResponse | SearchErrorResponse>> {
  let body: SearchRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  const { intent, marketId, page = 1 } = body;

  // Validate intent
  if (!intent || typeof intent !== "object") {
    return NextResponse.json(
      {
        error: "Missing required field: intent",
        details: "Provide a ParsedIntent object from the /api/intent endpoint.",
      },
      { status: 400 }
    );
  }

  // Validate marketId
  if (!marketId || typeof marketId !== "string") {
    return NextResponse.json(
      {
        error: "Missing required field: marketId",
        details: 'Provide a market identifier (e.g., "seattle").',
      },
      { status: 400 }
    );
  }

  // Validate intent has minimum required structure
  if (
    !Array.isArray(intent.styles) ||
    !Array.isArray(intent.features) ||
    !intent.budget ||
    !Array.isArray(intent.locations)
  ) {
    return NextResponse.json(
      {
        error: "Invalid intent structure",
        details:
          "The intent object must include styles, features, budget, and locations arrays.",
      },
      { status: 400 }
    );
  }

  try {
    const { results, total, page: currentPage, pageSize } = await searchProperties(intent, marketId, page);

    return NextResponse.json(
      {
        results,
        total,
        page: currentPage,
        pageSize,
        marketId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      {
        error: "Search failed",
        details:
          error instanceof Error ? error.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
