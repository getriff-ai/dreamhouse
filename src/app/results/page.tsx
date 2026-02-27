"use client";

import { useEffect, Suspense, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Map as MapIcon, LayoutGrid, Check } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import PropertyGrid from "@/components/property/PropertyGrid";
import PropertyDetail from "@/components/property/PropertyDetail";
import MapView from "@/components/property/MapView";
import RefineInput from "@/components/search/RefineInput";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { useStore } from "@/lib/store";
import type { SearchPhase } from "@/lib/store";
import type { SearchResult, ParsedIntent } from "@/types";

const MARKET_ID = "market-seattle";

const SEARCH_PHASES: { key: SearchPhase; label: string }[] = [
  { key: "parsing", label: "Understanding your description" },
  { key: "searching", label: "Searching properties" },
  { key: "scoring", label: "Scoring and ranking matches" },
  { key: "done", label: "Done" },
];

function getPhaseIndex(phase: SearchPhase): number {
  return SEARCH_PHASES.findIndex((p) => p.key === phase);
}

async function parseIntent(query: string): Promise<ParsedIntent> {
  const res = await fetch("/api/intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: query, marketId: MARKET_ID }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to parse intent");
  }
  const data = await res.json();
  return data.intent;
}

async function searchProperties(
  intent: ParsedIntent,
  page: number = 1
): Promise<{ results: SearchResult[]; total: number; page: number; pageSize: number }> {
  const res = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent, marketId: MARKET_ID, page }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Search failed");
  }
  const data = await res.json();
  return {
    results: data.results,
    total: data.total,
    page: data.page,
    pageSize: data.pageSize,
  };
}

async function refineIntent(
  currentIntent: ParsedIntent,
  refinement: string
): Promise<ParsedIntent> {
  const res = await fetch("/api/search/refine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentIntent, refinement }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Refinement failed");
  }
  const data = await res.json();
  return data.intent;
}

