import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Database, Trash2, Sparkles, AlertTriangle, Users, MapPin, Boxes } from "lucide-react";
import { seedDemoCompany, clearDemoData, isDemoLoaded, type SeedReport, type SeedOptions } from "@/lib/demo/seed-30x600";
import { toast } from "sonner";

export const Route = createFileRoute("/demo-load")({
  head: () => ({
    meta: [
      { title: "Demo Load — 30 users × 500–1,000 leads" },
      { name: "description", content: "Seed the CRM with 30 fake users across 4 zones, each carrying 500–1,000 segmented leads." },
    ],
  }),
  component: () => <AppShell><DemoLoad /></AppShell>,
});

const PRESETS: { id: string; label: string; sub: string; opts: SeedOptions; accent?: string }[] = [
  { id: "qa",     label: "QA · 50–100/user",  sub: "Fast smoke (≈2.2K leads)",  opts: { minPerUser: 50,  maxPerUser: 100 } },
  { id: "light",  label: "Light · 200–400",   sub: "Quick load (≈9K leads)",    opts: { minPerUser: 200, maxPerUser: 400 } },
  { id: "real",   label: "Real · 500–1,000",  sub: "Your spec (≈22K leads)",    opts: { minPerUser: 500, maxPerUser: 1000 }, accent: "from-success to-primary" },
  { id: "heavy",  label: "Stress · 1K–1.5K",  sub: "War-room (≈37K leads)",     opts: { minPerUser: 1000, maxPerUser: 1500 }, accent: "from-accent to-primary" },
];

function DemoLoad() {
  const [report, setReport] = useState<SeedReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState<boolean>(() => typeof window !== "undefined" && isDemoLoaded());

  const run = (opts: SeedOptions) => {
    setLoading(true);
    setTimeout(() => {
      try {
        const r = seedDemoCompany(opts);
        setReport(r);
        setLoaded(true);
        toast.success(`Seeded ${r.leads.toLocaleString()} leads · ${r.tcms} users · ${r.durationMs}ms`);
      } catch (e) {
        toast.error("Seed failed — check console");
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 30);
  };

  const clear = () => {
    clearDemoData(false);
    setReport(null);
    setLoaded(false);
    toast.success("Demo data cleared — baseline restored");
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="border-b border-border pb-3">
        <div className="text-[10px] uppercase tracking-[0.2em] text-accent font-semibold flex items-center gap-1.5">
          <Database className="h-3 w-3" /> War-room simulation
        </div>
        <h1 className="text-2xl font-display font-semibold">Demo Load · 30 users in 4 zones</h1>
        <p className="text-xs text-muted-foreground mt-1">
          4 zones (Bangalore · Pune · Hyderabad · Mumbai) · pod-roles split 4 schedulers / 2 runners / 2 closers · each user carries a randomized 500–1,000 lead pack, spread across 90 days, with matching tours, bookings, quotations and follow-ups.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <Pill icon={<Users className="h-3.5 w-3.5" />} label="Users" value="30" />
        <Pill icon={<MapPin className="h-3.5 w-3.5" />} label="Zones" value="4" />
        <Pill icon={<Boxes className="h-3.5 w-3.5" />} label="Pods" value="4 (Scheduler/Runner/Closer)" />
        <Pill icon={<Sparkles className="h-3.5 w-3.5" />} label="Spread" value="90 days · 7 stages" />
      </div>

      <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 flex gap-2 text-xs">
        <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-warning">One-tap stress test.</div>
          State lives in the browser (zustand) so this exercises the UI honestly. "Clear" wipes only demo records and restores the original baseline + pod roster.
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {PRESETS.map((p) => (
          <Button key={p.id} size="lg" variant="default" disabled={loading}
            className={`h-auto py-4 gap-2 flex-col items-start ${p.accent ? `bg-gradient-to-br ${p.accent}` : ""}`}
            onClick={() => run(p.opts)}>
            <div className="flex items-center gap-2 w-full"><Sparkles className="h-4 w-4" /><span className="font-semibold">{p.label}</span></div>
            <span className="text-[10px] opacity-80">{p.sub}</span>
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="outline" className={loaded ? "bg-success/10 text-success border-success/40" : "bg-muted text-muted-foreground"}>
          {loaded ? "Demo loaded" : "Baseline data"}
        </Badge>
        {loaded && (
          <Button size="sm" variant="outline" onClick={clear} className="gap-1.5">
            <Trash2 className="h-3.5 w-3.5" /> Clear demo
          </Button>
        )}
      </div>

      {loading && (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Seeding… large packs can take a few seconds.
        </div>
      )}

      {report && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-baseline gap-3">
            <div className="text-xl font-display font-semibold">Seed complete</div>
            <Badge variant="outline" className="text-[10px]">{report.durationMs}ms</Badge>
            <Badge variant="outline" className="text-[10px]">
              {report.perUserMin}–{report.perUserMax} / user · avg {report.perUserAvg}
            </Badge>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-center">
            <Stat label="Users" value={report.tcms} />
            <Stat label="Leads" value={report.leads} />
            <Stat label="Tours" value={report.tours} />
            <Stat label="Bookings" value={report.bookings} />
            <Stat label="Follow-ups" value={report.followUps} />
            <Stat label="Quotes" value={report.quotes} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Section title="By zone"    data={report.byZone} />
            <Section title="By pod role" data={report.byRole} />
            <Section title="By segment" data={report.bySegment} />
            <Section title="By stage"   data={report.byStage} />
          </div>

          <div className="pt-2 border-t border-border text-xs text-muted-foreground">
            Open <a className="text-primary underline" href="/impact">/impact</a>, <a className="text-primary underline" href="/admin/impact">/admin/impact</a>, <a className="text-primary underline" href="/leads">/leads</a>, <a className="text-primary underline" href="/admin">/admin</a> and <a className="text-primary underline" href="/leaderboard">/leaderboard</a> to feel the load.
          </div>
        </div>
      )}
    </div>
  );
}

function Pill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-2 flex items-center gap-2">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-xs font-semibold">{value}</div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border p-2">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-lg font-display font-semibold">{value.toLocaleString()}</div>
    </div>
  );
}

function Section({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((a, [, n]) => a + n, 0) || 1;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{title}</div>
      <div className="space-y-1">
        {entries.map(([k, v]) => {
          const pct = Math.round((v / total) * 100);
          return (
            <div key={k} className="space-y-0.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium">{k}</span>
                <span className="font-mono text-muted-foreground">{v.toLocaleString()} · {pct}%</span>
              </div>
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-accent" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
