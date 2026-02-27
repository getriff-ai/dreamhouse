"use client";

import { useState } from "react";
import Image from "next/image";
import { Heart, ChevronLeft, ChevronRight } from "lucide-react";
import type { SearchResult } from "@/types";
import ScoreBadge from "@/components/ui/ScoreBadge";
import TransactBadge from "@/components/ui/TransactBadge";
import StatusPill from "@/components/ui/StatusPill";

interface PropertyCardProps {
  result: SearchResult;
  onSelect?: (result: SearchResult) => void;
  isSelected?: boolean;
  index?: number;
}

function formatPrice(price: number): string {
  if (price >= 1_000_000) {
    return `$${(price / 1_000_000).toFixed(price % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  return `$${(price / 1_000).toFixed(0)}K`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

export default function PropertyCard({
  result,
  onSelect,
  isSelected = false,
  index = 0,
}: PropertyCardProps) {
  const { property, matchScore, transactScore, matchExplanation } = result;
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const [saved, setSaved] = useState(false);

  // Generate Mapbox satellite image if no photos exist
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const fallbackPhotos: string[] = [];
  if (
    property.photoUrls.length === 0 &&
    property.lat !== 0 &&
    property.lng !== 0 &&
    mapboxToken
  ) {
    // Satellite view
    fallbackPhotos.push(
      `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${property.lng},${property.lat},17,0/800x600@2x?access_token=${mapboxToken}`
    );
    // Street-level zoom for second image
    fallbackPhotos.push(
      `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${property.lng},${property.lat},19,0/800x600@2x?access_token=${mapboxToken}`
    );
  }

  const photos =
    property.photoUrls.length > 0 ? property.photoUrls : fallbackPhotos;
  const hasPhotos = photos.length > 0;

  const price = property.listingPrice ?? property.estimatedValue;
  const priceLabel = property.listingPrice ? "" : "Est. ";

  const matchedTags = matchExplanation.factors
    .filter((f) => f.matched)
    .slice(0, 3)
    .map((f) => f.name);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentPhoto((p) => (p === 0 ? photos.length - 1 : p - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentPhoto((p) => (p === photos.length - 1 ? 0 : p + 1));
  };

  return (
    <div
      className={`card-enter property-card cursor-pointer overflow-hidden rounded-2xl bg-white ${
        isSelected
          ? "ring-1 ring-foreground"
          : "border border-border-light"
      }`}
      style={{ "--delay": `${index * 60}ms` } as React.CSSProperties}
      onClick={() => onSelect?.(result)}
    >
      {/* Image Section */}
      <div className="group relative aspect-[4/3] overflow-hidden bg-neutral-50">
        {!hasPhotos ? (
          <div className="gradient-placeholder flex h-full w-full flex-col items-center justify-center gap-2 px-4">
            <span className="text-center text-xs font-light text-neutral-400 leading-relaxed">
              {property.address}
            </span>
          </div>
        ) : (
          <Image
            src={photos[currentPhoto]}
            alt={property.address}
            fill
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        )}

        {/* Carousel controls */}
        {photos.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover:opacity-100"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover:opacity-100"
              aria-label="Next photo"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>

            {/* Dots */}
            <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-1">
              {photos.slice(0, 5).map((_, i) => (
                <div
                  key={i}
                  className={`h-1 w-1 rounded-full transition-all ${
                    i === currentPhoto
                      ? "bg-white w-2"
                      : "bg-white/50"
                  }`}
                />
              ))}
            </div>
          </>
        )}

        {/* Save / Heart button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSaved(!saved);
          }}
          className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm transition-all hover:bg-white hover:scale-110"
          aria-label={saved ? "Unsave property" : "Save property"}
        >
          <Heart
            className={`h-3.5 w-3.5 transition-all duration-300 ${
              saved ? "fill-foreground text-foreground scale-110" : "text-neutral-600"
            }`}
          />
        </button>

        {/* Match score */}
        <div className="absolute left-3 top-3 z-10">
          <ScoreBadge score={matchScore} size="sm" />
        </div>
      </div>

      {/* Content */}
      <div className="space-y-2 p-4">
        {/* Address and price */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-normal text-foreground">
              {property.address}
            </h3>
            <p className="truncate text-xs font-light text-muted">
              {property.city}, {property.state} {property.zip}
            </p>
          </div>
          {price && (
            <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
              {priceLabel}{formatPrice(price)}
            </p>
          )}
        </div>

        {/* Beds / Baths / Sqft */}
        <div className="flex items-center gap-3 text-xs font-light text-muted">
          <span>{property.bedrooms} bd</span>
          <span className="text-neutral-300">|</span>
          <span>{property.bathrooms} ba</span>
          <span className="text-neutral-300">|</span>
          <span>{formatNumber(property.sqft)} sqft</span>
        </div>

        {/* Status and Transact */}
        <div className="flex items-center justify-between pt-0.5">
          <TransactBadge level={transactScore} />
          <StatusPill status={property.listingStatus} />
        </div>

        {/* Matched feature tags */}
        {matchedTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {matchedTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-light text-neutral-500"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
