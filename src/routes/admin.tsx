import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ClientOnly } from "@/components/ClientOnly";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Super Admin — Gharpayy" }, { name: "description", content: "Single cockpit for every lead, visit, owner and person." }] }),
  // Admin views read from persisted zustand stores + Date.now() heavily; SSR
  // markup never matches client hydration. Render the entire admin subtree
  // only after mount to eliminate React #418 hydration errors.
  component: () => (
    <AppShell>
      <ClientOnly fallback={<div className="p-6 text-sm text-muted-foreground">Loading cockpit…</div>}>
        <Outlet />
      </ClientOnly>
    </AppShell>
  ),
});
