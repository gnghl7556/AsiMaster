import { cn } from "@/lib/utils/cn";

interface Props {
  lines?: number;
  className?: string;
}

export function SkeletonCard({ lines = 3, className }: Props) {
  return (
    <div className={cn("glass-card p-4 space-y-3", className)}>
      <div className="skeleton h-4 w-1/3" />
      {[...Array(lines)].map((_, i) => (
        <div
          key={i}
          className="skeleton h-3"
          style={{ width: `${80 - i * 15}%` }}
        />
      ))}
    </div>
  );
}
