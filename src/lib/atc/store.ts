// ATC — Air Traffic Control core store (local, single source of truth).
// Owns: smart holds (with TTL), inventory freshness, tenant timeline,
// owner/team acknowledgments. UI subscribes via useATC().
import { useEffect, useState } from "react";

export type HoldStatus = "active" | "converted" | "released" | "expired";

export interface SmartHold {
  id: string;
  leadId: string;
  leadName: string;
  propertyId: string;
  propertyName: string;
  bedRef?: string;
  createdAt: number;
  expiresAt: number;     // createdAt + ttlMs
  status: HoldStatus;
  teamAck: boolean;      // team confirmed tenant+amount+date+room
  ownerAck: boolean;     // owner confirmed room blocked
  amount?: number;
  notes?: string;
}

export interface Freshness {
  propertyId: string;
  lastVerifiedAt: number;
  verifiedBy?: string;
}

export type TimelineKind =
  | "requirement" | "matched" | "visit-scheduled" | "visit-done"
  | "shortlisted" | "hold-created" | "hold-released" | "hold-expired"
  | "payment-initiated" | "team-ack" | "owner-ack"
  | "booking-confirmed" | "check-in" | "note";

export interface TimelineEvent {
  id: string;
  leadId: string;
  ts: number;
  kind: TimelineKind;
  text: string;
  meta?: Record<string, unknown>;
}

interface State {
  holds: SmartHold[];
  freshness: Record<string, Freshness>;
  events: TimelineEvent[];
}

const KEY = "atc_state_v1";
const EMPTY: State = { holds: [], freshness: {}, events: [] };
const HOLD_TTL_MS = 2 * 60 * 60 * 1000;     // 2h
export const FRESH_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const EVT = "atc:change";

function uid(p: string) { return `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`; }
function load(): State {
  if (typeof window === "undefined") return EMPTY;
  try { const r = localStorage.getItem(KEY); return r ? { ...EMPTY, ...JSON.parse(r) } : EMPTY; }
  catch { return EMPTY; }
}
function save(s: State) {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent(EVT));
}

/* ---------------- mutations ---------------- */
export function createHold(input: {
  leadId: string; leadName: string;
  propertyId: string; propertyName: string;
  bedRef?: string; amount?: number; ttlMs?: number; notes?: string;
}): SmartHold {
  const s = load();
  const now = Date.now();
  const hold: SmartHold = {
    id: uid("hld"),
    leadId: input.leadId, leadName: input.leadName,
    propertyId: input.propertyId, propertyName: input.propertyName,
    bedRef: input.bedRef, amount: input.amount, notes: input.notes,
    createdAt: now, expiresAt: now + (input.ttlMs ?? HOLD_TTL_MS),
    status: "active", teamAck: false, ownerAck: false,
  };
  s.holds.unshift(hold);
  s.events.unshift({
    id: uid("evt"), leadId: input.leadId, ts: now, kind: "hold-created",
    text: `Hold created · ${input.propertyName}${input.bedRef ? ` · ${input.bedRef}` : ""}`,
    meta: { holdId: hold.id, expiresAt: hold.expiresAt },
  });
  save(s);
  return hold;
}

export function releaseHold(id: string, reason = "manual") {
  const s = load();
  const h = s.holds.find((x) => x.id === id);
  if (!h || h.status !== "active") return;
  h.status = "released";
  s.events.unshift({
    id: uid("evt"), leadId: h.leadId, ts: Date.now(), kind: "hold-released",
    text: `Hold released · ${h.propertyName} (${reason})`,
  });
  save(s);
}

export function convertHold(id: string) {
  const s = load();
  const h = s.holds.find((x) => x.id === id);
  if (!h) return;
  h.status = "converted";
  s.events.unshift({
    id: uid("evt"), leadId: h.leadId, ts: Date.now(), kind: "booking-confirmed",
    text: `Hold converted to booking · ${h.propertyName}`,
  });
  save(s);
}

export function ackTeam(id: string) {
  const s = load();
  const h = s.holds.find((x) => x.id === id);
  if (!h) return;
  h.teamAck = true;
  s.events.unshift({
    id: uid("evt"), leadId: h.leadId, ts: Date.now(), kind: "team-ack",
    text: `Team confirmed hold · ${h.propertyName}`,
  });
  save(s);
}

export function ackOwner(id: string) {
  const s = load();
  const h = s.holds.find((x) => x.id === id);
  if (!h) return;
  h.ownerAck = true;
  s.events.unshift({
    id: uid("evt"), leadId: h.leadId, ts: Date.now(), kind: "owner-ack",
    text: `Owner approved hold · ${h.propertyName}`,
  });
  save(s);
}

export function reconfirmProperty(propertyId: string, verifiedBy = "team") {
  const s = load();
  s.freshness[propertyId] = { propertyId, lastVerifiedAt: Date.now(), verifiedBy };
  save(s);
}

export function logTimeline(leadId: string, kind: TimelineKind, text: string, meta?: Record<string, unknown>) {
  const s = load();
  s.events.unshift({ id: uid("evt"), leadId, ts: Date.now(), kind, text, meta });
  save(s);
}

/* ---------------- selectors ---------------- */
export function freshnessFor(propertyId: string): { stale: boolean; ageMs: number | null; lastVerifiedAt: number | null } {
  const s = load();
  const f = s.freshness[propertyId];
  if (!f) return { stale: true, ageMs: null, lastVerifiedAt: null };
  const age = Date.now() - f.lastVerifiedAt;
  return { stale: age > FRESH_TTL_MS, ageMs: age, lastVerifiedAt: f.lastVerifiedAt };
}

/* ---------------- React hook ---------------- */
export function useATC() {
  const [s, setS] = useState<State>(() => load());
  useEffect(() => {
    const reload = () => setS(load());
    window.addEventListener(EVT, reload);
    window.addEventListener("storage", reload);
    // Tick every 30s to auto-expire holds in UI without writing on each render.
    const t = setInterval(() => {
      const cur = load();
      let changed = false;
      cur.holds.forEach((h) => {
        if (h.status === "active" && h.expiresAt <= Date.now()) {
          h.status = "expired";
          cur.events.unshift({
            id: uid("evt"), leadId: h.leadId, ts: Date.now(), kind: "hold-expired",
            text: `Hold auto-expired · ${h.propertyName}`,
          });
          changed = true;
        }
      });
      if (changed) save(cur); else setS(cur);
    }, 30_000);
    return () => {
      window.removeEventListener(EVT, reload);
      window.removeEventListener("storage", reload);
      clearInterval(t);
    };
  }, []);
  return s;
}

export function formatRemaining(ms: number): string {
  if (ms <= 0) return "expired";
  const m = Math.floor(ms / 60000);
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  if (m >= 1) return `${m}m`;
  return `${Math.floor(ms / 1000)}s`;
}
