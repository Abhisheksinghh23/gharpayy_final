import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { useQuotations } from "@/lib/crm10x/quotations";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle, Calendar, FileText, Flame, Shield, Target, TrendingUp, Users, Zap } from "lucide-react";

export const Route = createFileRoute("/war-room")({
  head: () => ({
    meta: [
      { title: "War Room — Manager Command" },
      { name: "description", content: "One screen: queue health, SLA breaches, TCM load, today's forecast, escalation ladder." },
    ],
  }),
  component: () => <AppShell><WarRoom /></AppShell>,
});

function isToday(iso: string) { return new Date(iso).toDateString() === new Date().toDateString(); }
function isThisMonth(iso: string) {
  const d = new Date(iso); const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
}

function WarRoom() {
  const { leads, tours, tcms, bookings, properties } = useApp();
  const quotes = useQuotations((s) => s.quotations);

  const stats = useMemo(() => {
    const toursToday = tours.filter((t) => isToday(t.scheduledAt));
    const overdueTours = tours.filter(
      (t) => t.status === "scheduled" && +new Date(t.scheduledAt) + 30 * 60_000 < Date.now(),
    );
    const staleQuotes = quotes.filter((q) => Date.now() - +new Date(q.sentAt) > 24 * 3600_000);
    const draftsOpen = tours.filter((t) => t.status === "completed" && !t.postTour?.filledAt);
    const hotLeads = leads.filter((l) => l.intent === "hot" && l.stage !== "booked" && l.stage !== "dropped");
    const bookingsMonth = bookings.filter((b) => isThisMonth(b.ts));
    const forecast = Math.round(hotLeads.length * 0.35 + toursToday.length * 0.18);
    return { toursToday, overdueTours, staleQuotes, draftsOpen, hotLeads, bookingsMonth, forecast };
  }, [leads, tours, quotes, bookings]);

  // TCM load
  const tcmLoad = useMemo(() => {
    return tcms.map((t) => {
      const myLeads = leads.filter((l) => l.assignedTcmId === t.id && l.stage !== "booked" && l.stage !== "dropped");
      const myToursToday = stats.toursToday.filter((tr) => tr.tcmId === t.id);
      const myOverdue = stats.overdueTours.filter((tr) => tr.tcmId === t.id).length
        + stats.staleQuotes.filter((q) => q.tcmId === t.id).length;
      return { tcm: t, openLeads: myLeads.length, toursToday: myToursToday.length, overdue: myOverdue };
    }).sort((a, b) => b.overdue - a.overdue || b.openLeads - a.openLeads);
  }, [tcms, leads, stats]);

  // Escalation ladder: stalled leads + reasons
  const escalations = useMemo(() => {
    const list: Array<{ id: string; name: string; reason: string; tcm?: string; severity: "high" | "med" }> = [];
    stats.overdueTours.forEach((t) => {
      const l = leads.find((x) => x.id === t.leadId);
      const tcm = tcms.find((x) => x.id === t.tcmId)?.name;
      if (l) list.push({ id: `tour-${t.id}`, name: l.name, reason: "Tour overdue · no outcome", tcm, severity: "high" });
    });
    stats.staleQuotes.forEach((q) => {
      const l = leads.find((x) => x.id === q.leadId);
      const tcm = tcms.find((x) => x.id === q.tcmId)?.name;
      if (l) list.push({ id: `quote-${q.id}`, name: l.name, reason: "Quote stale > 24h", tcm, severity: "med" });
    });
    stats.draftsOpen.forEach((t) => {
      const l = leads.find((x) => x.id === t.leadId);
      const tcm = tcms.find((x) => x.id === t.tcmId)?.name;
      if (l) list.push({ id: `draft-${t.id}`, name: l.name, reason: "Post-tour draft unfilled", tcm, severity: "high" });
    });
    return list.slice(0, 20);
  }, [stats, leads, tcms]);

  // Zone heatmap
  const zoneMap = useMemo(() => {
    const map = new Map<string, { open: number; tours: number; quotes: number; booked: number }>();
    leads.forEach((l) => {
      const z = l.preferredArea || "—";
      const e = map.get(z) ?? { open: 0, tours: 0, quotes: 0, booked: 0 };
      if (l.stage !== "booked" && l.stage !== "dropped") e.open++;
      if (l.stage === "booked") e.booked++;
      map.set(z, e);
    });
    tours.forEach((t) => {
      const p = properties.find((x) => x.id === t.propertyId);
      const z = p?.area ?? "—";
      const e = map.get(z) ?? { open: 0, tours: 0, quotes: 0, booked: 0 };
      e.tours++;
      map.set(z, e);
    });
    quotes.forEach((q) => {
      const p = properties.find((x) => x.id === q.propertyId);
      const z = p?.area ?? "—";
      const e = map.get(z) ?? { open: 0, tours: 0, quotes: 0, booked: 0 };
      e.quotes++;
      map.set(z, e);
    });
    return Array.from(map.entries()).map(([zone, v]) => ({ zone, ...v }))
      .sort((a, b) => b.open - a.open).slice(0, 10);
  }, [leads, tours, quotes, properties]);

  const maxOpen = Math.max(1, ...zoneMap.map((z) => z.open));

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between border-b border-border pb-3 flex-wrap gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-danger font-semibold flex items-center gap-1.5">
            <Shield className="h-3 w-3" /> Manager · war room
          </div>
          <h1 className="text-2xl font-display font-semibold">Morning Command</h1>
          <p className="text-xs text-muted-foreground">Queue health · SLA breaches · TCM load · today's forecast · escalation ladder.</p>
        </div>
        <div className="flex gap-2">
          <KPI icon={Calendar} label="Tours today" value={stats.toursToday.length} tone="primary" />
          <KPI icon={FileText} label="Stale quotes" value={stats.staleQuotes.length} tone={stats.staleQuotes.length ? "danger" : "muted"} />
          <KPI icon={AlertTriangle} label="Overdue" value={stats.overdueTours.length + stats.draftsOpen.length} tone={stats.overdueTours.length + stats.draftsOpen.length ? "danger" : "muted"} />
          <KPI icon={Flame} label="Hot leads" value={stats.hotLeads.length} tone="warning" />
          <KPI icon={Target} label="Forecast" value={stats.forecast} tone="success" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* TCM load */}
        <div className="rounded-lg border border-border bg-card p-3 lg:col-span-1">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-3.5 w-3.5 text-primary" />
            <div className="text-[10px] uppercase tracking-wider font-semibold">TCM Load</div>
          </div>
          <div className="space-y-1.5">
            {tcmLoad.length === 0 && <p className="text-xs text-muted-foreground italic">No TCMs.</p>}
            {tcmLoad.map(({ tcm, openLeads, toursToday, overdue }) => (
              <div key={tcm.id} className="rounded-md border border-border p-2 hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{tcm.name}</span>
                  {overdue > 0 && (
                    <Badge variant="outline" className="text-[9px] bg-danger/10 text-danger border-danger/40">
                      {overdue} breach
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
                  <span><strong className="text-foreground">{openLeads}</strong> open</span>
                  <span><strong className="text-foreground">{toursToday}</strong> tours</span>
                  <span className="ml-auto font-mono">{Math.round((tcm.conversionRate ?? 0) * 100)}% conv</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Escalation ladder */}
        <div className="rounded-lg border border-danger/30 bg-gradient-to-br from-danger/5 to-card p-3 lg:col-span-1">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-3.5 w-3.5 text-danger" />
            <div className="text-[10px] uppercase tracking-wider font-semibold text-danger">Escalation Ladder</div>
            <Badge variant="outline" className="ml-auto text-[9px] bg-danger/10 text-danger border-danger/40">{escalations.length}</Badge>
          </div>
          <div className="space-y-1.5 max-h-[440px] overflow-y-auto">
            {escalations.length === 0 && <p className="text-xs text-success italic">All clear. Nothing escalating.</p>}
            {escalations.map((e) => (
              <div key={e.id} className={`rounded-md border p-2 text-xs ${e.severity === "high" ? "border-danger/40 bg-danger/5" : "border-warning/40 bg-warning/5"}`}>
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`h-3 w-3 ${e.severity === "high" ? "text-danger" : "text-warning"}`} />
                  <span className="font-medium truncate flex-1">{e.name}</span>
                  {e.tcm && <Badge variant="outline" className="text-[9px]">{e.tcm}</Badge>}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 pl-5">{e.reason}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Zone heatmap */}
        <div className="rounded-lg border border-border bg-card p-3 lg:col-span-1">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-3.5 w-3.5 text-accent" />
            <div className="text-[10px] uppercase tracking-wider font-semibold">Zone Heatmap</div>
          </div>
          <div className="space-y-1.5">
            {zoneMap.length === 0 && <p className="text-xs text-muted-foreground italic">No zone activity.</p>}
            {zoneMap.map((z) => {
              const pct = Math.round((z.open / maxOpen) * 100);
              return (
                <div key={z.zone} className="space-y-0.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium truncate">{z.zone}</span>
                    <span className="font-mono text-muted-foreground">
                      {z.open}o · {z.tours}t · {z.quotes}q · <span className="text-success">{z.booked}b</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-accent to-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value, tone }: { icon: typeof Calendar; label: string; value: number; tone: "primary" | "danger" | "warning" | "success" | "muted" }) {
  const cls = {
    primary: "bg-primary/10 text-primary border-primary/30",
    danger: "bg-danger/10 text-danger border-danger/30",
    warning: "bg-warning/10 text-warning border-warning/30",
    success: "bg-success/10 text-success border-success/30",
    muted: "bg-muted text-muted-foreground border-border",
  }[tone];
  return (
    <div className={`rounded-md border px-2.5 py-1.5 flex items-center gap-2 ${cls}`}>
      <Icon className="h-3.5 w-3.5" />
      <div>
        <div className="text-[9px] uppercase tracking-wider font-semibold opacity-80">{label}</div>
        <div className="text-base font-display font-semibold leading-none">{value}</div>
      </div>
    </div>
  );
}