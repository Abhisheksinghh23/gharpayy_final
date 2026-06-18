import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useApp } from "@/lib/store";
import { usePods, type PodRole } from "@/lib/pods/store";
import { loadHints } from "@/lib/impact/reassign";
import { toast } from "sonner";
import { UserCheck, Zap } from "lucide-react";

export function ReassignSheet({
  open, onOpenChange, leadIds,
}: { open: boolean; onOpenChange: (v: boolean) => void; leadIds: string[] }) {
  const tcms = useApp((s) => s.tcms);
  const leads = useApp((s) => s.leads);
  const reassign = useApp((s) => s.reassignLead);
  const pods = usePods((s) => s.pods);
  const [reason, setReason] = useState("");
  const [filter, setFilter] = useState("");

  const hints = useMemo(() => loadHints(tcms, leads), [tcms, leads]);
  const hintMap = useMemo(() => new Map(hints.map((h) => [h.tcmId, h])), [hints]);

  const filtered = tcms.filter((t) => !filter || t.name.toLowerCase().includes(filter.toLowerCase()));

  const apply = (tcmId: string) => {
    if (!leadIds.length) return;
    leadIds.forEach((id) => reassign(id, tcmId, reason || "Bulk reassignment"));
    toast.success(`Reassigned ${leadIds.length} lead${leadIds.length === 1 ? "" : "s"} to ${tcms.find((t) => t.id === tcmId)?.name}`);
    onOpenChange(false);
    setReason("");
  };

  const applyRole = (role: PodRole) => {
    if (!leadIds.length) return;
    let routed = 0;
    leadIds.forEach((id) => {
      const lead = leads.find((l) => l.id === id);
      if (!lead) return;
      const tcm = tcms.find((t) => t.id === lead.assignedTcmId);
      const zone = tcm?.zone.split(" · ")[0] ?? "";
      const candidates = pods
        .filter((p) => p.zone === zone)
        .flatMap((p) => p.members.filter((m) => m.podRole === role).map((m) => m.tcmId));
      if (!candidates.length) return;
      const pick = candidates.sort((a, b) => (hintMap.get(a)?.openLeads ?? 0) - (hintMap.get(b)?.openLeads ?? 0))[0];
      reassign(id, pick, `Auto-routed to ${role}`);
      routed++;
    });
    toast.success(`Auto-routed ${routed} lead${routed === 1 ? "" : "s"} to ${role}s`);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><UserCheck className="h-4 w-4" /> Reassign {leadIds.length} lead{leadIds.length === 1 ? "" : "s"}</SheetTitle>
          <SheetDescription>Pick a teammate or auto-route to the lightest-load role.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          <div className="rounded-lg border p-2.5 space-y-2">
            <div className="text-[11px] font-medium text-muted-foreground">⚡ Auto-route by role</div>
            <div className="flex gap-1.5">
              {(["scheduler", "runner", "closer"] as PodRole[]).map((r) => (
                <Button key={r} size="sm" variant="outline" className="flex-1 h-8 text-[11px]" onClick={() => applyRole(r)}>
                  <Zap className="h-3 w-3 mr-1" /> {r}
                </Button>
              ))}
            </div>
          </div>

          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for reassignment (optional)…"
            rows={2}
            className="text-xs"
          />

          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search teammate…"
            className="h-8 text-xs"
          />

          <div className="space-y-1 max-h-[40vh] overflow-y-auto">
            {filtered.map((t) => {
              const h = hintMap.get(t.id);
              const pod = pods.find((p) => p.members.some((m) => m.tcmId === t.id));
              const podRole = pod?.members.find((m) => m.tcmId === t.id)?.podRole;
              const toneBg = h?.pace === "light" ? "bg-success/10 text-success border-success/40"
                : h?.pace === "heavy" ? "bg-danger/10 text-danger border-danger/40"
                : "bg-muted text-muted-foreground";
              return (
                <button
                  key={t.id}
                  onClick={() => apply(t.id)}
                  className="w-full flex items-center justify-between gap-2 rounded-lg border bg-card hover:bg-accent p-2 text-left transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-foreground truncate">{t.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{pod?.name ?? t.zone} {podRole ? `· ${podRole}` : ""}</div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${toneBg}`}>{h?.openLeads ?? 0} open</Badge>
                </button>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
