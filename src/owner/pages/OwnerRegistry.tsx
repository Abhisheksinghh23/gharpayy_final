import { useEffect, useMemo, useState } from "react";
import {
  getRegistry,
  patchRoom,
  subscribeRegistry,
  type RegistryOwner,
  type OwnerRoom,
  type RoomStatus,
} from "@/owner/lib/owner-registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Copy, Phone, MessageCircle, ChevronDown, ChevronRight } from "lucide-react";

function useRegistry(): RegistryOwner[] {
  const [data, setData] = useState<RegistryOwner[]>(() => getRegistry());
  useEffect(() => subscribeRegistry(() => setData(getRegistry())), []);
  return data;
}

const STATUS_TONE: Record<RoomStatus, string> = {
  vacant: "bg-success/15 text-success border-success/30",
  vacating: "bg-warning/15 text-warning-foreground border-warning/30",
  occupied: "bg-muted text-muted-foreground border-border",
  blocked: "bg-destructive/10 text-destructive border-destructive/30",
  held: "bg-accent/15 text-accent-foreground border-accent/30",
  booked: "bg-info/10 text-info border-info/30",
};

export function OwnerRegistry() {
  const owners = useRegistry();
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [hubFilter, setHubFilter] = useState<"all" | "pg" | "sh">("all");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return owners
      .map((o) => {
        const props =
          hubFilter === "all"
            ? o.properties
            : o.properties.filter((p) => p.hub === hubFilter);
        return { ...o, properties: props };
      })
      .filter((o) => o.properties.length > 0)
      .filter((o) => {
        if (!term) return true;
        return (
          o.id.toLowerCase().includes(term) ||
          o.name.toLowerCase().includes(term) ||
          (o.phone || "").includes(term) ||
          o.properties.some(
            (p) =>
              p.pgName.toLowerCase().includes(term) ||
              p.area.toLowerCase().includes(term) ||
              p.pgId.toLowerCase().includes(term),
          )
        );
      });
  }, [owners, q, hubFilter]);

  const totals = useMemo(() => {
    const t = { owners: filtered.length, properties: 0, beds: 0, vacant: 0 };
    filtered.forEach((o) => {
      t.properties += o.properties.length;
      o.properties.forEach((p) => {
        p.rooms.forEach((r) => {
          t.beds += r.beds;
          if (r.status === "vacant" || r.status === "vacating") t.vacant += r.beds;
        });
      });
    });
    return t;
  }, [filtered]);

  const toggle = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const copy = (text: string, label = "Copied") => {
    navigator.clipboard?.writeText(text);
    toast({ title: label, description: text });
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Owner Console — unified
          </h1>
          <p className="text-sm text-muted-foreground">
            Every owner across both property hubs, with auto-generated IDs and
            room-level controls in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Stat label="Owners" value={totals.owners} />
          <Stat label="Properties" value={totals.properties} />
          <Stat label="Beds" value={totals.beds} />
          <Stat label="Vacant" value={totals.vacant} accent />
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search owner ID, name, phone, property, area…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-md"
        />
        <Select value={hubFilter} onValueChange={(v) => setHubFilter(v as typeof hubFilter)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All hubs</SelectItem>
            <SelectItem value="pg">Property Genius</SelectItem>
            <SelectItem value="sh">Supply Hub</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr className="text-left">
              <th className="p-2 w-8" />
              <th className="p-2">Owner ID</th>
              <th className="p-2">Name</th>
              <th className="p-2">Phone</th>
              <th className="p-2 text-right">Properties</th>
              <th className="p-2 text-right">Beds</th>
              <th className="p-2 text-right">Vacant</th>
              <th className="p-2">Quick</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => {
              const isOpen = expanded.has(o.id);
              return (
                <>
                  <tr key={o.id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-2">
                      <button
                        onClick={() => toggle(o.id)}
                        className="p-1 rounded hover:bg-muted"
                        aria-label="Expand"
                      >
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                    <td className="p-2 font-mono text-[11px]">
                      <button
                        className="hover:underline"
                        onClick={() => copy(o.id, "Owner ID copied")}
                      >
                        {o.id}
                      </button>
                    </td>
                    <td className="p-2 font-medium">{o.name}</td>
                    <td className="p-2 font-mono text-[11px]">{o.phone || "—"}</td>
                    <td className="p-2 text-right">{o.properties.length}</td>
                    <td className="p-2 text-right">{o.totalBeds}</td>
                    <td className="p-2 text-right">
                      <span className="font-semibold text-success">{o.vacantBeds}</span>
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        {o.phone && (
                          <>
                            <a
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-muted"
                              href={`tel:${o.phone}`}
                              aria-label="Call"
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </a>
                            <a
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-muted"
                              href={`https://wa.me/${o.phone.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              aria-label="WhatsApp"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </a>
                          </>
                        )}
                        <button
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-muted"
                          onClick={() =>
                            copy(
                              `Owner ${o.id} · ${o.name} · ${o.properties.length} properties · ${o.vacantBeds} vacant beds`,
                              "Card copied",
                            )
                          }
                          aria-label="Copy card"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-muted/20">
                      <td colSpan={8} className="p-3">
                        <div className="space-y-3">
                          {o.properties.map((p) => (
                            <div
                              key={p.pgId}
                              className="rounded-lg border border-border bg-card p-3"
                            >
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div>
                                  <div className="font-medium text-sm">
                                    {p.pgName}{" "}
                                    <span className="text-muted-foreground">· {p.area}</span>
                                  </div>
                                  <div className="text-[11px] text-muted-foreground font-mono">
                                    {p.pgId} · hub:{p.hub}
                                  </div>
                                </div>
                                <button
                                  className="text-[11px] underline text-accent"
                                  onClick={() => copy(p.pgId, "Property ID copied")}
                                >
                                  copy PG ID
                                </button>
                              </div>
                              {p.rooms.length === 0 ? (
                                <div className="text-[11px] text-muted-foreground">
                                  No room configs available for this property.
                                </div>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-[11px]">
                                    <thead className="text-muted-foreground">
                                      <tr className="text-left">
                                        <th className="py-1 pr-2">Room ID</th>
                                        <th className="py-1 pr-2">Type</th>
                                        <th className="py-1 pr-2">Beds</th>
                                        <th className="py-1 pr-2">Rent</th>
                                        <th className="py-1 pr-2">Status</th>
                                        <th className="py-1 pr-2">Vacating</th>
                                        <th className="py-1 pr-2"> </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {p.rooms.map((r) => (
                                        <RoomRow key={r.id} room={r} onCopy={copy} />
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">
                  No owners match those filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
    return (
      <div className="rounded-md border border-border bg-card px-3 py-1.5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div
          className={`font-display text-base font-semibold tabular-nums ${
            accent ? "text-success" : ""
          }`}
        >
          {value}
        </div>
      </div>
    );
  }
}

function RoomRow({
  room,
  onCopy,
}: {
  room: OwnerRoom;
  onCopy: (text: string, label?: string) => void;
}) {
  const [rent, setRent] = useState(String(room.rent));
  const [beds, setBeds] = useState(String(room.beds));
  const [status, setStatus] = useState<RoomStatus>(room.status);
  const [vacating, setVacating] = useState(room.vacatingDate ?? "");

  const dirty =
    Number(rent) !== room.rent ||
    Number(beds) !== room.beds ||
    status !== room.status ||
    (vacating || "") !== (room.vacatingDate ?? "");

  const save = () => {
    patchRoom(room.id, {
      rent: Number(rent) || 0,
      beds: Number(beds) || 0,
      status,
      vacatingDate: status === "vacating" ? vacating || undefined : undefined,
    });
    toast({ title: "Room updated", description: room.id });
  };

  return (
    <tr className="border-t border-border align-middle">
      <td className="py-1 pr-2 font-mono">
        <button
          className="hover:underline"
          onClick={() => onCopy(room.id, "Room ID copied")}
        >
          {room.id}
        </button>
      </td>
      <td className="py-1 pr-2 capitalize">{room.type}</td>
      <td className="py-1 pr-2">
        <Input
          value={beds}
          onChange={(e) => setBeds(e.target.value.replace(/\D/g, ""))}
          className="h-7 w-16"
        />
      </td>
      <td className="py-1 pr-2">
        <Input
          value={rent}
          onChange={(e) => setRent(e.target.value.replace(/\D/g, ""))}
          className="h-7 w-24"
        />
      </td>
      <td className="py-1 pr-2">
        <Select value={status} onValueChange={(v) => setStatus(v as RoomStatus)}>
          <SelectTrigger className="h-7 w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="vacant">Vacant</SelectItem>
            <SelectItem value="vacating">Vacating</SelectItem>
            <SelectItem value="occupied">Occupied</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className="py-1 pr-2">
        <Input
          type="date"
          value={vacating}
          disabled={status !== "vacating"}
          onChange={(e) => setVacating(e.target.value)}
          className="h-7 w-36"
        />
      </td>
      <td className="py-1 pr-2">
        <div className="flex items-center gap-1">
          <Badge variant="outline" className={`text-[10px] ${STATUS_TONE[room.status]}`}>
            {room.status}
          </Badge>
          <Button
            size="sm"
            variant={dirty ? "default" : "outline"}
            className="h-7 text-[11px]"
            onClick={save}
            disabled={!dirty}
          >
            Save
          </Button>
        </div>
      </td>
    </tr>
  );
}
