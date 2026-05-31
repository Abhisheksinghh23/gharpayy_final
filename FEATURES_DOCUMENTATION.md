# Gharpayy Operations CRM — Advanced SaaS Upgrade & Technical Documentation

This document provides a comprehensive technical deep-dive and operational guide for the advanced SaaS upgrades implemented in the **Gharpayy Operations CRM**. It details the business logic, state management triggers, file paths, and user interface elements for each feature.

---

## 🏗️ System Architecture Overview
The application is built using a modern, reactive stack optimized for low-latency operational workflows:
*   **Framework**: [Vite](https://vite.dev/) + [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
*   **Routing**: [TanStack Router](https://tanstack.com/router) (type-safe file-based router)
*   **State Management**: [Zustand](https://zustand.docs.pmnd.rs/) (centralized global state with persistence)
*   **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) (using CSS-first tokens and variables)
*   **Charts**: [Recharts](https://recharts.org/) (interactive, gradient-shaded SVG chart structures)
*   **Notifications**: [Sonner](https://github.com/emilkowalski/sonner) (customizable toast indicators)

---

## 🌟 Deep-Dive: Advanced Upgraded Features

### 1.  Bangalore Commute Optimizer
*   **Primary Files**: 
    *   [`src/components/leads/SupplyMatchPanel.tsx`](file:///c:/Users/shrib/OneDrive/Desktop/ops1g_submission/src/components/leads/SupplyMatchPanel.tsx) (Commute logic & UI widget)
    *   [`src/routes/supply-hub/match.tsx`](file:///c:/Users/shrib/OneDrive/Desktop/ops1g_submission/src/routes/supply-hub/match.tsx) (Commute matching algorithm page)
*   **Business Logic**:
    Calculates expected transit travel times and a proximity score (0-100) dynamically based on the lead's preferred landmark. It supports three transit profiles:
    *   **2-Wheeler (Bike)**: 
        *   `normalTime = distance * 2.2` mins, `peakTime = distance * 3.5` mins
        *   `Score = 100 - distance * 5.5`
    *   **Cab / Auto**: 
        *   `normalTime = distance * 3.2` mins, `peakTime = distance * 6.2` mins (simulating Silk Board bottlenecks)
        *   `Score = 100 - distance * 8.5`
    *   **Metro (Traffic-free)**: 
        *   `normalTime = 7m (walk time) + distance * 1.5 + 3m` (boarding delay)
        *   `peakTime = normalTime` (immune to traffic peak multipliers)
        *   `Score = 100 - normalTime * 1.6`
*   **How to Access**: 
    1. Open any lead drawer and select the **Best Fit** tab. Use the transit mode toggle (Bike / Cab / Metro) to dynamically re-calculate transit times and commute scores.
    2. Go to the **Matcher** screen `/supply-hub/match`, enter preferred parameters, select the travel mode, and click **Match** to see scores mapped to listings.

---

### 2. 💬 Objection Talk Script Battle-Cards
*   **Primary File**: 
    *   [`src/components/LeadControlPanel.tsx`](file:///c:/Users/shrib/OneDrive/Desktop/ops1g_submission/src/components/LeadControlPanel.tsx#L1044-L1062) (Contains the sales tracks script templates)
*   **Business Logic**:
    Surfaces copyable, context-appropriate sales scripts instantly in the lead drawer when a TCM logs a specific customer objection. Designed to counter standard tenant concerns:
    *   *Budget*: Breaks down total cost-of-living offsets (meals, daily cleaning, utilities, Wi-Fi included in rent vs. ₹6,000+ extra in standard apartments).
    *   *Location*: Highlights short commute times calculated by the Commute Optimizer.
    *   *Timing*: Warns of high peak-season demand and suggests a refundable ₹2,000 token deposit to lock in current rates.
    *   *Parents*: Reassures safety (24/7 CCTV, wardens, biometric access) and offers a direct video tour call with parents.
    *   *Comparing*: Highlights unique value-adds (0 brokerage, 6-hour SLA maintenance).
*   **How to Access**: 
    1. Open a lead card and click the **Control** tab.
    2. Click **Log Tour Outcome** (or edit an existing post-tour log).
    3. Choose a **Key objection** (e.g. *Budget*, *Parents*, *Timing*). The corresponding talk script block immediately slides into view with a **Copy Script** action.

---

### 3. ⚖️ TCM Capacity Load-Rebalancer
*   **Primary File**: 
    *   [`src/components/crm10x/ZoneBrain.tsx`](file:///c:/Users/shrib/OneDrive/Desktop/ops1g_submission/src/components/crm10x/ZoneBrain.tsx) (Workload calculations & divert generator)
*   **Business Logic**:
    Protects service levels by preventing sales reps (TCMs) from burning out. Tracks the count of active leads assigned to each agent:
    *   **Capacity Limit**: 8 active leads per agent.
    *   **High Load (Red)**: $\ge 6$ active leads (marked as Overloaded).
    *   **Underloaded (Blue)**: $\le 2$ active leads (Spare capacity available).
    *   **Rebalancing Algorithm**: When the operator clicks "Rebalance", the engine identifies all overloaded TCMs and maps them to available underloaded agents in the same or adjacent zones. It generates active bypass rules that temporarily reroute incoming leads.
*   **How to Access**: 
    1. Navigate to `/zone-brain` (link in the sidebar as "Zone Brain").
    2. Review the **TCM Heatmap & Diverter** card.
    3. Click **Run Load-Rebalancer** to view, simulate, and toggle bypass rules.

---

### 4. 🔍 GPS & Media Verification Auditor (with 360° Scan)
*   **Primary File**: 
    *   [`src/routes/supply-hub/$id.tsx`](file:///c:/Users/shrib/OneDrive/Desktop/ops1g_submission/src/routes/supply-hub/$id.tsx) (Draggable panoramic scan and audit logs)
*   **Business Logic**:
    Prevents owner fraud by showing compliance metadata (original photo device camera, GPS coordinates, verification signature) alongside an interactive **Simulated 360° Interior Room Scan**. Users drag a slider to pan the camera, revealing visual checks (Biometric lock, geyser, orthopaedic mattress) mapped to room coordinates.
*   **How to Access**: 
    1. Go to the **Supply Hub** page `/supply-hub` and click on any property item (e.g. `/supply-hub/pg-1`).
    2. Select the **Property Intel** tab and scroll to the bottom.
    3. Use the draggable slider on the **Simulated 360° Interior Room Scan** to rotate the room and verify amenities.

---

### 5. 🛠️ Demo Sandbox & SLA Stress Tester
*   **Primary Files**:
    *   [`src/myt/pages/SettingsPage.tsx`](file:///c:/Users/shrib/OneDrive/Desktop/ops1g_submission/src/myt/pages/SettingsPage.tsx#L37-L97) (Countdown state & breach dispatch)
    *   [`src/lib/store.ts`](file:///c:/Users/shrib/OneDrive/Desktop/ops1g_submission/src/lib/store.ts#L492-L614) (Database reset, seed and intake simulation methods)
*   **Business Logic**:
    Provides full control over mock datasets during pitches:
    *   **Reset Database**: Reverts the client-side database back to original defaults.
    *   **Seed 5 Leads**: Automatically creates 5 random leads across Bangalore.
    *   **Simulate Lead Intake**: Creates a live lead in the list to trigger active TCM routing.
    *   **SLA Stress Tester**: Spawns a new lead and starts a 5-second countdown timer. If left uncontacted, it generates an SLA breach notification, adds a system audit activity log, triggers handoff notifications, and fires an error toast indicating response delays.
*   **How to Access**: 
    1. Navigate to **Settings** (`/settings`) and click the **Demo Sandbox** tab.
    2. Click **Reset Database State** or **Seed 5 Leads**.
    3. Click **Launch SLA Test** to witness the countdown and resulting alarm triggers.

---

### 6. 🤖 AI Call Compliance & Sentiment Analyzer
*   **Primary File**: 
    *   [`src/components/LeadControlPanel.tsx`](file:///c:/Users/shrib/OneDrive/Desktop/ops1g_submission/src/components/LeadControlPanel.tsx) (Tab widget & waveform state)
*   **Business Logic**:
    Leverages simulated AI models to audit phone conversations. It renders:
    *   An interactive audio waveform player with play/pause and scrub controls.
    *   A sentiment scorecard displaying positive, neutral, and negative speech ratios.
    *   A checklist tracking key conversational compliance criteria (Identity Verification, Location confirmation, Budget confirmation).
    *   A speech transcription log highlighting keywords.
*   **How to Access**: 
    1. Open any lead card in the dashboard or leads table.
    2. Select the **AI Audit** tab (highlighted in red/orange text at the top-right of the tabs bar).
    3. Press the **Play** button on the call player to watch the waveform update in real-time.

---

### 7. 📡 Live TCM Operations Dispatch Radar
*   **Primary File**: 
    *   [`src/components/crm10x/ZoneBrain.tsx`](file:///c:/Users/shrib/OneDrive/Desktop/ops1g_submission/src/components/crm10x/ZoneBrain.tsx) (Compass math, state, and setTimeout timelines)
*   **Business Logic**:
    Visualizes TCM field locations inside Bangalore using trigonometric plots. It maps angles and radii into 2D coordinates on an SVG radar circle:
    *   **Agent Coordinate Mapping**: Converts indices into circular angles:
        $$x = 50 + radius \times \cos(angle) \times 0.45$$
        $$y = 50 + radius \times \sin(angle) \times 0.45$$
    *   **Live Sweep**: Radial sweep animation styled with conic gradients spinning constantly.
    *   **Pulsating Status Markers**: Pulsates agent dots colored by status: Green (Idle), Blue (En-route), Pink (Conducting Tour), Grey (Offline).
    *   **Route Simulation**: Clicking **Deploy** updates statuses through timed intervals (En-route ➔ Arrived ➔ Conducting Tour ➔ Completed ➔ Idle) and updates the global system logs.
*   **How to Access**: 
    1. Go to the **Zone Brain** page `/zone-brain`.
    2. Observe the **Live Dispatch Radar** card. Select an **Idle** TCM agent, choose a destination, and click **Deploy**.

---

## 📊 Core Platform Upgrades & Enhancements

### 8. Interactive Recharts SVG Analytics
*   **Primary Files**: 
    *   [`src/routes/revenue.tsx`](file:///c:/Users/shrib/OneDrive/Desktop/ops1g_submission/src/routes/revenue.tsx) (Revenue gradient area chart)
    *   [`src/components/crm10x/ManagerDashboard.tsx`](file:///c:/Users/shrib/OneDrive/Desktop/ops1g_submission/src/components/crm10x/ManagerDashboard.tsx) (Bar charts)
*   **Description**:
    Replaces static components with rich, interactive SVG charts:
    *   **Revenue Page (`/revenue`)**: Renders a custom Recharts Area Chart displaying MRR growth over time. Includes linear gradients, custom tooltip triggers on hover, and active axis keys.
    *   **Manager Portal (`/manager`)**: Features vertical and horizontal Bar Charts breakdown of sales funnels, conversion losses, and objections.

### 9. Checkbox Bulk Actions & CSV Exporting
*   **Primary Files**: 
    *   [`src/routes/leads.tsx`](file:///c:/Users/shrib/OneDrive/Desktop/ops1g_submission/src/routes/leads.tsx) (Checkbox selection & floating action bar)
    *   [`src/lib/export.ts`](file:///c:/Users/shrib/OneDrive/Desktop/ops1g_submission/src/lib/export.ts) (Tabular formatter utility)
*   **Description**:
    *   **Bulk Operations**: Operators select multiple lead items via table checkboxes to trigger a floating actions bar sliding up from the bottom. Supports bulk TCM re-assignment, bulk stage transitions, and bulk deletion.
    *   **CSV Downloader**: Export data tables directly with one click on the Leads page (`/leads` ➔ Export Leads) or Revenue page (`/revenue` ➔ Export Bookings).

### 10. Smart Copilot Recommendations
*   **Primary File**: 
    *   [`src/routes/dashboard.tsx`](file:///c:/Users/shrib/OneDrive/Desktop/ops1g_submission/src/routes/dashboard.tsx) (Anomaly checkers & actions)
*   **Description**:
    Displays warning chips when pipeline anomalies occur (e.g. leads idle $\gt 4$ days, completed tours missing outcome updates, and high vacancy ratios). Provides direct action triggers to resolve issues immediately.

### 11. Native HTML5 Kanban Drag-and-Drop
*   **Primary File**: 
    *   [`src/myt/pages/Pipeline.tsx`](file:///c:/Users/shrib/OneDrive/Desktop/ops1g_submission/src/myt/pages/Pipeline.tsx) (Drag event listeners)
*   **Description**:
    Enables dragging lead cards between Kanban columns to update pipeline stages directly inside the Zustand store.

### 12. Routing Diagnostics & Glassmorphic 404 Pages
*   **Primary Files**: 
    *   [`src/routes/__root.tsx`](file:///c:/Users/shrib/OneDrive/Desktop/ops1g_submission/src/routes/__root.tsx) (Sidebar layout navigation)
    *   [`src/routes/dashboard.tsx`](file:///c:/Users/shrib/OneDrive/Desktop/ops1g_submission/src/routes/dashboard.tsx) (Custom NotFound fallback configuration)
*   **Description**:
    *   **Diagnostics Sidebar**: Integrates links for **System Health** (`/health`) and **Activity Log** (`/activity`) directly in the navigation menu.
    *   **Premium 404 Screen**: Displays a glassmorphic vector layout with returning routes when users visit invalid URLs.
