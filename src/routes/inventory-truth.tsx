import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { SalesInventoryTruth } from "@/owner/pages/SalesInventoryTruth";

export const Route = createFileRoute("/inventory-truth")({
  head: () => ({
    meta: [
      { title: "Sales Inventory Truth — Gharpayy" },
      {
        name: "description",
        content:
          "Every sellable room across both property hubs, owner-confirmed, with Room IDs ready for visits and blocks.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <SalesInventoryTruth />
    </AppShell>
  ),
});
