// Floating pill showing the currently-running task timer for the active user.
// Auto-hides when nothing is in flight. Shows live pace vs personal best.
import { useEffect, useMemo, useState } from "react";
import { Timer, Rocket, AlertTriangle, Trophy } from "lucide-react";
import { useTTI, formatDuration } from "@/lib/tti/store";
import { cn } from "@/lib/utils";

export function LiveTaskTimer() {
  const active = useTTI((s) => s.active);
  const records = useTTI((s) => s.records);
  const [, force] = useState(0);

  useEffect(() => {
    if (Object.keys(active).length === 0) return;
    const i = setInterval(() => force((n) => n + 1), 500);
    return () => clearInterval(i);
  }, [active]);

  const list = Object.values(active);

  // pre-compute personal bests per type for the active user(s)
  const bestsByUserType = useMemo(() => {
    const m = new Map<string, number>();
    records.forEach((r) => {
      if (r.abandoned || !r.durationMs) return;
      const k = `${r.userKey}::${r.type}`;
      const prev = m.get(k);
      if (prev === undefined || r.durationMs < prev) m.set(k, r.durationMs);
    });
    return m;
  }, [records]);

  if (list.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-1.5 pointer-events-none">
      {list.slice(0, 3).map((t) => {
        const elapsed = Date.now() - t.startedAt;
        const best = bestsByUserType.get(`${t.userKey}::${t.type}`);
        const slow = elapsed > 60_000;
        // pace: how does elapsed compare to personal best?
        let pace: "ahead" | "near" | "behind" | null = null;
        if (best) {
          if (elapsed < best * 0.8) pace = "ahead";
          else if (elapsed < best * 1.1) pace = "near";
          else pace = "behind";
        }
        return (
          <div
            key={t.id}
            className={cn(
              "flex items-center gap-2 rounded-full pl-2.5 pr-3 py-1.5 text-xs font-medium shadow-lg border backdrop-blur",
              "bg-background/95 border-border",
              pace === "ahead" && "border-emerald-500/50 text-emerald-700",
              pace === "behind" && "border-amber-500/50 text-amber-700",
              !pace && slow && "border-amber-500/50 text-amber-700",
            )}
          >
            {pace === "ahead"
              ? <Rocket className="h-3.5 w-3.5 text-emerald-500" />
              : pace === "behind" || slow
                ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                : <Timer className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />}
            <span className="text-muted-foreground">{t.label} ·</span>
            <span className="tabular-nums font-bold">{formatDuration(elapsed)}</span>
            {best && (
              <span className="text-[10px] text-muted-foreground tabular-nums flex items-center gap-0.5">
                <Trophy className="h-2.5 w-2.5" /> {formatDuration(best)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
