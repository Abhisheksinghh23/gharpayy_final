export const PRIORITY_TIERS = [
  { key: "now",   label: "Do now",   dot: "bg-do-now",   ring: "ring-do-now/40" },
  { key: "today", label: "Today",    dot: "bg-do-today", ring: "ring-do-today/40" },
  { key: "soon",  label: "Soon",     dot: "bg-do-soon",  ring: "ring-do-soon/40" },
  { key: "later", label: "Later",    dot: "bg-do-later", ring: "ring-do-later/40" },
  { key: "won",   label: "Won",      dot: "bg-won",      ring: "ring-won/40" },
] as const;

export function PriorityLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        Priority
      </span>
      {PRIORITY_TIERS.map((t) => (
        <span key={t.key} className="flex items-center gap-1.5 text-[11px]">
          <span className={`h-2 w-2 rounded-full ${t.dot} ring-2 ${t.ring}`} />
          <span>{t.label}</span>
        </span>
      ))}
    </div>
  );
}
