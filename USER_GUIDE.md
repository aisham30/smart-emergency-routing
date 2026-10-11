# Smart Emergency Communication Routing — User Guide

> **Tactical Emergency Dispatch & Dynamic Dijkstra Routing Dashboard**  
> An interactive guide for operators, evaluators, and developers.

---

## 📋 Table of Contents
1. [Overview](#-overview)
2. [Quick Start & Launching](#-quick-start--launching)
3. [Dashboard Interface Walkthrough](#-dashboard-interface-walkthrough)
4. [Step-by-Step Operator Instructions](#-step-by-step-operator-instructions)
   - [Finding the Shortest Route](#1-finding-the-shortest-route)
   - [Sending an Emergency Broadcast](#2-sending-an-emergency-broadcast)
   - [Simulating Network Faults](#3-simulating-network-faults)
   - [Using 1-Click Simulation Presets](#4-using-1-click-simulation-presets)
   - [Restoring Network Infrastructure](#5-restoring-network-infrastructure)
5. [Running Test Cases & Verification](#-running-test-cases--verification)
   - [Option A: In-Browser Test Suite](#option-a-in-browser-test-runner-dashboard)
   - [Option B: Terminal Test Suites](#option-b-terminal-test-suites-node-cli)
6. [Network Topology & Node Reference](#-network-topology--node-reference)
7. [Troubleshooting & FAQ](#-troubleshooting--faq)

---

## 📌 Overview

The **Smart Emergency Routing System** is a mission-critical operations console designed for urban emergency management. When disasters, accidents, or outages strike, communication lines and road corridors can fail. 

This system:
- Calculates the fastest response route using **Dijkstra's Shortest Path Algorithm**.
- Automatically detects network damage (**link cuts** or **node collapses**) and recalculates bypass routes in real time.
- Emulates packet hop transmissions with visual telemetry.
- Evaluates isolated destinations and flags unreachable critical facilities immediately.

---

## 🚀 Quick Start & Launching

### Prerequisites
- **Node.js** (v18+) or **Python 3** (3.8+)
- Any modern web browser (Chrome, Firefox, Edge, Safari)

### Starting the Local Server

Open your terminal in the repository root directory (`smart-emergency-routing/`):

```bash
# Using Python (Windows / macOS / Linux)
python -m http.server 8080

# OR using npm
npm start
```

### Accessing the Dashboard

Open your web browser and navigate to:
👉 **[http://localhost:8080/src/frontend/](http://localhost:8080/src/frontend/)**  
*(Visiting `http://localhost:8080/` will automatically redirect you to the dashboard).*

---

## 🖥️ Dashboard Interface Walkthrough

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ ⚡ SMART EMERGENCY ROUTING SYSTEM                    [● NETWORK ONLINE]   21:45:00   │
├─────────────────┬───────────────────────────────────────────────────────┬──────────────┤
│ DISPATCH &      │ REAL-TIME NETWORK MAP (SVG)                           │ ROUTE INFO   │
│ FAULT CONTROLS  │ [🧪 RUN TESTS] [PRESET 1] [PRESET 2] [RESTORE]        │ & DISPATCH   │
│                 │                                                       │              │
│ • Source/Dest   │          (CC) Command                                 │ • Cost (ms)  │
│ • Find Route    │         /  |  \                                       │ • Hop count  │
│ • Node Faults   │       (N1)(F1)(P1)                                    │ • Path chips │
│ • Link Faults   │        | X |   |                                      │              │
│                 │       (H1)(H2)(R2)                                    │ [TABS]       │
│ NODE LIST       │         \ /   /                                       │ • Broadcast  │
│ [ACTIVE/FAILED] │         (R1)-'                                        │ • Test Suite │
├─────────────────┴───────────────────────────────────────────────────────┴──────────────┤
│ TOTAL DELAY: 12 ms  |  HOPS: 2  |  ACTIVE NODES: 8/8  |  ACTIVE EDGES: 12/12  | LIVE   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

The dashboard is structured into three primary columns:

1. **Left Panel — Controls & Fault Injection**:
   - **Dispatch Controls**: Dropdown selectors for source and destination nodes, `FIND SHORTEST ROUTE`, and `CLEAR ROUTE`.
   - **Simulation Fault Controls**: Individual node and link outage injection tools, plus a global network restoration button.
   - **Network Nodes**: Real-time status cards for all 8 nodes with interactive `ACTIVE` / `FAILED` toggle badges.

2. **Center Panel — Real-Time SVG Network Map**:
   - Interactive 900×510 vector map displaying all nodes, interconnecting links, and latency weights.
   - Visual route marching animation (green dashed glow) along the active path.
   - Physical failure overlays: failed nodes display red `✕` markers; severed links render as red dashed warning strokes.
   - **Simulation Presets Bar**: Quick 1-click preset scenarios (Scenarios 1 to 5).

3. **Right Panel — Route Analytics & Logs**:
   - **Route Details**: Displays total latency (ms), hop count, quality rating (`OPTIMAL`, `GOOD`, `MODERATE`, `LONG`), and route chips.
   - **Dual-Tab Interface**:
     - **Tab 1 (`📡 DISPATCH & LOG`)**: Custom emergency broadcast messaging with simulated packet traversal animation and transmission history.
     - **Tab 2 (`🧪 TEST & SCENARIOS`)**: In-browser test runner displaying live pass/fail checks for all 8 validation scenarios.

4. **Telemetry Status Bar (Footer)**:
   - Real-time health counters: Total delay, hop count, active nodes (`8/8`), active edges (`12/12`), and algorithm status.

---

## 🛠️ Step-by-Step Operator Instructions

### 1. Finding the Shortest Route
1. In the left panel under **Dispatch Controls**, select an origin from **SOURCE NODE** (e.g., `CC — Command Centre`).
2. Select a target from **DESTINATION NODE** (e.g., `H1 — Hospital 1`).
3. Click **`⚡ FIND SHORTEST ROUTE`** (or click any node directly on the SVG map).
4. The optimal path will illuminate in neon green with an animated directional dash pattern, and the **Route Details** panel will display the path breakdown and latency.

---

### 2. Sending an Emergency Broadcast
1. Once a route is active, navigate to the **`📡 DISPATCH & LOG`** tab in the right sidebar.
2. Enter your message in the **MESSAGE** text area (e.g., `"Priority Medical Dispatch — Emergency in Sector 4"`).
3. Click **`📡 SEND EMERGENCY BROADCAST`**.
4. Watch the amber packet dot animate along each hop of the path on the map, trigger a radial burst at the destination, and append a verified entry to the **TRANSMISSION LOG**.

---

### 3. Simulating Network Faults
You can inject faults using **three different methods**:

#### Method A: Dropdown Selection
- Under **Simulation Fault Controls** on the left:
  - Choose a node from **TARGET NODE** and click **`⚡ TOGGLE NODE FAILURE`**.
  - Choose a link from **TARGET LINK** and click **`⚡ TOGGLE LINK FAILURE`**.

#### Method B: Sidebar Status Tag Click
- In the **Network Nodes** list on the left, click the status badge (`ACTIVE` or `FAILED`) next to any node to toggle its state instantly.

#### Method C: Direct Map Click
- Click directly on any link line or weight label on the SVG network map to sever or restore that specific link.

> **Automatic Rerouting in Action**:  
> If an active route utilizes the severed node or link, the system will immediately recalculate a bypass route around the failure and display the updated path and latency delta (+ms).

---

### 4. Using 1-Click Simulation Presets
The toolbar above the map provides instant demonstration scenarios:

| Preset Button | Description | Expected Outcome |
| :--- | :--- | :--- |
| **`SCENARIO 1: BASELINE (CC→H1)`** | Standard operational dispatch | Route: `CC → N1 → H1` (Cost: 12 ms, 2 hops) |
| **`SCENARIO 2: ALTERNATE (CC→R2)`** | Long-distance relief route | Route: `CC → P1 → R2` (Cost: 20 ms, 2 hops) |
| **`SCENARIO 3: LINK FAIL (CC↔N1)`** | Primary link CC↔N1 severed | Auto-reroutes via Fire Station: `CC → F1 → H1` (Cost: 14 ms, +2ms delta) |
| **`SCENARIO 4: NODE COLLAPSE (N1)`** | Node N1 completely collapses | Dynamic bypass around N1 via F1 |
| **`SCENARIO 5: ISOLATION (R2)`** | Both links to R2 (P1↔R2 & R1↔R2) severed | Diagnostic: Destination `R2` unreachable |
| **`↺ RESTORE ALL`** | Restores all nodes & edges | Network returns to 100% online (`8/8` nodes, `12/12` edges) |

---

### 5. Restoring Network Infrastructure
- **Individual Link/Node**: Toggle the link or node again to restore it to operational status.
- **Global Reset**: Click **`↺ RESTORE FULL NETWORK`** in the left sidebar or **`↺ RESTORE ALL`** in the simulation presets bar to restore all 8 nodes and 12 edges to pristine baseline health.

---

## 🧪 Running Test Cases & Verification

### Option A: In-Browser Test Runner (Dashboard)
1. On the dashboard, click **`🧪 RUN ALL 8 TESTS`** in the preset bar (or open the **`🧪 TEST & SCENARIOS`** tab and click **`▶ RUN`**).
2. The browser will execute all 70 assertions across the 8 test scenarios.
3. Review the green checkmarks (`✓`) and pass count (`70 / 70 CHECKS PASSED ✓`).

### Option B: Terminal Test Suites (Node CLI)
You can run automated test suites directly in your terminal:

```bash
# 1. Run Dijkstra algorithm unit tests
npm run test:algo

# 2. Run simulation & failure recovery unit tests
npm run test:sim

# 3. Run full integration tests (algorithm + simulation + frontend adapter)
npm run test:int

# 4. Run scenario verification suite (all 8 emergency scenarios)
node tests/scenario.verify.js

# 5. Run full interactive CLI demo
npm run demo
```

---

## 🗺️ Network Topology & Node Reference

### Nodes

| ID | Label | Facility Type | SVG Color | Incident Connections |
| :---: | :--- | :--- | :---: | :--- |
| **`CC`** | Command Centre | ⚡ Command Origin | `#ff7c2a` | N1 (5), F1 (8), P1 (12) |
| **`N1`** | Neighbourhood 1 | 🏘 Urban Area | `#ce93d8` | CC (5), H1 (7), H2 (10), R1 (12) |
| **`F1`** | Fire Station 1 | 🔥 Fire Department | `#ff5252` | CC (8), H1 (6), P1 (7) |
| **`P1`** | Police Station 1 | 🚔 Police Station | `#29b6f6` | CC (12), F1 (7), R2 (8) |
| **`H1`** | Hospital 1 | 🏥 Medical Center | `#4caf50` | N1 (7), F1 (6), H2 (5) |
| **`H2`** | Hospital 2 | 🏥 Medical Center | `#4caf50` | N1 (10), H1 (5), R1 (6) |
| **`R1`** | Rescue Unit 1 | 🚑 Emergency Relief | `#ffb547` | N1 (12), H2 (6), R2 (4) |
| **`R2`** | Rescue Unit 2 | 🚑 Emergency Relief | `#ffb547` | P1 (8), R1 (4) |

### Link Weights Matrix (Bidirectional Latency in ms)
- `CC ↔ N1`: **5 ms**
- `CC ↔ F1`: **8 ms**
- `CC ↔ P1`: **12 ms**
- `N1 ↔ H1`: **7 ms**
- `N1 ↔ H2`: **10 ms**
- `N1 ↔ R1`: **12 ms**
- `F1 ↔ H1`: **6 ms**
- `F1 ↔ P1`: **7 ms**
- `P1 ↔ R2`: **8 ms**
- `H1 ↔ H2`: **5 ms**
- `H2 ↔ R1`: **6 ms**
- `R1 ↔ R2`: **4 ms**

---

## ❓ Troubleshooting & FAQ

#### Q1: Why does clicking "Find Shortest Route" show "Source and destination must be different"?
> Dijkstra calculates shortest paths between distinct nodes. If origin and destination are the same, latency is 0 ms. Choose two different nodes to see network routing.

#### Q2: What happens when all routes to a destination are severed?
> The system flags the route status as `UNREACHABLE`, sets delay to `Infinity`, displays a clear red error message in the Route Details panel, and prevents packet dispatch until connectivity is restored.

#### Q3: Can I run this without an active internet connection?
> Yes. The entire application uses native ES modules and Vanilla JavaScript without external CDNs or remote dependencies. It is 100% offline-compatible.

---

*Smart Emergency Communication Routing System · Built with Vanilla Web Standards & Graph Theory.*
