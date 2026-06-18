import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Clock } from "lucide-react";
import { SNOOZE_PRESETS, useSnoozes } from "@/lib/impact/snoozes";
import { toast } from "sonner";

export function SnoozeMenu({ leadId, leadName, compact }: { leadId: string; leadName?: string; compact?: boolean }) {
  const snooze = useSnoozes((s) => s.snooze);
  const unsnooze = useSnoozes((s) => s.unsnooze);
  const isSnoozed = useSnoozes((s) => !!s.until[leadId] && +new Date(s.until[leadId]) > Date.now());

  const apply = (untilIso: string, label: string) => {
    snooze(leadId, untilIso);
    toast.success(`Snoozed${leadName ? ` ${leadName}` : ""} · ${label}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant={isSnoozed ? "secondary" : "ghost"}
          className={`h-7 ${compact ? "px-2" : ""} text-[10px] gap-1`}
        >
          <Clock className="h-3 w-3" />
          {isSnoozed ? "Snoozed" : "Snooze"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {SNOOZE_PRESETS.map((p) => (
          <DropdownMenuItem
            key={p.label}
            className="text-xs"
            onClick={() => {
              const iso = "at" in p ? p.at() : new Date(Date.now() + p.ms).toISOString();
              apply(iso, p.label);
            }}
          >
            {p.label}
          </DropdownMenuItem>
        ))}
        {isSnoozed && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-xs text-danger"
              onClick={() => { unsnooze(leadId); toast("Snooze cleared"); }}
            >
              Clear snooze
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
