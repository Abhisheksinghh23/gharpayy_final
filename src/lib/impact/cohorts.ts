import type { Lead } from "@/lib/types";

export type Cohort = "active" | "awaiting" | "no-response" | "future" | "cold" | "closed";

export const COHORT_META: Record<Cohort, { label: string; icon: string; tone: string }> = {
  active:        { label: "Active",       icon: "🔥", tone: "text-orange-500" },
  awaiting:      { label: "Awaiting",     icon: "☎", tone: "text-blue-500" },
  "no-response": { label: "No Response",  icon: "💤", tone: "text-zinc-400" },
  future:        { label: "Future",       icon: "📅", tone: "text-violet-500" },
  cold:          { label: "Cold",         icon: "❄", tone: "text-cyan-500" },
  closed:        { label: "Closed",       icon: "✅", tone: "text-success" },
};

export const COHORT_ORDER: Cohort[] = ["active", "awaiting", "no-response", "future", "cold", "closed"];

const DAY = 86_400_000;

export function classify(lead: Lead, now = Date.now()): Cohort {
  if (lead.stage === "booked" || lead.stage === "dropped") return "closed";
  const moveInMs = +new Date(lead.moveInDate);
  if (!Number.isNaN(moveInMs) && (moveInMs - now) > 30 * DAY) return "future";
  const since = (now - +new Date(lead.updatedAt)) / DAY;
  if (lead.tags?.includes("not-now") || lead.tags?.includes("cold")) return "cold";
  if (lead.stage === "tour-scheduled" || lead.stage === "tour-done" || lead.stage === "negotiation") return "active";
  if (since <= 3) return "awaiting";
  if (since > 3) return "no-response";
  return "active";
}

export function daysInStage(lead: Lead, now = Date.now()): number {
  return Math.floor((now - +new Date(lead.updatedAt)) / DAY);
}

export function isStuck(lead: Lead, now = Date.now()): boolean {
  if (lead.stage === "booked" || lead.stage === "dropped") return false;
  return daysInStage(lead, now) >= 5;
}

export function classifyAll(leads: Lead[], now = Date.now()): Record<Cohort, Lead[]> {
  const out: Record<Cohort, Lead[]> = {
    active: [], awaiting: [], "no-response": [], future: [], cold: [], closed: [],
  };
  leads.forEach((l) => out[classify(l, now)].push(l));
  return out;
}
