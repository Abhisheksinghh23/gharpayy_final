import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useOwnerBookings, computeTotals } from "@/lib/owner-bookings/store";
import { LIFECYCLE_LABEL } from "@/lib/owner-bookings/types";
import type { OwnerBooking, BookingLifecycle } from "@/lib/owner-bookings/types";
import { OwnerBookingCard } from "@/components/owner-bookings/OwnerBookingCard";
import { simulateBookings, clearAllBookings } from "@/lib/owner-bookings/simulate";
import {
  Building2, Search, ChevronLeft, ChevronRight, CheckCircle2, Clock, XCircle,
  Share2, Sparkles, Trash2, Download, Send, Zap, AlertTriangle, ArrowUpDown,
} from "lucide-react";
import { GlobalFilterBar } from "@/components/filters/GlobalFilterBar";
import { AnalyticsStrip } from "@/components/analytics/AnalyticsStrip";

export const Route = createFileRoute("/admin/property-bookings")({
  head: () => ({ meta: [{ title: "Property-wise Bookings — Admin" }] }),
  component: () => <AppShell><PropertyBookingsAdmin /></AppShell>,
});

type SortKey = "count" | "collection" | "readiness" | "pending" | "issues";

function PropertyBookingsAdmin() {
  const { bookings } = useOwnerBookings();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("count");
  const [tab, setTab] = useState("review");

  // Group bookings by property
  const groups = useMemo(() => {
    const m = new Map<string, { propertyId: string; propertyName: string; bookings: OwnerBooking[] }>();
    for (const b of bookings) {
      const key = b.inventory.propertyId;
      if (!m.has(key)) m.set(key, { propertyId: key, propertyName: b.inventory.propertyName, bookings: [] });
      m.get(key)!.bookings.push(b);
    }
    return Array.from(m.values());
  }, [bookings]);

  const filteredGroups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = term ? groups.filter((g) => g.propertyName.toLowerCase().includes(term)) : groups;
    return [...list].sort((a, b) => {
      const sa = statsFor(a.bookings); const sb = statsFor(b.bookings);
      switch (sortKey) {
        case "collection": return collectionPct(sb) - collectionPct(sa);
        case "readiness": return readinessPct(sb) - readinessPct(sa);
        case "pending": return sb.pending - sa.pending;
        case "issues": return sb.issues - sa.issues;
        default: return sb.count - sa.count;
      }
    });
  }, [groups, q, sortKey]);

  // Aggregate bookings from selected properties
  const reviewList = useMemo(() => {
    return bookings
      .filter((b) => selected.has(b.inventory.propertyId))
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [bookings, selected]);

  const current = reviewList[cursor];
  const selectionTotals = useMemo(() => statsFor(reviewList), [reviewList]);

  function toggleProperty(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setCursor(0);
  }
  function selectAll() { setSelected(new Set(filteredGroups.map((g) => g.propertyId))); setCursor(0); }
  function clearAll() { setSelected(new Set()); setCursor(0); }

  // ===== Bulk actions =====
  const store = useOwnerBookings();
  function bulkShare() {
    let n = 0;
    reviewList.forEach((b) => { if (b.status === "created") { store.shareWithOwner(b.id, "bulk"); n++; } });
    toast.success(`Shared ${n} bookings with owners`);
  }
  function bulkMarkReady() {
    let n = 0;
    reviewList.forEach((b) => {
      if (b.status === "acknowledged") { store.markAllReady(b.id, "bulk"); n++; }
    });
    toast.success(`Marked ${n} rooms ready`);
  }
  function bulkApproveMoveIn() {
    let n = 0;
    reviewList.forEach((b) => {
      if (b.status === "room_ready") { store.approveMoveIn(b.id, "bulk"); n++; }
    });
    toast.success(`Approved move-in for ${n} bookings`);
  }
  function bulkComplete() {
    let n = 0;
    reviewList.forEach((b) => {
      if (b.status === "move_in_approved") { store.completeBooking(b.id, "bulk"); n++; }
    });
    toast.success(`Completed check-in for ${n} bookings`);
  }
  function bulkReminder() {
    const due = reviewList.filter((b) => computeTotals(b).pending > 0).length;
    toast.success(`Payment reminders queued for ${due} bookings`);
  }
  function exportCsv() {
    const rows = [
      ["Property", "Customer", "Phone", "Room", "Status", "MoveIn", "Rent", "Deposit", "Expected", "Received", "Pending", "Readiness%"],
      ...reviewList.map((b) => {
        const t = computeTotals(b);
        return [
          b.inventory.propertyName, b.customer.name, b.customer.phone,
          `${b.inventory.roomNumber}/${b.inventory.bedNumber}`,
          LIFECYCLE_LABEL[b.status],
          new Date(b.moveIn.date).toLocaleDateString(),
          b.rent, b.deposit, t.expected, t.received, t.pending,
          Math.round((t.readyCount / t.totalReadiness) * 100),
        ];
      }),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `property-bookings-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${reviewList.length} bookings`);
  }

  function runSimulator() {
    const n = simulateBookings(50, 10);
    toast.success(`Seeded ${n} demo bookings across 10 properties`);
  }
  function wipe() {
    if (!confirm("Delete ALL bookings? This cannot be undone.")) return;
    clearAllBookings();
    setSelected(new Set());
    toast.success("All bookings cleared");
  }

  const selectedBookings = reviewList;

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Property-wise Booking Command
          </h1>
          <p className="text-xs text-muted-foreground">
            Multi-select properties · walk bookings one-by-one · KPI / money / kanban views · bulk actions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={runSimulator} className="h-8">
            <Sparkles className="h-3.5 w-3.5 mr-1" /> Seed 50 demo bookings
          </Button>
          <Button size="sm" variant="outline" onClick={wipe} className="h-8 text-red-600">
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Wipe
          </Button>
        </div>
      </div>

      <GlobalFilterBar hide={["stages", "intents", "roles", "sources"]} />

      <AnalyticsStrip title="Property bookings pulse" hide={["response"]} />

      <div className="grid lg:grid-cols-[340px_1fr] gap-4">

        {/* Property selector */}
        <Card className="p-3 space-y-2 h-fit">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Properties</span>
            <span className="text-[11px] text-muted-foreground">{selected.size}/{groups.length}</span>
          </div>
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search property…" className="pl-7 h-8" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-7 text-[11px] flex-1" onClick={selectAll}>Select all</Button>
            <Button size="sm" variant="outline" className="h-7 text-[11px] flex-1" onClick={clearAll}>Clear</Button>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <ArrowUpDown className="h-3 w-3" /> Sort:
            {(["count", "collection", "readiness", "pending", "issues"] as SortKey[]).map((k) => (
              <button key={k} onClick={() => setSortKey(k)}
                className={`px-1.5 py-0.5 rounded ${sortKey === k ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                {k}
              </button>
            ))}
          </div>
          <ScrollArea className="h-[60vh] -mx-1 px-1">
            <div className="space-y-1.5">
              {filteredGroups.length === 0 && (
                <div className="text-center text-xs text-muted-foreground py-6">No properties yet. Click "Seed".</div>
              )}
              {filteredGroups.map((g) => {
                const s = statsFor(g.bookings);
                const isSel = selected.has(g.propertyId);
                const colPct = collectionPct(s); const readyPct = readinessPct(s);
                return (
                  <label key={g.propertyId}
                    className={`flex items-start gap-2 p-2 rounded border cursor-pointer transition ${
                      isSel ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                    }`}>
                    <Checkbox checked={isSel} onCheckedChange={() => toggleProperty(g.propertyId)} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium truncate">{g.propertyName}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <Badge variant="outline" className="text-[10px]">{s.count}</Badge>
                        {s.pending > 0 && <Badge variant="outline" className="text-[10px] text-amber-600"><Clock className="h-2.5 w-2.5 mr-0.5" />{s.pending}</Badge>}
                        {s.ready > 0 && <Badge variant="outline" className="text-[10px] text-emerald-600"><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />{s.ready}</Badge>}
                        {s.issues > 0 && <Badge variant="outline" className="text-[10px] text-red-600"><XCircle className="h-2.5 w-2.5 mr-0.5" />{s.issues}</Badge>}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px]">
                        <span className={colPct >= 80 ? "text-emerald-600" : colPct >= 50 ? "text-amber-600" : "text-red-600"}>
                          ₹ {colPct}%
                        </span>
                        <span className={readyPct >= 80 ? "text-emerald-600" : readyPct >= 50 ? "text-amber-600" : "text-red-600"}>
                          🛏 {readyPct}%
                        </span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </ScrollArea>
        </Card>

        {/* Main pane */}
        <div className="min-w-0 space-y-3">
          {selected.size === 0 ? (
            <Card className="p-10 text-center text-muted-foreground text-sm">
              Select one or more properties on the left to start.
            </Card>
          ) : (
            <>
              {/* Selection summary */}
              <Card className="p-3">
                <div className="flex flex-wrap items-center justify-between gap-3 text-[12px]">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{selected.size}</span><span className="text-muted-foreground">properties</span>
                    <span className="font-semibold">{selectionTotals.count}</span><span className="text-muted-foreground">bookings</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-emerald-600">₹{selectionTotals.received.toLocaleString("en-IN")} in</span>
                    <span className="text-amber-600">₹{(selectionTotals.expected - selectionTotals.received).toLocaleString("en-IN")} due</span>
                    <span>Collection <b>{collectionPct(selectionTotals)}%</b></span>
                  </div>
                </div>
                {/* Bulk action bar */}
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={bulkShare}>
                    <Share2 className="h-3 w-3 mr-1" /> Share with owners
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={bulkMarkReady}>
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Mark rooms ready
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={bulkApproveMoveIn}>
                    <Zap className="h-3 w-3 mr-1" /> Approve move-in
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={bulkComplete}>
                    Complete check-in
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={bulkReminder}>
                    <Send className="h-3 w-3 mr-1" /> Payment reminders
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={exportCsv}>
                    <Download className="h-3 w-3 mr-1" /> Export CSV
                  </Button>
                </div>
              </Card>

              <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                  <TabsTrigger value="review" className="text-xs">Review one-by-one</TabsTrigger>
                  <TabsTrigger value="kanban" className="text-xs">Owner War Board</TabsTrigger>
                  <TabsTrigger value="money" className="text-xs">Money & Dues</TabsTrigger>
                  <TabsTrigger value="kpis" className="text-xs">Property KPIs</TabsTrigger>
                </TabsList>

                <TabsContent value="review" className="space-y-3 mt-3">
                  {reviewList.length === 0 ? (
                    <Card className="p-10 text-center text-muted-foreground text-sm">No bookings.</Card>
                  ) : (
                    <>
                      <Card className="p-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold">Booking {cursor + 1} of {reviewList.length}</div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-8"
                            onClick={() => setCursor((c) => Math.max(0, c - 1))} disabled={cursor === 0}>
                            <ChevronLeft className="h-4 w-4" /> Prev
                          </Button>
                          <Button size="sm" variant="outline" className="h-8"
                            onClick={() => setCursor((c) => Math.min(reviewList.length - 1, c + 1))}
                            disabled={cursor >= reviewList.length - 1}>
                            Next <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                        {reviewList.map((b, i) => (
                          <button key={b.id} onClick={() => setCursor(i)}
                            className={`text-[10px] px-2 py-0.5 rounded border ${
                              i === cursor ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/40"
                            }`}>
                            {i + 1}. {b.customer.name.split(" ")[0]} · R{b.inventory.roomNumber}
                          </button>
                        ))}
                      </div>
                      {current && <OwnerBookingCard booking={current} mode="sales" />}
                    </>
                  )}
                </TabsContent>

                <TabsContent value="kanban" className="mt-3">
                  <KanbanBoard bookings={selectedBookings} onOpen={(id) => {
                    const idx = reviewList.findIndex((b) => b.id === id);
                    if (idx >= 0) { setCursor(idx); setTab("review"); }
                  }} />
                </TabsContent>

                <TabsContent value="money" className="mt-3">
                  <MoneyView bookings={selectedBookings} />
                </TabsContent>

                <TabsContent value="kpis" className="mt-3">
                  <KpiView groups={filteredGroups.filter((g) => selected.has(g.propertyId))} />
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== Stats helpers =====
type Stats = {
  count: number; expected: number; received: number;
  ready: number; pending: number; issues: number;
  ackCount: number; ackAvgHours: number;
};
function statsFor(list: OwnerBooking[]): Stats {
  const acc: Stats = { count: list.length, expected: 0, received: 0, ready: 0, pending: 0, issues: 0, ackCount: 0, ackAvgHours: 0 };
  let ackHoursSum = 0;
  for (const b of list) {
    const t = computeTotals(b);
    acc.expected += t.expected; acc.received += t.received;
    if (["room_ready", "move_in_approved", "completed"].includes(b.status)) acc.ready++;
    if (["created", "shared_with_owner", "viewed_by_owner"].includes(b.status)) acc.pending++;
    if (b.status === "rejected" || b.status === "cancelled") acc.issues++;
    if (b.sharedAt && b.acknowledgedAt) {
      ackHoursSum += (+new Date(b.acknowledgedAt) - +new Date(b.sharedAt)) / 3600_000;
      acc.ackCount++;
    }
  }
  acc.ackAvgHours = acc.ackCount > 0 ? ackHoursSum / acc.ackCount : 0;
  return acc;
}
function collectionPct(s: Stats) { return s.expected > 0 ? Math.round((s.received / s.expected) * 100) : 0; }
function readinessPct(s: Stats) { return s.count > 0 ? Math.round(((s.ready + s.count - s.pending - s.issues - s.ready) >= 0 ? (s.ready / s.count) * 100 : 0)) : 0; }

// ===== Kanban war board =====
const KANBAN_COLS: { id: BookingLifecycle[]; label: string; tone: string }[] = [
  { id: ["created", "shared_with_owner", "viewed_by_owner"], label: "Pending Ack", tone: "border-amber-500/40 bg-amber-500/5" },
  { id: ["acknowledged"], label: "Acknowledged · Room Prep", tone: "border-blue-500/40 bg-blue-500/5" },
  { id: ["room_ready"], label: "Room Ready", tone: "border-teal-500/40 bg-teal-500/5" },
  { id: ["move_in_approved"], label: "Move-in Approved", tone: "border-emerald-500/40 bg-emerald-500/5" },
  { id: ["completed"], label: "Completed", tone: "border-green-700/40 bg-green-700/5" },
];

function KanbanBoard({ bookings, onOpen }: { bookings: OwnerBooking[]; onOpen: (id: string) => void }) {
  const store = useOwnerBookings();
  return (
    <div className="grid md:grid-cols-3 xl:grid-cols-5 gap-2">
      {KANBAN_COLS.map((col) => {
        const items = bookings.filter((b) => col.id.includes(b.status));
        return (
          <Card key={col.label} className={`p-2 border ${col.tone}`}>
            <div className="flex items-center justify-between text-[11px] font-semibold mb-2">
              <span>{col.label}</span>
              <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
            </div>
            <div className="space-y-1.5 max-h-[55vh] overflow-y-auto">
              {items.length === 0 && <div className="text-[10px] text-muted-foreground text-center py-4">Empty</div>}
              {items.map((b) => {
                const t = computeTotals(b);
                const hoursStuck = b.sharedAt ? (Date.now() - +new Date(b.sharedAt)) / 3600_000 : 0;
                const stuck = col.id[0] !== "completed" && col.id[0] !== "move_in_approved" && hoursStuck > 24;
                return (
                  <div key={b.id} onClick={() => onOpen(b.id)}
                    className="rounded border bg-card p-1.5 cursor-pointer hover:border-primary/60 transition">
                    <div className="flex items-center justify-between gap-1">
                      <div className="text-[11px] font-medium truncate">{b.customer.name}</div>
                      {stuck && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      R{b.inventory.roomNumber}/{b.inventory.bedNumber} · ₹{b.rent.toLocaleString("en-IN")}
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[10px]">
                      <span className={t.pending > 0 ? "text-amber-600" : "text-emerald-600"}>
                        {t.pending > 0 ? `₹${(t.pending / 1000).toFixed(0)}k due` : "paid"}
                      </span>
                      <span className="text-muted-foreground">{Math.round((t.readyCount / t.totalReadiness) * 100)}%</span>
                    </div>
                    <div className="mt-1 flex gap-1">
                      {b.status === "created" && (
                        <Button size="sm" variant="outline" className="h-5 text-[9px] px-1.5"
                          onClick={(e) => { e.stopPropagation(); store.shareWithOwner(b.id); }}>Share</Button>
                      )}
                      {b.status === "acknowledged" && (
                        <Button size="sm" variant="outline" className="h-5 text-[9px] px-1.5"
                          onClick={(e) => { e.stopPropagation(); store.markAllReady(b.id); }}>Ready</Button>
                      )}
                      {b.status === "room_ready" && (
                        <Button size="sm" variant="outline" className="h-5 text-[9px] px-1.5"
                          onClick={(e) => { e.stopPropagation(); store.approveMoveIn(b.id); }}>Approve</Button>
                      )}
                      {b.status === "move_in_approved" && (
                        <Button size="sm" variant="outline" className="h-5 text-[9px] px-1.5"
                          onClick={(e) => { e.stopPropagation(); store.completeBooking(b.id); }}>Complete</Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ===== Money / Aging =====
function MoneyView({ bookings }: { bookings: OwnerBooking[] }) {
  const store = useOwnerBookings();
  const buckets = { fresh: 0, week1: 0, week2: 0, overdue: 0 };
  const rows = bookings.map((b) => {
    const t = computeTotals(b);
    const ageDays = (Date.now() - +new Date(b.createdAt)) / 86400_000;
    let bucket: keyof typeof buckets = "fresh";
    if (t.pending > 0) {
      if (ageDays <= 7) buckets.fresh += t.pending, bucket = "fresh";
      else if (ageDays <= 15) buckets.week1 += t.pending, bucket = "week1";
      else if (ageDays <= 30) buckets.week2 += t.pending, bucket = "week2";
      else buckets.overdue += t.pending, bucket = "overdue";
    }
    return { b, t, ageDays, bucket };
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <AgingCard label="0-7 days" amount={buckets.fresh} tone="text-emerald-600" />
        <AgingCard label="8-15 days" amount={buckets.week1} tone="text-amber-600" />
        <AgingCard label="16-30 days" amount={buckets.week2} tone="text-orange-600" />
        <AgingCard label="30+ days" amount={buckets.overdue} tone="text-red-600" />
      </div>
      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="p-2">Customer</th>
              <th className="p-2">Property · Room</th>
              <th className="p-2 text-right">Expected</th>
              <th className="p-2 text-right">Received</th>
              <th className="p-2 text-right">Pending</th>
              <th className="p-2">Age</th>
              <th className="p-2">Pending lines</th>
            </tr>
          </thead>
          <tbody>
            {rows.filter((r) => r.t.pending > 0).map(({ b, t, ageDays }) => (
              <tr key={b.id} className="border-t hover:bg-muted/20">
                <td className="p-2 font-medium">{b.customer.name}</td>
                <td className="p-2 text-muted-foreground truncate max-w-[200px]">
                  {b.inventory.propertyName} · R{b.inventory.roomNumber}
                </td>
                <td className="p-2 text-right">₹{t.expected.toLocaleString("en-IN")}</td>
                <td className="p-2 text-right text-emerald-600">₹{t.received.toLocaleString("en-IN")}</td>
                <td className="p-2 text-right text-amber-600 font-semibold">₹{t.pending.toLocaleString("en-IN")}</td>
                <td className="p-2">{Math.round(ageDays)}d</td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1">
                    {b.payments.filter((p) => p.status === "pending").map((p) => (
                      <button key={p.id}
                        onClick={() => { store.markPaymentReceived(b.id, p.id); toast.success(`Marked ${p.label} received`); }}
                        className="text-[10px] px-1.5 py-0.5 rounded border border-border hover:border-emerald-500 hover:text-emerald-600">
                        {p.label} · ₹{p.amount.toLocaleString("en-IN")}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {rows.filter((r) => r.t.pending > 0).length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">All bookings fully paid 🎉</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function AgingCard({ label, amount, tone }: { label: string; amount: number; tone: string }) {
  return (
    <Card className="p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${tone}`}>₹{amount.toLocaleString("en-IN")}</div>
    </Card>
  );
}

// ===== KPI dashboard =====
function KpiView({ groups }: { groups: { propertyId: string; propertyName: string; bookings: OwnerBooking[] }[] }) {
  const [sort, setSort] = useState<SortKey>("collection");
  const rows = groups.map((g) => ({ g, s: statsFor(g.bookings) }))
    .sort((a, b) => {
      switch (sort) {
        case "collection": return collectionPct(b.s) - collectionPct(a.s);
        case "readiness": return readinessPct(b.s) - readinessPct(a.s);
        case "pending": return b.s.pending - a.s.pending;
        case "issues": return b.s.issues - a.s.issues;
        default: return b.s.count - a.s.count;
      }
    });
  return (
    <Card className="p-0 overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-muted/40 text-left">
          <tr>
            <th className="p-2">Property</th>
            {(["count", "collection", "readiness", "pending", "issues"] as SortKey[]).map((k) => (
              <th key={k} className="p-2 text-right cursor-pointer hover:text-primary" onClick={() => setSort(k)}>
                {k === "count" ? "Bookings" : k === "collection" ? "Collection %" : k === "readiness" ? "Ready %" : k === "pending" ? "Pending Ack" : "Issues"}
                {sort === k && " ↓"}
              </th>
            ))}
            <th className="p-2 text-right">Owner ack (avg h)</th>
            <th className="p-2 text-right">₹ Received</th>
            <th className="p-2 text-right">₹ Pending</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ g, s }) => {
            const col = collectionPct(s); const rdy = readinessPct(s);
            return (
              <tr key={g.propertyId} className="border-t hover:bg-muted/20">
                <td className="p-2 font-medium truncate max-w-[220px]">{g.propertyName}</td>
                <td className="p-2 text-right">{s.count}</td>
                <td className={`p-2 text-right font-semibold ${col >= 80 ? "text-emerald-600" : col >= 50 ? "text-amber-600" : "text-red-600"}`}>{col}%</td>
                <td className={`p-2 text-right font-semibold ${rdy >= 80 ? "text-emerald-600" : rdy >= 50 ? "text-amber-600" : "text-red-600"}`}>{rdy}%</td>
                <td className="p-2 text-right">{s.pending}</td>
                <td className="p-2 text-right">{s.issues}</td>
                <td className="p-2 text-right">{s.ackAvgHours > 0 ? s.ackAvgHours.toFixed(1) : "—"}</td>
                <td className="p-2 text-right text-emerald-600">₹{s.received.toLocaleString("en-IN")}</td>
                <td className="p-2 text-right text-amber-600">₹{(s.expected - s.received).toLocaleString("en-IN")}</td>
              </tr>
            );
          })}
          {rows.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Select properties to view KPIs.</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}
