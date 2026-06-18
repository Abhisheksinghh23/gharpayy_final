import { create } from "zustand";
import { persist } from "zustand/middleware";

export type QuotationStatus = "sent" | "paid" | "not-paid" | "expired" | "cancelled";

export interface Quotation {
  id: string;
  leadId: string;
  tcmId?: string;
  propertyId?: string;          // existing property if picked
  propertyName: string;         // resolved label (custom or property name)
  roomType: string;
  roomNumber?: string;
  actualRent: number;
  discountedPrice: number;
  deposit: number;
  prebook: number;
  maintenance: number;
  maintenanceType: "One-Time" | "Monthly";
  lockIn: string;
  notice: string;
  validityMinutes: number;      // computed for stored snapshot
  validUntilISO: string;        // ts when offer expires
  message: string;              // rendered WhatsApp body
  status: QuotationStatus;
  sentAt: string;
  paidAt?: string;
  paymentNote?: string;
}

interface QuotationsState {
  quotations: Quotation[];
  add: (q: Omit<Quotation, "id" | "status" | "sentAt">) => Quotation;
  setStatus: (id: string, status: QuotationStatus, note?: string) => void;
  forLead: (leadId: string) => Quotation[];
}

const uid = () => `qt-${Math.random().toString(36).slice(2, 9)}`;

export const useQuotations = create<QuotationsState>()(
  persist(
    (set, get) => ({
      quotations: [],
      add: (q) => {
        const rec: Quotation = {
          ...q,
          id: uid(),
          status: "sent",
          sentAt: new Date().toISOString(),
        };
        set((s) => ({ quotations: [rec, ...s.quotations] }));
        return rec;
      },
      setStatus: (id, status, note) =>
        set((s) => ({
          quotations: s.quotations.map((q) =>
            q.id === id
              ? {
                  ...q,
                  status,
                  paidAt: status === "paid" ? new Date().toISOString() : q.paidAt,
                  paymentNote: note ?? q.paymentNote,
                }
              : q,
          ),
        })),
      forLead: (leadId) => get().quotations.filter((q) => q.leadId === leadId),
    }),
    { name: "gharpayy.quotations.v1" },
  ),
);

export function formatINR(n: number): string {
  return "₹" + Number(n || 0).toLocaleString("en-IN");
}

export function formatValidity(untilISO: string): string {
  const d = new Date(untilISO);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const hr12 = h % 12 || 12;
  return `${hr12}:${m} ${ampm}`;
}

export interface QuotationDraft {
  propertyName: string;
  roomType: string;
  roomNumber?: string;
  actualRent: number;
  discountedPrice: number;
  deposit: number;
  prebook: number;
  maintenance: number;
  maintenanceType: "One-Time" | "Monthly";
  lockIn: string;
  notice: string;
  validUntilISO: string;
}

export function renderQuotationMessage(d: QuotationDraft): string {
  const validity = formatValidity(d.validUntilISO);
  const roomLine = d.roomNumber ? ` | Room ${d.roomNumber}` : "";
  return [
    `🙌🏻⚡️ *Stay Reserved  ( Limited Good Rooms)*`,
    `📍 *${d.propertyName}*`,
    ` \`Room Type: ${d.roomType}\`${roomLine}`,
    ``,
    `Actual Rent: ~${formatINR(d.actualRent)}~`,
    ` \`Discounted Price: ${formatINR(d.discountedPrice)}\`  🔑 valid till ${validity}`,
    ``,
    ` \`Deposit: ${formatINR(d.deposit)}\``,
    ` _Maintenance: ${formatINR(d.maintenance)} (${d.maintenanceType}) | Lock-in: ${d.lockIn} | Notice: ${d.notice}_`,
    ``,
    `Prebook NOW : ${formatINR(d.prebook)} only`,
    `_Balance payable at check-in_`,
    `> Note: After ${validity}, price resets to ACTUAL RENT and the same room won't be available.`,
    ``,
    `🤙🏻 https://gharpayy.com/payment.html`,
  ].join("\n");
}
