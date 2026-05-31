import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useApp, getProperty, getTcm } from "@/lib/store";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ConfidenceBar, IntentChip, StageBadge } from "./atoms";
import { HandoffThread } from "./HandoffThread";
import { SequenceChip } from "./SequenceChip";
import { SupplyMatchPanel } from "./leads/SupplyMatchPanel";
import { PostVisitGate } from "./crm10x/PostVisitGate";
import { CommitmentBanner } from "./crm10x/CommitmentBanner";
import { ObjectionTag } from "./crm10x/ObjectionLogger";
import { LeadDossierPanel } from "./crm10x/LeadDossierPanel";
import {
  Phone, MessageSquare, Calendar as CalendarIcon, Tag, ClipboardCheck,
  AlertTriangle, CheckCircle2, X, Activity as ActivityIcon, MapPin,
  Wallet, Send, Zap, IndianRupee, BellRing, ExternalLink, Plus,
  Building2, Video, Briefcase, Copy,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import type { Lead, LeadStage, FollowUpPriority, SequenceKind } from "@/lib/types";
import { toast } from "sonner";
import { useMountedNow } from "@/hooks/use-now";
import { sendTourMessage as sendOwnerTourMessage } from "@/owner/messaging";
import { useSettings } from "@/myt/lib/settings-context";

const TAG_OPTIONS = ["price-issue", "location-mismatch", "parents-involved", "urgent", "budget-low"];
const OBJECTIONS = ["Budget", "Location", "Amenities", "Timing", "Parents", "Comparing options", "Other"];
const ROOM_TYPES = ["Single", "Double Sharing", "Triple Sharing", "Studio"];
const BOOKING_SOURCES = ["ad", "referral", "organic", "whatsapp", "call", "walk-in"];
const DECISION_MAKERS = ["self", "parent", "group"];
const TOUR_TYPES = [
  { value: "physical", label: "Physical", icon: Building2 },
  { value: "virtual", label: "Virtual", icon: Video },
  { value: "pre-book-pitch", label: "Pre-book", icon: Briefcase },
];
const TEMPLATES = [
  { id: "tour-confirm", label: "Tour confirmation", body: "Hi! Confirming your tour today. Looking forward to meeting you." },
  { id: "post-tour", label: "Post-tour check-in", body: "Hi! How did you find the property? Happy to answer any questions." },
  { id: "scarcity", label: "Scarcity", body: "Just a heads-up — only a couple of beds left at this price." },
];

type DrawerScheduleAnswers = {
  bookingSource: string;
  decisionMaker: string;
  moveInDate: string;
  budget: string;
  occupation: string;
  workLocation: string;
  roomType: string;
  readyIn48h: boolean;
  exploring: boolean;
  comparing: boolean;
  needsFamily: boolean;
  willBookToday: string;
  keyConcern: string;
  tourType: string;
};

export function LeadControlPanel() {
  const {
    selectedLeadId, selectLead, leads, properties, tours, activities, tcms,
    setLeadStage, setLeadIntent, setLeadFollowUp, addLeadTag, removeLeadTag,
    scheduleTour, cancelTour, rescheduleTour, completeTour, setDecision, updatePostTour,
    addNote, logCall, sendMessage, autoAssignLead, startSequence, closeDeal,
    markHandoffsRead,
  } = useApp();
  const { settings } = useSettings();

  const lead = useMemo(() => leads.find((l) => l.id === selectedLeadId) ?? null, [leads, selectedLeadId]);

  // Mark handoffs read when this lead opens
  useEffect(() => {
    if (selectedLeadId) markHandoffsRead(selectedLeadId);
  }, [selectedLeadId, markHandoffsRead]);

  const leadTours = useMemo(
    () => (lead ? tours.filter((t) => t.leadId === lead.id).sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt)) : []),
    [tours, lead],
  );
  const leadActivities = useMemo(
    () => (lead ? activities.filter((a) => a.leadId === lead.id).slice(0, 30) : []),
    [activities, lead],
  );

  // Tour scheduling form state
  const [propertyId, setPropertyId] = useState("");
  const [tcmId, setTcmId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [isSchedulingAnother, setIsSchedulingAnother] = useState(false);
  const [scheduleAnswers, setScheduleAnswers] = useState({
    bookingSource: "whatsapp",
    decisionMaker: "self",
    moveInDate: "",
    budget: "",
    occupation: "",
    workLocation: "",
    roomType: "Single",
    readyIn48h: false,
    exploring: false,
    comparing: false,
    needsFamily: false,
    willBookToday: "maybe",
    keyConcern: "",
    tourType: "physical",
  });
  const [tab, setTab] = useState("control");
  const [playingCall, setPlayingCall] = useState(false);
  const [callProgress, setCallProgress] = useState(35);
  const [, mounted] = useMountedNow();

  // Note state
  const [note, setNote] = useState("");
  const [customMsg, setCustomMsg] = useState("");

  const pendingPostTour = leadTours.find(
    (t) => t.status === "completed" && !t.postTour.filledAt,
  );
  const upcomingTour = leadTours.find((t) => t.status === "scheduled");

  useEffect(() => {
    if (!lead) return;
    setPropertyId(upcomingTour?.propertyId ?? "");
    setTcmId(upcomingTour?.tcmId ?? lead.assignedTcmId ?? "");
    setScheduledAt(upcomingTour ? toLocal(upcomingTour.scheduledAt) : "");
    setScheduleAnswers((answers) => ({
      ...answers,
      budget: String(lead.budget || ""),
      moveInDate: lead.moveInDate || "",
      workLocation: lead.preferredArea || "",
      keyConcern: lead.tags.join(", "),
    }));
    setIsSchedulingAnother(false);
    setTab(pendingPostTour ? "post" : upcomingTour ? "tour" : settings.matching.drawerDefaultTab);
  }, [lead, pendingPostTour, upcomingTour, settings.matching.drawerDefaultTab]);

  if (!lead) return null;

  const tcm = getTcm(lead.assignedTcmId);

  const handleSchedule = () => {
    if (!propertyId || !tcmId || !scheduledAt) {
      toast.error("Property, TCM and time are required");
      return;
    }
    scheduleTour({ leadId: lead.id, propertyId, tcmId, scheduledAt: new Date(scheduledAt).toISOString() });
    setPropertyId(""); setTcmId(""); setScheduledAt("");
    setIsSchedulingAnother(false);
    toast.success("Tour scheduled");
  };

  const startAnotherTour = () => {
    setPropertyId("");
    setTcmId(lead.assignedTcmId ?? "");
    setScheduledAt("");
    setIsSchedulingAnother(true);
    setTab("tour");
  };

  return (
    <Sheet open={!!selectedLeadId} onOpenChange={(o) => !o && selectLead(null)}>
      <SheetContent side="right" className="w-full sm:max-w-[560px] p-0 flex flex-col">
        {/* Header block */}
        <SheetHeader className="px-5 py-4 border-b border-border space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="font-display text-lg leading-tight">{lead.name}</SheetTitle>
              <SheetDescription className="text-xs">
                {lead.phone} · via {lead.source}
              </SheetDescription>
            </div>
            <button
              onClick={() => selectLead(null)}
              className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StageBadge stage={lead.stage} />
            <IntentChip intent={lead.intent} />
            <ConfidenceBar value={lead.confidence} />
            <ObjectionTag leadId={lead.id} />
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
            <Meta icon={CalendarIcon} label="Move-in" value={format(new Date(lead.moveInDate), "MMM d")} />
            <Meta icon={Wallet} label="Budget" value={`₹${(lead.budget / 1000).toFixed(0)}k`} />
            <Meta icon={MapPin} label="Area" value={lead.preferredArea} />
          </div>
          <div className="text-[11px] text-muted-foreground">Assigned · {tcm?.name ?? "—"} ({tcm?.zone ?? "—"})</div>
        </SheetHeader>

        {/* CRM 10x — commitment banner + 48h post-visit gate */}
        <CommitmentBanner lead={lead} />
        <PostVisitGate lead={lead} />

        {/* Stale alert */}
        {pendingPostTour && (
          <div className="mx-5 mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div className="text-xs">
              <div className="font-semibold text-destructive">Post-tour update missing</div>
              <div className="text-muted-foreground">
                Tour completed {mounted ? formatDistanceToNow(new Date(pendingPostTour.scheduledAt), { addSuffix: true }) : "recently"}.
                TCM must fill the form below.
              </div>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <Tabs value={tab} onValueChange={setTab} className="px-5 py-4">
            <TabsList className="grid h-auto w-full grid-cols-4 gap-1 sm:grid-cols-8">
              <TabsTrigger value="best-fit" className="text-xs">Best Fit</TabsTrigger>
              <TabsTrigger value="dossier" className="text-xs">Dossier</TabsTrigger>
              <TabsTrigger value="control" className="text-xs">Control</TabsTrigger>
              <TabsTrigger value="tour" className="text-xs">Tour</TabsTrigger>
              <TabsTrigger value="post" className="text-xs">
                Post {pendingPostTour && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-destructive" />}
              </TabsTrigger>
              <TabsTrigger value="handoff" className="text-xs">Handoff</TabsTrigger>
              <TabsTrigger value="log" className="text-xs">Log</TabsTrigger>
              <TabsTrigger value="ai-audit" className="text-xs font-bold text-accent">AI Audit</TabsTrigger>
            </TabsList>

            <TabsContent value="dossier" className="space-y-4 pt-4">
              <LeadDossierPanel lead={lead} />
            </TabsContent>

            <TabsContent value="best-fit" className="space-y-4 pt-4">
              <Section title="Best property matches">
                <SupplyMatchPanel lead={lead} onNavigateAway={() => selectLead(null)} />
              </Section>
            </TabsContent>

            {/* CONTROL — status, intent, follow-up, action engine, notes, tags */}
            <TabsContent value="control" className="space-y-4 pt-4">
              <SequenceChip leadId={lead.id} />

              <Section title="Routing">
                <div className="flex gap-2">
                  <Button
                    variant="outline" size="sm" className="flex-1"
                    onClick={() => {
                      const r = autoAssignLead(lead.id);
                      const tcm = tcms.find((t) => t.id === r.tcmId);
                      toast.success(`Auto-routed to ${tcm?.name ?? "TCM"}`, { description: r.reasons.join(" · ") });
                    }}
                  >
                    <Zap className="h-3.5 w-3.5 mr-1.5" /> Auto-route to best TCM
                  </Button>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Currently with <span className="text-foreground font-medium">{tcm?.name ?? "—"}</span> · {tcm?.zone ?? "—"} · {Math.round((tcm?.conversionRate ?? 0) * 100)}% conv
                </div>
              </Section>

              <Section title="Status engine">
                <Select value={lead.stage} onValueChange={(v) => {
                  const prev = lead.stage;
                  setLeadStage(lead.id, v as LeadStage);
                  if (v === "dropped") {
                    toast("Marked dropped", {
                      description: `${lead.name} → dropped`,
                      action: {
                        label: "Undo",
                        onClick: () => { setLeadStage(lead.id, prev); toast.success("Restored"); },
                      },
                      duration: 5000,
                    });
                  }
                }}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["new","contacted","tour-scheduled","tour-done","negotiation","booked","dropped"] as LeadStage[]).map((s) => (
                      <SelectItem key={s} value={s} className="text-sm capitalize">{s.replace("-", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {(["first-contact","post-tour","pre-decision","cold-revival"] as SequenceKind[]).map((k) => (
                    <Button
                      key={k} size="sm" variant="outline" className="h-7 text-[11px]"
                      onClick={() => { startSequence(lead.id, k); toast.success(`Started ${k} sequence`); }}
                    >
                      Start {k}
                    </Button>
                  ))}
                </div>
              </Section>

              <Section title="Action engine">
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => { logCall(lead.id); toast.success("Call logged"); }}>
                    <Phone className="h-3.5 w-3.5 mr-1.5" /> Call
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { sendMessage(lead.id, "WhatsApp template sent"); toast.success("Message sent"); }}>
                    <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> WhatsApp
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Templates</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {TEMPLATES.map((t) => (
                      <Button
                        key={t.id} variant="secondary" size="sm" className="h-7 text-[11px]"
                        onClick={() => { sendMessage(lead.id, t.body); toast.success(`Sent: ${t.label}`); }}
                      >
                        {t.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={customMsg} onChange={(e) => setCustomMsg(e.target.value)}
                    placeholder="Custom message…" className="h-9 text-sm"
                  />
                  <Button
                    size="sm" disabled={!customMsg.trim()}
                    onClick={() => { sendMessage(lead.id, customMsg); setCustomMsg(""); toast.success("Sent"); }}
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Section>

              <Section title="Follow-up engine">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Next follow-up</Label>
                    <Input
                      type="datetime-local"
                      defaultValue={lead.nextFollowUpAt ? toLocal(lead.nextFollowUpAt) : ""}
                      onChange={(e) => {
                        if (!e.target.value) return;
                        setLeadFollowUp(lead.id, new Date(e.target.value).toISOString(), priorityFor(lead.confidence));
                      }}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Priority</Label>
                    <Select
                      value={lead.intent === "hot" ? "high" : lead.intent === "warm" ? "medium" : "low"}
                      onValueChange={(v) => setLeadIntent(lead.id, v === "high" ? "hot" : v === "medium" ? "warm" : "cold")}
                    >
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">Hot</SelectItem>
                        <SelectItem value="medium">Warm</SelectItem>
                        <SelectItem value="low">Cold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {lead.nextFollowUpAt && (
                  <div className="text-[11px] text-muted-foreground">
                    Due {mounted ? formatDistanceToNow(new Date(lead.nextFollowUpAt), { addSuffix: true }) : "soon"}
                  </div>
                )}
              </Section>

              <Section title="Notes & signals">
                <div className="flex flex-wrap gap-1.5">
                  {lead.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px] gap-1">
                      <Tag className="h-2.5 w-2.5" />
                      {t}
                      <button onClick={() => removeLeadTag(lead.id, t)} className="hover:text-destructive">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {TAG_OPTIONS.filter((t) => !lead.tags.includes(t)).map((t) => (
                    <button
                      key={t} onClick={() => addLeadTag(lead.id, t)}
                      className="text-[10px] px-2 py-0.5 rounded-md border border-dashed border-border text-muted-foreground hover:border-accent hover:text-accent transition-colors"
                    >
                      + {t}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Textarea
                    value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder="Add a note…" rows={2} className="text-sm resize-none"
                  />
                  <Button
                    size="sm" disabled={!note.trim()}
                    onClick={() => { addNote(lead.id, note); setNote(""); toast.success("Note added"); }}
                  >
                    Add
                  </Button>
                </div>
              </Section>
            </TabsContent>

            {/* TOUR */}
            <TabsContent value="tour" className="space-y-4 pt-4">
              {leadTours.length > 0 && (
                <Button variant="secondary" size="sm" className="w-full gap-1.5" onClick={startAnotherTour}>
                  <Plus className="h-3.5 w-3.5" /> Schedule another Tour for this lead
                </Button>
              )}
              {upcomingTour ? (
                <Section title="Upcoming tour">
                  <UpcomingTourCard
                    tour={upcomingTour}
                    scheduledAt={scheduledAt}
                    onScheduledAtChange={setScheduledAt}
                    onReschedule={() => {
                      if (!scheduledAt) {
                        toast.error("Choose a date and time to reschedule");
                        return;
                      }
                      rescheduleTour(upcomingTour.id, new Date(scheduledAt).toISOString());
                      toast.success("Tour rescheduled");
                    }}
                    onCancel={() => {
                      const prevAt = upcomingTour.scheduledAt;
                      const tourId = upcomingTour.id;
                      cancelTour(tourId);
                      toast("Tour cancelled", {
                        description: `${lead.name} · ${format(new Date(prevAt), "MMM d, p")}`,
                        action: {
                          label: "Undo",
                          onClick: () => {
                            // restore by rescheduling — store doesn't track 'cancelled' undo cleanly
                            useApp.getState().rescheduleTour(tourId, prevAt);
                            useApp.setState((s) => ({
                              tours: s.tours.map((x) => x.id === tourId ? { ...x, status: "scheduled" } : x),
                            }));
                            toast.success("Tour restored");
                          },
                        },
                        duration: 5000,
                      });
                    }}
                     onComplete={() => {
                       completeTour(upcomingTour.id);
                       setTab("post");
                       toast.success("Tour completed — fill the post-tour form");
                     }}
                  />
                </Section>
              ) : null}

              {(!upcomingTour || isSchedulingAnother) ? (
                <InlineScheduleTour
                  lead={lead}
                  properties={properties}
                  tcms={tcms}
                  propertyId={propertyId}
                  tcmId={tcmId}
                  scheduledAt={scheduledAt}
                  answers={scheduleAnswers}
                  onAnswersChange={(patch: Partial<DrawerScheduleAnswers>) => setScheduleAnswers((answers) => ({ ...answers, ...patch }))}
                  onPropertyChange={setPropertyId}
                  onTcmChange={setTcmId}
                  onScheduledAtChange={setScheduledAt}
                  onSchedule={handleSchedule}
                />
              ) : null}

              {leadTours.length > 1 && (
                <Section title="Tour history">
                  <div className="space-y-2">
                    {leadTours.slice(upcomingTour ? 1 : 0).map((t) => {
                      const prop = getProperty(t.propertyId, properties);
                      return (
                        <div key={t.id} className="rounded-lg border border-border bg-card p-3 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{prop?.name}</span>
                            <span className="text-muted-foreground">{format(new Date(t.scheduledAt), "MMM d, p")}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px]">
                            <Badge variant="outline" className="capitalize">{t.status}</Badge>
                            {t.decision && <Badge variant="outline" className="capitalize">{t.decision}</Badge>}
                            {t.postTour.filledAt ? (
                              <span className="text-success inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Form complete</span>
                            ) : t.status === "completed" ? (
                              <span className="text-destructive inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Form pending</span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Section>
              )}
            </TabsContent>

            {/* POST-TOUR */}
            <TabsContent value="post" className="space-y-4 pt-4">
              {(() => {
                const target = pendingPostTour ?? leadTours.find((t) => t.status === "completed");
                if (!target) {
                  return (
                    <div className="text-sm text-muted-foreground text-center py-8">
                      No completed tours yet. The post-tour form appears here once a tour is marked complete.
                    </div>
                  );
                }
                const prop = getProperty(target.propertyId, properties);
                const pt = target.postTour;
                return (
                  <div className="space-y-4">
                    <div className="text-xs text-muted-foreground">
                      Tour at <span className="text-foreground font-medium">{prop?.name}</span> · {format(new Date(target.scheduledAt), "MMM d, p")}
                    </div>

                    {/* Send updates / reminders — one row, always visible post-tour */}
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        size="sm" variant="outline" className="h-8 text-xs gap-1.5"
                        disabled={!prop}
                        onClick={() => {
                          if (!prop) return;
                          sendOwnerTourMessage('post_visit_thanks', {
                            tourId: target.id, leadName: lead.name, phone: lead.phone,
                            propertyName: prop.name, area: prop.area,
                            tourDate: target.scheduledAt.slice(0, 10),
                            tourTime: target.scheduledAt.slice(11, 16),
                            tcmName: tcms.find((t) => t.id === target.tcmId)?.name,
                          });
                          toast.success('Thank-you message opened');
                        }}
                      >
                        <ExternalLink className="h-3 w-3" /> Thank-you msg
                      </Button>
                      <Button
                        size="sm" variant="outline" className="h-8 text-xs gap-1.5"
                        onClick={() => {
                          sendMessage(lead.id, 'Quick update — any thoughts on the property?');
                          toast.success('Update sent');
                        }}
                      >
                        <Send className="h-3 w-3" /> Send update
                      </Button>
                      <Button
                        size="sm" variant="outline" className="h-8 text-xs gap-1.5"
                        onClick={() => {
                          const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
                          setLeadFollowUp(lead.id, dueAt, priorityFor(pt.confidence), 'Post-tour reminder');
                          toast.success('Reminder set for tomorrow');
                        }}
                      >
                        <BellRing className="h-3 w-3" /> Set reminder
                      </Button>
                    </div>

                    <Section title="Outcome (mandatory · explicit)">
                      <div className="text-[11px] text-muted-foreground mb-1.5">
                        Choose carefully — the lead's stage <em>and</em> closure status update only when you click here.
                        Nothing is auto-assigned by the system.
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { o: "booked", label: "Booked ✓", tone: "default" as const, decision: "booked" as const },
                          { o: "thinking", label: "Still deciding", tone: "outline" as const, decision: "thinking" as const },
                          { o: "not-interested", label: "Not interested", tone: "outline" as const, decision: "dropped" as const },
                          { o: null, label: "Awaiting outcome (no change)", tone: "ghost" as const, decision: null },
                        ] as const).map((opt) => (
                          <Button
                            key={opt.label}
                            variant={pt.outcome === opt.o ? "default" : opt.tone}
                            size="sm" className="capitalize"
                            onClick={() => {
                              if (!confirm(`Confirm outcome: ${opt.label}? This updates the lead stage.`)) return;
                              updatePostTour(target.id, { outcome: opt.o });
                              if (opt.decision) setDecision(target.id, opt.decision);
                              toast.success(`Outcome set: ${opt.label}`);
                            }}
                          >
                            {opt.label}
                          </Button>
                        ))}
                      </div>
                    </Section>

                    <Section title={`Deal confidence — ${pt.confidence}%`}>
                      <input
                        type="range" min={0} max={100} value={pt.confidence}
                        onChange={(e) => updatePostTour(target.id, { confidence: +e.target.value })}
                        className="w-full accent-[var(--color-accent)]"
                      />
                    </Section>

                    <Section title="Key objection">
                      <Select
                        value={pt.objection ?? ""}
                        onValueChange={(v) => updatePostTour(target.id, { objection: v })}
                      >
                        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select objection" /></SelectTrigger>
                        <SelectContent>
                          {OBJECTIONS.map((o) => <SelectItem key={o} value={o} className="text-sm">{o}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Textarea
                        rows={2} placeholder="Note…" value={pt.objectionNote}
                        onChange={(e) => updatePostTour(target.id, { objectionNote: e.target.value })}
                        className="text-sm resize-none mt-2"
                      />
                      
                      {pt.objection && (
                        <div className="mt-3 rounded-lg border border-accent/20 bg-accent/5 p-3 text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-accent flex items-center gap-1">
                              💬 Objection Talk script Battle-Card
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const script = getObjectionScript(pt.objection || "");
                                navigator.clipboard.writeText(script);
                                toast.success("Talk script copied!");
                              }}
                              className="inline-flex items-center gap-1 rounded bg-accent/15 px-2 py-1 text-[10px] font-medium text-accent hover:bg-accent/25"
                            >
                              <Copy className="h-3 w-3" /> Copy script
                            </button>
                          </div>
                          <p className="text-muted-foreground leading-relaxed italic bg-background/50 p-2 rounded border border-border/40 text-[11px]">
                            "{getObjectionScript(pt.objection)}"
                          </p>
                          <div className="text-[10px] text-accent/80 font-medium">
                            💡 Tip: Reassure the lead with actual cost offsets (food, bills) or security features.
                          </div>
                        </div>
                      )}
                    </Section>

                    <div className="grid grid-cols-2 gap-3">
                      <Section title="Expected decision">
                        <Input
                          type="date"
                          value={pt.expectedDecisionAt ? pt.expectedDecisionAt.slice(0, 10) : ""}
                          onChange={(e) => updatePostTour(target.id, { expectedDecisionAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                          className="h-9 text-sm"
                        />
                      </Section>
                      <Section title="Next follow-up">
                        <Input
                          type="datetime-local"
                          value={pt.nextFollowUpAt ? toLocal(pt.nextFollowUpAt) : ""}
                          onChange={(e) => updatePostTour(target.id, { nextFollowUpAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                          className="h-9 text-sm"
                        />
                      </Section>
                    </div>

                    {pt.filledAt ? (
                      <div className="rounded-lg border border-success/30 bg-success/5 p-3 flex items-center gap-2 text-xs">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        <span>Form complete · saved {mounted ? formatDistanceToNow(new Date(pt.filledAt), { addSuffix: true }) : "recently"}</span>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 flex items-center gap-2 text-xs">
                        <ClipboardCheck className="h-4 w-4" />
                        <span>Fill all four fields to mark this lead complete and silence the alert.</span>
                      </div>
                    )}

                    {/* Close deal — one click, blocks the bed, fires the booking */}
                    {lead.stage !== "booked" && (
                      <Button
                        size="lg" className="w-full bg-success text-success-foreground hover:bg-success/90"
                        onClick={() => {
                          closeDeal({
                            leadId: lead.id,
                            tourId: target.id,
                            propertyId: target.propertyId,
                            tcmId: target.tcmId,
                            amount: prop?.pricePerBed ?? 12000,
                          });
                          toast.success(`Deal closed · ${lead.name} → ${prop?.name}`, {
                            description: `Bed blocked, MRR +₹${((prop?.pricePerBed ?? 12000) / 1000).toFixed(0)}k`,
                          });
                        }}
                      >
                        <IndianRupee className="h-4 w-4 mr-1.5" /> Close deal · ₹{((prop?.pricePerBed ?? 12000) / 1000).toFixed(0)}k/mo
                      </Button>
                    )}
                    {lead.stage === "booked" && (
                      <div className="rounded-lg border border-success/40 bg-success/10 p-3 flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-5 w-5 text-success" />
                        <span className="font-semibold text-success">Booked.</span>
                        <span className="text-muted-foreground">Bed blocked, lead closed.</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </TabsContent>

            {/* HANDOFF — FlowOps ↔ TCM thread for this lead */}
            <TabsContent value="handoff" className="pt-4">
              <Section title="FlowOps ↔ TCM thread">
                <HandoffThread leadId={lead.id} />
              </Section>
            </TabsContent>

            {/* ACTIVITY LOG */}
            <TabsContent value="log" className="pt-4">
              <Section title="Activity log (auto)">
                <div className="space-y-2">
                  {leadActivities.length === 0 && (
                    <div className="text-xs text-muted-foreground">No activity yet.</div>
                  )}
                  {leadActivities.map((a) => (
                    <div key={a.id} className="flex gap-2 text-xs border-l-2 border-border pl-3 py-1">
                      <ActivityIcon className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="flex-1">
                        <div className="text-foreground">{a.text}</div>
                        <div className="text-muted-foreground text-[10px] mt-0.5">
                          {format(new Date(a.ts), "MMM d, p")} · {a.actor === "system" ? "system" : tcms.find((t) => t.id === a.actor)?.name ?? a.actor}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            </TabsContent>

            {/* AI CALL AUDITOR */}
            <TabsContent value="ai-audit" className="space-y-4 pt-4">
              <Section title="AI Call Quality Auditor">
                <div className="rounded-lg border bg-card p-4 space-y-4">
                  {/* Waveform Player */}
                  <div className="bg-muted/40 p-3 rounded-lg border border-border space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-accent flex items-center gap-1">
                        🔊 Call Recording: AUD_9082.mp3
                      </span>
                      <span className="font-mono text-muted-foreground">01:42 / 03:15</span>
                    </div>
                    {/* Simulated Waveform */}
                    <div className="h-10 flex items-end gap-1 px-2 pt-2">
                      {[12, 18, 14, 25, 30, 42, 18, 12, 15, 28, 35, 48, 22, 14, 18, 32, 45, 12, 16, 20, 38, 42, 28, 14, 22, 35, 18, 12, 25, 38, 42, 14, 18, 28, 12, 24, 32, 18, 14, 22, 45, 38, 25, 12].map((h, i) => (
                        <div
                          key={i}
                          className={cn(
                            "flex-1 rounded-t transition-all duration-300",
                            i < 20 ? "bg-accent" : "bg-muted-foreground/35"
                          )}
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                    {/* Player controls */}
                    <div className="flex items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => setPlayingCall(!playingCall)}
                        className="rounded-full bg-accent text-accent-foreground p-1.5 hover:opacity-90"
                      >
                        {playingCall ? (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" /></svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>
                        )}
                      </button>
                      <input
                        type="range" min={0} max={100} value={callProgress}
                        onChange={(e) => setCallProgress(+e.target.value)}
                        className="flex-1 accent-accent"
                      />
                    </div>
                  </div>

                  {/* Sentiment and Compliance Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Compliance Scorecard */}
                    <div className="p-3 border rounded-lg bg-card/60 space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Script Compliance (Score: 88%)
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-emerald-400 font-bold">✓</span>
                          <span>Welcome &amp; Identity Verify</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-emerald-400 font-bold">✓</span>
                          <span>Preferred Location Confirm</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-emerald-400 font-bold">✓</span>
                          <span>Budget Limit Check</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-amber-400 font-bold">⚠</span>
                          <span className="text-muted-foreground">Commute Optimizer Pitched</span>
                        </div>
                      </div>
                    </div>

                    {/* Sentiment Analysis */}
                    <div className="p-3 border rounded-lg bg-card/60 space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Sentiment Scan
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span>Overall Sentiment:</span>
                          <span className="text-emerald-400 font-semibold">Positive</span>
                        </div>
                        <div className="w-full bg-muted h-2 rounded-full overflow-hidden flex">
                          <div className="bg-rose-500 h-full" style={{ width: "10%" }} />
                          <div className="bg-amber-500 h-full" style={{ width: "30%" }} />
                          <div className="bg-emerald-500 h-full" style={{ width: "60%" }} />
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                          <span>Negative: 10%</span>
                          <span>Positive: 60%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dialogue transcript */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Audited Transcription
                    </div>
                    <div className="border rounded-md bg-muted/20 p-3 h-48 overflow-y-auto space-y-3 text-xs scrollbar-thin">
                      <div>
                        <span className="font-semibold text-accent">{tcm?.name || "Agent"}: </span>
                        <span className="text-foreground/80">"Hello {lead.name}! I saw you were looking for a PG in {lead.preferredArea || "Bangalore"}. Is that right?"</span>
                      </div>
                      <div>
                        <span className="font-semibold text-info">{lead.name}: </span>
                        <span className="text-foreground/80">"Yes, correct. I am moving soon, looking for something under ₹{(lead.budget || 15000).toLocaleString()}/month."</span>
                      </div>
                      <div className="bg-emerald-500/5 p-1.5 rounded border border-emerald-500/20">
                        <span className="font-semibold text-accent">{tcm?.name || "Agent"}: </span>
                        <span className="text-foreground/80">"Great, we have excellent options in {lead.preferredArea} matching your budget. Do your parents have any specific security preferences?"</span>
                        <div className="text-[9px] text-emerald-400 font-bold mt-1 uppercase tracking-wider">★ AI Highlight: Proactive Safety Pitch</div>
                      </div>
                      <div>
                        <span className="font-semibold text-info">{lead.name}: </span>
                        <span className="text-foreground/80">"Yes, security and good food are very important. Is biometric access provided?"</span>
                      </div>
                      <div>
                        <span className="font-semibold text-accent">{tcm?.name || "Agent"}: </span>
                        <span className="text-foreground/80">"Absolutely. All our verified properties come with 24/7 CCTV, biometric gates, and in-house freshly prepared meals."</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Section>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{title}</div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Meta({ icon: Icon, label, value }: { icon: typeof CalendarIcon; label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/60 px-2 py-1.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-2.5 w-2.5" /> {label}
      </div>
      <div className="text-xs font-medium text-foreground mt-0.5">{value}</div>
    </div>
  );
}

function UpcomingTourCard({
  tour, scheduledAt, onScheduledAtChange, onReschedule, onCancel, onComplete,
}: {
  tour: import("@/lib/types").Tour;
  scheduledAt: string;
  onScheduledAtChange: (value: string) => void;
  onReschedule: () => void;
  onCancel: () => void;
  onComplete: () => void;
}) {
  const { properties, tcms } = useApp();
  const prop = properties.find((p) => p.id === tour.propertyId);
  const tcm = tcms.find((t) => t.id === tour.tcmId);
  return (
    <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-display font-semibold text-sm">{prop?.name}</div>
        <Badge className="bg-accent text-accent-foreground capitalize">{tour.status}</Badge>
      </div>
      <div className="text-xs text-muted-foreground">
        {format(new Date(tour.scheduledAt), "EEE, MMM d · p")} · {tcm?.name}
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => onScheduledAtChange(e.target.value)}
          className="h-8 text-xs"
        />
        <Button size="sm" variant="outline" onClick={onReschedule}>Reschedule</Button>
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button size="sm" className="flex-1" onClick={onComplete}>Mark complete</Button>
      </div>
    </div>
  );
}

function InlineScheduleTour({
  lead, properties, tcms, propertyId, tcmId, scheduledAt, answers, onAnswersChange,
  onPropertyChange, onTcmChange, onScheduledAtChange, onSchedule,
}: {
  lead: Lead;
  properties: import("@/lib/types").Property[];
  tcms: import("@/lib/types").TCM[];
  propertyId: string;
  tcmId: string;
  scheduledAt: string;
  answers: DrawerScheduleAnswers;
  onAnswersChange: (patch: Partial<DrawerScheduleAnswers>) => void;
  onPropertyChange: (value: string) => void;
  onTcmChange: (value: string) => void;
  onScheduledAtChange: (value: string) => void;
  onSchedule: () => void;
}) {
  return (
    <Section title="Schedule Tour in drawer">
      <div className="rounded-lg border border-border bg-card p-3 space-y-3">
        <div className="text-xs text-muted-foreground">Lead is already known: <span className="font-medium text-foreground">{lead.name}</span>. Add any property Tour without re-entering phone or QuickAD answers.</div>
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div className="rounded-md bg-muted/60 px-2 py-1.5"><span className="block text-muted-foreground">Phone</span><span className="font-medium text-foreground">{lead.phone}</span></div>
          <div className="rounded-md bg-muted/60 px-2 py-1.5"><span className="block text-muted-foreground">Budget</span><span className="font-medium text-foreground">₹{(lead.budget / 1000).toFixed(0)}k</span></div>
          <div className="rounded-md bg-muted/60 px-2 py-1.5"><span className="block text-muted-foreground">Area</span><span className="font-medium text-foreground">{lead.preferredArea}</span></div>
        </div>
        <div className="rounded-md border border-border bg-background/60 p-2 space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">MYT Schedule questions</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Source"><Select value={answers.bookingSource} onValueChange={(v) => onAnswersChange({ bookingSource: v })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{BOOKING_SOURCES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Decision maker"><Select value={answers.decisionMaker} onValueChange={(v) => onAnswersChange({ decisionMaker: v })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{DECISION_MAKERS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Move-in"><Input type="date" value={answers.moveInDate} onChange={(e) => onAnswersChange({ moveInDate: e.target.value })} className="h-8 text-xs" /></Field>
            <Field label="Budget"><Input type="number" value={answers.budget} onChange={(e) => onAnswersChange({ budget: e.target.value })} className="h-8 text-xs" /></Field>
            <Field label="Work / College"><Input value={answers.occupation} onChange={(e) => onAnswersChange({ occupation: e.target.value })} className="h-8 text-xs" /></Field>
            <Field label="Work location"><Input value={answers.workLocation} onChange={(e) => onAnswersChange({ workLocation: e.target.value })} className="h-8 text-xs" /></Field>
          </div>
          <Field label="Room type"><Select value={answers.roomType} onValueChange={(v) => onAnswersChange({ roomType: v })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{ROOM_TYPES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></Field>
          <div className="grid gap-1.5">
            {([
              ["readyIn48h", "Ready to finalize within 48 hours"],
              ["exploring", "Only exploring"],
              ["comparing", "Comparing options"],
              ["needsFamily", "Needs family approval"],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 rounded-md border border-border bg-surface-2/40 px-2 py-1.5 text-xs">
                <Checkbox checked={answers[key]} onCheckedChange={(v) => onAnswersChange({ [key]: v === true })} />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <Field label="Will book today"><Select value={answers.willBookToday} onValueChange={(v) => onAnswersChange({ willBookToday: v })}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{["yes", "maybe", "no"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Key concern"><Input value={answers.keyConcern} onChange={(e) => onAnswersChange({ keyConcern: e.target.value })} className="h-8 text-xs" /></Field>
        </div>
        <div>
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Tour Type</Label>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {TOUR_TYPES.map(({ value, label, icon: Icon }) => (
              <button key={value} type="button" onClick={() => onAnswersChange({ tourType: value })} className={`h-12 rounded-md border text-xs flex flex-col items-center justify-center gap-1 ${answers.tourType === value ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface-2 text-muted-foreground"}`}>
                <Icon className="h-3.5 w-3.5" />{label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Property</Label>
            <Select value={propertyId} onValueChange={onPropertyChange}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select property" /></SelectTrigger>
              <SelectContent>{properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {p.area}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">TCM</Label>
            <Select value={tcmId} onValueChange={onTcmChange}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select TCM" /></SelectTrigger>
              <SelectContent>{tcms.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} · {t.zone}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Input type="datetime-local" value={scheduledAt} onChange={(e) => onScheduledAtChange(e.target.value)} className="h-9 text-sm" />
          <Button size="sm" onClick={onSchedule} className="gap-1.5"><CalendarIcon className="h-3.5 w-3.5" /> Schedule Tour</Button>
        </div>
      </div>
    </Section>
  );
}

function toLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function priorityFor(c: number): FollowUpPriority {
  return c >= 75 ? "high" : c >= 50 ? "medium" : "low";
}

function getObjectionScript(objection: string): string {
  switch (objection) {
    case "Budget":
      return "I understand budget is a key decision factor. Let's break it down: our rent includes 3 meals/day, daily professional cleaning, high-speed Wi-Fi, and power backup. In a standard flat, these bills stack up to ₹6,000+ extra. Here, you pay one clear, predictable amount with zero hidden charges.";
    case "Location":
      return "I hear you on the location. If you check our Commute Optimizer, travel time is under 15-20 mins via 2-wheeler. This specific PG keeps you close enough to the tech parks for a short commute, but far enough from the main road dust and vehicle noise for a quiet, peaceful sleep.";
    case "Amenities":
      return "You're getting fully-furnished spaces, premium mattresses, washing machines, and refrigerators. Plus, there is high-speed Wi-Fi, power backup, and a shared lounge. Renting or buying these appliances separately would cost you ₹3,000/mo plus heavy logistics. It's ready-to-move-in.";
    case "Timing":
      return "I understand you need time. However, this is high-demand peak season and we have only 1-2 beds left in this category. We can take a small refundable token deposit (₹2,000) to lock this room at the current tariff, and you can take 7-10 days to finalize your move.";
    case "Parents":
      return "We prioritize safety above all: we have 24/7 CCTV monitoring, biometric access gates, on-site wardens, and emergency assistance. I'd be glad to arrange a direct WhatsApp video call with your parents to show them the security layout live and answer any concerns.";
    case "Comparing options":
      return "It's good to look around. When comparing, check if others have SLA-backed maintenance (we resolve requests in 6 hours), if there are broker fees (we have 0 brokerage), and if food is cooked fresh in-house. We provide a fully transparent tenancy contract with no surprises.";
    default:
      return "I want to make sure you have the best experience. Let me speak to our Area Operations Manager. We can look at adjusting the lock-in period or customization of the room set-up to make this stay absolutely comfortable for you. What would make this a yes?";
  }
}
