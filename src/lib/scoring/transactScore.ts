/**
 * Compute a likelihood-to-transact score for a property.
 *
 * This rule-based points system estimates how likely a property owner
 * may be to sell, based on public data signals.
 *
 * Points system (additive):
 *   - Ownership > 10 years:                 +20
 *   - Ownership > 15 years (additional):    +10
 *   - Absentee owner:                       +15
 *   - High equity (> 50%):                  +10
 *   - Tax delinquent:                       +15
 *   - Recently sold nearby (market heat):   +5
 *   - No recent permits + home > 30 years:  +10
 *   - Listed as off_market:                 +5
 *
 * Score is capped at 100.
 * Mapped levels: 0-30 = "low", 31-60 = "medium", 61+ = "high"
 */

import type { Property, TransactLevel } from "@/types";

interface TransactResult {
  score: number;
  level: TransactLevel;
  signals: string[];
}

const CURRENT_YEAR = new Date().getFullYear();

export function computeTransactScore(
  property: Property,
  recentNearbySales?: boolean
): TransactResult {
  let score = 0;
  const signals: string[] = [];

  // Ownership duration
  if (property.ownershipYears !== null && property.ownershipYears > 10) {
    score += 20;
    signals.push(`Owner for ${property.ownershipYears} years (>10)`);

    if (property.ownershipYears > 15) {
      score += 10;
      signals.push(`Long-term owner (>${15} years)`);
    }
  }

  // Absentee owner
  if (property.absenteeOwner) {
    score += 15;
    signals.push("Absentee owner");
  }

  // High equity
  if (property.equityEstimate !== null && property.equityEstimate > 50) {
    score += 10;
    signals.push(
      `High equity: ${property.equityEstimate.toFixed(0)}% estimated`
    );
  }

  // Tax delinquent
  if (property.taxStatus === "delinquent") {
    score += 15;
    signals.push("Tax delinquent");
  }

  // Recently sold nearby (market heat) - passed in by caller
  if (recentNearbySales) {
    score += 5;
    signals.push("Recent nearby sales activity");
  }

  // No recent permits + older home
  const homeAge = property.yearBuilt
    ? CURRENT_YEAR - property.yearBuilt
    : null;
  const hasRecentPermits = property.permitHistory.some((permit) => {
    const permitYear = new Date(permit.date).getFullYear();
    return CURRENT_YEAR - permitYear <= 5;
  });

  if (!hasRecentPermits && homeAge !== null && homeAge > 30) {
    score += 10;
    signals.push(
      `No recent permits on ${homeAge}-year-old home (deferred maintenance likely)`
    );
  }

  // Off-market status
  if (property.listingStatus === "off_market") {
    score += 5;
    signals.push("Currently off-market");
  }

  // Cap at 100
  score = Math.min(100, score);

  // Map to level
  let level: TransactLevel;
  if (score >= 61) {
    level = "high";
  } else if (score >= 31) {
    level = "medium";
  } else {
    level = "low";
  }

  return { score, level, signals };
}
