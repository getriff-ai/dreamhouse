"use client";

import { useEffect, useRef, useCallback } from "react";
import { MapPin } from "lucide-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { SearchResult } from "@/types";

interface MapViewInnerProps {
  results: SearchResult[];
  selectedPropertyId?: string | null;
  onSelectProperty?: (result: SearchResult) => void;
}

function getMarkerColor(score: number): string {
  if (score >= 80) return "#00a699";
  if (score >= 60) return "#7ab800";
  if (score >= 40) return "#ffb400";
  return "#e0e0e0";
}

export default function MapViewInner({
  results,
  selectedPropertyId,
  onSelectProperty,
}: MapViewInnerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
  }, []);

  // Initialize map
  useEffect(() => {
    if (!token || !mapContainerRef.current || mapRef.current) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-122.33, 47.61], // Seattle default
      zoom: 11,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [token]);

  // Update markers when results change
  useEffect(() => {
    if (!mapRef.current) return;

    clearMarkers();

    if (results.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds();

    results.forEach((result) => {
      const { property } = result;
      const color = getMarkerColor(result.matchScore);
      const isSelected = property.id === selectedPropertyId;

      const el = document.createElement("div");
      el.style.width = isSelected ? "20px" : "14px";
      el.style.height = isSelected ? "20px" : "14px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = color;
      el.style.border = isSelected ? "3px solid #e91e63" : "2px solid white";
      el.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
      el.style.cursor = "pointer";
      el.style.transition = "all 0.2s ease";
      if (isSelected) {
        el.style.zIndex = "10";
      }

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([property.lng, property.lat])
        .addTo(mapRef.current!);

      el.addEventListener("click", () => {
        onSelectProperty?.(result);
      });

      markersRef.current.push(marker);
      bounds.extend([property.lng, property.lat]);
    });

    if (results.length > 1) {
      mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 14 });
    } else if (results.length === 1) {
      mapRef.current.flyTo({
        center: [results[0].property.lng, results[0].property.lat],
        zoom: 14,
      });
    }
  }, [results, selectedPropertyId, onSelectProperty, clearMarkers]);

  // Fly to selected property
  useEffect(() => {
    if (!mapRef.current || !selectedPropertyId) return;

    const selected = results.find((r) => r.property.id === selectedPropertyId);
    if (selected) {
      mapRef.current.flyTo({
        center: [selected.property.lng, selected.property.lat],
        zoom: 15,
        duration: 800,
      });
    }
  }, [selectedPropertyId, results]);

  if (!token) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center rounded-xl border border-dashed border-border bg-gray-50 p-8">
        <MapPin className="h-10 w-10 text-muted/40" />
        <p className="mt-3 text-sm font-medium text-muted">Map Unavailable</p>
        <p className="mt-1 text-center text-xs text-muted/70">
          Set NEXT_PUBLIC_MAPBOX_TOKEN in your environment variables to enable
          the map view.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={mapContainerRef}
      className="h-full w-full rounded-xl"
      style={{ minHeight: "400px" }}
    />
  );
}
