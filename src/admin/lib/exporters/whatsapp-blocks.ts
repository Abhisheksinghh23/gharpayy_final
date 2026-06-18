/**
 * Admin WhatsApp copy blocks — extends impact/copy-formats with admin-level
 * summaries: per-lead, per-visit, daily digest, weekly leadership memo,
 * lost-lead post-mortem, hot-lead handoff, owner notify, coach note.
 *
 * All blocks omit agent personal names per existing rule (use office phone).
 */
import { OFFICE_PHONE } from "@/lib/impact/copy-formats";
import type { AdminLeadRow } from "@/admin/lib/selectors";

function inr(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function maskPhone(p: string) {
  const last4 = p.slice(-4);
  return `xxxxxx${last4}`;
}

export function leadSummaryBlock(row: AdminLeadRow): string {
  const l = row.lead;
  return [
    `*Lead summary*`,
    `${l.name} · ${maskPhone(l.phone)}`,
    `Stage: ${l.stage} · Prob: ${row.probability}%`,
    `Budget: ${inr(l.budget)} · Area: ${l.preferredArea}`,
    `TCM: ${row.tcm?.name ?? "—"}`,
    `Last touch: ${new Date(row.lastTouchTs).toLocaleString("en-IN")}`,
    `Why open: ${row.whyNotClosed}`,
    ``,
    `Reach us: ${OFFICE_PHONE}`,
  ].join("\n");
}

export function hotLeadHandoffBlock(row: AdminLeadRow): string {
  return [
    `🔥 *Hot lead handoff*`,
    `${row.lead.name} · ${row.probability}% probability`,
    `Budget ${inr(row.lead.budget)} · ${row.lead.preferredArea}`,
    `Next action: ${row.whyNotClosed}`,
    `Owner: ${row.tcm?.name ?? "—"} (${row.tcm?.zone ?? ""})`,
  ].join("\n");
}

export function lostPostMortemBlock(row: AdminLeadRow): string {
  const lostVisit = row.visits.find((v) => v.lostReason);
  return [
    `*Lost-lead post-mortem*`,
    `${row.lead.name} (${row.lead.stage})`,
    `Budget ${inr(row.lead.budget)} · ${row.lead.preferredArea}`,
    `Tours: ${row.tours.length} · Calls: ${row.calls.length} · Objections logged: ${row.objections.length}`,
    `Reason: ${lostVisit?.lostReason ?? row.lastObjection?.code ?? "unknown"}`,
    `Owned by: ${row.tcm?.name ?? "—"}`,
    `Recoverable? ${row.objections.some((o) => o.code === "price-too-high") ? "Maybe — try price offer" : "Low"}`,
  ].join("\n");
}

export function dailyAdminDigestBlock(rows: AdminLeadRow[]): string {
  const open = rows.filter((r) => r.status === "open");
  const hot = open.filter((r) => r.probability >= 70);
  const booked = rows.filter((r) => r.booked);
  const lost = rows.filter((r) => r.status === "lost");
  const walking = rows
    .filter((r) => r.status === "lost")
    .reduce((s, r) => s + r.lead.budget * 12, 0);
  const top3 = [...open].sort((a, b) => b.probability - a.probability).slice(0, 3);

  return [
    `📊 *Daily admin digest*`,
    `${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}`,
    ``,
    `Pipeline: ${open.length} open · ${hot.length} hot`,
    `Booked: ${booked.length} · Lost: ${lost.length}`,
    `Walking revenue: ${inr(walking)}`,
    ``,
    `*Top 3 closeable in 24h:*`,
    ...top3.map((r, i) => `${i + 1}. ${r.lead.name} — ${r.probability}% (${r.tcm?.name ?? "—"})`),
    ``,
    `Reach us: ${OFFICE_PHONE}`,
  ].join("\n");
}

export function weeklyLeadershipMemoBlock(rows: AdminLeadRow[]): string {
  const booked = rows.filter((r) => r.booked);
  const lost = rows.filter((r) => r.status === "lost");
  const revenue = booked.reduce((s, r) => s + (r.bookings[0]?.amount ?? r.lead.budget) * 12, 0);
  const walking = lost.reduce((s, r) => s + r.lead.budget * 12, 0);
  const byTcm = new Map<string, { name: string; booked: number; revenue: number }>();
  booked.forEach((r) => {
    const id = r.tcm?.id ?? "—";
    const cur = byTcm.get(id) ?? { name: r.tcm?.name ?? id, booked: 0, revenue: 0 };
    cur.booked += 1;
    cur.revenue += (r.bookings[0]?.amount ?? r.lead.budget) * 12;
    byTcm.set(id, cur);
  });
  const top = [...byTcm.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  return [
    `📈 *Weekly leadership memo*`,
    ``,
    `Bookings: ${booked.length} · Lost: ${lost.length}`,
    `Closed revenue: ${inr(revenue)}`,
    `Walking revenue: ${inr(walking)}`,
    ``,
    `*Top closers:*`,
    ...top.map((t, i) => `${i + 1}. ${t.name} — ${t.booked} booked · ${inr(t.revenue)}`),
  ].join("\n");
}

export function coachNoteBlock(row: AdminLeadRow, note: string): string {
  return [
    `🎯 *Coach note (internal)*`,
    `Lead: ${row.lead.name} · TCM: ${row.tcm?.name ?? "—"}`,
    `Stage: ${row.lead.stage} · Prob: ${row.probability}%`,
    `Note: ${note}`,
  ].join("\n");
}

export function interventionAlertBlock(row: AdminLeadRow): string {
  return [
    `🚨 *Intervention required*`,
    `${row.lead.name} flagged by admin`,
    `Stage: ${row.lead.stage} · Last touch: ${new Date(row.lastTouchTs).toLocaleString("en-IN")}`,
    `Owner: ${row.tcm?.name ?? "—"}`,
    `Why: ${row.whyNotClosed}`,
  ].join("\n");
}

export function ownerNotifyBlock(row: AdminLeadRow): string {
  return [
    `*Visit signal*`,
    `New interest in ${row.lead.preferredArea}`,
    `Budget ${inr(row.lead.budget)} · ${row.tours.length} tour(s) scheduled`,
    `Reach us: ${OFFICE_PHONE}`,
  ].join("\n");
}

export function visitBriefBlock(row: AdminLeadRow): string {
  const v = row.visits[0];
  return [
    `*Visit brief*`,
    `${row.lead.name} · ${row.lead.preferredArea}`,
    `Stage: ${v?.stage ?? "—"} · Reaction: ${v?.reaction ?? "—"}`,
    `Objections: ${v?.objections.length ?? 0}`,
    `Reach us: ${OFFICE_PHONE}`,
  ].join("\n");
}

export function revivalBlock(row: AdminLeadRow): string {
  return [
    `*Revival ping*`,
    `Hi ${row.lead.name.split(" ")[0]}, still looking for a place in ${row.lead.preferredArea}?`,
    `New options opened up in your budget (${inr(row.lead.budget)}).`,
    `Reach us: ${OFFICE_PHONE}`,
  ].join("\n");
}

export interface CopyBlock {
  key: string;
  label: string;
  text: string;
  internal?: boolean;
}

export function buildLeadCopyBlocks(row: AdminLeadRow, allRows?: AdminLeadRow[]): CopyBlock[] {
  return [
    { key: "summary", label: "Lead summary", text: leadSummaryBlock(row) },
    { key: "handoff", label: "Hot-lead handoff", text: hotLeadHandoffBlock(row), internal: true },
    { key: "visit", label: "Visit brief", text: visitBriefBlock(row) },
    { key: "revival", label: "Revival ping", text: revivalBlock(row) },
    { key: "owner-notify", label: "Owner notify", text: ownerNotifyBlock(row) },
    { key: "post-mortem", label: "Lost post-mortem", text: lostPostMortemBlock(row), internal: true },
    { key: "intervention", label: "Intervention alert", text: interventionAlertBlock(row), internal: true },
    { key: "coach", label: "Coach note", text: coachNoteBlock(row, "Reach out today and resolve objection."), internal: true },
    { key: "daily", label: "Daily digest", text: dailyAdminDigestBlock(allRows ?? [row]), internal: true },
    { key: "weekly", label: "Weekly memo", text: weeklyLeadershipMemoBlock(allRows ?? [row]), internal: true },
  ];
}
