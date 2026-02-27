/**
 * Compute a match score (0-100) for a property against a ParsedIntent.
 *
 * Weighted factors:
 *   - Location  25%
 *   - Budget    20%
 *   - Style     20%
 *   - Features  15%
 *   - Beds/Baths 10%
 *   - Sqft      10%
 */

import type {
  Property,
  ParsedIntent,
  MatchExplanation,
  MatchFactor,
} from "@/types";
import { haversineDistance } from "./haversine";
import { bestStyleMatch, normalizeStyle } from "./styleMap";

interface MatchResult {
  score: number;
  explanation: MatchExplanation;
}

const BASE_WEIGHTS = {
  location: 0.25,
  budget: 0.2,
  style: 0.2,
  features: 0.15,
  bedsBaths: 0.1,
  sqft: 0.1,
};

/**
 * Determine which scoring factors are actually specified in the intent.
 * Unspecified factors should not inflate the score.
 */
function getSpecifiedFactors(intent: ParsedIntent): Record<string, boolean> {
  return {
    location: intent.locations.length > 0,
    budget: intent.budget.min !== null || intent.budget.max !== null,
    style: intent.styles.length > 0,
    features: intent.features.length > 0,
    bedsBaths:
      intent.beds.min !== null ||
      intent.beds.max !== null ||
      intent.baths.min !== null ||
      intent.baths.max !== null,
    sqft: intent.sqft.min !== null || intent.sqft.max !== null,
  };
}

/**
 * Redistribute weights so only specified factors contribute.
 * Unspecified factors get weight 0 and a neutral score.
 */
function getRedistributedWeights(
  intent: ParsedIntent
): Record<string, number> {
  const specified = getSpecifiedFactors(intent);
  const specifiedKeys = Object.keys(specified).filter(
    (k) => specified[k]
  );

  // If nothing is specified, fall back to equal weights on all factors
  // but with a penalty (scores will be lower since individual scores won't be 100)
  if (specifiedKeys.length === 0) {
    return { ...BASE_WEIGHTS };
  }

  // Sum of weights for specified factors
  const totalSpecifiedWeight = specifiedKeys.reduce(
    (sum, k) => sum + BASE_WEIGHTS[k as keyof typeof BASE_WEIGHTS],
    0
  );

  // Redistribute: scale specified factor weights to sum to 1.0
  const weights: Record<string, number> = {};
  for (const key of Object.keys(BASE_WEIGHTS)) {
    if (specified[key]) {
      weights[key] =
        BASE_WEIGHTS[key as keyof typeof BASE_WEIGHTS] /
        totalSpecifiedWeight;
    } else {
      weights[key] = 0;
    }
  }

  return weights;
}

// ---------------------------------------------------------------------------
// Individual factor scoring
// ---------------------------------------------------------------------------

function scoreLocation(
  property: Property,
  intent: ParsedIntent
): { score: number; reason: string } {
  if (intent.locations.length === 0) {
    return { score: 50, reason: "No location preference specified" };
  }

  // Find best score across all target locations
  let bestScore = 0;
  let bestName = "";

  for (const loc of intent.locations) {
    const dist = haversineDistance(property.lat, property.lng, loc.lat, loc.lng);
    const radius = loc.radiusMiles || 2;

    let locScore: number;
    if (dist <= 0.1) {
      locScore = 100;
    } else if (dist <= radius) {
      // Linear decay from 100 at center to 60 at radius edge
      locScore = Math.max(0, 100 - (dist / radius) * 40);
    } else if (dist <= radius * 2) {
      // Gradual decay beyond radius
      const overageRatio = (dist - radius) / radius;
      locScore = Math.max(0, 60 * (1 - overageRatio));
    } else {
      locScore = 0;
    }

    if (locScore > bestScore) {
      bestScore = locScore;
      bestName = loc.name;
    }
  }

  const reason =
    bestScore > 0
      ? `${bestScore.toFixed(0)}% match for ${bestName || "target location"}`
      : `Outside all target locations`;

  return { score: bestScore, reason };
}

