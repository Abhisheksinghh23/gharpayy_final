import { useCRM10x } from "./store";
import { useApp } from "@/lib/store";
import type { Lead } from "@/lib/types";
import type { DeepLeadProfile } from "./types";

/** Fields we treat as the minimum Dossier needed before scheduling a tour. */
export const DOSSIER_REQUIRED_FIELDS: Array<{
  key: keyof DeepLeadProfile;
  label: string;
}> = [
  { key: "roomType", label: "Room type" },
  { key: "food", label: "Food pref" },
  { key: "preferredMoveInDate", label: "Move-in date" },
  { key: "decisionMaker", label: "Decision maker" },
  { key: "budgetStated", label: "Stated budget" },
];

export interface DossierReadiness {
  ready: boolean;
  missing: string[];
  filledCount: number;
  totalCount: number;
}

/**
 * Build a "virtual" DeepLeadProfile that backfills missing CRM10x fields from
 * the canonical Lead record so a freshly imported lead with budget +
 * move-in date already set is not falsely blocked from scheduling a tour.
 */
export function mergedProfile(
  profile: DeepLeadProfile | undefined,
  lead: Lead | null | undefined,
): DeepLeadProfile | undefined {
  if (!lead) return profile;
  const base: DeepLeadProfile =
    profile ?? { leadId: lead.id, updatedAt: new Date().toISOString() };
  return {
    ...base,
    // budgetStated falls back to lead.budget
    budgetStated:
      base.budgetStated && base.budgetStated > 0
        ? base.budgetStated
        : (lead.budget && lead.budget > 0 ? lead.budget : base.budgetStated),
    // preferredMoveInDate falls back to lead.moveInDate
    preferredMoveInDate:
      base.preferredMoveInDate || lead.moveInDate || base.preferredMoveInDate,
  };
}

export function computeDossierReadiness(
  profile: DeepLeadProfile | undefined,
): DossierReadiness {
  const missing: string[] = [];
  let filled = 0;
  for (const f of DOSSIER_REQUIRED_FIELDS) {
    const v = profile?.[f.key];
    if (v === undefined || v === null || v === "" || (typeof v === "number" && v <= 0)) {
      missing.push(f.label);
    } else {
      filled += 1;
    }
  }
  return {
    ready: missing.length === 0,
    missing,
    filledCount: filled,
    totalCount: DOSSIER_REQUIRED_FIELDS.length,
  };
}

/** Hook — subscribes to the profile in the CRM10x store, merged with Lead. */
export function useDossierReadiness(lead: Lead | null | undefined): DossierReadiness {
  const profile = useCRM10x((s) => (lead ? s.profiles[lead.id] : undefined));
  // Also reactive to the lead itself so budget/moveInDate edits flow in.
  const liveLead = useApp((s) =>
    lead ? s.leads.find((l) => l.id === lead.id) ?? lead : lead,
  );
  return computeDossierReadiness(mergedProfile(profile, liveLead));
}
