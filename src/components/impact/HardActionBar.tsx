import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { useQuotations } from "@/lib/crm10x/quotations";
import { useSnoozes } from "@/lib/impact/snoozes";
import { scoreLead, computeNBA } from "@/lib/crm10x/impact-scoring";
import type { Lead, Tour } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus, Flame, Calendar as CalendarIcon, FileText, Handshake, Home,
  CheckCircle2, RotateCcw, ChevronDown, Phone, MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { LeadActionDialog, type LeadActionVerb } from "./LeadActionDialog";

type Verb = "add" | "call" | "schedule" | "quote" | "negotiate" | "book" | "checkin" | "revive";

interface ActionDef {
  verb: Verb;
  label: string;
  short: string;
  icon: typeof Plus;
  tier: "now" | "today" | "soon" | "later" | "won" | "neutral";
  pick: (lead: Lead) => boolean;
}

const ACTIONS: ActionDef[] = [
  { verb: "add", label: "Add lead", short: "Add", icon: Plus, tier: "neutral", pick: () => false },
  { verb: "call",     label: "Call HOT now",  short: "Call HOT",  icon: Flame,         tier: "now",
    pick: (l) => l.intent === "hot" && (l.stage === "new" || l.stage === "contacted") },
  { verb: "schedule", label: "Schedule tour", short: "Schedule",  icon: CalendarIcon,  tier: "today",
    pick: (l) => l.stage === "new" || l.stage === "contacted" },
  { verb: "quote",    label: "Send quote",    short: "Quote",     icon: FileText,      tier: "today",
    pick: (l) => l.stage === "tour-done" },
  { verb: "negotiate",label: "Negotiate",     short: "Negotiate", icon: Handshake,     tier: "now",
    pick: (l) => l.stage === "negotiation" },
  { verb: "book",     label: "Book room",     short: "Book",      icon: Home,          tier: "won",
    pick: (l) => l.stage === "negotiation" || l.stage === "tour-done" },
  { verb: "checkin",  label: "Check-in ops",  short: "Check-in",  icon: CheckCircle2,  tier: "won",
    pick: (l) => l.stage === "booked" },
  { verb: "revive",   label: "Revive",        short: "Revive",    icon: RotateCcw,     tier: "later",
    pick: (l) => l.stage === "dropped" },
];

const tierStyle: Record<ActionDef["tier"], string> = {
  now:     "bg-do-now/10 border-do-now/40 text-do-now hover:bg-do-now/20 ring-1 ring-do-now/30",
  today:   "bg-do-today/10 border-do-today/40 text-do-today hover:bg-do-today/20",
  soon:    "bg-do-soon/10 border-do-soon/40 text-do-soon hover:bg-do-soon/20",
  later:   "bg-do-later/10 border-do-later/40 text-foreground hover:bg-do-later/20",
  won:     "bg-won/10 border-won/40 text-won hover:bg-won/20",
  neutral: "bg-accent text-accent-foreground hover:bg-accent/90 border-accent",
};