function scoreBudget(
  property: Property,
  intent: ParsedIntent
): { score: number; reason: string } {
  const price = property.listingPrice ?? property.estimatedValue;
  if (!price) {
    return { score: 50, reason: "No price data available" };
  }

  const { min, max } = intent.budget;

  // No budget preference
  if (min === null && max === null) {
    return { score: 50, reason: "No budget constraint specified" };
  }

  let score = 100;
  const reasons: string[] = [];

  // Check against max budget
  if (max !== null && price > max) {
    // Linear decay: 100 at max, 0 at 2x max
    const overageRatio = (price - max) / max;
    score = Math.max(0, 100 * (1 - overageRatio));
    reasons.push(
      `$${(price / 1000).toFixed(0)}K is ${((overageRatio * 100).toFixed(0))}% over max budget of $${(max / 1000).toFixed(0)}K`
    );
  }

  // Check against min budget (buyer may want a certain quality level)
  if (min !== null && price < min) {
    const underRatio = (min - price) / min;
    const minScore = Math.max(0, 100 * (1 - underRatio));
    score = Math.min(score, minScore);
    reasons.push(`Below minimum budget of $${(min / 1000).toFixed(0)}K`);
  }

  if (reasons.length === 0) {
    reasons.push(`$${(price / 1000).toFixed(0)}K is within budget`);
  }

  return { score, reason: reasons.join(". ") };
}

function scoreStyle(
  property: Property,
  intent: ParsedIntent
): { score: number; reason: string } {
  if (intent.styles.length === 0) {
    return { score: 50, reason: "No style preference specified" };
  }

  if (!property.architecturalStyle) {
    return { score: 25, reason: "Property style unknown" };
  }

  const similarity = bestStyleMatch(intent.styles, property.architecturalStyle);

  if (similarity === 1.0) {
    return {
      score: 100,
      reason: `Exact style match: ${property.architecturalStyle}`,
    };
  }
  if (similarity >= 0.5) {
    return {
      score: 50,
      reason: `Related style: ${property.architecturalStyle} (similar to ${intent.styles.join(", ")})`,
    };
  }

  return {
    score: 0,
    reason: `Style mismatch: ${property.architecturalStyle} vs desired ${intent.styles.join(", ")}`,
  };
}

function scoreFeatures(
  property: Property,
  intent: ParsedIntent
): { score: number; reason: string } {
  if (intent.features.length === 0) {
    return { score: 50, reason: "No feature requirements specified" };
  }

  const propertyFeatures = property.features.map((f) => normalizeStyle(f));
  let matchCount = 0;
  const matched: string[] = [];
  const missing: string[] = [];

  for (const desired of intent.features) {
    const normalized = normalizeStyle(desired);
    // Check for exact or substring match
    const found = propertyFeatures.some(
      (pf) => pf.includes(normalized) || normalized.includes(pf)
    );
    if (found) {
      matchCount++;
      matched.push(desired);
    } else {
      missing.push(desired);
    }
  }

  const score = (matchCount / intent.features.length) * 100;
  const parts: string[] = [];
  if (matched.length > 0) parts.push(`Has: ${matched.join(", ")}`);
  if (missing.length > 0) parts.push(`Missing: ${missing.join(", ")}`);

  return { score, reason: parts.join(". ") };
}

function scoreBedsBaths(
  property: Property,
  intent: ParsedIntent
): { score: number; reason: string } {
  const bedsSpecified =
    intent.beds.min !== null || intent.beds.max !== null;
  const bathsSpecified =
    intent.baths.min !== null || intent.baths.max !== null;

  if (!bedsSpecified && !bathsSpecified) {
    return { score: 50, reason: "No bed/bath preference specified" };
  }

  let bedScore = 50;
  let bathScore = 50;
  const reasons: string[] = [];

  // Beds scoring
  if (bedsSpecified) {
    const targetBeds = intent.beds.min ?? intent.beds.max ?? property.bedrooms;
    const diff = Math.abs(property.bedrooms - targetBeds);

    if (diff === 0) {
      bedScore = 100;
    } else if (diff <= 1) {
      bedScore = 100;
    } else if (diff <= 2) {
      bedScore = 50;
    } else {
      bedScore = 0;
    }

    // Also penalize if below minimum
    if (intent.beds.min !== null && property.bedrooms < intent.beds.min) {
      const belowDiff = intent.beds.min - property.bedrooms;
      if (belowDiff > 2) bedScore = 0;
      else if (belowDiff > 1) bedScore = Math.min(bedScore, 50);
    }

    reasons.push(`${property.bedrooms} beds (wanted ${intent.beds.min ?? "any"}+)`);
  }

  // Baths scoring
  if (bathsSpecified) {
    const targetBaths =
      intent.baths.min ?? intent.baths.max ?? property.bathrooms;
    const diff = Math.abs(property.bathrooms - targetBaths);

    if (diff === 0) {
      bathScore = 100;
    } else if (diff <= 1) {
      bathScore = 100;
    } else if (diff <= 2) {
      bathScore = 50;
    } else {
      bathScore = 0;
    }

    reasons.push(
      `${property.bathrooms} baths (wanted ${intent.baths.min ?? "any"}+)`
    );
  }

  const score = (bedScore + bathScore) / 2;
  return {
    score,
    reason: reasons.length > 0 ? reasons.join(". ") : "No bed/bath preference",
  };
}

