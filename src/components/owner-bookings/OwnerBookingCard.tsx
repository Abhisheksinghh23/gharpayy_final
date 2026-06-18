import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  CheckCircle2, Circle, IndianRupee, Sparkles, AlertTriangle, Eye,
  Share2, Home, User, CalendarDays, ClipboardList, MessageSquare, History, X,
} from "lucide-react";
import type { OwnerBooking, OwnerDecision, ReadinessKey } from "@/lib/owner-bookings/types";
import { LIFECYCLE_LABEL, READINESS_LABEL } from "@/lib/owner-bookings/types";
import { computeTotals, useOwnerBookings } from "@/lib/owner-bookings/store";

interface Props {
  booking: OwnerBooking;
  mode: "sales" | "owner";
  compact?: boolean;
  onClose?: () => void;
}

const READINESS_KEYS: ReadinessKey[] = [
  "cleaning", "furniture", "internet", "electricity", "water", "inspection",
];

const statusTone: Record<OwnerBooking["status"], string> = {
  created: "bg-muted text-muted-foreground",
  shared_with_owner: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  viewed_by_owner: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  acknowledged: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  room_ready: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  move_in_approved: "bg-green-600/15 text-green-700 dark:text-green-300",
  completed: "bg-green-700/20 text-green-800 dark:text-green-200",
  rejected: "bg-red-500/15 text-red-700 dark:text-red-300",
  cancelled: "bg-muted text-muted-foreground line-through",
};

