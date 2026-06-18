import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { useSnoozes } from "@/lib/impact/snoozes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Phone, MessageSquare, RotateCcw } from "lucide-react";
import { SnoozeMenu } from "./SnoozeMenu";
import { toast } from "sonner";
import { useMountedNow } from "@/hooks/use-now";

type Bucket = "overdue" | "now" | "today" | "tomorrow" | "week" | "later";
const BUCKET_META: Record<Bucket, { label: string; tone: string }> = {
  overdue:  { label: "Overdue",   tone: "border-do-now/40 bg-do-now/5 text-do-now" },
  now:      { label: "Due now",   tone: "border-do-now/40 bg-do-now/10 text-do-now" },
  today:    { label: "Today",     tone: "border-do-today/40 bg-do-today/5 text-do-today" },
  tomorrow: { label: "Tomorrow",  tone: "border-do-soon/40 bg-do-soon/5 text-do-soon" },
  week:     { label: "This week", tone: "border-do-soon/40 bg-do-soon/5 text-do-soon" },
  later:    { label: "Later",     tone: "border-do-later/40 bg-do-later/5 text-foreground" },
};

function bucketFor(dueAtMs: number, nowMs: number): Bucket {
  const diff = dueAtMs - nowMs;
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  if (diff < 0) return "overdue";
  if (diff < hour) return "now";
  if (diff < day && new Date(dueAtMs).toDateString() === new Date(nowMs).toDateString()) return "today";
  const tom = new Date(nowMs); tom.setDate(tom.getDate() + 1);
  if (new Date(dueAtMs).toDateString() === tom.toDateString()) return "tomorrow";
  if (diff < 7 * day) return "week";
  return "later";
}

export function FollowUpQueueTab() {
  const { leads, followUps, completeFollowUp } = useApp();
  const snoozeUntil = useSnoozes((s) => s.until);
  const [now, mounted] = useMountedNow(30_000);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rows = useMemo(() => {
    if (!mounted) return [];
    return followUps
      .filter((f) => !f.done)
      .map((f) => {
        const lead = leads.find((l) => l.id === f.leadId);
        if (!lead) return null;
        const u = snoozeUntil[lead.id];
        if (u && +new Date(u) > now) return null;
        return { f, lead, bucket: bucketFor(+new Date(f.dueAt), now) };
      })
      .filter(Boolean) as { f: typeof followUps[number]; lead: typeof leads[number]; bucket: Bucket }[];
  }, [followUps, leads, snoozeUntil, now, mounted]);

  const grouped = useMemo(() => {
    const g: Record<Bucket, typeof rows> = {
      overdue: [], now: [], today: [], tomorrow: [], week: [], later: [],
    };
    rows.forEach((r) => g[r.bucket].push(r));
    Object.values(g).forEach((arr) => arr.sort((a, b) => +new Date(a.f.dueAt) - +new Date(b.f.dueAt)));
    return g;
  }, [rows]);

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const bulkDone = () => {
    selected.forEach((id) => completeFollowUp(id));
    toast.success(`${selected.size} follow-up(s) marked done`);
    setSelected(new Set());
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">
        No follow-ups pending. 🌱
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-accent/40 bg-accent/5 px-3 py-2">
          <span className="text-xs font-semibold">{selected.size} selected</span>
          <Button size="sm" className="h-7 text-xs gap-1" onClick={bulkDone}>
            <CheckCircle2 className="h-3 w-3" /> Mark done
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {(Object.keys(BUCKET_META) as Bucket[]).map((b) => {
        const items = grouped[b];
        if (items.length === 0) return null;
        const meta = BUCKET_META[b];
        return (
          <section key={b}>
            <div className={`text-[10px] uppercase tracking-[0.2em] font-semibold mb-1.5 inline-flex items-center gap-2 px-2 py-0.5 rounded border ${meta.tone}`}>
              <Clock className="h-3 w-3" /> {meta.label}
              <span className="opacity-60 font-mono">{items.length}</span>
            </div>
            <ul className="space-y-1.5">
              {items.map(({ f, lead }) => (
                <li
                  key={f.id}
                  className="flex items-center gap-2 rounded-md border bg-card px-3 py-2"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(f.id)}
                    onChange={() => toggle(f.id)}
                    className="h-3.5 w-3.5 accent-accent"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-semibold truncate">{lead.name}</span>
                      <Badge variant="outline" className="text-[9px] uppercase">{lead.intent}</Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {f.reason} · due {new Date(f.dueAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                    </div>
                  </div>
                  <Button
                    size="sm" variant="ghost" className="h-7 text-[10px] gap-1"
                    onClick={() => {
                      const msg = encodeURIComponent(`Hi ${lead.name.split(" ")[0]}, ${f.reason}`);
                      window.open(`https://wa.me/${lead.phone.replace(/\D/g, "")}?text=${msg}`, "_blank", "noopener");
                    }}>
                    <MessageSquare className="h-3 w-3" /> WA
                  </Button>
                  <Button
                    size="sm" variant="ghost" className="h-7 text-[10px] gap-1"
                    onClick={() => window.open(`tel:${lead.phone}`, "_self")}>
                    <Phone className="h-3 w-3" /> Call
                  </Button>
                  <SnoozeMenu leadId={lead.id} leadName={lead.name} compact />
                  <Button
                    size="sm" className="h-7 text-[10px] gap-1"
                    onClick={() => { completeFollowUp(f.id); toast.success("Done"); }}>
                    <CheckCircle2 className="h-3 w-3" /> Done
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
