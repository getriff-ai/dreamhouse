"use client";

import type { ListingStatus } from "@/types";

interface StatusPillProps {
  status: ListingStatus;
}

const config: Record<ListingStatus, { label: string; dotClass: string; textClass: string }> = {
  on_market: {
    label: "On Market",
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-700",
  },
  off_market: {
    label: "Off Market",
    dotClass: "bg-blue-500",
    textClass: "text-blue-600",
  },
  recently_sold: {
    label: "Sold",
    dotClass: "bg-neutral-400",
    textClass: "text-neutral-500",
  },
};

export default function StatusPill({ status }: StatusPillProps) {
  const { label, dotClass, textClass } = config[status];

  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-normal ${textClass}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {label}
    </span>
  );
}
