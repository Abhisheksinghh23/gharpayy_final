/**
 * XLSX exporter — lazy-imported only when the user actually exports.
 * Builds a multi-sheet workbook.
 */
import type { AdminLeadRow } from "@/admin/lib/selectors";

export async function downloadAdminWorkbook(filename: string, rows: AdminLeadRow[]) {
  const XLSX = await import("xlsx");

  const leadsSheet = rows.map((r) => ({
    Name: r.lead.name,
    Phone: r.lead.phone,
    Source: r.lead.source,
    Stage: r.lead.stage,
    TCM: r.tcm?.name ?? "",
    Zone: r.tcm?.zone ?? "",
    Area: r.lead.preferredArea,
    Budget: r.lead.budget,
    Probability: r.probability,
    ExpectedValue: r.expectedValue,
    Status: r.status,
    Tours: r.tours.length,
    Visits: r.visits.length,
    Calls: r.calls.length,
    LastObjection: r.lastObjection?.code ?? "",
    WhyNotClosed: r.whyNotClosed,
    LastTouch: new Date(r.lastTouchTs).toISOString(),
    Created: r.lead.createdAt,
  }));

  const visitsSheet = rows.flatMap((r) =>
    r.visits.map((v) => ({
      Lead: r.lead.name,
      TCM: v.tcmName,
      Property: v.propertyName,
      Stage: v.stage,
      Reaction: v.reaction ?? "",
      Outcome: v.outcome ?? "",
      LostReason: v.lostReason ?? "",
      Objections: v.objections.length,
      ScheduledAt: new Date(v.scheduledAt).toISOString(),
    })),
  );

  const objectionsSheet = rows.flatMap((r) =>
    r.objections.map((o) => ({
      Lead: r.lead.name, TCM: r.tcm?.name ?? "", Code: o.code,
      Resolution: o.resolution, Ts: o.ts, Context: o.context,
    })),
  );

  const peopleSheet = (() => {
    const byTcm = new Map<string, { name: string; zone: string; leads: number; booked: number; lost: number; revenue: number }>();
    rows.forEach((r) => {
      if (!r.tcm) return;
      const cur = byTcm.get(r.tcm.id) ?? { name: r.tcm.name, zone: r.tcm.zone, leads: 0, booked: 0, lost: 0, revenue: 0 };
      cur.leads += 1;
      if (r.booked) {
        cur.booked += 1;
        cur.revenue += (r.bookings[0]?.amount ?? r.lead.budget) * 12;
      }
      if (r.status === "lost") cur.lost += 1;
      byTcm.set(r.tcm.id, cur);
    });
    return [...byTcm.values()];
  })();

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(leadsSheet), "Leads");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(visitsSheet), "Visits");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(objectionsSheet), "Objections");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(peopleSheet), "People");
  XLSX.writeFile(wb, filename);
}
