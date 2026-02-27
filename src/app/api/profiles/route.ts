import { NextRequest, NextResponse } from "next/server";
import type { BuyerProfile, ParsedIntent } from "@/types";

// ---------------------------------------------------------------------------
// In-memory profile store (MVP fallback when Supabase is not configured)
// ---------------------------------------------------------------------------

const inMemoryProfiles: Map<string, BuyerProfile[]> = new Map();

function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Generate a simple unique ID for in-memory storage.
 */
function generateId(): string {
  return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// GET handler - List buyer profiles for the authenticated user
// ---------------------------------------------------------------------------

interface ProfilesListResponse {
  profiles: BuyerProfile[];
  total: number;
  storage: "supabase" | "in_memory";
}

interface ProfilesErrorResponse {
  error: string;
  details?: string;
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<ProfilesListResponse | ProfilesErrorResponse>> {
  // Try Supabase first
  if (isSupabaseConfigured()) {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();

      // Get the authenticated user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json(
          {
            error: "Authentication required",
            details: "You must be logged in to view profiles.",
          },
          { status: 401 }
        );
      }

      const { data, error } = await supabase
        .from("buyer_profiles")
        .select("*")
        .eq("agent_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const profiles: BuyerProfile[] = (data ?? []).map(mapDbRowToProfile);

      return NextResponse.json({
        profiles,
        total: profiles.length,
        storage: "supabase",
      });
    } catch (error) {
      console.warn(
        "Supabase query failed, falling back to in-memory storage:",
        error
      );
      // Fall through to in-memory
    }
  }

  // In-memory fallback
  // Use a mock agent ID from query params or a default
  const agentId =
    request.nextUrl.searchParams.get("agentId") ?? "anonymous";

  const profiles = inMemoryProfiles.get(agentId) ?? [];

  return NextResponse.json({
    profiles,
    total: profiles.length,
    storage: "in_memory",
  });
}

// ---------------------------------------------------------------------------
// POST handler - Create a new buyer profile
// ---------------------------------------------------------------------------

interface CreateProfileRequest {
  rawText: string;
  parsedIntent: ParsedIntent;
  marketId?: string;
  alertEnabled?: boolean;
}

interface CreateProfileResponse {
  profile: BuyerProfile;
  storage: "supabase" | "in_memory";
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<CreateProfileResponse | ProfilesErrorResponse>> {
  let body: CreateProfileRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }

  // Validate required fields
  if (!body.rawText || typeof body.rawText !== "string") {
    return NextResponse.json(
      {
        error: "Missing required field: rawText",
        details:
          "Provide the original natural language buyer description.",
      },
      { status: 400 }
    );
  }

  if (!body.parsedIntent || typeof body.parsedIntent !== "object") {
    return NextResponse.json(
      {
        error: "Missing required field: parsedIntent",
        details:
          "Provide the structured ParsedIntent from the /api/intent endpoint.",
      },
      { status: 400 }
    );
  }

  const marketId = body.marketId ?? "seattle";
  const alertEnabled = body.alertEnabled ?? false;

  // Try Supabase first
  if (isSupabaseConfigured()) {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json(
          {
            error: "Authentication required",
            details: "You must be logged in to create profiles.",
          },
          { status: 401 }
        );
      }

      const { data, error } = await supabase
        .from("buyer_profiles")
        .insert({
          agent_id: user.id,
          raw_text: body.rawText,
          parsed_intent: body.parsedIntent,
          market_id: marketId,
          alert_enabled: alertEnabled,
          last_run_at: null,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      const profile = mapDbRowToProfile(data);

      return NextResponse.json(
        { profile, storage: "supabase" },
        { status: 201 }
      );
    } catch (error) {
      console.warn(
        "Supabase insert failed, falling back to in-memory storage:",
        error
      );
      // Fall through to in-memory
    }
  }

  // In-memory fallback
  const agentId =
    request.nextUrl.searchParams.get("agentId") ?? "anonymous";

  const profile: BuyerProfile = {
    id: generateId(),
    agentId,
    rawText: body.rawText,
    parsedIntent: body.parsedIntent,
    marketId,
    alertEnabled,
    lastRunAt: null,
    createdAt: new Date().toISOString(),
  };

  const existing = inMemoryProfiles.get(agentId) ?? [];
  existing.push(profile);
  inMemoryProfiles.set(agentId, existing);

  return NextResponse.json(
    { profile, storage: "in_memory" },
    { status: 201 }
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapDbRowToProfile(row: Record<string, unknown>): BuyerProfile {
  return {
    id: row.id as string,
    agentId: (row.agent_id ?? row.agentId) as string,
    rawText: (row.raw_text ?? row.rawText) as string,
    parsedIntent: (row.parsed_intent ?? row.parsedIntent) as ParsedIntent,
    marketId: (row.market_id ?? row.marketId) as string,
    alertEnabled: (row.alert_enabled ?? row.alertEnabled ?? false) as boolean,
    lastRunAt: (row.last_run_at ?? row.lastRunAt ?? null) as string | null,
    createdAt: (row.created_at ?? row.createdAt) as string,
  };
}
