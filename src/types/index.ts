// Core domain types for Dreamhouse

export interface Market {
  id: string;
  name: string;
  slug: string;
  state: string;
  geoBoundary: GeoJSON.Polygon;
  active: boolean;
  config: MarketConfig;
  createdAt: string;
}

export interface MarketConfig {
  dataSources: string[];
  scoringWeights: ScoringWeights;
  defaultCenter: [number, number]; // [lng, lat]
  defaultZoom: number;
}

export interface ScoringWeights {
  location: number;
  budget: number;
  style: number;
  features: number;
  bedsBaths: number;
  sqft: number;
}

export interface Property {
  id: string;
  marketId: string;
  parcelId: string | null;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  lotSqft: number | null;
  yearBuilt: number | null;
  propertyType: PropertyType;
  architecturalStyle: string | null;
  features: string[];
  lastSaleDate: string | null;
  lastSalePrice: number | null;
  estimatedValue: number | null;
  ownerName: string | null;
  ownerMailingAddress: string | null;
  absenteeOwner: boolean;
  ownershipYears: number | null;
  equityEstimate: number | null;
  taxStatus: TaxStatus;
  permitHistory: PermitRecord[];
  listingStatus: ListingStatus;
  listingPrice: number | null;
  mlsNumber: string | null;
  photoUrls: string[];
  dataSources: string[];
  updatedAt: string;
  createdAt: string;
}

export type PropertyType =
  | "single_family"
  | "condo"
  | "townhouse"
  | "multi_family"
  | "land"
  | "other";

export type ListingStatus = "on_market" | "off_market" | "recently_sold";

export type TaxStatus = "current" | "delinquent" | "unknown";

export interface PermitRecord {
  type: string;
  date: string;
  description: string;
  value: number | null;
}

export interface BuyerProfile {
  id: string;
  agentId: string;
  rawText: string;
  parsedIntent: ParsedIntent;
  marketId: string;
  alertEnabled: boolean;
  lastRunAt: string | null;
  createdAt: string;
}

export interface ParsedIntent {
  styles: string[];
  features: string[];
  budget: { min: number | null; max: number | null };
  locations: LocationTarget[];
  beds: { min: number | null; max: number | null };
  baths: { min: number | null; max: number | null };
  sqft: { min: number | null; max: number | null };
  propertyTypes: PropertyType[];
  lifestyleTags: string[];
  summary: string;
}

export interface LocationTarget {
  name: string;
  lat: number;
  lng: number;
  radiusMiles: number;
}

export interface SearchResult {
  property: Property;
  matchScore: number;
  transactScore: TransactLevel;
  matchExplanation: MatchExplanation;
}

export type TransactLevel = "low" | "medium" | "high";

export interface MatchExplanation {
  overallReason: string;
  factors: MatchFactor[];
}

export interface MatchFactor {
  name: string;
  score: number;
  reason: string;
  matched: boolean;
}

export interface Agent {
  id: string;
  email: string;
  name: string;
  brokerage: string | null;
  licenseNumber: string | null;
  licenseState: string | null;
  licenseVerified: boolean;
  subscriptionStatus: SubscriptionStatus;
  teamId: string | null;
  role: AgentRole;
  createdAt: string;
}

export type SubscriptionStatus = "trial" | "active" | "past_due" | "canceled";

export type AgentRole = "agent" | "team_admin" | "brokerage_admin";

export interface Team {
  id: string;
  name: string;
  brokerage: string | null;
  adminAgentId: string;
  createdAt: string;
}
