import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { ParsedIntent, PropertyType } from "@/types";

// ---------------------------------------------------------------------------
// Seattle neighborhood geocoding reference
// ---------------------------------------------------------------------------

const SEATTLE_NEIGHBORHOODS: Record<
  string,
  { lat: number; lng: number; radiusMiles: number }
> = {
  "Capitol Hill": { lat: 47.6253, lng: -122.3222, radiusMiles: 1.5 },
  "Queen Anne": { lat: 47.6372, lng: -122.3571, radiusMiles: 1.5 },
  "Lower Queen Anne": { lat: 47.6243, lng: -122.3558, radiusMiles: 0.75 },
  Ballard: { lat: 47.6677, lng: -122.3846, radiusMiles: 1.5 },
  Wallingford: { lat: 47.6615, lng: -122.3352, radiusMiles: 1.2 },
  "Madison Park": { lat: 47.6340, lng: -122.2780, radiusMiles: 1.0 },
  "Mercer Island": { lat: 47.5707, lng: -122.2221, radiusMiles: 2.5 },
  Bellevue: { lat: 47.6101, lng: -122.2015, radiusMiles: 4.0 },
  Kirkland: { lat: 47.6815, lng: -122.2087, radiusMiles: 3.0 },
  Fremont: { lat: 47.6588, lng: -122.3503, radiusMiles: 1.0 },
  "Green Lake": { lat: 47.6805, lng: -122.3285, radiusMiles: 1.2 },
  Magnolia: { lat: 47.6500, lng: -122.3990, radiusMiles: 1.5 },
  "West Seattle": { lat: 47.5660, lng: -122.3870, radiusMiles: 2.5 },
  "Columbia City": { lat: 47.5600, lng: -122.2867, radiusMiles: 1.0 },
  "Beacon Hill": { lat: 47.5630, lng: -122.3130, radiusMiles: 1.5 },
  "University District": { lat: 47.6595, lng: -122.3131, radiusMiles: 1.2 },
  Ravenna: { lat: 47.6770, lng: -122.3020, radiusMiles: 1.0 },
  Laurelhurst: { lat: 47.6590, lng: -122.2770, radiusMiles: 1.0 },
  Windermere: { lat: 47.6740, lng: -122.2680, radiusMiles: 0.8 },
  Broadmoor: { lat: 47.6380, lng: -122.2880, radiusMiles: 0.6 },
  Medina: { lat: 47.6210, lng: -122.2310, radiusMiles: 1.2 },
  "Hunts Point": { lat: 47.6430, lng: -122.2230, radiusMiles: 0.5 },
  "Clyde Hill": { lat: 47.6320, lng: -122.2180, radiusMiles: 0.8 },
  Sammamish: { lat: 47.6163, lng: -122.0356, radiusMiles: 4.0 },
  Issaquah: { lat: 47.5301, lng: -122.0326, radiusMiles: 3.0 },
  Redmond: { lat: 47.6740, lng: -122.1215, radiusMiles: 3.5 },
  Woodinville: { lat: 47.7543, lng: -122.1635, radiusMiles: 3.0 },
  "Central District": { lat: 47.6110, lng: -122.3010, radiusMiles: 1.2 },
  "Mount Baker": { lat: 47.5800, lng: -122.2955, radiusMiles: 1.0 },
  Leschi: { lat: 47.6010, lng: -122.2880, radiusMiles: 0.8 },
  Madrona: { lat: 47.6120, lng: -122.2890, radiusMiles: 0.8 },
  Montlake: { lat: 47.6405, lng: -122.3040, radiusMiles: 0.8 },
  Phinney: { lat: 47.6750, lng: -122.3540, radiusMiles: 1.0 },
  Wedgwood: { lat: 47.6890, lng: -122.2920, radiusMiles: 1.0 },
  "Maple Leaf": { lat: 47.6960, lng: -122.3170, radiusMiles: 1.0 },
  Roosevelt: { lat: 47.6780, lng: -122.3180, radiusMiles: 0.8 },
  Northgate: { lat: 47.7060, lng: -122.3270, radiusMiles: 1.5 },
  "Lake City": { lat: 47.7100, lng: -122.2930, radiusMiles: 1.5 },
  Georgetown: { lat: 47.5430, lng: -122.3200, radiusMiles: 1.0 },
  "South Lake Union": { lat: 47.6268, lng: -122.3385, radiusMiles: 0.8 },
  Downtown: { lat: 47.6062, lng: -122.3321, radiusMiles: 1.0 },
  "Pioneer Square": { lat: 47.6013, lng: -122.3341, radiusMiles: 0.5 },
  Eastlake: { lat: 47.6355, lng: -122.3255, radiusMiles: 0.7 },
  Interbay: { lat: 47.6440, lng: -122.3770, radiusMiles: 0.8 },
  "Sand Point": { lat: 47.6830, lng: -122.2620, radiusMiles: 1.0 },
  "Seward Park": { lat: 47.5500, lng: -122.2660, radiusMiles: 1.2 },
  "Rainier Beach": { lat: 47.5160, lng: -122.2680, radiusMiles: 1.5 },
};

