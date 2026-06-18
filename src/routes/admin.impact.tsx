import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useApp } from "@/lib/store";
import { usePods, type PodRole } from "@/lib/pods/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  LineChart, Line,
} from "recharts";
import {
  rangePresets, inRange, paceFor, paceColor, monthFraction, MONTHLY_TARGET,
  weeklyBuckets, leaderboard, lossReasons,
} from "@/lib/impact/analytics";
import { classify, isStuck, daysInStage, COHORT_META, COHORT_ORDER } from "@/lib/impact/cohorts";
import {
  LayoutGrid, TrendingUp, Archive, Users, Search, Building2,
} from "lucide-react";

export const Route = createFileRoute("/admin/impact")({
  head: () => ({ meta: [{ title: "Impact Command Center — Admin" }] }),
  component: AdminImpactPage,
});

const PERIODS = [
  { key: "week", label: "This Week" },
  { key: "last-week", label: "Last Week" },
  { key: "month", label: "This Month" },
  { key: "all", label: "All Time" },
] as const;

const PACE_BG: Record<string, string> = {
  green: "bg-success/15 text-success border-success/40",
  yellow: "bg-amber-500/15 text-amber-500 border-amber-500/40",
  red: "bg-danger/15 text-danger border-danger/40",
};

function AdminImpactPage() {
  const leads = useApp((s) => s.leads);
  const tours = useApp((s) => s.tours);
  const bookings = useApp((s) => s.bookings);
  const tcms = useApp((s) => s.tcms);
  const pods = usePods((s) => s.pods);

  const [periodKey, setPeriodKey] = useState<typeof PERIODS[number]["key"]>("month");
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [tab, setTab] = useState<"overview" | "pods" | "trend" | "vault">("overview");

  const zones = useMemo(() => Array.from(new Set(pods.map((p) => p.zone))), [pods]);
  const ranges = rangePresets();
  const range = ranges[periodKey];

  const scopedPods = zoneFilter === "all" ? pods : pods.filter((p) => p.zone === zoneFilter);
  const scopedMemberIds = scopedPods.flatMap((p) => p.members.map((m) => m.tcmId));
  const inScope = (tcmId: string) => scopedMemberIds.includes(tcmId);

  const sLeads = useMemo(() => leads.filter((l) => inScope(l.assignedTcmId)), [leads, scopedMemberIds.join(",")]);
  const sTours = useMemo(() => tours.filter((t) => inScope(t.tcmId)), [tours, scopedMemberIds.join(",")]);
  const sBk = useMemo(() => bookings.filter((b) => inScope(b.tcmId)), [bookings, scopedMemberIds.join(",")]);

  const teamSize = scopedMemberIds.length || 1;
  const teamTarget = {
    leads: MONTHLY_TARGET.leads * teamSize,
    scheduled: MONTHLY_TARGET.toursScheduled * teamSize,
    done: MONTHLY_TARGET.toursDone * teamSize,
    closed: MONTHLY_TARGET.closed * teamSize,
  };

  const cur = paceFor(sLeads, sTours, sBk, range);
  const mFrac = periodKey === "month" ? monthFraction() : 1;

  const tiles = [
    { label: "Leads", value: cur.leads, target: teamTarget.leads },
    { label: "Tours scheduled", value: cur.scheduled, target: teamTarget.scheduled },
    { label: "Tours done", value: cur.done, target: teamTarget.done },
    { label: "Bookings", value: cur.closed, target: teamTarget.closed },
    { label: "Conversion", value: Math.round(cur.conversion), target: 10, suffix: "%" },
    { label: "Stuck > 5d", value: cur.stuck, target: teamSize * 5, invert: true },
  ];

  return (
    <div className="p-3 sm:p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Impact Command Center</h1>
          <p className="text-[11px] text-muted-foreground">
            {scopedPods.length} pod{scopedPods.length === 1 ? "" : "s"} · {teamSize} members · scoped to {zoneFilter === "all" ? "all zones" : zoneFilter}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            <option value="all">All zones</option>
            {zones.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
          <div className="flex rounded-md border overflow-hidden">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriodKey(p.key)}
                className={`px-2.5 h-8 text-[11px] ${periodKey === p.key ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}
              >{p.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Pace tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {tiles.map((t) => {
          const color = t.invert
            ? (t.value <= t.target * mFrac ? "green" : t.value <= t.target * mFrac * 1.3 ? "yellow" : "red")
            : paceColor(t.value, t.target, mFrac);
          const pct = Math.min(100, t.target ? (t.value / t.target) * 100 : 0);
          return (
            <div key={t.label} className="rounded-xl border bg-card p-2.5 space-y-1.5">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{t.label}</div>
              <div className="flex items-baseline gap-1.5">
                <div className="text-xl font-bold text-foreground">{t.value}{t.suffix ?? ""}</div>
                <div className="text-[10px] text-muted-foreground">/ {t.target}{t.suffix ?? ""}</div>
              </div>
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div className={`h-full ${color === "green" ? "bg-success" : color === "yellow" ? "bg-amber-500" : "bg-danger"}`} style={{ width: `${pct}%` }} />
              </div>
              <Badge variant="outline" className={`px-1 py-0 text-[9px] ${PACE_BG[color]}`}>
                {color === "green" ? "On pace" : color === "yellow" ? "Behind" : "Critical"}
              </Badge>
            </div>
          );
        })}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="h-9">
          <TabsTrigger value="overview" className="text-xs gap-1.5"><LayoutGrid className="h-3.5 w-3.5" /> Overview</TabsTrigger>
          <TabsTrigger value="pods" className="text-xs gap-1.5"><Users className="h-3.5 w-3.5" /> Pods & Members</TabsTrigger>
          <TabsTrigger value="trend" className="text-xs gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> 3-Month Trend</TabsTrigger>
          <TabsTrigger value="vault" className="text-xs gap-1.5"><Archive className="h-3.5 w-3.5" /> Vault</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-3">
          <OverviewPanel leads={sLeads} pods={scopedPods} tcms={tcms} />
        </TabsContent>
        <TabsContent value="pods" className="mt-3">
          <PodsPanel pods={scopedPods} tcms={tcms} leads={sLeads} tours={sTours} bookings={sBk} range={range} />
        </TabsContent>
        <TabsContent value="trend" className="mt-3">
          <TrendPanel leads={sLeads} tours={sTours} bookings={sBk} teamTarget={teamTarget} />
        </TabsContent>
        <TabsContent value="vault" className="mt-3">
          <VaultPanel leads={leads} tcms={tcms} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─────────────────────────────── Overview ─────────────────────────────── */

function OverviewPanel({ leads, pods, tcms }: { leads: any[]; pods: any[]; tcms: any[] }) {
  const cohorts = useMemo(() => {
    const map: Record<string, number> = {};
    COHORT_ORDER.forEach((c) => (map[c] = 0));
    leads.forEach((l) => (map[classify(l)] += 1));
    return map;
  }, [leads]);

  const stuckCount = leads.filter(isStuck).length;
  const losses = useMemo(() => lossReasons(leads), [leads]);

  // Zone × pod scoreboard
  const zoneRows = useMemo(() => {
    const byZone = new Map<string, { open: number; stuck: number; closed: number; pods: number }>();
    pods.forEach((p) => {
      const memberIds = p.members.map((m: any) => m.tcmId);
      const podLeads = leads.filter((l) => memberIds.includes(l.assignedTcmId));
      const entry = byZone.get(p.zone) ?? { open: 0, stuck: 0, closed: 0, pods: 0 };
      entry.open += podLeads.filter((l) => l.stage !== "booked" && l.stage !== "dropped").length;
      entry.stuck += podLeads.filter(isStuck).length;
      entry.closed += podLeads.filter((l) => l.stage === "booked").length;
      entry.pods += 1;
      byZone.set(p.zone, entry);
    });
    return Array.from(byZone.entries()).map(([zone, v]) => ({ zone, ...v }));
  }, [pods, leads]);

  return (
    <div className="grid lg:grid-cols-3 gap-3">
      {/* Cohort distribution */}
      <div className="rounded-xl border bg-card p-3">
        <div className="text-xs font-medium mb-2">Cohort distribution</div>
        <div className="space-y-1.5">
          {COHORT_ORDER.map((c) => {
            const m = COHORT_META[c];
            const total = leads.length || 1;
            const count = cohorts[c];
            const pct = (count / total) * 100;
            return (
              <div key={c} className="flex items-center gap-2">
                <span className="text-base w-5">{m.icon}</span>
                <span className="text-[11px] text-foreground flex-1">{m.label}</span>
                <div className="flex-[2] h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[11px] text-muted-foreground w-12 text-right tabular-nums">{count}</span>
              </div>
            );
          })}
        </div>
        {stuckCount > 0 && (
          <div className="mt-3 text-[11px] text-danger flex items-center gap-1">
            ⚠ {stuckCount} stuck &gt; 5d needs Closer pod attention
          </div>
        )}
      </div>

      {/* Zone scoreboard */}
      <div className="lg:col-span-2 rounded-xl border bg-card p-3">
        <div className="text-xs font-medium mb-2 flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Zone scoreboard</div>
        <table className="w-full text-[11px]">
          <thead className="text-muted-foreground border-b">
            <tr>
              <th className="text-left p-1.5">Zone</th>
              <th className="text-right p-1.5">Pods</th>
              <th className="text-right p-1.5">Open</th>
              <th className="text-right p-1.5">Stuck</th>
              <th className="text-right p-1.5">Bookings</th>
              <th className="text-right p-1.5">Stuck %</th>
            </tr>
          </thead>
          <tbody>
            {zoneRows.map((z) => {
              const stuckPct = z.open ? (z.stuck / z.open) * 100 : 0;
              return (
                <tr key={z.zone} className="border-b last:border-0 hover:bg-accent/30">
                  <td className="p-1.5 text-foreground font-medium">{z.zone}</td>
                  <td className="p-1.5 text-right">{z.pods}</td>
                  <td className="p-1.5 text-right">{z.open}</td>
                  <td className={`p-1.5 text-right ${z.stuck > 0 ? "text-danger" : ""}`}>{z.stuck}</td>
                  <td className="p-1.5 text-right text-foreground font-semibold">{z.closed}</td>
                  <td className="p-1.5 text-right">
                    <span className={stuckPct > 20 ? "text-danger" : stuckPct > 10 ? "text-amber-500" : "text-success"}>
                      {stuckPct.toFixed(0)}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Loss reasons */}
      <div className="lg:col-span-3 rounded-xl border bg-card p-3">
        <div className="text-xs font-medium mb-2">Top loss reasons</div>
        {losses.length === 0 ? (
          <div className="text-[11px] text-muted-foreground p-4 text-center">No lost leads in scope yet.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {losses.map((l) => (
              <Badge key={l.label} variant="outline" className="text-[11px] py-1">
                {l.label} · <strong className="ml-1">{l.count}</strong>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────── Pods Panel ─────────────────────────────── */

function PodsPanel({ pods, tcms, leads, tours, bookings, range }: any) {
  return (
    <div className="space-y-3">
      {pods.map((p: any) => {
        const memberIds = p.members.map((m: any) => m.tcmId);
        const podLeads = leads.filter((l: any) => memberIds.includes(l.assignedTcmId));
        const open = podLeads.filter((l: any) => l.stage !== "booked" && l.stage !== "dropped").length;
        const stuck = podLeads.filter(isStuck).length;
        const closed = podLeads.filter((l: any) => l.stage === "booked").length;
        const board = leaderboard(memberIds, leads, tours, bookings, range);
        const roleCounts = (role: PodRole) => p.members.filter((m: any) => m.podRole === role).length;
        return (
          <div key={p.id} className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/30">
              <div>
                <div className="text-sm font-semibold text-foreground">{p.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {roleCounts("scheduler")} Sched · {roleCounts("runner")} Runner · {roleCounts("closer")} Closer
                </div>
              </div>
              <div className="flex gap-3 text-[11px]">
                <Stat label="Open" value={open} />
                <Stat label="Stuck" value={stuck} danger={stuck > 0} />
                <Stat label="Bookings" value={closed} success />
              </div>
            </div>
            <table className="w-full text-[11px]">
              <thead className="text-muted-foreground border-b">
                <tr>
                  <th className="text-left p-1.5">Member</th>
                  <th className="text-left p-1.5">Role</th>
                  <th className="text-right p-1.5">Leads</th>
                  <th className="text-right p-1.5">Tours</th>
                  <th className="text-right p-1.5">Bookings</th>
                  <th className="text-right p-1.5">Conv</th>
                  <th className="text-right p-1.5">Resp</th>
                </tr>
              </thead>
              <tbody>
                {board.map((row) => {
                  const tcm = tcms.find((t: any) => t.id === row.tcmId);
                  const podRole = p.members.find((m: any) => m.tcmId === row.tcmId)?.podRole;
                  return (
                    <tr key={row.tcmId} className="border-b last:border-0 hover:bg-accent/30">
                      <td className="p-1.5 font-medium text-foreground">{tcm?.name ?? row.tcmId}</td>
                      <td className="p-1.5 capitalize text-muted-foreground">{podRole}</td>
                      <td className="p-1.5 text-right">{row.leads}</td>
                      <td className="p-1.5 text-right">{row.tours}</td>
                      <td className="p-1.5 text-right font-semibold text-foreground">{row.bookings}</td>
                      <td className="p-1.5 text-right">{row.conversion.toFixed(0)}%</td>
                      <td className="p-1.5 text-right text-muted-foreground">{row.avgResponseMins}m</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value, danger, success }: { label: string; value: number; danger?: boolean; success?: boolean }) {
  return (
    <div className="flex flex-col items-end">
      <span className={`font-bold tabular-nums ${danger ? "text-danger" : success ? "text-success" : "text-foreground"}`}>{value}</span>
      <span className="text-[9px] text-muted-foreground uppercase">{label}</span>
    </div>
  );
}

/* ─────────────────────────────── Trend Panel ─────────────────────────────── */

function TrendPanel({ leads, tours, bookings, teamTarget }: any) {
  const weeks26 = useMemo(() => weeklyBuckets(leads, tours, bookings, 26), [leads, tours, bookings]);
  const months6 = useMemo(() => {
    const out: { label: string; leads: number; tours: number; bookings: number; target: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const r = { fromMs: +start, toMs: +end, label: "" };
      out.push({
        label: start.toLocaleDateString("en-IN", { month: "short" }),
        leads: leads.filter((l: any) => inRange(l.createdAt, r)).length,
        tours: tours.filter((t: any) => inRange(t.createdAt, r)).length,
        bookings: bookings.filter((b: any) => inRange(b.ts, r)).length,
        target: teamTarget.closed,
      });
    }
    return out;
  }, [leads, tours, bookings, teamTarget.closed]);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-card p-3">
        <div className="text-xs font-medium mb-2">6 months — Bookings vs Target</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={months6}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="bookings" stroke="hsl(var(--success))" strokeWidth={2} />
              <Line type="monotone" dataKey="target" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-xl border bg-card p-3">
        <div className="text-xs font-medium mb-2">26 weeks — Leads / Tours / Bookings</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeks26}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={2} />
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
    </div>
  );
}

/* ─────────────────────────────── Vault ─────────────────────────────── */

function VaultPanel({ leads, tcms }: { leads: any[]; tcms: any[] }) {
  const [q, setQ] = useState("");
  const DAY = 86_400_000;
  const now = Date.now();
  const vault = useMemo(() =>
    leads
      .filter((l) => (l.stage === "booked" || l.stage === "dropped") && (now - +new Date(l.updatedAt)) > 60 * DAY)
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)),
  [leads, now]);
  const filtered = vault.filter((l) =>
    !q || [l.name, l.phone, l.preferredArea].some((s) => s?.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 p-3 border-b">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vault…" className="h-8 pl-7 text-xs" />
        </div>
        <Badge variant="outline" className="text-[11px]">{filtered.length} of {vault.length}</Badge>
      </div>
      <div className="text-[11px] text-muted-foreground px-3 py-1 bg-muted/30 border-b">
        Leads closed (booked or dropped) more than 60 days ago — kept off the active board, fully searchable.
      </div>
      <div className="max-h-[60vh] overflow-y-auto divide-y">
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">Vault is empty.</div>
        )}
        {filtered.map((l) => {
          const tcm = tcms.find((t: any) => t.id === l.assignedTcmId);
          const age = Math.floor((now - +new Date(l.updatedAt)) / DAY);
          return (
            <div key={l.id} className="flex items-center gap-3 px-3 py-2 text-[11px] hover:bg-accent/30">
              <div className="flex-1 min-w-0">
                <div className="text-foreground font-medium truncate">{l.name}</div>
                <div className="text-muted-foreground truncate">{l.phone} · {l.preferredArea} · {tcm?.name ?? "—"}</div>
              </div>
              <Badge variant="outline" className={`text-[10px] ${l.stage === "booked" ? "bg-success/15 text-success border-success/40" : "bg-muted text-muted-foreground"}`}>
                {l.stage}
              </Badge>
              <span className="text-[10px] text-muted-foreground w-16 text-right">{age}d ago</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
