import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { ParsedIntent, PropertyType } from "@/types";

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

interface RefineRequest {
  currentIntent: ParsedIntent;
  refinement: string;
}

interface RefineResponse {
  intent: ParsedIntent;
  refinement: string;
  changes: string[];
}

interface RefineErrorResponse {
  error: string;
  details?: string;
}

// ---------------------------------------------------------------------------
// System prompt for refinement
// ---------------------------------------------------------------------------

function buildRefineSystemPrompt(currentIntent: ParsedIntent): string {
  return `You are a real estate search refinement assistant. The user has an existing search with these parameters:

CURRENT SEARCH:
${JSON.stringify(currentIntent, null, 2)}

The user wants to refine this search. Apply their requested changes to the existing parameters. Rules:

1. Only modify what the user asks to change. Keep everything else the same.
2. If the user says "more modern", shift styles toward modern/contemporary and away from traditional styles.
3. If the user says "closer to downtown", tighten the radius and shift location center points toward downtown Seattle (47.6062, -122.3321).
4. If the user says "bigger", increase sqft minimums. If they say "smaller", decrease maximums.
5. If the user says "cheaper" or "lower budget", reduce the max budget by ~15-20%. If "more expensive" or "higher budget", increase by ~15-20%.
6. If the user adds a feature (e.g., "needs a pool"), add it to the features array.
7. If the user removes a requirement (e.g., "don't need a pool"), remove it from features.
8. If the user mentions a new neighborhood, add it to locations (or replace existing locations if the intent is clear).

Return a JSON object with TWO keys:
1. "intent": The updated ParsedIntent (full object, same schema as the current one)
2. "changes": An array of human-readable strings describing what changed (e.g., ["Shifted style preference toward modern", "Reduced max budget to $1M"])

Seattle neighborhood coordinates for reference:
- Capitol Hill: 47.6253, -122.3222
- Queen Anne: 47.6372, -122.3571
- Ballard: 47.6677, -122.3846
- Wallingford: 47.6615, -122.3352
- Fremont: 47.6588, -122.3503
- Green Lake: 47.6805, -122.3285
- Magnolia: 47.6500, -122.3990
- West Seattle: 47.5660, -122.3870
- University District: 47.6595, -122.3131
- Madison Park: 47.6340, -122.2780
- Laurelhurst: 47.6590, -122.2770
- Ravenna: 47.6770, -122.3020
- Downtown: 47.6062, -122.3321
- South Lake Union: 47.6268, -122.3385
- Bellevue: 47.6101, -122.2015
- Kirkland: 47.6815, -122.2087
- Redmond: 47.6740, -122.1215
- Mercer Island: 47.5707, -122.2221
- Columbia City: 47.5600, -122.2867
- Beacon Hill: 47.5630, -122.3130
- Medina: 47.6210, -122.2310

Valid property types: "single_family", "condo", "townhouse", "multi_family", "land", "other"

Return ONLY raw JSON. No markdown, no code fences, no explanation.`;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest
): Promise<NextResponse<RefineResponse | RefineErrorResponse>> {
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
  let body: RefineRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  const { currentIntent, refinement } = body;

  // Validate currentIntent
  if (!currentIntent || typeof currentIntent !== "object") {
    return NextResponse.json(
      {
        error: "Missing required field: currentIntent",
        details: "Provide the current ParsedIntent to refine.",
      },
      { status: 400 }
    );
  }

  // Validate refinement
  if (
    !refinement ||
    typeof refinement !== "string" ||
    refinement.trim().length === 0
  ) {
    return NextResponse.json(
      {
        error: "Missing required field: refinement",
        details:
          'Provide a natural language refinement (e.g., "more modern", "closer to downtown").',
      },
      { status: 400 }
    );
  }

  if (refinement.length > 1000) {
    return NextResponse.json(
      {
        error: "Refinement text too long",
        details: "Refinement must be 1000 characters or fewer.",
      },
      { status: 400 }
    );
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: buildRefineSystemPrompt(currentIntent),
      messages: [
        {
          role: "user",
          content: `Refine the current search with this request: "${refinement.trim()}"`,
        },
      ],
    });

    // Extract text content
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

    // Parse the JSON
    let parsed: { intent: Record<string, unknown>; changes: unknown };
    try {
      let jsonText = textBlock.text.trim();
      if (jsonText.startsWith("```")) {
        jsonText = jsonText
          .replace(/^```(?:json)?\n?/, "")
          .replace(/\n?```$/, "");
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

    // Validate and coerce the updated intent
    const rawIntent = parsed.intent ?? parsed;
    const updatedIntent: ParsedIntent = {
      styles: asStringArray(rawIntent.styles),
      features: asStringArray(rawIntent.features),
      budget: {
        min: asNullableNumber(
          (rawIntent.budget as Record<string, unknown>)?.min
        ),
        max: asNullableNumber(
          (rawIntent.budget as Record<string, unknown>)?.max
        ),
      },
      locations: asLocationArray(rawIntent.locations),
      beds: {
        min: asNullableNumber(
          (rawIntent.beds as Record<string, unknown>)?.min
        ),
        max: asNullableNumber(
          (rawIntent.beds as Record<string, unknown>)?.max
        ),
      },
      baths: {
        min: asNullableNumber(
          (rawIntent.baths as Record<string, unknown>)?.min
        ),
        max: asNullableNumber(
          (rawIntent.baths as Record<string, unknown>)?.max
        ),
      },
      sqft: {
        min: asNullableNumber(
          (rawIntent.sqft as Record<string, unknown>)?.min
        ),
        max: asNullableNumber(
          (rawIntent.sqft as Record<string, unknown>)?.max
        ),
      },
      propertyTypes: asPropertyTypes(rawIntent.propertyTypes),
      lifestyleTags: asStringArray(rawIntent.lifestyleTags),
      summary:
        typeof rawIntent.summary === "string"
          ? rawIntent.summary
          : currentIntent.summary,
    };

    const changes = Array.isArray(parsed.changes)
      ? parsed.changes.filter(
          (c): c is string => typeof c === "string"
        )
      : [`Refined search based on: "${refinement.trim()}"`];

    return NextResponse.json(
      {
        intent: updatedIntent,
        refinement: refinement.trim(),
        changes,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Search refinement error:", error);

    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        return NextResponse.json(
          {
            error: "Authentication error",
            details:
              "Invalid ANTHROPIC_API_KEY. Please check your configuration.",
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
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Validation helpers (duplicated for isolation - could be extracted to shared)
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
