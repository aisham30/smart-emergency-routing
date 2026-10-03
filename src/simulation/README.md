# Failure & Recovery Module — Smart Emergency Routing

> **Module Owner:** Alston Miranda  
> **Branch:** `Alston`  
> **Role:** Failure & Recovery Engine, Dynamic Recalculation, Topology Restoration

---

## 📌 Overview

The **Failure & Recovery Module** manages the dynamic health and topology of the 8-node urban emergency communication network. It models physical and logical failures (link breaks, power outages, node disasters), automatically adapts emergency routing in real time, and handles topology restoration.

---

## 🤝 Integration Contract

Strictly adheres to the team integration specification:

```text
Dijkstra Contract (Deon):
  graph + source + destination  ───►  path + totalDelay + status

Failure Contract (Alston):
  graph + failed link/node      ───►  updated graph + failure status
```

* **Immutability Guaranteed:** All failure and restoration operations return a fresh clone of the graph. The input graph is never mutated in-place.
* **Zero Hardcoded Routes:** All routes and delays are computed dynamically.
* **Independent Execution:** Ships with an internal reference Dijkstra engine matching Deon's contract, while accepting any external pluggable router.

---

## 📁 File Structure

```text
src/simulation/
├── index.js             # Public API exports
├── failureRecovery.js   # Pure functional failure & recovery functions
├── networkSimulator.js  # Stateful simulator class with browser event bus
├── demo.js              # Standalone demonstration matching section 6
└── README.md            # Module documentation
tests/
└── simulation.test.js   # Comprehensive 16-test automated test suite
```

---

## 🚀 Quick Start

### Run the Standalone Final Demo
Demonstrates the full scenario: Normal network → Dijkstra finds fastest route → Emergency message sent → Link/node fails → Recalculates new route → Updated delay → Unreachable scenario → Network restored:

```bash
node src/simulation/demo.js
```

### Run Automated Tests
```bash
# Run with Node's native test runner (zero external dependencies needed)
node --test tests/simulation.test.js

# Or run directly with node
node tests/simulation.test.js
```

---

## 📚 API Reference

### 1. Link Failure
```javascript
import { failLink } from './src/simulation/index.js';

const { graph, failureStatus } = failLink(currentGraph, 'CC', 'N1');
// Or: failLink(currentGraph, ['CC', 'N1'])

console.log(failureStatus);
// {
//   type: 'link',
//   target: ['CC', 'N1'],
//   canonicalKey: 'CC<->N1',
//   previousWeight: 5,
//   success: true,
//   action: 'failed',
//   message: 'Link CC <-> N1 failed (latency was 5ms).',
//   timestamp: '...'
// }
```

### 2. Node Failure
Severing all incident links connected to the target node:
```javascript
import { failNode } from './src/simulation/index.js';

const { graph, failureStatus } = failNode(currentGraph, 'N1');

console.log(failureStatus);
// {
//   type: 'node',
//   target: 'N1',
//   disconnectedLinks: [['N1', 'CC'], ['N1', 'H1'], ['N1', 'H2'], ['N1', 'R1']],
//   success: true,
//   action: 'failed',
//   message: "Node 'N1' failed. 4 incident link(s) severed.",
//   timestamp: '...'
// }
```

### 3. Component & Network Restoration
```javascript
import { restoreLink, restoreNode, restoreNetwork } from './src/simulation/index.js';
import baseNetwork from './data/network.js';

// Restore an individual link
const resLink = restoreLink(currentGraph, baseNetwork, 'CC', 'N1');

// Restore an individual node (re-links only to currently operational neighbors)
const resNode = restoreNode(currentGraph, baseNetwork, 'N1');

// Full network restoration
const resAll = restoreNetwork(baseNetwork);
```

### 4. Automatic Rerouting Engine
```javascript
import { autoReroute } from './src/simulation/index.js';

// Evaluates if previous route was severed and computes new bypass
const route = autoReroute(
  currentGraph,
  'CC',             // source
  'H2',             // destination
  routerFunction,   // optional (defaults to internal Dijkstra)
  ['CC', 'N1', 'H2']// previous active route
);

console.log(route);
// {
//   path: ['CC', 'F1', 'H1', 'H2'],
//   totalDelay: 19,
//   status: 'reachable',
//   rerouted: true,
//   previousPath: ['CC', 'N1', 'H2'],
//   previousDelay: 15,
//   delayDelta: 4,
//   reason: 'Active route [CC -> N1 -> H2] was broken by failure. Recalculated new bypass route [CC -> F1 -> H1 -> H2].'
// }
```

### 5. Unreachable Destination Handling
When catastrophic failures isolate a destination (e.g. all links to `R2` cut):
```javascript
const route = autoReroute(isolatedGraph, 'CC', 'R2');
// {
//   path: [],
//   totalDelay: Infinity,
//   status: 'unreachable',
//   rerouted: false,
//   reason: 'Destination R2 cannot be reached from CC. All connecting routes are severed.'
// }
```

---

## 🔌 Integration Guides

### Integration with Deon (Dijkstra)
Deon's Dijkstra function can be plugged directly into `NetworkSimulator` or `autoReroute`:

```javascript
import { findShortestPath } from '../algorithm/dijkstra.js';
import { NetworkSimulator } from '../simulation/index.js';

const sim = new NetworkSimulator();
sim.setRouter(findShortestPath);

// All rerouting will now use Deon's algorithm implementation
const route = sim.autoReroute('CC', 'H2');
```

### Integration with Aisha (Frontend & Visualization)
Aisha's dashboard can consume `NetworkSimulator` directly or via the window event bus:

```javascript
// Option A: Direct class consumption
import { NetworkSimulator } from './simulation/index.js';
const sim = new NetworkSimulator();

sim.on('node-fail', ({ nodeId }) => {
  window._app?.setNodeFailed(nodeId);
});
sim.on('node-restore', ({ nodeId }) => {
  window._app?.setNodeActive(nodeId);
});

// Option B: Decoupled Window Event Bus (preferred by frontend)
sim.attachBrowserEvents();
// Simulator now listens to:
//   'sim:node-fail'    (detail: 'H1')
//   'sim:node-restore' (detail: 'H1')
//   'sim:link-fail'    (detail: { u: 'CC', v: 'N1' })
//   'sim:link-restore' (detail: { u: 'CC', v: 'N1' })
```

---

## ✅ Test Cases Overview

The test suite in [`tests/simulation.test.js`](file:///D:/CNN/gitclone/smart-emergency-routing/tests/simulation.test.js) validates:
1. **Graph Immutability**: Verifies baseline graph is never mutated.
2. **Link Failure Contract**: Verifies bidirectional edge deletion and status output.
3. **Node Failure Contract**: Verifies node deletion and disconnection of all incident links.
4. **Link Restoration**: Restores original latency from baseline topology.
5. **Downstream Safety**: Prevents restoring link when an endpoint node is down.
6. **Node Restoration**: Reconnects only active neighbors, avoiding links to still-failed nodes.
7. **Network Reset**: Fully resets network to 100% operational baseline.
8. **Dijkstra Compliance**: Validates optimal routes across the 8-node urban graph.
9. **Automatic Rerouting (Link Failure)**: Reroutes around severed `CC <-> N1` link (+4ms delta).
10. **Automatic Rerouting (Node Failure)**: Reroutes around collapsed `N1` node via Fire Station `F1`.
11. **Unreachable Detection**: Validates `status: 'unreachable'`, `path: []`, `totalDelay: Infinity`.
12. **Stateful Simulator**: Validates lifecycle management and live health statistics.
13. **Pluggable Architecture**: Verifies custom router injection.