function SearchProgress({ phase }: { phase: SearchPhase }) {
  const activeIndex = getPhaseIndex(phase);

  return (
    <div className="flex flex-col items-center justify-center py-24 fade-in">
      <div className="w-full max-w-xs space-y-4">
        {SEARCH_PHASES.filter((p) => p.key !== "done").map((step, i) => {
          const isActive = i === activeIndex;
          const isDone = activeIndex > i || phase === "done";
          const isPending = i > activeIndex && phase !== "done";

          return (
            <div
              key={step.key}
              className={`flex items-center gap-3 transition-all duration-500 ${
                isPending ? "opacity-25" : "opacity-100"
              }`}
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                {isDone ? (
                  <div className="step-check flex h-6 w-6 items-center justify-center rounded-full bg-foreground">
                    <Check
                      className="h-3.5 w-3.5 text-white"
                      strokeWidth={2.5}
                    />
                  </div>
                ) : isActive ? (
                  <div className="h-6 w-6 rounded-full border-2 border-foreground border-t-transparent animate-spin" />
                ) : (
                  <div className="h-6 w-6 rounded-full border border-neutral-200" />
                )}
              </div>
              <span
                className={`text-[14px] transition-all duration-300 ${
                  isActive
                    ? "font-normal text-foreground"
                    : isDone
                    ? "font-normal text-neutral-400"
                    : "font-light text-neutral-300"
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-8 text-[12px] font-light text-neutral-400">
        Powered by King County public records
      </p>
    </div>
  );
}

function ResultsContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const [showMap, setShowMap] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefining, setIsRefining] = useState(false);
  const searchTriggered = useRef(false);

  const {
    searchResults,
    selectedProperty,
    isSearching,
    currentIntent,
    searchPhase,
    totalResults,
    currentPage,
    setResults,
    appendResults,
    selectProperty,
    clearSelection,
    setSearching,
    setQuery,
    setCurrentIntent,
    setSearchPhase,
    setPage,
  } = useStore();

  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const stats = useMemo(() => {
    if (searchResults.length === 0)
      return { count: 0, total: 0, avgScore: 0, highCount: 0 };
    const count = searchResults.length;
    const avgScore = Math.round(
      searchResults.reduce((sum, r) => sum + r.matchScore, 0) / count
    );
    const highCount = searchResults.filter(
      (r) => r.transactScore === "high"
    ).length;
    return { count, total: totalResults, avgScore, highCount };
  }, [searchResults, totalResults]);

  const runSearch = useCallback(
    async (searchQuery: string) => {
      setQuery(searchQuery);
      setSearching(true);
      setSearchPhase("parsing");
      setError(null);

      try {
        const intent = await parseIntent(searchQuery);
        setCurrentIntent(intent);
        setSearchPhase("searching");

        const { results, total, page, pageSize } = await searchProperties(intent, 1);
        setSearchPhase("scoring");

        // Brief pause for the scoring animation
        await new Promise((r) => setTimeout(r, 500));
        setSearchPhase("done");

        // Brief pause to show done state
        await new Promise((r) => setTimeout(r, 400));
        setResults(results, total, page, pageSize);
        setSearchPhase(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Something went wrong"
        );
        setSearching(false);
        setSearchPhase(null);
      }
    },
    [setQuery, setSearching, setCurrentIntent, setResults, setSearchPhase]
  );

  const loadMore = useCallback(async () => {
    if (!currentIntent || isLoadingMore) return;
    const nextPage = currentPage + 1;
    setIsLoadingMore(true);
    try {
      const { results, page } = await searchProperties(currentIntent, nextPage);
      appendResults(results);
      setPage(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more");
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentIntent, currentPage, isLoadingMore, appendResults, setPage]);

  // Search on mount
  useEffect(() => {
    if (query && !searchTriggered.current && searchResults.length === 0) {
      searchTriggered.current = true;
      runSearch(query);
    }
  }, [query, searchResults.length, runSearch]);

  const handleRefine = async (refinement: string) => {
    if (!currentIntent) {
      runSearch(`${query} ${refinement}`);
      return;
    }

    setIsRefining(true);
    setSearching(true);
    setError(null);

    try {
      const updatedIntent = await refineIntent(currentIntent, refinement);
      setCurrentIntent(updatedIntent);

      const { results, total, page, pageSize } = await searchProperties(updatedIntent, 1);
      setResults(results, total, page, pageSize);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refinement failed");
      setSearching(false);
    } finally {
      setIsRefining(false);
    }
  };

  const handleSelectProperty = (result: SearchResult) => {
    selectProperty(result);
  };

  const showProgress = isSearching && !isRefining && searchPhase !== null;
  const showResults = !isSearching || isRefining;

  return (
    <div className="min-h-screen bg-[#fafafa] page-transition">
      <Header />

      <div className="mx-auto max-w-7xl px-5 py-6">
        {/* Top bar */}
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-neutral-100 hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-base font-normal text-foreground">
                Results
              </h1>
              {query && (
                <p className="line-clamp-1 text-[13px] font-light text-muted">
                  {query}
                </p>
              )}
            </div>
          </div>

          {showResults && searchResults.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowMap(!showMap)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-normal transition-all ${
                  showMap
                    ? "bg-foreground text-white"
                    : "border border-neutral-200 text-muted hover:text-foreground hover:border-neutral-300"
                }`}
              >
                {showMap ? (
                  <>
                    <LayoutGrid className="h-3.5 w-3.5" />
                    Grid
                  </>
                ) : (
                  <>
                    <MapIcon className="h-3.5 w-3.5" />
                    Map
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-5 rounded-lg border border-red-100 bg-red-50/50 px-4 py-3 text-[13px] font-light text-red-600">
            {error}
            <button
              onClick={() => {
                searchTriggered.current = false;
                runSearch(query);
              }}
              className="ml-2 font-normal underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading: show step-by-step progress */}
        {showProgress && <SearchProgress phase={searchPhase} />}

        {/* Results */}
        {showResults && searchResults.length > 0 && (
          <>
            {/* Data source + refine */}
            <p className="mb-3 text-[12px] font-light text-neutral-400">
              Showing {stats.count} of {stats.total} properties matched from King County records
            </p>
            <div className="mb-5">
              <RefineInput
                onRefine={handleRefine}
                isRefining={isSearching}
              />
            </div>

            <div
              className={`flex gap-6 transition-all duration-500 ${
                isRefining ? "shimmer-overlay" : ""
              }`}
            >
              <div className={showMap ? "flex-1 min-w-0" : "w-full"}>
                <PropertyGrid
                  results={searchResults}
                  onSelectProperty={handleSelectProperty}
                  selectedPropertyId={selectedProperty?.property.id}
                  compact={showMap}
                />
              </div>

              {showMap && (
                <div className="hidden lg:block lg:w-[40%] fade-in">
                  <div className="sticky top-20 h-[calc(100vh-120px)] overflow-hidden rounded-xl border border-neutral-200">
                    <MapView
                      results={searchResults}
                      selectedPropertyId={selectedProperty?.property.id}
                      onSelectProperty={handleSelectProperty}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Load more */}
            {searchResults.length < totalResults && (
              <div className="mt-8 flex justify-center pb-16">
                <button
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-6 py-2.5 text-[13px] font-normal text-foreground transition-all hover:border-neutral-300 hover:shadow-sm disabled:opacity-50"
                >
                  {isLoadingMore ? (
                    <>
                      <div className="h-3.5 w-3.5 rounded-full border-2 border-foreground border-t-transparent animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      Show more results ({totalResults - searchResults.length} remaining)
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}

        {/* Empty state after search completes */}
        {showResults && searchResults.length === 0 && !isSearching && !error && (
          <div className="flex flex-col items-center justify-center py-24 text-center fade-in">
            <p className="text-[15px] font-normal text-foreground">
              No matches found
            </p>
            <p className="mt-2 text-[13px] font-light text-muted">
              Try broadening your search or describing different features.
            </p>
          </div>
        )}
      </div>

      {/* Bottom stats bar */}
      {searchResults.length > 0 && !isSearching && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-100 bg-white/90 backdrop-blur-md">
          <div className="mx-auto flex h-10 max-w-7xl items-center justify-center gap-6 px-5">
            <span className="text-[12px] font-normal text-foreground">
              {stats.count} of {stats.total} matches
            </span>
            <span className="text-neutral-300">|</span>
            <span className="text-[12px] font-light text-muted">
              Avg score: {stats.avgScore}
            </span>
            <span className="text-neutral-300">|</span>
            <span className="text-[12px] font-light text-muted">
              {stats.highCount} high likelihood
            </span>
          </div>
        </div>
      )}

      {selectedProperty && (
        <PropertyDetail
          result={selectedProperty}
          onClose={clearSelection}
        />
      )}
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#fafafa]">
          <Header />
          <div className="mx-auto max-w-7xl px-5 py-6">
            <SkeletonGrid count={6} />
          </div>
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}
