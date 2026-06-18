import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useMemo, useState } from "react";
import {
  useOwnerSession, loginAsOwner, logoutOwner, pgsForOwnerCode, allOwnerAccounts,
  getPgInventory, setPgInventory, useOwnerInventory, ownerScorecard,
} from "@/lib/owners/account-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ShieldCheck, LogOut, Building2, Bed, Lock, Pause, Play, MapPin, IndianRupee, Save, AlertTriangle, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import type { PG } from "@/property-genius/data/types";

export const Route = createFileRoute("/owner-portal")({
  head: () => ({ meta: [{ title: "Owner Portal — Gharpayy" }] }),
  component: () => <AppShell><OwnerPortalPage /></AppShell>,
});

function OwnerPortalPage() {
  const session = useOwnerSession();
  useOwnerInventory(); // subscribe for re-render
  const account = useMemo(
    () => (session ? allOwnerAccounts().find((a) => a.code === session) : null),
    [session],
  );

  if (!session || !account) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center space-y-3">
        <ShieldCheck className="h-10 w-10 text-muted-foreground mx-auto" />
        <h1 className="text-xl font-semibold">No owner signed in</h1>
        <p className="text-sm text-muted-foreground">
          Pick an owner account first — every owner can manage their own PGs.
        </p>
        <Button asChild><Link to="/owner-accounts">Browse owner accounts</Link></Button>
      </div>
    );
  }

  const pgs = pgsForOwnerCode(session);
  const sc = ownerScorecard(session);
  const accounts = allOwnerAccounts();
  const switchOwner = (code: string) => {
    const next = accounts.find((a) => a.code === code);
    loginAsOwner(code);
    toast.success(`Switched to ${next?.name ?? code}`);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Owner Portal</div>
          <h1 className="text-2xl font-display font-semibold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> {account.name}
          </h1>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            <span className="font-mono">{account.code}</span>
            {account.phone && <span> · {account.phone}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={session} onValueChange={switchOwner}>
            <SelectTrigger className="h-8 w-[210px] text-xs">
              <SelectValue placeholder="Switch owner" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.code} value={a.code}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="gap-1"><Building2 className="h-3 w-3" />{sc.pgCount} PGs</Badge>
          <Badge variant="outline" className="gap-1"><Bed className="h-3 w-3" />{sc.availableBeds} live beds</Badge>
          {sc.paused > 0 && <Badge variant="destructive">{sc.paused} paused</Badge>}
          <Button size="sm" variant="outline" onClick={() => { logoutOwner(); toast.success("Signed out"); }}>
            <LogOut className="h-3.5 w-3.5 mr-1" /> Sign out
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Button asChild size="sm" variant="outline" className="h-9 justify-start text-xs">
          <Link to="/owner"><ShieldCheck className="h-3.5 w-3.5 mr-1" /> Owner desk</Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="h-9 justify-start text-xs">
          <Link to="/owner/rooms"><Bed className="h-3.5 w-3.5 mr-1" /> Update rooms</Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="h-9 justify-start text-xs">
          <Link to="/owner/blocks"><Lock className="h-3.5 w-3.5 mr-1" /> Room blocks</Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="h-9 justify-start text-xs">
          <Link to="/owner/visits"><ArrowRight className="h-3.5 w-3.5 mr-1" /> Visits</Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="h-9 justify-start text-xs">
          <Link to="/owner-accounts"><Building2 className="h-3.5 w-3.5 mr-1" /> All owners</Link>
        </Button>
      </div>

      <div className="rounded-md border bg-muted/30 px-4 py-3 text-xs text-muted-foreground flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-do-today mt-0.5 shrink-0" />
        <div>
          Every change here flows live into the Impact Queue. If you pause a PG or set vacant beds to 0,
          the sales team can’t schedule new tours there until you update again.
        </div>
      </div>

      <div className="space-y-3">
        {pgs.map((pg) => (
          <PgInventoryRow key={pg.id} pg={pg} />
        ))}
        {pgs.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-12">
            No properties mapped to this owner yet.
          </div>
        )}
      </div>
    </div>
  );
}

