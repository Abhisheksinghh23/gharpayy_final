/**
 * War-room demo seed: 30 fake users in 4 zones, each carrying 500–1,000 leads,
 * with matching pods (scheduler/runner/closer), tours, bookings, quotations
 * and follow-ups. Idempotent — clearDemo() wipes only demo-tagged records
 * and restores the original mock baseline.
 */
import { useApp } from "@/lib/store";
import { useQuotations, type Quotation } from "@/lib/crm10x/quotations";
import { usePods, type Pod, type PodRole } from "@/lib/pods/store";
import { TCMS, LEADS, TOURS, ACTIVITIES, FOLLOWUPS, PROPERTIES } from "@/lib/mock-data";
import type { Lead, TCM, Tour, FollowUp, Intent, LeadStage, Booking } from "@/lib/types";

const DEMO_TAG = "__demo30x600";

/* ---------------- helpers ---------------- */
function rnd<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rndInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function chance(pct: number) { return Math.random() * 100 < pct; }
function isoDaysFromNow(d: number) { return new Date(Date.now() + d * 86_400_000).toISOString(); }

const FIRST_NAMES = ["Aarav","Vivaan","Aditya","Vihaan","Arjun","Krishna","Ishaan","Rohan","Kabir","Ansh","Sai","Reyansh","Aanya","Diya","Aadhya","Saanvi","Pari","Anika","Myra","Ira","Riya","Tara","Zara","Kiara","John","Sara","Liam","Emma","Noah","Olivia"];
const LAST_NAMES = ["Sharma","Verma","Gupta","Singh","Patel","Reddy","Iyer","Nair","Khan","Mehta","Joshi","Kapoor","Bose","Das","Roy","Shah","Pillai","Menon","Smith","Wong"];
const SOURCES = ["WhatsApp","Meta Ads","Website","Referral","CSV Import","Manual","Google","Justdial","99acres","Walk-in"];
const SEGMENTS = ["Student","Working Pro","Parents","International"] as const;

/** 4 zones × pod role split. Numbers sum to 30 users. */
const ZONE_PLAN = [
  { zone: "Bangalore Central", scheduler: 4, runner: 2, closer: 2 }, // 8
  { zone: "Pune Central",      scheduler: 4, runner: 2, closer: 2 }, // 8
  { zone: "Hyderabad Central", scheduler: 4, runner: 2, closer: 1 }, // 7
  { zone: "Mumbai Central",    scheduler: 4, runner: 2, closer: 1 }, // 7
] as const;

interface SeededMember { tcm: TCM; podRole: PodRole; zone: string }

/* ---------------- generators ---------------- */
function buildOrg(): { tcms: TCM[]; members: SeededMember[]; pods: Pod[] } {
  const tcms: TCM[] = [];
  const members: SeededMember[] = [];
  const pods: Pod[] = [];
  let idx = 0; let podIdx = 0;

  for (const z of ZONE_PLAN) {
    const slots: PodRole[] = [
      ...Array(z.scheduler).fill("scheduler") as PodRole[],
      ...Array(z.runner).fill("runner") as PodRole[],
      ...Array(z.closer).fill("closer") as PodRole[],
    ];
    const podMembers: { tcmId: string; podRole: PodRole }[] = [];
    for (const role of slots) {
      idx++;
      const first = FIRST_NAMES[idx % FIRST_NAMES.length];
      const last  = LAST_NAMES[(idx * 3) % LAST_NAMES.length];
      const tcm: TCM = {
        id: `${DEMO_TAG}-tcm-${idx}`,
        name: `${first} ${last}`,
        initials: `${first[0]}${last[0]}`,
        zone: z.zone,
        conversionRate: 0.08 + Math.random() * 0.22,
        avgResponseMins: rndInt(3, 30),
      };
      tcms.push(tcm);
      members.push({ tcm, podRole: role, zone: z.zone });
      podMembers.push({ tcmId: tcm.id, podRole: role });
    }
    podIdx++;
    pods.push({
      id: `${DEMO_TAG}-pod-${podIdx}`,
      name: `Pod ${String.fromCharCode(64 + podIdx)} — ${z.zone}`,
      zone: z.zone,
      leadTcmId: podMembers[0]?.tcmId,
      members: podMembers,
    });
  }
  return { tcms, members, pods };
}

