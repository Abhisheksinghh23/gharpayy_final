import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ImpactErrorBoundary } from "./ImpactErrorBoundary";
import { HardActionBar } from "./HardActionBar";
import { PriorityLegend } from "./PriorityLegend";
import { FollowUpQueueTab } from "./FollowUpQueueTab";
import { TasksTab } from "./TasksTab";
import { CalendarTab } from "./CalendarTab";
import { ImpactQueue } from "./ImpactQueue";
import { ClientOnly } from "@/components/ClientOnly";
import { useApp } from "@/lib/store";
import { useSnoozes } from "@/lib/impact/snoozes";
import { useTasks } from "@/lib/impact/tasks";
import { useMountedNow } from "@/hooks/use-now";
import { useVisitWar } from "@/lib/visits/war-store";
import { VisitWarRoom } from "@/routes/visit-war";
import {
  LayoutGrid, ListChecks, Calendar as CalendarIcon, BellRing, Moon, Radio,
  Boxes, TrendingUp,
} from "lucide-react";
import { FilterBar, DEFAULT_FILTERS, type QueueFilters } from "./FilterBar";
import { CohortBoard } from "./CohortBoard";
import { PerformanceTab } from "./PerformanceTab";
import { BulkActionBar } from "./BulkActionBar";

export function ImpactQueueShell() {
  return (
    <ImpactErrorBoundary>
      <ClientOnly fallback={<div className="p-6 text-sm text-muted-foreground">Loading workspace…</div>}>
        <ImpactQueueShellInner />
      </ClientOnly>
    </ImpactErrorBoundary>
  );
}

function ImpactQueueShellInner() {
  const [tab, setTab] = useState<"cohorts" | "performance" | "queue" | "visits" | "followups" | "tasks" | "calendar">("cohorts");
  const [filters, setFilters] = useState<QueueFilters>(DEFAULT_FILTERS);
  const followUps = useApp((s) => s.followUps);
  const tasks = useTasks((s) => s.tasks);
  const [now, mounted] = useMountedNow(60_000);
  const snoozeCount = useSnoozes((s) =>
    mounted ? Object.values(s.until).filter((iso) => +new Date(iso) > now).length : 0
  );
  const visitRecords = useVisitWar((s) => s.records);
  const liveVisits = useMemo(
    () => Object.values(visitRecords).filter((v) => ["started", "at-property", "tour-ongoing"].includes(v.stage)).length,
    [visitRecords],
  );

  const pendingFollowUps = followUps.filter((f) => !f.done).length;
  const openTasks = tasks.filter((t) => !t.done).length;

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4">
      <HardActionBar />
      <PriorityLegend />
      {snoozeCount > 0 && (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Moon className="h-3 w-3" />
          <span><strong className="text-foreground">{snoozeCount}</strong> snoozed lead{snoozeCount === 1 ? "" : "s"} hidden from the active queue.</span>
        </div>
      )}

      <FilterBar value={filters} onChange={setFilters} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="h-9 flex-wrap">
          <TabsTrigger value="cohorts" className="text-xs gap-1.5">
            <Boxes className="h-3.5 w-3.5" /> Cohorts
          </TabsTrigger>
          <TabsTrigger value="performance" className="text-xs gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Performance
          </TabsTrigger>
          <TabsTrigger value="queue" className="text-xs gap-1.5">
            <LayoutGrid className="h-3.5 w-3.5" /> Today's Queue
          </TabsTrigger>
          <TabsTrigger value="visits" className="text-xs gap-1.5">
            <Radio className="h-3.5 w-3.5" /> Visits
            {liveVisits > 0 && (
              <Badge variant="outline" className="ml-1 h-4 px-1 text-[9px] bg-success/15 text-success border-success/40">{liveVisits}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="followups" className="text-xs gap-1.5">
            <BellRing className="h-3.5 w-3.5" /> Follow-ups
            {pendingFollowUps > 0 && (
              <Badge variant="outline" className="ml-1 h-4 px-1 text-[9px] bg-do-today/15 text-do-today border-do-today/40">{pendingFollowUps}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="tasks" className="text-xs gap-1.5">
            <ListChecks className="h-3.5 w-3.5" /> Tasks
            {openTasks > 0 && (
              <Badge variant="outline" className="ml-1 h-4 px-1 text-[9px]">{openTasks}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="calendar" className="text-xs gap-1.5">
            <CalendarIcon className="h-3.5 w-3.5" /> Calendar
          </TabsTrigger>
        </TabsList>
        <TabsContent value="cohorts" className="mt-3"><CohortBoard filters={filters} /></TabsContent>
        <TabsContent value="performance" className="mt-3"><PerformanceTab filters={filters} /></TabsContent>
        <TabsContent value="queue" className="mt-3"><ImpactQueue /></TabsContent>
        <TabsContent value="visits" className="mt-3"><VisitWarRoom inline /></TabsContent>
        <TabsContent value="followups" className="mt-3"><FollowUpQueueTab /></TabsContent>
        <TabsContent value="tasks" className="mt-3"><TasksTab /></TabsContent>
        <TabsContent value="calendar" className="mt-3"><CalendarTab /></TabsContent>
      </Tabs>

      <BulkActionBar />
    </div>
  );
}
