// Owner Registry — single source of truth for owner identity and rooms across
// both property hubs (property-genius + supply-hub). Hotel-style state model:
// rooms have ONE status (vacant / vacating / occupied / blocked / held /
// booked), one rent, and one verification timestamp. Sales, owner, and tour
// modules all read from here.

import { PGS as PG_HUB } from "@/property-genius/data/pgs";
import { PGS as SH_HUB } from "@/supply-hub/data/pgs";
import type { PG } from "@/property-genius/data/types";

export type RoomType = "single" | "double" | "triple";
export type RoomStatus =
  | "vacant"
  | "vacating"
  | "occupied"
  | "blocked"
  | "held"      // owner-held exclusive for Gharpayy
  | "booked";   // deal closed via Gharpayy channel

export interface OwnerRoom {
  /** Stable composite room ID — used by visits, blocks, quotes. */
  id: string;
  pgId: string;
  pgName: string;
  hub: "pg" | "sh";
  area: string;
  type: RoomType;
  beds: number;
  rent: number;
  status: RoomStatus;
  vacatingDate?: string;
  notes?: string;
  /** Owner private floor price (not shown to sales). */
  floorPrice?: number;
  /** True if owner confirmed today's truth ritual for this room. */
  verifiedToday: boolean;
  /** Auto-flipped at end-of-day if never verified. */
  lockedUnsellable: boolean;
  /** True if the row was added by the owner via the bulk add sheet. */
  ownerAdded?: boolean;
  updatedAt: string;
}

export interface OwnerProperty {
  pgId: string;
  pgName: string;
  hub: "pg" | "sh";
  area: string;
  managerPhone?: string;
  rooms: OwnerRoom[];
}

export interface RegistryOwner {
  /** Auto-generated stable ID — OWN-XXXX. Identical for the same owner
   *  even if their PGs span both property hubs. */
  id: string;
  name: string;
  phone?: string;
  properties: OwnerProperty[];
  totalRooms: number;
  totalBeds: number;
  vacantBeds: number;
}

/* ---------- helpers ---------- */

function normalizeKey(name?: string, phone?: string): string {
  const p = (phone || "").replace(/\D/g, "");
  if (p.length >= 10) return `p:${p.slice(-10)}`;
  return `n:${(name || "unknown").trim().toLowerCase()}`;
}

function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function ownerIdFor(key: string): string {
  return `OWN-${String(hash(key) % 10000).padStart(4, "0")}`;
}

function bedsFor(pg: PG, type: RoomType): number {
  const offered = pg.prices[type as keyof typeof pg.prices] > 0;
  if (!offered) return 0;
  const h = hash(`${pg.id}:${type}`);
  return 2 + (h % 5);
}

/* ---------- overlay (persistent edits) ---------- */

const OVERLAY_KEY = "gharpayy.owner-registry.v2";

interface OverlayEntry {
  rent?: number;
  status?: RoomStatus;
  vacatingDate?: string;
  notes?: string;
  beds?: number;
  floorPrice?: number;
  /** Status to restore when un-holding. */
  preHoldStatus?: RoomStatus;
  verifiedOn?: string;
  updatedAt?: string;
}

interface AddedRoom {
  id: string;
  pgId: string;
  type: RoomType;
  beds: number;
  rent: number;
  status: RoomStatus;
  createdAt: string;
}

interface Overlay {
  rooms: Record<string, OverlayEntry>;
  added: Record<string, AddedRoom[]>; // pgId -> rows
}

function emptyOverlay(): Overlay {
  return { rooms: {}, added: {} };
}

function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function loadOverlay(): Overlay {
  if (typeof window === "undefined") return emptyOverlay();
  try {
    const raw = localStorage.getItem(OVERLAY_KEY);
    if (!raw) return emptyOverlay();
    const parsed = JSON.parse(raw) as Partial<Overlay>;
    return {
      rooms: parsed.rooms ?? {},
      added: parsed.added ?? {},
    };
  } catch {
    return emptyOverlay();
  }
}

