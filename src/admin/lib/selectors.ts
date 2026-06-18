/**
 * Admin cross-store joiner. Produces a single row per lead containing every
 * piece of information from every store the admin cares about, plus an
 * auto-derived "Why not closed" diagnostic string.
 *
 * Pure functions — safe inside useMemo.
 */
import type { Lead, Tour, TCM, Booking, FollowUp } from "@/lib/types";
import type { CallRecord, ObjectionRecord, AssignmentRecord, CoachingNote, MessageOutcome, DeepLeadProfile } from "@/lib/crm10x/types";
import type { VisitRecord } from "@/lib/visits/war-store";

export interface AdminLeadRow {
  lead: Lead;
  tcm?: TCM;
  profile?: DeepLeadProfile;
  tours: Tour[];
  visits: VisitRecord[];
  bookings: Booking[];
  calls: CallRecord[];
  objections: ObjectionRecord[];
  messages: MessageOutcome[];
  assignments: AssignmentRecord[];
  coachNotes: CoachingNote[];
  followUps: FollowUp[];
  // derived
  lastTouchTs: number;
  lastObjection?: ObjectionRecord;
  probability: number;     // 0-100
  expectedValue: number;   // ₹ projected revenue
  whyNotClosed: string;    // human-readable single line
  status: "open" | "booked" | "lost" | "dormant";
  hasVisit: boolean;
  booked: boolean;
  dormantBucket: "30d" | "60d" | "90d" | null;
  reassignedCount: number;
}

export interface JoinSources {
  leads: Lead[];
  tours: Tour[];
  tcms: TCM[];
  bookings: Booking[];
  followUps: FollowUp[];
  profiles: Record<string, DeepLeadProfile>;
  objections: ObjectionRecord[];
  calls: CallRecord[];
  visits: Record<string, VisitRecord>;
  assignments: AssignmentRecord[];
  coachingNotes: CoachingNote[];
  messageOutcomes: MessageOutcome[];
}

const DAY = 86_400_000;

export function joinAdmin(src: JoinSources): AdminLeadRow[] {
  const now = Date.now();
  const toursByLead = groupBy(src.tours, (t) => t.leadId);
  const visitsByLead = Object.values(src.visits).reduce<Record<string, VisitRecord[]>>((acc, v) => {
    (acc[v.leadId] ||= []).push(v);
    return acc;
  }, {});
  const bookingsByLead = groupBy(src.bookings, (b) => b.leadId);
  const callsByLead = groupBy(src.calls, (c) => c.leadId);
  const objByLead = groupBy(src.objections, (o) => o.leadId);
  const msgByLead = groupBy(src.messageOutcomes, (m) => m.leadId);
  const asgByLead = groupBy(src.assignments, (a) => a.leadId);
  const cnByLead = groupBy(src.coachingNotes, (c) => c.leadId);
  const fuByLead = groupBy(src.followUps, (f) => f.leadId);

  return src.leads.map((lead) => {
    const tcm = src.tcms.find((t) => t.id === lead.assignedTcmId);
    const tours = toursByLead[lead.id] ?? [];
    const visits = visitsByLead[lead.id] ?? [];
    const bookings = bookingsByLead[lead.id] ?? [];
    const calls = callsByLead[lead.id] ?? [];
    const objections = (objByLead[lead.id] ?? []).slice().sort((a, b) => +new Date(b.ts) - +new Date(a.ts));
    const messages = msgByLead[lead.id] ?? [];
    const assignments = asgByLead[lead.id] ?? [];
    const coachNotes = cnByLead[lead.id] ?? [];
    const followUps = fuByLead[lead.id] ?? [];

    const lastObjection = objections.find((o) => o.code !== "none");
    const lastTouchTs = Math.max(
      +new Date(lead.updatedAt),
      ...tours.map((t) => +new Date(t.updatedAt)),
      ...calls.map((c) => +new Date(c.ts)),
      ...messages.map((m) => +new Date(m.ts)),
      ...objections.map((o) => +new Date(o.ts)),
    );

    const probability = computeProbability(lead, tours, visits, objections, calls.length);
    const expectedValue = computeExpectedValue(lead, probability);
    const booked = lead.stage === "booked" || bookings.length > 0;
    const ageDays = Math.floor((now - lastTouchTs) / DAY);
    const dormantBucket: "30d" | "60d" | "90d" | null =
      ageDays >= 90 ? "90d" : ageDays >= 60 ? "60d" : ageDays >= 30 ? "30d" : null;
    const status: AdminLeadRow["status"] = booked
      ? "booked"
      : lead.stage === "dropped"
        ? "lost"
        : dormantBucket
          ? "dormant"
          : "open";

    return {
      lead, tcm, profile: src.profiles[lead.id], tours, visits, bookings,
      calls, objections, messages, assignments, coachNotes, followUps,
      lastTouchTs,
      lastObjection,
      probability,
      expectedValue,
      whyNotClosed: deriveWhyNotClosed({ lead, tours, visits, objections, calls, messages, ageDays, booked, lastObjection }),
      status,
      hasVisit: visits.length > 0 || tours.length > 0,
      booked,
      dormantBucket,
      reassignedCount: assignments.length,
    };
  });
}

