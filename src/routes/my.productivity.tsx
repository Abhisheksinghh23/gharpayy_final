// Personal Task-Time Intelligence — every user's own speed dashboard.
// Shows YOUR stats: personal bests, streaks, rank vs team, hourly heatmap,
// achievements, and a friction map of YOUR slowest fields.
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Timer, Trophy, Flame, Zap, TrendingUp, TrendingDown, Target,
  Sparkles, Hourglass, Award, Activity, Crown, Rocket,
} from "lucide-react";
import {
  useTTI, summarize, summarizeByUser, fieldBreakdown,
  formatDuration, type TaskType, type TaskRecord,
} from "@/lib/tti/store";
import { useApp } from "@/lib/store";
import { useOwner } from "@/owner/owner-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/my/productivity")({
  head: () => ({
    meta: [
      { title: "My Speed — Task Time Intelligence" },
      { name: "description", content: "Your personal execution speed: streaks, records, rank, and where seconds slip away." },
    ],
  }),
  component: MyProductivityPage,
});

function MyProductivityPage() {
  const records = useTTI((s) => s.records);
  const active = useTTI((s) => s.active);
  const role = useApp((s) => s.role);
  const currentTcmId = useApp((s) => s.currentTcmId);
  const tcms = useApp((s) => s.tcms);
  const owner = useOwner();

  // resolve current user key the same way useTaskTimer does
  const me = useMemo(() => {
    if (role === "tcm") {
      const t = tcms.find((x) => x.id === currentTcmId);
      return { key: `tcm:${currentTcmId}`, name: t?.name ?? "TCM" };
    }
    if (role === "owner") {
      const o = owner.owners.find((x: { id: string; name: string }) => x.id === owner.currentOwnerId);
      return { key: `owner:${owner.currentOwnerId ?? "default"}`, name: o?.name ?? "Owner" };
    }
    return { key: `${role}:default`, name: role.toUpperCase() };
  }, [role, currentTcmId, tcms, owner]);

  const myRecords = useMemo(() => records.filter((r) => r.userKey === me.key), [records, me.key]);
  const myActive = Object.values(active).filter((t) => t.userKey === me.key);

  // --- time slices
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const todayRecs = myRecords.filter((r) => r.startedAt >= startOfToday.getTime());
  const yest = myRecords.filter((r) => r.startedAt >= startOfToday.getTime() - dayMs && r.startedAt < startOfToday.getTime());
  const last7 = myRecords.filter((r) => r.startedAt >= now - 7 * dayMs);

  const sum = (arr: TaskRecord[]) => arr.reduce((a, r) => a + (r.durationMs ?? 0), 0);
  const avgMs = (arr: TaskRecord[]) => {
    const c = arr.filter((r) => !r.abandoned && r.durationMs);
    return c.length ? sum(c) / c.length : 0;
  };

  const completed = myRecords.filter((r) => !r.abandoned).length;
  const abandoned = myRecords.filter((r) => r.abandoned).length;
  const completionRate = myRecords.length > 0 ? Math.round((completed / myRecords.length) * 100) : 100;

  const todayAvg = avgMs(todayRecs);
  const yestAvg = avgMs(yest);
  const trend = yestAvg && todayAvg ? Math.round(((yestAvg - todayAvg) / yestAvg) * 100) : 0;

  // --- streak (consecutive days with ≥1 completed task)
  const streak = useMemo(() => {
    let s = 0;
    for (let i = 0; i < 60; i++) {
      const start = startOfToday.getTime() - i * dayMs;
      const end = start + dayMs;
      const hit = myRecords.some((r) => !r.abandoned && r.startedAt >= start && r.startedAt < end);
      if (hit) s++;
      else if (i > 0) break;
      else break;
    }
    return s;
  }, [myRecords, startOfToday, dayMs]);

  // --- rank vs team
  const allUsers = useMemo(() => summarizeByUser(last7).sort((a, b) => b.count - a.count), [last7]);
  const myRank = allUsers.findIndex((u) => u.userKey === me.key);
  const rankNum = myRank >= 0 ? myRank + 1 : null;

  // --- per-task personal stats
  const myByType = useMemo(() => summarize(myRecords).sort((a, b) => b.count - a.count), [myRecords]);
  const teamByType = useMemo(() => {
    const m = new Map<TaskType, ReturnType<typeof summarize>[number]>();
    summarize(records).forEach((s) => m.set(s.type, s));
    return m;
  }, [records]);

  // --- hourly heatmap (last 7d)
  const heatmap = useMemo(() => {
    const arr = Array(24).fill(0) as number[];
    last7.filter((r) => !r.abandoned).forEach((r) => {
      arr[new Date(r.startedAt).getHours()]++;
    });
    return arr;
  }, [last7]);
  const heatMax = Math.max(1, ...heatmap);

  // --- achievements
  const achievements = useMemo(() => {
    const a: { id: string; label: string; desc: string; got: boolean; icon: typeof Trophy }[] = [
      { id: "first", label: "First Run", desc: "Complete 1 tracked task", got: completed >= 1, icon: Sparkles },
      { id: "ten", label: "Warming Up", desc: "Complete 10 tasks", got: completed >= 10, icon: Zap },
      { id: "fifty", label: "On Fire", desc: "Complete 50 tasks", got: completed >= 50, icon: Flame },
      { id: "century", label: "Century Club", desc: "Complete 100 tasks", got: completed >= 100, icon: Trophy },
      { id: "streak3", label: "3-Day Streak", desc: "3 consecutive active days", got: streak >= 3, icon: Flame },
      { id: "streak7", label: "Week Warrior", desc: "7-day streak", got: streak >= 7, icon: Crown },
      { id: "speedy", label: "Speed Demon", desc: "Avg under 30s on any task", got: myByType.some((t) => t.avgMs > 0 && t.avgMs < 30_000), icon: Rocket },
      { id: "clean", label: "Finisher", desc: "≥90% completion rate (5+ tasks)", got: myRecords.length >= 5 && completionRate >= 90, icon: Award },
      { id: "top3", label: "Top 3", desc: "Rank top-3 on your team (7d)", got: rankNum !== null && rankNum <= 3, icon: Crown },
    ];
    return a;
  }, [completed, streak, myByType, completionRate, myRecords.length, rankNum]);

  const earned = achievements.filter((a) => a.got).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Rocket className="h-6 w-6 text-primary" /> My Speed
          </h1>
          <p className="text-sm text-muted-foreground">
            Hi <span className="font-medium text-foreground">{me.name}</span> — every second of your execution, measured. Beat yourself.
          </p>
        </div>
        {rankNum && (
          <Badge variant="secondary" className={cn(
            "text-sm px-3 py-1.5 gap-1.5",
            rankNum === 1 && "bg-yellow-500/15 text-yellow-700 border-yellow-500/40",
            rankNum === 2 && "bg-slate-400/15 text-slate-700",
            rankNum === 3 && "bg-orange-500/15 text-orange-700",
          )}>
            <Trophy className="h-3.5 w-3.5" />
            Team rank · #{rankNum} of {allUsers.length}
          </Badge>
        )}
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi icon={Activity} label="Tasks today" value={todayRecs.length.toString()} sub={`${last7.length} in 7d`} />
        <Kpi
          icon={Hourglass}
          label="Today avg"
          value={formatDuration(todayAvg)}
          sub={trend !== 0 ? (trend > 0 ? `↓ ${trend}% vs yest` : `↑ ${Math.abs(trend)}% vs yest`) : "—"}
          tone={trend > 0 ? "success" : trend < 0 ? "warn" : "default"}
        />
        <Kpi icon={Flame} label="Day streak" value={streak.toString()} sub={streak >= 3 ? "🔥 keep going" : "Start today"} tone={streak >= 3 ? "warn" : "default"} />
        <Kpi icon={Target} label="Completion" value={`${completionRate}%`} sub={`${abandoned} abandoned`} tone={completionRate >= 90 ? "success" : "default"} />
        <Kpi icon={Award} label="Achievements" value={`${earned}/${achievements.length}`} tone="primary" />
      </div>

      {/* in-flight */}
      {myActive.length > 0 && (
        <Card className="p-3 border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center gap-2 text-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold">{myActive.length} task{myActive.length !== 1 ? "s" : ""} running right now</span>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Personal bests */}
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
            <Trophy className="h-4 w-4 text-yellow-600" /> Personal Bests · Per Task
          </h3>
          {myByType.length === 0 && <p className="text-xs text-muted-foreground">Run a task to see your bests.</p>}
          <div className="space-y-2.5">
            {myByType.map((s) => {
              const team = teamByType.get(s.type);
              const beatTeam = team && s.avgMs > 0 && s.avgMs < team.avgMs;
              return (
                <div key={s.type} className="border border-border rounded-md p-2.5">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="text-sm font-medium">{s.label}</div>
                    <div className="flex gap-1.5">
                      {beatTeam && <Badge variant="secondary" className="text-[10px] bg-emerald-500/15 text-emerald-700">⚡ beats team avg</Badge>}
                      <Badge variant="outline" className="text-[10px]">×{s.count}</Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <MiniStat label="Best" value={formatDuration(s.bestMs)} tone="success" />
                    <MiniStat label="Your avg" value={formatDuration(s.avgMs)} accent />
                    <MiniStat label="Team avg" value={team ? formatDuration(team.avgMs) : "—"} tone="muted" />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Achievements */}
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
            <Award className="h-4 w-4 text-primary" /> Achievements
          </h3>
          <div className="mb-3">
            <Progress value={(earned / achievements.length) * 100} className="h-1.5" />
            <p className="text-[11px] text-muted-foreground mt-1">{earned} of {achievements.length} unlocked</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {achievements.map((a) => {
              const Icon = a.icon;
              return (
                <div
                  key={a.id}
                  className={cn(
                    "border rounded-md p-2 flex items-start gap-2",
                    a.got ? "border-primary/40 bg-primary/5" : "border-dashed border-border opacity-60",
                  )}
                >
                  <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", a.got ? "text-primary" : "text-muted-foreground")} />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{a.label}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight">{a.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Hourly heatmap */}
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
            <Activity className="h-4 w-4 text-primary" /> When You Ship · 7-day Hourly Heatmap
          </h3>
          <div className="flex items-end gap-0.5 h-24">
            {heatmap.map((c, h) => (
              <div key={h} className="flex-1 flex flex-col items-center gap-0.5 group">
                <div className="flex-1 w-full flex items-end">
                  <div
                    className={cn(
                      "w-full rounded-sm transition-all",
                      c === 0 ? "bg-muted" : "bg-primary",
                    )}
                    style={{
                      height: c === 0 ? "4px" : `${Math.max(8, (c / heatMax) * 100)}%`,
                      opacity: c === 0 ? 0.3 : 0.4 + (c / heatMax) * 0.6,
                    }}
                    title={`${h}:00 — ${c} tasks`}
                  />
                </div>
                {h % 3 === 0 && <span className="text-[8px] text-muted-foreground tabular-nums">{h}</span>}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">Peak hour: {heatmap.indexOf(heatMax)}:00 ({heatMax} tasks)</p>
        </Card>

        {/* Friction map — YOUR slowest fields */}
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" /> Your Friction Map
          </h3>
          <p className="text-[11px] text-muted-foreground mb-2">Slowest fields across all your tasks — fix these to save seconds.</p>
          {(() => {
            const all = new Map<string, { ms: number; count: number; label: string }>();
            myByType.forEach((s) => {
              fieldBreakdown(myRecords, s.type as TaskType).forEach((f) => {
                const k = `${s.label} · ${f.field}`;
                const existing = all.get(k);
                if (existing) {
                  existing.ms += f.avgMs * f.count;
                  existing.count += f.count;
                } else {
                  all.set(k, { ms: f.avgMs * f.count, count: f.count, label: k });
                }
              });
            });
            const list = Array.from(all.values())
              .map((x) => ({ ...x, avg: x.ms / x.count }))
              .sort((a, b) => b.avg - a.avg)
              .slice(0, 8);
            if (list.length === 0) return <p className="text-xs text-muted-foreground">No field-level data yet.</p>;
            const max = list[0].avg;
            return (
              <div className="space-y-1.5">
                {list.map((f) => (
                  <div key={f.label} className="flex items-center gap-2 text-xs">
                    <div className="w-40 truncate font-mono text-[10px] text-muted-foreground">{f.label}</div>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-amber-500" style={{ width: `${(f.avg / max) * 100}%` }} />
                    </div>
                    <div className="w-16 text-right tabular-nums font-medium">{formatDuration(f.avg)}</div>
                  </div>
                ))}
              </div>
            );
          })()}
        </Card>
      </div>

      {/* Recent activity */}
      <Card className="p-0 overflow-hidden">
        <div className="p-3 border-b border-border flex items-center gap-2">
          <Timer className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Your Recent Runs</h3>
        </div>
        <div className="max-h-[400px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0">
              <tr className="text-left">
                <th className="p-2">When</th>
                <th className="p-2">Task</th>
                <th className="p-2 text-right">Time</th>
                <th className="p-2 text-right">vs your avg</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {myRecords.slice(0, 50).map((r) => {
                const typeAvg = myByType.find((s) => s.type === r.type)?.avgMs ?? 0;
                const diff = typeAvg && r.durationMs ? Math.round(((typeAvg - r.durationMs) / typeAvg) * 100) : 0;
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-2 text-muted-foreground tabular-nums">
                      {new Date(r.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="p-2">{r.label}</td>
                    <td className="p-2 text-right tabular-nums font-medium">{formatDuration(r.durationMs ?? 0)}</td>
                    <td className="p-2 text-right tabular-nums">
                      {!r.abandoned && diff !== 0 && (
                        <span className={cn("inline-flex items-center gap-0.5", diff > 0 ? "text-emerald-600" : "text-amber-600")}>
                          {diff > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {Math.abs(diff)}%
                        </span>
                      )}
                    </td>
                    <td className="p-2">
                      {r.abandoned
                        ? <Badge variant="destructive" className="text-[10px]">abandoned</Badge>
                        : <Badge variant="secondary" className="text-[10px] bg-emerald-500/15 text-emerald-700">done</Badge>}
                    </td>
                  </tr>
                );
              })}
              {myRecords.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No runs yet — add a lead or create a booking to start tracking.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone = "default" }: { icon: typeof Timer; label: string; value: string; sub?: string; tone?: "default" | "success" | "warn" | "primary" }) {
  const tones = { default: "text-foreground", success: "text-emerald-600", warn: "text-amber-600", primary: "text-primary" };
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={cn("text-xl font-bold tabular-nums mt-1", tones[tone])}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}

function MiniStat({ label, value, tone = "default", accent }: { label: string; value: string; tone?: "default" | "success" | "muted"; accent?: boolean }) {
  const tones = { default: "text-foreground", success: "text-emerald-600", muted: "text-muted-foreground" };
  return (
    <div className="bg-muted/40 rounded px-2 py-1">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("tabular-nums font-semibold", tones[tone], accent ? "text-sm" : "text-xs")}>{value}</div>
    </div>
  );
}
