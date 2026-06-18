import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { OwnerRegistry } from "@/owner/pages/OwnerRegistry";

export const Route = createFileRoute("/owner/registry")({
  head: () => ({
    meta: [
      { title: "Owner Console — Gharpayy" },
      {
        name: "description",
        content:
          "Unified owner roster across both property hubs with auto-IDs and room-level controls.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <OwnerRegistry />
    </AppShell>
  ),
});
