// Sales Inventory Truth — the team-facing counterpart to OwnerHub.
// Every room from the live registry, grouped by area, color-coded by
// owner-confirmed status, with one-click sales actions. Kills ghost
// selling because every action is tied to an Owner ID + composite Room ID.

import { useEffect, useMemo, useState } from "react";
import {
  getRegistry,
  subscribeRegistry,
  dailyTruthPhase,
  closeDeal,
  type RegistryOwner,
  type OwnerRoom,
} from "@/owner/lib/owner-registry";
import { glueBus } from "@/owner/event-bus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Link } from "@tanstack/react-router";
import { CalendarPlus, Play, Lock, Copy, MapPin, AlertTriangle, ShieldCheck, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FlatRoom extends OwnerRoom {
  ownerId: string;
  ownerName: string;
}

function useRegistry() {
  const [data, setData] = useState<RegistryOwner[]>(() => getRegistry());
  useEffect(() => subscribeRegistry(() => setData(getRegistry())), []);
  return data;
}

export function SalesInventoryTruth() {
  const owners = useRegistry();
  const [area, setArea] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("sellable");
  const [q, setQ] = useState("");
  const phase = dailyTruthPhase();

  const flat: FlatRoom[] = useMemo(() => {
    const rows: FlatRoom[] = [];
    owners.forEach((o) =>
      o.properties.forEach((p) =>
        p.rooms.forEach((r) =>
          rows.push({ ...r, ownerId: o.id, ownerName: o.name }),
        ),
      ),
    );
    return rows;
  }, [owners]);

  const areas = useMemo(() => {
    const s = new Set<string>();
    flat.forEach((r) => s.add(r.area));
    return Array.from(s).sort();
  }, [flat]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return flat.filter((r) => {
      if (area !== "all" && r.area !== area) return false;
      if (statusFilter === "sellable") {
        if (r.lockedUnsellable) return false;
        if (!(r.status === "vacant" || r.status === "vacating" || r.status === "held")) return false;
      } else if (statusFilter === "vacant") {
        if (r.status !== "vacant") return false;
      } else if (statusFilter === "vacating") {
        if (r.status !== "vacating") return false;
      } else if (statusFilter === "held") {
        if (r.status !== "held") return false;
      } else if (statusFilter === "booked") {
        if (r.status !== "booked") return false;
      } else if (statusFilter === "locked") {
        if (!r.lockedUnsellable) return false;
      }
      if (!term) return true;
      return (
        r.id.toLowerCase().includes(term) ||
        r.pgName.toLowerCase().includes(term) ||
        r.area.toLowerCase().includes(term) ||
        r.ownerName.toLowerCase().includes(term) ||
        r.ownerId.toLowerCase().includes(term)
      );
    });
  }, [flat, area, statusFilter, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, FlatRoom[]>();
    filtered.forEach((r) => {
      const list = map.get(r.area) || [];
      list.push(r);
      map.set(r.area, list);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const totals = {
    sellable: flat.filter(
      (r) => !r.lockedUnsellable && (r.status === "vacant" || r.status === "vacating" || r.status === "held"),
    ).length,
    held: flat.filter((r) => r.status === "held").length,
    booked: flat.filter((r) => r.status === "booked").length,
    locked: flat.filter((r) => r.lockedUnsellable).length,
    areas: areas.length,
    rooms: flat.length,
  };

  const pitch = (r: FlatRoom) => {
    glueBus.publish({
      type: "team.lead.pitched",
      leadId: `manual-${Date.now()}`,
      roomId: r.id,
      tcmId: "sales",
    });
    toast({ title: "Pitch logged", description: `${r.pgName} · ${r.type}` });
  };

  const requestBlock = (r: FlatRoom) => {
    glueBus.publish({
      type: "team.block.requested",
      blockId: `blk-${Date.now()}`,
      roomId: r.id,
      leadId: `manual-${Date.now()}`,
      ownerId: r.ownerId,
    });
    toast({
      title: "Block requested",
      description: `Owner notified · 15 min auto-expire`,
    });
  };

  const close = (r: FlatRoom) => {
    closeDeal(r.id);
    toast({ title: "Deal closed", description: `${r.pgName} · ${r.type} → booked` });
  };



  return (
    <div className="space-y-4 pb-12">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Sales Inventory Truth
          </h1>
          <p className="text-sm text-muted-foreground">
            Every sellable room, owner-confirmed, with Room IDs ready for visits and
            blocks. No ghost selling.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <Stat label="Sellable" value={totals.sellable} tone="success" />
          <Stat label="Held" value={totals.held} tone="accent" />
          <Stat label="Booked" value={totals.booked} tone="info" />
          <Stat label="Locked" value={totals.locked} tone="danger" />
          <Stat label="Areas" value={totals.areas} />
          <Stat label="Total rooms" value={totals.rooms} />
        </div>
      </header>

      {phase === "locked" && totals.locked > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-[11px] flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
          {totals.locked} room{totals.locked > 1 ? "s" : ""} hidden — owner missed
          today's truth check. Don't sell these.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <Input
          placeholder="Search Room ID, PG, owner…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs h-8 text-xs"
        />
        <Select value={area} onValueChange={setArea}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All areas</SelectItem>
            {areas.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sellable">Sellable (incl held)</SelectItem>
            <SelectItem value="vacant">Vacant</SelectItem>
            <SelectItem value="vacating">Vacating</SelectItem>
            <SelectItem value="held">Held for Gharpayy</SelectItem>
            <SelectItem value="booked">Booked</SelectItem>
            <SelectItem value="locked">Locked / unverified</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {grouped.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No rooms match those filters.
        </div>
      )}

      <div className="space-y-4">
        {grouped.map(([areaName, rows]) => (
          <section key={areaName} className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span className="font-semibold uppercase tracking-wider">{areaName}</span>
              <span className="font-mono">· {rows.length} rooms</span>
            </div>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr className="text-left">
                    <th className="p-2">Room ID</th>
                    <th className="p-2">PG / Owner</th>
                    <th className="p-2">Type</th>
                    <th className="p-2 text-right">Beds</th>
                    <th className="p-2 text-right">Rent</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className={cn(
                        "border-t border-border align-middle",
                        r.lockedUnsellable && "opacity-50",
                      )}
                    >
                      <td className="p-2 font-mono text-[10px]">
                        <button
                          className="hover:underline"
                          onClick={() => {
                            navigator.clipboard?.writeText(r.id);
                            toast({ title: "Room ID copied", description: r.id });
                          }}
                        >
                          {r.id}
                        </button>
                      </td>
                      <td className="p-2">
                        <div className="font-medium">{r.pgName}</div>
                        <Link
                          to="/owner"
                          search={{ id: r.ownerId }}
                          className="text-[10px] text-accent hover:underline font-mono"
                        >
                          {r.ownerId} · {r.ownerName}
                        </Link>
                      </td>
                      <td className="p-2 capitalize">{r.type}</td>
                      <td className="p-2 text-right">{r.beds}</td>
                      <td className="p-2 text-right tabular-nums">
                        ₹{r.rent.toLocaleString()}
                      </td>
                      <td className="p-2">
                        {r.lockedUnsellable ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-destructive/10 text-destructive border-destructive/30"
                          >
                            <Lock className="h-2.5 w-2.5 mr-1" />
                            locked
                          </Badge>
                        ) : r.status === "held" ? (
                          <Badge variant="outline" className="text-[10px] bg-accent/15 text-accent-foreground border-accent/30">
                            <ShieldCheck className="h-2.5 w-2.5 mr-1" />
                            held for Gharpayy
                          </Badge>
                        ) : r.status === "booked" ? (
                          <Badge variant="outline" className="text-[10px] bg-info/10 text-info border-info/30">
                            <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                            booked
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {r.status}
                            {r.verifiedToday && " ✓"}
                          </Badge>
                        )}
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px]"
                            disabled={r.lockedUnsellable}
                            onClick={() => pitch(r)}
                            title="Log virtual tour / pitch"
                          >
                            <Play className="h-3 w-3 mr-1" /> Pitch
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px]"
                            disabled={r.lockedUnsellable}
                            onClick={() => requestBlock(r)}
                            title="Request 15-min block"
                          >
                            <Lock className="h-3 w-3 mr-1" /> Block
                          </Button>
                          <a
                            href={`/visit-war?roomId=${encodeURIComponent(r.id)}`}
                            className={cn(
                              "inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[10px] hover:bg-muted",
                              r.lockedUnsellable && "pointer-events-none",
                            )}
                            title="Schedule visit"
                          >
                            <CalendarPlus className="h-3 w-3" /> Visit
                          </a>
                          {(r.status === "held" || r.status === "vacant" || r.status === "vacating") && !r.lockedUnsellable && (
                            <Button
                              size="sm"
                              className="h-7 text-[10px]"
                              onClick={() => close(r)}
                              title="Close deal — hotel-style"
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Close
                            </Button>
                          )}

                          <button
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-muted"
                            onClick={() => {
                              navigator.clipboard?.writeText(r.id);
                              toast({ title: "Room ID copied", description: r.id });
                            }}
                            title="Copy Room ID"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "danger" | "accent" | "info";
}) {
  return (
    <div className="rounded-md border border-border bg-card px-2.5 py-1">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono">
        {label}
      </div>
      <div
        className={cn(
          "font-display text-sm font-semibold tabular-nums",
          tone === "success" && "text-success",
          tone === "danger" && "text-destructive",
          tone === "accent" && "text-accent-foreground",
          tone === "info" && "text-info",
        )}
      >
        {value}
      </div>
    </div>
  );
}