function pickSegment(): typeof SEGMENTS[number] {
  const r = Math.random() * 100;
  if (r < 35) return "Student";
  if (r < 85) return "Working Pro";
  if (r < 95) return "Parents";
  return "International";
}
function budgetForSegment(seg: typeof SEGMENTS[number]) {
  switch (seg) {
    case "Student":       return rndInt(8000, 18000);
    case "Working Pro":   return rndInt(15000, 45000);
    case "Parents":       return rndInt(18000, 35000);
    case "International": return rndInt(25000, 80000);
  }
}

/**
 * Stage distribution targets the user's 600-lead/month vision:
 *  25% scheduled, 25% done, 17% said-no, 17% future, 10% closed, 6% stuck.
 * We translate that into per-lead stages with realistic jitter.
 */
function pickStage(): LeadStage {
  const r = Math.random() * 100;
  if (r < 30) return "new";
  if (r < 45) return "contacted";
  if (r < 65) return "tour-scheduled";
  if (r < 80) return "tour-done";
  if (r < 88) return "negotiation";
  if (r < 95) return "booked";
  return "dropped";
}

function pickIntent(): Intent {
  const r = Math.random() * 100;
  if (r < 18) return "hot";
  if (r < 55) return "warm";
  return "cold";
}

function buildLeadsForMember(member: SeededMember, count: number, startIdx: number): Lead[] {
  const out: Lead[] = [];
  const propertyAreas = Array.from(new Set(PROPERTIES.map((p) => p.area)));
  for (let i = 0; i < count; i++) {
    const seg = pickSegment();
    const first = FIRST_NAMES[((startIdx + i) * 7) % FIRST_NAMES.length];
    const last  = LAST_NAMES[((startIdx + i) * 13) % LAST_NAMES.length];
    const intent = pickIntent();
    const stage = pickStage();
    const createdDays = rndInt(0, 90); // spread over 3 months for long-horizon analytics
    const updatedDelta = rndInt(-createdDays, 0);
    const tags = [DEMO_TAG, seg, member.zone,
      ...(chance(10) ? ["no-response"] : []),
      ...(stage === "dropped" ? [`lost:${rnd(["price","location","amenities","timing","comparing","not-ready"])}`] : []),
    ];
    out.push({
      id: `${DEMO_TAG}-lead-${startIdx + i + 1}`,
      name: `${first} ${last}`,
      phone: `+91 ${rndInt(70000, 99999)}${rndInt(10000, 99999)}`,
      source: rnd(SOURCES),
      budget: budgetForSegment(seg),
      moveInDate: isoDaysFromNow(rndInt(-5, 90)).slice(0, 10),
      preferredArea: rnd(propertyAreas),
      assignedTcmId: member.tcm.id,
      stage,
      intent,
      confidence: stage === "booked" ? 100 : stage === "negotiation" ? rndInt(60, 90) : stage === "tour-done" ? rndInt(40, 75) : intent === "hot" ? rndInt(40, 70) : intent === "warm" ? rndInt(20, 50) : rndInt(5, 25),
      tags,
      nextFollowUpAt: chance(75) ? isoDaysFromNow(rndInt(-3, 10)) : null,
      responseSpeedMins: rndInt(1, 240),
      createdAt: isoDaysFromNow(-createdDays),
      updatedAt: isoDaysFromNow(updatedDelta),
    });
  }
  return out;
}

