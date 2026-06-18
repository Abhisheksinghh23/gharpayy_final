import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  OwnerBooking,
  BookingLifecycle,
  ReadinessKey,
  ReadinessStatus,
  PaymentLine,
  OwnerDecision,
  OwnerBookingTotals,
} from "./types";
import { READINESS_LABEL } from "./types";

const uid = () => `obk-${Math.random().toString(36).slice(2, 9)}`;
const now = () => new Date().toISOString();

const baseReadiness: Record<ReadinessKey, ReadinessStatus> = {
  cleaning: "pending",
  furniture: "pending",
  internet: "pending",
  electricity: "pending",
  water: "pending",
  inspection: "pending",
};

function seedBookings(): OwnerBooking[] {
  const t = Date.now();
  const iso = (mins: number) => new Date(t + mins * 60_000).toISOString();
  return [
    {
      id: uid(),
      status: "shared_with_owner",
      createdAt: iso(-180),
      updatedAt: iso(-30),
      sharedAt: iso(-60),
      customer: {
        name: "Aarav Mehta",
        phone: "+91 98201 22334",
        gender: "male",
        occupation: "working",
        companyOrCollege: "Razorpay",
        emergencyName: "Priya Mehta",
        emergencyPhone: "+91 98765 44322",
      },
      inventory: {
        propertyId: "p-koramangala-1",
        propertyName: "Gharpayy Koramangala 4th Block",
        floor: "2",
        roomNumber: "204",
        bedNumber: "B",
        sharing: "double",
        category: "ac",
      },
      ownerId: "own-1",
      rent: 14500,
      deposit: 29000,
      payments: [
        { id: uid(), label: "Booking Amount", amount: 5000, status: "received", receivedAt: iso(-60) },
        { id: uid(), label: "Security Deposit", amount: 29000, status: "pending" },
        { id: uid(), label: "First Month Rent", amount: 14500, status: "pending" },
      ],
      moveIn: { date: iso(60 * 24 * 4), time: "11:00", stayMonths: 11, lockInMonths: 3, noticeDays: 30 },
      specialRequests: [
        { id: uid(), text: "Lower floor preferred" },
        { id: uid(), text: "Quiet room — works night shifts" },
      ],
      readiness: { ...baseReadiness },
      history: [
        { ts: iso(-180), actor: "sales:Ravi", text: "Booking created" },
        { ts: iso(-60), actor: "system", text: "Shared with owner via WhatsApp" },
      ],
      createdBy: "Ravi",
    },
    {
      id: uid(),
      status: "acknowledged",
      createdAt: iso(-60 * 24),
      updatedAt: iso(-30),
      sharedAt: iso(-60 * 23),
      viewedAt: iso(-60 * 22),
      acknowledgedAt: iso(-60 * 20),
      customer: {
        name: "Sneha Iyer",
        phone: "+91 99000 11223",
        gender: "female",
        occupation: "student",
        companyOrCollege: "Christ University",
        emergencyName: "Ravi Iyer",
        emergencyPhone: "+91 98765 00112",
      },
      inventory: {
        propertyId: "p-indiranagar-1",
        propertyName: "Gharpayy Indiranagar 100ft",
        floor: "3",
        roomNumber: "301",
        bedNumber: "A",
        sharing: "triple",
        category: "non-ac",
      },
      ownerId: "own-2",
      rent: 11000,
      deposit: 22000,
      payments: [
        { id: uid(), label: "Booking Amount", amount: 3000, status: "received", receivedAt: iso(-60 * 23) },
        { id: uid(), label: "Security Deposit", amount: 22000, status: "received", receivedAt: iso(-60 * 5) },
        { id: uid(), label: "First Month Rent", amount: 11000, status: "pending" },
      ],
      moveIn: { date: iso(60 * 24 * 2), time: "10:00", stayMonths: 12, lockInMonths: 6, noticeDays: 30 },
      specialRequests: [
        { id: uid(), text: "Veg-only floor preferred" },
        { id: uid(), text: "Attached washroom" },
      ],
      ownerDecision: "approve_with_conditions",
      ownerDecisionAt: iso(-60 * 20),
      ownerConditionNote: "Room ready by tomorrow evening — deep cleaning scheduled",
      readiness: { ...baseReadiness, internet: "ready", electricity: "ready", water: "ready" },
      history: [
        { ts: iso(-60 * 24), actor: "sales:Aisha", text: "Booking created" },
        { ts: iso(-60 * 23), actor: "system", text: "Shared with owner" },
        { ts: iso(-60 * 22), actor: "owner:Meera", text: "Viewed booking card" },
        { ts: iso(-60 * 20), actor: "owner:Meera", text: "Approved with conditions: cleaning tomorrow" },
      ],
      createdBy: "Aisha",
    },
    {
      id: uid(),
      status: "room_ready",
      createdAt: iso(-60 * 24 * 3),
      updatedAt: iso(-60),
      sharedAt: iso(-60 * 70),
      viewedAt: iso(-60 * 69),
      acknowledgedAt: iso(-60 * 67),
      readyAt: iso(-60 * 2),
      customer: {
        name: "Rohan Kapoor",
        phone: "+91 98888 12345",
        gender: "male",
        occupation: "working",
        companyOrCollege: "Flipkart",
        emergencyName: "Anita Kapoor",
        emergencyPhone: "+91 98111 33445",
      },
      inventory: {
        propertyId: "p-hsr-1",
        propertyName: "Gharpayy HSR Layout Sector 6",
        floor: "1",
        roomNumber: "108",
        bedNumber: "A",
        sharing: "single",
        category: "premium",
      },
      ownerId: "own-3",
      rent: 18500,
      deposit: 37000,
      payments: [
        { id: uid(), label: "Booking Amount", amount: 5000, status: "received", receivedAt: iso(-60 * 70) },
        { id: uid(), label: "Security Deposit", amount: 37000, status: "received", receivedAt: iso(-60 * 12) },
        { id: uid(), label: "First Month Rent", amount: 18500, status: "received", receivedAt: iso(-60 * 5) },
      ],
      moveIn: { date: iso(60 * 24), time: "14:00", stayMonths: 11, lockInMonths: 3, noticeDays: 30 },
      specialRequests: [{ id: uid(), text: "Extra mattress" }, { id: uid(), text: "Early check-in 2 PM" }],
      ownerDecision: "approve",
      ownerDecisionAt: iso(-60 * 67),
      readiness: {
        cleaning: "ready", furniture: "ready", internet: "ready",
        electricity: "ready", water: "ready", inspection: "ready",
      },
      readinessNote: "Verified by property manager Sunil",
      history: [
        { ts: iso(-60 * 24 * 3), actor: "sales:Karan", text: "Booking created" },
        { ts: iso(-60 * 70), actor: "system", text: "Shared with owner" },
        { ts: iso(-60 * 67), actor: "owner:Ankit", text: "Approved" },
        { ts: iso(-60 * 2), actor: "owner:Ankit", text: "All readiness checks complete" },
      ],
      createdBy: "Karan",
    },
  ];
}

