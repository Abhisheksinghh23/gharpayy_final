import { useATC, type TimelineKind } from "@/lib/atc/store";
import {
  ClipboardList, Search, CalendarCheck2, CheckCheck, Star, Lock, Unlock,
  AlarmClockOff, IndianRupee, ShieldCheck, UserCheck, PartyPopper, DoorOpen, StickyNote,
} from "lucide-react";

const ICONS: Record<TimelineKind, React.ComponentType<{ className?: string }>> = {
  requirement: ClipboardList,
  matched: Search,
  "visit-scheduled": CalendarCheck2,
  "visit-done": CheckCheck,
  shortlisted: Star,
  "hold-created": Lock,
  "hold-released": Unlock,
  "hold-expired": AlarmClockOff,
  "payment-initiated": IndianRupee,
  "team-ack": ShieldCheck,
  "owner-ack": UserCheck,
  "booking-confirmed": PartyPopper,
  "check-in": DoorOpen,
  note: StickyNote,
};

const TONE: Partial<Record<TimelineKind, string>> = {
  "hold-expired": "text-do-now",
  "hold-released": "text-muted-foreground",
  "booking-confirmed": "text-won",
  "check-in": "text-won",
  "owner-ack": "text-won",
};

export function TenantTimeline({ leadId, max = 25 }: { leadId: string; max?: number }) {
  const { events } = useATC();
  const list = events.filter((e) => e.leadId === leadId).slice(0, max);
  if (list.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic px-2 py-4 text-center">
        No timeline events yet. Actions taken in the Impact Queue land here automatically.
      </div>
    );
  }
  return (
    <ol className="relative border-l border-border/60 ml-2 space-y-3 py-1">
      {list.map((e) => {
        const Icon = ICONS[e.kind] ?? StickyNote;
        const tone = TONE[e.kind] ?? "text-foreground";
        return (
          <li key={e.id} className="ml-3 pl-2">
            <span className="absolute -left-[7px] mt-1 flex h-3 w-3 items-center justify-center rounded-full bg-background border border-border">
              <Icon className={`h-2.5 w-2.5 ${tone}`} />
            </span>
            <div className={`text-xs font-medium ${tone}`}>{e.text}</div>
            <div className="text-[10px] text-muted-foreground">
              {new Date(e.ts).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
