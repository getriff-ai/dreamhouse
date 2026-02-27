"use client";

import { Search } from "lucide-react";
import type { SearchResult } from "@/types";
import PropertyCard from "@/components/property/PropertyCard";

interface PropertyGridProps {
  results: SearchResult[];
  onSelectProperty?: (result: SearchResult) => void;
  selectedPropertyId?: string | null;
  compact?: boolean;
}

export default function PropertyGrid({
  results,
  onSelectProperty,
  selectedPropertyId,
  compact = false,
}: PropertyGridProps) {
  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 fade-in">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-50">
          <Search className="h-5 w-5 text-neutral-400" />
        </div>
        <h3 className="mt-4 text-base font-normal text-foreground">
          No properties found
        </h3>
        <p className="mt-1.5 max-w-xs text-center text-sm font-light text-muted">
          Try adjusting your search or broadening your location.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div
        className={`grid grid-cols-1 gap-5 sm:grid-cols-2 ${
          compact ? "" : "lg:grid-cols-3"
        }`}
      >
        {results.map((result, i) => (
          <PropertyCard
            key={result.property.id}
            result={result}
            onSelect={onSelectProperty}
            isSelected={result.property.id === selectedPropertyId}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}
