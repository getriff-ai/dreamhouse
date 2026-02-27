"use client";

import { useEffect, useCallback, useState } from "react";
import Image from "next/image";
import {
  X,
  Heart,
  ExternalLink,
  MapPin,
  Home,
} from "lucide-react";
import type { SearchResult } from "@/types";
import ScoreBadge from "@/components/ui/ScoreBadge";
import TransactBadge from "@/components/ui/TransactBadge";
import StatusPill from "@/components/ui/StatusPill";

interface PropertyDetailProps {
  result: SearchResult;
  onClose: () => void;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

export default function PropertyDetail({
  result,
  onClose,
}: PropertyDetailProps) {
  const { property, matchScore, transactScore, matchExplanation } = result;
  const [closing, setClosing] = useState(false);
  const [saved, setSaved] = useState(false);

  const price = property.listingPrice ?? property.estimatedValue;
  const priceLabel = property.listingPrice ? "" : "Estimated ";

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 250);
  }, [onClose]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    },
    [handleClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  const zillowUrl = `https://www.zillow.com/homes/${encodeURIComponent(
    `${property.address} ${property.city} ${property.state} ${property.zip}`
  )}`;
  const redfinUrl = `https://www.redfin.com/search#query=${encodeURIComponent(
    `${property.address} ${property.city} ${property.state}`
  )}`;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] ${
          closing ? "opacity-0" : "backdrop-enter"
        } transition-opacity duration-200`}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-white shadow-2xl sm:w-[520px] ${
          closing ? "slide-out-right" : "slide-in-right"
        }`}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition-colors hover:bg-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Photo Gallery */}
          <div className="relative aspect-[16/10] w-full bg-neutral-50">
            {(() => {
              const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
              const photos = property.photoUrls.length > 0
                ? property.photoUrls
                : (property.lat !== 0 && property.lng !== 0 && mapboxToken)
                  ? [`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${property.lng},${property.lat},17,0/800x600@2x?access_token=${mapboxToken}`]
                  : [];

              return photos.length > 0 ? (
                <Image
                  src={photos[0]}
                  alt={property.address}
                  fill
                  className="object-cover"
                  sizes="520px"
                />
              ) : (
                <div className="gradient-placeholder flex h-full w-full flex-col items-center justify-center gap-2">
                  <Home className="h-8 w-8 text-neutral-300" />
                  <span className="text-xs font-light text-neutral-400">
                    {property.address}
                  </span>
                </div>
              );
            })()}

            {/* Photo thumbnails */}
            {property.photoUrls.length > 1 && (
              <div className="absolute bottom-3 left-3 right-3 flex gap-1.5 overflow-x-auto">
                {property.photoUrls.slice(0, 6).map((url, i) => (
                  <div
                    key={i}
                    className="relative h-10 w-14 shrink-0 overflow-hidden rounded-lg border-2 border-white/60"
                  >
                    <Image
                      src={url}
                      alt={`Photo ${i + 1}`}
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  </div>
                ))}
                {property.photoUrls.length > 6 && (
                  <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg bg-black/40 text-[10px] font-normal text-white">
                    +{property.photoUrls.length - 6}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-6 p-6">
            {/* Header */}
            <div className="fade-in-up">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-normal text-foreground">
                    {property.address}
                  </h2>
                  <p className="mt-0.5 flex items-center gap-1 text-sm font-light text-muted">
                    <MapPin className="h-3 w-3" />
                    {property.city}, {property.state} {property.zip}
                  </p>
                </div>
                <StatusPill status={property.listingStatus} />
              </div>

              {price && (
                <p className="mt-3 text-2xl font-medium tabular-nums text-foreground">
                  {priceLabel}{formatPrice(price)}
                </p>
              )}

              {/* Quick stats - two-column grid */}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <StatBox label="Bedrooms" value={`${property.bedrooms}`} />
                <StatBox label="Bathrooms" value={`${property.bathrooms}`} />
                <StatBox label="Square Feet" value={formatNumber(property.sqft)} />
                {property.yearBuilt ? (
                  <StatBox label="Year Built" value={`${property.yearBuilt}`} />
                ) : (
                  <StatBox label="Lot" value={property.lotSqft ? `${formatNumber(property.lotSqft)} sqft` : "--"} />
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-neutral-100" />

            {/* Scores */}
            <div className="flex items-center gap-6 fade-in-up" style={{ animationDelay: "50ms" }}>
              <div className="flex items-center gap-3">
                <ScoreBadge score={matchScore} size="lg" />
                <div>
                  <p className="text-sm font-normal text-foreground">
                    Match Score
                  </p>
                  <p className="text-xs font-light text-muted">How well it fits</p>
                </div>
              </div>
              <div>
                <p className="mb-1 text-sm font-normal text-foreground">
                  Transaction
                </p>
                <TransactBadge level={transactScore} />
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-neutral-100" />

            {/* Match Explanation with progress bars */}
            <div className="fade-in-up" style={{ animationDelay: "100ms" }}>
              <h3 className="mb-2 text-sm font-medium text-foreground">
                Match Analysis
              </h3>
              <p className="mb-4 text-[13px] font-light leading-relaxed text-muted">
                {matchExplanation.overallReason}
              </p>

              <div className="space-y-3">
                {matchExplanation.factors.map((factor, i) => (
                  <div key={factor.name}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-normal text-foreground">
                        {factor.name}
                      </span>
                      <span className="text-[11px] font-normal tabular-nums text-muted">
                        {factor.score}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className={`progress-fill h-full rounded-full ${
                          factor.score >= 80
                            ? "bg-emerald-400"
                            : factor.score >= 50
                            ? "bg-amber-400"
                            : "bg-neutral-300"
                        }`}
                        style={
                          {
                            "--progress": `${factor.score}%`,
                            animationDelay: `${i * 100 + 200}ms`,
                          } as React.CSSProperties
                        }
                      />
                    </div>
                    <p className="mt-0.5 text-[11px] font-light text-neutral-400">
                      {factor.reason}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-neutral-100" />

            {/* Property Details - two column grid */}
            <div className="fade-in-up" style={{ animationDelay: "150ms" }}>
              <h3 className="mb-3 text-sm font-medium text-foreground">
                Details
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <DetailRow
                  label="Type"
                  value={property.propertyType.replace("_", " ")}
                />
                {property.architecturalStyle && (
                  <DetailRow
                    label="Style"
                    value={property.architecturalStyle}
                  />
                )}
                {property.lotSqft && (
                  <DetailRow
                    label="Lot Size"
                    value={`${formatNumber(property.lotSqft)} sqft`}
                  />
                )}
                {property.lastSaleDate && (
                  <DetailRow
                    label="Last Sold"
                    value={`${new Date(property.lastSaleDate).toLocaleDateString()}${
                      property.lastSalePrice
                        ? ` (${formatPrice(property.lastSalePrice)})`
                        : ""
                    }`}
                  />
                )}
                {property.mlsNumber && (
                  <DetailRow label="MLS" value={property.mlsNumber} />
                )}
                {property.ownershipYears != null && (
                  <DetailRow
                    label="Owner Tenure"
                    value={`${property.ownershipYears} years`}
                  />
                )}
                <DetailRow
                  label="Absentee Owner"
                  value={property.absenteeOwner ? "Yes" : "No"}
                />
              </div>
            </div>

            {/* Features */}
            {property.features.length > 0 && (
              <>
                <div className="h-px bg-neutral-100" />
                <div className="fade-in-up" style={{ animationDelay: "200ms" }}>
                  <h3 className="mb-3 text-sm font-medium text-foreground">
                    Features
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {property.features.map((feature) => (
                      <span
                        key={feature}
                        className="rounded-full bg-neutral-100 px-2.5 py-1 text-[12px] font-light text-neutral-500"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Outbound Links */}
            <div className="h-px bg-neutral-100" />
            <div className="flex gap-3">
              <a
                href={zillowUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3.5 py-2 text-[13px] font-normal text-foreground transition-colors hover:bg-neutral-50"
              >
                Zillow
                <ExternalLink className="h-3 w-3 text-muted" />
              </a>
              <a
                href={redfinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3.5 py-2 text-[13px] font-normal text-foreground transition-colors hover:bg-neutral-50"
              >
                Redfin
                <ExternalLink className="h-3 w-3 text-muted" />
              </a>
            </div>
          </div>
        </div>

        {/* Sticky bottom bar */}
        <div className="flex items-center justify-between border-t border-neutral-100 bg-white px-6 py-4">
          <div>
            {price && (
              <p className="text-base font-medium tabular-nums text-foreground">
                {formatPrice(price)}
              </p>
            )}
            <p className="text-[11px] font-light text-muted">
              Match: {matchScore}/100
            </p>
          </div>
          <button
            onClick={() => setSaved(!saved)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-normal transition-all ${
              saved
                ? "bg-foreground text-white"
                : "border border-neutral-200 text-foreground hover:bg-neutral-50"
            }`}
          >
            <Heart
              className={`h-3.5 w-3.5 transition-all ${
                saved ? "fill-white" : ""
              }`}
            />
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-neutral-50 px-3 py-2.5">
      <p className="text-[11px] font-light uppercase tracking-wide text-neutral-400">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-light text-muted">{label}</p>
      <p className="text-sm font-normal capitalize text-foreground">{value}</p>
    </div>
  );
}
