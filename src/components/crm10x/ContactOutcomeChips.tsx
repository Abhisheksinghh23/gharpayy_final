import { useMemo } from "react";
import { useApp } from "@/lib/store";
import { useCRM10x } from "@/lib/crm10x/store";
import type { Lead, LeadStage } from "@/lib/types";
import type { CallOutcome } from "@/lib/crm10x/types";
import { toast } from "sonner";
import { Phone, MessageCircle, Calendar, CheckCircle2, X, Flame } from "lucide-react";

/**
 * Stage-aware quick outcome row — one click logs the right thing for the
 * lead's current stage instead of forcing the agent into a 100-option menu.
 * Mirrors the Gharpayy "decision engine" CRM model.
 */
export function ContactOutcomeChips({ lead }: { lead: Lead }) {
  const logCall = useCRM10x((s) => s.logCall);
  const allCalls = useCRM10x((s) => s.calls);
  const setStage = useApp((s) => s.setLeadStage);
  const setFollowUp = useApp((s) => s.setLeadFollowUp);

  const calls = useMemo(() => allCalls.filter((c) => c.leadId === lead.id), [allCalls, lead.id]);
  const chips = useMemo(() => stageChips(lead.stage), [lead.stage]);

  const fireCall = (outcome: CallOutcome, msg: string) => {
    logCall({
      leadId: lead.id,
      attemptNumber: calls.length + 1,
      durationSec: 0,
      outcome,
      notes: msg,
      loggedBy: lead.assignedTcmId,
    });
    toast.success(msg);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-2.5 space-y-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        Quick outcome · stage: {lead.stage.replace("-", " ")}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => {
              if (c.kind === "call") fireCall(c.outcome, c.label);
              if (c.kind === "stage") {
                setStage(lead.id, c.to);
                toast.success(`Stage → ${c.to}`);
              }
              if (c.kind === "followup") {
                const due = new Date(Date.now() + c.hours * 3_600_000).toISOString();
                setFollowUp(lead.id, due, c.priority, c.label);
                toast.success(`Follow-up in ${c.hours}h`);
              }
            }}
            className={`text-[11px] px-2 py-1 rounded-md border flex items-center gap-1 transition hover:bg-muted/60 ${c.tone}`}
          >
            <c.icon className="h-3 w-3" />
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

type Chip =
  | { kind: "call"; outcome: CallOutcome; label: string; icon: typeof Phone; tone: string }
  | { kind: "stage"; to: LeadStage; label: string; icon: typeof Phone; tone: string }
  | { kind: "followup"; hours: number; priority: "high" | "medium" | "low"; label: string; icon: typeof Phone; tone: string };

function stageChips(stage: LeadStage): Chip[] {
  const base: Chip[] = [
    { kind: "call", outcome: "answered", label: "Connected", icon: Phone, tone: "border-success/40 text-success" },
    { kind: "call", outcome: "not-answered", label: "No answer", icon: X, tone: "border-border text-muted-foreground" },
    { kind: "call", outcome: "busy", label: "Busy", icon: X, tone: "border-border text-muted-foreground" },
    { kind: "call", outcome: "switched-off", label: "Switched off", icon: X, tone: "border-border text-muted-foreground" },
    { kind: "call", outcome: "wrong-number", label: "Wrong number", icon: X, tone: "border-destructive/40 text-destructive" },
  ];

  if (stage === "new" || stage === "contacted") {
    return [
      ...base,
      { kind: "stage", to: "contacted", label: "Qualified", icon: CheckCircle2, tone: "border-success/40 text-success" },
      { kind: "followup", hours: 4, priority: "high", label: "FU in 4h", icon: Calendar, tone: "border-warning/40" },
      { kind: "followup", hours: 24, priority: "medium", label: "FU tomorrow", icon: Calendar, tone: "border-border" },
    ];
  }
  if (stage === "tour-scheduled") {
    return [
      ...base,
      { kind: "call", outcome: "callback-requested", label: "Confirm visit", icon: MessageCircle, tone: "border-accent/40" },
      { kind: "stage", to: "tour-done", label: "Mark toured", icon: CheckCircle2, tone: "border-success/40 text-success" },
    ];
  }
  if (stage === "tour-done" || stage === "negotiation") {
    return [
      { kind: "call", outcome: "answered", label: "Ready to book", icon: Flame, tone: "border-success/40 text-success" },
      { kind: "stage", to: "negotiation", label: "Negotiating", icon: MessageCircle, tone: "border-warning/40" },
      { kind: "stage", to: "booked", label: "Booked", icon: CheckCircle2, tone: "border-success/40 text-success" },
      { kind: "stage", to: "dropped", label: "Lost", icon: X, tone: "border-destructive/40 text-destructive" },
      { kind: "followup", hours: 4, priority: "high", label: "FU in 4h", icon: Calendar, tone: "border-warning/40" },
    ];
  }
  return base;
}
