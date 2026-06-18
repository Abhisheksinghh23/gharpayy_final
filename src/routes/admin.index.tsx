import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminShell } from "@/admin/components/AdminShell";
import { useAdminRows } from "@/admin/lib/use-admin-rows";
import { summarizeWhyNotClosing, summarizeTopObjections } from "@/admin/lib/selectors";
import { useAuditLog } from "@/lib/audit-log";
import { CopyChipRail } from "@/admin/components/CopyChipRail";
import { buildLeadCopyBlocks } from "@/admin/lib/exporters/whatsapp-blocks";
import { useMemo } from "react";
import { useVisitWar } from "@/lib/visits/war-store";
import { GlobalFilterBar } from "@/components/filters/GlobalFilterBar";
import { AnalyticsStrip } from "@/components/analytics/AnalyticsStrip";

export const Route = createFileRoute("/admin/")({
  component: AdminCockpit,
});

function AdminCockpit() {
  const rows = useAdminRows();
  const audit = useAuditLog((s) => s.entries).slice(0, 40);
  const alerts = useVisitWar((s) => s.alerts).slice(0, 20);

  const open = rows.filter((r) => r.status === "open" || r.status === "dormant");
  const hot = open.filter((r) => r.probability >= 70);
  const booked = rows.filter((r) => r.booked);
  const lost = rows.filter((r) => r.status === "lost");
  const walking = lost.reduce((s, r) => s + r.lead.budget * 12, 0);
  const revenue = booked.reduce((s, r) => s + (r.bookings[0]?.amount ?? r.lead.budget) * 12, 0);

  const why = useMemo(() => summarizeWhyNotClosing(rows), [rows]);
  const objs = useMemo(() => summarizeTopObjections(rows.flatMap((r) => r.objections)), [rows]);
  const top24h = useMemo(() => [...open].sort((a, b) => b.probability - a.probability).slice(0, 5), [open]);

  return (
    <AdminShell title="Cockpit" sub="Single screen — every signal, every action.">
      <GlobalFilterBar />
      <AnalyticsStrip title="Cross-funnel pulse" />


      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Pipeline open", value: open.length, accent: "text-info" },
          { label: "Hot ≥70%", value: hot.length, accent: "text-accent" },
          { label: "Booked", value: booked.length, accent: "text-success" },
          { label: "₹ Booked", value: `₹${(revenue / 100000).toFixed(1)}L`, accent: "text-success" },
          { label: "₹ Walking", value: `₹${(walking / 100000).toFixed(1)}L`, accent: "text-destructive" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.label}</div>
            <div className={`text-xl font-display font-semibold ${k.accent}`}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-3 mt-3">
        <WhyCard title="Why leads aren't closing" rows={why.map((w) => [w.reason, w.count] as const)} />
        <WhyCard title="Top objection codes" rows={objs.map((o) => [o.code, o.count] as const)} />
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Most likely to close in 24h</div>
          <ol className="space-y-1 text-xs">
            {top24h.map((r, i) => (
              <li key={r.lead.id} className="flex justify-between gap-2">
                <Link to="/admin/leads" className="truncate hover:underline">{i + 1}. {r.lead.name}</Link>
                <span className="text-accent font-mono">{r.probability}%</span>
              </li>
            ))}
            {!top24h.length && <li className="text-muted-foreground">No open leads.</li>}
          </ol>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3 mt-3">
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Live pulse — visit alerts</div>
          <ul className="space-y-1 text-xs max-h-72 overflow-auto">
            {alerts.map((a) => (
              <li key={a.id} className="flex gap-2"><span className="text-muted-foreground font-mono">{new Date(a.ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span><span>{a.message}</span></li>
            ))}
            {!alerts.length && <li className="text-muted-foreground">No alerts.</li>}
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Audit feed</div>
          <ul className="space-y-1 text-xs max-h-72 overflow-auto">
            {audit.map((e) => (
              <li key={e.id} className="flex gap-2"><span className="text-muted-foreground font-mono">{new Date(e.ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span><span>{e.summary}</span></li>
            ))}
            {!audit.length && <li className="text-muted-foreground">No entries yet.</li>}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-3 mt-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Broadcast snippets</div>
        <CopyChipRail blocks={top24h.length ? buildLeadCopyBlocks(top24h[0], rows).filter((b) => ["daily", "weekly"].includes(b.key)) : []} />
      </div>
    </AdminShell>
  );
}

function WhyCard({ title, rows }: { title: string; rows: Array<readonly [string, number]> }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{title}</div>
      <ul className="space-y-1 text-xs">
        {rows.map(([k, v]) => (
          <li key={k} className="flex justify-between gap-2">
            <span className="truncate">{k}</span>
            <span className="font-mono text-accent">{v}</span>
          </li>
        ))}
        {!rows.length && <li className="text-muted-foreground">No data.</li>}
      </ul>
    </div>
  );
}
