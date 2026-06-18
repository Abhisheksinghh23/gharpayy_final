import { useMemo } from "react";
import { useCheckins, STAGE_ORDER, STAGE_LABEL, riskLevel, RISK_LABEL, RISK_CLASS, formatINR,
  type CheckInStage, type CheckIn } from "@/lib/checkins/store";
import { useApp } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw, ArrowRight } from "lucide-react";
import { useMountedNow } from "@/hooks/use-now";

export function CheckInBoard() {
  const checkins = useCheckins((s) => s.checkins);
  const setStage = useCheckins((s) => s.setStage);
  const { leads, selectLead } = useApp();
  const [, mounted] = useMountedNow();

  const byStage = useMemo(() => {
    const map: Record<CheckInStage, CheckIn[]> = {
      booked: [], ack_received: [], token_paid: [], room_assigned: [],
      date_set: [], moved_in: [], settled: [], cancelled: [],
    };
    for (const c of checkins) map[c.stage].push(c);
    return map;
  }, [checkins]);

  const atRisk = useMemo(
    () => (mounted ? checkins.filter((c) => riskLevel(c) >= 2) : []),
    [checkins, mounted],
  );

  const leadName = (id: string) => leads.find((l) => l.id === id)?.name ?? "—";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
      <div className="overflow-x-auto">
        <div className="flex gap-3 min-w-[1100px]">
          {STAGE_ORDER.map((stage) => (
            <div key={stage} className="flex-1 min-w-[160px]">
              <div className="text-xs font-semibold mb-2 flex items-center justify-between">
                <span>{STAGE_LABEL[stage]}</span>
                <Badge variant="outline" className="text-[10px]">{byStage[stage].length}</Badge>
              </div>
              <div className="space-y-2">
                {byStage[stage].map((c) => {
                  const r = mounted ? riskLevel(c) : 0;
                  const nextIdx = STAGE_ORDER.indexOf(stage) + 1;
                  const next = STAGE_ORDER[nextIdx];
                  return (
                    <div key={c.id}
                      className="rounded-lg border border-border bg-card p-2.5 space-y-1.5 hover:border-primary/40 cursor-pointer"
                      onClick={() => selectLead(c.leadId)}
                    >
                      <div className="text-xs font-medium truncate">{leadName(c.leadId)}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {c.propertyName ?? "No property"}{c.roomNumber ? ` · ${c.roomNumber}` : ""}
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        <Badge variant="outline" className={`text-[9px] ${RISK_CLASS[r]}`}>{RISK_LABEL[r]}</Badge>
                        {c.delays.length > 0 && (
                          <span className="text-[10px] text-orange-600 inline-flex items-center gap-0.5">
                            <RotateCcw className="h-2.5 w-2.5" />{c.delays.length}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Bal {formatINR(c.balanceDue)}</div>
                      {next && (
                        <Button
                          size="sm" variant="ghost"
                          className="h-6 w-full text-[10px]"
                          onClick={(e) => { e.stopPropagation(); setStage(c.id, next); }}
                        >
                          <ArrowRight className="h-3 w-3 mr-1" /> {STAGE_LABEL[next]}
                        </Button>
                      )}
                    </div>
                  );
                })}
                {byStage[stage].length === 0 && (
                  <div className="text-[10px] text-muted-foreground italic px-1 py-2">—</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk lane */}
      <div className="space-y-2">
        <div className="text-xs font-semibold flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5 text-orange-500" /> At-risk lane
        </div>
        {atRisk.length === 0 && (
          <div className="text-[11px] text-muted-foreground italic">Nothing at risk. 🎉</div>
        )}
        {atRisk.map((c) => {
          const r = mounted ? riskLevel(c) : 0;
          return (
            <div key={c.id}
              className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-2.5 space-y-1 cursor-pointer hover:border-orange-500/60"
              onClick={() => selectLead(c.leadId)}
            >
              <div className="text-xs font-medium">{leadName(c.leadId)}</div>
              <div className="text-[10px] text-muted-foreground">
                {STAGE_LABEL[c.stage]} · {c.delays.length} reschedule(s)
              </div>
              <Badge variant="outline" className={`text-[9px] ${RISK_CLASS[r]}`}>{RISK_LABEL[r]}</Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}
