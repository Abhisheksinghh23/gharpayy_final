import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CheckInStage =
  | "booked"
  | "ack_received"
  | "token_paid"
  | "room_assigned"
  | "date_set"
  | "moved_in"
  | "settled"
  | "cancelled";

export const STAGE_ORDER: CheckInStage[] = [
  "booked",
  "ack_received",
  "token_paid",
  "room_assigned",
  "date_set",
  "moved_in",
  "settled",
];

export const STAGE_LABEL: Record<CheckInStage, string> = {
  booked: "Booked",
  ack_received: "Ack received",
  token_paid: "Token paid",
  room_assigned: "Room assigned",
  date_set: "Date set",
  moved_in: "Moved in",
  settled: "Settled",
  cancelled: "Cancelled",
};

export type DelayReason =
  | "finance" | "job" | "family" | "travel"
  | "cold_feet" | "property_issue" | "other";

export const DELAY_REASONS: { id: DelayReason; label: string }[] = [
  { id: "finance", label: "Finance" },
  { id: "job", label: "Job" },
  { id: "family", label: "Family" },
  { id: "travel", label: "Travel" },
  { id: "cold_feet", label: "Cold feet" },
  { id: "property_issue", label: "Property issue" },
  { id: "other", label: "Other" },
];

export type IssueCategory = "wifi" | "water" | "cleaning" | "roommate" | "ac" | "food" | "other";

export const ISSUE_CATEGORIES: { id: IssueCategory; label: string }[] = [
  { id: "wifi", label: "WiFi" },
  { id: "water", label: "Water" },
  { id: "cleaning", label: "Cleaning" },
  { id: "roommate", label: "Roommate" },
  { id: "ac", label: "AC" },
  { id: "food", label: "Food" },
  { id: "other", label: "Other" },
];

export type IssueStatus = "open" | "in_progress" | "resolved";

export interface CheckInIssue {
  id: string;
  category: IssueCategory;
  description: string;
  status: IssueStatus;
  assigneeId?: string;
  openedAt: string;
  resolvedAt?: string;
}

export interface CheckInDelay {
  from?: string;
  to: string;
  reason: DelayReason;
  at: string;
}

export interface CheckInHistory {
  stage: CheckInStage;
  at: string;
  by?: string;
  note?: string;
}

export interface CheckIn {
  id: string;
  leadId: string;
  bookingId?: string;
  stage: CheckInStage;
  ackText?: string;
  ackScreenshotUrl?: string;
  ackAt?: string;
  tokenAmount?: number;
  tokenUpiRef?: string;
  tokenScreenshotUrl?: string;
  tokenAt?: string;
  propertyId?: string;
  propertyName?: string;
  roomNumber?: string;
  roomAssignedAt?: string;
  checkInDate?: string;
  delays: CheckInDelay[];
  movedInAt?: string;
  keyHandoverPhotoUrl?: string;
  rent: number;
  deposit: number;
  balanceDue: number;
  issues: CheckInIssue[];
  npsScore?: number;
  settledAt?: string;
  history: CheckInHistory[];
  createdAt: string;
  updatedAt: string;
}

interface CheckInsState {
  checkins: CheckIn[];
  upsert: (args: {
    leadId: string; bookingId?: string; rent?: number; deposit?: number;
    propertyId?: string; propertyName?: string;
  }) => CheckIn;
  setStage: (id: string, stage: CheckInStage, by?: string) => void;
  patch: (id: string, p: Partial<CheckIn>) => void;
  addHistory: (id: string, note: string, by?: string) => void;
  cancel: (id: string) => void;
  addDelay: (id: string, newDate: string, reason: DelayReason) => void;
  addIssue: (id: string, category: IssueCategory, description: string) => void;
  setIssueStatus: (id: string, issueId: string, status: IssueStatus, assigneeId?: string) => void;
  forLead: (leadId: string) => CheckIn | undefined;
}

const uid = (p = "ci") => `${p}-${Math.random().toString(36).slice(2, 9)}`;

function recalcBalance(c: Partial<CheckIn>): number {
  const rent = c.rent ?? 0;
  const deposit = c.deposit ?? 0;
  const token = c.tokenAmount ?? 0;
  return Math.max(0, rent + deposit - token);
}

