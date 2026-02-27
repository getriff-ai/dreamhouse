"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";

const suggestions = [
  "Mid-century modern in Capitol Hill under $1.2M",
  "Waterfront craftsman with views, 4 bed, Mercer Island",
  "Family home near top schools, Bellevue, under $1.5M",
  "Modern condo downtown with rooftop access",
];

export default function SearchHero() {
  const [query, setQuery] = useState("");
  const [navigating, setNavigating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const { resetSearch } = useStore();

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }
  }, []);

  const handleSearch = () => {
    const trimmed = query.trim();
    if (!trimmed || navigating) return;

    // Reset any stale search state, then navigate immediately
    resetSearch();
    setNavigating(true);
    const params = new URLSearchParams({ q: trimmed });
    router.push(`/results?${params.toString()}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    if (textareaRef.current) {
      textareaRef.current.focus();
      setTimeout(adjustHeight, 0);
    }
  };

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-10">
      {/* Heading */}
      <div className="text-center fade-in-up">
        <h1 className="text-[2.75rem] font-light leading-tight tracking-tight text-foreground sm:text-5xl">
          Describe the dream.
        </h1>
        <p className="mt-4 text-base font-light text-muted">
          AI-powered property search across 500 Seattle listings.
        </p>
      </div>

      {/* Search Area */}
      <div
        className="w-full fade-in-up"
        style={{ animationDelay: "100ms" }}
      >
        <div className="search-glow rounded-2xl border border-border-light bg-white p-1">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                adjustHeight();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Describe your buyer's dream home..."
              rows={3}
              disabled={navigating}
              className="w-full resize-none rounded-xl bg-transparent px-4 py-3.5 text-[15px] font-light text-foreground outline-none placeholder:text-neutral-400 disabled:opacity-50"
            />
          </div>

          <div className="flex items-center justify-between px-3 pb-2">
            <span className="text-[11px] font-normal tracking-wide text-neutral-400 uppercase">
              Natural language search
            </span>

            <button
              onClick={handleSearch}
              disabled={!query.trim() || navigating}
              className="flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-[13px] font-normal text-white transition-all hover:bg-accent-hover disabled:opacity-30"
            >
              {navigating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  Search
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Suggestion chips */}
      {!navigating && (
        <div
          className="flex flex-wrap justify-center gap-2 fade-in-up"
          style={{ animationDelay: "200ms" }}
        >
          {suggestions.map((suggestion, i) => (
            <button
              key={suggestion}
              onClick={() => handleSuggestionClick(suggestion)}
              className="card-enter rounded-full border border-border-light bg-white px-3.5 py-1.5 text-[13px] font-light text-muted transition-all hover:border-neutral-300 hover:text-foreground"
              style={{ "--delay": `${i * 80}ms` } as React.CSSProperties}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
