import { useMemo, useState } from "react";
import { useMountedNow } from "@/hooks/use-now";
import { useApp } from "@/lib/store";
import { useQuotations, renderQuotationMessage, formatINR } from "@/lib/crm10x/quotations";
import type { Lead, Property } from "@/lib/types";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Home, MapPin, IndianRupee, Calendar as CalendarIcon, FileText,
  Handshake, CheckCircle2, Phone, MessageSquare, Sparkles, Bed, Lock,
  Plus, RotateCcw, BellRing, StickyNote, Moon, ExternalLink, Mail,
} from "lucide-react";
import { toast } from "sonner";
import { createHold, logTimeline, reconfirmProperty } from "@/lib/atc/store";
import { FreshnessBadge } from "@/components/atc/FreshnessBadge";
import { useSnoozes, SNOOZE_PRESETS } from "@/lib/impact/snoozes";
import { CopyChip } from "@/components/atc/CopyChip";
import {
  tourScheduledMessage, quoteMessage, negotiateMessage, checkinMessage,
  copyToClipboard, waLink, OFFICE_PHONE, visitBlock,
} from "@/lib/impact/copy-formats";
import { useOwnerInventory } from "@/lib/owners/account-store";
import { useVisitWar, STAGE_META, type VisitStage } from "@/lib/visits/war-store";
import { upsertVisitEvent, findBufferConflicts } from "@/lib/calendar-store";
import { ownerCodeForPG } from "@/property-genius/lib/roles";
import { Play, MapPinned, Footprints, Flag } from "lucide-react";


export type LeadActionVerb =
  | "schedule" | "quote" | "negotiate" | "book" | "checkin" | "call";

const VERB_META: Record<LeadActionVerb, { title: string; sub: string; tier: string }> = {
  schedule:  { title: "Schedule a tour",     sub: "Pick a property to book the visit.",         tier: "text-do-today" },
  quote:     { title: "Send a quotation",    sub: "Pick a property to draft the price card.",   tier: "text-do-today" },
  negotiate: { title: "Negotiate offer",     sub: "Pick the property the lead is debating.",    tier: "text-do-now" },
  book:      { title: "Direct book",         sub: "Close the deal — pick the room to lock in.", tier: "text-won" },
  checkin:   { title: "Schedule check-in",   sub: "Pick the booked property to set check-in.",  tier: "text-won" },
  call:      { title: "Log a call",          sub: "Pick the property you discussed (optional).", tier: "text-do-now" },
};

/* lightweight scorer using store properties so all action verbs share one list */
interface Scored { p: Property; score: number; reasons: string[] }
function scoreProps(lead: Lead, properties: Property[]): Scored[] {
  return properties
    .map((p) => {
      const reasons: string[] = [];
      let s = 0;
      // budget fit (±15%)
      const lo = lead.budget * 0.85, hi = lead.budget * 1.15;
      if (p.pricePerBed >= lo && p.pricePerBed <= hi) { s += 40; reasons.push("Budget fit"); }
      else if (p.pricePerBed < lo)                    { s += 25; reasons.push("Under budget"); }
      else                                            { s += 10; reasons.push("Above budget"); }
      // area
      if (lead.preferredArea && p.area.toLowerCase().includes(lead.preferredArea.toLowerCase())) {
        s += 25; reasons.push(`In ${p.area}`);
      }
      // availability
      if (p.vacantBeds > 0) { s += 20; reasons.push(`${p.vacantBeds} beds free`); }
      else { s -= 30; reasons.push("Full"); }
      // freshness
      if (p.daysSinceLastBooking <= 3) { s += 10; reasons.push("Hot"); }
      return { p, score: s, reasons };
    })
    .sort((a, b) => b.score - a.score);
}

