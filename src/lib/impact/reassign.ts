import type { Lead, TCM } from "@/lib/types";
import { usePods, type PodRole } from "@/lib/pods/store";

export interface LoadHint { tcmId: string; openLeads: number; pace: "light" | "even" | "heavy" }

export function computeLoad(tcms: TCM[], leads: Lead[]): Map<string, number> {
  const m = new Map<string, number>();
  tcms.forEach((t) => m.set(t.id, 0));
  leads.forEach((l) => {
    if (l.stage === "booked" || l.stage === "dropped") return;
    m.set(l.assignedTcmId, (m.get(l.assignedTcmId) ?? 0) + 1);
  });
  return m;
}

export function loadHints(tcms: TCM[], leads: Lead[]): LoadHint[] {
  const load = computeLoad(tcms, leads);
  const values = Array.from(load.values());
  if (!values.length) return [];
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return tcms.map((t) => {
    const openLeads = load.get(t.id) ?? 0;
    const pace: LoadHint["pace"] = openLeads < avg * 0.75 ? "light" : openLeads > avg * 1.25 ? "heavy" : "even";
    return { tcmId: t.id, openLeads, pace };
  });
}

/** Pick the lightest-load member of a given pod role within a zone. */
export function pickLightestByRole(
  zone: string, role: PodRole, tcms: TCM[], leads: Lead[],
): string | null {
  const pods = usePods.getState().pods.filter((p) => p.zone === zone);
  const ids = pods.flatMap((p) => p.members.filter((m) => m.podRole === role).map((m) => m.tcmId));
  if (!ids.length) return null;
  const load = computeLoad(tcms, leads);
  return ids.sort((a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0))[0];
}
