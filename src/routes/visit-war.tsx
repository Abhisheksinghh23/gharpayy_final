import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { useEffect, useMemo, useState } from "react";
import { useMountedNow } from "@/hooks/use-now";
import {
  useVisitWar,
  STAGE_META,
  probabilityFor,
  fmtElapsed,
  OBJECTION_CATALOG,
  type VisitRecord,
  type VisitStage,
  type Reaction,
  type Decision,
  type ObjectionCategory,
  type FollowUpStage,
  type LostReason,
} from "@/lib/visits/war-store";
import {
  Radio, Activity, Flame, BarChart3, Bell, X, Phone, MessageCircle,
  AlertTriangle, Building2, Clock, TrendingUp,
  CalendarClock, Wallet, Gauge, Siren, ChevronRight, Plus,
  Users, Map,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { RoleLensSwitcher } from "@/components/visits/RoleLensSwitcher";
import { DayPlannerStrip } from "@/components/visits/DayPlannerStrip";
import { TeamPulseGrid } from "@/components/visits/TeamPulseGrid";
import { WarMapPanel } from "@/components/visits/WarMapPanel";
import { VisitCopyChips } from "@/components/visits/VisitCopyChips";
import { CoachNoteThread } from "@/components/visits/CoachNoteThread";
import { selectByLens, defaultLensFor, type Lens } from "@/lib/visits/selectors";
import { upsertVisitEvent, archiveVisitEvent } from "@/lib/calendar-store";
import { visitBlock } from "@/lib/impact/copy-formats";

export const Route = createFileRoute("/visit-war")({
  head: () => ({ meta: [{ title: "Visit Command Center · War Room" }] }),
  component: () => (
    <AppShell>
      <VisitWarRoom />
    </AppShell>
  ),
});

/* ────────────────────────────────────────────────────────────────────────── */
/* Helpers                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

function stageTone(stage: VisitStage): { className: string; dot: string } {
  switch (stage) {
    case "scheduled":     return { className: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground" };
    case "started":       return { className: "bg-info/10 text-info border-info/30", dot: "bg-info" };
    case "at-property":   return { className: "bg-success/10 text-success border-success/30", dot: "bg-success" };
    case "tour-ongoing":  return { className: "bg-warning/15 text-warning-foreground border-warning/40", dot: "bg-warning" };
    case "completed":     return { className: "bg-info/10 text-info border-info/30", dot: "bg-info" };
    case "objection":     return { className: "bg-warning/15 text-warning-foreground border-warning/40", dot: "bg-warning" };
    case "follow-up":     return { className: "bg-accent/10 text-accent border-accent/30", dot: "bg-accent" };
    case "booked":        return { className: "bg-success/15 text-success border-success/40", dot: "bg-success" };
    case "lost":          return { className: "bg-destructive/10 text-destructive border-destructive/30", dot: "bg-destructive" };
  }
}

function probTone(p: number) {
  if (p >= 75) return "bg-success/15 text-success border-success/30";
  if (p >= 45) return "bg-warning/15 text-warning-foreground border-warning/40";
  return "bg-destructive/10 text-destructive border-destructive/30";
}

function timerTone(elapsedSec: number) {
  if (elapsedSec >= 75 * 60) return "text-destructive";
  if (elapsedSec >= 45 * 60) return "text-warning-foreground";
  if (elapsedSec >= 30 * 60) return "text-warning";
  return "text-success";
}

/* ────────────────────────────────────────────────────────────────────────── */

type Tab = "live" | "upcoming" | "hot" | "team" | "map" | "stats" | "alerts";

export function VisitWarRoom({ inline = false }: { inline?: boolean } = {}) {
  const { leads, properties, tours, tcms, role, currentTcmId } = useApp();
  const { records, alerts, upsert, patch, pushAlert, markAlertsSeen, addObjection, alertsSeenAt } = useVisitWar();
  const [now, mounted] = useMountedNow(1000);
  const [lens, setLens] = useState<Lens>(() => defaultLensFor(role));
  const [tab, setTab] = useState<Tab>("live");
  const [focusTour, setFocusTour] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<"prob" | "dur" | "obj" | "update">("prob");

  // Re-default lens when role changes externally
  useEffect(() => { setLens(defaultLensFor(role)); }, [role]);

  /* Seed war records from tours */
  useEffect(() => {
    if (!mounted) return;
    tours.forEach((t) => {
      if (records[t.id]) return;
      const lead = leads.find((l) => l.id === t.leadId);
      const prop = properties.find((p) => p.id === t.propertyId);
      const tcm = tcms.find((m) => m.id === t.tcmId);
      const sched = +new Date(t.scheduledAt);
      let stage: VisitStage = "scheduled";
      if (t.status === "completed") stage = "completed";
      else if (t.status === "cancelled" || t.status === "no-show") stage = "lost";
      else if (sched < Date.now() - 10 * 60_000) stage = "tour-ongoing";
      upsert({
        tourId: t.id,
        leadId: t.leadId,
        leadName: lead?.name ?? "Lead",
        leadPhone: lead?.phone ?? "—",
        propertyId: t.propertyId,
        propertyName: prop?.name ?? "Property",
        propertyArea: prop?.area ?? "—",
        tcmId: t.tcmId,
        tcmName: tcm?.name ?? "Coordinator",
        scheduledAt: sched,
        stage,
        startedAt: stage !== "scheduled" ? sched : undefined,
        completedAt: stage === "completed" ? sched + 35 * 60_000 : undefined,
        objections: [],
        outcome: stage === "completed" ? "thinking" : null,
        lastUpdateAt: Date.now(),
      });
    });
  }, [tours, leads, properties, tcms, records, upsert, mounted]);

  /* Auto-escalation engine */
  useEffect(() => {
    if (!mounted) return;
    Object.values(records).forEach((v) => {
      if (v.stage === "scheduled" && now - v.scheduledAt > 15 * 60_000 && !v.warnedDelay) {
        patch(v.tourId, { warnedDelay: true });
        pushAlert({ tourId: v.tourId, leadName: v.leadName, severity: "warn", kind: "delay", message: "Delayed · no start 15m past schedule" });
      }
      if ((v.stage === "started" || v.stage === "at-property") &&
          v.startedAt && now - v.startedAt > 30 * 60_000 && !v.warnedAtRisk) {
        patch(v.tourId, { warnedAtRisk: true });
        pushAlert({ tourId: v.tourId, leadName: v.leadName, severity: "warn", kind: "delay", message: "At risk · no update 30m after start" });
      }
      if ((v.stage === "started" || v.stage === "at-property" || v.stage === "tour-ongoing") &&
          v.startedAt && now - v.startedAt > 60 * 60_000 && !v.warnedEscalate) {
        patch(v.tourId, { warnedEscalate: true, escalated: true });
        pushAlert({ tourId: v.tourId, leadName: v.leadName, severity: "risk", kind: "escalate", message: "ESCALATE · 60m no update — manager notified" });
      }
      if (v.stage === "completed" && v.completedAt &&
          now - v.completedAt > 6 * 3600_000 && (!v.outcome || v.outcome === "thinking") && !v.warnedGhost) {
        patch(v.tourId, { warnedGhost: true });
        pushAlert({ tourId: v.tourId, leadName: v.leadName, severity: "risk", kind: "ghost", message: "Ghost · post-visit silence 6h+" });
      }
    });
  }, [now, records, patch, pushAlert, mounted]);

  /* Calendar mirror — every visit gets a 1:1 calendar event, idempotent. */
  useEffect(() => {
    if (!mounted) return;
    Object.values(records).forEach((v) => {
      if (v.stage === "lost") { archiveVisitEvent(v.tourId); return; }
      upsertVisitEvent({
        tourId: v.tourId,
        leadId: v.leadId,
        leadName: v.leadName,
        leadPhone: v.leadPhone,
        propertyName: v.propertyName,
        propertyArea: v.propertyArea,
        scheduledAt: v.scheduledAt,
        description: visitBlock({
          leadName: v.leadName, leadPhone: v.leadPhone,
          propertyName: v.propertyName, propertyArea: v.propertyArea,
          scheduledAt: v.scheduledAt,
        }),
        durationMin: 60,
      });
    });
  }, [records, mounted]);

  /* Lens-scoped record set */
  const lensRecords = useMemo(() => {
    const filtered = selectByLens(records, lens, {
      tcmId: currentTcmId ?? undefined,
      ownerCode: undefined, // TODO: derive from owner-context when in owner shell
    });
    return filtered;
  }, [records, lens, currentTcmId]);

  const list = useMemo(() => lensRecords, [lensRecords]);

  const sorted = useMemo(() => {
    const arr = [...list];
    arr.sort((a, b) => {
      if (sortMode === "prob") {
        return probabilityFor(b.reaction, b.objections.length, b.stage) -
               probabilityFor(a.reaction, a.objections.length, a.stage);
      }
      if (sortMode === "dur") {
        const da = a.startedAt ? now - a.startedAt : 0;
        const db = b.startedAt ? now - b.startedAt : 0;
        return db - da;
      }
      if (sortMode === "obj") return b.objections.length - a.objections.length;
      return b.lastUpdateAt - a.lastUpdateAt;
    });
    return arr;
  }, [list, sortMode, now]);

  /* Hero metrics */
  const liveList = list.filter((v) => ["started", "at-property", "tour-ongoing"].includes(v.stage));
  const upcoming = list
    .filter((v) => v.stage === "scheduled" && v.scheduledAt > now - 5 * 60_000 && v.scheduledAt < now + 24 * 3600_000)
    .sort((a, b) => a.scheduledAt - b.scheduledAt);
  const hot = list.filter((v) =>
    v.stage === "completed" && v.completedAt && now - v.completedAt < 24 * 3600_000 && v.outcome !== "booked"
  );
  const unreadAlerts = alerts.filter((a) => a.ts > alertsSeenAt).length;
  const intervention = list.filter((v) => {
    const prob = probabilityFor(v.reaction, v.objections.length, v.stage);
    const sevObj = v.objections.some((o) => o.resolution === "unresolved");
    return v.escalated || prob >= 80 || (v.startedAt && now - v.startedAt > 30 * 60_000 && !v.completedAt) || sevObj;
  });

  /* Revenue walking inside properties: sum of (price * probability) for live + hot */
  const revenueWalking = useMemo(() => {
    const pool = [...liveList, ...hot];
    return pool.reduce((sum, v) => {
      const prop = properties.find((p) => p.id === v.propertyId);
      const price = prop?.pricePerBed ?? 12000;
      const p = probabilityFor(v.reaction, v.objections.length, v.stage) / 100;
      return sum + price * p;
    }, 0);
  }, [liveList, hot, properties]);

  const todayMs = (() => { const d = new Date(); d.setHours(0,0,0,0); return +d; })();
  const todays = list.filter((v) => v.scheduledAt >= todayMs);
  const expectedBookings = Math.round(
    list.filter((v) => v.completedAt && now - v.completedAt < 24 * 3600_000)
      .reduce((s, v) => s + probabilityFor(v.reaction, v.objections.length, v.stage) / 100, 0)
  );

  return (
    <div className="space-y-4">
      {/* ── HERO HEADER — hidden when embedded inside Impact Queue tab ──── */}
      {!inline && (
      <Card className="p-4 md:p-5 border-l-4 border-l-accent bg-gradient-to-br from-card to-card/60">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-accent font-semibold">Gharpayy · Visit OS</div>
              <h1 className="text-lg md:text-xl font-bold leading-tight">Visit Command Center</h1>
            </div>
          </div>
          <Badge variant="outline" className="ml-1 gap-1.5 border-success/40 bg-success/10 text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            {liveList.length} LIVE
          </Badge>
          {intervention.length > 0 && (
            <Badge variant="outline" className="gap-1.5 border-destructive/40 bg-destructive/10 text-destructive">
              <Siren className="h-3 w-3" /> {intervention.length} need intervention
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-3">
            <RoleLensSwitcher value={lens} onChange={setLens} />
            <div className="text-sm tabular-nums font-mono text-muted-foreground">
              {mounted ? new Date(now).toLocaleTimeString("en-IN", { hour12: false }) : "--:--:--"}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
          <Metric icon={Activity} label="Visits today" value={todays.length} />
          <Metric icon={CalendarClock} label="Next 24h" value={upcoming.length} tone="info" />
          <Metric icon={Flame} label="Hot (<24h)" value={hot.length} tone="warning" />
          <Metric icon={Wallet} label="Revenue walking" value={`₹${(revenueWalking / 1000).toFixed(0)}k`} tone="success" />
          <Metric icon={TrendingUp} label="Expected bookings" value={expectedBookings} tone="accent" />
        </div>
      </Card>
      )}

      {/* ── DAY PLANNER STRIP ───────────────────────────────────────────── */}
      <DayPlannerStrip
        visits={Object.values(records)}
        now={now}
        onFocus={setFocusTour}
        focusTourId={focusTour}
      />

      {/* ── TABS ────────────────────────────────────────────────────────── */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <div className="flex flex-wrap items-center gap-3">
          <TabsList>
            <TabsTrigger value="live" className="gap-1.5"><Activity className="h-3.5 w-3.5" /> Live ({liveList.length})</TabsTrigger>
            <TabsTrigger value="upcoming" className="gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> Upcoming ({upcoming.length})</TabsTrigger>
            <TabsTrigger value="hot" className="gap-1.5"><Flame className="h-3.5 w-3.5" /> Hot ({hot.length})</TabsTrigger>
            <TabsTrigger value="team" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Team Pulse</TabsTrigger>
            <TabsTrigger value="map" className="gap-1.5"><Map className="h-3.5 w-3.5" /> War Map</TabsTrigger>
            <TabsTrigger value="stats" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Stats</TabsTrigger>
            <TabsTrigger value="alerts" onClick={() => markAlertsSeen()} className="gap-1.5">
              <Bell className="h-3.5 w-3.5" /> Alerts
              {unreadAlerts > 0 && <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-[10px] h-4">{unreadAlerts}</Badge>}
            </TabsTrigger>
          </TabsList>
          {tab === "live" && (
            <div className="ml-auto flex items-center gap-1.5">
              <span className="text-[10px] uppercase text-muted-foreground tracking-wider mr-1">Sort</span>
              {(["prob", "dur", "obj", "update"] as const).map((m) => (
                <Button key={m} size="sm" variant={sortMode === m ? "default" : "outline"}
                        className="h-7 px-2.5 text-[11px] uppercase font-mono"
                        onClick={() => setSortMode(m)}>
                  {m === "prob" ? "Probability" : m === "dur" ? "Duration" : m === "obj" ? "Objections" : "Updated"}
                </Button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-4 mt-3">
          <div className="min-w-0">
            <TabsContent value="live" className="m-0">
              <LiveBoard list={sorted.filter((v) => !["booked","lost"].includes(v.stage))} now={now} mounted={mounted} onFocus={setFocusTour} focus={focusTour} />
            </TabsContent>
            <TabsContent value="upcoming" className="m-0">
              <UpcomingPanel list={upcoming} now={now} mounted={mounted} onFocus={setFocusTour} />
            </TabsContent>
            <TabsContent value="hot" className="m-0">
              <HotRoom list={hot} now={now} mounted={mounted} onFocus={setFocusTour} />
            </TabsContent>
            <TabsContent value="team" className="m-0">
              <TeamPulseGrid now={now} />
            </TabsContent>
            <TabsContent value="map" className="m-0">
              <WarMapPanel now={now} />
            </TabsContent>
            <TabsContent value="stats" className="m-0">
              <WarRoomStats list={list} />
            </TabsContent>
            <TabsContent value="alerts" className="m-0">
              <AlertFeed />
            </TabsContent>
          </div>

          {/* Detail panel */}
          <Card className="p-0 overflow-hidden min-h-[420px]">
            {focusTour && records[focusTour] ? (
              <VisitDetailPanel
                key={focusTour}
                v={records[focusTour]}
                now={now}
                onClose={() => setFocusTour(null)}
                onPatch={(p) => patch(focusTour, p)}
                onAddObjection={(o) => addObjection(focusTour, o)}
                onAlert={(severity, kind, message) =>
                  pushAlert({ tourId: focusTour, leadName: records[focusTour].leadName, severity, kind, message })
                }
              />
            ) : (
              <div className="p-10 text-center text-sm text-muted-foreground">
                <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <div className="font-semibold text-foreground mb-1">Select a visit</div>
                Open any row on the left to capture reactions, objections, and outcomes in real time.
              </div>
            )}
          </Card>
        </div>
      </Tabs>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Activity; label: string; value: string | number; tone?: "info" | "warning" | "success" | "accent" }) {
  const toneCls = tone === "info" ? "text-info bg-info/10"
    : tone === "warning" ? "text-warning-foreground bg-warning/15"
    : tone === "success" ? "text-success bg-success/10"
    : tone === "accent" ? "text-accent bg-accent/10"
    : "text-foreground bg-muted";
  return (
    <div className="rounded-lg border bg-card/60 p-3">
      <div className="flex items-center gap-2">
        <div className={cn("h-7 w-7 rounded-md flex items-center justify-center", toneCls)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </div>
      <div className="mt-1.5 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function StagePill({ stage }: { stage: VisitStage }) {
  const m = STAGE_META[stage];
  const tone = stageTone(stage);
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border", tone.className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
      {m.label}
    </span>
  );
}

function LiveTimer({ since, kind = "visit" }: { since: number; kind?: "visit" | "post" | "journey" }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  void tick;
  const elapsed = Date.now() - since;
  const sec = Math.floor(elapsed / 1000);
  const tone = kind === "post"
    ? (elapsed < 4 * 3600_000 ? "text-success" : elapsed < 12 * 3600_000 ? "text-warning-foreground" : "text-destructive")
    : timerTone(sec);
  return (
    <span className={cn("font-mono text-xs tabular-nums font-semibold", tone)}>
      {fmtElapsed(elapsed)}
    </span>
  );
}

function Countdown({ to }: { to: number }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick((n) => n + 1), 1000); return () => clearInterval(id); }, []);
  void tick;
  const ms = to - Date.now();
  if (ms <= 0) return <span className="font-mono text-xs text-destructive font-semibold">NOW</span>;
  const tone = ms < 15 * 60_000 ? "text-destructive" : ms < 60 * 60_000 ? "text-warning-foreground" : "text-info";
  return <span className={cn("font-mono text-xs tabular-nums font-semibold", tone)}>in {fmtElapsed(ms)}</span>;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* UPCOMING                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

function UpcomingPanel({ list, mounted, onFocus }: { list: VisitRecord[]; now: number; mounted: boolean; onFocus: (id: string) => void }) {
  if (list.length === 0) {
    return <div className="text-sm py-16 text-center text-muted-foreground">No visits scheduled in the next 24 hours.</div>;
  }
  return (
    <div className="space-y-2">
      {list.map((v) => {
        const ms = v.scheduledAt - Date.now();
        const risk = ms < 30 * 60_000 ? "high" : ms < 2 * 3600_000 ? "med" : "low";
        const riskCls = risk === "high" ? "border-l-destructive" : risk === "med" ? "border-l-warning" : "border-l-info";
        return (
          <Card key={v.tourId} className={cn("p-3 border-l-4 hover:bg-muted/40 transition-colors cursor-pointer", riskCls)}
                onClick={() => onFocus(v.tourId)}>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{v.leadName}</div>
                <div className="text-[11px] text-muted-foreground">
                  {v.propertyName} · {v.propertyArea} · {v.tcmName}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-mono tabular-nums text-muted-foreground">
                  {mounted ? new Date(v.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
                </div>
                <Countdown to={v.scheduledAt} />
              </div>
              <Badge variant="outline" className={cn(
                "uppercase",
                risk === "high" ? "border-destructive/40 bg-destructive/10 text-destructive"
                : risk === "med" ? "border-warning/40 bg-warning/15 text-warning-foreground"
                : "border-info/40 bg-info/10 text-info"
              )}>{risk === "high" ? "Imminent" : risk === "med" ? "Soon" : "Scheduled"}</Badge>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* LIVE BOARD                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

function LiveBoard({ list, now, mounted, onFocus, focus }: {
  list: VisitRecord[]; now: number; mounted: boolean; onFocus: (id: string) => void; focus: string | null;
}) {
  if (list.length === 0) {
    return <div className="text-sm py-16 text-center text-muted-foreground">No active visits. Schedule one from the Impact Queue to begin.</div>;
  }
  return (
    <div className="space-y-2">
      {list.map((v) => {
        const prob = probabilityFor(v.reaction, v.objections.length, v.stage);
        const latestObj = v.objections[0];
        const isFocus = focus === v.tourId;
        const leftTint = v.escalated ? "border-l-destructive"
          : v.warnedAtRisk ? "border-l-warning"
          : v.stage === "tour-ongoing" ? "border-l-warning"
          : v.stage === "at-property" ? "border-l-success"
          : v.stage === "started" ? "border-l-info"
          : "border-l-muted";
        const sec = v.startedAt ? Math.floor((now - v.startedAt) / 1000) : 0;
        const postSec = v.completedAt ? Math.floor((now - v.completedAt) / 1000) : 0;
        return (
          <Card key={v.tourId}
                onClick={() => onFocus(v.tourId)}
                className={cn(
                  "p-3 border-l-4 cursor-pointer transition-all hover:bg-muted/40",
                  leftTint,
                  isFocus && "ring-2 ring-accent/40 bg-muted/40"
                )}>
            <div className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-12 md:col-span-3 min-w-0">
                <div className="font-semibold truncate">{v.leadName}</div>
                <div className="text-[11px] text-muted-foreground font-mono">
                  ••{v.leadPhone.slice(-4)} · {v.tcmName}
                </div>
              </div>
              <div className="col-span-6 md:col-span-3 min-w-0">
                <div className="text-xs truncate font-medium">{v.propertyName}</div>
                <div className="text-[11px] text-muted-foreground">{v.propertyArea}</div>
              </div>
              <div className="col-span-3 md:col-span-1 text-[11px] font-mono text-muted-foreground tabular-nums">
                {mounted ? new Date(v.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--"}
              </div>
              <div className="col-span-3 md:col-span-2 flex flex-col gap-1 items-start">
                <StagePill stage={v.stage} />
                {v.escalated && <Badge variant="destructive" className="text-[9px] h-4 px-1 animate-pulse">ESCALATE</Badge>}
                {!v.escalated && v.warnedAtRisk && v.stage !== "completed" && (
                  <Badge variant="outline" className="text-[9px] h-4 px-1 border-warning/40 bg-warning/15 text-warning-foreground">At Risk</Badge>
                )}
              </div>
              <div className="col-span-6 md:col-span-1">
                {v.startedAt && !v.completedAt && (
                  <div>
                    <div className="text-[9px] uppercase text-muted-foreground tracking-wider">Visit</div>
                    <span className={cn("font-mono text-xs tabular-nums font-semibold", timerTone(sec))}>
                      {fmtElapsed(now - v.startedAt)}
                    </span>
                  </div>
                )}
                {v.completedAt && (
                  <div>
                    <div className="text-[9px] uppercase text-muted-foreground tracking-wider">Post</div>
                    <span className={cn("font-mono text-xs tabular-nums font-semibold",
                      postSec < 4*3600 ? "text-success" : postSec < 12*3600 ? "text-warning-foreground" : "text-destructive")}>
                      {fmtElapsed(now - v.completedAt)}
                    </span>
                  </div>
                )}
              </div>
              <div className="col-span-6 md:col-span-1 flex justify-end">
                <Badge variant="outline" className={cn("font-mono font-bold tabular-nums", probTone(prob))}>{prob}%</Badge>
              </div>
              <div className="col-span-12 md:col-span-1 flex md:justify-end">
                <NextActionButton v={v} onClick={() => onFocus(v.tourId)} />
              </div>
            </div>
            {latestObj && (
              <div className="mt-2 pt-2 border-t border-border/60 flex items-center gap-2 text-[11px]">
                <AlertTriangle className="h-3 w-3 text-warning-foreground" />
                <span className="text-warning-foreground font-semibold uppercase">{latestObj.category} · {latestObj.subType}</span>
                {latestObj.customerSaid && <span className="text-muted-foreground italic truncate">"{latestObj.customerSaid}"</span>}
              </div>
            )}
            <div className="mt-2 pt-2 border-t border-border/60" onClick={(e) => e.stopPropagation()}>
              <VisitCopyChips v={v} layout="inline" />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function NextActionButton({ v, onClick }: { v: VisitRecord; onClick: () => void }) {
  let label = "Open";
  if (v.stage === "scheduled") label = "Mark Started";
  else if (v.stage === "started" || v.stage === "at-property") label = "Capture";
  else if (v.stage === "tour-ongoing") label = "Complete";
  else if (v.stage === "completed") label = !v.outcome || v.outcome === "thinking" ? "Set Outcome" : "Log Objection";
  else if (v.stage === "objection") label = "Log Objection";
  else if (v.stage === "follow-up") label = "Close";
  return (
    <Button size="sm" className="h-7 text-[11px] gap-1" onClick={(e) => { e.stopPropagation(); onClick(); }}>
      {label} <ChevronRight className="h-3 w-3" />
    </Button>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* HOT LEADS                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

function HotRoom({ list, now, onFocus }: { list: VisitRecord[]; now: number; mounted: boolean; onFocus: (id: string) => void }) {
  if (list.length === 0) {
    return <div className="text-sm py-16 text-center text-muted-foreground">No hot leads in the 24-hour window.</div>;
  }
  return (
    <div className="space-y-2">
      {list.sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0)).map((v) => {
        const remaining = 24 * 3600_000 - (now - (v.completedAt ?? now));
        const hrsLeft = Math.max(0, Math.floor(remaining / 3600_000));
        const prob = probabilityFor(v.reaction, v.objections.length, v.stage);
        return (
          <Card key={v.tourId} onClick={() => onFocus(v.tourId)}
                className="p-3 border-l-4 border-l-accent cursor-pointer hover:bg-muted/40 transition-colors">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="h-10 w-10 rounded-xl bg-accent/15 text-accent flex items-center justify-center shrink-0">
                <Flame className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{v.leadName}</div>
                <div className="text-[11px] text-muted-foreground">{v.propertyName} · {v.propertyArea}</div>
                {v.objections[0] && (
                  <div className="text-[11px] mt-0.5 text-warning-foreground">
                    Latest: {v.objections[0].subType} — "{v.objections[0].customerSaid.slice(0, 60)}"
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-[9px] uppercase text-muted-foreground tracking-wider">Window</div>
                <div className={cn("font-mono text-sm font-bold", hrsLeft < 6 ? "text-destructive" : "text-warning-foreground")}>
                  {hrsLeft}h left
                </div>
              </div>
              <Badge variant="outline" className={cn("font-mono font-bold", probTone(prob))}>{prob}%</Badge>
              <div className="flex gap-1.5">
                <Button asChild size="icon" variant="default" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                  <a href={`tel:${v.leadPhone}`}><Phone className="h-3.5 w-3.5" /></a>
                </Button>
                <Button asChild size="icon" variant="outline" className="h-8 w-8 border-success/40 text-success hover:bg-success/10" onClick={(e) => e.stopPropagation()}>
                  <a href={`https://wa.me/${v.leadPhone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                    <MessageCircle className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* STATS                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

function WarRoomStats({ list }: { list: VisitRecord[] }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayMs = +today;
  const todays = list.filter((v) => v.scheduledAt >= todayMs);
  const scheduled = todays.length;
  const started = todays.filter((v) => v.startedAt).length;
  const completed = todays.filter((v) => v.completedAt).length;
  const booked = todays.filter((v) => v.outcome === "booked").length;
  const lost = todays.filter((v) => v.outcome === "lost").length;
  const conv = completed > 0 ? Math.round((booked / completed) * 100) : 0;

  const durations = todays.filter((v) => v.startedAt && v.completedAt).map((v) => (v.completedAt! - v.startedAt!) / 60_000);
  const avgDur = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

  const objCount: Record<string, number> = {};
  list.forEach((v) => v.objections.forEach((o) => { objCount[o.subType] = (objCount[o.subType] ?? 0) + 1; }));
  const topObj = Object.entries(objCount).sort((a, b) => b[1] - a[1])[0];

  const propCount: Record<string, number> = {};
  todays.forEach((v) => { propCount[v.propertyName] = (propCount[v.propertyName] ?? 0) + 1; });
  const topProp = Object.entries(propCount).sort((a, b) => b[1] - a[1])[0];

  const closerCount: Record<string, number> = {};
  todays.filter((v) => v.outcome === "booked").forEach((v) => { closerCount[v.tcmName] = (closerCount[v.tcmName] ?? 0) + 1; });
  const topCloser = Object.entries(closerCount).sort((a, b) => b[1] - a[1])[0];

  const zoneCount: Record<string, number> = {};
  todays.forEach((v) => { zoneCount[v.propertyArea] = (zoneCount[v.propertyArea] ?? 0) + 1; });
  const maxZone = Math.max(1, ...Object.values(zoneCount));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Scheduled" value={scheduled} />
        <StatCard label="Started" value={started} tone="info" />
        <StatCard label="Completed" value={completed} tone="info" />
        <StatCard label="Booked" value={booked} tone="success" />
        <StatCard label="Conversion" value={`${conv}%`} tone="accent" />
        <StatCard label="Lost" value={lost} tone="destructive" />
        <StatCard label="Avg duration" value={`${avgDur}m`} tone="warning" />
        <StatCard label="Top objection" value={topObj ? `${topObj[0]}` : "—"} sub={topObj ? `${topObj[1]} times` : ""} tone="warning" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wider mb-3 text-muted-foreground font-semibold">Visits by zone</div>
          <div className="space-y-2">
            {Object.entries(zoneCount).length === 0 && <div className="text-xs text-muted-foreground">No data yet.</div>}
            {Object.entries(zoneCount).map(([z, c]) => (
              <div key={z} className="flex items-center gap-2">
                <div className="w-28 text-xs truncate">{z}</div>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(c / maxZone) * 100}%` }} />
                </div>
                <div className="w-6 text-right font-mono text-xs text-muted-foreground tabular-nums">{c}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wider mb-3 text-muted-foreground font-semibold">Spotlight</div>
          <div className="space-y-3">
            <SpotRow icon={Building2} label="Top property" value={topProp ? `${topProp[0]} (${topProp[1]} visits)` : "—"} tone="info" />
            <SpotRow icon={TrendingUp} label="Top closer" value={topCloser ? `${topCloser[0]} (${topCloser[1]} books)` : "—"} tone="success" />
            <SpotRow icon={AlertTriangle} label="Top objection" value={topObj ? `${topObj[0]} (${topObj[1]})` : "—"} tone="warning" />
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: "info" | "warning" | "success" | "destructive" | "accent" }) {
  const valCls = tone === "info" ? "text-info"
    : tone === "warning" ? "text-warning-foreground"
    : tone === "success" ? "text-success"
    : tone === "destructive" ? "text-destructive"
    : tone === "accent" ? "text-accent"
    : "text-foreground";
  return (
    <Card className="p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className={cn("text-2xl font-bold tabular-nums mt-1 truncate", valCls)}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}

function SpotRow({ icon: Icon, label, value, tone }: { icon: typeof Activity; label: string; value: string; tone: "info" | "warning" | "success" }) {
  const cls = tone === "info" ? "text-info bg-info/10" : tone === "warning" ? "text-warning-foreground bg-warning/15" : "text-success bg-success/10";
  return (
    <div className="flex items-center gap-3">
      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", cls)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold truncate">{value}</div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* ALERT FEED                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

function AlertFeed() {
  const { alerts } = useVisitWar();
  if (alerts.length === 0) {
    return <div className="text-sm py-16 text-center text-muted-foreground">No alerts. The system pings when something needs attention.</div>;
  }
  const tone = (s: string) =>
    s === "risk" ? "border-l-destructive bg-destructive/5" :
    s === "warn" ? "border-l-warning bg-warning/5" :
    s === "win" ? "border-l-success bg-success/5" :
    "border-l-info bg-info/5";
  const tagTone = (s: string) =>
    s === "risk" ? "text-destructive" :
    s === "warn" ? "text-warning-foreground" :
    s === "win" ? "text-success" : "text-info";
  return (
    <div className="space-y-1.5">
      {alerts.map((a) => (
        <Card key={a.id} className={cn("p-2.5 border-l-4 flex items-center gap-3", tone(a.severity))}>
          <span className="font-mono text-[11px] w-20 text-muted-foreground tabular-nums">
            {new Date(a.ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
          </span>
          <span className={cn("text-[10px] font-bold uppercase tracking-wider", tagTone(a.severity))}>{a.kind}</span>
          <span className="text-xs flex-1">
            <b className="text-foreground">{a.leadName}</b> — <span className="text-muted-foreground">{a.message}</span>
          </span>
        </Card>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* DETAIL PANEL                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

function VisitDetailPanel({ v, onClose, onPatch, onAddObjection, onAlert }: {
  v: VisitRecord;
  now: number;
  onClose: () => void;
  onPatch: (p: Partial<VisitRecord>) => void;
  onAddObjection: (o: Omit<import("@/lib/visits/war-store").ObjectionEntry, "id" | "ts">) => void;
  onAlert: (severity: "info" | "warn" | "risk" | "win", kind: import("@/lib/visits/war-store").VisitAlert["kind"], message: string) => void;
}) {
  const prob = probabilityFor(v.reaction, v.objections.length, v.stage);

  const [cat, setCat] = useState<ObjectionCategory>("budget");
  const [sub, setSub] = useState<string>(OBJECTION_CATALOG.budget[0]);
  const [said, setSaid] = useState("");
  const [resp, setResp] = useState("");
  const [res, setRes] = useState<"resolved" | "partial" | "unresolved">("partial");

  // Replay timeline — derived live from the war record (re-renders on every patch)
  const replay: Array<{ ts: number; label: string; tone: "info" | "success" | "warn" | "risk" }> = [];
  replay.push({ ts: v.scheduledAt, label: "Visit scheduled", tone: "info" });
  if (v.calendarEventId) replay.push({ ts: v.scheduledAt, label: "Synced to calendar", tone: "info" });
  if (v.bufferConflictWith) replay.push({ ts: v.scheduledAt, label: "Buffer conflict flagged · <30m to neighbour visit", tone: "warn" });
  if (v.startedAt) replay.push({ ts: v.startedAt, label: `Started — ${v.startedMode ?? "on the way"}`, tone: "info" });
  if (v.reachedAt) replay.push({ ts: v.reachedAt, label: "Reached property", tone: "success" });
  if (v.ongoingAt) replay.push({ ts: v.ongoingAt, label: "Tour started", tone: "info" });
  if (v.completedAt) replay.push({ ts: v.completedAt, label: "Tour completed", tone: "success" });
  v.objections.forEach((o) => replay.push({ ts: o.ts, label: `Objection · ${o.subType}`, tone: o.resolution === "resolved" ? "success" : o.resolution === "unresolved" ? "risk" : "warn" }));
  if (v.escalated) replay.push({ ts: v.lastUpdateAt, label: "Escalated to manager", tone: "risk" });
  if (v.outcome === "booked") replay.push({ ts: v.lastUpdateAt, label: "Booking confirmed 🎉", tone: "success" });
  if (v.outcome === "lost") replay.push({ ts: v.lastUpdateAt, label: `Lost · ${v.lostReason ?? "—"}`, tone: "risk" });
  replay.sort((a, b) => a.ts - b.ts);

  return (
    <div className="flex flex-col max-h-[calc(100vh-200px)]">
      {/* Header */}
      <div className="p-4 border-b bg-muted/30 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-bold truncate">{v.leadName}</div>
          <div className="text-[11px] text-muted-foreground font-mono">
            ••{v.leadPhone.slice(-4)} · {v.propertyName}
          </div>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Status strip */}
        <div className="flex items-center gap-2 flex-wrap p-2 rounded-lg bg-muted/40">
          <StagePill stage={v.stage} />
          {v.startedAt && !v.completedAt && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3" /> Visit <LiveTimer since={v.startedAt} kind="visit" />
            </span>
          )}
          {v.startedAt && v.reachedAt && (
            <span className="text-[10px] text-muted-foreground">
              Journey {Math.round((v.reachedAt - v.startedAt) / 60_000)}m
            </span>
          )}
          {v.completedAt && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3" /> Post <LiveTimer since={v.completedAt} kind="post" />
            </span>
          )}
          <Badge variant="outline" className={cn("ml-auto font-mono font-bold", probTone(prob))}>
            <Gauge className="h-3 w-3 mr-1" /> {prob}%
          </Badge>
        </div>

        <Section title="1 · Scheduled">
          <KV k="Time" v={new Date(v.scheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} />
          <KV k="Property" v={`${v.propertyName} · ${v.propertyArea}`} />
          <KV k="Coordinator" v={v.tcmName} />
        </Section>

        <Section title="2 · Visit Started">
          <ButtonRow>
            <ActBtn label="On The Way" tone="info" active={v.startedMode === "on-the-way"} onClick={() => {
              onPatch({ stage: "started", startedMode: "on-the-way", startedAt: v.startedAt ?? Date.now() });
              onAlert("info", "started", "Customer on the way");
            }} />
            <ActBtn label="Reached" tone="success" active={v.startedMode === "reached"} onClick={() => {
              onPatch({ stage: "at-property", startedMode: "reached", startedAt: v.startedAt ?? Date.now(), reachedAt: Date.now() });
              onAlert("win", "reached", "Reached property");
            }} />
            <ActBtn label="Delayed" tone="warning" active={v.startedMode === "delayed"} onClick={() => {
              onPatch({ startedMode: "delayed" });
              onAlert("warn", "delay", "Customer delayed");
            }} />
            <ActBtn label="No Show" tone="destructive" active={v.startedMode === "no-show"} onClick={() => {
              onPatch({ stage: "lost", startedMode: "no-show", outcome: "lost" });
              onAlert("risk", "lost", "No-show");
            }} />
          </ButtonRow>
        </Section>

        <Section title="3 · Tour Ongoing · Reaction">
          <ButtonRow>
            {(["loved", "interested", "comparing", "average", "rejected"] as Reaction[]).map((r) => {
              const emoji = { loved: "😍", interested: "🙂", comparing: "🤔", average: "😐", rejected: "❌" }[r];
              const active = v.reaction === r;
              return (
                <Button key={r} size="sm" variant={active ? "default" : "outline"}
                        className="h-8 gap-1 capitalize"
                        onClick={() => onPatch({
                          reaction: r,
                          stage: v.stage === "completed" ? "completed" : "tour-ongoing",
                          ongoingAt: v.ongoingAt ?? Date.now(),
                        })}>
                  <span>{emoji}</span>{r}
                </Button>
              );
            })}
          </ButtonRow>
        </Section>

        <Section title="4 · Visit Done · Decision">
          <ButtonRow>
            {([
              ["ready-to-book", "Ready To Book", "success"],
              ["needs-discussion", "Needs Discussion", undefined],
              ["comparing-options", "Comparing", undefined],
              ["parent-approval", "Parent Approval", undefined],
              ["budget-pending", "Budget Pending", undefined],
              ["not-interested", "Not Interested", "destructive"],
            ] as Array<[Decision, string, ToneKey | undefined]>).map(([d, label, tone]) => (
              <ActBtn key={d} label={label} tone={tone} active={v.decision === d}
                onClick={() => {
                  onPatch({
                    decision: d,
                    stage: d === "not-interested" ? "lost" : "completed",
                    completedAt: v.completedAt ?? Date.now(),
                    outcome: d === "ready-to-book" ? "thinking" : d === "not-interested" ? "lost" : "thinking",
                  });
                  onAlert(d === "not-interested" ? "risk" : "info", "completed", `Visit done · ${label}`);
                }} />
            ))}
          </ButtonRow>
        </Section>

        <Section title="5 · Objection Tracker">
          {v.objections.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {v.objections.map((o) => (
                <div key={o.id} className="p-2 rounded-lg bg-muted/50 text-[11px] border">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px] uppercase border-warning/40 bg-warning/15 text-warning-foreground">{o.category}</Badge>
                    <span className="font-semibold">{o.subType}</span>
                    <Badge variant="outline" className={cn(
                      "ml-auto text-[9px] uppercase",
                      o.resolution === "resolved" ? "border-success/40 bg-success/10 text-success"
                      : o.resolution === "partial" ? "border-warning/40 bg-warning/15 text-warning-foreground"
                      : "border-destructive/40 bg-destructive/10 text-destructive"
                    )}>{o.resolution}</Badge>
                  </div>
                  {o.customerSaid && <div className="mt-1 text-foreground">"{o.customerSaid}"</div>}
                  {o.salesResponse && <div className="mt-0.5 italic text-muted-foreground">→ {o.salesResponse}</div>}
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <Select value={cat} onValueChange={(c) => { setCat(c as ObjectionCategory); setSub(OBJECTION_CATALOG[c as ObjectionCategory][0]); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.keys(OBJECTION_CATALOG).map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sub} onValueChange={setSub}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {OBJECTION_CATALOG[cat].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Textarea value={said} onChange={(e) => setSaid(e.target.value)} rows={2}
                    placeholder='Customer exact words — "my office is 8 km away..."'
                    className="text-xs mb-2" />
          <Textarea value={resp} onChange={(e) => setResp(e.target.value)} rows={2}
                    placeholder="Sales response — what did you say back?"
                    className="text-xs mb-2" />
          <div className="flex items-center gap-1.5 flex-wrap">
            {(["resolved", "partial", "unresolved"] as const).map((r) => (
              <Button key={r} size="sm" variant={res === r ? "default" : "outline"}
                      className={cn("h-7 text-[11px] capitalize",
                        res === r && r === "resolved" && "bg-success hover:bg-success/90",
                        res === r && r === "unresolved" && "bg-destructive hover:bg-destructive/90"
                      )}
                      onClick={() => setRes(r)}>{r}</Button>
            ))}
            <Button size="sm" className="ml-auto h-7 text-[11px] gap-1"
                    onClick={() => {
                      if (!sub) return;
                      onAddObjection({ category: cat, subType: sub, customerSaid: said, salesResponse: resp, resolution: res });
                      setSaid(""); setResp(""); setRes("partial");
                    }}>
              <Plus className="h-3 w-3" /> Log
            </Button>
          </div>
        </Section>

        <Section title="6 · Follow-up Stage">
          <div className="grid grid-cols-2 gap-1.5">
            {([
              ["fu-1", "Follow-up 1"], ["fu-2", "Follow-up 2"], ["fu-3", "Follow-up 3"],
              ["negotiation", "Negotiation"], ["waiting-salary", "Wait · Salary"],
              ["waiting-joining", "Wait · Joining"], ["waiting-parents", "Wait · Parents"],
              ["booking-expected", "Booking Expected"],
            ] as Array<[FollowUpStage, string]>).map(([k, label]) => (
              <Button key={k} size="sm" variant={v.followUpStage === k ? "default" : "outline"}
                      className="h-7 text-[11px] justify-start"
                      onClick={() => onPatch({ followUpStage: k, stage: "follow-up" })}>
                {label}
              </Button>
            ))}
          </div>
        </Section>

        <Section title="7 · Final Outcome">
          <ButtonRow>
            <ActBtn label="✅ Booked" tone="success" active={v.outcome === "booked"}
              onClick={() => { onPatch({ stage: "booked", outcome: "booked" }); onAlert("win", "booked", "Booking closed"); }} />
            <ActBtn label="🟡 Thinking" active={v.outcome === "thinking"} onClick={() => onPatch({ outcome: "thinking" })} />
            <ActBtn label="🔵 Follow-up" tone="info" active={v.outcome === "follow-up"} onClick={() => onPatch({ outcome: "follow-up", stage: "follow-up" })} />
            <ActBtn label="🔴 Lost" tone="destructive" active={v.outcome === "lost"}
              onClick={() => { onPatch({ stage: "lost", outcome: "lost" }); onAlert("risk", "lost", "Visit lost"); }} />
          </ButtonRow>
        </Section>

        {v.outcome === "lost" && (
          <Section title="Why Lost?">
            <div className="grid grid-cols-2 gap-1.5">
              {([
                ["chose-another-pg", "Chose Another PG"], ["chose-flat", "Chose Flat"],
                ["cancelled-relocation", "Cancelled Move"], ["budget", "Budget"],
                ["location", "Location"], ["amenities", "Amenities"],
                ["family-rejected", "Family Rejected"], ["no-response", "No Response"],
                ["joined-different-company", "Different Co."], ["college-plan-changed", "College Changed"],
              ] as Array<[LostReason, string]>).map(([k, label]) => (
                <Button key={k} size="sm" variant={v.lostReason === k ? "destructive" : "outline"}
                        className="h-7 text-[11px] justify-start"
                        onClick={() => onPatch({ lostReason: k })}>{label}</Button>
              ))}
            </div>
          </Section>
        )}

        {/* REPLAY TIMELINE */}
        <Section title="📼 Visit Replay">
          <div className="space-y-1.5 border-l-2 border-border ml-1 pl-3">
            {replay.length === 0 && <div className="text-xs text-muted-foreground">No events yet.</div>}
            {replay.map((e, i) => {
              const dot = e.tone === "risk" ? "bg-destructive" : e.tone === "warn" ? "bg-warning" : e.tone === "success" ? "bg-success" : "bg-info";
              return (
                <div key={i} className="relative">
                  <span className={cn("absolute -left-[17px] top-1.5 h-2 w-2 rounded-full", dot)} />
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                      {new Date(e.ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}
                    </span>
                    <span className="text-xs">{e.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="📲 WhatsApp Copy Block">
          <VisitCopyChips v={v} />
        </Section>

        <Section title="🎯 Coach & Intervention">
          <CoachNoteThread v={v} />
        </Section>
      </div>

      {/* Sticky footer actions */}
      <div className="border-t p-3 flex gap-2 bg-muted/30">
        <Button asChild className="flex-1 gap-1.5"><a href={`tel:${v.leadPhone}`}><Phone className="h-3.5 w-3.5" /> Call</a></Button>
        <Button asChild variant="outline" className="flex-1 gap-1.5 border-success/40 text-success hover:bg-success/10">
          <a href={`https://wa.me/${v.leadPhone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </a>
        </Button>
      </div>
    </div>
  );
}

/* ── tiny atoms ──────────────────────────────────────────────────────────── */

type ToneKey = "info" | "success" | "warning" | "destructive";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.15em] mb-2 text-accent font-bold">{title}</div>
      <div>{children}</div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between text-[11px] py-0.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}

function ButtonRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}

function ActBtn({ label, onClick, tone, active }: { label: string; onClick: () => void; tone?: ToneKey; active?: boolean }) {
  const activeCls =
    tone === "success" ? "bg-success text-success-foreground hover:bg-success/90" :
    tone === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" :
    tone === "warning" ? "bg-warning text-warning-foreground hover:bg-warning/90" :
    tone === "info" ? "bg-info text-info-foreground hover:bg-info/90" :
    "";
  return (
    <Button size="sm" variant={active ? "default" : "outline"}
            className={cn("h-8 text-xs", active && activeCls)}
            onClick={onClick}>
      {label}
    </Button>
  );
}
