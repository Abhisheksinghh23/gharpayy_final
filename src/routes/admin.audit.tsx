import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/admin/components/AdminShell";
import { useAuditLog } from "@/lib/audit-log";
import { downloadCsv, downloadJson } from "@/admin/lib/exporters/csv";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export const Route = createFileRoute("/admin/audit")({ component: AdminAudit });

function AdminAudit() {
  const entries = useAuditLog((s) => s.entries);
  const [q, setQ] = useState("");
  const filtered = entries.filter((e) => !q || JSON.stringify(e).toLowerCase().includes(q.toLowerCase()));

  return (
    <AdminShell title="Audit Log" sub={`${entries.length} entries · before/after for every admin action`}>
      <div className="flex gap-2 items-center">
        <input className="h-8 px-2 rounded-md border border-border bg-card text-xs flex-1" placeholder="Search audit…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button size="sm" variant="outline" onClick={() => downloadCsv("admin-audit.csv", filtered as unknown as Array<Record<string, unknown>>)}>CSV</Button>
        <Button size="sm" variant="outline" onClick={() => downloadJson("admin-audit.json", filtered)}>JSON</Button>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-auto max-h-[70vh]">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 sticky top-0"><tr className="text-left">
              <th className="p-2">Time</th><th className="p-2">Actor</th><th className="p-2">Entity</th><th className="p-2">Action</th><th className="p-2">Summary</th>
            </tr></thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-t border-border align-top">
                  <td className="p-2 font-mono text-[10px]">{new Date(e.ts).toLocaleString("en-IN")}</td>
                  <td className="p-2">{e.actorName}</td>
                  <td className="p-2 text-[10px]">{e.entityType}:{e.entityId.slice(0, 8)}</td>
                  <td className="p-2 text-[10px]">{e.action}</td>
                  <td className="p-2">{e.summary}</td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No entries.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
