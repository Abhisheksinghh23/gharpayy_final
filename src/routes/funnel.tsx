import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { useQuotations } from "@/lib/crm10x/quotations";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, BarChart3, MapPin } from "lucide-react";

export const Route = createFileRoute("/funnel")({
  head: () => ({
    meta: [
      { title: "Conversion Funnel — Per TCM & Zone" },
      { name: "description", content: "Inbox → Tour → Quote → Booked. Drop-off reasons by TCM and zone." },
    ],
  }),
  component: () => <AppShell><FunnelPage /></AppShell>,
});

type Stage = "inbox" | "tour" | "quote" | "booked";
const STAGES: { key: Stage; label: string }[] = [
  { key: "inbox",  label: "Inbox" },
  { key: "tour",   label: "Tour" },
  { key: "quote",  label: "Quote" },
  { key: "booked", label: "Booked" },
];

function FunnelPage() {
  const { leads, tours, tcms, properties } = useApp();
  const quotes = useQuotations((s) => s.quotations);

  // Per-TCM funnel
  const perTcm = useMemo(() => {
    return tcms.map((t) => {
      const myLeads = leads.filter((l) => l.assignedTcmId === t.id);
      const myTours = tours.filter((tr) => tr.tcmId === t.id);
      const myQuotes = quotes.filter((q) => q.tcmId === t.id);
      const myBooked = myLeads.filter((l) => l.stage === "booked").length;
      const totals: Record<Stage, number> = {
        inbox: myLeads.length,
        tour: myTours.length,
        quote: myQuotes.length,
        booked: myBooked,
      };
      // drop-off reasons (objections from completed tours)
      const reasons = new Map<string, number>();
      myTours.forEach((tr) => {
        const r = tr.postTour?.objection;
        if (r) reasons.set(r, (reasons.get(r) ?? 0) + 1);
      });
      const topReasons = Array.from(reasons.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
      return { tcm: t, totals, topReasons };
    });
  }, [tcms, leads, tours, quotes]);

  // Zone funnel
  const perZone = useMemo(() => {
    const map = new Map<string, Record<Stage, number>>();
    leads.forEach((l) => {
      const z = l.preferredArea || "—";
      const e = map.get(z) ?? { inbox: 0, tour: 0, quote: 0, booked: 0 };
      e.inbox++;
      if (l.stage === "booked") e.booked++;
      map.set(z, e);
    });
    tours.forEach((tr) => {
      const p = properties.find((x) => x.id === tr.propertyId);
      const z = p?.area ?? "—";
      const e = map.get(z) ?? { inbox: 0, tour: 0, quote: 0, booked: 0 };
      e.tour++;
      map.set(z, e);
    });
    quotes.forEach((q) => {
      const p = properties.find((x) => x.id === q.propertyId);
      const z = p?.area ?? "—";
      const e = map.get(z) ?? { inbox: 0, tour: 0, quote: 0, booked: 0 };
      e.quote++;
      map.set(z, e);
    });
    return Array.from(map.entries()).map(([zone, totals]) => ({ zone, totals }))
      .sort((a, b) => b.totals.inbox - a.totals.inbox);
  }, [leads, tours, quotes, properties]);

  return (
    <div className="space-y-4">
      <div className="border-b border-border pb-3">
        <div className="text-[10px] uppercase tracking-[0.2em] text-primary font-semibold flex items-center gap-1.5">
          <BarChart3 className="h-3 w-3" /> Analytics
        </div>
        <h1 className="text-2xl font-display font-semibold">Conversion Funnel</h1>
        <p className="text-xs text-muted-foreground">Inbox → Tour → Quote → Booked · with drop-off reasons by TCM and zone.</p>
      </div>

      {/* Per-TCM */}
      <section className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider font-semibold">Per TCM</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {perTcm.map(({ tcm, totals, topReasons }) => (
            <FunnelCard key={tcm.id} title={tcm.name} subtitle={`${tcm.zone} · ${Math.round((tcm.conversionRate ?? 0) * 100)}% conv`} totals={totals} reasons={topReasons} />
          ))}
        </div>
      </section>

      {/* Per zone */}
      <section className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1.5">
          <MapPin className="h-3 w-3" /> Per Zone
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {perZone.map(({ zone, totals }) => (
            <FunnelCard key={zone} title={zone} subtitle="zone" totals={totals} reasons={[]} />
          ))}
        </div>
      </section>
    </div>
  );
}

function FunnelCard({ title, subtitle, totals, reasons }: {
  title: string; subtitle: string; totals: Record<Stage, number>; reasons: Array<[string, number]>;
}) {
  const max = Math.max(1, totals.inbox);
  const conv = totals.inbox ? Math.round((totals.booked / totals.inbox) * 100) : 0;
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">{title}</div>
          <div className="text-[10px] text-muted-foreground">{subtitle}</div>
        </div>
        <Badge variant="outline" className={`text-[10px] ${conv >= 20 ? "bg-success/10 text-success border-success/40" : conv >= 10 ? "bg-warning/10 text-warning border-warning/40" : "bg-danger/10 text-danger border-danger/40"}`}>
          {conv}% end-to-end
        </Badge>
      </div>
      <div className="space-y-1">
        {STAGES.map((s, i) => {
          const v = totals[s.key];
          const pct = Math.round((v / max) * 100);
          const prev = i > 0 ? totals[STAGES[i - 1].key] : null;
          const drop = prev && prev > 0 ? Math.round(((prev - v) / prev) * 100) : 0;
          return (
            <div key={s.key} className="space-y-0.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium">{s.label}</span>
                <span className="font-mono text-muted-foreground">
                  {v}
                  {prev !== null && v < prev && (
                    <span className="ml-1.5 text-danger inline-flex items-center gap-0.5">
                      <TrendingDown className="h-2.5 w-2.5" />−{drop}%
                    </span>
                  )}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-accent transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      {reasons.length > 0 && (
        <div className="pt-1.5 border-t border-border">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">Top drop-off reasons</div>
          <div className="flex flex-wrap gap-1">
            {reasons.map(([reason, count]) => (
              <Badge key={reason} variant="outline" className="text-[10px]">
                {reason} · {count}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}