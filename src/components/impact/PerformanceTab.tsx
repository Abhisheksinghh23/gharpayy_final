import { useMemo } from "react";
import { useApp } from "@/lib/store";
import { usePods } from "@/lib/pods/store";
import { Badge } from "@/components/ui/badge";
import {
  MONTHLY_TARGET, monthFraction, paceColor, paceFor, weeklyBuckets,
  lossReasons, leaderboard, stuckHeatmap, STUCK_STAGES, STUCK_BUCKETS,
  rangePresets,
} from "@/lib/impact/analytics";
import type { QueueFilters } from "./FilterBar";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const PACE_BG: Record<string, string> = {
  green: "bg-success/15 text-success border-success/40",
  yellow: "bg-amber-500/15 text-amber-500 border-amber-500/40",
  red: "bg-danger/15 text-danger border-danger/40",
};

export function PerformanceTab({ filters }: { filters: QueueFilters }) {
  const leads = useApp((s) => s.leads);
  const tours = useApp((s) => s.tours);
  const bookings = useApp((s) => s.bookings);
  const tcms = useApp((s) => s.tcms);
  const pods = usePods((s) => s.pods);
  const ranges = rangePresets();

  // Scope leads/tours/bookings to selected pod/member
  const podMemberIds = filters.podId !== "all"
    ? pods.find((p) => p.id === filters.podId)?.members.map((m) => m.tcmId) ?? null
    : null;
  const memberFilter = (tcmId: string) =>
    (filters.memberId === "all" || tcmId === filters.memberId) &&
    (!podMemberIds || podMemberIds.includes(tcmId));

  const scopedLeads = useMemo(() => leads.filter((l) => memberFilter(l.assignedTcmId)), [leads, filters, pods]);
  const scopedTours = useMemo(() => tours.filter((t) => memberFilter(t.tcmId)), [tours, filters, pods]);
  const scopedBk = useMemo(() => bookings.filter((b) => memberFilter(b.tcmId)), [bookings, filters, pods]);

  const range = ranges[filters.rangeKey];
  const prevRange = {
    fromMs: range.fromMs - (range.toMs - range.fromMs),
    toMs: range.fromMs,
    label: "prev",
  };

  const cur = paceFor(scopedLeads, scopedTours, scopedBk, range);
  const prev = paceFor(scopedLeads, scopedTours, scopedBk, prevRange);
  const mFrac = monthFraction();

  const weeks = useMemo(() => weeklyBuckets(scopedLeads, scopedTours, scopedBk, 8), [scopedLeads, scopedTours, scopedBk]);
  const losses = useMemo(() => lossReasons(scopedLeads), [scopedLeads]);

  const memberIds = (podMemberIds ?? tcms.map((t) => t.id));
  const board = useMemo(() => leaderboard(memberIds, scopedLeads, scopedTours, scopedBk, range), [memberIds, scopedLeads, scopedTours, scopedBk, range]);
  const heat = useMemo(() => stuckHeatmap(scopedLeads), [scopedLeads]);
  const maxHeat = Math.max(1, ...heat.map((c) => c.count));

  const tiles = [
    { key: "leads", label: "Leads added", value: cur.leads, target: MONTHLY_TARGET.leads, prev: prev.leads },
    { key: "sched", label: "Tours scheduled", value: cur.scheduled, target: MONTHLY_TARGET.toursScheduled, prev: prev.scheduled },
    { key: "done", label: "Tours done", value: cur.done, target: MONTHLY_TARGET.toursDone, prev: prev.done },
    { key: "no", label: "Said No", value: cur.saidNo, target: MONTHLY_TARGET.said_no, prev: prev.saidNo, invert: true },
    { key: "future", label: "Future", value: cur.future, target: MONTHLY_TARGET.future, prev: prev.future, invert: true },
    { key: "stuck", label: "Stuck > 5d", value: cur.stuck, target: 30, prev: prev.stuck, invert: true },
    { key: "closed", label: "Booked", value: cur.closed, target: MONTHLY_TARGET.closed, prev: prev.closed },
  ];

  // Pod pace verdict
  const verdict = useMemo(() => {
    const deltaBk = cur.closed - prev.closed;
    const deltaLd = cur.leads - prev.leads;
    if (deltaBk > 0) return `🚀 +${deltaBk} bookings vs previous period (${deltaLd >= 0 ? "+" : ""}${deltaLd} leads)`;
    if (deltaBk < 0) return `⚠ ${deltaBk} bookings vs previous period — investigate stuck pile`;
    return `Flat vs previous period · ${cur.leads} leads, ${cur.closed} closed`;
  }, [cur, prev]);

  return (
    <div className="space-y-4">
      {/* Verdict */}
      <div className="rounded-xl border bg-card/60 p-3 text-sm font-medium text-foreground">{verdict}</div>

      {/* Pace tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {tiles.map((t) => {
          const color = t.invert
            ? (t.value <= t.target * mFrac ? "green" : t.value <= t.target * mFrac * 1.3 ? "yellow" : "red")
            : paceColor(t.value, t.target, mFrac);
          const delta = t.value - t.prev;
          const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
          const pct = Math.min(100, (t.value / t.target) * 100);
          return (
            <div key={t.key} className="rounded-xl border bg-card p-2.5 space-y-1.5">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{t.label}</div>
              <div className="flex items-baseline gap-1.5">
                <div className="text-xl font-bold text-foreground">{t.value}</div>
                <div className="text-[10px] text-muted-foreground">/ {t.target}</div>
              </div>
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div className={`h-full ${color === "green" ? "bg-success" : color === "yellow" ? "bg-amber-500" : "bg-danger"}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center gap-1 text-[10px]">
                <Badge variant="outline" className={`px-1 py-0 text-[9px] ${PACE_BG[color]}`}>{color === "green" ? "On pace" : color === "yellow" ? "Behind" : "Critical"}</Badge>
                <span className="text-muted-foreground ml-auto flex items-center gap-0.5"><Icon className="h-2.5 w-2.5" />{delta > 0 ? "+" : ""}{delta}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Week-over-week + Loss reasons */}
      <div className="grid lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 rounded-xl border bg-card p-3">
          <div className="text-xs font-medium mb-2">Last 8 weeks — Leads / Tours / Bookings</div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeks}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="leads" fill="hsl(var(--primary))" />
                <Bar dataKey="tours" fill="hsl(var(--accent))" />
                <Bar dataKey="bookings" fill="hsl(var(--success))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-3">
          <div className="text-xs font-medium mb-2">Loss reasons</div>
          {losses.length === 0 ? (
            <div className="text-[11px] text-muted-foreground p-6 text-center">No lost leads yet.</div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={losses} dataKey="count" nameKey="label" outerRadius={70} label={(d) => d.label}>
                    {losses.map((_, i) => (
                      <Cell key={i} fill={`hsl(${(i * 67) % 360}, 65%, 55%)`} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Stuck heatmap */}
      <div className="rounded-xl border bg-card p-3">
        <div className="text-xs font-medium mb-2">Stuck heatmap · stage × days-in-stage</div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left p-1">Stage</th>
                {STUCK_BUCKETS.map((b) => <th key={b.label} className="p-1 text-center">{b.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {STUCK_STAGES.map((stage) => (
                <tr key={stage}>
                  <td className="p-1 capitalize text-foreground">{stage.replace("-", " ")}</td>
                  {STUCK_BUCKETS.map((b) => {
                    const cell = heat.find((c) => c.stage === stage && c.bucket === b.label);
                    const intensity = (cell?.count ?? 0) / maxHeat;
                    const danger = b.min >= 5;
                    return (
                      <td key={b.label} className="p-1 text-center">
                        <div
                          className={`rounded h-7 flex items-center justify-center font-medium ${danger ? "text-danger" : "text-foreground"}`}
                          style={{ background: `hsl(${danger ? "0" : "210"}, 70%, ${95 - intensity * 50}%)` }}
                        >
                          {cell?.count ?? 0}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="rounded-xl border bg-card p-3">
        <div className="text-xs font-medium mb-2">Pod leaderboard · {range.label}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-muted-foreground border-b">
                <th className="text-left p-1.5">Member</th>
                <th className="text-right p-1.5">Leads</th>
                <th className="text-right p-1.5">Tours</th>
                <th className="text-right p-1.5">Bookings</th>
                <th className="text-right p-1.5">Conv %</th>
                <th className="text-right p-1.5">Avg resp</th>
              </tr>
            </thead>
            <tbody>
              {board.map((row) => {
                const tcm = tcms.find((t) => t.id === row.tcmId);
                const pod = pods.find((p) => p.members.some((m) => m.tcmId === row.tcmId));
                const podRole = pod?.members.find((m) => m.tcmId === row.tcmId)?.podRole;
                return (
                  <tr key={row.tcmId} className="border-b last:border-0 hover:bg-accent/30">
                    <td className="p-1.5">
                      <div className="font-medium text-foreground">{tcm?.name ?? row.tcmId}</div>
                      <div className="text-[10px] text-muted-foreground">{pod?.name ?? "—"} {podRole ? `· ${podRole}` : ""}</div>
                    </td>
                    <td className="p-1.5 text-right text-foreground">{row.leads}</td>
                    <td className="p-1.5 text-right text-foreground">{row.tours}</td>
                    <td className="p-1.5 text-right text-foreground font-semibold">{row.bookings}</td>
                    <td className="p-1.5 text-right text-foreground">{row.conversion.toFixed(0)}%</td>
                    <td className="p-1.5 text-right text-muted-foreground">{row.avgResponseMins}m</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
