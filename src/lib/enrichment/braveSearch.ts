/**
 * Brave Search API integration for neighborhood intelligence.
 *
 * Enriches property results with local context: recent development news,
 * neighborhood vibe, market trends, school info, and lifestyle signals.
 * This gives agents conversational intel they can share with buyers.
 */

export interface NeighborhoodIntel {
  neighborhood: string;
  city: string;
  summary: string;
  highlights: string[];
  recentNews: NewsItem[];
  marketContext: string | null;
  lifestyleNotes: string[];
  fetchedAt: string;
}

export interface NewsItem {
  title: string;
  url: string;
  description: string;
  age: string | null;
}

interface BraveSearchResult {
  web?: {
    results?: Array<{
      title: string;
      url: string;
      description: string;
      age?: string;
    }>;
  };
}

const BRAVE_API_URL = "https://api.search.brave.com/res/v1/web/search";

/**
 * Search Brave for neighborhood intelligence.
 * Returns structured intel about a neighborhood that agents can use in
 * buyer conversations.
 */
export async function fetchNeighborhoodIntel(
  neighborhood: string,
  city: string = "Seattle",
  state: string = "WA"
): Promise<NeighborhoodIntel | null> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    return null;
  }

  const queries = [
    `${neighborhood} ${city} ${state} real estate market 2025 2026`,
    `${neighborhood} ${city} neighborhood guide living`,
  ];

  const allResults: NewsItem[] = [];
  const descriptions: string[] = [];

  for (const query of queries) {
    try {
      const response = await fetch(
        `${BRAVE_API_URL}?q=${encodeURIComponent(query)}&count=5&freshness=py`,
        {
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": apiKey,
          },
        }
      );

      if (!response.ok) {
        console.error(`Brave search failed for "${query}": ${response.status}`);
        continue;
      }

      const data: BraveSearchResult = await response.json();
      const webResults = data.web?.results ?? [];

      for (const result of webResults) {
        allResults.push({
          title: result.title,
          url: result.url,
          description: result.description,
          age: result.age ?? null,
        });
        descriptions.push(result.description);
      }
    } catch (error) {
      console.error(`Brave search error for "${query}":`, error);
    }
  }

  if (allResults.length === 0) {
    return null;
  }

  // Extract structured intel from raw results
  const intel = extractIntel(neighborhood, city, allResults, descriptions);

  return intel;
}

/**
 * Extract structured neighborhood intel from Brave search results.
 * This is a heuristic extraction. For v1, we can pass results through
 * Claude for better summarization.
 */
function extractIntel(
  neighborhood: string,
  city: string,
  results: NewsItem[],
  descriptions: string[]
): NeighborhoodIntel {
  const combinedText = descriptions.join(" ").toLowerCase();

  // Extract lifestyle signals from descriptions
  const lifestyleKeywords: Record<string, string> = {
    walkable: "Highly walkable neighborhood",
    "coffee shop": "Strong coffee and cafe culture",
    restaurant: "Great dining scene",
    park: "Good park and green space access",
    transit: "Well connected to public transit",
    "light rail": "Light rail accessible",
    waterfront: "Waterfront access nearby",
    "farmers market": "Local farmers market",
    "tech hub": "Close to tech employment centers",
    "family friendly": "Family friendly community",
    nightlife: "Active nightlife scene",
    "bike friendly": "Bike friendly infrastructure",
    arts: "Active arts and culture community",
  };

  const lifestyleNotes: string[] = [];
  for (const [keyword, note] of Object.entries(lifestyleKeywords)) {
    if (combinedText.includes(keyword)) {
      lifestyleNotes.push(note);
    }
  }

  // Filter for most relevant news items
  const recentNews = results
    .filter(
      (r) =>
        !r.url.includes("wikipedia.org") && !r.url.includes("zillow.com") && !r.url.includes("redfin.com")
    )
    .slice(0, 5);

  // Build a summary from the first few descriptions
  const summaryParts = descriptions.slice(0, 3).map((d) => {
    const sentences = d.split(/[.!?]+/).filter((s) => s.trim().length > 20);
    return sentences[0]?.trim() || "";
  });
  const summary =
    summaryParts.filter(Boolean).join(". ").slice(0, 300) ||
    `${neighborhood} is a neighborhood in ${city}.`;

  // Extract market signals
  let marketContext: string | null = null;
  const marketTerms = [
    "median price",
    "home values",
    "appreciation",
    "market",
    "inventory",
    "demand",
  ];
  for (const desc of descriptions) {
    if (marketTerms.some((term) => desc.toLowerCase().includes(term))) {
      const sentences = desc.split(/[.!?]+/);
      const relevant = sentences.find((s) =>
        marketTerms.some((t) => s.toLowerCase().includes(t))
      );
      if (relevant && relevant.trim().length > 20) {
        marketContext = relevant.trim();
        break;
      }
    }
  }

  return {
    neighborhood,
    city,
    summary,
    highlights: lifestyleNotes.slice(0, 5),
    recentNews,
    marketContext,
    lifestyleNotes,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Batch fetch intel for multiple neighborhoods.
 * Used when search results span several areas.
 */
export async function fetchMultiNeighborhoodIntel(
  neighborhoods: string[],
  city: string = "Seattle",
  state: string = "WA"
): Promise<Map<string, NeighborhoodIntel>> {
  const unique = [...new Set(neighborhoods)];
  const results = new Map<string, NeighborhoodIntel>();

  // Run in parallel with a concurrency limit of 3
  const batchSize = 3;
  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);
    const promises = batch.map((n) => fetchNeighborhoodIntel(n, city, state));
    const batchResults = await Promise.all(promises);

    batch.forEach((name, idx) => {
      const intel = batchResults[idx];
      if (intel) {
        results.set(name, intel);
      }
    });
  }

  return results;
}
