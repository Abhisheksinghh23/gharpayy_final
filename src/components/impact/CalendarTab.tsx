import { useMemo } from "react";
import { useApp } from "@/lib/store";
import { useTasks } from "@/lib/impact/tasks";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Clock, Phone, FileText, Home } from "lucide-react";
import { useMountedNow } from "@/hooks/use-now";

type AgendaItem = {
  id: string;
  when: string;
  title: string;
  sub: string;
  tone: string;
  icon: typeof CalendarIcon;
};

export function CalendarTab() {
  const { tours, followUps, leads, properties } = useApp();
  const tasks = useTasks((s) => s.tasks);
  const [now, mounted] = useMountedNow(60_000);

  const items: AgendaItem[] = useMemo(() => {
    if (!mounted) return [];
    const all: AgendaItem[] = [];
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
    const windowEnd = +dayStart + 14 * 24 * 60 * 60 * 1000;

    tours.forEach((t) => {
      const at = +new Date(t.scheduledAt);
      if (at < +dayStart || at > windowEnd || t.status !== "scheduled") return;
      const lead = leads.find((l) => l.id === t.leadId);
      const prop = properties.find((p) => p.id === t.propertyId);
      all.push({
        id: `tour-${t.id}`, when: t.scheduledAt,
        title: `Tour · ${lead?.name ?? "Lead"}`,
        sub: `${prop?.name ?? "Property"} · ${prop?.area ?? ""}`,
        tone: "border-l-do-soon bg-do-soon/5 text-do-soon",
        icon: Home,
      });
    });
    followUps.forEach((f) => {
      const at = +new Date(f.dueAt);
      if (at < +dayStart || at > windowEnd || f.done) return;
      const lead = leads.find((l) => l.id === f.leadId);
      all.push({
        id: `fu-${f.id}`, when: f.dueAt,
        title: `Follow-up · ${lead?.name ?? "Lead"}`,
        sub: f.reason,
        tone: at < now ? "border-l-do-now bg-do-now/5 text-do-now" : "border-l-do-today bg-do-today/5 text-do-today",
        icon: Phone,
      });
    });
    tasks.forEach((t) => {
      const at = +new Date(t.dueAt);
      if (at < +dayStart || at > windowEnd || t.done) return;
      all.push({
        id: `task-${t.id}`, when: t.dueAt,
        title: t.title,
        sub: t.leadId ? leads.find((l) => l.id === t.leadId)?.name ?? "" : "Task",
        tone: t.tier === "now" ? "border-l-do-now bg-do-now/5"
            : t.tier === "today" ? "border-l-do-today bg-do-today/5"
            : "border-l-do-soon bg-do-soon/5",
        icon: FileText,
      });
    });

    return all.sort((a, b) => +new Date(a.when) - +new Date(b.when));
  }, [tours, followUps, leads, properties, tasks, now, mounted]);

  if (!mounted) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">
        Loading agenda…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">
        <CalendarIcon className="h-6 w-6 mx-auto mb-2 opacity-40" />
        No events in the next 14 days.
      </div>
    );
  }

  // group by day
  const groups = new Map<string, AgendaItem[]>();
  items.forEach((it) => {
    const key = new Date(it.when).toDateString();
    const arr = groups.get(key) ?? [];
    arr.push(it);
    groups.set(key, arr);
  });

  return (
    <div className="space-y-4">
      {Array.from(groups.entries()).map(([day, list]) => {
        const d = new Date(day);
        const isToday = d.toDateString() === new Date(now).toDateString();
        return (
          <section key={day}>
            <div className="text-[10px] uppercase tracking-[0.2em] font-semibold mb-2 flex items-center gap-2">
              <span>{d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</span>
              {isToday && <Badge variant="outline" className="text-[9px] bg-accent/10 text-accent border-accent/40">TODAY</Badge>}
              <span className="text-muted-foreground font-mono opacity-60">{list.length}</span>
            </div>
            <ul className="space-y-1.5">
              {list.map((it) => (
                <li key={it.id} className={`flex items-center gap-3 rounded-md border bg-card px-3 py-2 border-l-4 ${it.tone}`}>
                  <it.icon className="h-3.5 w-3.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate">{it.title}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{it.sub}</div>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground tabular-nums flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(it.when).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
