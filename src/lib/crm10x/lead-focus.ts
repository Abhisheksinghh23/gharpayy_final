/**
 * useLeadFocus — single source of "what is this lead currently focused on?"
 *
 * Every lead-scoped form (Schedule Tour, Quotation, Booking, Direct Book,
 * Check-in) should call this to prefill its fields so that any data filled
 * in one place flows into the others automatically.
 *
 * Priority chain (most authoritative first):
 *   1. Active check-in record       (booked + moving in)
 *   2. Closed booking (closeDeal)   (latest "won" tour)
 *   3. Latest paid quotation
 *   4. Latest sent quotation
 *   5. Upcoming / latest scheduled tour
 *   6. First "interested" property the lead pinned
 *   7. Lead defaults (assignedTcmId, budget, preferredArea)
 */
import { useMemo } from "react";
import type { Lead, Property, Tour } from "@/lib/types";
import { useApp } from "@/lib/store";
import { useQuotations, type Quotation } from "@/lib/crm10x/quotations";
import { useCheckins, type CheckIn } from "@/lib/checkins/store";
import { useLeadInterests } from "@/lib/crm10x/lead-interests";

export interface LeadFocus {
  /** Resolved property id (may be undefined if nothing picked yet) */
  propertyId?: string;
  /** Property record (if id resolves into the supply table) */
  property?: Property;
  /** Human label — falls back to checkin/quote name even when no property row */
  propertyName?: string;
  /** TCM assigned for this lead's current activity */
  tcmId: string;
  /** Best monthly-rent guess (₹) */
  amount: number;
  /** Best deposit guess (₹) — 2× rent by default */
  deposit: number;
  /** Room type label */
  roomType: string;
  /** Room number / unit, if known */
  roomNumber?: string;
  /** Latest known scheduled-at ISO (tour or check-in date) */
  scheduledAt?: string;
  /** Most recent quote (any status) */
  lastQuote?: Quotation;
  /** Upcoming or most recent tour */
  tour?: Tour;
  /** Existing check-in record */
  checkin?: CheckIn;
  /** Which source filled the fields (for debug + UI hint) */
  source:
    | "checkin"
    | "booked-tour"
    | "paid-quote"
    | "sent-quote"
    | "tour"
    | "interest"
    | "lead";
}

