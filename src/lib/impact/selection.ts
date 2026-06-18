import { create } from "zustand";

interface SelectionState {
  ids: Set<string>;
  toggle: (id: string) => void;
  setMany: (ids: string[], on: boolean) => void;
  clear: () => void;
  has: (id: string) => boolean;
  count: () => number;
}

export const useSelection = create<SelectionState>((set, get) => ({
  ids: new Set(),
  toggle: (id) =>
    set((s) => {
      const next = new Set(s.ids);
      next.has(id) ? next.delete(id) : next.add(id);
      return { ids: next };
    }),
  setMany: (ids, on) =>
    set((s) => {
      const next = new Set(s.ids);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return { ids: next };
    }),
  clear: () => set({ ids: new Set() }),
  has: (id) => get().ids.has(id),
  count: () => get().ids.size,
}));
