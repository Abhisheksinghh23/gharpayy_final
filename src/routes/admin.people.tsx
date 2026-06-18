import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/admin/components/AdminShell";
import { useApp } from "@/lib/store";
import { useAdminRows } from "@/admin/lib/use-admin-rows";
import { useMemo } from "react";

export const Route = createFileRoute("/admin/people")({ component: AdminPeople });

function AdminPeople() {
  const { tcms } = useApp();
  const rows = useAdminRows();

  const byTcm = useMemo(() => {
    const map = new Map<string, { name: string; zone: string; leads: number; booked: number; lost: number; visits: number; calls: number; revenue: number; hot: number }>();
    tcms.forEach((t) => map.set(t.id, { name: t.name, zone: t.zone, leads: 0, booked: 0, lost: 0, visits: 0, calls: 0, revenue: 0, hot: 0 }));
    rows.forEach((r) => {
      const m = map.get(r.lead.assignedTcmId);
      if (!m) return;
      m.leads += 1;
      m.visits += r.visits.length;
      m.calls += r.calls.length;
      if (r.probability >= 70 && !r.booked) m.hot += 1;
      if (r.booked) {
        m.booked += 1;
        m.revenue += (r.bookings[0]?.amount ?? r.lead.budget) * 12;
      }
      if (r.status === "lost") m.lost += 1;
    });
    return [...map.values()].sort((a, b) => b.revenue - a.revenue);
  }, [tcms, rows]);

  return (
    <AdminShell title="People 360°" sub="Per-TCM performance — clicked through to lead lists">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/40"><tr className="text-left">
            <th className="p-2">TCM</th><th className="p-2">Zone</th>
            <th className="p-2 text-right">Leads</th><th className="p-2 text-right">Hot</th>
            <th className="p-2 text-right">Visits</th><th className="p-2 text-right">Calls</th>
            <th className="p-2 text-right">Booked</th><th className="p-2 text-right">Lost</th>
            <th className="p-2 text-right">₹ Closed</th><th className="p-2 text-right">Conv %</th>
          </tr></thead>
          <tbody>
            {byTcm.map((m) => (
              <tr key={m.name} className="border-t border-border">
                <td className="p-2 font-medium">{m.name}</td>
                <td className="p-2">{m.zone}</td>
                <td className="p-2 text-right">{m.leads}</td>
                <td className="p-2 text-right text-accent">{m.hot}</td>
                <td className="p-2 text-right">{m.visits}</td>
                <td className="p-2 text-right">{m.calls}</td>
                <td className="p-2 text-right text-success">{m.booked}</td>
                <td className="p-2 text-right text-destructive">{m.lost}</td>
                <td className="p-2 text-right font-mono">₹{(m.revenue / 100000).toFixed(1)}L</td>
                <td className="p-2 text-right font-mono">{m.leads ? Math.round((m.booked / m.leads) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