// ---------------------------------------------------------------------------
// Build the system prompt for Claude
// ---------------------------------------------------------------------------

function buildSystemPrompt(): string {
  const neighborhoodList = Object.entries(SEATTLE_NEIGHBORHOODS)
    .map(
      ([name, geo]) =>
        `  "${name}": { lat: ${geo.lat}, lng: ${geo.lng}, radiusMiles: ${geo.radiusMiles} }`
    )
    .join("\n");

  return `You are an expert real estate intent parser for the Seattle metropolitan area. Your job is to analyze a buyer's natural language description and extract structured search parameters.

You must return ONLY valid JSON matching this exact schema (no markdown, no explanation, no code fences):

{
  "styles": string[],           // Architectural styles (e.g., "mid-century modern", "craftsman", "tudor")
  "features": string[],         // Property features (e.g., "pool", "guest house", "waterfront", "views")
  "budget": {
    "min": number | null,       // Minimum budget in dollars (null if not specified)
    "max": number | null        // Maximum budget in dollars (null if not specified)
  },
  "locations": [                // Array of target locations
    {
      "name": string,           // Neighborhood or area name
      "lat": number,            // Latitude
      "lng": number,            // Longitude
      "radiusMiles": number     // Search radius in miles
    }
  ],
  "beds": { "min": number | null, "max": number | null },
  "baths": { "min": number | null, "max": number | null },
  "sqft": { "min": number | null, "max": number | null },
  "propertyTypes": string[],    // One of: "single_family", "condo", "townhouse", "multi_family", "land", "other"
  "lifestyleTags": string[],    // Lifestyle descriptors like "walkable", "family-friendly", "urban", "quiet"
  "summary": string             // One-line plain English summary of what the buyer wants
}

PARSING RULES:

1. BUDGET: Parse dollar amounts flexibly.
   - "under 1.2M" -> max: 1200000
   - "800K-1.2M" -> min: 800000, max: 1200000
   - "around 900K" -> min: 810000, max: 990000 (roughly +/- 10%)
   - "at least 500K" -> min: 500000

2. BEDS/BATHS: Extract from patterns like "4 bed", "4BR", "3 bedroom", "4 bed / 3 bath", "4/3".
   - "4 bed" -> beds: { min: 4, max: null }
   - "3-4 bedrooms" -> beds: { min: 3, max: 4 }

3. LOCATIONS: Use the known Seattle neighborhood coordinates below. If a neighborhood is mentioned, use its exact lat/lng and default radius. If a general area is mentioned (e.g., "Eastside"), combine relevant neighborhoods. If no location is specified, omit the locations array (empty []).

Known Seattle neighborhood coordinates:
${neighborhoodList}

4. STYLES: Normalize architectural style names to these canonical forms:
   "mid-century modern", "modern", "contemporary", "northwest contemporary", "craftsman", "bungalow",
   "arts and crafts", "colonial", "dutch colonial", "tudor", "victorian", "queen anne", "farmhouse",
   "modern farmhouse", "ranch", "split level", "cape cod", "cottage", "english cottage",
   "mediterranean", "spanish", "mission", "pacific northwest", "northwest lodge", "minimalist",
   "scandinavian", "transitional", "traditional", "seattle box", "american foursquare",
   "cabin", "rustic", "industrial", "loft"

5. FEATURES: Extract all mentioned property features. Common ones:
   "pool", "guest house", "waterfront", "views", "mountain views", "lake views", "city views",
   "garden", "large lot", "garage", "fireplace", "home office", "wine cellar", "deck",
   "hot tub", "open floor plan", "hardwood floors", "updated kitchen", "basement",
   "skylights", "covered porch", "built-ins", "original woodwork", "quiet street", "ADU",
   "in-law suite", "EV charging", "solar panels", "smart home"

6. PROPERTY TYPES: Default to ["single_family"] unless the description implies otherwise.
   Condos, townhouses, multi-family should be explicitly mentioned.

7. LIFESTYLE TAGS: Infer from context:
   - "quiet street" -> "quiet"
   - "walkable" or mentions of restaurants/shops -> "walkable"
   - "family" or mentions of schools -> "family-friendly"
   - "urban" or "downtown" -> "urban"
   - "close to nature" or "trails" -> "outdoorsy"

8. SUMMARY: Write a concise one-line summary of the buyer's ideal home, suitable for display in a search interface.

IMPORTANT: Return ONLY the raw JSON object. No markdown formatting, no backticks, no explanation text.`;
}

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

