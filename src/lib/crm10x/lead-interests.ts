/**
 * Per-lead "interested in" properties — what the lead is leaning toward.
 * A lead can favorite 2–3 properties so the TCM knows which to push first.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface State {
  interests: Record<string, string[]>; // leadId → propertyIds
  toggleInterest: (leadId: string, propertyId: string) => void;
  clearInterests: (leadId: string) => void;
}

export const useLeadInterests = create<State>()(
  persist(
    (set) => ({
      interests: {},
      toggleInterest: (leadId, propertyId) =>
        set((s) => {
          const cur = s.interests[leadId] ?? [];
          const next = cur.includes(propertyId)
            ? cur.filter((x) => x !== propertyId)
            : [...cur, propertyId];
          return { interests: { ...s.interests, [leadId]: next } };
        }),
      clearInterests: (leadId) =>
        set((s) => ({ interests: { ...s.interests, [leadId]: [] } })),
    }),
    { name: "gharpayy.lead-interests.v1" },
  ),
);