/**
 * Architectural style similarity map for the Seattle metro area market.
 *
 * Each key is a canonical style name (lowercase). Its value is an array of
 * related / similar styles. Similarity is bidirectional: if A lists B as
 * related, the scoring engine should also treat B as related to A.
 */

export const STYLE_SIMILARITY: Record<string, string[]> = {
  "mid-century modern": [
    "modern",
    "contemporary",
    "atomic ranch",
    "retro modern",
    "post and beam",
  ],
  modern: [
    "mid-century modern",
    "contemporary",
    "minimalist",
    "international style",
  ],
  contemporary: [
    "modern",
    "mid-century modern",
    "northwest contemporary",
    "minimalist",
  ],
  "northwest contemporary": [
    "contemporary",
    "modern",
    "pacific northwest",
    "northwest lodge",
  ],
  craftsman: [
    "bungalow",
    "arts and crafts",
    "american foursquare",
    "seattle box",
  ],
  bungalow: ["craftsman", "arts and crafts", "cottage"],
  "arts and crafts": ["craftsman", "bungalow", "mission"],
  colonial: [
    "dutch colonial",
    "georgian",
    "federal",
    "cape cod",
    "traditional",
  ],
  "dutch colonial": ["colonial", "traditional", "cape cod"],
  tudor: ["english cottage", "storybook", "traditional", "european"],
  victorian: ["queen anne", "italianate", "painted lady", "ornate"],
  "queen anne": ["victorian", "painted lady", "italianate"],
  farmhouse: ["modern farmhouse", "country", "ranch", "rural"],
  "modern farmhouse": ["farmhouse", "contemporary", "transitional"],
  ranch: ["rambler", "split level", "mid-century modern", "atomic ranch"],
  "split level": ["ranch", "rambler", "tri-level"],
  "cape cod": ["colonial", "traditional", "cottage", "new england"],
  cottage: ["bungalow", "cape cod", "english cottage", "storybook"],
  "english cottage": ["cottage", "tudor", "storybook"],
  mediterranean: ["spanish", "mission", "italian villa", "tuscan"],
  spanish: ["mediterranean", "mission", "spanish colonial"],
  mission: ["spanish", "mediterranean", "arts and crafts"],
  "pacific northwest": [
    "northwest contemporary",
    "northwest lodge",
    "contemporary",
  ],
  "northwest lodge": ["pacific northwest", "northwest contemporary", "cabin"],
  minimalist: ["modern", "contemporary", "scandinavian"],
  scandinavian: ["minimalist", "modern", "nordic"],
  transitional: ["traditional", "contemporary", "modern farmhouse"],
  traditional: ["colonial", "transitional", "cape cod", "georgian"],
  "seattle box": ["craftsman", "american foursquare"],
  "american foursquare": ["craftsman", "seattle box", "traditional"],
  cabin: ["northwest lodge", "rustic", "log home"],
  rustic: ["cabin", "log home", "farmhouse"],
  townhouse: ["urban", "row house"],
  industrial: ["loft", "modern", "urban"],
  loft: ["industrial", "urban", "modern"],
};

/**
 * Normalize a style string for lookup in the similarity map.
 */
export function normalizeStyle(style: string): string {
  return style.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Check whether two styles are considered similar (or identical).
 * Returns a similarity score: 1.0 for exact match, 0.5 for related, 0 for unrelated.
 */
export function styleSimilarity(styleA: string, styleB: string): number {
  const a = normalizeStyle(styleA);
  const b = normalizeStyle(styleB);

  if (a === b) return 1.0;

  const relatedToA = STYLE_SIMILARITY[a] ?? [];
  if (relatedToA.includes(b)) return 0.5;

  // Check reverse direction
  const relatedToB = STYLE_SIMILARITY[b] ?? [];
  if (relatedToB.includes(a)) return 0.5;

  return 0;
}

/**
 * Given a desired style, find the best similarity score against a property's style.
 */
export function bestStyleMatch(
  desiredStyles: string[],
  propertyStyle: string | null
): number {
  if (!propertyStyle || desiredStyles.length === 0) return 0;

  let best = 0;
  for (const desired of desiredStyles) {
    const score = styleSimilarity(desired, propertyStyle);
    if (score > best) best = score;
    if (best === 1.0) break; // Can't do better than exact match
  }
  return best;
}
