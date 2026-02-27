"use client";

interface ScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

function getGradient(score: number): string {
  if (score >= 80) return "from-emerald-400 to-emerald-500";
  if (score >= 60) return "from-lime-400 to-lime-500";
  if (score >= 40) return "from-amber-400 to-amber-500";
  return "from-neutral-300 to-neutral-400";
}

const sizeClasses = {
  sm: "w-8 h-8 text-[10px]",
  md: "w-10 h-10 text-xs",
  lg: "w-12 h-12 text-sm",
};

export default function ScoreBadge({ score, size = "md" }: ScoreBadgeProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));

  return (
    <div
      className={`
        inline-flex items-center justify-center rounded-full font-medium text-white
        bg-gradient-to-br ${getGradient(clamped)} ${sizeClasses[size]}
        shadow-sm
      `}
      title={`Match score: ${clamped}/100`}
    >
      {clamped}
    </div>
  );
}
