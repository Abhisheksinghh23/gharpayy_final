import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Target, CalendarPlus, ClipboardList, Boxes, Activity,
  Building2, Search, Sun, Command, Trophy, Sparkles, MessageSquare,
  IndianRupee, MapPin, Zap, Users, Home, Calendar, Store, Swords, Settings, AlertTriangle,
  ShieldCheck, Inbox, Camera, HelpCircle, Layers, HeartPulse,
  Rocket,
} from "lucide-react";
import { NotificationCenter } from "./NotificationCenter";
import { ProfileMenu } from "./ProfileMenu";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ReactNode } from "react";
import { LeadControlPanel } from "./LeadControlPanel";
import { CommandPalette } from "./CommandPalette";
import { CoachWidget } from "./CoachWidget";
import { useNow, useMountedNow } from "@/hooks/use-now";
import { buildDoNextQueue } from "@/lib/engine";
import { useGame, whoKey } from "@/lib/gamification";
import { useCRM10x } from "@/lib/crm10x/store";
import { useEffect, useMemo, useState } from "react";
import { PictureInPictureProvider, PipMount, usePip } from "./pip/PipProvider";
import { PipButton } from "./pip/PipButton";
import { usePipRouteSync } from "./pip/usePipSync";
import { ClientOnly } from "./ClientOnly";
import { useOwner } from "@/owner/owner-context";
import { LiveTaskTimer } from "./tti/LiveTaskTimer";

function PipRouteSyncBridge() {
  const { active } = usePip();
  usePipRouteSync(active);
  return null;
}

type NavItem = { to: string; label: string; icon: typeof Target; badge?: number; accent?: boolean; section?: string };

const DEFAULT_SECTION = "More";
const SECTION_ORDER = ["Daily Run", "Lead Mgmt", "Supply", "Ops", "Admin", "More"];

