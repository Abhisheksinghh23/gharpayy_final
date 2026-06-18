import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/lib/store";
import { useSnoozes } from "@/lib/impact/snoozes";
import { toast } from "sonner";

export type FinalOutcome =
  | "booked"
  | "lost-budget" | "lost-location" | "lost-competitor" | "lost-timing"
  | "parked-future" | "ghosted";

const OPTIONS: { value: FinalOutcome; label: string; emoji: string; tone: string }[] = [
  { value: "booked",          label: "Booked",            emoji: "✅", tone: "bg-success/15 text-success border-success/40" },
  { value: "lost-budget",     label: "Lost — Budget",     emoji: "💸", tone: "bg-danger/15 text-danger border-danger/40" },
  { value: "lost-location",   label: "Lost — Location",   emoji: "📍", tone: "bg-danger/15 text-danger border-danger/40" },
  { value: "lost-competitor", label: "Lost — Competitor", emoji: "🏷", tone: "bg-danger/15 text-danger border-danger/40" },
  { value: "lost-timing",     label: "Lost — Timing",     emoji: "⏳", tone: "bg-danger/15 text-danger border-danger/40" },
  { value: "parked-future",   label: "Parked — Future",   emoji: "🌙", tone: "bg-violet-500/15 text-violet-500 border-violet-500/40" },
  { value: "ghosted",         label: "Ghosted (3+ tries)",emoji: "☠",  tone: "bg-zinc-500/15 text-zinc-500 border-zinc-500/40" },
];

export function FinalOutcomeDialog({
  open, onOpenChange, leadIds,
}: { open: boolean; onOpenChange: (v: boolean) => void; leadIds: string[] }) {
  const setLeadStage = useApp((s) => s.setLeadStage);
  const addLeadTag = useApp((s) => s.addLeadTag);
  const snooze = useSnoozes((s) => s.snooze);
  const [pick, setPick] = useState<FinalOutcome | null>(null);
  const [note, setNote] = useState("");
  const [parkUntil, setParkUntil] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10);
  });
  const [competitor, setCompetitor] = useState("");

  const apply = () => {
    if (!pick || !leadIds.length) return;
    leadIds.forEach((id) => {
      if (pick === "booked") setLeadStage(id, "booked");
      else if (pick === "parked-future") {
        addLeadTag(id, "future");
        snooze(id, new Date(parkUntil).toISOString());
      } else {
        // dropped + reason tag
        const reason = pick === "ghosted" ? "ghosted" : pick.replace("lost-", "");
        addLeadTag(id, `lost:${reason}${competitor ? `:${competitor}` : ""}`);
        setLeadStage(id, "dropped");
      }
      if (note) addLeadTag(id, `note:${note.slice(0, 40)}`);
    });
    toast.success(`Marked ${leadIds.length} lead${leadIds.length === 1 ? "" : "s"} as ${OPTIONS.find((o) => o.value === pick)?.label}`);
    onOpenChange(false);
    setPick(null); setNote(""); setCompetitor("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Final outcome · {leadIds.length} lead{leadIds.length === 1 ? "" : "s"}</DialogTitle>
          <DialogDescription>Every lead must close with a result. This feeds the loss-reason analytics.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 mt-3">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setPick(o.value)}
              className={`rounded-lg border p-2.5 text-left transition-all ${
                pick === o.value ? `${o.tone} ring-2 ring-offset-1` : "bg-card hover:bg-accent"
              }`}
            >
              <div className="text-base">{o.emoji}</div>
              <div className="text-[11px] font-medium text-foreground mt-0.5">{o.label}</div>
            </button>
          ))}
        </div>

        {pick === "lost-competitor" && (
          <Input
            value={competitor}
            onChange={(e) => setCompetitor(e.target.value)}
            placeholder="Which competitor? (Stanza, Zolo, OYO, etc.)"
            className="h-8 text-xs mt-2"
          />
        )}

        {pick === "parked-future" && (
          <div className="mt-2">
            <label className="text-[11px] text-muted-foreground">Resurface on</label>
            <Input type="date" value={parkUntil} onChange={(e) => setParkUntil(e.target.value)} className="h-8 text-xs" />
          </div>
        )}

        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Notes (optional)…"
          rows={2}
          className="text-xs mt-2"
        />

        <div className="flex justify-end gap-2 mt-3">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" disabled={!pick} onClick={apply}>Confirm outcome</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
