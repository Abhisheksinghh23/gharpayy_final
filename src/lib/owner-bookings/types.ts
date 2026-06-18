// Owner Booking Approval & Acknowledgement System — types

export type Gender = "male" | "female" | "other";
export type Occupation = "student" | "working" | "other";
export type SharingType = "single" | "double" | "triple" | "quad" | "studio";
export type RoomCategory = "ac" | "non-ac" | "premium" | "standard";

export type BookingLifecycle =
  | "created"
  | "shared_with_owner"
  | "viewed_by_owner"
  | "acknowledged"
  | "room_ready"
  | "move_in_approved"
  | "completed"
  | "rejected"
  | "cancelled";

export const LIFECYCLE_ORDER: BookingLifecycle[] = [
  "created",
  "shared_with_owner",
  "viewed_by_owner",
  "acknowledged",
  "room_ready",
  "move_in_approved",
  "completed",
];

export const LIFECYCLE_LABEL: Record<BookingLifecycle, string> = {
  created: "Created",
  shared_with_owner: "Shared with owner",
  viewed_by_owner: "Viewed by owner",
  acknowledged: "Acknowledged",
  room_ready: "Room ready",
  move_in_approved: "Move-in approved",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export type OwnerDecision = "approve" | "approve_with_conditions" | "reject";

export type ReadinessKey =
  | "cleaning"
  | "furniture"
  | "internet"
  | "electricity"
  | "water"
  | "inspection";

export const READINESS_LABEL: Record<ReadinessKey, string> = {
  cleaning: "Cleaning",
  furniture: "Furniture",
  internet: "Internet",
  electricity: "Electricity",
  water: "Water",
  inspection: "Final Inspection",
};

export type ReadinessStatus = "pending" | "ready";

export type ChargeStatus = "received" | "pending" | "waived";

export interface PaymentLine {
  id: string;
  label: string;          // e.g. "Booking Amount", "Deposit", "First Month Rent"
  amount: number;
  status: ChargeStatus;
  receivedAt?: string;
}

export interface SpecialRequest {
  id: string;
  text: string;
  honored?: boolean;
}

export interface OwnerBookingHistory {
  ts: string;
  actor: string;          // "sales:Ravi" | "owner:Rakesh"
  text: string;
}

export interface OwnerBooking {
  id: string;
  // Lifecycle
  status: BookingLifecycle;
  createdAt: string;
  updatedAt: string;
  sharedAt?: string;
  viewedAt?: string;
  acknowledgedAt?: string;
  readyAt?: string;
  moveInApprovedAt?: string;
  completedAt?: string;

  // Customer
  customer: {
    name: string;
    phone: string;
    gender: Gender;
    occupation: Occupation;
    companyOrCollege?: string;
    emergencyName?: string;
    emergencyPhone?: string;
  };

  // Inventory
  inventory: {
    propertyId: string;
    propertyName: string;
    floor: string;
    roomNumber: string;
    bedNumber: string;
    sharing: SharingType;
    category: RoomCategory;
  };

  // Owner
  ownerId: string;

  // Financials
  rent: number;
  deposit: number;
  payments: PaymentLine[];

  // Move-in
  moveIn: {
    date: string;       // ISO
    time: string;       // "10:30"
    stayMonths: number;
    lockInMonths: number;
    noticeDays: number;
  };

  // Requirements
  specialRequests: SpecialRequest[];

  // Owner decision
  ownerDecision?: OwnerDecision;
  ownerDecisionAt?: string;
  ownerConditionNote?: string;
  ownerRejectionReason?: string;

  // Readiness
  readiness: Record<ReadinessKey, ReadinessStatus>;
  readinessNote?: string;

  // Audit trail
  history: OwnerBookingHistory[];

  // Source linkage
  leadId?: string;
  tourId?: string;
  createdBy?: string; // tcm name
}

export interface OwnerBookingTotals {
  expected: number;
  received: number;
  pending: number;
  readyCount: number;
  totalReadiness: number;
  isFullyReady: boolean;
  isFullyPaid: boolean;
  canConfirm: boolean;
}
