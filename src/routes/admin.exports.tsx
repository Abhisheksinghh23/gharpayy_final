import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/admin/components/AdminShell";
import { useAdminRows } from "@/admin/lib/use-admin-rows";
import { Button } from "@/components/ui/button";
import { downloadCsv, downloadJson } from "@/admin/lib/exporters/csv";
import { downloadAdminWorkbook } from "@/admin/lib/exporters/xlsx";
import { downloadAdminPdf } from "@/admin/lib/exporters/pdf";
import { CopyChipRail } from "@/admin/components/CopyChipRail";
import { buildLeadCopyBlocks } from "@/admin/lib/exporters/whatsapp-blocks";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/exports")({ component: AdminExports });

function AdminExports() {
  const rows = useAdminRows();
  const stamp = new Date().toISOString().slice(0, 10);

  const csv = () => downloadCsv(`admin-leads-${stamp}.csv`, rows.map((r) => ({
    name: r.lead.name, phone: r.lead.phone, stage: r.lead.stage, tcm: r.tcm?.name ?? "",
    probability: r.probability, expectedValue: r.expectedValue, status: r.status,
    whyNotClosed: r.whyNotClosed, lastTouch: new Date(r.lastTouchTs).toISOString(),
  })));

  return (
    <AdminShell title="Export Center" sub="Single source of truth · always the live filtered set">
      <div className="grid md:grid-cols-2 gap-3">
        <Card title="CSV" desc="Flat sheet — leads + derived stats.">
          <Button size="sm" onClick={csv}>Download CSV</Button>
        </Card>
        <Card title="XLSX workbook" desc="Multi-sheet — Leads · Visits · Objections · People.">
          <Button size="sm" onClick={() => downloadAdminWorkbook(`admin-${stamp}.xlsx`, rows).catch(() => toast.error("XLSX failed"))}>Download XLSX</Button>
        </Card>
        <Card title="PDF report" desc="Branded admin report: KPIs · Why · top closeable.">
          <Button size="sm" onClick={() => downloadAdminPdf(`admin-report-${stamp}.pdf`, rows).catch(() => toast.error("PDF failed"))}>Download PDF</Button>
        </Card>
        <Card title="JSON" desc="Raw structured export for external tooling.">
          <Button size="sm" onClick={() => downloadJson(`admin-${stamp}.json`, rows)}>Download JSON</Button>
        </Card>
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">WhatsApp copy blocks</div>
        <CopyChipRail blocks={rows.length ? buildLeadCopyBlocks(rows[0], rows) : []} />
      </div>
    </AdminShell>
  );
}

function Card({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="font-display font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground">{desc}</div>
      {children}
    </div>
  );
}
