import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminShell } from "@/admin/components/AdminShell";
import { useApp } from "@/lib/store";
import { downloadCsv } from "@/admin/lib/exporters/csv";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/owners")({ component: AdminOwners });

function AdminOwners() {
  const { properties } = useApp();
  return (
    <AdminShell title="Master Owner Console" sub={`${properties.length} properties · full visibility`}>
      <div className="rounded-xl border border-border bg-card/60 p-3 flex justify-end">
        <Button size="sm" variant="outline" onClick={() => downloadCsv(`admin-owners-${new Date().toISOString().slice(0, 10)}.csv`, properties as unknown as Array<Record<string, unknown>>)}>CSV</Button>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/40"><tr className="text-left">
            <th className="p-2">Property</th><th className="p-2">Area</th>
            <th className="p-2 text-right">Beds</th><th className="p-2 text-right">Vacant</th>
            <th className="p-2 text-right">₹/bed</th><th className="p-2 text-right">Days since booking</th>
            <th className="p-2">Open</th>
          </tr></thead>
          <tbody>
            {properties.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="p-2 font-medium">{p.name}</td>
                <td className="p-2">{p.area}</td>
                <td className="p-2 text-right">{p.totalBeds}</td>
                <td className="p-2 text-right font-mono">{p.vacantBeds}</td>
                <td className="p-2 text-right">₹{p.pricePerBed.toLocaleString("en-IN")}</td>
                <td className="p-2 text-right text-muted-foreground">{p.daysSinceLastBooking}d</td>
                <td className="p-2"><Link to="/owner-portal" className="text-accent underline">Impersonate</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
