import { Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/tti/store";
import { cn } from "@/lib/utils";

export function TimerBadge({ ms, running, className }: { ms: number; running?: boolean; className?: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1 text-[10px] tabular-nums font-medium",
        running && "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 animate-pulse",
        className,
      )}
    >
      <Timer className="h-3 w-3" />
      {formatDuration(ms)}
    </Badge>
  );
}