function scoreSqft(
  property: Property,
  intent: ParsedIntent
): { score: number; reason: string } {
  if (intent.sqft.min === null && intent.sqft.max === null) {
    return { score: 50, reason: "No sqft preference specified" };
  }

  const sqft = property.sqft;
  if (!sqft) {
    return { score: 50, reason: "Property sqft unknown" };
  }

  const { min, max } = intent.sqft;

  if (min !== null && max !== null) {
    if (sqft >= min && sqft <= max) {
      return { score: 100, reason: `${sqft} sqft is within range` };
    }
    if (sqft < min) {
      const deficit = (min - sqft) / min;
      const score = Math.max(0, 100 * (1 - deficit));
      return {
        score,
        reason: `${sqft} sqft is below minimum of ${min}`,
      };
    }
    // sqft > max
    const excess = (sqft - max) / max;
    const score = Math.max(0, 100 * (1 - excess));
    return {
      score,
      reason: `${sqft} sqft is above maximum of ${max}`,
    };
  }

  if (min !== null && sqft < min) {
    const deficit = (min - sqft) / min;
    return {
      score: Math.max(0, 100 * (1 - deficit)),
      reason: `${sqft} sqft is below minimum of ${min}`,
    };
  }

  if (max !== null && sqft > max) {
    const excess = (sqft - max) / max;
    return {
      score: Math.max(0, 100 * (1 - excess)),
      reason: `${sqft} sqft is above maximum of ${max}`,
    };
  }

  return { score: 100, reason: `${sqft} sqft meets criteria` };
}

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------

export function computeMatchScore(
  property: Property,
  intent: ParsedIntent
): MatchResult {
  const weights = getRedistributedWeights(intent);

  const locationResult = scoreLocation(property, intent);
  const budgetResult = scoreBudget(property, intent);
  const styleResult = scoreStyle(property, intent);
  const featuresResult = scoreFeatures(property, intent);
  const bedsBathsResult = scoreBedsBaths(property, intent);
  const sqftResult = scoreSqft(property, intent);

  const factors: MatchFactor[] = [
    {
      name: "Location",
      score: locationResult.score,
      reason: locationResult.reason,
      matched: weights.location > 0 && locationResult.score >= 50,
    },
    {
      name: "Budget",
      score: budgetResult.score,
      reason: budgetResult.reason,
      matched: weights.budget > 0 && budgetResult.score >= 50,
    },
    {
      name: "Style",
      score: styleResult.score,
      reason: styleResult.reason,
      matched: weights.style > 0 && styleResult.score >= 50,
    },
    {
      name: "Features",
      score: featuresResult.score,
      reason: featuresResult.reason,
      matched: weights.features > 0 && featuresResult.score >= 50,
    },
    {
      name: "Beds/Baths",
      score: bedsBathsResult.score,
      reason: bedsBathsResult.reason,
      matched: weights.bedsBaths > 0 && bedsBathsResult.score >= 50,
    },
    {
      name: "Sqft",
      score: sqftResult.score,
      reason: sqftResult.reason,
      matched: weights.sqft > 0 && sqftResult.score >= 50,
    },
  ];

  const overallScore =
    locationResult.score * weights.location +
    budgetResult.score * weights.budget +
    styleResult.score * weights.style +
    featuresResult.score * weights.features +
    bedsBathsResult.score * weights.bedsBaths +
    sqftResult.score * weights.sqft;

  // Build a human-readable summary
  const strongFactors = factors.filter((f) => f.score >= 75);
  const weakFactors = factors.filter((f) => f.score < 50);

  let overallReason: string;
  if (strongFactors.length >= 4) {
    overallReason = `Strong match across ${strongFactors.map((f) => f.name.toLowerCase()).join(", ")}`;
  } else if (strongFactors.length >= 2) {
    overallReason = `Good match on ${strongFactors.map((f) => f.name.toLowerCase()).join(", ")}`;
    if (weakFactors.length > 0) {
      overallReason += `; weaker on ${weakFactors.map((f) => f.name.toLowerCase()).join(", ")}`;
    }
  } else if (strongFactors.length >= 1) {
    overallReason = `Partial match: strong on ${strongFactors[0].name.toLowerCase()}`;
  } else {
    overallReason = "Weak match across most factors";
  }

  return {
    score: Math.round(overallScore * 100) / 100,
    explanation: {
      overallReason,
      factors,
    },
  };
}
