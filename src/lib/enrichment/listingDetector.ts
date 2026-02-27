/**
 * Listing status detection via Brave Search API.
 *
 * Searches Brave for a property address restricted to major listing sites
 * (Zillow, Redfin, Realtor.com) to determine if a property is currently
 * on the market, and extracts listing URLs for link-out.
 *
 * This uses the Brave Web Search API (licensed) and does NOT scrape any
 * listing site pages.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ListingDetectionResult {
  isListed: boolean;
  listingUrls: {
    zillow?: string;
    redfin?: string;
    realtor?: string;
  };
  lastChecked: string;
  error?: string;
}

interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
}

interface BraveSearchResponse {
  web?: {
    results: BraveSearchResult[];
  };
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BRAVE_API_BASE = "https://api.search.brave.com/res/v1/web/search";

/** Maximum concurrent Brave requests (respect rate limits). */
const MAX_CONCURRENCY = 3;

/** Delay between batched request groups (ms). */
const BATCH_DELAY_MS = 500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getBraveApiKey(): string | undefined {
  return process.env.BRAVE_SEARCH_API_KEY;
}

/**
 * Execute a single Brave search query and return raw results.
 */
async function braveSearch(query: string): Promise<BraveSearchResult[]> {
  const apiKey = getBraveApiKey();
  if (!apiKey) {
    throw new Error("BRAVE_SEARCH_API_KEY is not configured");
  }

  const params = new URLSearchParams({
    q: query,
    count: "10",
  });

  const url = `${BRAVE_API_BASE}?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Brave search failed: ${response.status} ${response.statusText}`
    );
  }

  const data: BraveSearchResponse = await response.json();
  return data.web?.results ?? [];
}

/**
 * Build the search query string for a property address.
 *
 * Uses exact-match quotes around the address and city, with site: operators
 * to restrict results to major listing sites.
 */
function buildListingQuery(
  address: string,
  city: string,
  state: string
): string {
  // Clean up address for search (remove unit numbers that might confuse search)
  const cleanAddress = address.replace(/#\d+/, "").trim();
  return `"${cleanAddress}" "${city}" ${state} site:zillow.com OR site:redfin.com OR site:realtor.com`;
}

/**
 * Extract listing URLs from Brave search results by domain.
 */
function extractListingUrls(
  results: BraveSearchResult[]
): ListingDetectionResult["listingUrls"] {
  const urls: ListingDetectionResult["listingUrls"] = {};

  for (const result of results) {
    const urlLower = result.url.toLowerCase();

    if (urlLower.includes("zillow.com") && !urls.zillow) {
      // Only capture property detail pages, not search results
      if (
        urlLower.includes("/homedetails/") ||
        urlLower.includes("/homes/")
      ) {
        urls.zillow = result.url;
      }
    }

    if (urlLower.includes("redfin.com") && !urls.redfin) {
      urls.redfin = result.url;
    }

    if (urlLower.includes("realtor.com") && !urls.realtor) {
      if (urlLower.includes("/realestateandhomes-detail/")) {
        urls.realtor = result.url;
      }
    }
  }

  return urls;
}

/**
 * Determine if a property is likely currently listed based on search result
 * titles and descriptions (without scraping the actual pages).
 *
 * Looks for signals like "for sale", price mentions, and listing-specific
 * URL patterns.
 */
function inferListedStatus(results: BraveSearchResult[]): boolean {
  const listingSignals = [
    /for sale/i,
    /\$[\d,]+/,
    /listed for/i,
    /asking price/i,
    /new listing/i,
    /open house/i,
    /price reduced/i,
    /just listed/i,
    /active listing/i,
    /on market/i,
  ];

  const soldSignals = [
    /sold/i,
    /off.?market/i,
    /pending/i,
    /contingent/i,
    /recently sold/i,
  ];

  let forSaleScore = 0;
  let soldScore = 0;

  for (const result of results) {
    const text = `${result.title} ${result.description}`;

    for (const signal of listingSignals) {
      if (signal.test(text)) forSaleScore++;
    }
    for (const signal of soldSignals) {
      if (signal.test(text)) soldScore++;
    }
  }

  // Consider it currently listed only if "for sale" signals dominate
  return forSaleScore > soldScore && forSaleScore >= 2;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect whether a property at the given address is currently listed on
 * major real estate sites.
 *
 * Returns listing URLs and a boolean assessment. Gracefully handles missing
 * API key by returning a "not listed" result with an error note.
 */
export async function detectListingStatus(
  address: string,
  city: string,
  state: string
): Promise<ListingDetectionResult> {
  const now = new Date().toISOString();

  if (!getBraveApiKey()) {
    return {
      isListed: false,
      listingUrls: {},
      lastChecked: now,
      error: "BRAVE_SEARCH_API_KEY not configured; skipping listing detection",
    };
  }

  try {
    const query = buildListingQuery(address, city, state);
    const results = await braveSearch(query);
    const listingUrls = extractListingUrls(results);
    const isListed = inferListedStatus(results);

    return {
      isListed,
      listingUrls,
      lastChecked: now,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error in listing detection";
    console.warn(`[listingDetector] Error for "${address}":`, message);

    return {
      isListed: false,
      listingUrls: {},
      lastChecked: now,
      error: message,
    };
  }
}

// ---------------------------------------------------------------------------
// Batch processing with concurrency control
// ---------------------------------------------------------------------------

interface BatchAddress {
  address: string;
  city: string;
  state: string;
}

/**
 * Detect listing status for multiple properties with concurrency limiting.
 *
 * Processes at most MAX_CONCURRENCY addresses in parallel, then waits
 * BATCH_DELAY_MS before the next batch to respect Brave rate limits.
 *
 * @param addresses  Array of { address, city, state } objects.
 * @param onProgress  Optional callback with (completed, total) counts.
 * @returns  Map from address string to its listing detection result.
 */
export async function detectListingStatusBatch(
  addresses: BatchAddress[],
  onProgress?: (completed: number, total: number) => void
): Promise<Map<string, ListingDetectionResult>> {
  const results = new Map<string, ListingDetectionResult>();
  let completed = 0;

  // Process in chunks of MAX_CONCURRENCY
  for (let i = 0; i < addresses.length; i += MAX_CONCURRENCY) {
    const chunk = addresses.slice(i, i + MAX_CONCURRENCY);

    const chunkResults = await Promise.allSettled(
      chunk.map(({ address, city, state }) =>
        detectListingStatus(address, city, state).then((result) => ({
          address,
          result,
        }))
      )
    );

    for (const settled of chunkResults) {
      completed++;
      if (settled.status === "fulfilled") {
        results.set(settled.value.address, settled.value.result);
      } else {
        // Should not happen since detectListingStatus catches internally,
        // but handle just in case
        const addr = chunk[chunkResults.indexOf(settled)]?.address ?? "unknown";
        results.set(addr, {
          isListed: false,
          listingUrls: {},
          lastChecked: new Date().toISOString(),
          error: String(settled.reason),
        });
      }
      onProgress?.(completed, addresses.length);
    }

    // Pause between batches (skip after last batch)
    if (i + MAX_CONCURRENCY < addresses.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  return results;
}
