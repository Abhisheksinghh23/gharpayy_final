// Hook to instrument any flow with task-time tracking.
// Usage:
//   const timer = useTaskTimer("lead.add", "Add lead");
//   timer.start();                            // when user opens / focuses first field
//   <Input onFocus={timer.field("name")} />   // tracks time-on-field
//   timer.complete({ leadId });               // on successful submit
//   timer.abandon();                          // on unmount without complete
import { useCallback, useEffect, useRef, useState } from "react";
import { useTTI, type TaskType, formatDuration } from "./store";
import { useApp } from "@/lib/store";
import { useOwner } from "@/owner/owner-context";
import { toast } from "sonner";
import { summarize } from "./store";

export function useTaskTimer(type: TaskType, label: string, opts?: { autoStart?: boolean; abandonOnUnmount?: boolean; meta?: Record<string, unknown> }) {
  const start = useTTI((s) => s.start);
  const recordField = useTTI((s) => s.recordField);
  const completeFn = useTTI((s) => s.complete);
  const abandonFn = useTTI((s) => s.abandon);
  const records = useTTI((s) => s.records);

  const role = useApp((s) => s.role);
  const currentTcmId = useApp((s) => s.currentTcmId);
  const tcms = useApp((s) => s.tcms);
  const ownerCtx = useOwner();
  const currentOwnerId = ownerCtx.currentOwnerId;
  const owners = ownerCtx.owners;

  const user = (() => {
    if (role === "tcm") {
      const t = tcms.find((x) => x.id === currentTcmId);
      return { key: `tcm:${currentTcmId}`, name: t?.name ?? "TCM" };
    }
    if (role === "owner") {
      const o = owners.find((x: { id: string; name: string }) => x.id === currentOwnerId);
      return { key: `owner:${currentOwnerId ?? "default"}`, name: o?.name ?? "Owner" };
    }
    return { key: `${role}:default`, name: role.toUpperCase() };
  })();

  const taskIdRef = useRef<string | null>(null);
  const fieldStartRef = useRef<{ field: string; at: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const begin = useCallback(() => {
    if (taskIdRef.current) return taskIdRef.current;
    const id = start(type, label, user, opts?.meta);
    taskIdRef.current = id;
    setStartedAt(Date.now());
    return id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, label, user.key, user.name]);

  useEffect(() => {
    if (opts?.autoStart) begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // live elapsed ticker
  useEffect(() => {
    if (!startedAt) return;
    const i = setInterval(() => setElapsed(Date.now() - startedAt), 500);
    return () => clearInterval(i);
  }, [startedAt]);

  // commit any in-flight field timing
  const flushField = useCallback(() => {
    const fs = fieldStartRef.current;
    if (!fs || !taskIdRef.current) return;
    recordField(taskIdRef.current, fs.field, Date.now() - fs.at);
    fieldStartRef.current = null;
  }, [recordField]);

  const field = useCallback(
    (name: string) => ({
      onFocus: () => {
        if (!taskIdRef.current) begin();
        flushField();
        fieldStartRef.current = { field: name, at: Date.now() };
      },
      onBlur: () => flushField(),
    }),
    [begin, flushField],
  );

  const complete = useCallback(
    (extra?: Record<string, unknown>) => {
      flushField();
      if (!taskIdRef.current) return null;
      const rec = completeFn(taskIdRef.current, extra);
      taskIdRef.current = null;
      setStartedAt(null);
      setElapsed(0);
      if (rec?.durationMs) {
        // compare against historical avg for this type from this user
        const peers = records.filter((r) => r.type === type && !r.abandoned && r.userKey === rec.userKey);
        const allOfType = records.filter((r) => r.type === type && !r.abandoned);
        const stats = summarize(allOfType.length ? allOfType : [rec])[0];
        const yourAvg = peers.length
          ? peers.reduce((a, r) => a + (r.durationMs ?? 0), 0) / peers.length
          : null;
        const diff = yourAvg ? Math.round(((yourAvg - rec.durationMs) / yourAvg) * 100) : null;
        const lines = [
          `Time taken: ${formatDuration(rec.durationMs)}`,
          stats ? `Team avg: ${formatDuration(stats.avgMs)} · Best: ${formatDuration(stats.bestMs)}` : null,
          diff !== null && diff > 0 ? `🚀 ${diff}% faster than your average` : null,
          diff !== null && diff < 0 ? `${Math.abs(diff)}% slower than your average` : null,
        ].filter(Boolean).join(" · ");
        toast.success(`${label} · ${formatDuration(rec.durationMs)}`, { description: lines });
      }
      return rec;
    },
    [completeFn, flushField, records, type, label],
  );

  const abandon = useCallback(() => {
    flushField();
    if (taskIdRef.current) {
      abandonFn(taskIdRef.current);
      taskIdRef.current = null;
      setStartedAt(null);
    }
  }, [abandonFn, flushField]);

  // optional cleanup
  useEffect(() => {
    return () => {
      if (opts?.abandonOnUnmount && taskIdRef.current) abandonFn(taskIdRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { start: begin, field, complete, abandon, elapsedMs: elapsed, isRunning: !!startedAt };
}
