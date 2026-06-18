import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOwnerBookings, computeTotals } from "@/lib/owner-bookings/store";
import { LIFECYCLE_LABEL } from "@/lib/owner-bookings/types";
import { OwnerBookingCard } from "@/components/owner-bookings/OwnerBookingCard";
import { useOwner } from "@/owner/owner-context";
import { Bell, CalendarCheck, CheckCircle2, Wallet } from "lucide-react";

export const Route = createFileRoute("/owner/booking-approvals")({
  head: () => ({ meta: [{ title: "My Bookings — Owner" }] }),
  component: () => <AppShell><OwnerBookingsView /></AppShell>,
});

function OwnerBookingsView() {
  const { currentOwnerId } = useOwner();
  const { bookings, markViewed } = useOwnerBookings();

  const ownerBookings = useMemo(
    () => bookings.filter((b) => b.ownerId === currentOwnerId),
    [bookings, currentOwnerId],
  );

  const buckets = useMemo(() => ({
    pending: ownerBookings.filter((b) => !b.ownerDecision && b.status !== "cancelled"),
    upcoming: ownerBookings.filter((b) =>
      b.ownerDecision && b.ownerDecision !== "reject" && b.status !== "completed" && b.status !== "cancelled"),
    completed: ownerBookings.filter((b) => b.status === "completed"),
  }), [ownerBookings]);

  const [tab, setTab] = useState("pending");
  const list = tab === "pending" ? buckets.pending : tab === "upcoming" ? buckets.upcoming : buckets.completed;
  const [openId, setOpenId] = useState<string | null>(list[0]?.id ?? null);

  const open = ownerBookings.find((b) => b.id === openId);

  // auto-mark viewed when opened
  if (open && open.status === "shared_with_owner" && !open.viewedAt) {
    queueMicrotask(() => markViewed(open.id));
  }

  const totalDue = ownerBookings.reduce((s, b) => s + computeTotals(b).pending, 0);
  const nextMoveIn = [...ownerBookings]
    .filter((b) => b.status !== "completed" && b.status !== "cancelled")
    .sort((a, b) => new Date(a.moveIn.date).getTime() - new Date(b.moveIn.date).getTime())[0];

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold">My Bookings</h1>
        <p className="text-xs text-muted-foreground">
          Approve incoming bookings, confirm room readiness, and track every move-in.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat icon={<Bell className="h-4 w-4 text-amber-500" />} label="Pending approval" value={buckets.pending.length.toString()} />
        <Stat icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} label="Upcoming check-ins" value={buckets.upcoming.length.toString()} />
        <Stat icon={<Wallet className="h-4 w-4" />} label="Payments due" value={`₹${totalDue.toLocaleString("en-IN")}`} tone={totalDue > 0 ? "warn" : undefined} />
        <Stat icon={<CalendarCheck className="h-4 w-4" />}
          label="Next move-in"
          value={nextMoveIn ? new Date(nextMoveIn.moveIn.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"} />
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); setOpenId(null); }}>
        <TabsList>
          <TabsTrigger value="pending" className="text-xs">Pending ack ({buckets.pending.length})</TabsTrigger>
          <TabsTrigger value="upcoming" className="text-xs">Upcoming ({buckets.upcoming.length})</TabsTrigger>
          <TabsTrigger value="completed" className="text-xs">Completed ({buckets.completed.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid lg:grid-cols-[340px_1fr] gap-4">
        <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
          {list.length === 0 && (
            <Card className="p-6 text-center text-xs text-muted-foreground">Nothing here.</Card>
          )}
          {list.map((b) => {
            const t = computeTotals(b);
            return (
              <Card key={b.id}
                onClick={() => setOpenId(b.id)}
                className={`p-3 cursor-pointer border transition ${
                  (openId ?? list[0]?.id) === b.id ? "border-primary ring-1 ring-primary" : "hover:border-primary/40"
                }`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate">{b.customer.name}</span>
                  <Badge variant="outline" className="text-[10px]">{LIFECYCLE_LABEL[b.status]}</Badge>
                </div>
                <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                  R{b.inventory.roomNumber}/{b.inventory.bedNumber} · Move-in {new Date(b.moveIn.date).toLocaleDateString()}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">{t.readyCount}/{t.totalReadiness} ready</span>
                  <span className={t.pending > 0 ? "text-amber-600" : "text-emerald-600"}>
                    {t.pending > 0 ? `₹${t.pending.toLocaleString("en-IN")} due` : "Fully paid"}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="min-w-0">
          {open ? (
            <OwnerBookingCard booking={open} mode="owner" />
          ) : (
            <Card className="p-10 text-center text-muted-foreground">Select a booking to take action.</Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "warn" }) {
  return (
    <Card className="p-3">
      <div className="text-[11px] text-muted-foreground flex items-center gap-1">{icon}{label}</div>
      <div className={`text-lg font-bold ${tone === "warn" ? "text-amber-600" : ""}`}>{value}</div>
    </Card>
  );
}