function saveOverlay(o: Overlay) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(OVERLAY_KEY, JSON.stringify(o));
  } catch {
    /* ignore */
  }
}

export function patchRoom(roomId: string, patch: OverlayEntry) {
  const o = loadOverlay();
  o.rooms[roomId] = {
    ...o.rooms[roomId],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  saveOverlay(o);
  notify();
}

export function verifyRoomToday(roomId: string) {
  patchRoom(roomId, { verifiedOn: todayKey() });
}

/** Hotel-style "Hold for Gharpayy" — flip to/from held while remembering
 *  the prior status so un-hold restores it. */
export function holdForGharpayy(roomId: string, on: boolean) {
  const o = loadOverlay();
  const cur = o.rooms[roomId] ?? {};
  if (on) {
    const previous = cur.status && cur.status !== "held" ? cur.status : "vacant";
    o.rooms[roomId] = {
      ...cur,
      preHoldStatus: previous,
      status: "held",
      verifiedOn: todayKey(),
      updatedAt: new Date().toISOString(),
    };
  } else {
    o.rooms[roomId] = {
      ...cur,
      status: cur.preHoldStatus ?? "vacant",
      preHoldStatus: undefined,
      verifiedOn: todayKey(),
      updatedAt: new Date().toISOString(),
    };
  }
  saveOverlay(o);
  notify();
}

/** Close the deal — flip to booked. */
export function closeDeal(roomId: string) {
  patchRoom(roomId, { status: "booked", verifiedOn: todayKey() });
}

/* ----- bulk add / remove ----- */

const MAX_ADDED_PER_PG = 12;

export function addRooms(
  pgId: string,
  rows: Array<{ type: RoomType; beds: number; rent: number; status?: RoomStatus }>,
): { added: number; skipped: number } {
  const o = loadOverlay();
  const existing = o.added[pgId] ?? [];
  const room = Math.max(0, MAX_ADDED_PER_PG - existing.length);
  const accept = rows.slice(0, room);
  const skipped = rows.length - accept.length;
  const now = new Date().toISOString();
  const created: AddedRoom[] = accept.map((r, i) => ({
    id: `${pgId}::custom-${Date.now().toString(36)}-${i}`,
    pgId,
    type: r.type,
    beds: r.beds,
    rent: r.rent,
    status: r.status ?? "vacant",
    createdAt: now,
  }));
  o.added[pgId] = [...existing, ...created];
  // Pre-verify added rooms for today so they're sellable instantly.
  created.forEach((c) => {
    o.rooms[c.id] = { verifiedOn: todayKey(), updatedAt: now };
  });
  saveOverlay(o);
  notify();
  return { added: created.length, skipped };
}

export function removeAddedRoom(roomId: string): boolean {
  const o = loadOverlay();
  let touched = false;
  for (const pgId of Object.keys(o.added)) {
    const before = o.added[pgId].length;
    o.added[pgId] = o.added[pgId].filter((r) => r.id !== roomId);
    if (o.added[pgId].length !== before) touched = true;
  }
  if (touched) {
    delete o.rooms[roomId];
    saveOverlay(o);
    notify();
  }
  return touched;
}

export function addedRoomCountFor(pgId: string): number {
  return loadOverlay().added[pgId]?.length ?? 0;
}

export function maxAddedRoomsPerPG(): number {
  return MAX_ADDED_PER_PG;
}

/* ---------- daily truth phase ---------- */

/** Soft escalation — no hard guillotine until end of day. */
export type TruthPhase = "idle" | "open" | "warn1" | "warn2" | "warn3" | "locked";

export function dailyTruthPhase(d = new Date()): TruthPhase {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h < 9.5) return "idle";
  if (h < 11) return "open";
  if (h < 14) return "warn1";
  if (h < 19) return "warn2";
  if (h < 22) return "warn3";
  return "locked";
}

/* ---------- subscription ---------- */

