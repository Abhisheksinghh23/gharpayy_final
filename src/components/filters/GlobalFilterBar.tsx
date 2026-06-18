import { useMemo, useState } from "react";
import { Search, X, Filter, Calendar as CalIcon, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  type GlobalFilters, type DatePreset,
  DEFAULT_FILTERS, activeCount, useGlobalFilters,
} from "@/lib/filters/global";
import { useApp } from "@/lib/store";
import type { LeadStage, Intent } from "@/lib/types";
import { cn } from "@/lib/utils";

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "week", label: "This week" },
  { value: "last-week", label: "Last week" },
  { value: "month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "quarter", label: "This quarter" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom…" },
];

const STAGES: LeadStage[] = ["new","contacted","tour-scheduled","tour-done","negotiation","booked","dropped"];
const INTENTS: Intent[] = ["hot","warm","cold"];
const ROLES: GlobalFilters["roles"] = ["scheduler","runner","closer"];

export interface GlobalFilterBarProps {
  /** Hide fields not relevant for a given surface */
  hide?: Array<keyof GlobalFilters>;
  /** Extra trailing chips (e.g. surface-specific saved views) */
  extra?: React.ReactNode;
  className?: string;
}

export function GlobalFilterBar({ hide = [], extra, className }: GlobalFilterBarProps) {
  const [f, setF, reset] = useGlobalFilters();
  const tcms = useApp((s) => s.tcms);
  const leads = useApp((s) => s.leads);
  const properties = useApp((s) => s.properties);

  const zones = useMemo(() => Array.from(new Set(tcms.map((t) => t.zone))).sort(), [tcms]);
  const sources = useMemo(
    () => Array.from(new Set(leads.map((l) => l.source).filter(Boolean))).sort(),
    [leads],
  );

  const show = (k: keyof GlobalFilters) => !hide.includes(k);
  const count = activeCount(f);
  const presetLabel = DATE_PRESETS.find((p) => p.value === f.preset)?.label ?? "Range";

  return (
    <div className={cn(
      "rounded-xl border bg-card/70 backdrop-blur-sm p-2.5 flex flex-wrap items-center gap-2 sticky top-0 z-30",
      className,
    )}>
      <Filter className="h-3.5 w-3.5 text-muted-foreground ml-1" />

      {show("q") && (
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })}
            placeholder="Search…" className="h-8 pl-7 text-xs"
          />
        </div>
      )}

      {show("preset") && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1 text-[11px]">
              <CalIcon className="h-3 w-3" /> {presetLabel}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-1.5" align="start">
            <div className="grid grid-cols-2 gap-1">
              {DATE_PRESETS.map((p) => (
                <button key={p.value}
                  onClick={() => setF({ ...f, preset: p.value })}
                  className={cn(
                    "text-[11px] px-2 py-1.5 rounded-md text-left hover:bg-accent transition",
                    f.preset === p.value && "bg-accent font-medium",
                  )}>{p.label}</button>
              ))}
            </div>
            {f.preset === "custom" && (
              <div className="mt-2 grid grid-cols-2 gap-1.5 border-t pt-2">
                <label className="text-[10px] text-muted-foreground">
                  From
                  <Input type="date" className="h-7 text-[11px] mt-0.5"
                    value={f.fromMs ? new Date(f.fromMs).toISOString().slice(0,10) : ""}
                    onChange={(e) => setF({ ...f, fromMs: e.target.value ? +new Date(e.target.value) : null })} />
                </label>
                <label className="text-[10px] text-muted-foreground">
                  To
                  <Input type="date" className="h-7 text-[11px] mt-0.5"
                    value={f.toMs ? new Date(f.toMs).toISOString().slice(0,10) : ""}
                    onChange={(e) => setF({ ...f, toMs: e.target.value ? +new Date(e.target.value) : null })} />
                </label>
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}

      {show("zones") && (
        <MultiPicker label="Zone" selected={f.zones}
          options={zones.map((z) => ({ value: z, label: z }))}
          onChange={(v) => setF({ ...f, zones: v })} />
      )}

      {show("memberIds") && (
        <MultiPicker label="Member" selected={f.memberIds}
          options={tcms.map((t) => ({ value: t.id, label: `${t.name} · ${t.zone}` }))}
          onChange={(v) => setF({ ...f, memberIds: v })} />
      )}

      {show("roles") && (
        <MultiPicker label="Role" selected={f.roles}
          options={ROLES.map((r) => ({ value: r, label: r[0].toUpperCase() + r.slice(1) }))}
          onChange={(v) => setF({ ...f, roles: v as GlobalFilters["roles"] })} />
      )}

      {show("stages") && (
        <MultiPicker label="Stage" selected={f.stages}
          options={STAGES.map((s) => ({ value: s, label: s.replace("-", " ") }))}
          onChange={(v) => setF({ ...f, stages: v as LeadStage[] })} />
      )}

      {show("intents") && (
        <MultiPicker label="Intent" selected={f.intents}
          options={INTENTS.map((i) => ({ value: i, label: i }))}
          onChange={(v) => setF({ ...f, intents: v as Intent[] })} />
      )}

      {show("sources") && (
        <MultiPicker label="Source" selected={f.sources}
          options={sources.map((s) => ({ value: s, label: s }))}
          onChange={(v) => setF({ ...f, sources: v })} />
      )}

      {show("propertyIds") && (
        <MultiPicker label="Property" selected={f.propertyIds}
          options={properties.map((p) => ({ value: p.id, label: p.name }))}
          onChange={(v) => setF({ ...f, propertyIds: v })} />
      )}

      {extra}

      {count > 0 && (
        <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 ml-auto" onClick={reset}>
          <X className="h-3 w-3" /> Reset
          <Badge variant="outline" className="ml-1 h-4 px-1 text-[9px]">{count}</Badge>
        </Button>
      )}
    </div>
  );
}

function MultiPicker({
  label, selected, options, onChange,
}: {
  label: string;
  selected: string[];
  options: { value: string; label: string }[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const list = q ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : options;
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1 text-[11px]">
          {label}
          {selected.length > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[9px]">{selected.length}</Badge>
          )}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <Input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${label.toLowerCase()}…`} className="h-7 text-[11px] mb-1.5" />
        <ScrollArea className="max-h-56 pr-2">
          <div className="space-y-0.5">
            {list.map((o) => (
              <label key={o.value}
                className="flex items-center gap-2 text-[11px] px-1.5 py-1 rounded hover:bg-accent cursor-pointer">
                <Checkbox checked={selected.includes(o.value)} onCheckedChange={() => toggle(o.value)} />
                <span className="truncate capitalize">{o.label}</span>
              </label>
            ))}
            {list.length === 0 && (
              <div className="text-[11px] text-muted-foreground py-2 text-center">No matches.</div>
            )}
          </div>
        </ScrollArea>
        {selected.length > 0 && (
          <Button variant="ghost" size="sm" className="h-6 text-[10px] w-full mt-1" onClick={() => onChange([])}>
            Clear {label.toLowerCase()}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export { DEFAULT_FILTERS };
