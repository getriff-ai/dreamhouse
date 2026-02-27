"use client";

import { useState } from "react";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";

interface RefineInputProps {
  onRefine: (text: string) => void;
  isRefining?: boolean;
}

export default function RefineInput({
  onRefine,
  isRefining = false,
}: RefineInputProps) {
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || isRefining) return;
    onRefine(trimmed);
    setText("");
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div
        className={`flex items-center gap-3 rounded-xl border bg-white px-4 py-3 transition-all duration-300 ${
          isRefining
            ? "border-neutral-200 opacity-80"
            : "border-border-light hover:border-neutral-300 focus-within:border-neutral-300 focus-within:shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
        }`}
      >
        <Sparkles className="h-4 w-4 shrink-0 text-neutral-400" />
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Refine your search... more modern, bigger backyard, closer to lake"
          disabled={isRefining}
          className="flex-1 bg-transparent text-[13px] font-light text-foreground outline-none placeholder:text-neutral-400 disabled:opacity-50"
        />
        {isRefining ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted" />
        ) : (
          <button
            type="submit"
            disabled={!text.trim()}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-neutral-100 hover:text-foreground disabled:opacity-0"
            aria-label="Refine search"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </form>
  );
}
