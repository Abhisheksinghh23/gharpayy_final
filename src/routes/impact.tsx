import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ImpactQueueShell } from "@/components/impact/ImpactQueueShell";

export const Route = createFileRoute("/impact")({
  head: () => ({ meta: [{ title: "Impact Queue" }] }),
  component: () => <AppShell><ImpactQueueShell /></AppShell>,
});
