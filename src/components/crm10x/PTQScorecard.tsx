import { useMemo } from "react";
import { useCRM10x } from "@/lib/crm10x/store";
import { classifyPTQ, ptqCompletion, PTQ_FOLLOW_UP_HOURS } from "@/lib/crm10x/ptq";
import type {
  PTQScore, PTQFit, PTQBudgetFit, PTQLocationFit,
  PTQDecisionReadiness, PTQMoveInUrgency, PTQObjection,
} from "@/lib/crm10x/types";
import type { Lead, Tour } from "@/lib/types";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sparkles, Target } from "lucide-react";
import { toast } from "sonner";

interface Props { lead: Lead; tour: Tour }

const TONE: Record<string, string> = {
  success: "border-success/40 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning-foreground",
  accent:  "border-accent/40 bg-accent/10 text-accent-foreground",
  destructive: "border-destructive/40 bg-destructive/10 text-destructive",
  muted: "border-border bg-muted/40 text-muted-foreground",
};

/**
 * PTQ Scorecard — 5-card decision engine for post-tour qualification.
 * Auto-classifies the visit into PTQ-A..E and surfaces the next action.
 */
export function PTQScorecard({ lead, tour }: Props) {
  const visit = useCRM10x((s) => s.visits[tour.id]);
  const upsertVisit = useCRM10x((s) => s.upsertVisit);
  const setLeadFollowUp = useApp((s) => s.setLeadFollowUp);

  const ptq: PTQScore = useMemo(() => visit?.ptq ?? {}, [visit]);
  const verdict = useMemo(() => classifyPTQ(ptq), [ptq]);
  const completion = ptqCompletion(ptq);

  const patch = (p: Partial<PTQScore>) => {
    upsertVisit({ tourId: tour.id, leadId: lead.id, ptq: { ...ptq, ...p } });
  };

  const applyAction = () => {
    if (completion < 100) {
      toast.warning(`Scorecard ${completion}% — applying anyway`);
    }
    const hrs = PTQ_FOLLOW_UP_HOURS[verdict.bucket];
    const dueAt = new Date(Date.now() + hrs * 3_600_000).toISOString();
    const priority = verdict.bucket === "A" ? "high"
      : verdict.bucket === "B" || verdict.bucket === "D" ? "high"
      : verdict.bucket === "C" ? "medium" : "low";
    setLeadFollowUp(lead.id, dueAt, priority, `PTQ-${verdict.bucket}: ${verdict.nextAction.label}`);
    toast.success(`Next action set · PTQ-${verdict.bucket}`, {
      description: `${verdict.nextAction.label} · follow up in ${hrs}h`,
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      {/* Verdict header */}
      <div className={`rounded-md border p-2.5 ${TONE[verdict.tone]}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Target className="h-3.5 w-3.5" />
            PTQ-{verdict.bucket} · {verdict.label}
          </div>
          <span className="text-[10px] font-mono opacity-70">{completion}%</span>
        </div>
        <div className="mt-1 text-[11px] opacity-90">{verdict.priority}</div>
        {verdict.reasons.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {verdict.reasons.map((r) => (
              <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-background/40">{r}</span>
            ))}
          </div>
        )}
      </div>

      {/* 5-card scorecard */}
      <div className="grid grid-cols-1 gap-2">
        <CardSelect
          label="1 · Property fit"
          value={ptq.propertyFit}
          onChange={(v) => patch({ propertyFit: v as PTQFit })}
          options={[
            ["perfect", "Perfect — loved it"],
            ["partial", "Liked, few concerns"],
            ["poor",    "Did not like"],
          ]}
        />
        <CardSelect
          label="2 · Budget fit"
          value={ptq.budgetFit}
          onChange={(v) => patch({ budgetFit: v as PTQBudgetFit })}
          options={[
            ["comfortable", "Within budget"],
            ["stretch",     "Slightly above"],
            ["objection",   "Budget objection"],
          ]}
        />
        <CardSelect
          label="3 · Location fit"
          value={ptq.locationFit}
          onChange={(v) => patch({ locationFit: v as PTQLocationFit })}
          options={[
            ["perfect",    "Near office/college"],
            ["acceptable", "Slightly far · OK"],
            ["concern",    "Travel concern"],
            ["rejected",   "Wrong area"],
          ]}
        />
        <CardSelect
          label="4 · Decision readiness"
          value={ptq.decisionReadiness}
          onChange={(v) => patch({ decisionReadiness: v as PTQDecisionReadiness })}
          options={[
            ["self-now",        "Self · can book now"],
            ["parent-pending",  "Parent approval pending"],
            ["group-pending",   "Group decision pending"],
            ["company-pending", "Company approval pending"],
          ]}
        />
        <CardSelect
          label="5 · Move-in urgency"
          value={ptq.moveInUrgency}
          onChange={(v) => patch({ moveInUrgency: v as PTQMoveInUrgency })}
          options={[
            ["immediate", "0–3 days · immediate"],
            ["7d",        "4–7 days · high intent"],
            ["15d",       "8–15 days · medium"],
            ["future",    "15+ days · future"],
          ]}
        />
      </div>

      {/* Manager metrics */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Property rating (1–10)
          </Label>
          <Input
            type="number" min={1} max={10} className="h-8 text-xs"
            value={ptq.propertyRating ?? ""}
            onChange={(e) => patch({ propertyRating: e.target.value ? Math.max(1, Math.min(10, Number(e.target.value))) : undefined })}
          />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Booking probability (%)
          </Label>
          <Input
            type="number" min={0} max={100} className="h-8 text-xs"
            value={ptq.bookingProbability ?? ""}
            onChange={(e) => patch({ bookingProbability: e.target.value ? Math.max(0, Math.min(100, Number(e.target.value))) : undefined })}
          />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Biggest objection
          </Label>
          <Select
            value={ptq.biggestObjection ?? ""}
            onValueChange={(v) => patch({ biggestObjection: v as PTQObjection })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              {(["none","budget","location","parent","room","amenities","competition"] as const).map((o) =>
                <SelectItem key={o} value={o} className="text-xs capitalize">{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Expected booking date
          </Label>
          <Input
            type="date" className="h-8 text-xs"
            value={ptq.expectedBookingDate ? ptq.expectedBookingDate.slice(0,10) : ""}
            onChange={(e) => patch({ expectedBookingDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
          />
        </div>
      </div>

      {/* Next action */}
      <div className="rounded-md border border-dashed border-border p-2.5 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold">
          <Sparkles className="h-3 w-3 text-accent" /> Auto next action
        </div>
        <div className="text-xs">{verdict.nextAction.label}</div>
        <div className="text-[11px] text-muted-foreground">{verdict.nextAction.hint}</div>
        <Button
          size="sm" className="w-full h-8 text-xs mt-1"
          onClick={applyAction}
        >
          {completion < 100 ? `Apply anyway · ${completion}% scored` : `Apply · schedule follow-up`}
        </Button>
      </div>
    </div>
  );
}

function CardSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">
        {options.map(([val, lbl]) => (
          <button
            key={val}
            type="button"
            onClick={() => onChange(val)}
            className={`text-[11px] px-2 py-1 rounded-md border transition ${
              value === val
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-muted/50"
            }`}
          >
            {lbl}
          </button>
        ))}
      </div>
    </div>
  );
}