interface IntentRequest {
  text: string;
  marketId?: string;
}

interface IntentResponse {
  intent: ParsedIntent;
  rawText: string;
  marketId: string;
}

interface IntentErrorResponse {
  error: string;
  details?: string;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest
): Promise<NextResponse<IntentResponse | IntentErrorResponse>> {
  // Check for API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "Server configuration error",
        details:
          "ANTHROPIC_API_KEY is not configured. Please set it in your environment variables.",
      },
      { status: 500 }
    );
  }

  // Parse request body
  let body: IntentRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  const { text, marketId = "seattle" } = body;

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json(
      {
        error: "Missing required field: text",
        details: "Provide a natural language description of the buyer's needs.",
      },
      { status: 400 }
    );
  }

  if (text.length > 2000) {
    return NextResponse.json(
      {
        error: "Text too long",
        details: "Description must be 2000 characters or fewer.",
      },
      { status: 400 }
    );
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: buildSystemPrompt(),
      messages: [
        {
          role: "user",
          content: `Parse this buyer description into structured search parameters:\n\n"${text.trim()}"`,
        },
      ],
    });

    // Extract text content from response
    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        {
          error: "Unexpected response from AI",
          details: "No text content in response.",
        },
        { status: 502 }
      );
    }

    // Parse the JSON response from Claude
    let parsed: Record<string, unknown>;
    try {
      // Strip any accidental markdown fences
      let jsonText = textBlock.text.trim();
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      parsed = JSON.parse(jsonText);
    } catch (parseError) {
      return NextResponse.json(
        {
          error: "Failed to parse AI response as JSON",
          details:
            parseError instanceof Error
              ? parseError.message
              : "Unknown parse error",
        },
        { status: 502 }
      );
    }

    // Validate and coerce into ParsedIntent
    const intent: ParsedIntent = {
      styles: asStringArray(parsed.styles),
      features: asStringArray(parsed.features),
      budget: {
        min: asNullableNumber((parsed.budget as Record<string, unknown>)?.min),
        max: asNullableNumber((parsed.budget as Record<string, unknown>)?.max),
      },
      locations: asLocationArray(parsed.locations),
      beds: {
        min: asNullableNumber((parsed.beds as Record<string, unknown>)?.min),
        max: asNullableNumber((parsed.beds as Record<string, unknown>)?.max),
      },
      baths: {
        min: asNullableNumber((parsed.baths as Record<string, unknown>)?.min),
        max: asNullableNumber((parsed.baths as Record<string, unknown>)?.max),
      },
      sqft: {
        min: asNullableNumber((parsed.sqft as Record<string, unknown>)?.min),
        max: asNullableNumber((parsed.sqft as Record<string, unknown>)?.max),
      },
      propertyTypes: asPropertyTypes(parsed.propertyTypes),
      lifestyleTags: asStringArray(parsed.lifestyleTags),
      summary: typeof parsed.summary === "string" ? parsed.summary : text.trim(),
    };

    return NextResponse.json(
      {
        intent,
        rawText: text.trim(),
        marketId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Intent parsing error:", error);

    // Handle Anthropic API-specific errors
    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        return NextResponse.json(
          {
            error: "Authentication error",
            details: "Invalid ANTHROPIC_API_KEY. Please check your configuration.",
          },
          { status: 500 }
        );
      }
      if (error.status === 429) {
        return NextResponse.json(
          {
            error: "Rate limited",
            details: "Too many requests. Please try again in a moment.",
          },
          { status: 429 }
        );
      }
      return NextResponse.json(
        {
          error: "AI service error",
          details: error.message,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        details:
          error instanceof Error ? error.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function asLocationArray(
  value: unknown
): { name: string; lat: number; lng: number; radiusMiles: number }[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (v): v is Record<string, unknown> =>
        typeof v === "object" && v !== null
    )
    .map((v) => ({
      name: typeof v.name === "string" ? v.name : "Unknown",
      lat: Number(v.lat) || 0,
      lng: Number(v.lng) || 0,
      radiusMiles: Number(v.radiusMiles) || 2,
    }))
    .filter((v) => v.lat !== 0 && v.lng !== 0);
}

const VALID_PROPERTY_TYPES: PropertyType[] = [
  "single_family",
  "condo",
  "townhouse",
  "multi_family",
  "land",
  "other",
];

function asPropertyTypes(value: unknown): PropertyType[] {
  if (!Array.isArray(value)) return ["single_family"];
  const filtered = value.filter(
    (v): v is PropertyType =>
      typeof v === "string" &&
      VALID_PROPERTY_TYPES.includes(v as PropertyType)
  );
  return filtered.length > 0 ? filtered : ["single_family"];
}
