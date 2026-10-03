# Frontend — Emergency Control Dashboard

> **Module owner:** Aisha (Frontend Team)
> **Branch:** `feature/frontend`

Interactive browser dashboard for the Smart Emergency Communication Routing project.
All three modules are now fully integrated — real Dijkstra routing, live graph state, and failure simulation.

---

## Running

Serve from the **repo root** (so cross-module browser imports resolve correctly):

```bash
# Python 3 (from repo root)
python3 -m http.server 8080

# OR Node
npx serve .

# Then open
open http://localhost:8080/src/frontend/
```

---

## File Structure

```
src/frontend/
├── index.html          # Entry point (three-column dashboard layout)
├── css/
│   └── styles.css      # Dark ops-center theme (CSS custom properties)
└── js/
    ├── app.js          # App controller — wires algorithm + sim + UI
    ├── network.js      # GRAPH constants + getRoute() adapter (real Dijkstra)
    ├── visualizer.js   # SVG renderer — edges, nodes, route animation
    └── ui.js           # DOM controller — panels, dropdowns, log
```

---

## Integration (Live — no stubs remaining)

### Algorithm (Deon — `src/algorithm/`)

`network.js` imports `findShortestPath` directly:

```js
import { findShortestPath } from '../../algorithm/index.js';

export function getRoute(graph, source, destination) {
  const result = findShortestPath(graph, source, destination);
  if (!result || result.status === 'unreachable') return null;
  return { path: result.path, cost: result.totalDelay, hops: result.path.length - 1 };
}
```

### Failure Simulation (Alston — `src/simulation/`)

`app.js` creates a `NetworkSimulator`, wires Deon's router, and subscribes to failure events:

```js
import { findShortestPath } from '../../algorithm/index.js';
import { NetworkSimulator }  from '../../simulation/index.js';

this.sim = new NetworkSimulator(GRAPH);
this.sim.setRouter(findShortestPath);

this.sim.on('node-fail',    ({ nodeId }) => /* visual update + autoReroute */);
this.sim.on('node-restore', ({ nodeId }) => /* visual restore */);
this.sim.on('link-fail',    ({ u, v })   => /* visual + autoReroute */);
```

Trigger failures from the browser console or externally:

```js
// Via window event bus
window.dispatchEvent(new CustomEvent('sim:node-fail',    { detail: 'H1' }));
window.dispatchEvent(new CustomEvent('sim:node-restore', { detail: 'H1' }));
window.dispatchEvent(new CustomEvent('sim:link-fail',    { detail: { u: 'CC', v: 'N1' } }));

// Or directly via the exposed app instance
window._app.setNodeFailed('H1');
window._app.setLinkFailed('CC', 'N1');
window._app.restoreAll();
```

---

## Features

| Feature | Status |
|---|---|
| 8-node SVG network map | ✅ |
| Colour-coded node types | ✅ |
| Edge weight labels | ✅ |
| Source / destination selection (dropdowns + click-on-node) | ✅ |
| Shortest route highlighting (animated dashed green) | ✅ |
| Route stats (delay, hops, quality) | ✅ |
| Emergency message send + dot animation | ✅ |
| Transmission log | ✅ |
| Node failure visual state | ✅ |
| Network status badge | ✅ |
| Live clock | ✅ |
| Real Dijkstra routing | ✅ integrated |
| Live failure re-routing (auto) | ✅ integrated |
| Link failure visual + rerouting | ✅ integrated |
