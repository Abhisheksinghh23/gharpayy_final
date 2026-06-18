import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/admin/components/AdminShell";
import { useVisitWar } from "@/lib/visits/war-store";
import { useMemo } from "react";
import { downloadCsv } from "@/admin/lib/exporters/csv";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/visits")({ component: AdminVisits });

function AdminVisits() {
  const records = useVisitWar((s) => s.records);
  const list = useMemo(() => Object.values(records).sort((a, b) => b.scheduledAt - a.scheduledAt), [records]);

  return (
    <AdminShell title="Master Visit Console" sub={`${list.length} visits · all TCMs, all zones`}>
      <div className="rounded-xl border border-border bg-card/60 p-3 flex justify-end">
        <Button size="sm" variant="outline" onClick={() => downloadCsv(`admin-visits-${new Date().toISOString().slice(0, 10)}.csv`,
          list.map((v) => ({ lead: v.leadName, tcm: v.tcmName, property: v.propertyName, stage: v.stage, reaction: v.reaction ?? "", outcome: v.outcome ?? "", lostReason: v.lostReason ?? "", scheduled: new Date(v.scheduledAt).toISOString(), objections: v.objections.length })))}>
          CSV
        </Button>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-auto max-h-[70vh]">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 sticky top-0">
              <tr className="text-left">
                <th className="p-2">Lead</th><th className="p-2">TCM</th><th className="p-2">Property</th>
                <th className="p-2">Stage</th><th className="p-2">Reaction</th><th className="p-2">Outcome</th>
                <th className="p-2">Lost</th><th className="p-2 text-right">Obj</th><th className="p-2">Scheduled</th>
              </tr>
            </thead>
            <tbody>
              {list.map((v) => (
                <tr key={v.tourId} className="border-t border-border">
                  <td className="p-2">{v.leadName}</td><td className="p-2">{v.tcmName}</td>
                  <td className="p-2 truncate max-w-[140px]">{v.propertyName}</td>
                  <td className="p-2"><span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{v.stage}</span></td>
                  <td className="p-2">{v.reaction ?? "—"}</td><td className="p-2">{v.outcome ?? "—"}</td>
                  <td className="p-2 text-destructive">{v.lostReason ?? "—"}</td>
                  <td className="p-2 text-right font-mono">{v.objections.length}</td>
                  <td className="p-2 text-[10px]">{new Date(v.scheduledAt).toLocaleString("en-IN")}</td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">No visits.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
