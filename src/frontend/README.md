# Frontend — Emergency Control Dashboard

> **Module owner:** Frontend Team  
> **Branch:** `feature/frontend`

Interactive browser dashboard for the Smart Emergency Communication Routing project.  
Uses **mock route data** today; ready to drop in the real Dijkstra module with a one-line change.

---

## Running

ES modules require a local HTTP server (browsers block `file://` imports).

```bash
# From repo root — Python 3
python3 -m http.server 8080 --directory src/frontend

# OR with Node
npx serve src/frontend

# Then open
open http://localhost:8080
```

---

## File Structure

```
src/frontend/
├── index.html          # Entry point (three-column dashboard layout)
├── css/
│   └── styles.css      # Dark ops-center theme (CSS custom properties)
└── js/
    ├── app.js          # App controller — wires viz + UI, owns state
    ├── network.js      # Graph data, node metadata, mock route table
    ├── visualizer.js   # SVG renderer — edges, nodes, route animation
    └── ui.js           # DOM controller — panels, dropdowns, log
```

---

## Integration Points

### ① Dijkstra (Deon — `src/algorithm/`)

In [`js/network.js`](js/network.js), replace `getMockRoute()`:

```js
// Before (mock)
export function getMockRoute(source, destination) { … }

// After (real Dijkstra)
import { dijkstra } from '../../algorithm/index.js';
export function getRoute(src, dst) {
  const r = dijkstra(GRAPH, src, dst);
  return r ? { path: r.path, cost: r.cost, hops: r.path.length - 1 } : null;
}
```

Then in [`js/app.js`](js/app.js), update the import and call:
```js
import { getRoute } from './network.js';   // one-line swap
const route = getRoute(src, dst);
```

### ② Failure Simulation (Alston — `src/simulation/`)

[`js/app.js`](js/app.js) exposes two methods and a window event bus:

```js
// Method calls (if importing app.js directly)
window._app.setNodeFailed('H1');   // mark node failed
window._app.setNodeActive('H1');   // restore node

// Event bus (preferred — keeps modules decoupled)
window.dispatchEvent(new CustomEvent('sim:node-fail',    { detail: 'H1' }));
window.dispatchEvent(new CustomEvent('sim:node-restore', { detail: 'H1' }));
```

The visualizer also has a standalone `setNodeState(id, state)` method and `animateMessage(path, cb)` for custom animation triggers.

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
| Node failure visual state | ✅ (visual only, no routing) |
| Network status badge | ✅ |
| Live clock | ✅ |
| Dijkstra integration | ⬜ (stub ready) |
| Live failure re-routing | ⬜ (event bus ready) |
