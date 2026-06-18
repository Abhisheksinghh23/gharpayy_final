import { createFileRoute } from "@tanstack/react-router";
import { CheckInBoard } from "@/components/checkins/CheckInBoard";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/checkins")({
  head: () => ({
    meta: [
      { title: "Check-ins — War Room" },
      { name: "description", content: "Booked-to-moved-in pipeline with delay risk." },
    ],
  }),
  component: CheckInsPage,
});

function CheckInsPage() {
  return (
    <AppShell>
      <div className="p-4 space-y-4">
        <div>
          <h1 className="text-xl font-bold">Check-ins</h1>
          <p className="text-xs text-muted-foreground">
            From booked to settled. Tap a card to open the lead. Delay risk auto-scored.
          </p>
        </div>
        <CheckInBoard />
      </div>
    </AppShell>
  );
}
