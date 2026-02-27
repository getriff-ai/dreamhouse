/**
 * Street View & satellite imagery URL generation.
 *
 * Supports two providers:
 *  1. Google Street View Static API  (requires GOOGLE_STREET_VIEW_API_KEY)
 *  2. Mapbox Static Images API       (fallback, uses NEXT_PUBLIC_MAPBOX_TOKEN)
 *
 * When neither key is available the functions return null so enrichment
 * can continue without photos.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StreetViewMetadata {
  available: boolean;
  panoId?: string;
  lat?: number;
  lng?: number;
  date?: string;
}

export interface PropertyImageUrls {
  streetView: string | null;
  satellite: string | null;
  source: "google_street_view" | "mapbox_satellite" | "none";
}

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

function getGoogleApiKey(): string | undefined {
  return process.env.GOOGLE_STREET_VIEW_API_KEY;
}

function getMapboxToken(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? process.env.MAPBOX_ACCESS_TOKEN
  );
}

// ---------------------------------------------------------------------------
// Google Street View
// ---------------------------------------------------------------------------

/**
 * Returns a Google Street View Static API URL for the given coordinates.
 *
 * @param lat   Latitude
 * @param lng   Longitude
 * @param heading  Camera heading in degrees (0-360). Defaults to 0 (north).
 * @param size  Image dimensions. Defaults to "800x600".
 * @param fov   Horizontal field of view in degrees. Defaults to 90.
 * @returns     Full URL string, or null if the API key is not configured.
 */
export function getStreetViewUrl(
  lat: number,
  lng: number,
  heading: number = 0,
  size: string = "800x600",
  fov: number = 90
): string | null {
  const apiKey = getGoogleApiKey();
  if (!apiKey) return null;

  const params = new URLSearchParams({
    size,
    location: `${lat},${lng}`,
    heading: String(heading),
    fov: String(fov),
    key: apiKey,
  });

  return `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`;
}

/**
 * Check Google Street View metadata to see if imagery is available at a
 * location. Uses the metadata endpoint, which is free and does not count
 * against the image quota.
 *
 * @returns Metadata including availability flag, or null if the API key is
 *          not configured.
 */
export async function getStreetViewMetadata(
  lat: number,
  lng: number
): Promise<StreetViewMetadata | null> {
  const apiKey = getGoogleApiKey();
  if (!apiKey) return null;

  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    key: apiKey,
  });

  const url = `https://maps.googleapis.com/maps/api/streetview/metadata?${params.toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(
        `[streetView] Metadata request failed: ${response.status} ${response.statusText}`
      );
      return { available: false };
    }

    const data = (await response.json()) as {
      status: string;
      pano_id?: string;
      location?: { lat: number; lng: number };
      date?: string;
    };

    if (data.status === "OK") {
      return {
        available: true,
        panoId: data.pano_id,
        lat: data.location?.lat,
        lng: data.location?.lng,
        date: data.date,
      };
    }

    return { available: false };
  } catch (err) {
    console.warn("[streetView] Metadata request error:", err);
    return { available: false };
  }
}

// ---------------------------------------------------------------------------
// Mapbox Static Images (satellite fallback)
// ---------------------------------------------------------------------------

/**
 * Returns a Mapbox Static Images API URL showing a satellite view of the
 * property location.
 *
 * @param lat    Latitude
 * @param lng    Longitude
 * @param zoom   Zoom level (default 17 for lot-level view)
 * @param size   Image dimensions "WIDTHxHEIGHT" (default "800x600")
 * @returns      Full URL string, or null if the Mapbox token is not configured.
 */
export function getMapboxSatelliteUrl(
  lat: number,
  lng: number,
  zoom: number = 17,
  size: string = "800x600"
): string | null {
  const token = getMapboxToken();
  if (!token) return null;

  const [width, height] = size.split("x").map(Number);
  const bearing = 0;

  return (
    `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/` +
    `${lng},${lat},${zoom},${bearing}/${width}x${height}@2x` +
    `?access_token=${token}`
  );
}

// ---------------------------------------------------------------------------
// Unified image URL generator
// ---------------------------------------------------------------------------

/**
 * Get the best available property image URLs for a location.
 *
 * Strategy:
 *  1. If Google Street View key is set, check metadata for availability.
 *     If available, return a street-level photo URL.
 *  2. Always try to provide a Mapbox satellite fallback.
 *  3. If neither service is configured, return nulls.
 */
export async function getPropertyImageUrls(
  lat: number,
  lng: number
): Promise<PropertyImageUrls> {
  // Attempt Google Street View first
  const googleKey = getGoogleApiKey();
  if (googleKey) {
    const meta = await getStreetViewMetadata(lat, lng);
    if (meta?.available) {
      return {
        streetView: getStreetViewUrl(lat, lng),
        satellite: getMapboxSatelliteUrl(lat, lng),
        source: "google_street_view",
      };
    }
  }

  // Fall back to Mapbox satellite
  const satelliteUrl = getMapboxSatelliteUrl(lat, lng);
  if (satelliteUrl) {
    return {
      streetView: null,
      satellite: satelliteUrl,
      source: "mapbox_satellite",
    };
  }

  // No imagery available
  return {
    streetView: null,
    satellite: null,
    source: "none",
  };
}