export function HardActionBar({ onAddLead }: { onAddLead?: () => void }) {
  const { leads, tours, selectLead } = useApp();
  const quotes = useQuotations((s) => s.quotations);
  const snoozeUntil = useSnoozes((s) => s.until);
  // SSR must compute deterministic ranking — start at 0, hydrate on mount.
  const [nowMs, setNowMs] = useState(0);
  useEffect(() => { setNowMs(Date.now()); }, []);
  const [dialog, setDialog] = useState<{ verb: LeadActionVerb; leadId: string } | null>(null);

  const ranked = useMemo(() => {
    return leads
      .filter((l) => {
        const u = snoozeUntil[l.id];
        return !u || +new Date(u) <= nowMs;
      })
      .map((lead) => {
        const ts = tours.filter((t) => t.leadId === lead.id);
        const openTour = ts.find((t) => t.status === "scheduled");
        const lastQuote = quotes
          .filter((q) => q.leadId === lead.id)
          .sort((a, b) => +new Date(b.sentAt) - +new Date(a.sentAt))[0];
        const { score } = scoreLead(lead, openTour, lastQuote);
        const nba = computeNBA(lead, openTour, lastQuote);
        return { lead, openTour, lastQuote, score, nba };
      });
  }, [leads, tours, quotes, snoozeUntil, nowMs]);

  const candidatesFor = (a: ActionDef) =>
    ranked.filter((r) => a.pick(r.lead)).sort((a, b) => b.score - a.score).slice(0, 5);

  const handleAct = (verb: Verb, lead: Lead, _openTour?: Tour) => {
    selectLead(lead.id);
    if (verb === "revive") {
      const msg = encodeURIComponent(`Hi ${lead.name.split(" ")[0]}, still searching? I have new options that just opened up.`);
      window.open(`https://wa.me/${lead.phone.replace(/\D/g, "")}?text=${msg}`, "_blank", "noopener");
      toast.success(`Revive sent → ${lead.name.split(" ")[0]}`);
      return;
    }
    // Every property-aware verb opens the property picker dialog so the TCM
    // can see all best-fit properties + direct Book / Schedule / Quote /
    // Negotiate / Check-in / Log call on every row.
    if (verb === "call" || verb === "schedule" || verb === "quote" ||
        verb === "negotiate" || verb === "book" || verb === "checkin") {
      setDialog({ verb, leadId: lead.id });
      return;
    }
  };

  const dialogLead = dialog ? leads.find((l) => l.id === dialog.leadId) ?? null : null;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="sticky top-0 z-30 -mx-1 px-1 py-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold pr-1">
            Hard actions
          </span>
          {ACTIONS.map((a) => {
            if (a.verb === "add") {
              return (
                <Button
                  key={a.verb}
                  size="sm"
                  className={`h-8 text-xs gap-1.5 border ${tierStyle.neutral}`}
                  onClick={onAddLead}
                >
                  <a.icon className="h-3.5 w-3.5" />
                  {a.short}
                </Button>
              );
            }
            const cands = candidatesFor(a);
            const top = cands[0];
            const disabled = !top;
            const Icon = a.icon;

            return (
              <div key={a.verb} className="flex">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={disabled}
                      className={`h-8 text-xs gap-1.5 border rounded-r-none ${disabled ? "opacity-50" : tierStyle[a.tier]} ${a.tier === "now" && !disabled ? "animate-pulse" : ""}`}
                      onClick={() => top && handleAct(a.verb, top.lead, top.openTour)}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{a.short}</span>
                      {top && (
                        <span className="text-[10px] font-mono opacity-70 hidden md:inline">
                          · {top.lead.name.split(" ")[0]}
                        </span>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {disabled ? `${a.label} — no candidate right now` : `${a.label} → ${top!.lead.name}`}
                  </TooltipContent>
                </Tooltip>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={disabled}
                      className={`h-8 px-1 border-l-0 rounded-l-none border ${disabled ? "opacity-50" : tierStyle[a.tier]}`}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Next {Math.min(cands.length, 5)} candidates
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {cands.length === 0 && (
                      <div className="px-2 py-3 text-xs text-muted-foreground">
                        No leads match this action right now.
                      </div>
                    )}
                    {cands.map((c) => (
                      <DropdownMenuItem
                        key={c.lead.id}
                        className="text-xs flex items-center gap-2"
                        onClick={() => handleAct(a.verb, c.lead, c.openTour)}
                      >
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span className="flex-1 truncate">{c.lead.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{Math.round(c.score)}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      </div>
      <LeadActionDialog
        open={!!dialog}
        onOpenChange={(v) => !v && setDialog(null)}
        lead={dialogLead}
        verb={dialog?.verb ?? "schedule"}
      />
    </TooltipProvider>
  );
}