export function OwnerBookingCard({ booking: b, mode, onClose }: Props) {
  const totals = computeTotals(b);
  const store = useOwnerBookings();

  const [decideOpen, setDecideOpen] = useState(false);
  const [decision, setDecision] = useState<OwnerDecision>("approve");
  const [decisionNote, setDecisionNote] = useState("");
  const [readinessNote, setReadinessNote] = useState(b.readinessNote ?? "");

  function applyDecision() {
    store.recordOwnerDecision(b.id, decision, decisionNote);
    setDecideOpen(false);
    setDecisionNote("");
  }

  return (
    <Card className="p-0 overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-start justify-between gap-3 border-b border-border bg-muted/30">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-base truncate">{b.customer.name}</span>
            <Badge variant="outline" className="text-[10px]">{b.customer.phone}</Badge>
            <Badge className={`text-[10px] capitalize ${statusTone[b.status]}`}>
              {LIFECYCLE_LABEL[b.status]}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {b.inventory.propertyName} · Floor {b.inventory.floor} · Room {b.inventory.roomNumber} · Bed {b.inventory.bedNumber}
          </div>
        </div>
        {onClose && (
          <Button size="icon" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button>
        )}
      </div>

      <div className="p-4 grid gap-4 md:grid-cols-2">
        {/* Customer */}
        <Section icon={<User className="h-4 w-4" />} title="Customer">
          <Row label="Gender" value={cap(b.customer.gender)} />
          <Row label="Occupation" value={cap(b.customer.occupation)} />
          {b.customer.companyOrCollege && <Row label="Company/College" value={b.customer.companyOrCollege} />}
          {b.customer.emergencyName && (
            <Row label="Emergency" value={`${b.customer.emergencyName} · ${b.customer.emergencyPhone ?? "-"}`} />
          )}
        </Section>

        {/* Inventory */}
        <Section icon={<Home className="h-4 w-4" />} title="Room Allocated">
          <Row label="Sharing" value={cap(b.inventory.sharing)} />
          <Row label="Category" value={cap(b.inventory.category)} />
          <Row label="Floor / Room" value={`${b.inventory.floor} / ${b.inventory.roomNumber}`} />
          <Row label="Bed" value={b.inventory.bedNumber} />
        </Section>

        {/* Money */}
        <Section icon={<IndianRupee className="h-4 w-4" />} title="Financials">
          <Row label="Monthly Rent" value={`₹${b.rent.toLocaleString("en-IN")}`} />
          <Row label="Security Deposit" value={`₹${b.deposit.toLocaleString("en-IN")}`} />
          <Row label="Total Expected" value={`₹${totals.expected.toLocaleString("en-IN")}`} strong />
          <Row label="Received" value={`₹${totals.received.toLocaleString("en-IN")}`} tone="good" />
          <Row label="Pending" value={`₹${totals.pending.toLocaleString("en-IN")}`} tone={totals.pending > 0 ? "warn" : "good"} />
          <div className="mt-2 space-y-1">
            {b.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded border border-border bg-card px-2 py-1 text-xs">
                <span className="truncate">{p.label}</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono">₹{p.amount.toLocaleString("en-IN")}</span>
                  <Badge variant="outline" className={`text-[10px] capitalize ${
                    p.status === "received" ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300" :
                    p.status === "waived" ? "border-muted text-muted-foreground" :
                    "border-amber-500/40 text-amber-700 dark:text-amber-300"
                  }`}>{p.status}</Badge>
                  {mode === "sales" && p.status === "pending" && (
                    <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]"
                      onClick={() => store.markPaymentReceived(b.id, p.id)}>
                      Mark received
                    </Button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* Move-In */}
        <Section icon={<CalendarDays className="h-4 w-4" />} title="Move-In Plan">
          <Row label="Move-in Date" value={new Date(b.moveIn.date).toLocaleDateString()} />
          <Row label="Time" value={b.moveIn.time} />
          <Row label="Expected Stay" value={`${b.moveIn.stayMonths} months`} />
          <Row label="Lock-in" value={`${b.moveIn.lockInMonths} months`} />
          <Row label="Notice" value={`${b.moveIn.noticeDays} days`} />
        </Section>

        {/* Special Requests */}
        {b.specialRequests.length > 0 && (
          <Section icon={<Sparkles className="h-4 w-4" />} title="Customer Expectations" full>
            <ul className="grid gap-1 sm:grid-cols-2">
              {b.specialRequests.map((r) => (
                <li key={r.id} className="text-xs flex items-start gap-2 rounded border border-border bg-card px-2 py-1">
                  <Sparkles className="h-3.5 w-3.5 mt-0.5 text-amber-500" />
                  <span>{r.text}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Readiness */}
        <Section icon={<ClipboardList className="h-4 w-4" />} title={`Room Readiness · ${totals.readyCount}/${totals.totalReadiness}`} full>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {READINESS_KEYS.map((k) => {
              const ready = b.readiness[k] === "ready";
              return (
                <button key={k}
                  disabled={mode !== "owner"}
                  onClick={() => store.setReadiness(b.id, k, ready ? "pending" : "ready")}
                  className={`flex items-center gap-2 rounded border px-2 py-1.5 text-xs transition ${
                    ready
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-border bg-card text-muted-foreground"
                  } ${mode === "owner" ? "hover:border-emerald-500/70 cursor-pointer" : "cursor-default"}`}>
                  {ready ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                  <span className="flex-1 text-left">{READINESS_LABEL[k]}</span>
                </button>
              );
            })}
          </div>
          {mode === "owner" && (
            <div className="flex items-center gap-2 mt-2">
              <Textarea rows={2} placeholder="Notes for sales team (optional)…"
                value={readinessNote}
                onChange={(e) => setReadinessNote(e.target.value)}
                onBlur={() => readinessNote !== (b.readinessNote ?? "") && store.updateBooking(b.id, { readinessNote })} />
              <Button size="sm" variant="outline" onClick={() => store.markAllReady(b.id)}>All ready</Button>
            </div>
          )}
        </Section>

        {/* Owner decision summary */}
        {b.ownerDecision && (
          <Section icon={<MessageSquare className="h-4 w-4" />} title="Owner Decision" full>
            <div className="text-xs">
              <span className="font-medium capitalize">{b.ownerDecision.replace(/_/g, " ")}</span>
              {b.ownerConditionNote && <div className="text-muted-foreground mt-1">{b.ownerConditionNote}</div>}
              {b.ownerRejectionReason && <div className="text-red-600 dark:text-red-400 mt-1">Reason: {b.ownerRejectionReason}</div>}
            </div>
          </Section>
        )}

        {/* Confirmation gate */}
        <Section icon={<AlertTriangle className="h-4 w-4" />} title="Confirmation Gate" full>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Gate ok={!!b.ownerDecision && b.ownerDecision !== "reject"} label="Owner ack" />
            <Gate ok={!!b.inventory.roomNumber} label="Room assigned" />
            <Gate ok={!!b.moveIn.date} label="Move-in date" />
            <Gate ok={totals.isFullyReady} label="Room ready" />
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            Booking confirms only when all four gates clear.
          </div>
        </Section>
      </div>

      {/* History */}
      <Separator />
      <div className="p-4">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
          <History className="h-3.5 w-3.5" /> Activity ({b.history.length})
        </div>
        <ol className="space-y-1 text-xs max-h-40 overflow-auto">
          {[...b.history].reverse().map((h, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-muted-foreground tabular-nums">
                {new Date(h.ts).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="font-medium">{h.actor}</span>
              <span>{h.text}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Action bar */}
      <div className="p-3 border-t border-border bg-muted/20 flex flex-wrap items-center justify-end gap-2">
        {mode === "sales" && b.status === "created" && (
          <Button size="sm" onClick={() => store.shareWithOwner(b.id)}>
            <Share2 className="h-4 w-4 mr-1.5" /> Share with owner
          </Button>
        )}
        {mode === "owner" && b.status === "shared_with_owner" && (
          <Button size="sm" variant="outline" onClick={() => store.markViewed(b.id)}>
            <Eye className="h-4 w-4 mr-1.5" /> Mark as viewed
          </Button>
        )}
        {mode === "owner" && !b.ownerDecision && b.status !== "cancelled" && (
          <Button size="sm" onClick={() => setDecideOpen(true)}>Owner action…</Button>
        )}
        {mode === "owner" && b.ownerDecision !== "reject" && totals.isFullyReady && b.status === "room_ready" && (
          <Button size="sm" onClick={() => store.approveMoveIn(b.id)}>Approve move-in</Button>
        )}
        {mode === "sales" && b.status === "move_in_approved" && (
          <Button size="sm" onClick={() => store.completeBooking(b.id)}>Mark checked in</Button>
        )}
        {mode === "sales" && b.status !== "completed" && b.status !== "cancelled" && (
          <Button size="sm" variant="outline" onClick={() => {
            const r = prompt("Cancel reason?");
            if (r) store.cancelBooking(b.id, r);
          }}>Cancel</Button>
        )}
      </div>

      {/* Decision dialog */}
      <Dialog open={decideOpen} onOpenChange={setDecideOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Owner decision</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {(["approve", "approve_with_conditions", "reject"] as OwnerDecision[]).map((d) => (
                <button key={d}
                  onClick={() => setDecision(d)}
                  className={`text-xs rounded border px-2 py-2 capitalize ${
                    decision === d ? "border-primary bg-primary/10 font-medium" : "border-border"
                  }`}>
                  {d.replace(/_/g, " ")}
                </button>
              ))}
            </div>
            <Textarea
              rows={3}
              placeholder={
                decision === "reject"
                  ? "Reason for rejection (room occupied / under maintenance / wrong assignment)…"
                  : decision === "approve_with_conditions"
                  ? "Condition (e.g. room ready tomorrow, cleaning pending)…"
                  : "Optional note for the sales team…"
              }
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecideOpen(false)}>Cancel</Button>
            <Button onClick={applyDecision}
              disabled={decision === "reject" && !decisionNote.trim()}>
              Submit decision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Section({ icon, title, full, children }: { icon: React.ReactNode; title: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2">
        {icon}<span>{title}</span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "good" | "warn" }) {
  const toneCls = tone === "good" ? "text-emerald-700 dark:text-emerald-300" :
    tone === "warn" ? "text-amber-700 dark:text-amber-300" : "";
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${strong ? "font-semibold" : ""} ${toneCls}`}>{value}</span>
    </div>
  );
}

function Gate({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`rounded border px-2 py-1.5 flex items-center gap-2 ${
      ok ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
         : "border-border bg-card text-muted-foreground"
    }`}>
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
      <span>{label}</span>
    </div>
  );
}

function cap(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
