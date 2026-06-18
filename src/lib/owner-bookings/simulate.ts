// Demo simulator: seed a batch of bookings across many properties and
// fast-forward them through random lifecycle stages so the admin views
// (KPIs, money, kanban) are immediately populated for testing.
import { PGS } from "@/property-genius/data/pgs";
import { useOwnerBookings } from "./store";
import { emptyDraft, applyProperty, draftToCreateInput } from "./sync";
import type { BookingLifecycle, OwnerDecision } from "./types";

const NAMES = [
  "Aarav Mehta", "Sneha Iyer", "Rohan Kapoor", "Priya Sharma", "Karthik Rao",
  "Ananya Singh", "Vikram Patel", "Meera Nair", "Aditya Joshi", "Ishita Verma",
  "Rahul Bose", "Tanvi Desai", "Siddharth Menon", "Kavya Reddy", "Arjun Pillai",
  "Diya Khanna", "Manish Gupta", "Riya Bhatt", "Yash Agrawal", "Pooja Shetty",
];
const COMPANIES = ["Razorpay", "Flipkart", "Swiggy", "Zomato", "Cred", "PhonePe", "Christ Univ.", "Manipal", "Infosys", "TCS"];

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

const STAGE_PLAN: { weight: number; status: BookingLifecycle; decision?: OwnerDecision; readyAll?: boolean; payAll?: boolean }[] = [
  { weight: 2, status: "shared_with_owner" },
  { weight: 2, status: "viewed_by_owner" },
  { weight: 3, status: "acknowledged", decision: "approve" },
  { weight: 2, status: "room_ready", decision: "approve", readyAll: true },
  { weight: 2, status: "move_in_approved", decision: "approve", readyAll: true, payAll: true },
  { weight: 2, status: "completed", decision: "approve", readyAll: true, payAll: true },
  { weight: 1, status: "rejected", decision: "reject" },
];

function pickStage() {
  const total = STAGE_PLAN.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of STAGE_PLAN) { if ((r -= p.weight) <= 0) return p; }
  return STAGE_PLAN[0];
}

/** Seed `count` demo bookings across up to `propertyCount` properties. */
export function simulateBookings(count = 50, propertyCount = 10) {
  const store = useOwnerBookings.getState();
  const pgs = [...PGS].sort(() => Math.random() - 0.5).slice(0, Math.min(propertyCount, PGS.length));
  const created: string[] = [];

  for (let i = 0; i < count; i++) {
    const pg = rand(pgs);
    let d = emptyDraft();
    d = applyProperty(d, pg);
    const name = rand(NAMES) + " " + String.fromCharCode(65 + (i % 26));
    d.customer = {
      name,
      phone: `+91 9${randInt(100000000, 999999999)}`,
      gender: Math.random() > 0.5 ? "male" : "female",
      occupation: Math.random() > 0.4 ? "working" : "student",
      companyOrCollege: rand(COMPANIES),
      emergencyName: "Emergency " + name.split(" ")[0],
      emergencyPhone: `+91 9${randInt(100000000, 999999999)}`,
    };
    d.inventory.floor = String(randInt(1, 4));
    d.inventory.roomNumber = `${randInt(101, 410)}`;
    d.inventory.bedNumber = rand(["A", "B", "C"]);
    d.rent = randInt(9, 22) * 1000;
    d.deposit = d.rent * 2;
    d.bookingAmt = randInt(2, 6) * 1000;
    const daysOut = randInt(-5, 14); // some past = checked in, some future
    d.moveIn.date = new Date(Date.now() + daysOut * 86400000).toISOString().slice(0, 10);
    d.specialRequests = Math.random() > 0.5
      ? [rand(["Quiet room", "Lower floor", "Veg-only floor", "Attached washroom", "Early check-in", "Extra mattress"])]
      : [];

    const booking = store.createBooking(
      draftToCreateInput(d, { createdBy: rand(["Ravi", "Aisha", "Karan", "Meera"]) }),
    );
    created.push(booking.id);

    // Advance through random stage
    const stage = pickStage();
    const fresh = useOwnerBookings.getState();
    fresh.shareWithOwner(booking.id, "system");
    if (stage.status === "shared_with_owner") continue;

    fresh.markViewed(booking.id, "owner:" + (pg.owner?.name ?? "owner"));
    if (stage.status === "viewed_by_owner") continue;

    if (stage.decision) {
      fresh.recordOwnerDecision(
        booking.id, stage.decision,
        stage.decision === "reject" ? rand(["Room under maintenance", "Owner unreachable", "Tenant conflict"]) :
        stage.decision === "approve_with_conditions" ? "Ready in 24h" : undefined,
        "owner:" + (pg.owner?.name ?? "owner"),
      );
    }
    if (stage.readyAll) fresh.markAllReady(booking.id, "owner:" + (pg.owner?.name ?? "owner"));

    if (stage.payAll) {
      const b2 = useOwnerBookings.getState().bookings.find((x) => x.id === booking.id);
      b2?.payments.forEach((p) => {
        if (p.status === "pending") useOwnerBookings.getState().markPaymentReceived(booking.id, p.id, "sales");
      });
    } else if (Math.random() > 0.5) {
      // partial payment
      const b2 = useOwnerBookings.getState().bookings.find((x) => x.id === booking.id);
      const first = b2?.payments.find((p) => p.status === "pending");
      if (first) useOwnerBookings.getState().markPaymentReceived(booking.id, first.id, "sales");
    }

    if (stage.status === "move_in_approved" || stage.status === "completed") {
      useOwnerBookings.getState().approveMoveIn(booking.id, "owner");
    }
    if (stage.status === "completed") {
      useOwnerBookings.getState().completeBooking(booking.id, "system");
    }
  }
  return created.length;
}

/** Wipe all bookings (keeps seed by re-hydrating store cleanly). */
export function clearAllBookings() {
  useOwnerBookings.setState({ bookings: [] });
}
