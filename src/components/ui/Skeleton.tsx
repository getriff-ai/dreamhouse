"use client";

export function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl bg-white">
      {/* Image placeholder */}
      <div className="skeleton aspect-[4/3] w-full rounded-none" />
      {/* Content */}
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-3 w-1/2" />
          </div>
          <div className="skeleton h-5 w-16" />
        </div>
        <div className="flex items-center gap-4">
          <div className="skeleton h-3 w-14" />
          <div className="skeleton h-3 w-14" />
          <div className="skeleton h-3 w-16" />
        </div>
        <div className="skeleton h-3 w-28" />
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonPropertyDetail() {
  return (
    <div className="flex h-full flex-col">
      {/* Photo placeholder */}
      <div className="skeleton aspect-[16/10] w-full rounded-none" />

      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="space-y-3">
          <div className="skeleton h-5 w-3/4" />
          <div className="skeleton h-3 w-1/2" />
          <div className="skeleton h-7 w-32" />
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4">
          <div className="skeleton h-4 w-20" />
          <div className="skeleton h-4 w-20" />
          <div className="skeleton h-4 w-24" />
        </div>

        {/* Divider */}
        <div className="skeleton h-px w-full" />

        {/* Scores */}
        <div className="flex items-center gap-6">
          <div className="skeleton h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <div className="skeleton h-4 w-20" />
            <div className="skeleton h-3 w-24" />
          </div>
        </div>

        {/* Divider */}
        <div className="skeleton h-px w-full" />

        {/* Match factors */}
        <div className="space-y-3">
          <div className="skeleton h-4 w-40" />
          <div className="skeleton h-3 w-full" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="skeleton h-3 w-24 shrink-0" />
                <div className="skeleton h-2 flex-1 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Details grid */}
        <div className="skeleton h-px w-full" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="skeleton h-3 w-16" />
              <div className="skeleton h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