function useCollapsedSections(roleKey: string) {
  const storageKey = `nav-collapsed:${roleKey}`;
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setCollapsed(JSON.parse(raw));
    } catch {}
  }, [storageKey]);
  const toggle = (sec: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [sec]: !prev[sec] };
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });
  };
  return [collapsed, toggle] as const;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { role, setRole, currentTcmId, setCurrentTcmId, tcms, leads, tours, followUps, handoffs, bookings } = useApp();
  const { owners, currentOwnerId, setCurrentOwnerId, blocks } = useOwner();
  const router = useRouterState();
  const path = router.location.pathname;
  const [now, mounted] = useMountedNow();

  const filterTcm = role === "tcm" ? currentTcmId : undefined;
  const queue = useMemo(
    () => (mounted ? buildDoNextQueue(leads, tours, followUps, now, filterTcm) : []),
    [leads, tours, followUps, now, filterTcm, mounted],
  );
  const overdueCount = mounted ? followUps.filter((f) => !f.done && +new Date(f.dueAt) <= now).length : 0;
  const incompletePostTour = tours.filter((t) => t.status === "completed" && !t.postTour.filledAt).length;
  const unreadHandoffs = handoffs.filter((h) => !h.read && h.to === role).length;
  const ownerPendingBlocks = blocks.filter((b) => b.ownerId === currentOwnerId && b.state === "pending").length;

  // Booking XP awarder — credit the TCM once per booking id.
  // Both awardXp and registerBooking are idempotent via persisted dedupe keys,
  // so safe to re-run across remounts.
  const awardXp = useGame((s) => s.awardXp);
  const registerBooking = useGame((s) => s.registerBooking);
  const rolloverIfNeeded = useGame((s) => s.rolloverIfNeeded);
  useEffect(() => {
    if (!mounted) return;
    bookings.forEach((b) => {
      const who = whoKey("tcm", b.tcmId);
      awardXp(who, 100, `booking:${b.id}`);
      registerBooking(who, b.id);
    });
  }, [bookings, mounted, awardXp, registerBooking]);

  // Daily rollover for the active user.
  useEffect(() => {
    if (!mounted) return;
    rolloverIfNeeded(whoKey(role, currentTcmId));
  }, [mounted, role, currentTcmId, rolloverIfNeeded]);

  // Attribute prior WhatsApp sends to bookings (ROI for templates).
  // Guard: only matching leadId, only sends BEFORE the booking, only within 14d
  // window — the store enforces this and never re-credits a message twice.
  const markMessageBookedAfter = useCRM10x((s) => s.markMessageBookedAfter);
  useEffect(() => {
    if (!mounted) return;
    bookings.forEach((b) => markMessageBookedAfter(b.leadId, b.id, b.ts));
  }, [bookings, mounted, markMessageBookedAfter]);

  const navByRole: Record<typeof role, NavItem[]> = {
    hr: [
      { to: "/today", label: "Today", icon: Sun, badge: queue.length, section: "Daily Run" },
      { to: "/impact", label: "Impact Queue", icon: Rocket, accent: true, section: "Daily Run" },
      { to: "/execution", label: "Execution", icon: Zap, accent: true, section: "Daily Run" },
      { to: "/visit-war", label: "Visit War Room", icon: Activity, accent: true, section: "Daily Run" },
      { to: "/atc", label: "ATC War Room", icon: AlertTriangle, accent: true, section: "Daily Run" },
      { to: "/calendar", label: "Calendar", icon: Calendar, section: "Daily Run" },
      { to: "/coach", label: "Coach", icon: Sparkles, accent: true, section: "Daily Run" },

      { to: "/myt", label: "HR Tower", icon: Home, section: "Lead Mgmt" },
      { to: "/myt/funnel", label: "Funnel", icon: Activity, section: "Lead Mgmt" },
      { to: "/myt/team", label: "Team", icon: Users, section: "Lead Mgmt" },
      { to: "/myt/zones", label: "Zones", icon: MapPin, section: "Lead Mgmt" },
      { to: "/inbox", label: "Inbox", icon: Inbox, section: "Lead Mgmt" },

      { to: "/property-hub", label: "Property Hub", icon: Building2, accent: true, section: "Supply" },
      { to: "/supply-hub", label: "Supply Hub", icon: Layers, accent: true, section: "Supply" },
      { to: "/supply-hub/match", label: "Lead Matcher", icon: Sparkles, section: "Supply" },
      { to: "/supply-hub/areas", label: "Area Mood", icon: MapPin, section: "Supply" },
      { to: "/myt/owners-compare", label: "Owners", icon: ShieldCheck, section: "Supply" },
      { to: "/owner-accounts", label: "Owner Accounts", icon: ShieldCheck, accent: true, section: "Supply" },

      { to: "/myt/war-room", label: "War Room", icon: Swords, section: "Ops" },
      { to: "/manager", label: "Manager Dash", icon: Activity, accent: true, section: "Ops" },
      { to: "/queue", label: "Action Queue", icon: Zap, accent: true, section: "Ops" },
      { to: "/zone-brain", label: "Zone Brain", icon: MapPin, accent: true, section: "Ops" },
      { to: "/activity", label: "Activity", icon: Activity, section: "Ops" },

      { to: "/myt/leaderboard", label: "Leaderboard", icon: Trophy, section: "Admin" },
      { to: "/leaderboard", label: "Closer Board", icon: Trophy, section: "Admin" },
      { to: "/revenue", label: "Revenue", icon: IndianRupee, section: "Admin" },
      { to: "/myt/bookings", label: "Bookings", icon: ClipboardList, section: "Admin" },
      { to: "/owner-bookings", label: "Owner Bookings", icon: ClipboardList, accent: true, section: "Admin" },
      { to: "/admin/property-bookings", label: "Property-wise Bookings", icon: Building2, accent: true, section: "Admin" },
      { to: "/myt/settings", label: "Settings", icon: Settings, section: "Admin" },
      { to: "/admin/productivity", label: "Task Time Intel", icon: Activity, accent: true, section: "Admin" },
      { to: "/my/productivity", label: "My Speed", icon: Rocket, accent: true, section: "Admin" },
      { to: "/health", label: "System Health", icon: HeartPulse, section: "Admin" },
      { to: "/help", label: "How to use", icon: HelpCircle, section: "Admin" },
    ],
    "flow-ops": [
      { to: "/today", label: "Today", icon: Sun, badge: queue.length, section: "Daily Run" },
      { to: "/impact", label: "Impact Queue", icon: Rocket, accent: true, section: "Daily Run" },
      { to: "/execution", label: "Execution", icon: Zap, accent: true, section: "Daily Run" },
      { to: "/visit-war", label: "Visit War Room", icon: Activity, accent: true, section: "Daily Run" },
      { to: "/calendar", label: "Calendar", icon: Calendar, section: "Daily Run" },
      { to: "/coach", label: "Coach", icon: Sparkles, accent: true, section: "Daily Run" },

      { to: "/leads", label: "Leads", icon: Target, section: "Lead Mgmt" },
      { to: "/myt/leads", label: "MYT Leads", icon: Target, section: "Lead Mgmt" },
      { to: "/inbox", label: "Inbox", icon: Inbox, section: "Lead Mgmt" },
      { to: "/myt/schedule", label: "Schedule Tour", icon: CalendarPlus, section: "Lead Mgmt" },
      { to: "/myt/drafts", label: "Drafts", icon: ClipboardList, section: "Lead Mgmt" },
      { to: "/owner-bookings", label: "Owner Bookings", icon: ClipboardList, accent: true, section: "Lead Mgmt" },

      { to: "/property-hub", label: "Property Hub", icon: Building2, accent: true, section: "Supply" },
      { to: "/supply-hub", label: "Supply Hub", icon: Layers, accent: true, section: "Supply" },
      { to: "/supply-hub/match", label: "Lead Matcher", icon: Sparkles, section: "Supply" },
      { to: "/supply-hub/areas", label: "Area Mood", icon: MapPin, section: "Supply" },
      { to: "/myt/properties", label: "Properties", icon: Building2, section: "Supply" },
      { to: "/myt/marketplace", label: "Marketplace", icon: Store, section: "Supply" },

      { to: "/myt/flow-ops", label: "Flow Ops", icon: LayoutDashboard, section: "Ops" },
      { to: "/myt/mismatch", label: "Mismatches", icon: AlertTriangle, badge: 0, section: "Ops" },
      { to: "/sequences", label: "Sequences", icon: Zap, section: "Ops" },
      { to: "/revival", label: "Revival", icon: Sparkles, section: "Ops" },
      { to: "/queue", label: "Action Queue", icon: Zap, accent: true, section: "Ops" },
      { to: "/zone-brain", label: "Zone Brain", icon: MapPin, accent: true, section: "Ops" },

      { to: "/health", label: "System Health", icon: HeartPulse, section: "Admin" },
      { to: "/my/productivity", label: "My Speed", icon: Rocket, accent: true, section: "Admin" },
      { to: "/help", label: "How to use", icon: HelpCircle, section: "Admin" },
    ],
    tcm: [
      { to: "/today", label: "Today", icon: Sun, badge: queue.length, section: "Daily Run" },
      { to: "/impact", label: "Impact Queue", icon: Rocket, accent: true, section: "Daily Run" },
      { to: "/execution", label: "Execution", icon: Zap, accent: true, section: "Daily Run" },
      { to: "/visit-war", label: "Visit War Room", icon: Activity, accent: true, section: "Daily Run" },
      { to: "/calendar", label: "Calendar", icon: Calendar, section: "Daily Run" },
      { to: "/coach", label: "Coach", icon: Sparkles, accent: true, section: "Daily Run" },

      { to: "/myt/tcm", label: "TCM Desk", icon: Target, section: "Lead Mgmt" },
      { to: "/inbox", label: "Inbox", icon: Inbox, section: "Lead Mgmt" },
      { to: "/follow-ups", label: "Follow-ups", icon: ClipboardList, badge: overdueCount, section: "Lead Mgmt" },
      { to: "/handoffs", label: "Handoffs", icon: MessageSquare, badge: unreadHandoffs, section: "Lead Mgmt" },
      { to: "/myt/schedule", label: "Schedule Tour", icon: CalendarPlus, section: "Lead Mgmt" },
      { to: "/owner-bookings", label: "Owner Bookings", icon: ClipboardList, accent: true, section: "Lead Mgmt" },

      { to: "/property-hub", label: "Property Hub", icon: Building2, accent: true, section: "Supply" },
      { to: "/supply-hub", label: "Supply Hub", icon: Layers, accent: true, section: "Supply" },
      { to: "/supply-hub/match", label: "Lead Matcher", icon: Sparkles, section: "Supply" },
      { to: "/supply-hub/areas", label: "Area Mood", icon: MapPin, section: "Supply" },
      { to: "/myt/marketplace", label: "Marketplace", icon: Store, section: "Supply" },

      { to: "/tours", label: "My Tours", icon: CalendarPlus, badge: incompletePostTour, section: "Ops" },
      { to: "/myt/tours", label: "All Tours", icon: CalendarPlus, section: "Ops" },
      { to: "/myt/tcm/actions", label: "Actions", icon: Zap, section: "Ops" },
      { to: "/queue", label: "Action Queue", icon: Zap, accent: true, section: "Ops" },
      { to: "/zone-brain", label: "Zone Brain", icon: MapPin, section: "Ops" },

      { to: "/myt/tcm/performance", label: "My Stats", icon: Activity, section: "Admin" },
      { to: "/my/productivity", label: "My Speed", icon: Rocket, accent: true, section: "Admin" },
      { to: "/myt/score", label: "Score", icon: Trophy, section: "Admin" },
      { to: "/health", label: "System Health", icon: HeartPulse, section: "Admin" },
      { to: "/help", label: "How to use", icon: HelpCircle, section: "Admin" },
    ],
    owner: [
      { to: "/owner-portal", label: "My Portal", icon: ShieldCheck, accent: true, section: "Daily Run" },
      { to: "/owner", label: "Owner Desk", icon: ShieldCheck, accent: true, section: "Daily Run" },
      { to: "/owner/rooms", label: "Update Rooms", icon: Boxes, accent: true, section: "Daily Run" },
      { to: "/owner/blocks", label: "Room Blocks", icon: Inbox, badge: ownerPendingBlocks, section: "Daily Run" },
      { to: "/owner/booking-approvals", label: "Booking Approvals", icon: ClipboardList, accent: true, section: "Daily Run" },
      { to: "/owner/visits", label: "Visits", icon: CalendarPlus, section: "Daily Run" },
      { to: "/owner-accounts", label: "Switch Owner", icon: ShieldCheck, section: "Daily Run" },
      { to: "/inbox", label: "Inbox", icon: Inbox, section: "Daily Run" },
      { to: "/inventory-truth", label: "Inventory Truth", icon: Layers, accent: true, section: "Daily Run" },
      { to: "/coach", label: "Coach", icon: Sparkles, accent: true, section: "Daily Run" },

      { to: "/owner/inventory", label: "My Inventory", icon: Building2, section: "Supply" },
      { to: "/owner/registry", label: "Owner Directory", icon: ShieldCheck, section: "Admin" },

      { to: "/owner/insights", label: "Insights", icon: IndianRupee, section: "Admin" },
      { to: "/my/productivity", label: "My Speed", icon: Rocket, accent: true, section: "Admin" },
      { to: "/help", label: "How to use", icon: HelpCircle, section: "Admin" },
    ],
    admin: [
      { to: "/admin", label: "Cockpit", icon: LayoutDashboard, accent: true, section: "Daily Run" },
      { to: "/admin/supreme", label: "Supreme · God Mode", icon: Sparkles, accent: true, section: "Daily Run" },
      { to: "/admin/command", label: "Command Bridge", icon: Command, accent: true, section: "Daily Run" },
      { to: "/admin/war-room", label: "War-Room TV", icon: Activity, accent: true, section: "Daily Run" },

      { to: "/admin/leads", label: "Master Leads", icon: Target, accent: true, section: "Lead Mgmt" },
      { to: "/admin/visits", label: "Master Visits", icon: Activity, accent: true, section: "Lead Mgmt" },
      { to: "/admin/calendar", label: "Master Calendar", icon: Calendar, section: "Lead Mgmt" },
      { to: "/admin/people", label: "People 360°", icon: Users, section: "Lead Mgmt" },

      { to: "/admin/owners", label: "Master Owners", icon: Building2, section: "Supply" },

      { to: "/admin/intelligence", label: "Intelligence", icon: Sparkles, accent: true, section: "Ops" },
      { to: "/admin/exports", label: "Export Center", icon: ClipboardList, accent: true, section: "Ops" },

      { to: "/admin/impact", label: "Impact Command", icon: Rocket, accent: true, section: "Admin" },
      { to: "/admin/audit", label: "Audit Log", icon: ShieldCheck, section: "Admin" },
      { to: "/admin/productivity", label: "Task Time Intelligence", icon: Activity, accent: true, section: "Admin" },
      { to: "/admin/settings", label: "Admin Settings", icon: Settings, section: "Admin" },
      { to: "/help", label: "How to use", icon: HelpCircle, section: "Admin" },
    ],
  };
  const items = navByRole[role];
  const [collapsedSections, toggleSection] = useCollapsedSections(role);

  const grouped = useMemo(() => {
    const map = new Map<string, NavItem[]>();
    items.forEach((it) => {
      const sec = it.section ?? DEFAULT_SECTION;
      if (!map.has(sec)) map.set(sec, []);
      map.get(sec)!.push(it);
    });
    return SECTION_ORDER.filter((s) => map.has(s)).map((s) => ({ section: s, items: map.get(s)! }));
  }, [items]);

  const isActive = (to: string) => (to === "/" ? path === "/" : path === to || path.startsWith(to + "/"));

  return (
    <PictureInPictureProvider>
      <PipRouteSyncBridge />
      <div className="min-h-screen flex w-full bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden md:flex w-[240px] flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border sticky top-0 h-screen">
        <div className="px-5 py-5 flex items-center gap-2 border-b border-sidebar-border">
          <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center">
            <Building2 className="h-4 w-4 text-accent-foreground" />
          </div>
          <div className="leading-tight">
            <div className="text-sidebar-accent-foreground font-display font-semibold text-sm">Gharpayy</div>
            <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground">Arena Infrastructure</div>
          </div>
        </div>

        {(() => {
          const roleMeta = {
            "flow-ops": { label: "Flow Ops", dot: "bg-info" },
            tcm: { label: "TCM Desk", dot: "bg-accent" },
            hr: { label: "HR / Leadership", dot: "bg-success" },
            owner: { label: "Owner Portal", dot: "bg-warning" },
            admin: { label: "Super Admin", dot: "bg-destructive" },
          } as const;
          const meta = roleMeta[role];
          const userName = role === "tcm" ? tcms.find((t) => t.id === currentTcmId)?.name : null;
          return (
            <div className="px-5 pt-4 pb-2">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-sidebar-foreground/70 font-semibold">
                <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                <span>{meta.label}</span>
                {userName && <span className="text-sidebar-foreground/50 normal-case tracking-normal">· {userName.split(" ")[0]} {userName.split(" ")[1]?.[0] ?? ""}.</span>}
              </div>
            </div>
          );
        })()}

        <nav className="flex-1 px-3 py-2 space-y-3 overflow-y-auto scrollbar-thin">
          {grouped.map((g) => {
            const isCollapsed = !!collapsedSections[g.section];
            const sectionHasActive = g.items.some((it) => isActive(it.to));
            return (
              <div key={g.section} className="space-y-0.5">
                <button
                  onClick={() => toggleSection(g.section)}
                  className="w-full flex items-center justify-between px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
                >
                  <span>{g.section}</span>
                  <span className={cn("transition-transform text-[8px]", isCollapsed ? "" : "rotate-90")}>▶</span>
                </button>
                {(!isCollapsed || sectionHasActive) && g.items.map((it) => {
                  const Icon = it.icon;
                  const active = isActive(it.to);
                  return (
                    <Link
                      key={it.to}
                      to={it.to}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                        it.accent && !active && "text-accent",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{it.label}</span>
                      {it.badge !== undefined && it.badge > 0 && mounted && (
                        <span className={cn(
                          "ml-auto text-[10px] rounded-full px-1.5 py-0.5 font-mono",
                          it.accent
                            ? "bg-accent text-accent-foreground"
                            : "bg-destructive text-destructive-foreground",
                        )}>
                          {it.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>


        <div className="p-3 border-t border-sidebar-border space-y-2">
          <div className="text-[10px] text-sidebar-foreground/70 flex items-center justify-between px-1">
            <span>Quick jump</span>
            <kbd className="inline-flex items-center gap-0.5 rounded border border-sidebar-border bg-sidebar-accent px-1.5 py-0.5 font-mono text-sidebar-accent-foreground">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </div>
          <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground px-1">View as</div>
          {/* Wrapped in ClientOnly: a browser extension rewrites native
              <select> nodes before hydration, causing hydration mismatches
              that surface as "try again". Render after mount to dodge it. */}
          <ClientOnly fallback={<div className="h-8 rounded-md bg-sidebar-accent/40" />}>
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
              <SelectTrigger className="bg-sidebar-accent border-sidebar-border text-sidebar-accent-foreground h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flow-ops">Flow Ops</SelectItem>
                <SelectItem value="tcm">TCM</SelectItem>
                <SelectItem value="hr">HR / Leadership</SelectItem>
                <SelectItem value="owner">Property Owner</SelectItem>
                <SelectItem value="admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
            {role === "tcm" && (
              <Select value={currentTcmId} onValueChange={setCurrentTcmId}>
                <SelectTrigger className="bg-sidebar-accent border-sidebar-border text-sidebar-accent-foreground h-8 text-xs mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tcms.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {role === "owner" && (
              <Select value={currentOwnerId ?? owners[0]?.id ?? ""} onValueChange={(v) => setCurrentOwnerId(v)}>
                <SelectTrigger className="bg-sidebar-accent border-sidebar-border text-sidebar-accent-foreground h-8 text-xs mt-2">
                  <SelectValue placeholder="Switch owner" />
                </SelectTrigger>
                <SelectContent>
                  {owners.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </ClientOnly>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-14 bg-background/85 backdrop-blur border-b border-border flex items-center gap-3 px-4 md:px-6">
          <div className="md:hidden font-display font-semibold">Gharpayy</div>
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
            className="md:hidden inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground"
            aria-label="Open command palette"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
            className="hidden md:flex items-center gap-2 h-8 px-3 rounded-md border border-border bg-card hover:bg-muted/60 text-xs text-muted-foreground w-full max-w-md transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Jump to lead, page or action…</span>
            <kbd className="ml-auto inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <PipButton />
            <NotificationCenter role={role} />
            <ProfileMenu />
          </div>
        </header>

        <PipMount>
          <main className="flex-1 w-full max-w-[1400px] mx-auto p-4 pb-24 md:p-6 md:pb-6">{children}</main>
        </PipMount>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-stretch gap-1 overflow-x-auto px-2 py-2 scrollbar-thin scroll-smooth snap-x">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "relative flex shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-md px-3 py-1.5 text-[10px] font-medium transition-colors min-w-[64px] min-h-[44px]",
                  active ? "bg-accent/10 text-accent" : "text-muted-foreground hover:bg-muted/60",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="whitespace-nowrap">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && mounted && (
                  <span className="absolute right-1 top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-mono text-destructive-foreground">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Overlays */}
      <LeadControlPanel />
      <CommandPalette />
      <CoachWidget />
      <LiveTaskTimer />
      </div>
    </PictureInPictureProvider>
  );
}
