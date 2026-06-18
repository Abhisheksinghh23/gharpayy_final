import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import type { Lead, LeadStage, Intent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Phone, MessageCircle, MapPin, Flame, CheckCircle2,
  AlertTriangle, Search, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/easy")({
  head: () => ({
    meta: [
      { title: "Easy Mode — 1-Click CRM" },
      { name: "description", content: "Idiot-proof lead view. One screen. One click per action." },
    ],
  }),
  component: EasyMode,
});

/* ---------- Color-locked status pills (Fix #4) ---------- */
const STAGE_STYLE: Record<LeadStage, string> = {
  "new":              "bg-blue-500/15 text-blue-600 border-blue-500/30",
  "contacted":        "bg-sky-500/15 text-sky-600 border-sky-500/30",
  "tour-scheduled":   "bg-indigo-500/15 text-indigo-600 border-indigo-500/30",
  "tour-done":        "bg-amber-500/15 text-amber-600 border-amber-500/30",
  "negotiation":      "bg-orange-500/15 text-orange-600 border-orange-500/30",
  "booked":           "bg-green-500/15 text-green-600 border-green-500/30",
  "dropped":          "bg-zinc-500/15 text-zinc-500 border-zinc-500/30",
};
const INTENT_STYLE: Record<Intent, string> = {
  hot:  "bg-red-500/15 text-red-600 border-red-500/30",
  warm: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  cold: "bg-slate-500/15 text-slate-500 border-slate-500/30",
};

/* ---------- Orphan detection (Fix #2 — accountability guard) ---------- */
function isOrphan(l: Lead): boolean {
  return !l.assignedTcmId || !l.nextFollowUpAt;
}

/* ---------- "What next?" prompts (Fix #5) ---------- */
const NEXT_PROMPT: Record<LeadStage, string> = {
  "new":            "Call now → confirm budget + area",
  "contacted":      "Schedule tour within 24h",
  "tour-scheduled": "Confirm tour 2h before",
  "tour-done":      "Send quotation today",
  "negotiation":    "Close objection · follow up tomorrow",
  "booked":         "Collect token + share onboarding",
  "dropped":        "Mark reason + add to revival sequence",
};

