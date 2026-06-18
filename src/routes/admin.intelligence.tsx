import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/admin/components/AdminShell";
import { useApp } from "@/lib/store";
import { useCRM10x } from "@/lib/crm10x/store";
import { funnelVelocity, objectionLossCorrelation } from "@/lib/crm10x/analytics";
import { useMemo } from "react";

export const Route = createFileRoute("/admin/intelligence")({ component: AdminIntel });

function AdminIntel() {
  const { leads } = useApp();
  const objections = useCRM10x((s) => s.objections);

  const funnel = useMemo(() => funnelVelocity(leads), [leads]);
  const objLoss = useMemo(() => objectionLossCorrelation(leads, objections).slice(0, 8), [leads, objections]);

  return (
    <AdminShell title="Intelligence" sub="What's working · what isn't · why">
      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Funnel velocity</div>
          <table className="w-full text-xs">
            <thead><tr className="text-left text-muted-foreground"><th className="py-1">From → To</th><th className="text-right">Conv%</th><th className="text-right">Drop%</th><th className="text-right">Avg d</th></tr></thead>
            <tbody>{funnel.map((f) => (
              <tr key={f.fromStage} className="border-t border-border">
                <td className="py-1">{f.fromStage} → {f.toStage}</td>
                <td className="text-right text-accent">{f.cohortConv}%</td>
                <td className="text-right text-destructive">{f.dropOffPct}%</td>
                <td className="text-right font-mono">{f.avgDays}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Objection ↔ loss correlation</div>
          <table className="w-full text-xs">
            <thead><tr className="text-left text-muted-foreground"><th className="py-1">Code</th><th className="text-right">Raised</th><th className="text-right">Lost</th><th className="text-right">Loss %</th></tr></thead>
            <tbody>{objLoss.map((r) => (
              <tr key={r.code} className="border-t border-border">
                <td className="py-1">{r.code}</td>
                <td className="text-right">{r.raised}</td>
                <td className="text-right text-destructive">{r.lost}</td>
                <td className="text-right font-mono">{r.lossRate}%</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