function buildTours(leads: Lead[]): Tour[] {
  const out: Tour[] = [];
  for (const l of leads) {
    if (l.stage === "new" || l.stage === "contacted") continue;
    const prop = PROPERTIES[Math.floor(Math.random() * PROPERTIES.length)];
    const scheduledAt = isoDaysFromNow(l.stage === "tour-scheduled" ? rndInt(0, 7) : rndInt(-60, -1));
    const status = l.stage === "tour-scheduled" ? "scheduled" : l.stage === "dropped" && chance(40) ? "no-show" : "completed";
    const filled = status === "completed" && chance(70);
    out.push({
      id: `${DEMO_TAG}-tour-${l.id}`,
      leadId: l.id, propertyId: prop.id, tcmId: l.assignedTcmId, scheduledAt, status,
      decision: l.stage === "booked" ? "booked" : l.stage === "negotiation" ? "thinking" : l.stage === "dropped" ? "dropped" : null,
      postTour: {
        outcome: l.stage === "booked" ? "booked" : l.stage === "dropped" ? "not-interested" : filled ? "thinking" : null,
        confidence: filled ? rndInt(20, 90) : 0,
        objection: filled ? rnd(["price","location","amenities","timing","parents","comparing"]) : null,
        objectionNote: filled ? "Auto-logged demo objection." : "",
        expectedDecisionAt: filled ? isoDaysFromNow(rndInt(1, 14)) : null,
        nextFollowUpAt: filled ? isoDaysFromNow(rndInt(1, 7)) : null,
        filledAt: filled ? new Date().toISOString() : null,
      },
      createdAt: scheduledAt, updatedAt: scheduledAt,
    });
  }
  return out;
}

function buildBookings(leads: Lead[], tours: Tour[]): Booking[] {
  const tourByLead = new Map(tours.map((t) => [t.leadId, t] as const));
  return leads.filter((l) => l.stage === "booked").map((l) => {
    const t = tourByLead.get(l.id);
    return {
      id: `${DEMO_TAG}-bk-${l.id}`,
      leadId: l.id,
      tourId: t?.id ?? `${DEMO_TAG}-tour-${l.id}`,
      propertyId: t?.propertyId ?? PROPERTIES[0].id,
      tcmId: l.assignedTcmId,
      amount: l.budget,
      ts: l.updatedAt,
    };
  });
}

function buildFollowUps(leads: Lead[]): FollowUp[] {
  return leads
    .filter((l) => l.nextFollowUpAt)
    .map((l) => ({
      id: `${DEMO_TAG}-fu-${l.id}`,
      leadId: l.id, tcmId: l.assignedTcmId, dueAt: l.nextFollowUpAt!,
      priority: l.intent === "hot" ? "high" : l.intent === "warm" ? "medium" : "low",
      reason: "Demo follow-up", done: chance(20),
    }));
}

/* ---------------- public api ---------------- */
export interface SeedReport {
  tcms: number; leads: number; tours: number; bookings: number;
  followUps: number; quotes: number;
  bySegment: Record<string, number>;
  byStage: Record<string, number>;
  byZone: Record<string, number>;
  byRole: Record<string, number>;
  perUserMin: number; perUserMax: number; perUserAvg: number;
  durationMs: number;
}

export interface SeedOptions {
  /** Min/max leads per user. Each user gets a random count in [min,max]. */
  minPerUser?: number;
  maxPerUser?: number;
}