export const useCheckins = create<CheckInsState>()(
  persist(
    (set, get) => ({
      checkins: [],
      upsert: (args) => {
        const existing = get().checkins.find((c) => c.leadId === args.leadId);
        if (existing) {
          const updates: Partial<CheckIn> = {};
          if (args.bookingId && !existing.bookingId) updates.bookingId = args.bookingId;
          if (args.rent && !existing.rent) updates.rent = args.rent;
          if (args.deposit && !existing.deposit) updates.deposit = args.deposit;
          if (args.propertyId && !existing.propertyId) {
            updates.propertyId = args.propertyId;
            updates.propertyName = args.propertyName;
          }
          if (Object.keys(updates).length) {
            set({
              checkins: get().checkins.map((c) =>
                c.id === existing.id
                  ? { ...c, ...updates, balanceDue: recalcBalance({ ...c, ...updates }), updatedAt: new Date().toISOString() }
                  : c,
              ),
            });
          }
          return existing;
        }
        const now = new Date().toISOString();
        const rent = args.rent ?? 0;
        const deposit = args.deposit ?? Math.round(rent * 2);
        const rec: CheckIn = {
          id: uid(),
          leadId: args.leadId,
          bookingId: args.bookingId,
          stage: "booked",
          propertyId: args.propertyId,
          propertyName: args.propertyName,
          rent,
          deposit,
          balanceDue: rent + deposit,
          delays: [],
          issues: [],
          history: [{ stage: "booked", at: now }],
          createdAt: now,
          updatedAt: now,
        };
        set({ checkins: [rec, ...get().checkins] });
        return rec;
      },
      setStage: (id, stage, by) =>
        set({
          checkins: get().checkins.map((c) => {
            if (c.id !== id) return c;
            const now = new Date().toISOString();
            const next: CheckIn = {
              ...c, stage, updatedAt: now,
              history: [...c.history, { stage, at: now, by }],
            };
            if (stage === "moved_in" && !c.movedInAt) next.movedInAt = now;
            if (stage === "settled" && !c.settledAt) next.settledAt = now;
            return next;
          }),
        }),
      patch: (id, p) =>
        set({
          checkins: get().checkins.map((c) =>
            c.id === id
              ? { ...c, ...p, balanceDue: recalcBalance({ ...c, ...p }), updatedAt: new Date().toISOString() }
              : c,
          ),
        }),
      addHistory: (id, note, by) =>
        set({
          checkins: get().checkins.map((c) =>
            c.id === id
              ? {
                  ...c,
                  history: [...c.history, { stage: c.stage, at: new Date().toISOString(), by, note }],
                  updatedAt: new Date().toISOString(),
                }
              : c,
          ),
        }),
      cancel: (id) => get().setStage(id, "cancelled"),
      addDelay: (id, newDate, reason) =>
        set({
          checkins: get().checkins.map((c) => {
            if (c.id !== id) return c;
            const now = new Date().toISOString();
            const delayNo = c.delays.length + 1;
            return {
              ...c,
              delays: [...c.delays, { from: c.checkInDate, to: newDate, reason, at: now }],
              checkInDate: newDate,
              history: [
                ...c.history,
                {
                  stage: c.stage,
                  at: now,
                  note: `Delay #${delayNo}: ${c.checkInDate ? new Date(c.checkInDate).toLocaleDateString("en-IN") : "unset"} → ${new Date(newDate).toLocaleDateString("en-IN")} (${reason})`,
                },
              ],
              updatedAt: now,
            };
          }),
        }),
      addIssue: (id, category, description) =>
        set({
          checkins: get().checkins.map((c) => {
            if (c.id !== id) return c;
            const issue: CheckInIssue = {
              id: uid("iss"),
              category, description,
              status: "open",
              openedAt: new Date().toISOString(),
            };
            return { ...c, issues: [issue, ...c.issues], updatedAt: new Date().toISOString() };
          }),
        }),
      setIssueStatus: (id, issueId, status, assigneeId) =>
        set({
          checkins: get().checkins.map((c) => {
            if (c.id !== id) return c;
            return {
              ...c,
              issues: c.issues.map((i) =>
                i.id === issueId
                  ? {
                      ...i, status,
                      assigneeId: assigneeId ?? i.assigneeId,
                      resolvedAt: status === "resolved" ? new Date().toISOString() : i.resolvedAt,
                    }
                  : i,
              ),
              updatedAt: new Date().toISOString(),
            };
          }),
        }),
      forLead: (leadId) => get().checkins.find((c) => c.leadId === leadId),
    }),
    { name: "gharpayy.checkins.v1" },
  ),
);

/** Risk score: 0=fine, 1=watch, 2=at_risk, 3=probably_dead */
export function riskLevel(c: CheckIn, nowMs: number = Date.now()): 0 | 1 | 2 | 3 {
  if (c.stage === "settled" || c.stage === "cancelled") return 0;
  const delays = c.delays.length;
  if (delays >= 3) return 3;
  if (delays === 2) return 2;
  const hoursSince = (iso?: string) => (iso ? (nowMs - new Date(iso).getTime()) / 36e5 : 0);
  const last = c.history[c.history.length - 1];
  const inStageHrs = hoursSince(last?.at);
  if (c.stage === "booked" && inStageHrs > 24) return 2;
  if (c.stage === "ack_received" && inStageHrs > 24) return 2;
  if (c.stage === "token_paid" && inStageHrs > 48) return 1;
  if (c.stage === "date_set" && c.checkInDate) {
    const overdueDays = (nowMs - new Date(c.checkInDate).getTime()) / 864e5;
    if (overdueDays > 3) return 3;
    if (overdueDays > 0) return 2;
  }
  if (delays === 1) return 1;
  return 0;
}

export const RISK_LABEL: Record<0 | 1 | 2 | 3, string> = {
  0: "On track", 1: "Watch", 2: "At risk", 3: "Probably dead",
};
export const RISK_CLASS: Record<0 | 1 | 2 | 3, string> = {
  0: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  1: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  2: "bg-orange-500/15 text-orange-600 border-orange-500/30",
  3: "bg-red-500/15 text-red-600 border-red-500/30",
};

export function formatINR(n: number): string {
  return "₹" + Number(n || 0).toLocaleString("en-IN");
}
