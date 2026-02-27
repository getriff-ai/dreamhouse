"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Bell,
  BellOff,
  Clock,
  Search,
  MapPin,
  DollarSign,
  Home,
  ChevronRight,
  Trash2,
} from "lucide-react";
import Header from "@/components/layout/Header";
import type { BuyerProfile } from "@/types";

// Placeholder profiles for demonstration
const mockProfiles: BuyerProfile[] = [
  {
    id: "bp-1",
    agentId: "agent-1",
    rawText:
      "Looking for a mid-century modern home in Capitol Hill or Madrona. Budget up to $1.2M. Needs 3+ bedrooms, updated kitchen, and some outdoor space. They love natural light and open floor plans.",
    parsedIntent: {
      styles: ["Mid-century modern"],
      features: ["Updated kitchen", "Outdoor space", "Natural light", "Open floor plan"],
      budget: { min: null, max: 1200000 },
      locations: [
        { name: "Capitol Hill", lat: 47.625, lng: -122.322, radiusMiles: 1 },
        { name: "Madrona", lat: 47.612, lng: -122.289, radiusMiles: 1 },
      ],
      beds: { min: 3, max: null },
      baths: { min: null, max: null },
      sqft: { min: null, max: null },
      propertyTypes: ["single_family"],
      lifestyleTags: ["walkable", "urban"],
      summary:
        "Mid-century modern, 3+ bed in Capitol Hill/Madrona under $1.2M with natural light and outdoor space.",
    },
    marketId: "seattle",
    alertEnabled: true,
    lastRunAt: "2026-02-25T10:30:00Z",
    createdAt: "2026-02-20T08:00:00Z",
  },
  {
    id: "bp-2",
    agentId: "agent-1",
    rawText:
      "Waterfront property on Mercer Island. Looking for craftsman or traditional style. 4 bedrooms minimum, at least 3000 sqft. Budget around $2.5M. Must have water views and dock access.",
    parsedIntent: {
      styles: ["Craftsman", "Traditional"],
      features: ["Water views", "Dock access"],
      budget: { min: null, max: 2500000 },
      locations: [
        { name: "Mercer Island", lat: 47.571, lng: -122.222, radiusMiles: 3 },
      ],
      beds: { min: 4, max: null },
      baths: { min: null, max: null },
      sqft: { min: 3000, max: null },
      propertyTypes: ["single_family"],
      lifestyleTags: ["waterfront", "luxury"],
      summary:
        "Waterfront craftsman on Mercer Island, 4+ bed, 3000+ sqft, under $2.5M with dock access.",
    },
    marketId: "seattle",
    alertEnabled: false,
    lastRunAt: "2026-02-24T14:15:00Z",
    createdAt: "2026-02-18T12:00:00Z",
  },
  {
    id: "bp-3",
    agentId: "agent-1",
    rawText:
      "First-time buyer couple, young professionals. They want something modern or contemporary in Fremont or Wallingford. 2 bed is fine. Under $850K. Close to restaurants and transit.",
    parsedIntent: {
      styles: ["Modern", "Contemporary"],
      features: ["Close to restaurants", "Near transit"],
      budget: { min: null, max: 850000 },
      locations: [
        { name: "Fremont", lat: 47.651, lng: -122.35, radiusMiles: 1 },
        { name: "Wallingford", lat: 47.658, lng: -122.335, radiusMiles: 1 },
      ],
      beds: { min: 2, max: null },
      baths: { min: null, max: null },
      sqft: { min: null, max: null },
      propertyTypes: ["single_family", "condo", "townhouse"],
      lifestyleTags: ["walkable", "urban", "first-time buyer"],
      summary:
        "Modern 2+ bed in Fremont/Wallingford under $850K, walkable neighborhood near transit.",
    },
    marketId: "seattle",
    alertEnabled: true,
    lastRunAt: "2026-02-26T08:00:00Z",
    createdAt: "2026-02-22T09:30:00Z",
  },
];

function formatBudget(budget: { min: number | null; max: number | null }): string {
  if (budget.max) {
    return `Under $${(budget.max / 1_000_000).toFixed(budget.max % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (budget.min) {
    return `From $${(budget.min / 1_000_000).toFixed(1)}M+`;
  }
  return "No budget set";
}

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<BuyerProfile[]>(mockProfiles);

  const toggleAlert = (id: string) => {
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, alertEnabled: !p.alertEnabled } : p
      )
    );
  };

  const removeProfile = (id: string) => {
    setProfiles((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-5xl px-5 py-8">
        {/* Page header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Buyer Profiles
            </h1>
            <p className="mt-1 text-sm text-muted">
              {profiles.length} active{" "}
              {profiles.length === 1 ? "profile" : "profiles"}
            </p>
          </div>
          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" />
            New Profile
          </Link>
        </div>

        {/* Profile cards */}
        {profiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-50">
              <Search className="h-7 w-7 text-muted/40" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              No buyer profiles yet
            </h3>
            <p className="mt-1 max-w-sm text-center text-sm text-muted">
              Create your first buyer profile by searching for properties on the
              home page.
            </p>
            <Link
              href="/"
              className="mt-6 flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              <Plus className="h-4 w-4" />
              Create Profile
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="group overflow-hidden rounded-xl border border-border-light bg-white shadow-sm transition-all hover:shadow-md"
              >
                <div className="flex items-start gap-5 p-5">
                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    {/* Summary */}
                    <p className="text-sm font-semibold leading-relaxed text-foreground">
                      {profile.parsedIntent.summary}
                    </p>

                    {/* Raw text excerpt */}
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">
                      {profile.rawText}
                    </p>

                    {/* Tags row */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {/* Style tags */}
                      {profile.parsedIntent.styles.map((style) => (
                        <span
                          key={style}
                          className="flex items-center gap-1 rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-medium text-accent"
                        >
                          <Home className="h-3 w-3" />
                          {style}
                        </span>
                      ))}

                      {/* Location tags */}
                      {profile.parsedIntent.locations.map((loc) => (
                        <span
                          key={loc.name}
                          className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600"
                        >
                          <MapPin className="h-3 w-3" />
                          {loc.name}
                        </span>
                      ))}

                      {/* Budget tag */}
                      <span className="flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        <DollarSign className="h-3 w-3" />
                        {formatBudget(profile.parsedIntent.budget)}
                      </span>
                    </div>

                    {/* Meta row */}
                    <div className="mt-3 flex items-center gap-4 text-xs text-muted">
                      {profile.lastRunAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Last run: {timeAgo(profile.lastRunAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {/* Alert toggle */}
                    <button
                      onClick={() => toggleAlert(profile.id)}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        profile.alertEnabled
                          ? "bg-accent-light text-accent"
                          : "bg-gray-100 text-muted"
                      }`}
                      title={
                        profile.alertEnabled
                          ? "Alerts enabled"
                          : "Alerts disabled"
                      }
                    >
                      {profile.alertEnabled ? (
                        <>
                          <Bell className="h-3.5 w-3.5" />
                          Alerts On
                        </>
                      ) : (
                        <>
                          <BellOff className="h-3.5 w-3.5" />
                          Alerts Off
                        </>
                      )}
                    </button>

                    {/* Run search button */}
                    <Link
                      href={`/results?q=${encodeURIComponent(profile.rawText)}`}
                      className="flex items-center gap-1.5 rounded-full border border-border-light px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-gray-50"
                    >
                      <Search className="h-3.5 w-3.5" />
                      Run Search
                      <ChevronRight className="h-3 w-3" />
                    </Link>

                    {/* Delete */}
                    <button
                      onClick={() => removeProfile(profile.id)}
                      className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-muted opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
