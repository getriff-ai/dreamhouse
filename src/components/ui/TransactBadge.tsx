"use client";

import type { TransactLevel } from "@/types";

interface TransactBadgeProps {
  level: TransactLevel;
}

const config: Record<TransactLevel, { label: string; dotClass: string; textClass: string }> = {
  high: {
    label: "High Likelihood",
    dotClass: "bg-violet-500",
    textClass: "text-violet-600",
  },
  medium: {
    label: "Medium Likelihood",
    dotClass: "bg-amber-500",
    textClass: "text-amber-600",
  },
  low: {
    label: "Low Likelihood",
    dotClass: "bg-neutral-400",
    textClass: "text-neutral-500",
  },
};

export default function TransactBadge({ level }: TransactBadgeProps) {
  const { label, dotClass, textClass } = config[level];

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${textClass}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {label}
    </span>
  );
}