export function seedDemoCompany(opts: SeedOptions = {}): SeedReport {
  const min = opts.minPerUser ?? 500;
  const max = opts.maxPerUser ?? 1000;
  const t0 = performance.now();
  const { tcms, members, pods } = buildOrg();

  // Per-member lead packs of random size in [min,max]
  const allLeads: Lead[] = [];
  const perCounts: number[] = [];
  let cursor = 0;
  for (const m of members) {
    const n = rndInt(min, max);
    perCounts.push(n);
    allLeads.push(...buildLeadsForMember(m, n, cursor));
    cursor += n;
  }

  const tours = buildTours(allLeads);
  const bookings = buildBookings(allLeads, tours);
  const fus = buildFollowUps(allLeads);

  // rollups
  const bySegment: Record<string, number> = {};
  const byStage: Record<string, number> = {};
  const byZone: Record<string, number> = {};
  const byRole: Record<string, number> = {};
  const memberMeta = new Map(members.map((m) => [m.tcm.id, m] as const));
  allLeads.forEach((l) => {
    const seg = l.tags.find((t) => SEGMENTS.includes(t as typeof SEGMENTS[number])) ?? "?";
    bySegment[seg] = (bySegment[seg] ?? 0) + 1;
    byStage[l.stage] = (byStage[l.stage] ?? 0) + 1;
    const m = memberMeta.get(l.assignedTcmId);
    if (m) {
      byZone[m.zone] = (byZone[m.zone] ?? 0) + 1;
      byRole[m.podRole] = (byRole[m.podRole] ?? 0) + 1;
    }
  });

  clearDemoData(true);

  useApp.setState((s) => ({
    tcms:  [...s.tcms.filter((x) => !x.id.startsWith(DEMO_TAG)), ...tcms],
    leads: [...s.leads.filter((x) => !x.id.startsWith(DEMO_TAG)), ...allLeads],
    tours: [...s.tours.filter((x) => !x.id.startsWith(DEMO_TAG)), ...tours],
    followUps: [...s.followUps.filter((x) => !x.id.startsWith(DEMO_TAG)), ...fus],
    bookings: [...s.bookings.filter((x) => !x.id.startsWith(DEMO_TAG)), ...bookings],
  }));

  // Replace pods with the demo zones (clean structure for the test run)
  usePods.setState((s) => ({
    pods: [...s.pods.filter((p) => !p.id.startsWith(DEMO_TAG)), ...pods],
  }));

  // Quotations on negotiation / booked
  const quoteLeads = allLeads.filter((l) => l.stage === "negotiation" || l.stage === "booked").slice(0, 1500);
  const quotes: Quotation[] = quoteLeads.map((l) => {
    const prop = PROPERTIES[Math.floor(Math.random() * PROPERTIES.length)];
    return {
      id: `${DEMO_TAG}-q-${l.id}`,
      leadId: l.id, tcmId: l.assignedTcmId, propertyId: prop.id, propertyName: prop.name,
      roomType: rnd(["Single","Double","Triple"]),
      actualRent: l.budget,
      discountedPrice: l.budget - (chance(40) ? rndInt(500, 3000) : 0),
      deposit: l.budget * 2, prebook: 1000,
      maintenance: 1500, maintenanceType: "Monthly",
      lockIn: "6 months", notice: "1 month",
      validityMinutes: 60 * 24, validUntilISO: isoDaysFromNow(1),
      message: "Demo quote", status: "sent", sentAt: isoDaysFromNow(rndInt(-7, -1)),
    };
  });
  useQuotations.setState((s) => ({
    quotations: [...s.quotations.filter((x) => !x.id.startsWith(DEMO_TAG)), ...quotes],
  } as Partial<ReturnType<typeof useQuotations.getState>>));

  const perAvg = Math.round(perCounts.reduce((a, b) => a + b, 0) / perCounts.length);
  return {
    tcms: tcms.length, leads: allLeads.length, tours: tours.length, bookings: bookings.length,
    followUps: fus.length, quotes: quotes.length,
    bySegment, byStage, byZone, byRole,
    perUserMin: Math.min(...perCounts), perUserMax: Math.max(...perCounts), perUserAvg: perAvg,
    durationMs: Math.round(performance.now() - t0),
  };
}

export function clearDemoData(keepBaseline = false): void {
  useApp.setState((s) => ({
    tcms:      keepBaseline ? s.tcms.filter((x) => !x.id.startsWith(DEMO_TAG))      : TCMS,
    leads:     keepBaseline ? s.leads.filter((x) => !x.id.startsWith(DEMO_TAG))     : LEADS,
    tours:     keepBaseline ? s.tours.filter((x) => !x.id.startsWith(DEMO_TAG))     : TOURS,
    followUps: keepBaseline ? s.followUps.filter((x) => !x.id.startsWith(DEMO_TAG)) : FOLLOWUPS,
    activities: keepBaseline ? s.activities                                         : ACTIVITIES,
    bookings:  keepBaseline ? s.bookings.filter((x) => !x.id.startsWith(DEMO_TAG))  : [],
  }));
  useQuotations.setState((s) => ({
    quotations: s.quotations.filter((x) => !x.id.startsWith(DEMO_TAG)),
  }));
  usePods.setState((s) => ({
    pods: s.pods.filter((p) => !p.id.startsWith(DEMO_TAG)),
  }));
}

export function isDemoLoaded(): boolean {
  return useApp.getState().leads.some((l) => l.id.startsWith(DEMO_TAG));
}
