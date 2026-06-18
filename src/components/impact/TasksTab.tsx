import { useState } from "react";
import { useTasks, type TaskTier } from "@/lib/impact/tasks";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const TIER_COLOR: Record<TaskTier, string> = {
  now:   "border-l-do-now",
  today: "border-l-do-today",
  soon:  "border-l-do-soon",
};
const TIER_DOT: Record<TaskTier, string> = {
  now:   "bg-do-now",
  today: "bg-do-today",
  soon:  "bg-do-soon",
};

function defaultDueAt(): string {
  const d = new Date(); d.setHours(d.getHours() + 1, 0, 0, 0);
  return d.toISOString().slice(0, 16);
}

export function TasksTab() {
  const tasks = useTasks((s) => s.tasks);
  const addTask = useTasks((s) => s.addTask);
  const toggleTask = useTasks((s) => s.toggleTask);
  const removeTask = useTasks((s) => s.removeTask);
  const leads = useApp((s) => s.leads);

  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState(defaultDueAt());
  const [tier, setTier] = useState<TaskTier>("today");
  const [leadId, setLeadId] = useState<string>("");

  const submit = () => {
    if (!title.trim()) { toast.error("Title required"); return; }
    addTask({ title: title.trim(), dueAt: new Date(dueAt).toISOString(), tier, leadId: leadId || undefined });
    setTitle("");
    toast.success("Task added");
  };

  const sorted = [...tasks].sort((a, b) => Number(a.done) - Number(b.done) || +new Date(a.dueAt) - +new Date(b.dueAt));

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card p-3 space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          New task
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="What needs doing?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="h-8 text-xs flex-1 min-w-[180px]"
          />
          <Input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="h-8 text-xs w-48"
          />
          <Select value={tier} onValueChange={(v) => setTier(v as TaskTier)}>
            <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="now"   className="text-xs">🔴 Now</SelectItem>
              <SelectItem value="today" className="text-xs">🟠 Today</SelectItem>
              <SelectItem value="soon"  className="text-xs">🔵 Soon</SelectItem>
            </SelectContent>
          </Select>
          <Select value={leadId || "none"} onValueChange={(v) => setLeadId(v === "none" ? "" : v)}>
            <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="Lead (opt)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-xs">— No lead —</SelectItem>
              {leads.slice(0, 30).map((l) => (
                <SelectItem key={l.id} value={l.id} className="text-xs">{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8 text-xs gap-1" onClick={submit}>
            <Plus className="h-3 w-3" /> Add
          </Button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-xs text-muted-foreground">
          No tasks yet. Add your first.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {sorted.map((t) => {
            const lead = t.leadId ? leads.find((l) => l.id === t.leadId) : undefined;
            return (
              <li
                key={t.id}
                className={`flex items-center gap-2 rounded-md border bg-card px-3 py-2 border-l-4 ${TIER_COLOR[t.tier]} ${t.done ? "opacity-50" : ""}`}
              >
                <button
                  onClick={() => toggleTask(t.id)}
                  className="h-5 w-5 rounded border flex items-center justify-center hover:bg-muted"
                  aria-label={t.done ? "Mark not done" : "Mark done"}
                >
                  {t.done && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className={`text-xs font-medium ${t.done ? "line-through" : ""}`}>
                    {t.title}
                  </div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${TIER_DOT[t.tier]}`} />
                    {new Date(t.dueAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                    {lead && <><span>·</span><span>{lead.name}</span></>}
                  </div>
                </div>
                <Button
                  size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-danger"
                  onClick={() => removeTask(t.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
