// PTQ — Post Tour Qualification engine.
// Classifies a visit into A/B/C/D/E buckets per the Gharpayy framework.

import type { PTQScore, PTQBucket } from "./types";

export interface PTQVerdict {
  bucket: PTQBucket;
  label: string;
  tone: "success" | "accent" | "warning" | "destructive" | "muted";
  priority: string;
  reasons: string[];
  nextAction: { label: string; hint: string };
  completion: number; // 0-100 of the 5-card scorecard
}

const REQUIRED_FIELDS: (keyof PTQScore)[] = [
  "propertyFit", "budgetFit", "locationFit", "decisionReadiness", "moveInUrgency",
];

export function ptqCompletion(p: PTQScore | undefined): number {
  if (!p) return 0;
  const filled = REQUIRED_FIELDS.filter((k) => p[k] != null).length;
  return Math.round((filled / REQUIRED_FIELDS.length) * 100);
}

export function classifyPTQ(p: PTQScore | undefined): PTQVerdict {
  const empty: PTQVerdict = {
    bucket: "C", label: "Scorecard incomplete", tone: "muted",
    priority: "Fill all 5 fits to classify",
    reasons: [], completion: 0,
    nextAction: { label: "Complete scorecard", hint: "Score Property / Budget / Location / Decision / Move-in" },
  };
  if (!p) return empty;
  const completion = ptqCompletion(p);
  if (completion < 100) return { ...empty, completion };

  const reasons: string[] = [];
  const isLost =
    p.biggestObjection === "competition" ||
    (p.propertyFit === "poor" && p.budgetFit === "objection");

  // PTQ-E — Lost after visit
  if (isLost) {
    return {
      bucket: "E", label: "Lost after visit", tone: "muted",
      priority: "Closed Lost · capture reason",
      reasons: ["Major objection or moved to competitor"],
      completion,
      nextAction: { label: "Log lost reason", hint: "Update competitor / cancelled / not-looking" },
    };
  }

  // PTQ-D — At Risk: any major objection bucket
  const hasMajorObjection =
    p.budgetFit === "objection" || p.locationFit === "rejected" ||
    p.propertyFit === "poor" || p.biggestObjection === "amenities";
  if (hasMajorObjection) {
    if (p.budgetFit === "objection") reasons.push("Budget objection");
    if (p.locationFit === "rejected") reasons.push("Location rejected");
    if (p.propertyFit === "poor") reasons.push("Property fit poor");
    if (p.biggestObjection === "amenities") reasons.push("Amenities concern");
    return {
      bucket: "D", label: "At risk · recovery required", tone: "destructive",
      priority: "Assign recovery specialist · share alternative",
      reasons, completion,
      nextAction: { label: "Send alternative property", hint: "Objection-handling workflow + alt PG within 2h" },
    };
  }

  // PTQ-A — Booking ready
  const aReady =
    p.propertyFit === "perfect" &&
    p.budgetFit === "comfortable" &&
    p.decisionReadiness === "self-now" &&
    (p.moveInUrgency === "immediate" || p.moveInUrgency === "7d");
  if (aReady) {
    return {
      bucket: "A", label: "Booking ready", tone: "success",
      priority: "🔥 Highest · token expected today",
      reasons: ["Perfect fit", "Comfortable budget", "Self-decider", "Move-in ≤7d"],
      completion,
      nextAction: { label: "Send payment link", hint: "Follow up every 4 hours until token paid" },
    };
  }

  // PTQ-B — Hot prospect
  const bHot =
    p.propertyFit !== "poor" &&
    p.budgetFit !== "objection" &&
    (p.decisionReadiness === "parent-pending" ||
      p.decisionReadiness === "group-pending" ||
      p.decisionReadiness === "company-pending" ||
      p.budgetFit === "stretch" ||
      p.locationFit === "concern");
  if (bHot) {
    if (p.decisionReadiness === "parent-pending") reasons.push("Parent approval pending");
    if (p.decisionReadiness === "group-pending") reasons.push("Group decision pending");
    if (p.decisionReadiness === "company-pending") reasons.push("Company approval pending");
    if (p.budgetFit === "stretch") reasons.push("Stretch budget");
    if (p.locationFit === "concern") reasons.push("Minor location concern");
    return {
      bucket: "B", label: "Hot prospect", tone: "warning",
      priority: "🟠 High · follow up daily",
      reasons: reasons.length ? reasons : ["Likes property, minor objection"],
      completion,
      nextAction: { label: "Objection handling call", hint: "Daily follow-up · resolve top objection" },
    };
  }

  // PTQ-C — Warm prospect (default)
  return {
    bucket: "C", label: "Warm prospect", tone: "accent",
    priority: "🟡 Medium · nurture",
    reasons: ["Interested but not committed"],
    completion,
    nextAction: { label: "Add to nurture sequence", hint: "Follow up every 3 days" },
  };
}

export const PTQ_FOLLOW_UP_HOURS: Record<PTQBucket, number> = {
  A: 4, B: 24, C: 72, D: 12, E: 168,
};
