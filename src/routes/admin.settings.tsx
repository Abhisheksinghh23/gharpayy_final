import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/admin/components/AdminShell";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/types";

export const Route = createFileRoute("/admin/settings")({ component: AdminSettings });

function AdminSettings() {
  const { role, setRole } = useApp();
  return (
    <AdminShell title="Admin Settings" sub="Local-only toggles · no backend">
      <div className="rounded-xl border border-border bg-card p-4 space-y-3 max-w-lg">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Switch out of Admin</div>
          <div className="flex gap-2 flex-wrap">
            {(["hr", "flow-ops", "tcm", "owner"] as Role[]).map((r) => (
              <Button key={r} size="sm" variant={role === r ? "default" : "outline"} onClick={() => setRole(r)}>{r}</Button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Saved views</div>
          <Button size="sm" variant="outline" onClick={() => { localStorage.removeItem("admin.views"); location.reload(); }}>Clear saved views</Button>
        </div>
        <div className="text-[11px] text-muted-foreground">
          Admin role is local-only in this build. All admin actions are written to the audit log and can be undone within 10s.
        </div>
      </div>
    </AdminShell>
  );
}
