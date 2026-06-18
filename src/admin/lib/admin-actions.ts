/**
 * Admin actions — destructive operations with audit + undo.
 * All writes go through useApp() and useAuditLog(). An undo registry keeps
 * the inverse op for 10s so the UI can offer a one-click revert.
 */
import { useApp } from "@/lib/store";
import { useAuditLog } from "@/lib/audit-log";
import type { Lead, LeadStage, Booking } from "@/lib/types";
import { toast } from "sonner";

type Inverse = () => void;
const undoStack = new Map<string, Inverse>();

function pushUndo(id: string, fn: Inverse) {
  undoStack.set(id, fn);
  setTimeout(() => undoStack.delete(id), 10_000);
}

export function undo(id: string) {
  const fn = undoStack.get(id);
  if (!fn) {
    toast.warning("Undo window expired");
    return;
  }
  fn();
  undoStack.delete(id);
  toast.success("Reverted");
}

export function reassignLead(leadId: string, newTcmId: string, reason = "Admin reassignment") {
  const state = useApp.getState();
  const lead = state.leads.find((l) => l.id === leadId);
  if (!lead) return;
  const before = lead.assignedTcmId;
  state.reassignLead(leadId, newTcmId, reason);
  const entry = useAuditLog.getState().log({
    actorId: "admin", actorName: "Admin",
    entityType: "lead", entityId: leadId,
    action: "admin.reassign",
    before: { assignedTcmId: before },
    after: { assignedTcmId: newTcmId },
    summary: `Reassigned ${lead.name} → ${state.tcms.find((t) => t.id === newTcmId)?.name ?? newTcmId}`,
  });
  pushUndo(entry.id, () => {
    useApp.getState().reassignLead(leadId, before, "Undo admin reassignment");
  });
  toast.success(`Reassigned ${lead.name}`, {
    action: { label: "Undo", onClick: () => undo(entry.id) },
  });
}

export function forceCloseLead(
  leadId: string,
  outcome: "won" | "lost",
  reasonOrAmount: string | number,
) {
  const state = useApp.getState();
  const lead = state.leads.find((l) => l.id === leadId);
  if (!lead) return;
  const before: LeadStage = lead.stage;
  if (outcome === "won") {
    const amount = typeof reasonOrAmount === "number" ? reasonOrAmount : lead.budget;
    const tour = state.tours.find((t) => t.leadId === leadId);
    if (tour) {
      state.closeDeal({ leadId, tourId: tour.id, propertyId: tour.propertyId, tcmId: lead.assignedTcmId, amount });
    } else {
      state.setLeadStage(leadId, "booked");
    }
  } else {
    state.setLeadStage(leadId, "dropped");
  }
  const entry = useAuditLog.getState().log({
    actorId: "admin", actorName: "Admin",
    entityType: "lead", entityId: leadId,
    action: outcome === "won" ? "admin.force-close.won" : "admin.force-close.lost",
    before: { stage: before },
    after: { stage: outcome === "won" ? "booked" : "dropped", reason: reasonOrAmount },
    summary: `Force-closed ${lead.name} as ${outcome}`,
  });
  pushUndo(entry.id, () => {
    useApp.getState().setLeadStage(leadId, before);
  });
  toast.success(`Closed ${lead.name} as ${outcome}`, {
    action: { label: "Undo stage", onClick: () => undo(entry.id) },
  });
}

export function bulkReassign(leadIds: string[], newTcmId: string) {
  if (leadIds.length > 10 && !confirm(`Reassign ${leadIds.length} leads?`)) return;
  leadIds.forEach((id) => reassignLead(id, newTcmId, "Bulk admin reassignment"));
}

export function flagIntervention(leadId: string, note: string) {
  const lead = useApp.getState().leads.find((l) => l.id === leadId);
  if (!lead) return;
  useAuditLog.getState().log({
    actorId: "admin", actorName: "Admin",
    entityType: "lead", entityId: leadId,
    action: "admin.intervention.flag",
    summary: `Flagged ${lead.name}: ${note}`,
  });
  toast.success("Intervention flagged");
}
