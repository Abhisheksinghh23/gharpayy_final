import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/lib/store";
import { usePods, type PodRole } from "@/lib/pods/store";
import { rangePresets } from "@/lib/impact/analytics";

export interface QueueFilters {
  q: string;
  rangeKey: keyof ReturnType<typeof rangePresets>;
  podId: string | "all";
  memberId: string | "all";
  podRole: PodRole | "all";
  intent: "all" | "hot" | "warm" | "cold";
}

export const DEFAULT_FILTERS: QueueFilters = {
  q: "",
  rangeKey: "month",
  podId: "all",
  memberId: "all",
  podRole: "all",
  intent: "all",
};

export function FilterBar({
  value, onChange,
}: { value: QueueFilters; onChange: (f: QueueFilters) => void }) {
  const tcms = useApp((s) => s.tcms);
  const pods = usePods((s) => s.pods);
  const ranges = rangePresets();
  const selectedPod = pods.find((p) => p.id === value.podId);
  const memberOptions = selectedPod
    ? selectedPod.members.map((m) => tcms.find((t) => t.id === m.tcmId)).filter(Boolean) as typeof tcms
    : tcms;

  const set = <K extends keyof QueueFilters>(k: K, v: QueueFilters[K]) =>
    onChange({ ...value, [k]: v });

  const activeCount = Object.entries(value).filter(([k, v]) =>
    (k === "q" && v) || (k !== "q" && v !== (DEFAULT_FILTERS as any)[k])
  ).length;

  return (
    <div className="rounded-xl border bg-card/60 backdrop-blur-sm p-2.5 flex flex-wrap items-center gap-2 sticky top-0 z-30">
      <div className="relative flex-1 min-w-[180px]">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={value.q}
          onChange={(e) => set("q", e.target.value)}
          placeholder="Search name, phone, area…"
          className="h-8 pl-7 text-xs"
        />
      </div>

      <Select label="Range" value={value.rangeKey} onChange={(v) => set("rangeKey", v as any)}
        options={Object.entries(ranges).map(([k, r]) => ({ value: k, label: r.label }))} />

      <Select label="Pod" value={value.podId} onChange={(v) => { set("podId", v as any); set("memberId", "all"); }}
        options={[{ value: "all", label: "All pods" }, ...pods.map((p) => ({ value: p.id, label: p.name }))]} />

      <Select label="Member" value={value.memberId} onChange={(v) => set("memberId", v as any)}
        options={[{ value: "all", label: "All members" }, ...memberOptions.map((t) => ({ value: t.id, label: t.name }))]} />

      <Select label="Role" value={value.podRole} onChange={(v) => set("podRole", v as any)}
        options={[
          { value: "all", label: "All roles" },
          { value: "scheduler", label: "Schedulers" },
          { value: "runner", label: "Tour Runners" },
          { value: "closer", label: "Closers" },
        ]} />

      <Select label="Intent" value={value.intent} onChange={(v) => set("intent", v as any)}
        options={[
          { value: "all", label: "All intent" },
          { value: "hot", label: "Hot" },
          { value: "warm", label: "Warm" },
          { value: "cold", label: "Cold" },
        ]} />

      {activeCount > 0 && (
        <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1" onClick={() => onChange(DEFAULT_FILTERS)}>
          <X className="h-3 w-3" /> Reset
          <Badge variant="outline" className="ml-1 h-4 px-1 text-[9px]">{activeCount}</Badge>
        </Button>
      )}
    </div>
  );
}

function Select({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 rounded-md border bg-background px-2 text-[11px] text-foreground"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
