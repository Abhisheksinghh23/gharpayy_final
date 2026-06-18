import { useMemo, useState } from "react";
import { useSelection } from "@/lib/impact/selection";
import { useSnoozes } from "@/lib/impact/snoozes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserCheck, Moon, Flag, X, FileDown } from "lucide-react";
import { ReassignSheet } from "./ReassignSheet";
import { FinalOutcomeDialog } from "./FinalOutcomeDialog";
import { toast } from "sonner";
import { useApp } from "@/lib/store";

export function BulkActionBar() {
  const idSet = useSelection((s) => s.ids);
  const ids = useMemo(() => Array.from(idSet), [idSet]);
  const clear = useSelection((s) => s.clear);
  const snooze = useSnoozes((s) => s.snooze);
  const leads = useApp((s) => s.leads);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [outcomeOpen, setOutcomeOpen] = useState(false);

  if (!ids.length) return null;

  const snoozeAll = (days: number) => {
    const d = new Date(); d.setDate(d.getDate() + days); d.setHours(9, 0, 0, 0);
    ids.forEach((id) => snooze(id, d.toISOString()));
    toast.success(`Snoozed ${ids.length} lead${ids.length === 1 ? "" : "s"} for ${days} days`);
    clear();
  };

  const exportCsv = () => {
    const rows = leads.filter((l) => ids.includes(l.id));
    const csv = [
      ["Name", "Phone", "Stage", "Intent", "Area", "Budget", "Move-in", "Source"].join(","),
      ...rows.map((l) => [l.name, l.phone, l.stage, l.intent, l.preferredArea, l.budget, l.moveInDate, l.source].map((v) => `"${v ?? ""}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `leads-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} leads`);
  };

  return (
    <>
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 rounded-xl border bg-card/95 backdrop-blur shadow-lg px-3 py-2 flex items-center gap-2">
        <Badge className="text-[11px]">{ids.length} selected</Badge>
        <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => setReassignOpen(true)}>
          <UserCheck className="h-3 w-3" /> Reassign
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => snoozeAll(14)}>
          <Moon className="h-3 w-3" /> Snooze 14d
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => setOutcomeOpen(true)}>
          <Flag className="h-3 w-3" /> Final outcome
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={exportCsv}>
          <FileDown className="h-3 w-3" /> CSV
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={clear}>
          <X className="h-3 w-3" />
        </Button>
      </div>
      <ReassignSheet open={reassignOpen} onOpenChange={setReassignOpen} leadIds={ids} />
      <FinalOutcomeDialog open={outcomeOpen} onOpenChange={setOutcomeOpen} leadIds={ids} />
    </>
  );
}
