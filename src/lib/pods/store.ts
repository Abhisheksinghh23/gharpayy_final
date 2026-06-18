import { create } from "zustand";
import { persist } from "zustand/middleware";
import { TCMS } from "@/lib/mock-data";

export type PodRole = "scheduler" | "runner" | "closer";

export interface PodMember {
  tcmId: string;
  podRole: PodRole;
}

export interface Pod {
  id: string;
  name: string;       // e.g. "Pod A — Koramangala"
  zone: string;       // e.g. "Central · Koramangala"
  leadTcmId?: string; // pod lead (for reassignment auth)
  members: PodMember[];
}

interface PodsState {
  pods: Pod[];
  setPodRole: (tcmId: string, role: PodRole) => void;
  movePodMember: (tcmId: string, toPodId: string) => void;
  podFor: (tcmId: string) => Pod | undefined;
  membersByRole: (podId: string, role: PodRole) => PodMember[];
}

/** Auto-build pods from the live TCM roster: group by zone, default 4/2/2 split. */
function seedPods(): Pod[] {
  const byZone = new Map<string, string[]>();
  TCMS.forEach((t) => {
    const key = t.zone.split(" · ")[0] ?? t.zone;
    if (!byZone.has(key)) byZone.set(key, []);
    byZone.get(key)!.push(t.id);
  });
  const pods: Pod[] = [];
  let i = 0;
  byZone.forEach((ids, zone) => {
    // pack into 8-person pods
    for (let s = 0; s < ids.length; s += 8) {
      const slice = ids.slice(s, s + 8);
      const members: PodMember[] = slice.map((tcmId, idx) => ({
        tcmId,
        podRole: idx < 4 ? "scheduler" : idx < 6 ? "runner" : "closer",
      }));
      pods.push({
        id: `pod-${++i}`,
        name: `Pod ${String.fromCharCode(64 + i)} — ${zone}`,
        zone,
        leadTcmId: slice[0],
        members,
      });
    }
  });
  return pods;
}

export const usePods = create<PodsState>()(
  persist(
    (set, get) => ({
      pods: seedPods(),
      setPodRole: (tcmId, role) =>
        set((s) => ({
          pods: s.pods.map((p) => ({
            ...p,
            members: p.members.map((m) => (m.tcmId === tcmId ? { ...m, podRole: role } : m)),
          })),
        })),
      movePodMember: (tcmId, toPodId) =>
        set((s) => {
          const from = s.pods.find((p) => p.members.some((m) => m.tcmId === tcmId));
          if (!from) return s;
          const member = from.members.find((m) => m.tcmId === tcmId)!;
          return {
            pods: s.pods.map((p) => {
              if (p.id === from.id) return { ...p, members: p.members.filter((m) => m.tcmId !== tcmId) };
              if (p.id === toPodId) return { ...p, members: [...p.members, member] };
              return p;
            }),
          };
        }),
      podFor: (tcmId) => get().pods.find((p) => p.members.some((m) => m.tcmId === tcmId)),
      membersByRole: (podId, role) => {
        const p = get().pods.find((x) => x.id === podId);
        return p ? p.members.filter((m) => m.podRole === role) : [];
      },
    }),
    { name: "gp-pods-v1" },
  ),
);

/** Which role is responsible for a lead given its stage. */
export function responsibleRole(stage: string, daysInStage: number): PodRole {
  if (["new", "contacted"].includes(stage)) return "scheduler";
  if (["tour-scheduled", "tour-done"].includes(stage)) return "runner";
  if (stage === "negotiation" || daysInStage >= 5) return "closer";
  return "scheduler";
}