type Listener = () => void;
const listeners = new Set<Listener>();
function notify() {
  listeners.forEach((fn) => fn());
}
export function subscribeRegistry(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ---------- build ---------- */

function buildRoomsForPG(pg: PG, hub: "pg" | "sh", overlay: Overlay, today: string): OwnerRoom[] {
  const phase = dailyTruthPhase();
  const rows: OwnerRoom[] = [];

  (["single", "double", "triple"] as const).forEach((type) => {
    const baseBeds = bedsFor(pg, type);
    if (baseBeds <= 0) return;
    const id = `${pg.id}::${type}`;
    const baseRent = pg.prices[type as keyof typeof pg.prices] || 0;
    const ov = overlay.rooms[id] || {};
    const h = hash(id);
    const defaultStatus: RoomStatus =
      h % 7 === 0 ? "vacant" : h % 11 === 0 ? "vacating" : "occupied";
    const verifiedToday = ov.verifiedOn === today;
    const lockedUnsellable = !verifiedToday && phase === "locked";
    rows.push({
      id,
      pgId: pg.id,
      pgName: pg.name,
      hub,
      area: pg.area,
      type,
      beds: ov.beds ?? baseBeds,
      rent: ov.rent ?? baseRent,
      status: ov.status ?? defaultStatus,
      vacatingDate: ov.vacatingDate,
      notes: ov.notes,
      floorPrice: ov.floorPrice,
      verifiedToday,
      lockedUnsellable,
      updatedAt: ov.updatedAt ?? new Date(0).toISOString(),
    });
  });

  // Owner-added rooms.
  (overlay.added[pg.id] ?? []).forEach((r) => {
    const ov = overlay.rooms[r.id] || {};
    const verifiedToday = ov.verifiedOn === today;
    const lockedUnsellable = !verifiedToday && phase === "locked";
    rows.push({
      id: r.id,
      pgId: pg.id,
      pgName: pg.name,
      hub,
      area: pg.area,
      type: r.type,
      beds: ov.beds ?? r.beds,
      rent: ov.rent ?? r.rent,
      status: ov.status ?? r.status,
      vacatingDate: ov.vacatingDate,
      notes: ov.notes,
      floorPrice: ov.floorPrice,
      verifiedToday,
      lockedUnsellable,
      ownerAdded: true,
      updatedAt: ov.updatedAt ?? r.createdAt,
    });
  });

  return rows;
}

export function getRegistry(): RegistryOwner[] {
  const overlay = loadOverlay();
  const today = todayKey();
  const map = new Map<string, RegistryOwner>();

  const ingest = (pg: PG, hub: "pg" | "sh") => {
    const name = pg.owner?.name || pg.manager?.name || "Unassigned";
    const phone = pg.owner?.phone || pg.manager?.phone || "";
    const key = normalizeKey(name, phone);
    const id = ownerIdFor(key);
    if (!map.has(key)) {
      map.set(key, {
        id,
        name: name || `Owner ${id.slice(-4)}`,
        phone: phone || undefined,
        properties: [],
        totalRooms: 0,
        totalBeds: 0,
        vacantBeds: 0,
      });
    }
    const owner = map.get(key)!;
    const rooms = buildRoomsForPG(pg, hub, overlay, today);

    const prop: OwnerProperty = {
      pgId: pg.id,
      pgName: pg.name,
      hub,
      area: pg.area,
      managerPhone: pg.manager?.phone || undefined,
      rooms,
    };
    owner.properties.push(prop);
    owner.totalRooms += rooms.length;
    owner.totalBeds += rooms.reduce((s, r) => s + r.beds, 0);
    owner.vacantBeds += rooms
      .filter((r) => r.status === "vacant" || r.status === "vacating" || r.status === "held")
      .reduce((s, r) => s + r.beds, 0);
  };

  PG_HUB.forEach((pg) => ingest(pg, "pg"));
  SH_HUB.forEach((pg) => ingest(pg, "sh"));

  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "en"),
  );
}

export function lookupOwnerByPgId(pgId: string): RegistryOwner | null {
  return getRegistry().find((o) => o.properties.some((p) => p.pgId === pgId)) ?? null;
}

export function lookupOwnerByRoomId(roomId: string): RegistryOwner | null {
  const pgId = roomId.split("::")[0];
  return lookupOwnerByPgId(pgId);
}