function EasyMode() {
  const leads = useApp((s) => s.leads);
  const tcms = useApp((s) => s.tcms);
  const setStage = useApp((s) => s.setLeadStage);
  const setIntent = useApp((s) => s.setLeadIntent);
  const logCall = useApp((s) => s.logCall);
  const autoAssign = useApp((s) => s.autoAssignLead);
  const setFollowUp = useApp((s) => s.setLeadFollowUp);

  const [q, setQ] = useState("");
  const [onlyOrphans, setOnlyOrphans] = useState(false);
  const [prompt, setPrompt] = useState<{ lead: Lead; stage: LeadStage } | null>(null);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return leads
      .filter((l) => (onlyOrphans ? isOrphan(l) : true))
      .filter((l) =>
        !ql ||
        l.name.toLowerCase().includes(ql) ||
        l.phone.includes(ql) ||
        l.preferredArea.toLowerCase().includes(ql))
      .slice(0, 200);
  }, [leads, q, onlyOrphans]);

  const orphanCount = leads.filter(isOrphan).length;
  const tcmName = (id: string) => tcms.find((t) => t.id === id)?.name ?? "—";

  const handleStageChange = (l: Lead, s: LeadStage) => {
    setStage(l.id, s);
    toast.success(`${l.name} → ${s}`);
    setPrompt({ lead: l, stage: s });
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 max-w-5xl mx-auto">
      <header className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-xl font-bold">Easy Mode</h1>
            <p className="text-xs text-muted-foreground">One screen. One click. No training needed.</p>
          </div>
          <Link to="/impact" className="text-xs text-muted-foreground hover:text-foreground">
            Pro view →
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="h-9 pl-7 text-sm"
              placeholder="Search name, phone, area…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {/* Fix #2 — Orphan alert chip */}
          <button
            onClick={() => setOnlyOrphans((v) => !v)}
            className={`h-9 px-3 rounded-md text-xs font-medium border flex items-center gap-1.5 transition ${
              onlyOrphans
                ? "bg-red-500 text-white border-red-500"
                : "bg-red-500/10 text-red-600 border-red-500/30 hover:bg-red-500/20"
            }`}>
            <AlertTriangle className="h-3.5 w-3.5" />
            {orphanCount} orphan{orphanCount === 1 ? "" : "s"}
          </button>
        </div>
      </header>

      {filtered.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          {onlyOrphans ? "No orphan leads. " : "No leads match. "}
          You're clear.
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((l) => (
          <LeadRow
            key={l.id}
            lead={l}
            tcmName={tcmName(l.assignedTcmId)}
            orphan={isOrphan(l)}
            onCall={() => { logCall(l.id); toast.success(`Call logged · ${l.name}`); }}
            onWa={() => {
              window.open(`https://wa.me/${l.phone.replace(/\D/g, "")}`, "_blank");
              toast.success("WhatsApp opened");
            }}
            onVisit={() => handleStageChange(l, "tour-scheduled")}
            onHot={() => { setIntent(l.id, "hot"); toast.success(`${l.name} marked HOT`); }}
            onToken={() => handleStageChange(l, "booked")}
            onAssign={() => {
              const r = autoAssign(l.id);
              toast.success(`Assigned to ${tcmName(r.tcmId)}`);
            }}
            onStage={(s) => handleStageChange(l, s)}
          />
        ))}
      </div>

      {/* Fix #5 — What next? prompt */}
      <Dialog open={!!prompt} onOpenChange={(v) => !v && setPrompt(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">What next?</DialogTitle>
          </DialogHeader>
          {prompt && (
            <div className="space-y-3">
              <div className="rounded-md bg-muted p-3">
                <div className="text-xs text-muted-foreground mb-1">Recommended action</div>
                <div className="text-sm font-medium">{NEXT_PROMPT[prompt.stage]}</div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={() => {
                    const t = new Date();
                    t.setDate(t.getDate() + 1);
                    setFollowUp(prompt.lead.id, t.toISOString(), "high", NEXT_PROMPT[prompt.stage]);
                    toast.success("Follow-up set for tomorrow");
                    setPrompt(null);
                  }}>
                  Schedule +1 day <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setPrompt(null)}>
                  Skip
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Fix #1 — One-click action row ---------- */
function LeadRow(props: {
  lead: Lead;
  tcmName: string;
  orphan: boolean;
  onCall: () => void;
  onWa: () => void;
  onVisit: () => void;
  onHot: () => void;
  onToken: () => void;
  onAssign: () => void;
  onStage: (s: LeadStage) => void;
}) {
  const { lead: l, tcmName, orphan } = props;
  return (
    <div className={`rounded-lg border bg-card p-3 ${orphan ? "border-red-500/40 ring-1 ring-red-500/20" : ""}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">{l.name}</span>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${INTENT_STYLE[l.intent]}`}>
              {l.intent}
            </Badge>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STAGE_STYLE[l.stage]}`}>
              {l.stage}
            </Badge>
            {orphan && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-500/15 text-red-600 border-red-500/30">
                ⚠ orphan
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {l.phone} · {l.preferredArea} · ₹{l.budget.toLocaleString("en-IN")} · {tcmName}
          </div>
        </div>
      </div>

      {/* One-click action row */}
      <div className="flex flex-wrap gap-1.5">
        <ActionBtn icon={<Phone className="h-3 w-3" />} label="Call" onClick={props.onCall} />
        <ActionBtn icon={<MessageCircle className="h-3 w-3" />} label="WA" onClick={props.onWa} />
        <ActionBtn icon={<MapPin className="h-3 w-3" />} label="Visit" onClick={props.onVisit} />
        <ActionBtn
          icon={<Flame className="h-3 w-3" />}
          label="Hot"
          onClick={props.onHot}
          tone={l.intent === "hot" ? "active" : "default"}
        />
        <ActionBtn
          icon={<CheckCircle2 className="h-3 w-3" />}
          label="Token"
          onClick={props.onToken}
          tone="success"
        />
        {orphan && (
          <ActionBtn
            icon={<AlertTriangle className="h-3 w-3" />}
            label="Assign"
            onClick={props.onAssign}
            tone="danger"
          />
        )}
      </div>
    </div>
  );
}

function ActionBtn({
  icon, label, onClick, tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: "default" | "success" | "danger" | "active";
}) {
  const cls =
    tone === "success" ? "bg-green-500/10 text-green-600 border-green-500/30 hover:bg-green-500/20" :
    tone === "danger"  ? "bg-red-500/10 text-red-600 border-red-500/30 hover:bg-red-500/20" :
    tone === "active"  ? "bg-red-500 text-white border-red-500 hover:bg-red-600" :
                         "bg-background border-border hover:bg-muted";
  return (
    <button
      onClick={onClick}
      className={`h-7 px-2 rounded-md text-[11px] font-medium border flex items-center gap-1 transition ${cls}`}>
      {icon}{label}
    </button>
  );
}