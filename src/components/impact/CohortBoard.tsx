import { useMemo } from "react";
import { useApp } from "@/lib/store";
import { useSelection } from "@/lib/impact/selection";
import { usePods } from "@/lib/pods/store";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { classify, classifyAll, COHORT_META, COHORT_ORDER, daysInStage, isStuck, type Cohort } from "@/lib/impact/cohorts";
import { rangePresets, inRange } from "@/lib/impact/analytics";
import type { QueueFilters } from "./FilterBar";
import { AlertTriangle, Clock, Phone } from "lucide-react";
import { useState } from "react";

export function CohortBoard({ filters }: { filters: QueueFilters }) {
  const leads = useApp((s) => s.leads);
  const tcms = useApp((s) => s.tcms);
  const pods = usePods((s) => s.pods);
  const [tab, setTab] = useState<Cohort>("active");
  const ranges = rangePresets();

  const filtered = useMemo(() => {
    const r = ranges[filters.rangeKey];
    const podMemberIds = filters.podId !== "all"
      ? pods.find((p) => p.id === filters.podId)?.members.map((m) => m.tcmId) ?? []
      : null;
    return leads.filter((l) => {
      if (!inRange(l.updatedAt, r)) return false;
      if (filters.q) {
        const q = filters.q.toLowerCase();
        if (![l.name, l.phone, l.preferredArea].some((s) => s?.toLowerCase().includes(q))) return false;
      }
      if (filters.intent !== "all" && l.intent !== filters.intent) return false;
      if (filters.memberId !== "all" && l.assignedTcmId !== filters.memberId) return false;
      if (podMemberIds && !podMemberIds.includes(l.assignedTcmId)) return false;
      if (filters.podRole !== "all") {
        const memberRole = pods.flatMap((p) => p.members).find((m) => m.tcmId === l.assignedTcmId)?.podRole;
        if (memberRole !== filters.podRole) return false;
      }
      return true;
    });
  }, [leads, pods, filters, ranges]);

  const byCohort = useMemo(() => classifyAll(filtered), [filtered]);
  const stuckCount = useMemo(() => filtered.filter(isStuck).length, [filtered]);

  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={(v) => setTab(v as Cohort)}>
        <TabsList className="h-9 flex-wrap gap-1">
          {COHORT_ORDER.map((c) => {
            const m = COHORT_META[c];
            const count = byCohort[c].length;
            return (
              <TabsTrigger key={c} value={c} className="text-xs gap-1.5">
                <span>{m.icon}</span> {m.label}
                <Badge variant="outline" className="ml-1 h-4 px-1 text-[9px]">{count}</Badge>
              </TabsTrigger>
            );
          })}
          {stuckCount > 0 && (
            <Badge variant="outline" className="ml-2 h-6 px-2 gap-1 bg-danger/15 text-danger border-danger/40">
              <AlertTriangle className="h-3 w-3" /> {stuckCount} stuck &gt; 5d
            </Badge>
          )}
        </TabsList>
        {COHORT_ORDER.map((c) => (
          <TabsContent key={c} value={c} className="mt-3">
            <CohortList cohort={c} leads={byCohort[c]} tcms={tcms} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function CohortList({ cohort, leads, tcms }: { cohort: Cohort; leads: ReturnType<typeof useApp.getState>["leads"]; tcms: ReturnType<typeof useApp.getState>["tcms"] }) {
  const setMany = useSelection((s) => s.setMany);
  const toggle = useSelection((s) => s.toggle);
  const selectedIds = useSelection((s) => s.ids);
  const meta = COHORT_META[cohort];

  if (!leads.length) {
    return (
      <div className="rounded-xl border border-dashed bg-card/40 p-8 text-center text-sm text-muted-foreground">
        <div className="text-2xl mb-1">{meta.icon}</div>
        No leads in {meta.label}. {cohort === "awaiting" ? "You're caught up — go close some warm ones." : ""}
      </div>
    );
  }

  const ids = leads.map((l) => l.id);
  const allChecked = ids.every((id) => selectedIds.has(id));

  return (
    <div className="rounded-xl border bg-card/40 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30 text-[11px] text-muted-foreground">
        <Checkbox
          checked={allChecked}
          onCheckedChange={(v) => setMany(ids, Boolean(v))}
          aria-label="Select all in cohort"
        />
        <span>{leads.length} lead{leads.length === 1 ? "" : "s"} · {meta.label}</span>
      </div>
      <div className="divide-y max-h-[60vh] overflow-y-auto">
        {leads.map((l) => {
          const tcm = tcms.find((t) => t.id === l.assignedTcmId);
          const dis = daysInStage(l);
          const stuck = isStuck(l);
          return (
            <div key={l.id} className="flex items-center gap-3 px-3 py-2 hover:bg-accent/40 transition-colors">
              <Checkbox checked={selectedIds.has(l.id)} onCheckedChange={() => toggle(l.id)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground truncate">{l.name}</span>
                  <Badge variant="outline" className="text-[9px] capitalize">{l.intent}</Badge>
                  <Badge variant="outline" className="text-[9px] capitalize">{l.stage.replace("-", " ")}</Badge>
                  {stuck && (
                    <Badge variant="outline" className="text-[9px] bg-danger/15 text-danger border-danger/40 gap-1">
                      <AlertTriangle className="h-2.5 w-2.5" /> stuck {dis}d
                    </Badge>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span className="flex items-center gap-1"><Phone className="h-2.5 w-2.5" />{l.phone}</span>
                  <span>· {l.preferredArea}</span>
                  <span>· ₹{l.budget.toLocaleString("en-IN")}</span>
                  <span>· {tcm?.name ?? "—"}</span>
                  <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> {dis}d ago</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