interface State {
  bookings: OwnerBooking[];
  createBooking: (input: Omit<OwnerBooking, "id" | "status" | "createdAt" | "updatedAt" | "history" | "readiness">) => OwnerBooking;
  updateBooking: (id: string, patch: Partial<OwnerBooking>) => void;
  shareWithOwner: (id: string, actor?: string) => void;
  markViewed: (id: string, actor?: string) => void;
  recordOwnerDecision: (id: string, decision: OwnerDecision, note?: string, actor?: string) => void;
  setReadiness: (id: string, key: ReadinessKey, status: ReadinessStatus, actor?: string) => void;
  markAllReady: (id: string, actor?: string) => void;
  markPaymentReceived: (id: string, paymentId: string, actor?: string) => void;
  addPaymentLine: (id: string, line: Omit<PaymentLine, "id">) => void;
  approveMoveIn: (id: string, actor?: string) => void;
  completeBooking: (id: string, actor?: string) => void;
  cancelBooking: (id: string, reason: string, actor?: string) => void;
  appendHistory: (id: string, actor: string, text: string) => void;
}

export const useOwnerBookings = create<State>()(
  persist(
    (set, get) => ({
      bookings: seedBookings(),

      createBooking: (input) => {
        const b: OwnerBooking = {
          ...input,
          id: uid(),
          status: "created",
          createdAt: now(),
          updatedAt: now(),
          readiness: { ...baseReadiness },
          history: [{ ts: now(), actor: `sales:${input.createdBy ?? "ops"}`, text: "Booking created" }],
        };
        set((s) => ({ bookings: [b, ...s.bookings] }));
        return b;
      },

      updateBooking: (id, patch) =>
        set((s) => ({
          bookings: s.bookings.map((b) => (b.id === id ? { ...b, ...patch, updatedAt: now() } : b)),
        })),

      shareWithOwner: (id, actor = "system") => {
        set((s) => ({
          bookings: s.bookings.map((b) =>
            b.id === id
              ? {
                  ...b,
                  status: b.status === "created" ? "shared_with_owner" : b.status,
                  sharedAt: b.sharedAt ?? now(),
                  updatedAt: now(),
                  history: [...b.history, { ts: now(), actor, text: "Shared with owner" }],
                }
              : b,
          ),
        }));
      },

      markViewed: (id, actor = "owner") => {
        set((s) => ({
          bookings: s.bookings.map((b) =>
            b.id === id && !b.viewedAt
              ? {
                  ...b,
                  status: b.status === "shared_with_owner" ? "viewed_by_owner" : b.status,
                  viewedAt: now(),
                  updatedAt: now(),
                  history: [...b.history, { ts: now(), actor, text: "Viewed booking card" }],
                }
              : b,
          ),
        }));
      },

      recordOwnerDecision: (id, decision, note, actor = "owner") => {
        set((s) => ({
          bookings: s.bookings.map((b) => {
            if (b.id !== id) return b;
            const nextStatus: BookingLifecycle =
              decision === "reject" ? "rejected" : "acknowledged";
            const text =
              decision === "approve"
                ? "Approved booking"
                : decision === "approve_with_conditions"
                ? `Approved with conditions: ${note ?? ""}`
                : `Rejected: ${note ?? "no reason"}`;
            return {
              ...b,
              status: nextStatus,
              ownerDecision: decision,
              ownerDecisionAt: now(),
              ownerConditionNote: decision === "approve_with_conditions" ? note : b.ownerConditionNote,
              ownerRejectionReason: decision === "reject" ? note : b.ownerRejectionReason,
              updatedAt: now(),
              history: [...b.history, { ts: now(), actor, text }],
            };
          }),
        }));
      },

      setReadiness: (id, key, status, actor = "owner") =>
        set((s) => ({
          bookings: s.bookings.map((b) => {
            if (b.id !== id) return b;
            const readiness = { ...b.readiness, [key]: status };
            const allReady = Object.values(readiness).every((v) => v === "ready");
            return {
              ...b,
              readiness,
              status: allReady && b.status === "acknowledged" ? "room_ready" : b.status,
              readyAt: allReady ? (b.readyAt ?? now()) : b.readyAt,
              updatedAt: now(),
              history: [
                ...b.history,
                { ts: now(), actor, text: `${READINESS_LABEL[key]} → ${status}` },
              ],
            };
          }),
        })),

      markAllReady: (id, actor = "owner") =>
        set((s) => ({
          bookings: s.bookings.map((b) => {
            if (b.id !== id) return b;
            const readiness: typeof b.readiness = {
              cleaning: "ready", furniture: "ready", internet: "ready",
              electricity: "ready", water: "ready", inspection: "ready",
            };
            return {
              ...b,
              readiness,
              status: b.status === "acknowledged" ? "room_ready" : b.status,
              readyAt: now(),
              updatedAt: now(),
              history: [...b.history, { ts: now(), actor, text: "Marked all readiness checks complete" }],
            };
          }),
        })),

      markPaymentReceived: (id, paymentId, actor = "sales") =>
        set((s) => ({
          bookings: s.bookings.map((b) => {
            if (b.id !== id) return b;
            const payments = b.payments.map((p) =>
              p.id === paymentId ? { ...p, status: "received" as const, receivedAt: now() } : p,
            );
            const line = b.payments.find((p) => p.id === paymentId);
            return {
              ...b,
              payments,
              updatedAt: now(),
              history: [
                ...b.history,
                { ts: now(), actor, text: `Payment received: ${line?.label ?? ""} ₹${line?.amount.toLocaleString("en-IN") ?? ""}` },
              ],
            };
          }),
        })),

      addPaymentLine: (id, line) =>
        set((s) => ({
          bookings: s.bookings.map((b) =>
            b.id === id
              ? { ...b, payments: [...b.payments, { ...line, id: uid() }], updatedAt: now() }
              : b,
          ),
        })),

      approveMoveIn: (id, actor = "owner") =>
        set((s) => ({
          bookings: s.bookings.map((b) =>
            b.id === id
              ? {
                  ...b,
                  status: "move_in_approved",
                  moveInApprovedAt: now(),
                  updatedAt: now(),
                  history: [...b.history, { ts: now(), actor, text: "Move-in approved" }],
                }
              : b,
          ),
        })),

      completeBooking: (id, actor = "system") =>
        set((s) => ({
          bookings: s.bookings.map((b) =>
            b.id === id
              ? {
                  ...b,
                  status: "completed",
                  completedAt: now(),
                  updatedAt: now(),
                  history: [...b.history, { ts: now(), actor, text: "Customer checked in — booking complete" }],
                }
              : b,
          ),
        })),

      cancelBooking: (id, reason, actor = "sales") =>
        set((s) => ({
          bookings: s.bookings.map((b) =>
            b.id === id
              ? {
                  ...b,
                  status: "cancelled",
                  updatedAt: now(),
                  history: [...b.history, { ts: now(), actor, text: `Cancelled: ${reason}` }],
                }
              : b,
          ),
        })),

      appendHistory: (id, actor, text) =>
        set((s) => ({
          bookings: s.bookings.map((b) =>
            b.id === id
              ? { ...b, history: [...b.history, { ts: now(), actor, text }], updatedAt: now() }
              : b,
          ),
        })),
    }),
    { name: "gharpayy.owner-bookings.v1" },
  ),
);

export function computeTotals(b: OwnerBooking): OwnerBookingTotals {
  const expected = b.payments.reduce((s, p) => s + (p.status === "waived" ? 0 : p.amount), 0);
  const received = b.payments.filter((p) => p.status === "received").reduce((s, p) => s + p.amount, 0);
  const pending = expected - received;
  const readinessVals = Object.values(b.readiness);
  const readyCount = readinessVals.filter((v) => v === "ready").length;
  const totalReadiness = readinessVals.length;
  const isFullyReady = readyCount === totalReadiness;
  const isFullyPaid = pending <= 0;
  const canConfirm =
    b.ownerDecision === "approve" || b.ownerDecision === "approve_with_conditions"
      ? isFullyReady
      : false;
  return { expected, received, pending, readyCount, totalReadiness, isFullyReady, isFullyPaid, canConfirm };
}
