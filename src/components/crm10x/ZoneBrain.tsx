import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { useSettings } from "@/myt/lib/settings-context";
import { zoneSnapshots } from "@/lib/crm10x/analytics";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Layers, Users, IndianRupee, Activity, AlertTriangle,
  TrendingUp, TrendingDown, ArrowRight, Brain, Building2,
  Radio, Compass, Navigation
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { emit as emitConnector } from "@/lib/connectors";

/**
 * Zone P&L + Capacity Brain — per-zone revenue, conversion, SLA and
 * TCM load with auto rebalancing recommendations + Live Dispatch Radar.
 */
export function ZoneBrain() {
  const leads = useApp((s) => s.leads);
  const tcms = useApp((s) => s.tcms);
  const bookings = useApp((s) => s.bookings);
  const logSystemActivity = useApp((s) => s.logSystemActivity);
  const { settings } = useSettings();

  const zones = useMemo(
    () => zoneSnapshots({ zones: settings.zones, tcms, leads, bookings }),
    [settings.zones, tcms, leads, bookings],
  );

  const [divertRules, setDivertRules] = useState<{ id: string; fromTcm: string; toTcm: string; reason: string; status: "active" | "completed" }[]>([]);
  const [rebalancing, setRebalancing] = useState(false);

  const tcmLoads = useMemo(() => {
    return tcms.map((t) => {
      const activeLeadsCount = leads.filter(
        (l) => l.assignedTcmId === t.id && l.stage !== "booked" && l.stage !== "dropped"
      ).length;
      return {
        ...t,
        activeLeadsCount,
        capacityPct: Math.min(100, Math.round((activeLeadsCount / 8) * 100)),
      };
    });
  }, [tcms, leads]);

  // Live TCM Dispatch Radar statuses
  const initialStatuses = useMemo(() => {
    const statuses: Record<string, "Idle" | "En-route" | "Conducting Tour" | "Offline"> = {};
    tcms.forEach((t, i) => {
      if (i % 4 === 0) statuses[t.id] = "Conducting Tour";
      else if (i % 4 === 1) statuses[t.id] = "Idle";
      else if (i % 4 === 2) statuses[t.id] = "En-route";
      else statuses[t.id] = "Offline";
    });
    return statuses;
  }, [tcms]);

  const [tcmStatuses, setTcmStatuses] = useState<Record<string, "Idle" | "En-route" | "Conducting Tour" | "Offline">>(() => initialStatuses);
  const [selectedDispatchTcm, setSelectedDispatchTcm] = useState<string>("");
  const [activeDispatches, setActiveDispatches] = useState<{
    id: string;
    tcmName: string;
    clientName: string;
    route: string;
    eta: number;
  }[]>([]);

  // Stable angles/radii for TCM radar coordinates
  const radarTcms = useMemo(() => {
    return tcms.map((t, idx) => {
      const angle = (idx * 360) / Math.max(1, tcms.length) + 15;
      const radius = 30 + ((idx * 17) % 55); // scatter radius between 30 and 85
      const rad = (angle * Math.PI) / 180;
      const x = 50 + radius * Math.cos(rad) * 0.45; // scale to fit 100x100 viewBox
      const y = 50 + radius * Math.sin(rad) * 0.45;
      return { ...t, x, y };
    });
  }, [tcms]);

  const handleDispatch = () => {
    const targetTcmId = selectedDispatchTcm || tcms.find(t => tcmStatuses[t.id] === "Idle")?.id;
    if (!targetTcmId) {
      toast.error("No TCM selected or available for dispatch.");
      return;
    }

    const tcm = tcms.find(t => t.id === targetTcmId);
    if (!tcm) return;

    const clients = ["Aarav Mehta", "Siddharth Rao", "Kavya Iyer", "Neha Deshmukh", "Rohan Verma", "Tanvi Joshi"];
    const routes = ["via Outer Ring Road", "via Koramangala 80ft Rd", "via Indiranagar 100ft Rd", "via HSR 27th Main", "via Bannerghatta Road"];
    
    const client = clients[Math.floor(Math.random() * clients.length)];
    const route = routes[Math.floor(Math.random() * routes.length)];
    const eta = Math.floor(8 + Math.random() * 15);

    // Update status
    setTcmStatuses(prev => ({ ...prev, [targetTcmId]: "En-route" }));

    // Create dispatch log
    const dispatchId = Date.now().toString();
    const newDispatch = {
      id: dispatchId,
      tcmName: tcm.name,
      clientName: client,
      route,
      eta
    };

    setActiveDispatches(prev => [newDispatch, ...prev]);

    // Emit connector event
    emitConnector({
      kind: "tour.scheduled",
      actorRole: "flow-ops",
      actorId: "system",
      text: `Live Dispatch: Deployed ${tcm.name} to urgent walk-in lead ${client} (${route}, ETA: ${eta} mins)`,
    });

    // Log in global system activity
    logSystemActivity(`[TCM Dispatch Radar] Deployed ${tcm.name} to walk-in lead ${client} (${route}, ETA: ${eta}m)`);

    toast.success(`TCM Dispatch Initiated!`, {
      description: `${tcm.name} deployed to ${client} (${eta} mins).`,
    });

    // Automations: Transition statuses after mock delays
    setTimeout(() => {
      setTcmStatuses(prev => {
        if (prev[targetTcmId] === "En-route") {
          return { ...prev, [targetTcmId]: "Conducting Tour" };
        }
        return prev;
      });
      toast.info(`${tcm.name} arrived at site. Starting property tour for ${client}.`);
    }, 6000);

    setTimeout(() => {
      setTcmStatuses(prev => {
        if (prev[targetTcmId] === "Conducting Tour") {
          return { ...prev, [targetTcmId]: "Idle" };
        }
        return prev;
      });
      setActiveDispatches(prev => prev.filter(d => d.id !== dispatchId));
      toast.success(`${tcm.name} completed tour for ${client}. Status is now Idle.`);
    }, 18000);

    setSelectedDispatchTcm("");
  };

  const handleRebalance = () => {
    setRebalancing(true);
    setTimeout(() => {
      const overloadedTcms = tcmLoads.filter((t) => t.activeLeadsCount > 5).sort((a, b) => b.activeLeadsCount - a.activeLeadsCount);
      const underloadedTcms = tcmLoads.filter((t) => t.activeLeadsCount < 4).sort((a, b) => a.activeLeadsCount - b.activeLeadsCount);

      const newRules: typeof divertRules = [];
      overloadedTcms.forEach((over, idx) => {
        const under = underloadedTcms[idx] || underloadedTcms[0];
        if (under && over.id !== under.id) {
          newRules.push({
            id: `rule-${Date.now()}-${idx}`,
            fromTcm: over.name,
            toTcm: under.name,
            reason: `Shift incoming leads from ${over.name} (${over.activeLeadsCount} active, Zone: ${over.zone}) to ${under.name} (${under.activeLeadsCount} active, Zone: ${under.zone}).`,
            status: "active"
          });
        }
      });

      if (newRules.length === 0) {
        toast.info("TCM capacity is currently balanced. No rebalancing actions needed.");
      } else {
        setDivertRules((prev) => [...newRules, ...prev]);
        toast.success(`Successfully activated ${newRules.length} capacity rebalancing rules!`);
      }
      setRebalancing(false);
    }, 600);
  };

  // Aggregates
  const totalRevenue = zones.reduce((a, z) => a + z.revenueINR, 0);
  const totalActive = zones.reduce((a, z) => a + z.activeLeads, 0);
  const totalSlaFail = zones.reduce((a, z) => a + z.slaBreaches, 0);
  const overloaded = zones.filter((z) => z.pressureLevel === "overloaded");
  const underloaded = zones.filter((z) => z.pressureLevel === "underloaded");
  const leaking = zones.filter((z) => z.pressureLevel === "leaking");

  // Rebalancing suggestions: pair overloaded with underloaded
  const rebalances = useMemo(() => {
    const moves: { from: string; to: string; suggestedLeads: number; reason: string }[] = [];
    overloaded.forEach((src) => {
      const target = underloaded[0];
      if (target) {
        const excess = Math.max(0, src.activeLeads - 25 * Math.max(1, src.tcmIds.length));
        const transfer = Math.min(excess, Math.max(5, 25 * target.tcmIds.length - target.activeLeads));
        if (transfer > 0) {
          moves.push({
            from: src.zoneName,
            to: target.zoneName,
            suggestedLeads: transfer,
            reason: `${src.zoneName} at ${src.loadPerTcm}/TCM, ${target.zoneName} has spare capacity.`,
          });
        }
      }
    });
    return moves;
  }, [overloaded, underloaded]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <header>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Brain className="h-6 w-6 text-accent" /> Zone Brain
        </h1>
        <p className="text-sm text-muted-foreground">
          Per-zone revenue, capacity load, SLA health, auto-rebalancing, and real-time operations dispatcher.
        </p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={IndianRupee} label="Total MRR" value={`₹${(totalRevenue / 1000).toFixed(0)}k`} tone="success" />
        <Stat icon={Activity} label="Active leads" value={totalActive} />
        <Stat icon={Users} label="TCMs" value={tcms.length} />
        <Stat icon={AlertTriangle} label="SLA breaches" value={totalSlaFail} tone={totalSlaFail > 0 ? "danger" : "success"} />
      </div>

      {/* Rebalancing & Dispatch Radar Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Column 1: Suggestions & Active Rules (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {(rebalances.length > 0 || leaking.length > 0) && (
            <Card className="p-4 space-y-2 border-accent/40 bg-accent/5">
              <div className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-accent" />
                <h2 className="font-display font-semibold text-sm">Zone-Level Suggestions</h2>
              </div>
              {rebalances.map((r, i) => (
                <div key={i} className="rounded-md border border-accent/30 bg-card p-2 text-xs">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Badge className="bg-warning/15 text-warning text-[9px]">{r.from}</Badge>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <Badge className="bg-info/15 text-info text-[9px]">{r.to}</Badge>
                    <span className="text-[10px] text-muted-foreground">~{r.suggestedLeads} leads</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">{r.reason}</div>
                </div>
              ))}
              {leaking.map((z) => (
                <div key={z.zoneId} className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs">
                  <div className="font-medium text-destructive flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" /> Leaking · {z.zoneName}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">→ {z.recommendation}</div>
                </div>
              ))}
            </Card>
          )}

          {/* Active Divert Rules */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-accent" />
                <h2 className="font-display font-semibold text-sm">Active Divert Rules</h2>
              </div>
              <Badge variant="secondary" className="text-[9px]">{divertRules.length} Rules</Badge>
            </div>
            {divertRules.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-6">
                No active divert rules. Click "Run Load-Rebalancer" to scan and generate active bypasses.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                {divertRules.map((rule) => (
                  <div key={rule.id} className="p-2 border rounded-md bg-accent/5 border-accent/20 flex flex-col justify-between gap-1.5 animate-in fade-in-50 duration-200">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-accent uppercase tracking-wider text-[9px]">Divert Rule Enforced</span>
                      <button
                        type="button"
                        onClick={() => {
                          setDivertRules((prev) => prev.filter((r) => r.id !== rule.id));
                          toast.success("Divert rule deactivated.");
                        }}
                        className="text-muted-foreground hover:text-destructive hover:underline text-[9px]"
                      >
                        Deactivate
                      </button>
                    </div>
                    <p className="text-[10.5px] leading-relaxed text-foreground/80">{rule.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Column 2: TCM Capacity Heatmap & Simulator (4 cols) */}
        <Card className="lg:col-span-4 p-4 space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <div>
              <h2 className="font-display font-bold text-base flex items-center gap-1.5">
                <Users className="h-4 w-4 text-accent" /> TCM Heatmap &amp; Diverter
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Monitor current agent bandwidth load (limit: 8 leads).
              </p>
            </div>
            <button
              type="button"
              disabled={rebalancing}
              onClick={handleRebalance}
              className="inline-flex items-center gap-1 rounded bg-accent px-2 py-1 text-[10px] font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50 transition"
            >
              {rebalancing ? "Analyzing..." : "Rebalance"}
            </button>
          </div>

          <div className="grid gap-2 max-h-80 overflow-y-auto scrollbar-thin">
            {tcmLoads.map((tcm) => {
              const activeCount = tcm.activeLeadsCount;
              const isOverloaded = activeCount >= 6;
              const isUnderloaded = activeCount <= 2;
              
              let barColor = "bg-emerald-500";
              let textColor = "text-emerald-400";
              if (isOverloaded) {
                barColor = "bg-rose-500";
                textColor = "text-rose-400";
              } else if (activeCount >= 4) {
                barColor = "bg-amber-500";
                textColor = "text-amber-400";
              }

              return (
                <div key={tcm.id} className="p-2 border rounded-lg bg-card/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-foreground">{tcm.name.split(" ")[0]}</span>
                      <span className="ml-1.5 text-muted-foreground text-[9px]">Zone: {tcm.zone}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={cn("font-semibold text-[10px]", textColor)}>{activeCount}/8 active</span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", barColor)}
                      style={{ width: `${tcm.capacityPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                    <span>Conv. Rate: {(tcm.conversionRate * 100).toFixed(0)}%</span>
                    <span>
                      {isOverloaded ? "🔴 High Load" : isUnderloaded ? "🔵 Available" : "🟢 Stable"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Column 3: Live TCM Operations Dispatch Radar (4 cols) */}
        <Card className="lg:col-span-4 p-4 space-y-4 bg-background/55 backdrop-blur-md border border-accent/20 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="border-b pb-2">
              <h2 className="font-display font-bold text-base flex items-center gap-1.5">
                <Radio className="h-4 w-4 text-accent animate-pulse" /> Live Dispatch Radar
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Real-time tracking of Bangalore field operations and walk-in routes.
              </p>
            </div>

            {/* Radar Screen Visual */}
            <div className="relative w-full h-44 bg-slate-950 rounded-lg border border-accent/20 overflow-hidden flex items-center justify-center">
              {/* Radar Grid Backdrop sweep */}
              <div 
                className="absolute inset-0 pointer-events-none rounded-lg"
                style={{
                  background: 'conic-gradient(from 0deg, transparent 50%, rgba(16, 185, 129, 0.08) 95%, rgba(16, 185, 129, 0.25) 100%)',
                  animation: 'spin 6s linear infinite'
                }}
              />
              
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                {/* Radar target rings */}
                <circle cx="50" cy="50" r="15" fill="none" stroke="rgba(16, 185, 129, 0.15)" strokeWidth="0.5" strokeDasharray="1 1" />
                <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(16, 185, 129, 0.15)" strokeWidth="0.5" strokeDasharray="1 1" />
                <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(16, 185, 129, 0.2)" strokeWidth="0.8" />
                
                {/* Axis lines */}
                <line x1="5" y1="50" x2="95" y2="50" stroke="rgba(16, 185, 129, 0.15)" strokeWidth="0.5" />
                <line x1="50" y1="5" x2="50" y2="95" stroke="rgba(16, 185, 129, 0.15)" strokeWidth="0.5" />

                {/* Outer compass ticks */}
                {Array.from({ length: 12 }).map((_, i) => {
                  const a = (i * 30 * Math.PI) / 180;
                  const x1 = 50 + 45 * Math.cos(a);
                  const y1 = 50 + 45 * Math.sin(a);
                  const x2 = 50 + 48 * Math.cos(a);
                  const y2 = 50 + 48 * Math.sin(a);
                  return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(16, 185, 129, 0.3)" strokeWidth="0.5" />;
                })}

                {/* TCM dynamic markers */}
                {radarTcms.map((t) => {
                  const status = tcmStatuses[t.id] || "Idle";
                  let dotColor = "fill-emerald-400";
                  if (status === "En-route") {
                    dotColor = "fill-cyan-400";
                  } else if (status === "Conducting Tour") {
                    dotColor = "fill-fuchsia-400";
                  } else if (status === "Offline") {
                    dotColor = "fill-slate-500";
                  }

                  return (
                    <g key={t.id} className="cursor-pointer group">
                      {status !== "Offline" && (
                        <circle
                          cx={t.x}
                          cy={t.y}
                          r="3"
                          className={cn(
                            "animate-ping fill-none stroke-[0.8]",
                            status === "En-route" ? "stroke-cyan-400" :
                            status === "Conducting Tour" ? "stroke-fuchsia-400" : "stroke-emerald-400"
                          )}
                          style={{ animationDuration: '2s' }}
                        />
                      )}
                      <circle
                        cx={t.x}
                        cy={t.y}
                        r="1.8"
                        className={cn("transition-colors duration-300", dotColor)}
                      />
                      <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                        <rect
                          x={t.x - 22}
                          y={t.y - 12}
                          width="44"
                          height="8"
                          rx="1"
                          fill="rgba(0,0,0,0.85)"
                          stroke="rgba(16,185,129,0.3)"
                          strokeWidth="0.3"
                        />
                        <text
                          x={t.x}
                          y={t.y - 6}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="3.5"
                          className="font-sans font-bold"
                        >
                          {t.name.split(" ")[0]} ({status})
                        </text>
                      </g>
                    </g>
                  );
                })}
              </svg>
              <div className="absolute bottom-2 right-2 flex items-center gap-1.5 bg-black/80 px-2 py-0.5 rounded border border-accent/20 text-[9px] text-accent font-mono uppercase tracking-wider">
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" /> Active Scan
              </div>
            </div>

            {/* Roster & Dispatcher controls */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">TCM Field Roster</span>
                <span className="text-[9px] text-accent font-medium">Select Idle TCM to deploy</span>
              </div>
              <div className="grid grid-cols-2 gap-1 max-h-24 overflow-y-auto scrollbar-thin">
                {tcms.map((t) => {
                  const status = tcmStatuses[t.id] || "Idle";
                  return (
                    <button
                      key={t.id}
                      disabled={status !== "Idle"}
                      onClick={() => setSelectedDispatchTcm(t.id)}
                      className={cn(
                        "flex items-center justify-between p-1 border rounded text-left transition-all",
                        selectedDispatchTcm === t.id
                          ? "border-accent bg-accent/10"
                          : "border-border/40 bg-card hover:bg-muted/50",
                        status !== "Idle" && "opacity-75 cursor-default hover:bg-card"
                      )}
                    >
                      <div className="flex items-center gap-1 overflow-hidden">
                        <span className={cn(
                          "h-1.5 w-1.5 rounded-full shrink-0",
                          status === "Idle" ? "bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse" :
                          status === "En-route" ? "bg-cyan-400 shadow-[0_0_6px_#22d3ee] animate-pulse" :
                          status === "Conducting Tour" ? "bg-fuchsia-400 shadow-[0_0_6px_#e879f9] animate-pulse" :
                          "bg-slate-500"
                        )} />
                        <span className="font-bold text-[9.5px] truncate">{t.name.split(" ")[0]}</span>
                      </div>
                      <span className="text-[8px] uppercase tracking-wider text-muted-foreground pl-1">{status.split(" ")[0]}</span>
                    </button>
                  );
                })}
              </div>

              {/* Action dispatch panel */}
              <div className="pt-2 border-t border-border/40 space-y-2">
                <div className="flex items-center gap-2">
                  <select
                    value={selectedDispatchTcm}
                    onChange={(e) => setSelectedDispatchTcm(e.target.value)}
                    className="flex-1 rounded border border-border/40 bg-background px-2 py-1 text-[11px]"
                  >
                    <option value="">Select Idle TCM...</option>
                    {tcms.map(t => (
                      <option key={t.id} value={t.id} disabled={tcmStatuses[t.id] !== "Idle"}>
                        {t.name} ({tcmStatuses[t.id] || "Idle"})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleDispatch}
                    className="rounded bg-accent px-3 py-1 text-[11px] font-semibold text-accent-foreground hover:opacity-90 transition shrink-0"
                  >
                    Deploy
                  </button>
                </div>

                {activeDispatches.length > 0 && (
                  <div className="space-y-1 mt-1 max-h-24 overflow-y-auto scrollbar-thin">
                    <span className="text-[9px] font-bold text-accent uppercase tracking-wider block">Deployments in Transit</span>
                    {activeDispatches.map((d) => (
                      <div key={d.id} className="p-1.5 border rounded bg-accent/5 border-accent/15 flex flex-col gap-0.5 text-[9.5px]">
                        <div className="flex justify-between items-center font-bold">
                          <span className="text-foreground">{d.tcmName} ➔ {d.clientName}</span>
                          <span className="text-accent font-mono shrink-0">ETA {d.eta}m</span>
                        </div>
                        <span className="text-[8.5px] text-muted-foreground">{d.route}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Zone grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {zones.map((z) => (
          <Card
            key={z.zoneId}
            className={`p-4 space-y-3 ${
              z.pressureLevel === "leaking"
                ? "border-destructive/40 bg-destructive/5"
                : z.pressureLevel === "overloaded"
                  ? "border-warning/40 bg-warning/5"
                  : z.pressureLevel === "underloaded"
                    ? "border-info/40 bg-info/5"
                    : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-display font-bold text-base">{z.zoneName}</div>
                <div className="text-[11px] text-muted-foreground">{z.city} · {z.tcmIds.length} TCM</div>
              </div>
              <PressurePill level={z.pressureLevel} />
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <Mini label="Active" value={z.activeLeads} />
              <Mini label="Booked" value={z.bookings} />
              <Mini label="Conv%" value={`${z.conversion}%`} tone={z.conversion >= 20 ? "good" : z.conversion >= 10 ? "neutral" : "bad"} />
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <Mini label="₹/mo" value={`₹${(z.revenueINR / 1000).toFixed(0)}k`} tone={z.revenueINR > 0 ? "good" : "neutral"} />
              <Mini label="Load/TCM" value={z.loadPerTcm} tone={z.loadPerTcm > 25 ? "bad" : z.loadPerTcm > 15 ? "neutral" : "good"} />
              <Mini label="SLA fail" value={z.slaBreaches} tone={z.slaBreaches >= 3 ? "bad" : z.slaBreaches > 0 ? "neutral" : "good"} />
            </div>

            <div className="text-[11px] text-muted-foreground italic border-l-2 border-accent pl-2">
              {z.recommendation}
            </div>

            {z.tcmIds.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1 border-t border-border">
                {z.tcmIds.map((id) => {
                  const t = tcms.find((x) => x.id === id);
                  if (!t) return null;
                  return (
                    <Badge key={id} variant="outline" className="text-[9px]">
                      {t.initials}
                    </Badge>
                  );
                })}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Capacity formula explainer */}
      <Card className="p-4 text-xs text-muted-foreground space-y-1">
        <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
          <Building2 className="h-4 w-4" /> How load is calculated
        </div>
        <ul className="list-disc list-inside space-y-0.5">
          <li><strong className="text-foreground">Load/TCM</strong> = active leads ÷ TCM count for that zone.</li>
          <li><strong className="text-warning">Overloaded</strong> &ge; 25 active leads per TCM.</li>
          <li><strong className="text-info">Underloaded</strong> &lt; 5 active leads per TCM (capacity available).</li>
          <li><strong className="text-destructive">Leaking</strong> = no TCMs assigned, or 3+ leads never contacted in 24h+, or conversion below 15%.</li>
        </ul>
      </Card>
    </div>
  );
}

function PressurePill({ level }: { level: "balanced" | "overloaded" | "underloaded" | "leaking" }) {
  const map = {
    balanced: { label: "Balanced", icon: TrendingUp, cls: "border-success text-success" },
    overloaded: { label: "Overloaded", icon: TrendingUp, cls: "border-warning text-warning" },
    underloaded: { label: "Spare cap.", icon: TrendingDown, cls: "border-info text-info" },
    leaking: { label: "Leaking", icon: AlertTriangle, cls: "border-destructive text-destructive" },
  } as const;
  const m = map[level];
  const Icon = m.icon;
  return (
    <Badge variant="outline" className={`text-[10px] gap-1 ${m.cls}`}>
      <Icon className="h-2.5 w-2.5" /> {m.label}
    </Badge>
  );
}

function Stat({
  icon: Icon, label, value, tone,
}: { icon: typeof Layers; label: string; value: string | number; tone?: "success" | "danger" }) {
  const cls =
    tone === "success" ? "text-success border-success/30 bg-success/5"
      : tone === "danger" ? "text-destructive border-destructive/30 bg-destructive/5"
      : "border-border bg-card";
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider opacity-80">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="text-2xl font-display font-bold mt-1">{value}</div>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string | number; tone?: "good" | "bad" | "neutral" }) {
  const cls = tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : tone === "neutral" ? "text-warning" : "";
  return (
    <div className="rounded bg-background/60 px-1.5 py-1.5 text-center">
      <div className="text-[8px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-bold font-mono ${cls}`}>{value}</div>
    </div>
  );
}