function defaultQuoteForProperty(p: Property) {
  const actual = p.pricePerBed;
  const disc   = Math.round(actual * 0.92);
  return {
    propertyId: p.id,
    propertyName: p.name,
    roomType: "Sharing",
    actualRent: actual,
    discountedPrice: disc,
    deposit: disc,
    prebook: 2000,
    maintenance: 500,
    maintenanceType: "Monthly" as const,
    lockIn: "3 months",
    notice: "1 month",
    validityMinutes: 120,
    validUntilISO: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  };
}

export function LeadActionDialog({
  open, onOpenChange, lead, verb,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: Lead | null;
  verb: LeadActionVerb;
}) {
  const {
    properties, currentTcmId, scheduleTour, closeDeal, logCall, tours, addProperty,
    tcms, rescheduleTour, addNote, addFollowUp, selectLead,
  } = useApp();
  // Owner-live inventory overrides — Impact only schedules against beds the
  // owner has confirmed available right now.
  const ownerInv = useOwnerInventory();
  const livePropsRaw = useMemo(() => properties.map((p) => {
    const inv = ownerInv[p.id];
    if (!inv) return p;
    const free = inv.isLive ? Math.max(0, inv.vacantBeds - inv.blockedBeds) : 0;
    return { ...p, vacantBeds: free, totalBeds: inv.totalBeds };
  }), [properties, ownerInv]);
  const addQuote = useQuotations((s) => s.add);
  const snooze = useSnoozes((s) => s.snooze);
  // Visit war-room — every schedule/start/done flows through here so the
  // /visit-war room and the TCM dialog stay in lockstep.
  const warUpsert = useVisitWar((s) => s.upsert);
  const warPatch = useVisitWar((s) => s.patch);
  const warPushAlert = useVisitWar((s) => s.pushAlert);
  const warRecords = useVisitWar((s) => s.records);
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({ name: "", area: "", pricePerBed: 12000, vacantBeds: 1, totalBeds: 10 });
  const [note, setNote] = useState("");

  const handleAddProperty = () => {
    if (!draft.name.trim() || !draft.area.trim()) {
      toast.error("Name and area are required");
      return;
    }
    const p = addProperty({
      name: draft.name.trim(),
      area: draft.area.trim(),
      pricePerBed: Number(draft.pricePerBed) || 0,
      vacantBeds: Math.max(0, Number(draft.vacantBeds) || 0),
      totalBeds: Math.max(1, Number(draft.totalBeds) || 1),
    });
    toast.success(`Added ${p.name}`);
    setShowAdd(false);
    setDraft({ name: "", area: "", pricePerBed: 12000, vacantBeds: 1, totalBeds: 10 });
    setQuery(p.name);
  };

  const scored = useMemo(() => {
    if (!lead) return [];
    const all = scoreProps(lead, livePropsRaw);
    if (!query.trim()) return all;
    const q = query.toLowerCase();
    return all.filter(({ p }) =>
      p.name.toLowerCase().includes(q) || p.area.toLowerCase().includes(q),
    );
  }, [lead, livePropsRaw, query]);

  if (!lead) return null;
  const meta = VERB_META[verb];
  const assignedTcm = tcms.find((t) => t.id === lead.assignedTcmId);
  const openTourForLead = tours.find((t) => t.leadId === lead.id && t.status === "scheduled");

  const waSend = (text: string) => {
    const url = `https://wa.me/${lead.phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener");
  };

  const handleSchedule = (p: Property) => {
    const when = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const wasReschedule = !!openTourForLead;
    let tourId = openTourForLead?.id;
    if (openTourForLead) {
      rescheduleTour(openTourForLead.id, when);
      logTimeline(lead.id, "visit-scheduled", `Visit rescheduled · ${p.name}`, { propertyId: p.id });
    } else {
      const t = scheduleTour({ leadId: lead.id, propertyId: p.id, tcmId: lead.assignedTcmId || currentTcmId, scheduledAt: when });
      tourId = t.id;
      logTimeline(lead.id, "visit-scheduled", `Visit scheduled · ${p.name}`, { propertyId: p.id });
    }
    // Mirror into Visit War Room so the live board sees this immediately.
    if (tourId) {
      const tcm = tcms.find((t) => t.id === (lead.assignedTcmId || currentTcmId));
      const ownerCode = ownerCodeForPG(p.id);
      const whenMs = new Date(when).getTime();
      // Buffer guard — warn (don't block) if TCM has <30m gap to next visit.
      const conflicts = findBufferConflicts({
        tcmEmail: tcm?.email, scheduledAt: whenMs, excludeTourId: tourId,
      });
      const conflictWith = conflicts[0]?.tourId;
      if (conflicts.length) {
        toast.warning(`Buffer conflict · ${tcm?.name ?? "TCM"} has a nearby visit`, {
          description: `${conflicts.length} overlapping slot${conflicts.length > 1 ? "s" : ""} — consider rescheduling.`,
          duration: 6000,
        });
      }
      warUpsert({
        tourId, leadId: lead.id, leadName: lead.name, leadPhone: lead.phone,
        propertyId: p.id, propertyName: p.name, propertyArea: p.area,
        tcmId: tcm?.id ?? currentTcmId, tcmName: tcm?.name ?? "TCM",
        scheduledAt: whenMs,
        stage: "scheduled", objections: [], outcome: null,
        lastUpdateAt: Date.now(),
        ownerCode,
        bufferConflictWith: conflictWith,
        warnedBuffer: !!conflictWith,
      });
      // Mirror to calendar — same description as the WhatsApp paste block.
      const cb = visitBlock({
        propertyName: p.name, propertyArea: p.area, scheduledAt: whenMs,
        pricePerBed: p.pricePerBed, leadPhone: lead.phone,
      });
      const evtId = upsertVisitEvent({
        tourId, leadId: lead.id, leadName: lead.name, leadPhone: lead.phone,
        propertyName: p.name, propertyArea: p.area, scheduledAt: whenMs,
        tcmEmail: tcm?.email, description: cb,
      });
      warPatch(tourId, { calendarEventId: evtId });
      warPushAlert({
        tourId, leadName: lead.name, severity: "info", kind: "started",
        message: `${wasReschedule ? "Rescheduled" : "Scheduled"} · ${p.name} (${p.area}) · synced to calendar`,
      });
      if (conflictWith) {
        warPushAlert({
          tourId, leadName: lead.name, severity: "warn", kind: "delay",
          message: `Buffer conflict · <30m gap with another visit on ${tcm?.name ?? "TCM"}'s calendar`,
        });
      }
    }
    const msg = tourScheduledMessage(p, when);
    copyToClipboard(msg);
    toast.success(`${wasReschedule ? "Rescheduled" : "Scheduled"} · ${p.name}`, {
      description: `Message copied. Call us 20 min prior on ${OFFICE_PHONE}.`,
      duration: 7000,
      action: {
        label: "Open WhatsApp",
        onClick: () => window.open(waLink(lead.phone, msg), "_blank", "noopener"),
      },
    });
    onOpenChange(false);
  };

  // Visit lifecycle — patches the war-room record + emits alerts so
  // /visit-war updates live without leaving this dialog.
  const advanceVisit = (stage: VisitStage) => {
    if (!openTourForLead) return;
    const rec = warRecords[openTourForLead.id];
    const stamp = Date.now();
    const stageStampKey =
      stage === "started" ? "startedAt" :
      stage === "at-property" ? "reachedAt" :
      stage === "tour-ongoing" ? "ongoingAt" :
      stage === "completed" ? "completedAt" : undefined;
    if (!rec) {
      const tcm = tcms.find((t) => t.id === (lead.assignedTcmId || currentTcmId));
      const p = properties.find((x) => x.id === openTourForLead.propertyId);
      warUpsert({
        tourId: openTourForLead.id,
        leadId: lead.id, leadName: lead.name, leadPhone: lead.phone,
        propertyId: p?.id ?? "", propertyName: p?.name ?? "Property",
        propertyArea: p?.area ?? "",
        tcmId: tcm?.id ?? currentTcmId, tcmName: tcm?.name ?? "TCM",
        scheduledAt: new Date(openTourForLead.scheduledAt).getTime(),
        stage, objections: [], outcome: null,
        lastUpdateAt: stamp,
        ...(stageStampKey ? { [stageStampKey]: stamp } : {}),
      });
    } else {
      warPatch(openTourForLead.id, {
        stage,
        ...(stageStampKey ? { [stageStampKey]: stamp } : {}),
      });
    }
    warPushAlert({
      tourId: openTourForLead.id, leadName: lead.name,
      severity: stage === "completed" ? "win" : "info",
      kind: stage === "started" ? "started" : stage === "at-property" ? "reached" : stage === "tour-ongoing" ? "ongoing" : "completed",
      message: `${STAGE_META[stage].label} · ${lead.name}`,
    });
    logTimeline(lead.id, "note", `Visit → ${STAGE_META[stage].label}`);
    toast.success(`Visit → ${STAGE_META[stage].label}`, {
      description: "Mirrored to Visit War Room.",
    });
  };
  const currentVisit = openTourForLead ? warRecords[openTourForLead.id] : undefined;


  const handleQuote = (p: Property) => {
    const draft = defaultQuoteForProperty(p);
    const message = renderQuotationMessage(draft);
    addQuote({
      leadId: lead.id, tcmId: currentTcmId,
      ...draft, message,
    });
    const out = quoteMessage(p, draft.discountedPrice);
    copyToClipboard(out);
    toast.success(`Quote ready · ${p.name}`, {
      description: `Message copied. Call ${OFFICE_PHONE} to confirm.`,
      duration: 6000,
      action: { label: "Open WhatsApp", onClick: () => window.open(waLink(lead.phone, out), "_blank", "noopener") },
    });
    logTimeline(lead.id, "payment-initiated", `Quote sent · ${p.name} · ${formatINR(draft.discountedPrice)}`, { propertyId: p.id });
    onOpenChange(false);
  };

  const handleNegotiate = (p: Property) => {
    const offer = Math.round(p.pricePerBed * 0.9);
    const text = negotiateMessage(p, offer);
    copyToClipboard(text);
    toast.success(`Negotiation ready · ${p.name}`, {
      description: `Copied. Lead will call ${OFFICE_PHONE} to lock.`,
      duration: 6000,
      action: { label: "Open WhatsApp", onClick: () => window.open(waLink(lead.phone, text), "_blank", "noopener") },
    });
    logTimeline(lead.id, "note", `Negotiation sent · ${p.name} @ ${formatINR(offer)}`, { propertyId: p.id });
    onOpenChange(false);
  };

  const handleHold = (p: Property) => {
    const h = createHold({
      leadId: lead.id, leadName: lead.name,
      propertyId: p.id, propertyName: p.name,
      amount: p.pricePerBed,
    });
    // Auto-mark inventory verified — we just looked at it.
    reconfirmProperty(p.id, currentTcmId);
    toast.success(`Hold created · ${p.name} · expires in 2h`, {
      description: `Hold #${h.id.slice(-6)} · awaiting team + owner ack`,
    });
    onOpenChange(false);
  };

  const handleBook = (p: Property) => {
    // create a synthetic tour now so the booking has a tourId trail
    const t = scheduleTour({
      leadId: lead.id, propertyId: p.id, tcmId: currentTcmId,
      scheduledAt: new Date().toISOString(),
    });
    closeDeal({
      leadId: lead.id, tourId: t.id, propertyId: p.id,
      tcmId: currentTcmId, amount: p.pricePerBed,
    });
    // Close out the visit war-room record as booked.
    warUpsert({
      tourId: t.id, leadId: lead.id, leadName: lead.name, leadPhone: lead.phone,
      propertyId: p.id, propertyName: p.name, propertyArea: p.area,
      tcmId: currentTcmId, tcmName: tcms.find((x) => x.id === currentTcmId)?.name ?? "TCM",
      scheduledAt: Date.now(), stage: "booked",
      objections: [], outcome: "booked", lastUpdateAt: Date.now(),
      completedAt: Date.now(),
    });
    warPushAlert({
      tourId: t.id, leadName: lead.name, severity: "win", kind: "booked",
      message: `Booked · ${p.name} · ${formatINR(p.pricePerBed)}/mo`,
    });
    logTimeline(lead.id, "booking-confirmed", `Booking confirmed · ${p.name} · ${formatINR(p.pricePerBed)}/mo`, { propertyId: p.id });
    toast.success(`Booked · ${p.name} · ${formatINR(p.pricePerBed)}/mo`);
    onOpenChange(false);
  };

  const handleCheckin = (p: Property) => {
    const text = checkinMessage(p);
    copyToClipboard(text);
    toast.success(`Check-in ready · ${p.name}`, {
      description: `Copied. Lead can call ${OFFICE_PHONE} for slots.`,
      duration: 6000,
      action: { label: "Open WhatsApp", onClick: () => window.open(waLink(lead.phone, text), "_blank", "noopener") },
    });
    logTimeline(lead.id, "check-in", `Check-in initiated · ${p.name}`, { propertyId: p.id });
    onOpenChange(false);
  };

  const handleCall = (p?: Property) => {
    logCall(lead.id);
    window.open(`tel:${lead.phone}`, "_self");
    logTimeline(lead.id, "note", p ? `Call logged re ${p.name}` : "Call logged", p ? { propertyId: p.id } : undefined);
    toast.success(p ? `Calling ${lead.name.split(" ")[0]} re ${p.name}` : `Calling ${lead.name.split(" ")[0]}`);
    onOpenChange(false);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className={`flex items-center gap-2 ${meta.tier}`}>
            <Sparkles className="h-4 w-4" />
            {meta.title} · {lead.name}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {meta.sub} · Budget {formatINR(lead.budget)} · {lead.preferredArea || "any zone"}
          </DialogDescription>
          {/* TCM contact strip — every action shows who owns this lead and
              gives one-tap call / WhatsApp / Calendly / email so nothing
              falls through the cracks. */}
          {assignedTcm && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
              <Badge variant="outline" className="gap-1 text-[10px]">
                <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-accent text-accent-foreground text-[9px] font-mono">
                  {assignedTcm.initials}
                </span>
                {assignedTcm.name} · {assignedTcm.zone}
              </Badge>
              {assignedTcm.phone && (
                <>
                  <Button asChild size="sm" variant="outline" className="h-6 text-[10px] gap-1 px-2">
                    <a href={`tel:${assignedTcm.phone}`}><Phone className="h-3 w-3" />{assignedTcm.phone}</a>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="h-6 text-[10px] gap-1 px-2">
                    <a href={`https://wa.me/91${assignedTcm.phone.replace(/\D/g, "").slice(-10)}`} target="_blank" rel="noopener">
                      <MessageSquare className="h-3 w-3" /> WA team
                    </a>
                  </Button>
                </>
              )}
              {assignedTcm.calendly && (
                <Button asChild size="sm" variant="outline" className="h-6 text-[10px] gap-1 px-2">
                  <a href={assignedTcm.calendly} target="_blank" rel="noopener">
                    <CalendarIcon className="h-3 w-3" /> Calendly <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </Button>
              )}
              {assignedTcm.email && (
                <Button asChild size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2 text-muted-foreground">
                  <a href={`mailto:${assignedTcm.email}`}><Mail className="h-3 w-3" />{assignedTcm.email}</a>
                </Button>
              )}
              {openTourForLead && (
                <Badge variant="outline" className="text-[10px] gap-1 border-do-today/40 text-do-today">
                  <RotateCcw className="h-3 w-3" /> Tour open — actions reschedule it
                </Badge>
              )}
            </div>
          )}
          {/* Visit War lifecycle — visible whenever a tour exists for this lead.
              One click moves the visit through the funnel and mirrors to /visit-war. */}
          {openTourForLead && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] rounded-md border bg-muted/30 px-2 py-1.5">
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Visit</span>
              <Badge
                variant="outline"
                className="text-[10px] font-mono"
                style={{
                  background: STAGE_META[currentVisit?.stage ?? "scheduled"].bg,
                  color: STAGE_META[currentVisit?.stage ?? "scheduled"].fg,
                  borderColor: STAGE_META[currentVisit?.stage ?? "scheduled"].fg + "55",
                }}
              >
                {STAGE_META[currentVisit?.stage ?? "scheduled"].label}
              </Badge>
              <VisitCountdown scheduledAt={+new Date(openTourForLead.scheduledAt)} />
              {currentVisit?.calendarEventId && (
                <Badge variant="outline" className="text-[10px] gap-1 border-info/40 text-info">
                  <CalendarIcon className="h-3 w-3" /> Calendar synced
                </Badge>
              )}
              {currentVisit?.bufferConflictWith && (
                <Badge variant="outline" className="text-[10px] gap-1 border-warning/40 text-warning">
                  <BellRing className="h-3 w-3" /> Buffer conflict
                </Badge>
              )}
              <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 px-2"
                onClick={() => advanceVisit("started")}>
                <Play className="h-3 w-3" /> Start
              </Button>
              <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 px-2"
                onClick={() => advanceVisit("at-property")}>
                <MapPinned className="h-3 w-3" /> At property
              </Button>
              <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 px-2"
                onClick={() => advanceVisit("tour-ongoing")}>
                <Footprints className="h-3 w-3" /> Tour ongoing
              </Button>
              <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 px-2"
                onClick={() => advanceVisit("completed")}>
                <Flag className="h-3 w-3" /> Visit done
              </Button>
              <Button asChild size="sm" variant="ghost" className="h-6 text-[10px] gap-1 px-2 ml-auto text-muted-foreground">
                <a href="/visit-war" target="_blank" rel="noopener">
                  Open war room <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </Button>
            </div>
          )}
        </DialogHeader>

        <div className="px-5 pt-3 pb-2 flex items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search property by name or area…"
            className="h-8 text-xs"
          />
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => setShowAdd((v) => !v)}>
            <Plus className="h-3.5 w-3.5" /> Add property
          </Button>
          {verb === "call" && (
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => handleCall()}>
              <Phone className="h-3.5 w-3.5" /> Call without property
            </Button>
          )}
        </div>

        {showAdd && (
          <div className="mx-5 mb-2 rounded-md border bg-muted/30 p-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            <Input className="h-8 text-xs col-span-2" placeholder="Property name"
              value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <Input className="h-8 text-xs" placeholder="Area"
              value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value })} />
            <Input className="h-8 text-xs" type="number" placeholder="₹/bed"
              value={draft.pricePerBed} onChange={(e) => setDraft({ ...draft, pricePerBed: Number(e.target.value) })} />
            <div className="flex gap-1">
              <Input className="h-8 text-xs w-14" type="number" placeholder="Vac"
                value={draft.vacantBeds} onChange={(e) => setDraft({ ...draft, vacantBeds: Number(e.target.value) })} />
              <Input className="h-8 text-xs w-14" type="number" placeholder="Tot"
                value={draft.totalBeds} onChange={(e) => setDraft({ ...draft, totalBeds: Number(e.target.value) })} />
            </div>
            <Button size="sm" className="h-8 text-xs col-span-2 sm:col-span-5" onClick={handleAddProperty}>
              Save property
            </Button>
          </div>
        )}

        <ScrollArea className="max-h-[60vh] px-5 pb-5">
          {scored.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-8 space-y-2">
              <div>No properties match — clear search or add a new one.</div>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setShowAdd(true)}>
                <Plus className="h-3 w-3" /> Add a property
              </Button>
            </div>
          )}
          <ul className="space-y-2">
            {scored.map(({ p, score, reasons }) => {
              const primary =
                verb === "book"     ? { icon: Home,         label: "Direct book", run: () => handleBook(p),     cls: "bg-won text-white hover:bg-won/90" } :
                verb === "schedule" ? { icon: CalendarIcon, label: "Schedule",    run: () => handleSchedule(p), cls: "" } :
                verb === "quote"    ? { icon: FileText,     label: "Send quote",  run: () => handleQuote(p),    cls: "" } :
                verb === "negotiate"? { icon: Handshake,    label: "Negotiate",   run: () => handleNegotiate(p),cls: "" } :
                verb === "checkin"  ? { icon: CheckCircle2, label: "Check-in",    run: () => handleCheckin(p),  cls: "" } :
                                      { icon: Phone,        label: "Log call",    run: () => handleCall(p),     cls: "" };
              const PIcon = primary.icon;
              const tone =
                score >= 70 ? "border-do-now/50"   :
                score >= 50 ? "border-do-today/50" :
                score >= 30 ? "border-do-soon/40"  :
                              "border-border";

              return (
                <li key={p.id} className={`rounded-md border ${tone} bg-card p-3`}>
                  <div className="flex items-start gap-3">
                    <Home className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold truncate">{p.name}</span>
                        <Badge variant="outline" className="text-[10px] font-mono">{score}</Badge>
                        {p.vacantBeds === 0 && (
                          <Badge variant="destructive" className="text-[10px]">Full</Badge>
                        )}
                        <FreshnessBadge propertyId={p.id} />
                      </div>

                      <div className="text-[11px] text-muted-foreground flex items-center gap-3 mt-1 flex-wrap">
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{p.area}</span>
                        <span className="flex items-center gap-1"><IndianRupee className="h-3 w-3" />{formatINR(p.pricePerBed)}/mo</span>
                        <span className="flex items-center gap-1"><Bed className="h-3 w-3" />{p.vacantBeds}/{p.totalBeds}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {reasons.join(" · ")}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                    <Button
                      size="sm"
                      disabled={(verb === "book" || verb === "schedule" || verb === "negotiate" || verb === "checkin") && p.vacantBeds === 0}
                      className={`h-7 text-[11px] gap-1 ${primary.cls}`}
                      onClick={primary.run}
                    >
                      <PIcon className="h-3 w-3" /> {primary.label}
                    </Button>

                    {/* Secondary cross-actions so the row covers every step */}
                    {verb !== "book" && (
                      <Button size="sm" variant="outline" disabled={p.vacantBeds === 0}
                        className="h-7 text-[11px] gap-1" onClick={() => handleBook(p)}>
                        <Home className="h-3 w-3" /> Book
                      </Button>
                    )}
                    <Button size="sm" variant="outline" disabled={p.vacantBeds === 0}
                      className="h-7 text-[11px] gap-1 border-do-now/40 text-do-now hover:bg-do-now/10"
                      onClick={() => handleHold(p)}>
                      <Lock className="h-3 w-3" /> Hold 2h
                    </Button>

                    {verb !== "schedule" && (
                      <Button size="sm" variant="outline" disabled={p.vacantBeds === 0}
                        className="h-7 text-[11px] gap-1"
                        onClick={() => handleSchedule(p)}>
                        <CalendarIcon className="h-3 w-3" /> Schedule
                      </Button>
                    )}
                    {verb !== "quote" && (
                      <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1"
                        onClick={() => handleQuote(p)}>
                        <FileText className="h-3 w-3" /> Quote
                      </Button>
                    )}
                    {verb !== "negotiate" && (
                      <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1"
                        onClick={() => handleNegotiate(p)}>
                        <Handshake className="h-3 w-3" /> Negotiate
                      </Button>
                    )}
                    {verb !== "checkin" && (
                      <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1"
                        onClick={() => handleCheckin(p)}>
                        <CheckCircle2 className="h-3 w-3" /> Check-in
                      </Button>
                    )}
                    {verb !== "call" && (
                      <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1"
                        onClick={() => handleCall(p)}>
                        <Phone className="h-3 w-3" /> Log call
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1 ml-auto"
                      onClick={() => waSend(`Sharing *${p.name}* (${p.area}) · ${formatINR(p.pricePerBed)}/mo.\n\nCall ${OFFICE_PHONE} to visit.`)}>
                      <MessageSquare className="h-3 w-3" /> WhatsApp
                    </Button>
                    <CopyChip
                      size="xs"
                      label="Copy"
                      text={`${p.name} · ${p.area} · ${formatINR(p.pricePerBed)}/mo · ${p.vacantBeds}/${p.totalBeds} beds free\nCall ${OFFICE_PHONE} to visit.`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollArea>

        {/* ---------------- Make Impact footer — universal sub-menu --------- */}
        <div className="border-t bg-muted/20 px-5 py-3 space-y-2">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" /> Make impact · works for every role
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a quick note (e.g. 'wants east-facing room')…"
              className="h-7 text-[11px] flex-1 min-w-[180px]"
            />
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1"
              disabled={!note.trim()}
              onClick={() => {
                addNote(lead.id, note.trim());
                logTimeline(lead.id, "note", note.trim());
                toast.success("Note saved");
                setNote("");
              }}>
              <StickyNote className="h-3 w-3" /> Save note
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1"
              onClick={() => {
                const due = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
                addFollowUp({
                  leadId: lead.id,
                  tcmId: lead.assignedTcmId || currentTcmId,
                  dueAt: due, priority: "medium",
                  reason: "Manual follow-up from action dialog",
                });
                toast.success("Follow-up set for tomorrow");
              }}>
              <BellRing className="h-3 w-3" /> Follow-up tomorrow
            </Button>
            {SNOOZE_PRESETS.map((p) => (
              <Button key={p.label} size="sm" variant="ghost" className="h-7 text-[11px] gap-1"
                onClick={() => {
                  const until = "at" in p ? p.at() : new Date(Date.now() + p.ms).toISOString();
                  snooze(lead.id, until);
                  toast.success(`Snoozed · ${p.label}`);
                }}>
                <Moon className="h-3 w-3" /> {p.label}
              </Button>
            ))}
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 ml-auto"
              onClick={() => { selectLead(lead.id); onOpenChange(false); }}>
              <ExternalLink className="h-3 w-3" /> Open full lead drawer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Live T-minus countdown to a scheduled visit. Ticks every second; clamps at "Now". */
function VisitCountdown({ scheduledAt }: { scheduledAt: number }) {
  const [now, mounted] = useMountedNow(1000);
  if (!mounted) return null;
  const diff = scheduledAt - now;
  const past = diff < 0;
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const s = Math.floor((abs % 60_000) / 1000);
  const within24 = abs < 24 * 3_600_000;
  const tone = past
    ? "border-destructive/40 text-destructive"
    : h < 2 ? "border-do-now/40 text-do-now"
    : h < 24 ? "border-do-today/40 text-do-today"
    : "border-border text-muted-foreground";
  const label = past
    ? `T+${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    : within24
      ? `T−${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
      : `${Math.floor(h / 24)}d ${h % 24}h`;
  return (
    <Badge variant="outline" className={`text-[10px] font-mono gap-1 ${tone}`}>
      <CalendarIcon className="h-3 w-3" /> {label}
    </Badge>
  );
}

