import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOwnerBookings, computeTotals } from "@/lib/owner-bookings/store";
import { LIFECYCLE_LABEL } from "@/lib/owner-bookings/types";
import type { OwnerBooking } from "@/lib/owner-bookings/types";
import { CreateBookingDialog } from "@/components/owner-bookings/CreateBookingDialog";
import { OwnerBookingCard } from "@/components/owner-bookings/OwnerBookingCard";
import { IndianRupee, Clock, CheckCircle2, Zap } from "lucide-react";
import { useQuotations } from "@/lib/crm10x/quotations";
import { useApp } from "@/lib/store";
import { PGS } from "@/property-genius/data/pgs";
import {
  emptyDraft, applyLead, applyProperty, applyQuotation, draftToCreateInput,
} from "@/lib/owner-bookings/sync";
import { GlobalFilterBar } from "@/components/filters/GlobalFilterBar";
import { AnalyticsStrip } from "@/components/analytics/AnalyticsStrip";
import { useGlobalFilters, applyToOwnerBookings } from "@/lib/filters/global";

export const Route = createFileRoute("/owner-bookings")({
  head: () => ({ meta: [{ title: "Owner Booking Console — Gharpayy" }] }),
  component: () => <AppShell><OwnerBookingsConsole /></AppShell>,
});

const TAB_FILTERS: { id: string; label: string; match: (b: OwnerBooking) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  { id: "pending_ack", label: "Pending Ack", match: (b) => ["created", "shared_with_owner", "viewed_by_owner"].includes(b.status) },
  { id: "prepare", label: "Room Prep", match: (b) => b.status === "acknowledged" },
  { id: "ready", label: "Ready", match: (b) => b.status === "room_ready" || b.status === "move_in_approved" },
  { id: "completed", label: "Completed", match: (b) => b.status === "completed" },
  { id: "issues", label: "Issues", match: (b) => b.status === "rejected" || b.status === "cancelled" },
];

