import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { useATC, ackOwner, ackTeam, releaseHold, convertHold, freshnessFor, FRESH_TTL_MS, reconfirmProperty } from "@/lib/atc/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HoldCountdown } from "@/components/atc/HoldCountdown";
import { FreshnessBadge } from "@/components/atc/FreshnessBadge";
import { TenantTimeline } from "@/components/atc/TenantTimeline";
import { Plane, AlertTriangle, ShieldCheck, Lock, Activity, Building2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/atc")({
  head: () => ({ meta: [{ title: "Air Traffic Control · War Room" }] }),
  component: () => <AppShell><ATCWarRoom /></AppShell>,
});

function ATCWarRoom() {
  const { leads, properties, tours, bookings } = useApp();
  const { holds } = useATC();
  const [focusLead, setFocusLead] = useState<string | null>(null);

  const active = holds.filter((h) => h.status === "active");
  const stale = useMemo(
    () => properties.filter((p) => freshnessFor(p.id).stale),
    [properties, holds /* re-eval on store change */],
  );
  const pendingOwnerAck = active.filter((h) => !h.ownerAck);
  const pendingTeamAck  = active.filter((h) => !h.teamAck);
  const visitsToday = tours.filter((t) => {
    const d = new Date(t.scheduledAt);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  });
  const bookingsToday = bookings.filter((b) => {
    const d = new Date(b.ts);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  });

  const freshnessPct = properties.length === 0
    ? 100
    : Math.round(((properties.length - stale.length) / properties.length) * 100);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-2">
        <Plane className="h-5 w-5 text-do-now" />
        <h1 className="text-xl md:text-2xl font-bold">Air Traffic Control</h1>
        <Badge variant="outline" className="text-[10px]">Live · single source of truth</Badge>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI tone="do-now"   label="Active holds"        value={active.length}      icon={Lock} />
        <KPI tone="do-today" label="Owner ack pending"   value={pendingOwnerAck.length} icon={AlertTriangle} />
        <KPI tone="do-soon"  label="Team ack pending"    value={pendingTeamAck.length}  icon={ShieldCheck} />
        <KPI tone="won"      label="Bookings today"      value={bookingsToday.length}   icon={Activity} />
        <KPI tone={freshnessPct >= 80 ? "won" : freshnessPct >= 50 ? "do-today" : "do-now"}
             label="Inventory freshness" value={`${freshnessPct}%`} icon={Building2} />
      </div>

      {/* Two-column ops grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active holds */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lock className="h-4 w-4 text-do-now" /> Active smart holds ({active.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[360px]">
              <div className="p-3 space-y-2">
                {active.length === 0 && <EmptyMsg text="No active holds. Lock a room from the Impact Queue → Hold." />}
                {active.map((h) => {
                  const lead = leads.find((l) => l.id === h.leadId);
                  return (
                    <div key={h.id} className="rounded-md border bg-card p-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold truncate">{h.leadName}</span>
                        <span className="text-xs text-muted-foreground">→ {h.propertyName}{h.bedRef ? ` · ${h.bedRef}` : ""}</span>
                        <div className="ml-auto"><HoldCountdown hold={h} /></div>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <Badge variant={h.teamAck ? "default" : "outline"}
                          className={`text-[10px] ${h.teamAck ? "bg-won text-white" : "border-do-today/50 text-do-today"}`}>
                          team {h.teamAck ? "✓" : "pending"}
                        </Badge>
                        <Badge variant={h.ownerAck ? "default" : "outline"}
                          className={`text-[10px] ${h.ownerAck ? "bg-won text-white" : "border-do-today/50 text-do-today"}`}>
                          owner {h.ownerAck ? "✓" : "pending"}
                        </Badge>
                        <div className="ml-auto flex gap-1">
                          {!h.teamAck && (
                            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2"
                              onClick={() => { ackTeam(h.id); toast.success("Team confirmed"); }}>
                              team ack
                            </Button>
                          )}
                          {!h.ownerAck && (
                            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2"
                              onClick={() => { ackOwner(h.id); toast.success("Owner confirmed"); }}>
                              owner ack
                            </Button>
                          )}
                          {h.teamAck && h.ownerAck && (
                            <Button size="sm" className="h-6 text-[10px] px-2 bg-won hover:bg-won/90 text-white"
                              onClick={() => { convertHold(h.id); toast.success("Booking confirmed"); }}>
                              confirm booking
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2"
                            onClick={() => releaseHold(h.id, "manual")}>
                            release
                          </Button>
                        </div>
                      </div>
                      {lead && (
                        <button className="text-[10px] text-muted-foreground underline mt-1"
                          onClick={() => setFocusLead(lead.id)}>
                          view timeline
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Stale inventory */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-do-today" /> Stale inventory ({stale.length})
              <Badge variant="outline" className="text-[10px] ml-1">{">"} 6h or never verified</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[360px]">
              <div className="p-3 space-y-1.5">
                {stale.length === 0 && <EmptyMsg text="All inventory verified within 6h. 🛬 Clear skies." />}
                {stale.map((p) => {
                  const f = freshnessFor(p.id);
                  const ageLabel = f.ageMs === null ? "never verified" :
                    `${Math.floor(f.ageMs / 3_600_000)}h old`;
                  return (
                    <div key={p.id} className="flex items-center gap-2 rounded-md border bg-card p-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{p.name}</div>
                        <div className="text-[10px] text-muted-foreground">{p.area} · {p.vacantBeds}/{p.totalBeds} beds · {ageLabel}</div>
                      </div>
                      <Button size="sm" variant="outline" className="h-6 text-[10px]"
                        onClick={() => { reconfirmProperty(p.id); toast.success(`${p.name} verified`); }}>
                        reconfirm
                      </Button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Visits today + Timeline focus */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-sm">Today’s flight board · {visitsToday.length} visits</CardTitle></CardHeader>
          <CardContent className="p-3">
            {visitsToday.length === 0 && <EmptyMsg text="No visits on the board today." />}
            <div className="space-y-1.5">
              {visitsToday.map((t) => {
                const lead = leads.find((l) => l.id === t.leadId);
                const prop = properties.find((p) => p.id === t.propertyId);
                return (
                  <div key={t.id} className="flex items-center gap-2 rounded border bg-card p-2 text-xs">
                    <span className="font-mono text-[10px] text-muted-foreground w-12">
                      {new Date(t.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="font-medium truncate flex-1">{lead?.name ?? t.leadId}</span>
                    <span className="text-muted-foreground truncate">→ {prop?.name ?? t.propertyId}</span>
                    <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
                    {prop && <FreshnessBadge propertyId={prop.id} compact />}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              Tenant timeline
              {focusLead && (
                <Badge variant="outline" className="text-[10px]">
                  {leads.find((l) => l.id === focusLead)?.name ?? focusLead}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            {!focusLead && <EmptyMsg text="Click ‘view timeline’ on any hold to see its flight log." />}
            {focusLead && (
              <ScrollArea className="h-[320px] pr-2">
                <TenantTimeline leadId={focusLead} />
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KPI({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; tone: "do-now" | "do-today" | "do-soon" | "won" }) {
  const toneCls: Record<string, string> = {
    "do-now":   "border-do-now/40 text-do-now",
    "do-today": "border-do-today/40 text-do-today",
    "do-soon":  "border-do-soon/40 text-do-soon",
    "won":      "border-won/40 text-won",
  };
  return (
    <div className={`rounded-md border bg-card p-3 ${toneCls[tone]}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function EmptyMsg({ text }: { text: string }) {
  return <div className="text-xs text-muted-foreground italic text-center py-6">{text}</div>;
}
