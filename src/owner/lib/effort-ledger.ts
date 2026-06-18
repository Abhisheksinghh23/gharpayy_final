// Effort Ledger — projects glueBus events into per-owner counters so owners
// can SEE the work Gharpayy is doing for them (pitches, tours, visits,
// blocks). This is the "trust unlock" layer from the Owner 10x plan.

import { useEffect, useState } from "react";
import { glueBus, type GlueEvent } from "@/owner/event-bus";
import { lookupOwnerByRoomId } from "@/owner/lib/owner-registry";

export interface OwnerEffort {
  pitches: number;
  visitsScheduled: number;
  visitsCompleted: number;
  tours: number;
  blocksRequested: number;
  blocksApproved: number;
  blocksRejected: number;
  lastEventAt?: string;
  recent: { kind: string; roomId?: string; at: string }[];
}

const EMPTY: OwnerEffort = {
  pitches: 0,
  visitsScheduled: 0,
  visitsCompleted: 0,
  tours: 0,
  blocksRequested: 0,
  blocksApproved: 0,
  blocksRejected: 0,
  recent: [],
};

function ownerIdFromEvent(e: GlueEvent): string | null {
  // Many events carry ownerId directly.
  const direct = (e as { ownerId?: string }).ownerId;
  if (direct) return direct;
  // Else fall back via roomId → registry lookup.
  const roomId = (e as { roomId?: string }).roomId;
  if (roomId) return lookupOwnerByRoomId(roomId)?.id ?? null;
  return null;
}

function fold(events: GlueEvent[], targetOwnerId: string): OwnerEffort {
  const acc: OwnerEffort = { ...EMPTY, recent: [] };
  for (const e of events) {
    const oid = ownerIdFromEvent(e);
    if (oid !== targetOwnerId) continue;
    const at = new Date().toISOString();
    const roomId = (e as { roomId?: string }).roomId;
    acc.lastEventAt = at;
    switch (e.type) {
      case "team.lead.pitched":
        acc.pitches++;
        acc.recent.unshift({ kind: "Lead pitched", roomId, at });
        break;
      case "team.visit.scheduled":
        acc.visitsScheduled++;
        acc.recent.unshift({ kind: "Visit scheduled", roomId, at });
        break;
      case "team.visit.ended":
        acc.visitsCompleted++;
        acc.recent.unshift({ kind: "Visit completed", roomId, at });
        break;
      case "tour.confirmation.sent":
      case "tour.reminder.sent":
        acc.tours++;
        acc.recent.unshift({ kind: "Tour outreach", roomId, at });
        break;
      case "team.block.requested":
        acc.blocksRequested++;
        acc.recent.unshift({ kind: "Block requested", roomId, at });
        break;
      case "owner.block.approved":
        acc.blocksApproved++;
        acc.recent.unshift({ kind: "Block approved", roomId, at });
        break;
      case "owner.block.rejected":
        acc.blocksRejected++;
        acc.recent.unshift({ kind: "Block rejected", roomId, at });
        break;
      default:
        break;
    }
  }
  acc.recent = acc.recent.slice(0, 10);
  return acc;
}

export function useOwnerEffort(ownerId: string | null): OwnerEffort {
  const [effort, setEffort] = useState<OwnerEffort>(EMPTY);
  useEffect(() => {
    if (!ownerId) {
      setEffort(EMPTY);
      return;
    }
    const recompute = () => setEffort(fold(glueBus.recent(undefined, 200), ownerId));
    recompute();
    return glueBus.subscribe(recompute);
  }, [ownerId]);
  return effort;
}