function PgInventoryRow({ pg }: { pg: PG }) {
  const inv = getPgInventory(pg.id);
  const [totalBeds, setTotal] = useState(inv?.totalBeds ?? 20);
  const [vacantBeds, setVacant] = useState(inv?.vacantBeds ?? 5);
  const [blockedBeds, setBlocked] = useState(inv?.blockedBeds ?? 0);
  const [blockReason, setBlockReason] = useState(inv?.blockReason ?? "");
  const [isLive, setIsLive] = useState(inv?.isLive ?? true);
  const [note, setNote] = useState(inv?.note ?? "");

  const dirty =
    !inv ||
    inv.totalBeds !== totalBeds ||
    inv.vacantBeds !== vacantBeds ||
    inv.blockedBeds !== blockedBeds ||
    inv.isLive !== isLive ||
    (inv.blockReason ?? "") !== blockReason ||
    (inv.note ?? "") !== note;

  const free = isLive ? Math.max(0, vacantBeds - blockedBeds) : 0;
  const price = pg.prices?.double || pg.prices?.single || pg.prices?.triple || pg.prices?.min || 0;

  const save = () => {
    setPgInventory(pg.id, {
      totalBeds, vacantBeds, blockedBeds, blockReason, isLive, note,
    });
    toast.success(`${pg.name} updated · ${free} beds live`);
  };

  return (
    <div className={`rounded-lg border bg-card p-4 space-y-3 ${!isLive ? "opacity-80 border-destructive/40" : ""}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="font-semibold truncate">{pg.name}</div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{pg.area}</span>
            {price > 0 && <span className="flex items-center gap-1"><IndianRupee className="h-3 w-3" />{price.toLocaleString("en-IN")}/mo</span>}
            <span className="font-mono">{pg.id}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={free > 0 ? "outline" : "destructive"} className="gap-1">
            <Bed className="h-3 w-3" /> {free} beds live
          </Badge>
          <div className="flex items-center gap-2 rounded-md border px-2 py-1 text-[11px]">
            {isLive ? <Play className="h-3 w-3 text-won" /> : <Pause className="h-3 w-3 text-destructive" />}
            <Switch checked={isLive} onCheckedChange={setIsLive} />
            <span>{isLive ? "Live" : "Paused"}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Total beds</Label>
          <Input type="number" className="h-8 text-xs" value={totalBeds}
            onChange={(e) => setTotal(Math.max(1, Number(e.target.value) || 0))} />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Vacant beds</Label>
          <Input type="number" className="h-8 text-xs" value={vacantBeds}
            onChange={(e) => setVacant(Math.max(0, Number(e.target.value) || 0))} />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Lock className="h-3 w-3" /> Blocked by me
          </Label>
          <Input type="number" className="h-8 text-xs" value={blockedBeds}
            onChange={(e) => setBlocked(Math.max(0, Number(e.target.value) || 0))} />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Block reason</Label>
          <Input className="h-8 text-xs" placeholder="e.g. painting, family use"
            value={blockReason} onChange={(e) => setBlockReason(e.target.value)} />
        </div>
      </div>

      <div>
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Note for the sales team</Label>
        <Input className="h-8 text-xs" placeholder="e.g. AC repaired, ready to show after 5pm"
          value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="text-[11px] text-muted-foreground">
          {inv ? (
            <>Last updated {new Date(inv.updatedAt).toLocaleString()}</>
          ) : (
            <>Never updated — sales team is using default estimates.</>
          )}
        </div>
        <Button size="sm" className="h-8 text-xs gap-1" disabled={!dirty} onClick={save}>
          <Save className="h-3.5 w-3.5" /> {dirty ? "Save changes" : "Saved"}
        </Button>
      </div>
    </div>
  );
}