function OwnerBookingsConsole() {
  const { bookings } = useOwnerBookings();
  const [gf] = useGlobalFilters();
  const [tab, setTab] = useState("all");
  const [openId, setOpenId] = useState<string | null>(bookings[0]?.id ?? null);

  const scoped = useMemo(() => applyToOwnerBookings(bookings, gf), [bookings, gf]);

  const filtered = useMemo(() => {
    const f = TAB_FILTERS.find((t) => t.id === tab)!.match;
    return scoped.filter(f);
  }, [scoped, tab]);

  const stats = useMemo(() => {
    return scoped.reduce(
      (acc, b) => {
        const t = computeTotals(b);
        acc.expected += t.expected;
        acc.received += t.received;
        if (["created", "shared_with_owner", "viewed_by_owner"].includes(b.status)) acc.pendingAck++;
        if (b.status === "room_ready" || b.status === "move_in_approved") acc.ready++;
        if (b.status === "completed") acc.completed++;
        return acc;
      },
      { expected: 0, received: 0, pendingAck: 0, ready: 0, completed: 0 },
    );
  }, [scoped]);

  const open = bookings.find((b) => b.id === openId);

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Owner Booking Console</h1>
          <p className="text-xs text-muted-foreground">
            Every booking is shared with the property owner, acknowledged, and tracked to check-in.
          </p>
        </div>
        <CreateBookingDialog />
      </div>

      <GlobalFilterBar hide={["stages", "intents", "roles", "sources", "memberIds", "zones"]} />

      <AnalyticsStrip title="Bookings pulse" hide={["response"]} compact />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Stat label="In scope" value={scoped.length.toString()} />
        <Stat label="Pending ack" value={stats.pendingAck.toString()} icon={<Clock className="h-4 w-4 text-amber-500" />} />
        <Stat label="Ready" value={stats.ready.toString()} icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} />
        <Stat label="Collected" value={`₹${stats.received.toLocaleString("en-IN")}`} icon={<IndianRupee className="h-4 w-4" />} />
        <Stat label="Pending dues" value={`₹${(stats.expected - stats.received).toLocaleString("en-IN")}`} tone="warn" />
      </div>

      <QuickBookFromQuotations />

      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            {TAB_FILTERS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="text-xs">{t.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>


      <div className="grid lg:grid-cols-[360px_1fr] gap-4">
        <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
          {filtered.length === 0 && (
            <Card className="p-6 text-center text-xs text-muted-foreground">No bookings here.</Card>
          )}
          {filtered.map((b) => {
            const t = computeTotals(b);
            return (
              <Card key={b.id}
                onClick={() => setOpenId(b.id)}
                className={`p-3 cursor-pointer transition border ${
                  openId === b.id ? "border-primary ring-1 ring-primary" : "hover:border-primary/40"
                }`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate">{b.customer.name}</span>
                  <Badge variant="outline" className="text-[10px]">{LIFECYCLE_LABEL[b.status]}</Badge>
                </div>
                <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {b.inventory.propertyName} · R{b.inventory.roomNumber}/{b.inventory.bedNumber}
                </div>
                <div className="flex items-center justify-between text-[11px] mt-1.5">
                  <span className="text-muted-foreground">
                    Move-in {new Date(b.moveIn.date).toLocaleDateString()}
                  </span>
                  <span className={t.pending > 0 ? "text-amber-600" : "text-emerald-600"}>
                    {t.pending > 0 ? `₹${t.pending.toLocaleString("en-IN")} due` : "Paid"}
                  </span>
                </div>
                <div className="mt-1.5 h-1 bg-muted rounded overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${(t.readyCount / t.totalReadiness) * 100}%` }} />
                </div>
              </Card>
            );
          })}
        </div>

        <div className="min-w-0">
          {open ? (
            <OwnerBookingCard booking={open} mode="sales" />
          ) : (
            <Card className="p-10 text-center text-muted-foreground">Select a booking to view details.</Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: string; icon?: React.ReactNode; tone?: "warn" }) {
  return (
    <Card className="p-3">
      <div className="text-[11px] text-muted-foreground flex items-center gap-1">{icon}{label}</div>
      <div className={`text-lg font-bold ${tone === "warn" ? "text-amber-600" : ""}`}>{value}</div>
    </Card>
  );
}

function QuickBookFromQuotations() {
  const quotations = useQuotations((s) => s.quotations);
  const leads = useApp((s) => s.leads);
  const { bookings, createBooking } = useOwnerBookings();

  const candidates = useMemo(() => {
    const usedLeadIds = new Set(bookings.map((b) => b.leadId).filter(Boolean));
    return quotations
      .filter((q) => q.status === "paid" && !usedLeadIds.has(q.leadId))
      .slice(0, 6);
  }, [quotations, bookings]);

  if (candidates.length === 0) return null;

  function quickBook(quotationId: string) {
    const q = quotations.find((qq) => qq.id === quotationId);
    if (!q) return;
    const lead = leads.find((l) => l.id === q.leadId);
    const pg = q.propertyId ? PGS.find((p) => p.id === q.propertyId) : undefined;
    let d = emptyDraft();
    d = applyLead(d, lead);
    if (pg) d = applyProperty(d, pg);
    d = applyQuotation(d, q);
    if (!d.inventory.roomNumber) d.inventory.roomNumber = "TBD";
    createBooking(draftToCreateInput(d, { leadId: q.leadId, createdBy: "auto-sync" }));
  }

  return (
    <Card className="p-3 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold">Quick book from paid quotations</span>
          <Badge variant="outline" className="text-[10px]">{candidates.length} ready</Badge>
        </div>
        <span className="text-[11px] text-muted-foreground">Lead + Property + Quote synced in one click.</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {candidates.map((q) => {
          const lead = leads.find((l) => l.id === q.leadId);
          return (
            <div key={q.id}
              className="rounded border border-border bg-card p-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-medium truncate">{lead?.name ?? q.leadId}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {q.propertyName} · {q.roomType} · ₹{q.discountedPrice.toLocaleString("en-IN")}
                </div>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-[11px]"
                onClick={() => quickBook(q.id)}>
                Sync & book
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

