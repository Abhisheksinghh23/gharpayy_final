// Global filters used across Leads, Tours, Bookings, Dashboards.
// State persists in URL (?gf=base64json) so links are shareable + back/forward works.

import { useCallback, useSyncExternalStore } from "react";
import type { Lead, Tour, Booking, LeadStage, Intent } from "@/lib/types";
import type { OwnerBooking } from "@/lib/owner-bookings/types";

export type DatePreset =
  | "today" | "yesterday" | "7d" | "week" | "last-week"
  | "month" | "last-month" | "quarter" | "all" | "custom";

export interface GlobalFilters {
  q: string;
  preset: DatePreset;
  fromMs: number | null;          // only when preset === "custom"
  toMs: number | null;
  zones: string[];
  memberIds: string[];            // tcm/owner ids
  roles: ("scheduler" | "runner" | "closer")[];
  stages: LeadStage[];
  intents: Intent[];
  sources: string[];
  channels: string[];
  propertyIds: string[];
  outcomes: string[];             // booked / dropped / future / no-response / closed
}

export const DEFAULT_FILTERS: GlobalFilters = {
  q: "",
  preset: "month",
  fromMs: null, toMs: null,
  zones: [], memberIds: [], roles: [],
  stages: [], intents: [], sources: [], channels: [],
  propertyIds: [], outcomes: [],
};

const DAY = 86_400_000;

export interface DateRange { fromMs: number; toMs: number; label: string }

export function resolveRange(f: GlobalFilters, now = Date.now()): DateRange {
  const d = new Date(now); d.setHours(0, 0, 0, 0);
  const todayStart = +d;
  const dow = (d.getDay() + 6) % 7;
  const weekStart = todayStart - dow * DAY;
  const monthStart = +new Date(d.getFullYear(), d.getMonth(), 1);
  const lastMonthStart = +new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const quarterStart = +new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
  switch (f.preset) {
    case "today":      return { fromMs: todayStart, toMs: todayStart + DAY, label: "Today" };
    case "yesterday":  return { fromMs: todayStart - DAY, toMs: todayStart, label: "Yesterday" };
    case "7d":         return { fromMs: now - 7 * DAY, toMs: now, label: "Last 7 days" };
    case "week":       return { fromMs: weekStart, toMs: weekStart + 7 * DAY, label: "This week" };
    case "last-week":  return { fromMs: weekStart - 7 * DAY, toMs: weekStart, label: "Last week" };
    case "month":      return { fromMs: monthStart, toMs: now + DAY, label: "This month" };
    case "last-month": return { fromMs: lastMonthStart, toMs: monthStart, label: "Last month" };
    case "quarter":    return { fromMs: quarterStart, toMs: now + DAY, label: "This quarter" };
    case "all":        return { fromMs: 0, toMs: Number.MAX_SAFE_INTEGER, label: "All time" };
    case "custom":     return {
      fromMs: f.fromMs ?? 0,
      toMs: f.toMs ?? Number.MAX_SAFE_INTEGER,
      label: "Custom",
    };
  }
}

export function inRange(iso: string | number | undefined, r: DateRange): boolean {
  if (!iso) return false;
  const ms = typeof iso === "number" ? iso : +new Date(iso);
  return ms >= r.fromMs && ms < r.toMs;
}

export function activeCount(f: GlobalFilters): number {
  let n = 0;
  if (f.q) n++;
  if (f.preset !== DEFAULT_FILTERS.preset) n++;
  (["zones","memberIds","roles","stages","intents","sources","channels","propertyIds","outcomes"] as const)
    .forEach((k) => { if (f[k].length) n++; });
  return n;
}

/* ====================== URL persistence ====================== */

const KEY = "gf";

function readFromUrl(): GlobalFilters {
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  try {
    const p = new URLSearchParams(window.location.search).get(KEY);
    if (!p) return DEFAULT_FILTERS;
    const raw = JSON.parse(atob(decodeURIComponent(p)));
    return { ...DEFAULT_FILTERS, ...raw };
  } catch { return DEFAULT_FILTERS; }
}

