import type { Lead, Tour, Booking } from "@/lib/types";
import { classify, isStuck, daysInStage } from "./cohorts";

const DAY = 86_400_000;

/** Per-person monthly target — drives all pace dots. */
export const MONTHLY_TARGET = {
  leads: 600,
  toursScheduled: 150,
  toursDone: 150,
  said_no: 100,
  future: 100,
  closed: 60,
} as const;

export interface DateRange { fromMs: number; toMs: number; label: string }

export function rangePresets(now = Date.now()): Record<string, DateRange> {
  const d = new Date(now); d.setHours(0, 0, 0, 0);
  const todayStart = +d;
  const dow = (d.getDay() + 6) % 7; // Mon=0
  const weekStart = todayStart - dow * DAY;
  const lastWeekStart = weekStart - 7 * DAY;
  const monthStart = +new Date(d.getFullYear(), d.getMonth(), 1);
  return {
    today:      { fromMs: todayStart,    toMs: todayStart + DAY,     label: "Today" },
    "7d":       { fromMs: now - 7 * DAY, toMs: now,                  label: "Last 7 days" },
    week:       { fromMs: weekStart,     toMs: weekStart + 7 * DAY,  label: "This week" },
    "last-week":{ fromMs: lastWeekStart, toMs: weekStart,            label: "Last week" },
    month:      { fromMs: monthStart,    toMs: now + DAY,            label: "This month" },
    all:        { fromMs: 0,             toMs: Number.MAX_SAFE_INTEGER, label: "All time" },
  };
}

export function inRange(iso: string, r: DateRange): boolean {
  const ms = +new Date(iso);
  return ms >= r.fromMs && ms < r.toMs;
}

export interface PaceStats {
  leads: number; scheduled: number; done: number; closed: number;
  saidNo: number; future: number; stuck: number;
  conversion: number;
}

export function paceFor(
  leads: Lead[], tours: Tour[], bookings: Booking[], range: DateRange,
): PaceStats {
  const ls = leads.filter((l) => inRange(l.createdAt, range));
  const ts = tours.filter((t) => inRange(t.createdAt, range));
  const tsDone = tours.filter((t) => t.status === "completed" && inRange(t.updatedAt, range));
  const bk = bookings.filter((b) => inRange(b.ts, range));
  const closedNo = leads.filter((l) => l.stage === "dropped" && inRange(l.updatedAt, range)).length;
  const fut = leads.filter((l) => classify(l) === "future").length;
  const stuck = leads.filter((l) => isStuck(l)).length;
  return {
    leads: ls.length,
    scheduled: ts.length,
    done: tsDone.length,
    closed: bk.length,
    saidNo: closedNo,
    future: fut,
    stuck,
    conversion: ls.length ? (bk.length / ls.length) * 100 : 0,
  };
}

export type PaceColor = "green" | "yellow" | "red";
export function paceColor(current: number, target: number, monthFraction: number): PaceColor {
  const expected = target * monthFraction;
  if (current >= expected) return "green";
  if (current >= expected * 0.7) return "yellow";
  return "red";
}

/** Fraction of current month elapsed (0..1). */
export function monthFraction(now = Date.now()): number {
  const d = new Date(now);
  const start = +new Date(d.getFullYear(), d.getMonth(), 1);
  const end = +new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return Math.min(1, Math.max(0.05, (now - start) / (end - start)));
}

export interface WeekBucket {
  weekStart: number;
  label: string;       // "W42"
  leads: number;
  tours: number;
  bookings: number;
}

export function weeklyBuckets(
  leads: Lead[], tours: Tour[], bookings: Booking[], weeks = 8, now = Date.now(),
): WeekBucket[] {
  const d = new Date(now); d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7;
  const thisWeekStart = +d - dow * DAY;
  const out: WeekBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = thisWeekStart - i * 7 * DAY;
    const end = start + 7 * DAY;
    const r: DateRange = { fromMs: start, toMs: end, label: "" };
    const dt = new Date(start);
    out.push({
      weekStart: start,
      label: `${dt.getDate()}/${dt.getMonth() + 1}`,
      leads: leads.filter((l) => inRange(l.createdAt, r)).length,
      tours: tours.filter((t) => inRange(t.createdAt, r)).length,
      bookings: bookings.filter((b) => inRange(b.ts, r)).length,
    });
  }
  return out;
}

export interface LossReason { label: string; count: number }
export function lossReasons(leads: Lead[]): LossReason[] {
  const counts = new Map<string, number>();
  leads.filter((l) => l.stage === "dropped").forEach((l) => {
    const reason = l.tags?.find((t) => t.startsWith("lost:"))?.slice(5) ?? "Unspecified";
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export interface MemberPace {
  tcmId: string;
  leads: number; tours: number; bookings: number;
  conversion: number;
  avgResponseMins: number;
}

export function leaderboard(
  tcmIds: string[], leads: Lead[], tours: Tour[], bookings: Booking[], range: DateRange,
): MemberPace[] {
  return tcmIds.map((tcmId) => {
    const myLeads = leads.filter((l) => l.assignedTcmId === tcmId && inRange(l.createdAt, range));
    const myTours = tours.filter((t) => t.tcmId === tcmId && inRange(t.createdAt, range));
    const myBk = bookings.filter((b) => b.tcmId === tcmId && inRange(b.ts, range));
    const responses = myLeads.map((l) => l.responseSpeedMins).filter((n) => n > 0);
    return {
      tcmId,
      leads: myLeads.length,
      tours: myTours.length,
      bookings: myBk.length,
      conversion: myLeads.length ? (myBk.length / myLeads.length) * 100 : 0,
      avgResponseMins: responses.length ? Math.round(responses.reduce((a, b) => a + b, 0) / responses.length) : 0,
    };
  }).sort((a, b) => b.bookings - a.bookings || b.conversion - a.conversion);
}

export interface StuckCell { stage: string; bucket: string; count: number }
const STUCK_BUCKETS = [
  { label: "1-2d", min: 1, max: 2 },
  { label: "3-4d", min: 3, max: 4 },
  { label: "5-7d", min: 5, max: 7 },
  { label: "8-14d", min: 8, max: 14 },
  { label: "15d+", min: 15, max: 9999 },
];
const STUCK_STAGES = ["new", "contacted", "tour-scheduled", "tour-done", "negotiation"];

export function stuckHeatmap(leads: Lead[]): StuckCell[] {
  const out: StuckCell[] = [];
  STUCK_STAGES.forEach((stage) => {
    STUCK_BUCKETS.forEach((b) => {
      const count = leads.filter((l) =>
        l.stage === stage &&
        (() => { const d = daysInStage(l); return d >= b.min && d <= b.max; })()
      ).length;
      out.push({ stage, bucket: b.label, count });
    });
  });
  return out;
}
export { STUCK_STAGES, STUCK_BUCKETS };
