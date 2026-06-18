// Owner Accounts — one account per PG owner in the catalog.
// Local-only (localStorage). Lets every owner log in (no password — single
// device demo), update live inventory per PG, block beds, and have those
// changes flow into Impact so tours can only be scheduled against truly
// available rooms.

import { useSyncExternalStore } from "react";
import { listOwners, ownerCodeForPG, pgsForOwner } from "@/property-genius/lib/roles";

const KEY = "gh_owner_accounts_v1";
const SESSION_KEY = "gh_owner_session_v1";
const EVT = "owners:change";

export interface PgInventory {
  pgId: string;
  totalBeds: number;
  vacantBeds: number;
  blockedBeds: number;       // owner-held blocks (maintenance, owner relative, etc.)
  blockReason?: string;
  isLive: boolean;           // false = owner has paused this PG entirely
  pausedReason?: string;
  note?: string;
  updatedAt: number;
  updatedBy?: string;        // owner code that last touched it
}

interface State {
  inventory: Record<string, PgInventory>;  // keyed by pgId
}

const EMPTY: State = { inventory: {} };
const EMPTY_INVENTORY: Record<string, PgInventory> = {};

function load(): State {
  if (typeof window === "undefined") return EMPTY;
  try { const r = localStorage.getItem(KEY); return r ? { ...EMPTY, ...JSON.parse(r) } : EMPTY; }
  catch { return EMPTY; }
}
function save(s: State) {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent(EVT));
}

function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const h = () => cb();
  window.addEventListener(EVT, h);
  window.addEventListener("storage", h);
  return () => {
    window.removeEventListener(EVT, h);
    window.removeEventListener("storage", h);
  };
}

let cached: State | null = null;
function snapshot(): State {
  if (!cached) cached = load();
  return cached;
}
function invalidate() { cached = null; }
if (typeof window !== "undefined") {
  window.addEventListener(EVT, invalidate);
  window.addEventListener("storage", invalidate);
}

/* ------------------ session (which owner is logged in) ----------------- */

export function getSessionOwnerCode(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(SESSION_KEY); } catch { return null; }
}
export function loginAsOwner(code: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, code);
  window.dispatchEvent(new CustomEvent(EVT));
}
export function logoutOwner() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new CustomEvent(EVT));
}

/* ------------------ accounts ------------------ */

export interface OwnerAccount {
  code: string;
  name: string;
  phone: string;
  pgCount: number;
  pgId: string; // representative pg id
}

export function allOwnerAccounts(): OwnerAccount[] {
  return listOwners();
}

export function pgsForOwnerCode(code: string) {
  return pgsForOwner(code);
}

/* ------------------ inventory ------------------ */

export function getPgInventory(pgId: string): PgInventory | null {
  return snapshot().inventory[pgId] ?? null;
}

export function setPgInventory(pgId: string, patch: Partial<PgInventory>) {
  const s = load();
  const cur = s.inventory[pgId];
  const ownerCode = ownerCodeForPG(pgId);
  const next: PgInventory = {
    pgId,
    totalBeds: cur?.totalBeds ?? 20,
    vacantBeds: cur?.vacantBeds ?? 5,
    blockedBeds: cur?.blockedBeds ?? 0,
    isLive: cur?.isLive ?? true,
    blockReason: cur?.blockReason,
    pausedReason: cur?.pausedReason,
    note: cur?.note,
    ...patch,
    updatedAt: Date.now(),
    updatedBy: ownerCode,
  };
  // Clamp sensible values
  next.totalBeds = Math.max(1, next.totalBeds);
  next.vacantBeds = Math.max(0, Math.min(next.vacantBeds, next.totalBeds));
  next.blockedBeds = Math.max(0, Math.min(next.blockedBeds, next.vacantBeds));
  s.inventory[pgId] = next;
  save(s);
}

/** Bookable beds = vacant minus blocked, OR 0 if the PG is paused. */
export function bookableBeds(pgId: string, fallbackVacant: number, fallbackTotal: number): {
  vacantBeds: number;
  totalBeds: number;
  isLive: boolean;
  blockedBeds: number;
  source: "owner" | "derived";
  note?: string;
  reason?: string;
} {
  const inv = getPgInventory(pgId);
  if (!inv) {
    return { vacantBeds: fallbackVacant, totalBeds: fallbackTotal, isLive: true, blockedBeds: 0, source: "derived" };
  }
  const free = inv.isLive ? Math.max(0, inv.vacantBeds - inv.blockedBeds) : 0;
  return {
    vacantBeds: free,
    totalBeds: inv.totalBeds,
    isLive: inv.isLive,
    blockedBeds: inv.blockedBeds,
    source: "owner",
    note: inv.note,
    reason: inv.isLive ? inv.blockReason : (inv.pausedReason || "Paused by owner"),
  };
}

/* ------------------ hooks ------------------ */

export function useOwnerSession(): string | null {
  return useSyncExternalStore(subscribe, getSessionOwnerCode, () => null);
}

export function useOwnerInventory(): Record<string, PgInventory> {
  return useSyncExternalStore(subscribe, () => snapshot().inventory, () => EMPTY_INVENTORY);
}

/* ------------------ aggregate metrics ------------------ */

export function ownerScorecard(code: string) {
  const pgs = pgsForOwnerCode(code);
  let totalBeds = 0;
  let availableBeds = 0;
  let paused = 0;
  let stale = 0;
  const now = Date.now();
  for (const pg of pgs) {
    const inv = getPgInventory(pg.id);
    if (!inv) { stale++; continue; }
    totalBeds += inv.totalBeds;
    availableBeds += inv.isLive ? Math.max(0, inv.vacantBeds - inv.blockedBeds) : 0;
    if (!inv.isLive) paused++;
    if (now - inv.updatedAt > 24 * 60 * 60 * 1000) stale++;
  }
  return { pgCount: pgs.length, totalBeds, availableBeds, paused, stale };
}