/**
 * network.js — Frontend Graph Data Layer
 *
 * Mirrors data/network.js and augments it with:
 *   • Node metadata  (type, display label, accent colour, SVG canvas position)
 *   • Pre-computed shortest-path routes for all node pairs (mock data)
 *   • getMockRoute() — drop-in stub ready for Dijkstra integration
 *
 * ── INTEGRATION POINT (Deon) ─────────────────────────────────────────────────
 * Once src/algorithm/ is ready, replace getMockRoute() with:
 *
 *   import { dijkstra } from '../../algorithm/index.js';
 *   export function getRoute(src, dst) {
 *     const r = dijkstra(GRAPH, src, dst);
 *     return r ? { path: r.path, cost: r.cost, hops: r.path.length - 1 } : null;
 *   }
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Adjacency list (source of truth: data/network.js) ───────────────────────
export const GRAPH = {
  CC: { N1: 5,  F1: 8,  P1: 12 },
  N1: { CC: 5,  H1: 7,  H2: 10, R1: 12 },
  F1: { CC: 8,  H1: 6,  P1: 7  },
  P1: { CC: 12, F1: 7,  R2: 8  },
  H1: { N1: 7,  F1: 6,  H2: 5  },
  H2: { N1: 10, H1: 5,  R1: 6  },
  R1: { N1: 12, H2: 6,  R2: 4  },
  R2: { P1: 8,  R1: 4  },
};

// ─── Node type styling ────────────────────────────────────────────────────────
export const NODE_TYPES = {
  command:       { fill: '#2d1200', icon: '⚡', desc: 'Command Centre'  },
  fire:          { fill: '#2d0000', icon: '🔥', desc: 'Fire Station'    },
  police:        { fill: '#00122d', icon: '🚔', desc: 'Police Station'  },
  hospital:      { fill: '#002d00', icon: '🏥', desc: 'Hospital'        },
  neighbourhood: { fill: '#1a0d2d', icon: '🏘', desc: 'Neighbourhood'   },
  rescue:        { fill: '#2d1f00', icon: '🚑', desc: 'Rescue Unit'     },
};

// ─── Node metadata with fixed SVG canvas positions ───────────────────────────
// Positions chosen for minimal edge crossings on a 900 × 510 viewBox.
export const NODE_INFO = {
  CC: { label: 'Command Centre',   type: 'command',       color: '#ff7c2a', x: 75,  y: 255 },
  N1: { label: 'Neighbourhood 1',  type: 'neighbourhood', color: '#ce93d8', x: 280, y: 95  },
  F1: { label: 'Fire Station 1',   type: 'fire',          color: '#ff5252', x: 280, y: 385 },
  P1: { label: 'Police Station 1', type: 'police',        color: '#29b6f6', x: 580, y: 95  },
  H1: { label: 'Hospital 1',       type: 'hospital',      color: '#4caf50', x: 460, y: 190 },
  H2: { label: 'Hospital 2',       type: 'hospital',      color: '#4caf50', x: 460, y: 375 },
  R1: { label: 'Rescue Unit 1',    type: 'rescue',        color: '#ffb547', x: 680, y: 375 },
  R2: { label: 'Rescue Unit 2',    type: 'rescue',        color: '#ffb547', x: 810, y: 235 },
};

// ─── Deduplicated edge list derived from GRAPH ────────────────────────────────
export const EDGES = (() => {
  const seen = new Set();
  const list = [];
  for (const [from, nbrs] of Object.entries(GRAPH)) {
    for (const [to, weight] of Object.entries(nbrs)) {
      const key = [from, to].sort().join('·');
      if (!seen.has(key)) { seen.add(key); list.push({ from, to, weight }); }
    }
  }
  return list;
})();

// ─── Pre-computed shortest paths (all distinct pairs) ────────────────────────
// Verified manually against Dijkstra; serves as ground-truth test data too.
const ROUTES = {
  // From CC
  'CC·N1': { path: ['CC','N1'],              cost: 5  },
  'CC·F1': { path: ['CC','F1'],              cost: 8  },
  'CC·P1': { path: ['CC','P1'],              cost: 12 },
  'CC·H1': { path: ['CC','N1','H1'],         cost: 12 },
  'CC·H2': { path: ['CC','N1','H2'],         cost: 15 },
  'CC·R1': { path: ['CC','N1','R1'],         cost: 17 },
  'CC·R2': { path: ['CC','P1','R2'],         cost: 20 },
  // From N1
  'N1·F1': { path: ['N1','H1','F1'],         cost: 13 },
  'N1·P1': { path: ['N1','CC','P1'],         cost: 17 },
  'N1·H1': { path: ['N1','H1'],             cost: 7  },
  'N1·H2': { path: ['N1','H2'],             cost: 10 },
  'N1·R1': { path: ['N1','R1'],             cost: 12 },
  'N1·R2': { path: ['N1','R1','R2'],         cost: 16 },
  // From F1
  'F1·P1': { path: ['F1','P1'],             cost: 7  },
  'F1·H1': { path: ['F1','H1'],             cost: 6  },
  'F1·H2': { path: ['F1','H1','H2'],         cost: 11 },
  'F1·R1': { path: ['F1','H1','H2','R1'],    cost: 17 },
  'F1·R2': { path: ['F1','P1','R2'],         cost: 15 },
  // From P1
  'P1·H1': { path: ['P1','F1','H1'],         cost: 13 },
  'P1·H2': { path: ['P1','F1','H1','H2'],    cost: 18 },
  'P1·R1': { path: ['P1','R2','R1'],         cost: 12 },
  'P1·R2': { path: ['P1','R2'],             cost: 8  },
  // From H1
  'H1·H2': { path: ['H1','H2'],             cost: 5  },
  'H1·R1': { path: ['H1','H2','R1'],         cost: 11 },
  'H1·R2': { path: ['H1','H2','R1','R2'],    cost: 15 },
  // From H2
  'H2·R1': { path: ['H2','R1'],             cost: 6  },
  'H2·R2': { path: ['H2','R1','R2'],         cost: 10 },
  // From R1
  'R1·R2': { path: ['R1','R2'],             cost: 4  },
};

/**
 * getMockRoute(source, destination) → { path, cost, hops } | null
 *
 * Returns the pre-computed shortest path between any two nodes.
 * Handles both forward and reverse direction automatically.
 *
 * ── INTEGRATION POINT ────────────────────────────────────────────────────────
 * Replace this function body with the real algorithm call once ready:
 *   return dijkstra(GRAPH, source, destination);
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function getMockRoute(source, destination) {
  if (source === destination) return { path: [source], cost: 0, hops: 0 };

  // Try both orderings — ROUTES keys are not always alphabetically sorted,
  // so we check src·dst first then fall back to dst·src with path reversed.
  const entryFwd = ROUTES[`${source}·${destination}`];
  if (entryFwd) return { path: [...entryFwd.path], cost: entryFwd.cost, hops: entryFwd.path.length - 1 };

  const entryRev = ROUTES[`${destination}·${source}`];
  if (entryRev) return { path: [...entryRev.path].reverse(), cost: entryRev.cost, hops: entryRev.path.length - 1 };

  return null;   // unroutable pair (should not occur within this 8-node graph)
}
