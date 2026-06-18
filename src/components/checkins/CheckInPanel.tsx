import { useMemo, useState } from "react";
import {
  useCheckins, STAGE_LABEL, STAGE_ORDER, DELAY_REASONS, ISSUE_CATEGORIES,
  RISK_LABEL, RISK_CLASS, riskLevel, formatINR,
  type DelayReason, type IssueCategory,
} from "@/lib/checkins/store";
import {
  waBookingConfirm, waTokenRequest, waTokenReceipt, waRoomAssigned,
  waDateConfirm, waMoveInReminder, waMovedIn, waSettleCheck, waRescheduleCheckIn,
} from "@/lib/checkins/templates";
import { useApp } from "@/lib/store";
import { useLeadFocus } from "@/lib/crm10x/lead-focus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useMountedNow } from "@/hooks/use-now";
import {
  CheckCircle2, MessageSquare, IndianRupee, Home, Calendar as CalendarIcon,
  AlertTriangle, KeyRound, Sparkles, Copy, RotateCcw, Wrench,
  ScrollText,
} from "lucide-react";
import type { Lead } from "@/lib/types";

function copyWA(msg: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(msg).catch(() => {});
  }
  toast.success("WhatsApp text copied");
}

export function CheckInPanel({ lead }: { lead: Lead }) {
  const properties = useApp((s) => s.properties);
  const setLeadStage = useApp((s) => s.setLeadStage);
  const upsert = useCheckins((s) => s.upsert);
  const setStage = useCheckins((s) => s.setStage);
  const patch = useCheckins((s) => s.patch);
  const addDelay = useCheckins((s) => s.addDelay);
  const addIssue = useCheckins((s) => s.addIssue);
  const setIssueStatus = useCheckins((s) => s.setIssueStatus);
  const checkin = useCheckins((s) => s.checkins.find((c) => c.leadId === lead.id));
  const focus = useLeadFocus(lead);
  const [, mounted] = useMountedNow();

  const risk = useMemo(() => (mounted && checkin ? riskLevel(checkin) : 0), [checkin, mounted]);
  const stageIdx = checkin ? STAGE_ORDER.indexOf(checkin.stage) : -1;

  // form state (stable hooks regardless of checkin presence)
  const [ackText, setAckText] = useState("");
  const [tokenAmount, setTokenAmount] = useState("");
  const [tokenRef, setTokenRef] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [checkInDate, setCheckInDate] = useState("");
  const [reschedDate, setReschedDate] = useState("");
  const [reschedReason, setReschedReason] = useState<DelayReason>("finance");
  const [issueCat, setIssueCat] = useState<IssueCategory>("wifi");
  const [issueDesc, setIssueDesc] = useState("");
  const [nps, setNps] = useState("");

  if (!checkin) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center space-y-3">
        <Sparkles className="h-8 w-8 mx-auto text-muted-foreground" />
        <div className="text-sm text-muted-foreground">
          Check-in starts once the lead is booked.
        </div>
        <Button
          size="sm"
          onClick={() => {
            const rent = focus.amount || lead.budget || 12000;
            upsert({
              leadId: lead.id,
              rent,
              deposit: focus.deposit || rent * 2,
              propertyId: focus.propertyId,
              propertyName: focus.propertyName,
            });
            if (lead.stage !== "booked") setLeadStage(lead.id, "booked");
            toast.success("Check-in record created");
          }}
        >
          Start check-in manually
        </Button>
      </div>
    );
  }

  const propertyName =
    properties.find((p) => p.id === propertyId)?.name ?? checkin.propertyName;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-3 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">{STAGE_LABEL[checkin.stage]}</Badge>
            <Badge variant="outline" className={`text-[10px] ${RISK_CLASS[risk]}`}>
              {risk >= 2 && <AlertTriangle className="h-3 w-3 mr-1" />}
              {RISK_LABEL[risk]}
            </Badge>
            {checkin.delays.length > 0 && (
              <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-600 border-orange-500/30">
                {checkin.delays.length} reschedule{checkin.delays.length > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Balance due <span className="font-bold text-foreground">{formatINR(checkin.balanceDue)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {STAGE_ORDER.map((s, i) => (
            <div key={s}
              className={`h-1.5 flex-1 rounded-full ${i <= stageIdx ? "bg-primary" : "bg-muted"}`}
              title={STAGE_LABEL[s]}
            />
          ))}
        </div>
      </div>

      <StageCard
        active={checkin.stage === "booked"}
        done={stageIdx > STAGE_ORDER.indexOf("booked")}
        icon={MessageSquare}
        title="Paste customer's confirmation"
        helper="WhatsApp reply text. Optional: paste screenshot URL."
      >
        <Textarea
          value={ackText || checkin.ackText || ""}
          onChange={(e) => setAckText(e.target.value)}
          placeholder='e.g. "Yes confirmed, please proceed"'
          className="min-h-[64px] text-xs"
        />
        <Input
          value={checkin.ackScreenshotUrl ?? ""}
          onChange={(e) => patch(checkin.id, { ackScreenshotUrl: e.target.value })}
          placeholder="Screenshot URL (optional)"
          className="h-8 text-xs"
        />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs flex-1"
            onClick={() => copyWA(waBookingConfirm(lead.name, checkin.propertyName))}
          >
            <Copy className="h-3 w-3 mr-1" /> Copy WA: confirm
          </Button>
          <Button size="sm" className="h-8 text-xs flex-1"
            disabled={!ackText.trim() && !checkin.ackText}
            onClick={() => {
              patch(checkin.id, { ackText: ackText || checkin.ackText, ackAt: new Date().toISOString() });
              setStage(checkin.id, "ack_received");
              toast.success("Ack received");
            }}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" /> Mark ack received
          </Button>
        </div>
      </StageCard>

      <StageCard
        active={checkin.stage === "ack_received"}
        done={stageIdx > STAGE_ORDER.indexOf("ack_received")}
        icon={IndianRupee}
        title="Token paid"
        helper="Enter amount + UPI ref number from the customer's screenshot."
      >
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Amount (₹)</Label>
            <Input type="number" value={tokenAmount || String(checkin.tokenAmount ?? "")}
              onChange={(e) => setTokenAmount(e.target.value)}
              placeholder="5000" className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">UPI ref#</Label>
            <Input value={tokenRef || checkin.tokenUpiRef || ""}
              onChange={(e) => setTokenRef(e.target.value)}
              placeholder="e.g. 4523XXX9871" className="h-8 text-xs" />
          </div>
        </div>
        <Input
          value={checkin.tokenScreenshotUrl ?? ""}
          onChange={(e) => patch(checkin.id, { tokenScreenshotUrl: e.target.value })}
          placeholder="Payment screenshot URL (optional)"
          className="h-8 text-xs"
        />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs flex-1"
            onClick={() => copyWA(waTokenRequest(Number(tokenAmount) || 5000))}
          >
            <Copy className="h-3 w-3 mr-1" /> Copy WA: ask token
          </Button>
          <Button size="sm" className="h-8 text-xs flex-1"
            disabled={!tokenAmount || !tokenRef}
            onClick={() => {
              const amt = Number(tokenAmount);
              patch(checkin.id, {
                tokenAmount: amt, tokenUpiRef: tokenRef,
                tokenAt: new Date().toISOString(),
              });
              setStage(checkin.id, "token_paid");
              copyWA(waTokenReceipt({
                ...checkin, tokenAmount: amt, tokenUpiRef: tokenRef,
                balanceDue: Math.max(0, checkin.rent + checkin.deposit - amt),
              }));
              toast.success("Token recorded");
            }}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" /> Mark token received
          </Button>
        </div>
      </StageCard>

      <StageCard
        active={checkin.stage === "token_paid"}
        done={stageIdx > STAGE_ORDER.indexOf("token_paid")}
        icon={Home}
        title="Assign room"
        helper="Pick property & room number. Blocks inventory."
      >
        <div className="grid grid-cols-2 gap-2">
          <Select value={propertyId || checkin.propertyId || ""} onValueChange={setPropertyId}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Property" /></SelectTrigger>
            <SelectContent>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input value={roomNumber || checkin.roomNumber || ""}
            onChange={(e) => setRoomNumber(e.target.value)}
            placeholder="Room # (e.g. 204)" className="h-8 text-xs" />
        </div>
        <Button size="sm" className="h-8 text-xs w-full"
          disabled={!(propertyId || checkin.propertyId) || !(roomNumber || checkin.roomNumber)}
          onClick={() => {
            const pid = propertyId || checkin.propertyId!;
            const rn = roomNumber || checkin.roomNumber!;
            const pn = properties.find((p) => p.id === pid)?.name ?? propertyName;
            patch(checkin.id, {
              propertyId: pid, propertyName: pn,
              roomNumber: rn, roomAssignedAt: new Date().toISOString(),
            });
            setStage(checkin.id, "room_assigned");
            copyWA(waRoomAssigned({ ...checkin, propertyId: pid, propertyName: pn, roomNumber: rn }));
            toast.success(`Room ${rn} assigned`);
          }}
        >
          <CheckCircle2 className="h-3 w-3 mr-1" /> Confirm & copy WA
        </Button>
      </StageCard>

      <StageCard
        active={checkin.stage === "room_assigned"}
        done={stageIdx > STAGE_ORDER.indexOf("room_assigned")}
        icon={CalendarIcon}
        title="Set check-in date"
      >
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" value={checkInDate || checkin.checkInDate?.slice(0, 10) || ""}
            onChange={(e) => setCheckInDate(e.target.value)}
            className="h-8 text-xs" />
          <Button size="sm" className="h-8 text-xs"
            disabled={!checkInDate && !checkin.checkInDate}
            onClick={() => {
              const d = checkInDate || checkin.checkInDate!.slice(0, 10);
              patch(checkin.id, { checkInDate: new Date(d).toISOString() });
              setStage(checkin.id, "date_set");
              copyWA(waDateConfirm({ ...checkin, checkInDate: new Date(d).toISOString() }));
              toast.success("Date set");
            }}
          >
            Set date
          </Button>
        </div>
      </StageCard>

      {checkin.checkInDate && checkin.stage !== "moved_in" && checkin.stage !== "settled" && (
        <StageCard active={false} done={false} icon={RotateCcw} title="Reschedule check-in"
          helper={`Current: ${new Date(checkin.checkInDate).toDateString()}. Delays so far: ${checkin.delays.length}`}>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={reschedDate} onChange={(e) => setReschedDate(e.target.value)} className="h-8 text-xs" />
            <Select value={reschedReason} onValueChange={(v) => setReschedReason(v as DelayReason)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DELAY_REASONS.map((r) => (
                  <SelectItem key={r.id} value={r.id} className="text-xs">{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="outline" className="h-8 text-xs w-full"
            disabled={!reschedDate}
            onClick={() => {
              const nextDate = new Date(reschedDate).toISOString();
              addDelay(checkin.id, nextDate, reschedReason);
              copyWA(waRescheduleCheckIn({ ...checkin, checkInDate: nextDate }, DELAY_REASONS.find((r) => r.id === reschedReason)?.label));
              setReschedDate("");
              toast.warning(`Rescheduled. Risk re-scored and WhatsApp text copied.`);
            }}
          >
            Log reschedule + copy WA
          </Button>
        </StageCard>
      )}

      <StageCard
        active={checkin.stage === "date_set"}
        done={stageIdx > STAGE_ORDER.indexOf("date_set")}
        icon={KeyRound}
        title="Hand over keys"
        helper="Mark the customer as moved in. Opens 7-day care window."
      >
        <Input value={checkin.keyHandoverPhotoUrl ?? ""}
          onChange={(e) => patch(checkin.id, { keyHandoverPhotoUrl: e.target.value })}
          placeholder="Key handover photo URL (optional)"
          className="h-8 text-xs" />
        <Button size="sm" className="h-8 text-xs w-full bg-success text-success-foreground hover:bg-success/90"
          onClick={() => {
            setStage(checkin.id, "moved_in");
            copyWA(waMovedIn(lead.name));
            toast.success("Moved in — welcome message copied");
          }}
        >
          <CheckCircle2 className="h-3 w-3 mr-1" /> Mark moved in
        </Button>
      </StageCard>

      {(checkin.stage === "moved_in" || checkin.stage === "settled" || checkin.issues.length > 0) && (
        <div className="rounded-lg border border-border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-orange-500" />
            <span className="text-xs font-semibold">Issues ({checkin.issues.length})</span>
          </div>
          <div className="grid grid-cols-[1fr_2fr_auto] gap-2">
            <Select value={issueCat} onValueChange={(v) => setIssueCat(v as IssueCategory)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ISSUE_CATEGORIES.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={issueDesc} onChange={(e) => setIssueDesc(e.target.value)}
              placeholder="One-line description" className="h-8 text-xs" />
            <Button size="sm" className="h-8 text-xs"
              disabled={!issueDesc.trim()}
              onClick={() => {
                addIssue(checkin.id, issueCat, issueDesc.trim());
                setIssueDesc("");
                toast.success("Issue logged");
              }}
            >
              Add
            </Button>
          </div>
          <div className="space-y-1.5">
            {checkin.issues.map((i) => (
              <div key={i.id} className="flex items-center gap-2 text-xs rounded border border-border p-2">
                <Badge variant="outline" className="text-[10px]">{i.category}</Badge>
                <span className="flex-1 truncate">{i.description}</span>
                <Select value={i.status}
                  onValueChange={(v) => setIssueStatus(checkin.id, i.id, v as typeof i.status)}>
                  <SelectTrigger className="h-7 text-[10px] w-[110px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open" className="text-xs">Open</SelectItem>
                    <SelectItem value="in_progress" className="text-xs">In progress</SelectItem>
                    <SelectItem value="resolved" className="text-xs">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
            {checkin.issues.length === 0 && (
              <div className="text-[11px] text-muted-foreground italic">No issues yet. 🎉</div>
            )}
          </div>
        </div>
      )}

      {checkin.stage === "moved_in" && (
        <StageCard active icon={Sparkles} title="Day-7 settle check">
          <div className="flex items-center gap-2">
            <Input type="number" min={1} max={5}
              value={nps} onChange={(e) => setNps(e.target.value)}
              placeholder="NPS 1-5" className="h-8 text-xs w-24" />
            <Button size="sm" className="h-8 text-xs flex-1"
              disabled={!nps || Number(nps) < 1 || Number(nps) > 5}
              onClick={() => {
                patch(checkin.id, { npsScore: Number(nps) });
                setStage(checkin.id, "settled");
                copyWA(waSettleCheck(lead.name));
                toast.success("Settled. WA survey copied.");
              }}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" /> Mark settled
            </Button>
          </div>
        </StageCard>
      )}

      {checkin.stage === "date_set" && checkin.checkInDate && (
        <Button variant="outline" size="sm" className="h-8 text-xs w-full"
          onClick={() => copyWA(waMoveInReminder(checkin))}
        >
          <Copy className="h-3 w-3 mr-1" /> Copy 24h reminder WA
        </Button>
      )}

      <StageCard active={false} done={false} icon={ScrollText} title="Check-in audit report">
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <AuditBox label="Stage" value={STAGE_LABEL[checkin.stage]} />
          <AuditBox label="Balance" value={formatINR(checkin.balanceDue)} />
          <AuditBox label="Delays" value={String(checkin.delays.length)} danger={checkin.delays.length >= 2} />
          <AuditBox label="Issues" value={String(checkin.issues.filter((i) => i.status !== "resolved").length)} danger={checkin.issues.some((i) => i.status !== "resolved")} />
        </div>
        <div className="space-y-1 max-h-36 overflow-y-auto">
          {checkin.history.slice().reverse().map((h, idx) => (
            <div key={`${h.at}-${idx}`} className="rounded border border-border p-1.5 text-[10px]">
              <div className="font-medium">{h.note ?? STAGE_LABEL[h.stage]}</div>
              <div className="text-muted-foreground">{new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(h.at))}</div>
            </div>
          ))}
        </div>
      </StageCard>
    </div>
  );
}

function AuditBox({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={`rounded border p-2 ${danger ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-border bg-muted/20"}`}>
      <div className="text-muted-foreground">{label}</div>
      <div className="font-semibold truncate">{value}</div>
    </div>
  );
}

function StageCard({
  active, done, icon: Icon, title, helper, children,
}: {
  active?: boolean; done?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  title: string; helper?: string; children?: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg border p-3 space-y-2 ${
      done ? "border-emerald-500/30 bg-emerald-500/5"
        : active ? "border-primary/40 bg-primary/5"
        : "border-border bg-card"
    }`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${done ? "text-emerald-600" : active ? "text-primary" : "text-muted-foreground"}`} />
        <span className="text-xs font-semibold">{title}</span>
        {done && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 ml-auto" />}
      </div>
      {helper && <div className="text-[11px] text-muted-foreground">{helper}</div>}
      {children}
    </div>
  );
}
