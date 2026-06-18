import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminShell } from "@/admin/components/AdminShell";

export const Route = createFileRoute("/admin/calendar")({ component: AdminCal });

function AdminCal() {
  return (
    <AdminShell title="Master Calendar" sub="All TCMs, all events">
      <div className="rounded-xl border border-border bg-card p-6 text-sm">
        Admin view reuses the full <Link to="/calendar" className="text-accent underline">/calendar</Link> with no zone filter — open it for drag-to-reschedule, swim-lanes per TCM, and ICS export.
      </div>
    </AdminShell>
  );
}
