"use client";

import dynamic from "next/dynamic";
import type { SearchResult } from "@/types";

interface MapViewProps {
  results: SearchResult[];
  selectedPropertyId?: string | null;
  onSelectProperty?: (result: SearchResult) => void;
}

const MapViewInner = dynamic(
  () => import("@/components/property/MapViewInner"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-xl bg-gray-50">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm text-muted">Loading map...</p>
        </div>
      </div>
    ),
  }
);

export default function MapView(props: MapViewProps) {
  return <MapViewInner {...props} />;
}
