import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { ConfidenceBar, IntentChip, StageBadge } from "@/components/atoms";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import type { LeadStage } from "@/lib/types";
import { useMountedNow } from "@/hooks/use-now";
import { exportToCSV } from "@/lib/export";
import { Download, Trash2, CheckCircle2, Users, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/leads")({
  head: () => ({
    meta: [{ title: "Leads — Gharpayy" }, { name: "description", content: "Every lead, ranked by deal probability, one click into the control panel." }],
  }),
  component: LeadsPage,
});

function LeadsPage() {
  const { leads, tcms, selectLead } = useApp();
  const [, mounted] = useMountedNow();
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"confidence" | "moveIn" | "updated">("confidence");

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const list = leads.filter((l) => {
      if (q && !l.name.toLowerCase().includes(q.toLowerCase()) && !l.phone.includes(q)) return false;
      if (stage !== "all" && l.stage !== stage) return false;
      return true;
    });
    list.sort((a, b) => {
      if (sortBy === "confidence") return b.confidence - a.confidence;
      if (sortBy === "moveIn") return +new Date(a.moveInDate) - +new Date(b.moveInDate);
      return +new Date(b.updatedAt) - +new Date(a.updatedAt);
    });
    return list;
  }, [leads, q, stage, sortBy]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((l) => l.id));
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleExport = () => {
    const csvData = filtered.map((l) => {
      const tcm = tcms.find((t) => t.id === l.assignedTcmId);
      return {
        id: l.id,
        name: l.name,
        phone: l.phone,
        source: l.source,
        stage: l.stage,
        intent: l.intent,
        confidence: l.confidence,
        preferredArea: l.preferredArea,
        budget: l.budget,
        assignedTcm: tcm?.name ?? "Unassigned",
        moveInDate: l.moveInDate,
        createdAt: l.createdAt,
      };
    });
    
    exportToCSV(csvData, "gharpayy_leads_export", [
      "Lead ID", "Name", "Phone Number", "Source", "Current Stage",
      "Intent Level", "Deal Confidence %", "Preferred Area", "Monthly Budget (₹)",
      "Assigned Agent", "Target Move-in", "Created Timestamp"
    ]);
    toast.success(`Successfully exported ${filtered.length} leads to CSV`);
  };

  const handleBulkDelete = () => {
    if (!confirm(`Are you sure you want to delete the ${selectedIds.length} selected leads?`)) return;
    useApp.setState((s) => ({
      leads: s.leads.filter((l) => !selectedIds.includes(l.id))
    }));
    toast.success(`Successfully deleted ${selectedIds.length} leads`);
    setSelectedIds([]);
  };

  const handleBulkStageChange = (newStage: LeadStage) => {
    useApp.setState((s) => ({
      leads: s.leads.map((l) =>
        selectedIds.includes(l.id)
          ? { ...l, stage: newStage, updatedAt: new Date().toISOString() }
          : l
      ),
    }));
    toast.success(`Updated stage to "${newStage}" for ${selectedIds.length} leads`);
    setSelectedIds([]);
  };

  const handleBulkAssign = (tcmId: string) => {
    const tcmName = tcms.find((t) => t.id === tcmId)?.name ?? "TCM";
    useApp.setState((s) => ({
      leads: s.leads.map((l) =>
        selectedIds.includes(l.id)
          ? { ...l, assignedTcmId: tcmId, updatedAt: new Date().toISOString() }
          : l
      ),
    }));
    toast.success(`Reassigned ${selectedIds.length} leads to agent ${tcmName}`);
    setSelectedIds([]);
  };

  return (
    <AppShell>
      <div className="space-y-4">
        <header className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Leads</h1>
            <p className="text-sm text-muted-foreground">{filtered.length} of {leads.length} · ranked by deal probability</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or phone…" className="h-9 w-48 text-sm bg-card" />
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger className="h-9 w-36 text-sm bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {(["new","contacted","tour-scheduled","tour-done","negotiation","booked","dropped"] as LeadStage[]).map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s.replace("-", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="h-9 w-36 text-sm bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="confidence">Sort: Confidence</SelectItem>
                <SelectItem value="moveIn">Sort: Move-in date</SelectItem>
                <SelectItem value="updated">Sort: Last updated</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleExport} className="h-9 gap-1 text-xs">
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          </div>
        </header>

        <div className="rounded-xl border border-border bg-card overflow-hidden relative">
          <div className="grid grid-cols-12 px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border bg-muted/40 items-center">
            <div className="col-span-1 flex items-center gap-2">
              <input
                type="checkbox"
                checked={filtered.length > 0 && selectedIds.length === filtered.length}
                onChange={toggleSelectAll}
                className="rounded border-border text-accent focus:ring-accent accent-accent h-3.5 w-3.5 cursor-pointer"
              />
            </div>
            <div className="col-span-3">Lead</div>
            <div className="col-span-2">Stage</div>
            <div className="col-span-2">Intent · score</div>
            <div className="col-span-1">Area · budget</div>
            <div className="col-span-2">Assigned</div>
            <div className="col-span-1 text-right">Updated</div>
          </div>
          
          <div className="divide-y divide-border">
            {filtered.map((l) => {
              const tcm = tcms.find((t) => t.id === l.assignedTcmId);
              const isSelected = selectedIds.includes(l.id);
              return (
                <div 
                  key={l.id} 
                  onClick={() => selectLead(l.id)}
                  className={`w-full text-left grid grid-cols-12 px-4 py-3 items-center hover:bg-accent/5 transition-colors cursor-pointer ${isSelected ? 'bg-accent/5' : ''}`}
                >
                  <div className="col-span-1 flex items-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => toggleSelect(l.id, e as any)}
                      className="rounded border-border text-accent focus:ring-accent accent-accent h-3.5 w-3.5 cursor-pointer"
                    />
                  </div>
                  <div className="col-span-3">
                    <div className="font-medium text-sm text-foreground">{l.name}</div>
                    <div className="text-[11px] text-muted-foreground">{l.phone} · {l.source}</div>
                  </div>
                  <div className="col-span-2"><StageBadge stage={l.stage} /></div>
                  <div className="col-span-2 flex items-center gap-2">
                    <IntentChip intent={l.intent} />
                    <ConfidenceBar value={l.confidence} />
                  </div>
                  <div className="col-span-1 text-xs text-foreground/90">
                    <div>{l.preferredArea}</div>
                    <div className="text-muted-foreground font-mono">₹{(l.budget / 1000).toFixed(0)}k</div>
                  </div>
                  <div className="col-span-2 text-xs">
                    <div className="text-foreground">{tcm?.name ?? "—"}</div>
                    <div className="text-muted-foreground">{tcm?.zone ?? "—"}</div>
                  </div>
                  <div className="col-span-1 text-right text-[11px] text-muted-foreground">
                    {mounted ? formatDistanceToNow(new Date(l.updatedAt), { addSuffix: true }) : "—"}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-sm text-muted-foreground">No leads match.</div>
            )}
          </div>
        </div>

        {/* Floating Bulk Actions Panel */}
        {selectedIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-border shadow-2xl rounded-xl px-5 py-3 flex items-center gap-4 animate-slide-up max-w-[90vw]">
            <div className="text-xs font-semibold text-foreground whitespace-nowrap">
              {selectedIds.length} lead{selectedIds.length > 1 ? "s" : ""} selected
            </div>
            
            <div className="h-4 w-px bg-border shrink-0" />
            
            <div className="flex items-center gap-2 flex-wrap">
              {/* Bulk Stage trigger */}
              <Select onValueChange={(v) => handleBulkStageChange(v as LeadStage)}>
                <SelectTrigger className="h-8 text-[11px] w-28 bg-background border-border shrink-0">
                  <CheckCircle2 className="h-3 w-3 mr-1 text-muted-foreground" />
                  <span>Update Stage</span>
                </SelectTrigger>
                <SelectContent>
                  {(["new","contacted","tour-scheduled","tour-done","negotiation","booked","dropped"] as LeadStage[]).map((s) => (
                    <SelectItem key={s} value={s} className="text-xs capitalize">{s.replace("-", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Bulk Assign trigger */}
              <Select onValueChange={handleBulkAssign}>
                <SelectTrigger className="h-8 text-[11px] w-28 bg-background border-border shrink-0">
                  <Users className="h-3 w-3 mr-1 text-muted-foreground" />
                  <span>Assign Agent</span>
                </SelectTrigger>
                <SelectContent>
                  {tcms.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Bulk Delete */}
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleBulkDelete}
                className="h-8 text-xs gap-1 px-2.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </Button>

              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedIds([])}
                className="h-8 text-xs text-muted-foreground px-2"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

