# Smart Emergency Communication Routing

> Efficient emergency dispatch using **Dijkstra's Shortest Path Algorithm** on a simulated 8-node urban network.

---

## 📌 Objective

Design and implement a smart routing system that computes the **optimal path** from a Command Centre to any emergency destination in real-time. The system models a realistic urban emergency network, visualises routes interactively, and simulates node/edge failures with automatic recovery re-routing.

---

## 🗺️ Network Overview

The system operates on an **8-node emergency network** representing key infrastructure in an urban area:

| Node | Description          |
|------|----------------------|
| `CC` | Command Centre (source) |
| `N1` | Neighbourhood 1      |
| `F1` | Fire Station 1       |
| `P1` | Police Station 1     |
| `H1` | Hospital 1           |
| `H2` | Hospital 2           |
| `R1` | Rescue Unit 1        |
| `R2` | Rescue Unit 2        |

**Edge weights** represent communication latency / travel cost in arbitrary units. The full adjacency specification lives in [`data/network.js`](data/network.js).

```
        CC
       /|\ 
      5 8 12
     /  |  \
    N1  F1  P1
   /|\ /|   |\ 
  7 10 6 7  7  8
 /  | |  \ /   \
H1  H2    (F1) R2
 \  |          |
  5 6          4
   \|          |
   H2-6-R1----R2
```

---

## 🧩 Modules

### 1 · Dijkstra & Routing (`src/algorithm/`)

Implements Dijkstra's algorithm to compute shortest paths from the Command Centre (`CC`) to all reachable emergency nodes. Exposes a clean API consumed by both the frontend and the simulation layer.

- Single-source shortest path from `CC`
- Returns path array + total cost
- Pure JavaScript / no external dependencies

### 2 · Frontend & Visualization (`src/frontend/`)

Interactive browser-based visualisation of the emergency network.

- Renders all 8 nodes and weighted edges on an HTML5 Canvas (or SVG)
- Highlights the shortest path returned by the algorithm
- Displays path cost and node-by-node breakdown
- Responsive UI with dispatch controls

### 3 · Failure & Recovery Simulation (`src/simulation/`)

Models real-world failure scenarios and automatic re-routing.

- Toggle individual nodes or edges as **failed / active**
- Re-runs Dijkstra on the modified graph to find an alternate route
- Animates the transition between routes
- Logs failure events and recovery times

---

## 📁 Project Structure

```
smart-emergency-routing/
├── src/
│   ├── algorithm/      # Dijkstra implementation & path utilities
│   ├── frontend/       # UI, canvas rendering, dispatch controls
│   └── simulation/     # Failure injection & recovery logic
├── data/
│   └── network.js      # 8-node network adjacency specification
├── tests/              # Unit & integration tests
├── docs/               # Design documents, diagrams, references
├── README.md
└── package.json
```

---

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Run tests
npm test

# Start development server (once frontend is scaffolded)
npm start
```

---

## 👥 Team

Built as a collaborative academic project. Contributions are organised by module — see the module directories above.

---

## 📄 License

MIT
