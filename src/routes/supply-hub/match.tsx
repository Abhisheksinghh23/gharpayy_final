import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { useEffect, useMemo, useState } from "react";
import { matchLead, rating, type Lead } from "@/supply-hub/lib/matcher";
import { perDayLabel, scarcity } from "@/supply-hub/lib/intel";
import { Sparkles, Target, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/supply-hub/match")({
  head: () => ({ meta: [{ title: "Lead Matcher — Supply Hub" }] }),
  component: SupplyHubMatch,
});

function SupplyHubMatch() {
  const { role } = useApp();
  const navigate = useNavigate();
  useEffect(() => { if (role === "owner") navigate({ to: "/owner/inventory" }); }, [role, navigate]);

  const [lead, setLead] = useState<Lead>({
    name: "",
    area: "Koramangala",
    gender: "Any",
    budgetMin: 12000,
    budgetMax: 22000,
    audience: "Both",
    occupancy: "Any",
  });
  const [submitted, setSubmitted] = useState(false);
  const [transitMode, setTransitMode] = useState<"2-wheeler" | "cab" | "metro">("2-wheeler");

  const results = useMemo(() => (submitted ? matchLead(lead).slice(0, 12) : []), [lead, submitted]);

  if (role === "owner") return null;

  return (
    <AppShell>
      <div className="space-y-5">
        <Link to="/supply-hub" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-accent">
          <ArrowLeft className="h-4 w-4" /> Supply Hub
        </Link>

        <header>
          <div className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-1">Lead Matcher</div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Find the best PG for a lead</h1>
          <p className="text-sm text-muted-foreground mt-1">Real distance + actual bed prices · never fabricated. Hard-disqualifies on gender / over-budget / occupancy not offered.</p>
        </header>

        <form
          onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}
          className="rounded-lg border bg-card p-4 grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          <Field label="Lead name (optional)">
            <input value={lead.name ?? ""} onChange={(e) => setLead({ ...lead, name: e.target.value })} className="input" />
          </Field>
          <Field label="Wants area / landmark / company">
            <input required value={lead.area} onChange={(e) => setLead({ ...lead, area: e.target.value })} placeholder="e.g. Manyata, Christ, Koramangala" className="input" />
          </Field>
          <Field label="Gender">
            <select value={lead.gender} onChange={(e) => setLead({ ...lead, gender: e.target.value as Lead["gender"] })} className="input">
              <option>Any</option><option>Boys</option><option>Girls</option><option>Co-live</option>
            </select>
          </Field>
          <Field label="Budget min (₹/mo)">
            <input type="number" required value={lead.budgetMin} onChange={(e) => setLead({ ...lead, budgetMin: +e.target.value })} className="input" />
          </Field>
          <Field label="Budget max (₹/mo)">
            <input type="number" required value={lead.budgetMax} onChange={(e) => setLead({ ...lead, budgetMax: +e.target.value })} className="input" />
          </Field>
          <Field label="Occupancy">
            <select value={lead.occupancy} onChange={(e) => setLead({ ...lead, occupancy: e.target.value as Lead["occupancy"] })} className="input">
              <option>Any</option><option>Single</option><option>Double</option><option>Triple</option>
            </select>
          </Field>
          <Field label="Audience">
            <select value={lead.audience} onChange={(e) => setLead({ ...lead, audience: e.target.value as Lead["audience"] })} className="input">
              <option>Both</option><option>Working</option><option>Student</option>
            </select>
          </Field>
          <Field label="Preferred Transit">
            <select value={transitMode} onChange={(e) => setTransitMode(e.target.value as any)} className="input">
              <option value="2-wheeler">🏍️ 2-Wheeler (Quickest)</option>
              <option value="cab">🚗 Cab / Auto (Comfortable)</option>
              <option value="metro">🚇 Namma Metro (Traffic-free)</option>
            </select>
          </Field>
          <Field label="Notes">
            <input value={lead.notes ?? ""} onChange={(e) => setLead({ ...lead, notes: e.target.value })} className="input" placeholder="Optional" />
          </Field>
          <div className="flex items-end md:col-span-3 justify-end mt-2">
            <button type="submit" className="inline-flex items-center gap-1 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">
              <Sparkles className="h-4 w-4" /> Match &amp; Optimize Commute
            </button>
          </div>
        </form>

        {submitted && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-accent" />
              <h2 className="font-semibold">Top {results.length} matches</h2>
            </div>
            <div className="rounded-lg border bg-card p-3 grid gap-2 md:grid-cols-3 text-xs">
              <Cell k="Lead distance input" v={lead.area || "—"} />
              <Cell k="Nearest Supply Hub PG" v={results.find((r) => r.commuteKm !== null)?.pg.name ?? "Need known area/landmark"} />
              <Cell k="Lead distance" v={results.find((r) => r.commuteKm !== null)?.commuteKm !== null && results.find((r) => r.commuteKm !== null) ? `${results.find((r) => r.commuteKm !== null)!.commuteKm} km` : "Map/area needed"} />
            </div>
            <div className="space-y-3">
              {results.map((r) => {
                const rt = rating(r.total);
                const sc = scarcity(r.pg);
                const cStats = calculateCommuteStats(r.commuteKm, transitMode);
                return (
                  <Link to="/supply-hub/$id" params={{ id: r.pg.id }} key={r.pg.id} className="block rounded-lg border bg-card p-4 hover:border-accent/50 transition-all">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.pg.area} · {r.pg.tier} · {r.pg.gender}</div>
                        <h3 className="font-semibold mt-0.5">{r.pg.name}</h3>
                        <div className="text-xs text-muted-foreground mt-0.5">{r.pg.locality}</div>
                      </div>
                      <div className="text-right">
                        <div className={cn("font-display text-2xl font-semibold", rt.color)}>{r.total}</div>
                        <div className={cn("text-[10px] uppercase tracking-wider font-semibold", rt.color)}>{rt.label}</div>
                      </div>
                    </div>
                    
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {r.parts.map((p) => (
                        <span key={p.label} className={cn("rounded border px-1.5 py-0.5", p.pts >= p.max * 0.7 ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-border text-muted-foreground")}>
                          {p.label}: {p.pts}/{p.max}
                        </span>
                      ))}
                    </div>

                    {/* Commute Optimizer box */}
                    {r.commuteKm !== null && (
                      <div className="mt-3 rounded-lg border border-accent/20 bg-accent/5 p-2.5 text-xs">
                        <div className="flex items-center justify-between font-semibold">
                          <span className="flex items-center gap-1.5 text-accent text-[11px]">
                            {transitMode === "2-wheeler" ? "🏍️" : transitMode === "cab" ? "🚗" : "🚇"} Bangalore Commute Optimizer
                          </span>
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-bold",
                            cStats.score >= 75 ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
                            cStats.score >= 50 ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" :
                            "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          )}>
                            Commute Score: {cStats.score}/100
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                          <div>
                            <div>Commute Mode: <span className="text-foreground capitalize font-medium">{transitMode}</span></div>
                            <div className="mt-0.5">Est. Time: <span className="text-foreground font-semibold">{cStats.normalMins} mins (normal) / {cStats.peakMins} mins (peak)</span></div>
                          </div>
                          <div className="md:text-right flex items-center md:justify-end text-accent/80 italic text-[10.5px]">
                            {cStats.explanation}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                      <Cell k="Best fit" v={r.bedLabel} />
                      <Cell k="Lead distance" v={r.commuteKm !== null ? `${r.commuteKm} km from ${lead.area}` : "Need map/known area"} />
                      <Cell k="Per day" v={r.bedPrice ? perDayLabel(r.bedPrice) : "—"} />
                    </div>
                    <div className="mt-2 text-xs italic text-muted-foreground">{r.reasoning}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-wider text-accent font-semibold">{rt.action}{sc.hot && ` · ${sc.level}`}</div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <style>{`.input{width:100%;border:1px solid hsl(var(--border));background:hsl(var(--background));border-radius:6px;padding:8px 10px;font-size:13px}.input:focus{outline:none;box-shadow:0 0 0 2px hsl(var(--accent)/0.3)}`}</style>
    </AppShell>
  );
}

function calculateCommuteStats(km: number | null, mode: "2-wheeler" | "cab" | "metro") {
  if (km === null || km === undefined) return { normalMins: 0, peakMins: 0, score: 0, explanation: "Address needed", timeStr: "—" };
  let normalMins = 0;
  let peakMins = 0;
  let explanation = "";
  let score = 0;

  if (mode === "2-wheeler") {
    normalMins = Math.max(3, Math.round(km * 2.2));
    peakMins = Math.max(5, Math.round(km * 3.5));
    score = Math.max(10, Math.round(100 - km * 5.5));
    explanation = "🏍️ Weaves past ORR / Koramangala traffic gaps.";
  } else if (mode === "cab") {
    normalMins = Math.max(5, Math.round(km * 3.2));
    peakMins = Math.max(10, Math.round(km * 6.2));
    score = Math.max(5, Math.round(100 - km * 8.5));
    explanation = "🚗 High delays at Silk Board / Marathahalli flyovers.";
  } else {
    // Metro
    const walkToMetro = 7;
    const metroRide = Math.round(km * 1.5);
    normalMins = walkToMetro + metroRide + 3;
    peakMins = normalMins;
    score = Math.max(15, Math.round(100 - normalMins * 1.6));
    explanation = "🚇 Traffic-free Metro ride. Avoids road congestion.";
  }

  score = Math.min(100, Math.max(0, score));

  return {
    normalMins,
    peakMins,
    score,
    explanation,
    timeStr: `${normalMins}m / ${peakMins}m peak`
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{label}</div>
      {children}
    </label>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded border border-border bg-muted/20 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="text-xs">{v}</div>
    </div>
  );
}
