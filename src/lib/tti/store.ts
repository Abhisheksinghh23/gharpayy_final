// Task Time Intelligence (TTI) — measure every second of execution.
// Each "task" represents a user-flow (add lead, schedule tour, fill dossier,
// create booking, etc). We track total duration, per-field duration, and
// abandonment so admins can spot friction points.
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TaskType =
  | "lead.add"
  | "tour.schedule"
  | "dossier.fill"
  | "booking.create"
  | "booking.approve"
  | "follow-up.create"
  | "handoff.send"
  | "owner.room-update"
  | "tcm.report"
  | "custom";

export interface FieldTiming {
  field: string;
  /** ms spent before focus moved on / value committed */
  ms: number;
  /** ts of first interaction */
  firstAt: number;
}

export interface TaskRecord {
  id: string;
  type: TaskType;
  label: string;
  userKey: string;          // role:id (e.g. "tcm:tcm-1", "hr:me")
  userName: string;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  /** field-level breakdown, ordered by firstAt */
  fields: FieldTiming[];
  /** task ended without explicit complete */
  abandoned?: boolean;
  /** free-form meta — entity ids, source, etc */
  meta?: Record<string, unknown>;
}

interface TTIState {
  records: TaskRecord[];
  /** in-flight tasks not yet completed */
  active: Record<string, TaskRecord>;

  start: (
    type: TaskType,
    label: string,
    user: { key: string; name: string },
    meta?: Record<string, unknown>,
  ) => string;
  recordField: (taskId: string, field: string, ms: number) => void;
  complete: (taskId: string, extraMeta?: Record<string, unknown>) => TaskRecord | null;
  abandon: (taskId: string) => void;
  clear: () => void;
}

const uid = () => `t_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const MAX_RECORDS = 2000;
const ABANDON_AFTER_MS = 30 * 60 * 1000;

export const useTTI = create<TTIState>()(
  persist(
    (set, get) => ({
      records: [],
      active: {},

      start: (type, label, user, meta) => {
        const id = uid();
        const rec: TaskRecord = {
          id, type, label,
          userKey: user.key, userName: user.name,
          startedAt: Date.now(),
          fields: [], meta,
        };
        // mark stale active tasks as abandoned
        const now = Date.now();
        const cleaned: Record<string, TaskRecord> = {};
        const expired: TaskRecord[] = [];
        Object.values(get().active).forEach((t) => {
          if (now - t.startedAt > ABANDON_AFTER_MS) {
            expired.push({ ...t, abandoned: true, completedAt: now, durationMs: now - t.startedAt });
          } else cleaned[t.id] = t;
        });
        cleaned[id] = rec;
        set((s) => ({
          active: cleaned,
          records: [...expired, ...s.records].slice(0, MAX_RECORDS),
        }));
        return id;
      },

      recordField: (taskId, field, ms) =>
        set((s) => {
          const t = s.active[taskId];
          if (!t || ms <= 0) return s;
          // merge into existing field if present
          const existing = t.fields.find((f) => f.field === field);
          const fields = existing
            ? t.fields.map((f) => (f.field === field ? { ...f, ms: f.ms + ms } : f))
            : [...t.fields, { field, ms, firstAt: Date.now() }];
          return { active: { ...s.active, [taskId]: { ...t, fields } } };
        }),

      complete: (taskId, extraMeta) => {
        const t = get().active[taskId];
        if (!t) return null;
        const completedAt = Date.now();
        const done: TaskRecord = {
          ...t,
          completedAt,
          durationMs: completedAt - t.startedAt,
          meta: { ...(t.meta ?? {}), ...(extraMeta ?? {}) },
        };
        set((s) => {
          const { [taskId]: _, ...rest } = s.active;
          return { active: rest, records: [done, ...s.records].slice(0, MAX_RECORDS) };
        });
        return done;
      },

      abandon: (taskId) =>
        set((s) => {
          const t = s.active[taskId];
          if (!t) return s;
          const completedAt = Date.now();
          const done: TaskRecord = {
            ...t, abandoned: true, completedAt,
            durationMs: completedAt - t.startedAt,
          };
          const { [taskId]: _, ...rest } = s.active;
          return { active: rest, records: [done, ...s.records].slice(0, MAX_RECORDS) };
        }),

      clear: () => set({ records: [], active: {} }),
    }),
    { name: "gharpayy.tti.v1" },
  ),
);

// ---------- selectors / analytics ----------

export interface TaskStats {
  type: TaskType;
  label: string;
  count: number;
  completed: number;
  abandoned: number;
  avgMs: number;
  bestMs: number;
  p95Ms: number;
  totalMs: number;
}

export function summarize(records: TaskRecord[]): TaskStats[] {
  const byType = new Map<TaskType, TaskRecord[]>();
  records.forEach((r) => {
    const arr = byType.get(r.type) ?? [];
    arr.push(r);
    byType.set(r.type, arr);
  });
  return Array.from(byType.entries()).map(([type, list]) => {
    const completed = list.filter((r) => !r.abandoned && r.durationMs);
    const durations = completed.map((r) => r.durationMs!).sort((a, b) => a - b);
    const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const best = durations[0] ?? 0;
    const p95 = durations[Math.floor(durations.length * 0.95)] ?? 0;
    return {
      type, label: list[0].label,
      count: list.length,
      completed: completed.length,
      abandoned: list.filter((r) => r.abandoned).length,
      avgMs: avg, bestMs: best, p95Ms: p95,
      totalMs: durations.reduce((a, b) => a + b, 0),
    };
  });
}

export interface UserStats {
  userKey: string;
  userName: string;
  count: number;
  totalMs: number;
  byType: Record<string, { count: number; avgMs: number; bestMs: number }>;
}

export function summarizeByUser(records: TaskRecord[]): UserStats[] {
  const byUser = new Map<string, TaskRecord[]>();
  records.forEach((r) => {
    const arr = byUser.get(r.userKey) ?? [];
    arr.push(r); byUser.set(r.userKey, arr);
  });
  return Array.from(byUser.entries()).map(([userKey, list]) => {
    const types: Record<string, TaskRecord[]> = {};
    list.forEach((r) => { (types[r.type] ??= []).push(r); });
    const byType: UserStats["byType"] = {};
    Object.entries(types).forEach(([t, arr]) => {
      const ds = arr.filter((r) => !r.abandoned && r.durationMs).map((r) => r.durationMs!);
      byType[t] = {
        count: arr.length,
        avgMs: ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : 0,
        bestMs: ds.length ? Math.min(...ds) : 0,
      };
    });
    return {
      userKey, userName: list[0].userName,
      count: list.length,
      totalMs: list.reduce((a, r) => a + (r.durationMs ?? 0), 0),
      byType,
    };
  });
}

export function fieldBreakdown(records: TaskRecord[], type: TaskType) {
  const filtered = records.filter((r) => r.type === type && !r.abandoned);
  const fieldMap = new Map<string, number[]>();
  filtered.forEach((r) => {
    r.fields.forEach((f) => {
      const arr = fieldMap.get(f.field) ?? [];
      arr.push(f.ms); fieldMap.set(f.field, arr);
    });
  });
  return Array.from(fieldMap.entries())
    .map(([field, arr]) => ({
      field,
      avgMs: arr.reduce((a, b) => a + b, 0) / arr.length,
      count: arr.length,
    }))
    .sort((a, b) => b.avgMs - a.avgMs);
}

export function formatDuration(ms: number): string {
  if (!ms || ms < 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}
