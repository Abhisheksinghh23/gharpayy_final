import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TaskTier = "now" | "today" | "soon";

export interface ImpactTask {
  id: string;
  title: string;
  dueAt: string;        // ISO
  leadId?: string;
  tier: TaskTier;
  done: boolean;
  createdAt: string;
}

interface TaskState {
  tasks: ImpactTask[];
  addTask: (t: Omit<ImpactTask, "id" | "createdAt" | "done">) => ImpactTask;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;
}

const uid = () => `t-${Math.random().toString(36).slice(2, 10)}`;

export const useTasks = create<TaskState>()(
  persist(
    (set) => ({
      tasks: [],
      addTask: (t) => {
        const task: ImpactTask = {
          ...t, id: uid(), done: false, createdAt: new Date().toISOString(),
        };
        set((s) => ({ tasks: [...s.tasks, task] }));
        return task;
      },
      toggleTask: (id) =>
        set((s) => ({ tasks: s.tasks.map((x) => x.id === id ? { ...x, done: !x.done } : x) })),
      removeTask: (id) =>
        set((s) => ({ tasks: s.tasks.filter((x) => x.id !== id) })),
    }),
    { name: "impact-tasks" },
  ),
);