function writeToUrl(f: GlobalFilters) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const isDefault = JSON.stringify(f) === JSON.stringify(DEFAULT_FILTERS);
  if (isDefault) url.searchParams.delete(KEY);
  else url.searchParams.set(KEY, encodeURIComponent(btoa(JSON.stringify(f))));
  window.history.replaceState(window.history.state, "", url.toString());
  window.dispatchEvent(new Event("gf:change"));
}

function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("popstate", cb);
  window.addEventListener("gf:change", cb);
  return () => {
    window.removeEventListener("popstate", cb);
    window.removeEventListener("gf:change", cb);
  };
}

export function useGlobalFilters(): [GlobalFilters, (f: GlobalFilters) => void, () => void] {
  const snap = useSyncExternalStore(subscribe, readFromUrl, () => DEFAULT_FILTERS);
  const setF = useCallback((f: GlobalFilters) => writeToUrl(f), []);
  const reset = useCallback(() => writeToUrl(DEFAULT_FILTERS), []);
  return [snap, setF, reset];
}

/* ====================== Predicates ====================== */

export interface FilterCtx {
  /** map tcmId -> zone, used to scope by zone */
  tcmZone?: Record<string, string>;
}

export function applyToLeads(leads: Lead[], f: GlobalFilters, ctx: FilterCtx = {}): Lead[] {
  const r = resolveRange(f);
  const q = f.q.trim().toLowerCase();
  return leads.filter((l) => {
    if (q && !`${l.name} ${l.phone} ${l.preferredArea} ${l.source}`.toLowerCase().includes(q)) return false;
    if (!inRange(l.createdAt, r) && !inRange(l.updatedAt, r)) return false;
    if (f.stages.length && !f.stages.includes(l.stage)) return false;
    if (f.intents.length && !f.intents.includes(l.intent)) return false;
    if (f.sources.length && !f.sources.includes(l.source)) return false;
    if (f.memberIds.length && !f.memberIds.includes(l.assignedTcmId)) return false;
    if (f.zones.length) {
      const z = ctx.tcmZone?.[l.assignedTcmId];
      if (!z || !f.zones.includes(z)) return false;
    }
    return true;
  });
}

export function applyToTours(tours: Tour[], f: GlobalFilters, ctx: FilterCtx = {}): Tour[] {
  const r = resolveRange(f);
  return tours.filter((t) => {
    if (!inRange(t.createdAt, r) && !inRange(t.scheduledAt, r) && !inRange(t.updatedAt, r)) return false;
    if (f.memberIds.length && !f.memberIds.includes(t.tcmId)) return false;
    if (f.zones.length) {
      const z = ctx.tcmZone?.[t.tcmId];
      if (!z || !f.zones.includes(z)) return false;
    }
    if (f.propertyIds.length && !f.propertyIds.includes(t.propertyId)) return false;
    return true;
  });
}

export function applyToBookings(bookings: Booking[], f: GlobalFilters, ctx: FilterCtx = {}): Booking[] {
  const r = resolveRange(f);
  return bookings.filter((b) => {
    if (!inRange(b.ts, r)) return false;
    if (f.memberIds.length && !f.memberIds.includes(b.tcmId)) return false;
    if (f.zones.length) {
      const z = ctx.tcmZone?.[b.tcmId];
      if (!z || !f.zones.includes(z)) return false;
    }
    if (f.propertyIds.length && !f.propertyIds.includes(b.propertyId)) return false;
    return true;
  });
}

export function applyToOwnerBookings(items: OwnerBooking[], f: GlobalFilters): OwnerBooking[] {
  const r = resolveRange(f);
  const q = f.q.trim().toLowerCase();
  return items.filter((b) => {
    if (!inRange(b.createdAt, r)) return false;
    if (q && !`${b.customer.name} ${b.customer.phone} ${b.inventory.propertyName} ${b.inventory.roomNumber}`
        .toLowerCase().includes(q)) return false;
    if (f.propertyIds.length && !f.propertyIds.includes(b.inventory.propertyId)) return false;
    if (f.outcomes.length && !f.outcomes.includes(b.status)) return false;
    return true;
  });
}
