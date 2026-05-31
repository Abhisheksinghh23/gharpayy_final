# Gharpayy Operations CRM — SaaS Upgrade & Feature Guide

Welcome to the upgraded, production-ready version of the Gharpayy Operations CRM! This document outlines all the advanced SaaS features added to the application and provides instructions on how to access and demo them.

---

## 🚀 How to Run and Access the App

### 1. Run the Server
If the server is not already running, open your terminal in the project root directory and run:
```bash
npm run dev
```

### 2. Access the Application
The development server runs on port **8080**:
*   **Main URL**: [http://localhost:8080/](http://localhost:8080/)

---

## 🌟 Advanced Upgraded Features (Recruiter Demo Checklist)

Below is the list of all the upgraded modules, what they do, and how to verify them live in the browser.

### 1. 🏍️ Bangalore Commute Optimizer
*   **Purpose**: Helps operators find optimal properties for leads based on real commute modes, traffic bottlenecks, and travel times.
*   **How it works**: Uses landmark proximity to estimate travel times dynamically. Offers options for **2-Wheeler (Bike)**, **Cab/Auto**, and **Metro (Traffic-free)** transit. Generates a weighted **Commute Score (0-100)**.
*   **Where to access**:
    *   **Interactive Form**: Go to [http://localhost:8080/supply-hub/match](http://localhost:8080/supply-hub/match), enter a wanted area (e.g. `Koramangala` or `Manyata`), select a transit mode, and click **Match**.
    *   **Lead Profile Drawer**: Open any lead card in the CRM. Under the **Best Fit** matching tab, select a transit mode (Bike, Cab, Metro) to dynamically recalculate travel times and commute scores.

### 2. 💬 Objection Talk Script Battle-Cards
*   **Purpose**: Guides TCM agents during calls by giving them instant copyable, context-appropriate responses to objections.
*   **How it works**: Displays dynamic sales speech tracks tailored to the specific objection code selected (e.g. Budget breakdown, Parents safety concerns, Timing/Scarcity).
*   **Where to access**:
    *   Open any lead drawer.
    *   Under the **Control** tab, click **Log Tour Outcome** (or edit an existing completed tour outcome).
    *   Select a **Key objection** (e.g., *Budget* or *Parents*).
    *   Review the talk track box that appears instantly, and click **Copy Script** to copy it.

### 3. ⚖️ TCM Capacity Load-Rebalancer
*   **Purpose**: Protects service quality by analyzing TCM active workloads and simulating re-routing rules during high-load periods.
*   **How it works**: Aggregates active leads per agent and displays them in a visual heatmap. Runs a simulation pairing overloaded agents (>5 active leads) with underloaded agents to divert routing rules.
*   **Where to access**:
    *   Navigate to [http://localhost:8080/zone-brain](http://localhost:8080/zone-brain).
    *   View the **TCM Capacity Heatmap & Diverter** card.
    *   Click **Run Load-Rebalancer** to simulate and enforce active lead divert rules.

### 4. 🔍 GPS & Media Verification Auditor (with 360° Scan)
*   **Purpose**: Ensures owner-submitted listings are genuine, GPS-accurate, and structurally correct.
*   **How it works**: Displays audit details (camera model, GPS verification tag, signature) and embeds a simulated 360° panorama room viewer. Sliding panned angles lets you inspect bedroom items (Biometric locks, mattresses, geysers).
*   **Where to access**:
    *   Go to the Supply Hub inventory page and click on any property (e.g., [http://localhost:8080/supply-hub/pg-1](http://localhost:8080/supply-hub/pg-1)).
    *   Under the **Property Intel** tab, scroll to the bottom to find the **GPS & Media Verification Audit Log**.
    *   Drag the **Simulated 360° Interior Room Scan** slider to pan through the room and read points of interest.

### 5. 🛠️ Demo Sandbox & SLA Stress Tester
*   **Purpose**: Provides single-click actions to reset, seed, and stress-test the CRM during product pitches.
*   **How it works**:
    *   *Reset State*: Restores CRM records to defaults.
    *   *Seed Leads*: Pre-populates 5 random leads across Bangalore zones.
    *   *Simulate Intake*: Injects a live lead registering.
    *   *SLA Stress Test*: Starts a 5s countdown on a new lead. Once expired, it forces a timeout, logs an SLA breach, logs system actions, and triggers emergency toast warnings.
*   **Where to access**:
    *   Go to Settings: [http://localhost:8080/settings](http://localhost:8080/settings).
    *   Select the **Demo Sandbox** tab.
    *   Click **Launch SLA Test** to watch the countdown trigger breach notifications.

### 6. 🤖 AI Call Compliance & Sentiment Analyzer
*   **Purpose**: Audits sales team calls using simulated speech models to verify script compliance and analyze buyer sentiment.
*   **How it works**: Renders a simulated audio waveform player with play/pause and progress controls. Highlights positive, neutral, and negative sentiment ratios in a visual color scale, tracks checklist requirements (Welcome verified, Location confirmed, Budget limit checked), and shows a scrollable transcription log with key sales speech tags.
*   **Where to access**:
    *   Open any lead drawer (e.g. at [http://localhost:8080/leads](http://localhost:8080/leads) or [http://localhost:8080/dashboard](http://localhost:8080/dashboard)).
    *   Click on the **AI Audit** tab (the 8th tab at the top-right of the drawer).
    *   Click the Play button on the waveform player to preview simulated call compliance auditing.

### 7. 📡 Live TCM Operations Dispatch Radar
*   **Purpose**: Monitors live coordinates of field operations agents on an animated radar screen and permits managers to deploy agents to walk-in requests.
*   **How it works**: Renders a circular glowing SVG radar scanner with compass coordinates and dynamic markers representing field agents. Selecting an idle agent and clicking **Deploy** simulates live route transit routing, computes transit ETAs across Bangalore, triggers Sonner alerts, and logs events inside the global system activity feed.
*   **Where to access**:
    *   Navigate to [http://localhost:8080/zone-brain](http://localhost:8080/zone-brain).
    *   View the **Live Dispatch Radar** card next to the Heatmap.
    *   Select an **Idle** TCM agent, choose a target option, and click **Deploy** to initiate the dispatch routing simulation.

---

## 🚀 Additional Core SaaS Upgrades Implemented

In addition to the 7 custom advanced tools above, we have overhauled the core system flow with the following upgrades:

### 8. 📊 Recharts Analytics & Interactive Dashboards
*   **Purpose**: Replaces basic CSS progress bars and div blocks with beautiful, interactive SVG charts.
*   **Features**:
    *   **Revenue Growth**: Go to [http://localhost:8080/revenue](http://localhost:8080/revenue) to view a premium **Recharts Area Chart** with linear gradients, custom tooltips on hover, and an "Export Bookings" CSV button.
    *   **Manager Funnels**: Go to [http://localhost:8080/manager](http://localhost:8080/manager) to see horizontal and vertical **Recharts Bar Charts** highlighting conversion funnel drop-offs and objection distributions.

### 9. 🤖 Smart Copilot Recommendations
*   **Purpose**: Provides operators with operational guidance based on real-time pipeline anomalies.
*   **Features**: Highlights neglected leads (idle > 4 days), missing post-tour reports, and high-vacancy beds. Each warning card provides a direct quick-action trigger button.
*   **Where to access**: Go to the main Dashboard [http://localhost:8080/dashboard](http://localhost:8080/dashboard).

### 10. 🗂️ Checkbox Bulk Actions & CSV Exports
*   **Purpose**: Allows operators to manage large volumes of leads and export files for external audits.
*   **Features**:
    *   **CSV Exports**: Download leads at [http://localhost:8080/leads](http://localhost:8080/leads) or bookings at [http://localhost:8080/revenue](http://localhost:8080/revenue) with a single click.
    *   **Bulk Operations**: Select multiple leads using checkboxes on the Leads table. A floating bulk actions bar will slide up from the bottom, allowing you to bulk-assign to TCMs, update stage states, or delete records.

### 11. 🎴 Native HTML5 Kanban Drag-and-Drop
*   **Purpose**: Streamlines CRM card movement.
*   **Features**: Drag cards between columns on the Kanban boards to update stage states in the global store.
*   **Where to access**: Visit the Pipeline board at [http://localhost:8080/myt/pipeline](http://localhost:8080/myt/pipeline).

### 12. 🧭 Sidebar Navigation & Glassmorphic 404 Pages
*   **Purpose**: Integrates diagnostics pages and polishes missing route screens.
*   **Features**:
    *   **Sidebar Links**: Linked the orphaned `/activity` (Activity Log) and `/health` (System Health) pages directly in the sidebar navigation.
    *   **NotFound Component**: Renders a glassmorphic page illustration with a return link when visiting any invalid URL.


