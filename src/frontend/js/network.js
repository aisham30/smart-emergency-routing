/**
 * network.js — Frontend Graph Data Layer
 *
 * Provides:
 *   • GRAPH       — adjacency list (mirrors data/network.js exactly)
 *   • NODE_TYPES  — visual styling per node type
 *   • NODE_INFO   — per-node metadata + SVG canvas positions
 *   • EDGES       — deduplicated edge list derived from GRAPH
 *   • getRoute()  — adapter calling Deon's findShortestPath
 *
 * Author: Aisha (Frontend Module)
 * Integration: Deon (Algorithm), Alston (Simulation)
 */

import { findShortestPath } from '../../algorithm/index.js';

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

/**
 * getRoute(graph, source, destination)
 *   Calls Deon's findShortestPath and maps the result to the shape the
 *   frontend UI expects: { path, cost, hops }.
 *
 *   Pass the CURRENT graph (from NetworkSimulator.getGraph()) so that
 *   failure scenarios use the live topology rather than the base graph.
 *
 * @param {Object} graph       — adjacency list (base or post-failure)
 * @param {string} source      — origin node id
 * @param {string} destination — target node id
 * @returns {{ path: string[], cost: number, hops: number } | null}
 */
export function getRoute(graph, source, destination) {
  const result = findShortestPath(graph, source, destination);
  if (!result || result.status === 'unreachable') return null;
  return {
    path:  result.path,
    cost:  result.totalDelay,        // maps totalDelay → cost for UI layer
    hops:  result.path.length - 1,
  };
}
