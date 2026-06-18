import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Zap, FileText, Home, UserSearch } from "lucide-react";
import { useOwnerBookings } from "@/lib/owner-bookings/store";
import { useApp } from "@/lib/store";
import { useQuotations } from "@/lib/crm10x/quotations";
import { PGS } from "@/property-genius/data/pgs";
import type {
  Gender, Occupation, SharingType, RoomCategory,
} from "@/lib/owner-bookings/types";
import {
  emptyDraft, applyLead, applyProperty, applyQuotation, draftToCreateInput,
  SOURCE_LABEL, SOURCE_TONE, type BookingDraft, type SyncSource,
} from "@/lib/owner-bookings/sync";
import { useTaskTimer } from "@/lib/tti/use-task-timer";

const SUGGESTED = [
  "Lower floor", "Quiet room", "Near window", "Early check-in",
  "Extra mattress", "AC room", "Attached washroom", "Veg-only floor",
];

interface Props {
  trigger?: React.ReactNode;
  ownerId?: string;
  propertyId?: string;
  propertyName?: string;
  leadId?: string;
}

export function CreateBookingDialog({ trigger, leadId: initialLeadId, propertyId: initialPropertyId }: Props) {
  const { createBooking } = useOwnerBookings();
  const leads = useApp((s) => s.leads);
  const quotations = useQuotations((s) => s.quotations);
  const [open, setOpen] = useState(false);
  const timer = useTaskTimer("booking.create", "Create owner booking");

  // sync source selections
  const [leadId, setLeadId] = useState<string>(initialLeadId ?? "");
  const [pgId, setPgId] = useState<string>(initialPropertyId ?? "");
  const [quotationId, setQuotationId] = useState<string>("");

  const [draft, setDraft] = useState<BookingDraft>(() => emptyDraft());
  const [reqDraft, setReqDraft] = useState("");

  const leadQuotations = useMemo(
    () => (leadId ? quotations.filter((q) => q.leadId === leadId) : quotations.slice(0, 30)),
    [leadId, quotations],
  );

  function runSync(opts: { l?: string; p?: string; q?: string } = {}) {
    const lId = opts.l ?? leadId;
    const pId = opts.p ?? pgId;
    const qId = opts.q ?? quotationId;
    let d = emptyDraft();
    if (lId) d = applyLead(d, leads.find((l) => l.id === lId));
    if (pId) d = applyProperty(d, PGS.find((p) => p.id === pId));
    if (qId) d = applyQuotation(d, quotations.find((q) => q.id === qId));
    setDraft(d);
  }

  function selectLead(v: string) {
    const id = v === "__none" ? "" : v;
    setLeadId(id);
    // auto-pick newest paid quotation for this lead if available
    const paid = id ? quotations.find((q) => q.leadId === id && q.status === "paid") : undefined;
    if (paid) setQuotationId(paid.id);
    if (paid?.propertyId) setPgId(paid.propertyId);
    runSync({ l: id, q: paid?.id ?? quotationId, p: paid?.propertyId ?? pgId });
  }

  function selectPg(v: string) {
    const id = v === "__none" ? "" : v;
    setPgId(id);
    runSync({ p: id });
  }

  function selectQuotation(v: string) {
    const id = v === "__none" ? "" : v;
    setQuotationId(id);
    const q = quotations.find((qq) => qq.id === id);
    if (q?.propertyId && !pgId) setPgId(q.propertyId);
    runSync({ q: id, p: q?.propertyId ?? pgId });
  }

  function patch<K extends keyof BookingDraft>(key: K, value: BookingDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value, source: { ...d.source, [key]: "manual" } }));
  }
  function patchCustomer<K extends keyof BookingDraft["customer"]>(key: K, value: BookingDraft["customer"][K]) {
    setDraft((d) => ({
      ...d, customer: { ...d.customer, [key]: value },
      source: { ...d.source, [`customer.${String(key)}`]: "manual" },
    }));
  }
  function patchInventory<K extends keyof BookingDraft["inventory"]>(key: K, value: BookingDraft["inventory"][K]) {
    setDraft((d) => ({
      ...d, inventory: { ...d.inventory, [key]: value },
      source: { ...d.source, [`inventory.${String(key)}`]: "manual" },
    }));
  }
  function patchMoveIn<K extends keyof BookingDraft["moveIn"]>(key: K, value: BookingDraft["moveIn"][K]) {
    setDraft((d) => ({
      ...d, moveIn: { ...d.moveIn, [key]: value },
      source: { ...d.source, [`moveIn.${String(key)}`]: "manual" },
    }));
  }

  function addReq(text: string) {
    const t = text.trim();
    if (t && !draft.specialRequests.includes(t)) {
      setDraft((d) => ({ ...d, specialRequests: [...d.specialRequests, t] }));
    }
    setReqDraft("");
  }

  function submit() {
    if (!draft.customer.name.trim() || !draft.customer.phone.trim()
      || !draft.inventory.propertyName.trim() || !draft.inventory.roomNumber.trim()) return;
    createBooking(draftToCreateInput(draft, { leadId: leadId || undefined }));
    timer.complete({ leadId: leadId || null, propertyId: pgId || null });
    setOpen(false);
    // reset
    setLeadId(""); setPgId(""); setQuotationId("");
    setDraft(emptyDraft());
  }

  // counts for the sync banner
  const synced = useMemo(() => {
    const s = draft.source;
    return {
      lead: Object.values(s).filter((v) => v === "lead").length,
      property: Object.values(s).filter((v) => v === "property").length,
      quotation: Object.values(s).filter((v) => v === "quotation").length,
    };
  }, [draft.source]);

  const isValid = !!draft.customer.name.trim() && !!draft.customer.phone.trim()
    && !!draft.inventory.propertyName.trim() && !!draft.inventory.roomNumber.trim();

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { runSync(); timer.start(); } else { timer.abandon(); } }}>
      <DialogTrigger asChild>
        {trigger ?? <Button size="sm"><Plus className="h-4 w-4 mr-1" />New Owner Booking</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" /> Create Owner Booking — Smart Sync
          </DialogTitle>
        </DialogHeader>

        {/* Smart Sync Bar */}
        <Card className="p-3 bg-gradient-to-br from-primary/5 to-transparent border-primary/30">
          <div className="grid gap-2 md:grid-cols-3">
            <SourcePicker icon={<UserSearch className="h-3.5 w-3.5" />} label="Lead" value={leadId} onChange={selectLead}>
              <SelectItem value="__none">— none —</SelectItem>
              {leads.slice(0, 60).map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name} · {l.phone} · {l.preferredArea}
                </SelectItem>
              ))}
            </SourcePicker>
            <SourcePicker icon={<Home className="h-3.5 w-3.5" />} label="Property" value={pgId} onChange={selectPg}>
              <SelectItem value="__none">— none —</SelectItem>
              {PGS.slice(0, 60).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.actualName || p.name} · {p.area}
                </SelectItem>
              ))}
            </SourcePicker>
            <SourcePicker icon={<FileText className="h-3.5 w-3.5" />} label="Quotation" value={quotationId} onChange={selectQuotation}>
              <SelectItem value="__none">— none —</SelectItem>
              {leadQuotations.map((q) => (
                <SelectItem key={q.id} value={q.id}>
                  {q.propertyName} · ₹{q.discountedPrice.toLocaleString("en-IN")} · {q.status}
                </SelectItem>
              ))}
            </SourcePicker>
          </div>
          <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
            <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
              {synced.lead > 0 && <Badge className={SOURCE_TONE.lead}>{synced.lead} from Lead</Badge>}
              {synced.property > 0 && <Badge className={SOURCE_TONE.property}>{synced.property} from Property</Badge>}
              {synced.quotation > 0 && <Badge className={SOURCE_TONE.quotation}>{synced.quotation} from Quotation</Badge>}
              {synced.lead + synced.property + synced.quotation === 0 && (
                <span className="text-muted-foreground">Pick a source above to auto-fill — anything missing, just type it in.</span>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={() => runSync()}>
              <Zap className="h-3.5 w-3.5 mr-1" /> Resync
            </Button>
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 mt-2">
          <Card className="p-3 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">Customer</div>
            <Field label="Name" src={draft.source["customer.name"]}>
              <Input value={draft.customer.name} onChange={(e) => patchCustomer("name", e.target.value)} />
            </Field>
            <Field label="Phone" src={draft.source["customer.phone"]}>
              <Input value={draft.customer.phone} onChange={(e) => patchCustomer("phone", e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Gender">
                <Select value={draft.customer.gender} onValueChange={(v) => patchCustomer("gender", v as Gender)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Occupation">
                <Select value={draft.customer.occupation} onValueChange={(v) => patchCustomer("occupation", v as Occupation)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="working">Working Pro</SelectItem>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Company / College">
              <Input value={draft.customer.companyOrCollege} onChange={(e) => patchCustomer("companyOrCollege", e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Emergency Name">
                <Input value={draft.customer.emergencyName} onChange={(e) => patchCustomer("emergencyName", e.target.value)} />
              </Field>
              <Field label="Emergency Phone">
                <Input value={draft.customer.emergencyPhone} onChange={(e) => patchCustomer("emergencyPhone", e.target.value)} />
              </Field>
            </div>
          </Card>

          <Card className="p-3 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">Room & Property</div>
            <Field label="Property" src={draft.source["inventory.propertyName"]}>
              <Input value={draft.inventory.propertyName} onChange={(e) => patchInventory("propertyName", e.target.value)} />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Floor"><Input value={draft.inventory.floor} onChange={(e) => patchInventory("floor", e.target.value)} /></Field>
              <Field label="Room #" src={draft.source["inventory.roomNumber"]}>
                <Input value={draft.inventory.roomNumber} onChange={(e) => patchInventory("roomNumber", e.target.value)} />
              </Field>
              <Field label="Bed"><Input value={draft.inventory.bedNumber} onChange={(e) => patchInventory("bedNumber", e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Sharing">
                <Select value={draft.inventory.sharing} onValueChange={(v) => patchInventory("sharing", v as SharingType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="double">Double</SelectItem>
                    <SelectItem value="triple">Triple</SelectItem>
                    <SelectItem value="quad">Quad</SelectItem>
                    <SelectItem value="studio">Studio</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Category">
                <Select value={draft.inventory.category} onValueChange={(v) => patchInventory("category", v as RoomCategory)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ac">AC</SelectItem>
                    <SelectItem value="non-ac">Non-AC</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Owner ID" src={draft.source["ownerId"]}>
              <Input value={draft.ownerId} onChange={(e) => patch("ownerId", e.target.value)} placeholder="GP-OWN-XXXX" />
            </Field>
          </Card>

          <Card className="p-3 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">Financials (₹)</div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Monthly Rent" src={draft.source["rent"]}>
                <Input type="number" value={draft.rent} onChange={(e) => patch("rent", +e.target.value)} />
              </Field>
              <Field label="Security Deposit" src={draft.source["deposit"]}>
                <Input type="number" value={draft.deposit} onChange={(e) => patch("deposit", +e.target.value)} />
              </Field>
              <Field label="Booking Amount Received" src={draft.source["bookingAmt"]}>
                <Input type="number" value={draft.bookingAmt} onChange={(e) => patch("bookingAmt", +e.target.value)} />
              </Field>
              <Field label="Other Charges">
                <Input type="number" value={draft.otherCharges} onChange={(e) => patch("otherCharges", +e.target.value)} />
              </Field>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Expected total: ₹{(draft.rent + draft.deposit + draft.bookingAmt + draft.otherCharges).toLocaleString("en-IN")}
              {" · "}Received: ₹{draft.bookingAmt.toLocaleString("en-IN")}
            </div>
          </Card>

          <Card className="p-3 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">Move-In</div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Move-In Date" src={draft.source["moveIn.date"]}>
                <Input type="date" value={draft.moveIn.date} onChange={(e) => patchMoveIn("date", e.target.value)} />
              </Field>
              <Field label="Time"><Input type="time" value={draft.moveIn.time} onChange={(e) => patchMoveIn("time", e.target.value)} /></Field>
              <Field label="Stay (months)"><Input type="number" value={draft.moveIn.stayMonths} onChange={(e) => patchMoveIn("stayMonths", +e.target.value)} /></Field>
              <Field label="Lock-In (months)" src={draft.source["moveIn.lockInMonths"]}>
                <Input type="number" value={draft.moveIn.lockInMonths} onChange={(e) => patchMoveIn("lockInMonths", +e.target.value)} />
              </Field>
              <Field label="Notice (days)" src={draft.source["moveIn.noticeDays"]}>
                <Input type="number" value={draft.moveIn.noticeDays} onChange={(e) => patchMoveIn("noticeDays", +e.target.value)} />
              </Field>
            </div>
          </Card>

          <Card className="p-3 space-y-2 md:col-span-2">
            <div className="text-xs font-semibold text-muted-foreground">Customer Expectations</div>
            <div className="flex flex-wrap gap-1">
              {SUGGESTED.map((s) => (
                <button key={s} type="button" onClick={() => addReq(s)}
                  className="text-[11px] rounded-full border border-border bg-card px-2 py-0.5 hover:border-primary">
                  + {s}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={reqDraft} onChange={(e) => setReqDraft(e.target.value)}
                placeholder="Add custom expectation…"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addReq(reqDraft))} />
              <Button type="button" variant="outline" onClick={() => addReq(reqDraft)}>Add</Button>
            </div>
            {draft.specialRequests.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {draft.specialRequests.map((r, i) => (
                  <span key={i} className="text-[11px] rounded-full bg-primary/10 text-primary px-2 py-0.5 flex items-center gap-1">
                    {r}
                    <button onClick={() => setDraft((d) => ({ ...d, specialRequests: d.specialRequests.filter((_, j) => j !== i) }))}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!isValid}>
            Create & queue for owner
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SourcePicker({
  icon, label, value, onChange, children,
}: { icon: React.ReactNode; label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground flex items-center gap-1">{icon}{label}</Label>
      <Select value={value || "__none"} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={`Pick ${label.toLowerCase()}…`} /></SelectTrigger>
        <SelectContent className="max-h-80">{children}</SelectContent>
      </Select>
    </div>
  );
}

function Field({ label, src, children }: { label: string; src?: SyncSource; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground flex items-center gap-1.5">
        <span>{label}</span>
        {src && src !== "manual" && src !== "default" && (
          <Badge variant="outline" className={`text-[9px] h-4 px-1 ${SOURCE_TONE[src]}`}>
            ↻ {SOURCE_LABEL[src]}
          </Badge>
        )}
      </Label>
      {children}
    </div>
  );
}
