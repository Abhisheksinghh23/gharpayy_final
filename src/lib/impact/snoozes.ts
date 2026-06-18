import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SnoozeState {
  /** leadId -> ISO until-when */
  until: Record<string, string>;
  snooze: (leadId: string, untilIso: string) => void;
  unsnooze: (leadId: string) => void;
  isSnoozed: (leadId: string, nowMs: number) => boolean;
  activeCount: (nowMs: number) => number;
}

export const useSnoozes = create<SnoozeState>()(
  persist(
    (set, get) => ({
      until: {},
      snooze: (leadId, untilIso) =>
        set((s) => ({ until: { ...s.until, [leadId]: untilIso } })),
      unsnooze: (leadId) =>
        set((s) => {
          const next = { ...s.until };
          delete next[leadId];
          return { until: next };
        }),
      isSnoozed: (leadId, nowMs) => {
        const u = get().until[leadId];
        return !!u && +new Date(u) > nowMs;
      },
      activeCount: (nowMs) =>
        Object.values(get().until).filter((iso) => +new Date(iso) > nowMs).length,
    }),
    { name: "impact-snoozes" },
  ),
);

export const SNOOZE_PRESETS = [
  { label: "1 hour", ms: 60 * 60 * 1000 },
  { label: "4 hours", ms: 4 * 60 * 60 * 1000 },
  { label: "Tomorrow 9am", at: () => {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0);
    return d.toISOString();
  } },
  { label: "Next Monday 9am", at: () => {
    const d = new Date();
    const day = d.getDay();
    const add = day === 0 ? 1 : 8 - day;
    d.setDate(d.getDate() + add); d.setHours(9, 0, 0, 0);
    return d.toISOString();
  } },
] as const;
