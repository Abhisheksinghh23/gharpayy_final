import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Timer, TrendingUp, Trophy, AlertTriangle, Users, Activity,
  Zap, Sparkles, Hourglass, Target,
} from "lucide-react";
import {
  useTTI, summarize, summarizeByUser, fieldBreakdown,
  formatDuration, type TaskType,
} from "@/lib/tti/store";

export const Route = createFileRoute("/admin/productivity")({
  head: () => ({
    meta: [
      { title: "Task Time Intelligence — Gharpayy Admin" },
      { name: "description", content: "Every second of execution measured. Spot friction, reward speed, kill bottlenecks." },
    ],
  }),
  component: ProductivityPage,
});

const RANGES = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  all: Infinity,
};

function ProductivityPage() {
  const records = useTTI((s) => s.records);
  const active = useTTI((s) => s.active);
  const clear = useTTI((s) => s.clear);
  const [range, setRange] = useState<keyof typeof RANGES>("24h");

  const filtered = useMemo(() => {
    const cut = Date.now() - RANGES[range];
    return records.filter((r) => r.startedAt >= cut);
  }, [records, range]);

  const stats = useMemo(() => summarize(filtered).sort((a, b) => b.count - a.count), [filtered]);
  const users = useMemo(() => summarizeByUser(filtered).sort((a, b) => b.count - a.count), [filtered]);

  const totalActive = filtered.reduce((a, r) => a + (r.durationMs ?? 0), 0);
  const totalCompleted = filtered.filter((r) => !r.abandoned).length;
  const totalAbandoned = filtered.filter((r) => r.abandoned).length;
  const avgTaskMs = totalCompleted > 0 ? filtered.reduce((a, r) => a + (r.durationMs ?? 0), 0) / totalCompleted : 0;

  const inFlight = Object.values(active);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Timer className="h-6 w-6 text-primary" /> Task Time Intelligence
          </h1>
          <p className="text-sm text-muted-foreground">
            Every second of execution measured. Spot friction. Reward speed. Kill bottlenecks.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as keyof typeof RANGES)}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last hour</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => { if (confirm("Clear all timing records?")) clear(); }}>
            Clear
          </Button>
        </div>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi icon={Activity} label="Tasks tracked" value={filtered.length.toString()} tone="default" />
        <Kpi icon={Zap} label="Completed" value={totalCompleted.toString()} tone="success" />
        <Kpi icon={AlertTriangle} label="Abandoned" value={totalAbandoned.toString()} tone={totalAbandoned > 0 ? "warn" : "default"} />
        <Kpi icon={Hourglass} label="Avg task time" value={formatDuration(avgTaskMs)} tone="info" />
        <Kpi icon={TrendingUp} label="Productive time" value={formatDuration(totalActive)} tone="primary" />
      </div>

      {/* in-flight */}
      {inFlight.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="font-semibold text-sm">Live — {inFlight.length} task{inFlight.length !== 1 ? "s" : ""} in flight</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {inFlight.map((t) => (
              <div key={t.id} className="rounded-md border border-border bg-muted/30 p-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-medium">{t.label}</div>
                  <div className="text-muted-foreground">{t.userName}</div>
                </div>
                <Badge variant="secondary" className="tabular-nums">
                  {formatDuration(Date.now() - t.startedAt)}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">By task</TabsTrigger>
          <TabsTrigger value="users">By user</TabsTrigger>
          <TabsTrigger value="friction">Friction map</TabsTrigger>
          <TabsTrigger value="log">Activity log</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-3">
          {stats.length === 0 && <Empty />}
          {stats.map((s) => (
            <Card key={s.type} className="p-4">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <div className="font-semibold text-sm flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" /> {s.label}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">{s.type}</div>
                </div>
                <div className="flex gap-3 text-xs">
                  <Stat label="Runs" value={s.count.toString()} />
                  <Stat label="Avg" value={formatDuration(s.avgMs)} accent />
                  <Stat label="Best" value={formatDuration(s.bestMs)} tone="success" />
                  <Stat label="P95" value={formatDuration(s.p95Ms)} tone="warn" />
                  <Stat label="Abandon" value={`${s.abandoned}`} tone={s.abandoned > 0 ? "warn" : "default"} />
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="users" className="space-y-2">
          {users.length === 0 && <Empty />}
          {users.map((u, idx) => (
            <Card key={u.userKey} className="p-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs ${
                    idx === 0 ? "bg-yellow-500/20 text-yellow-700"
                    : idx === 1 ? "bg-slate-400/20 text-slate-700"
                    : idx === 2 ? "bg-orange-500/20 text-orange-700"
                    : "bg-muted text-muted-foreground"
                  }`}>
                    {idx < 3 ? <Trophy className="h-4 w-4" /> : `#${idx + 1}`}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{u.userName}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">{u.userKey}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <Badge variant="secondary">{u.count} tasks</Badge>
                  <Badge variant="secondary">{formatDuration(u.totalMs)} active</Badge>
                  {Object.entries(u.byType).map(([t, v]) => (
                    <Badge key={t} variant="outline" className="font-mono">
                      {t}: {formatDuration(v.avgMs)}
                    </Badge>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="friction" className="space-y-3">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Slowest fields per task — friction usually lives at the top.
          </p>
          {stats.length === 0 && <Empty />}
          {stats.map((s) => {
            const fb = fieldBreakdown(filtered, s.type as TaskType).slice(0, 10);
            if (fb.length === 0) return null;
            const max = fb[0].avgMs;
            return (
              <Card key={s.type} className="p-4">
                <div className="font-semibold text-sm mb-2">{s.label}</div>
                <div className="space-y-1.5">
                  {fb.map((f) => (
                    <div key={f.field} className="flex items-center gap-2 text-xs">
                      <div className="w-32 truncate font-mono text-muted-foreground">{f.field}</div>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${(f.avgMs / max) * 100}%` }}
                        />
                      </div>
                      <div className="w-20 text-right tabular-nums font-medium">{formatDuration(f.avgMs)}</div>
                      <div className="w-12 text-right text-muted-foreground">×{f.count}</div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="log">
          <Card className="p-0 overflow-hidden">
            <div className="max-h-[600px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr className="text-left">
                    <th className="p-2">When</th>
                    <th className="p-2">User</th>
                    <th className="p-2">Task</th>
                    <th className="p-2 text-right">Duration</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 200).map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="p-2 text-muted-foreground tabular-nums">
                        {new Date(r.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="p-2">{r.userName}</td>
                      <td className="p-2">{r.label}</td>
                      <td className="p-2 text-right tabular-nums font-medium">{formatDuration(r.durationMs ?? 0)}</td>
                      <td className="p-2">
                        {r.abandoned
                          ? <Badge variant="destructive" className="text-[10px]">abandoned</Badge>
                          : <Badge variant="secondary" className="text-[10px] bg-emerald-500/15 text-emerald-700">done</Badge>}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No records yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: typeof Timer; label: string; value: string; tone: "default" | "success" | "warn" | "info" | "primary" }) {
  const tones = {
    default: "text-muted-foreground",
    success: "text-emerald-600",
    warn: "text-amber-600",
    info: "text-blue-600",
    primary: "text-primary",
  };
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${tones[tone]}`} /> {label}
      </div>
      <div className={`text-xl font-bold tabular-nums mt-1 ${tones[tone]}`}>{value}</div>
    </Card>
  );
}

function Stat({ label, value, tone = "default", accent }: { label: string; value: string; tone?: "default" | "success" | "warn"; accent?: boolean }) {
  const tones = {
    default: "text-foreground",
    success: "text-emerald-600",
    warn: "text-amber-600",
  };
  return (
    <div className="text-right">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`tabular-nums font-semibold ${tones[tone]} ${accent ? "text-base" : "text-sm"}`}>{value}</div>
    </div>
  );
}

function Empty() {
  return (
    <Card className="p-8 text-center">
      <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
      <p className="text-sm font-medium">No tasks tracked yet in this range</p>
      <p className="text-xs text-muted-foreground mt-1">
        Try adding a lead or creating a booking — every flow is auto-instrumented.
      </p>
    </Card>
  );
}