export function useLeadFocus(lead: Lead | null | undefined): LeadFocus {
  const properties = useApp((s) => s.properties);
  const tours = useApp((s) => s.tours);
  const quotes = useQuotations((s) => s.quotations);
  const checkins = useCheckins((s) => s.checkins);
  const allInterests = useLeadInterests((s) => s.interests);

  return useMemo<LeadFocus>(() => {
    const empty: LeadFocus = {
      tcmId: "",
      amount: 0,
      deposit: 0,
      roomType: "Shared",
      source: "lead",
    };
    if (!lead) return empty;

    const checkin = checkins.find((c) => c.leadId === lead.id);
    const leadTours = tours
      .filter((t) => t.leadId === lead.id)
      .sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt));
    const upcomingTour = leadTours.find((t) => t.status === "scheduled");
    const wonTour = leadTours.find((t) => t.status === "completed" && t.decision === "booked");
    const anyTour = upcomingTour ?? wonTour ?? leadTours[0];

    const leadQuotes = quotes
      .filter((q) => q.leadId === lead.id)
      .sort((a, b) => +new Date(b.sentAt) - +new Date(a.sentAt));
    const paidQuote = leadQuotes.find((q) => q.status === "paid");
    const sentQuote = leadQuotes.find((q) => q.status === "sent") ?? leadQuotes[0];

    const interests = allInterests[lead.id] ?? [];
    const firstInterest = interests
      .map((id) => properties.find((p) => p.id === id))
      .find((p): p is Property => Boolean(p));

    const resolveProp = (id?: string): Property | undefined =>
      id ? properties.find((p) => p.id === id) : undefined;

    // Pick the most authoritative source that actually has a property/amount.
    type Pick = Omit<LeadFocus, "deposit"> & { deposit?: number };
    let picked: Pick | null = null;

    if (checkin) {
      const p = resolveProp(checkin.propertyId);
      picked = {
        source: "checkin",
        propertyId: checkin.propertyId,
        property: p,
        propertyName: checkin.propertyName ?? p?.name,
        tcmId: lead.assignedTcmId,
        amount: checkin.rent || sentQuote?.discountedPrice || lead.budget || 0,
        deposit: checkin.deposit,
        roomType: sentQuote?.roomType ?? "Shared",
        roomNumber: checkin.roomNumber ?? sentQuote?.roomNumber,
        scheduledAt: checkin.checkInDate ?? anyTour?.scheduledAt,
        lastQuote: sentQuote ?? paidQuote,
        tour: anyTour,
        checkin,
      };
    } else if (paidQuote) {
      const p = resolveProp(paidQuote.propertyId);
      picked = {
        source: "paid-quote",
        propertyId: paidQuote.propertyId,
        property: p,
        propertyName: paidQuote.propertyName,
        tcmId: paidQuote.tcmId ?? lead.assignedTcmId,
        amount: paidQuote.discountedPrice,
        deposit: paidQuote.deposit,
        roomType: paidQuote.roomType,
        roomNumber: paidQuote.roomNumber,
        scheduledAt: anyTour?.scheduledAt,
        lastQuote: paidQuote,
        tour: anyTour,
      };
    } else if (sentQuote) {
      const p = resolveProp(sentQuote.propertyId);
      picked = {
        source: "sent-quote",
        propertyId: sentQuote.propertyId,
        property: p,
        propertyName: sentQuote.propertyName,
        tcmId: sentQuote.tcmId ?? lead.assignedTcmId,
        amount: sentQuote.discountedPrice,
        deposit: sentQuote.deposit,
        roomType: sentQuote.roomType,
        roomNumber: sentQuote.roomNumber,
        scheduledAt: anyTour?.scheduledAt,
        lastQuote: sentQuote,
        tour: anyTour,
      };
    } else if (wonTour) {
      const p = resolveProp(wonTour.propertyId);
      picked = {
        source: "booked-tour",
        propertyId: wonTour.propertyId,
        property: p,
        propertyName: p?.name,
        tcmId: wonTour.tcmId ?? lead.assignedTcmId,
        amount: p?.pricePerBed ?? lead.budget ?? 0,
        roomType: "Shared",
        scheduledAt: wonTour.scheduledAt,
        tour: wonTour,
      };
    } else if (anyTour) {
      const p = resolveProp(anyTour.propertyId);
      picked = {
        source: "tour",
        propertyId: anyTour.propertyId,
        property: p,
        propertyName: p?.name,
        tcmId: anyTour.tcmId ?? lead.assignedTcmId,
        amount: p?.pricePerBed ?? lead.budget ?? 0,
        roomType: "Shared",
        scheduledAt: anyTour.scheduledAt,
        tour: anyTour,
      };
    } else if (firstInterest) {
      picked = {
        source: "interest",
        propertyId: firstInterest.id,
        property: firstInterest,
        propertyName: firstInterest.name,
        tcmId: lead.assignedTcmId,
        amount: firstInterest.pricePerBed,
        roomType: "Shared",
      };
    } else {
      picked = {
        source: "lead",
        tcmId: lead.assignedTcmId,
        amount: lead.budget ?? 0,
        roomType: "Shared",
        lastQuote: sentQuote ?? paidQuote,
        tour: anyTour,
        checkin,
      };
    }

    const amount = picked.amount || 0;
    const deposit = picked.deposit ?? (amount ? amount * 2 : 0);
    return {
      ...picked,
      deposit,
      lastQuote: picked.lastQuote ?? sentQuote ?? paidQuote,
      tour: picked.tour ?? anyTour,
      checkin: picked.checkin ?? checkin,
    } as LeadFocus;
  }, [lead, properties, tours, quotes, checkins, allInterests]);
}
