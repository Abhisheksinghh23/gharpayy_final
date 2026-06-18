/**
 * Reusable analytics strip — KPI tiles + weekly trend chart + funnel split.
 * Drop into any dashboard / list view; respects the active GlobalFilters.
 */
import { useMemo } from "react";
import { useApp } from "@/lib/store";
import {
  useGlobalFilters, applyToLeads, applyToTours, applyToBookings,
  resolveRange,
} from "@/lib/filters/global";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  Line, LineChart,
} from "recharts";
import { TrendingUp, TrendingDown, Users, Calendar, CheckCircle2, IndianRupee, Zap, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const DAY = 86_400_000;

export interface AnalyticsStripProps {
  /** Hide individual KPIs */
  hide?: Array<"leads" | "scheduled" | "done" | "bookings" | "conversion" | "response" | "value">;
  /** Compact mode (no chart, KPIs only) */
  compact?: boolean;
  /** Override title */
  title?: string;
  className?: string;
}

export function AnalyticsStrip({ hide = [], compact, title, className }: AnalyticsStripProps) {
  const [f] = useGlobalFilters();
  const { leads, tours, bookings, tcms } = useApp();
  const tcmZone = useMemo(
    () => Object.fromEntries(tcms.map((t) => [t.id, t.zone])),
    [tcms],
  );

  const data = useMemo(() => {
    const ctx = { tcmZone };
    const ls = applyToLeads(leads, f, ctx);
    const ts = applyToTours(tours, f, ctx);
    const tsDone = ts.filter((t) => t.status === "completed");
    const bks = applyToBookings(bookings, f, ctx);
    const totalValue = bks.reduce((s, b) => s + (b.amount * 12), 0);
    const avgResponse = (() => {
      const r = ls.map((l) => l.responseSpeedMins).filter((n) => n > 0);
      if (!r.length) return 0;
      return Math.round(r.reduce((a, b) => a + b, 0) / r.length);
    })();
    return {
      leads: ls.length,
      scheduled: ts.length,
      done: tsDone.length,
      bookings: bks.length,
      conversion: ls.length ? (bks.length / ls.length) * 100 : 0,
      response: avgResponse,
      value: totalValue,
      ls, ts, bks,
    };
  }, [leads, tours, bookings, tcmZone, f]);

  // Compare vs previous period
  const prev = useMemo(() => {
    const r = resolveRange(f);
    const span = r.toMs - r.fromMs;
    if (!isFinite(span) || span <= 0) return null;
    const prevRange = { fromMs: r.fromMs - span, toMs: r.fromMs, label: "" };
    const ls = leads.filter((l) => {
      const t = +new Date(l.createdAt);
      return t >= prevRange.fromMs && t < prevRange.toMs;
    }).length;
    const bks = bookings.filter((b) => {
      const t = +new Date(b.ts);
      return t >= prevRange.fromMs && t < prevRange.toMs;
    }).length;
    return { leads: ls, bookings: bks };
  }, [leads, bookings, f]);

  // Weekly trend (last 12 weeks regardless of filter for context)
  const trend = useMemo(() => {
    const now = Date.now();
    const d = new Date(now); d.setHours(0,0,0,0);
    const dow = (d.getDay() + 6) % 7;
    const thisWeekStart = +d - dow * DAY;
    const out: Array<{ label: string; Leads: number; Tours: number; Bookings: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const start = thisWeekStart - i * 7 * DAY;
      const end = start + 7 * DAY;
      const within = (iso: string) => { const t = +new Date(iso); return t >= start && t < end; };
      const dt = new Date(start);
      out.push({
        label: `${dt.getDate()}/${dt.getMonth() + 1}`,
        Leads: data.ls.filter((l) => within(l.createdAt)).length,
        Tours: data.ts.filter((t) => within(t.createdAt)).length,
        Bookings: data.bks.filter((b) => within(b.ts)).length,
      });
    }
    return out;
  }, [data]);

  const kpis = [
    { id: "leads", label: "Leads", value: data.leads, icon: Users, accent: "text-info",
      delta: prev ? data.leads - prev.leads : null },
    { id: "scheduled", label: "Tours scheduled", value: data.scheduled, icon: Calendar, accent: "text-accent" },
    { id: "done", label: "Tours done", value: data.done, icon: CheckCircle2, accent: "text-emerald-500" },
    { id: "bookings", label: "Bookings", value: data.bookings, icon: Zap, accent: "text-success",
      delta: prev ? data.bookings - prev.bookings : null },
    { id: "conversion", label: "Conversion", value: `${data.conversion.toFixed(1)}%`, icon: TrendingUp, accent: "text-primary" },
    { id: "response", label: "Avg response", value: `${data.response}m`, icon: Clock, accent: "text-amber-500" },
    { id: "value", label: "Annualized value", value: `₹${(data.value / 100_000).toFixed(1)}L`, icon: IndianRupee, accent: "text-success" },
  ].filter((k) => !hide.includes(k.id as never));

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-display font-semibold tracking-tight">{title ?? "Performance"}</h2>
          <p className="text-[11px] text-muted-foreground">
            {resolveRange(f).label} · live, filter-aware
          </p>
        </div>
      </div>

      <div className={cn(
        "grid gap-2",
        kpis.length >= 6 ? "grid-cols-2 md:grid-cols-4 lg:grid-cols-7" : "grid-cols-2 md:grid-cols-4",
      )}>
        {kpis.map((k) => {
          const Icon = k.icon;
          const delta = k.delta;
          return (
            <Card key={k.id} className="p-2.5">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{k.label}</span>
                <Icon className={cn("h-3.5 w-3.5", k.accent)} />
              </div>
              <div className={cn("text-lg font-display font-semibold mt-0.5", k.accent)}>{k.value}</div>
              {typeof delta === "number" && (
                <div className="flex items-center gap-1 text-[10px] mt-0.5">
                  {delta >= 0 ? <TrendingUp className="h-3 w-3 text-success" /> : <TrendingDown className="h-3 w-3 text-destructive" />}
                  <span className={delta >= 0 ? "text-success" : "text-destructive"}>
                    {delta >= 0 ? "+" : ""}{delta} vs prev
                  </span>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {!compact && (
        <div className="grid md:grid-cols-3 gap-3">
          <Card className="p-3 md:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Weekly trend · 12 weeks</span>
              <Badge variant="outline" className="text-[10px]">Leads · Tours · Bookings</Badge>
            </div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="Leads" fill="hsl(var(--info))" radius={[3,3,0,0]} />
                  <Bar dataKey="Tours" fill="hsl(var(--accent))" radius={[3,3,0,0]} />
                  <Bar dataKey="Bookings" fill="hsl(var(--success))" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-3">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Funnel split</div>
            <FunnelSplit
              leads={data.leads}
              scheduled={data.scheduled}
              done={data.done}
              bookings={data.bookings}
            />
          </Card>
        </div>
      )}
    </section>
  );
}

function FunnelSplit({ leads, scheduled, done, bookings }: { leads: number; scheduled: number; done: number; bookings: number }) {
  const rows = [
    { label: "Leads", value: leads, color: "bg-info" },
    { label: "Tours scheduled", value: scheduled, color: "bg-accent" },
    { label: "Tours completed", value: done, color: "bg-emerald-500" },
    { label: "Bookings", value: bookings, color: "bg-success" },
  ];
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="font-mono font-medium">{r.value}</span>
          </div>
          <div className="h-1.5 bg-muted rounded">
            <div className={cn("h-full rounded", r.color)} style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