function computeProbability(
  lead: Lead, tours: Tour[], visits: VisitRecord[], objs: ObjectionRecord[], callCount: number,
): number {
  let p = lead.confidence ?? 0;
  if (lead.stage === "booked") return 100;
  if (lead.stage === "dropped") return 0;
  if (lead.stage === "negotiation") p = Math.max(p, 70);
  if (lead.stage === "tour-done") p = Math.max(p, 55);
  if (lead.stage === "tour-scheduled") p = Math.max(p, 40);
  if (visits.some((v) => v.stage === "booked")) return 100;
  if (visits.some((v) => v.outcome === "thinking")) p = Math.max(p, 60);
  if (visits.some((v) => v.outcome === "lost")) p = 5;
  const unresolved = objs.filter((o) => o.resolution !== "yes" && o.code !== "none").length;
  p = Math.max(0, p - unresolved * 8);
  if (callCount > 5) p = Math.max(0, p - 5);
  return Math.max(0, Math.min(100, Math.round(p)));
}

function computeExpectedValue(lead: Lead, probability: number): number {
  // 12-month projected revenue at lead's stated budget, weighted by probability.
  return Math.round((lead.budget || 0) * 12 * (probability / 100));
}

function deriveWhyNotClosed(args: {
  lead: Lead; tours: Tour[]; visits: VisitRecord[]; objections: ObjectionRecord[];
  calls: CallRecord[]; messages: MessageOutcome[]; ageDays: number; booked: boolean;
  lastObjection?: ObjectionRecord;
}): string {
  const { lead, tours, visits, objections, calls, ageDays, booked, lastObjection } = args;
  if (booked) return "—";
  if (lead.stage === "dropped") {
    const lost = visits.find((v) => v.lostReason);
    return `Dropped${lost?.lostReason ? ` · ${lost.lostReason}` : ""}`;
  }
  if (lastObjection && lastObjection.resolution !== "yes") {
    return `Objection unresolved · ${lastObjection.code}`;
  }
  if (lead.stage === "negotiation") return "Stuck in negotiation — needs token push";
  if (lead.stage === "tour-done") return "Post-tour follow-up overdue";
  if (lead.stage === "tour-scheduled") {
    const t = tours[0];
    if (t && +new Date(t.scheduledAt) < Date.now()) return "Tour date passed — needs reschedule";
    return "Awaiting tour";
  }
  if (lead.stage === "contacted" && calls.length === 0) return "Contacted but never called";
  if (lead.stage === "new") return ageDays > 1 ? `New for ${ageDays}d — never contacted` : "Fresh lead";
  if (ageDays >= 30) return `Dormant ${ageDays}d — no touch`;
  return "Active — keep nurturing";
}

function groupBy<T, K extends string>(arr: T[], key: (t: T) => K | undefined): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  arr.forEach((item) => {
    const k = key(item);
    if (!k) return;
    (out[k] ||= []).push(item);
  });
  return out;
}

export function summarizeWhyNotClosing(rows: AdminLeadRow[]) {
  const open = rows.filter((r) => r.status === "open" || r.status === "dormant");
  const counts = new Map<string, number>();
  open.forEach((r) => {
    const k = r.whyNotClosed.split(" · ")[0];
    counts.set(k, (counts.get(k) ?? 0) + 1);
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([reason, count]) => ({ reason, count }));
}

export function summarizeTopObjections(objs: ObjectionRecord[]) {
  const counts = new Map<string, number>();
  objs.filter((o) => o.code !== "none").forEach((o) => {
    counts.set(o.code, (counts.get(o.code) ?? 0) + 1);
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([code, count]) => ({ code, count }));
}
