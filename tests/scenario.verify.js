/**
 * tests/scenario.verify.js
 *
 * Full end-to-end scenario verification for Smart Emergency Routing.
 * Validates all 8 scenarios from the project brief:
 *
 *   1.  8-node network completeness
 *   2.  Real Dijkstra shortest-path results (multiple pairs)
 *   3.  Route output: path, totalDelay → cost, hops
 *   4.  Emergency message path validity
 *   5.  Link failure  → automatic rerouting
 *   6.  Node failure  → automatic rerouting
 *   7.  Network restoration (link, node, full)
 *   8.  Unreachable destination handling
 *
 * Run: node tests/scenario.verify.js
 */

import network       from '../data/network.js';
import { findShortestPath } from '../src/algorithm/index.js';
import {
  NetworkSimulator,
  failLink, failNode,
  restoreLink, restoreNode, restoreNetwork,
  dijkstraRouting
} from '../src/simulation/index.js';

// ── Terminal colours ──────────────────────────────────────────────────────────
const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m',
      C = '\x1b[36m', M = '\x1b[35m', B = '\x1b[1m', X = '\x1b[0m';

let totalPass = 0, totalFail = 0;
const failures = [];

function header(n, title) {
  console.log(`\n${C}${B}━━━ Scenario ${n}: ${title} ━━━${X}`);
}

function check(label, pass, got, expected) {
  if (pass) {
    console.log(`  ${G}✓${X} ${label}`);
    totalPass++;
  } else {
    const msg = `  ${R}✗${X} ${label}\n      got:      ${JSON.stringify(got)}\n      expected: ${JSON.stringify(expected)}`;
    console.log(msg);
    failures.push({ label, got, expected });
    totalFail++;
  }
}

// Adapter matching src/frontend/js/network.js getRoute()
function getRoute(graph, src, dst) {
  const r = findShortestPath(graph, src, dst);
  if (!r || r.status === 'unreachable') return null;
  return { path: r.path, cost: r.totalDelay, hops: r.path.length - 1 };
}

// ════════════════════════════════════════════════════════════════════════
// 1. 8-NODE NETWORK COMPLETENESS
// ════════════════════════════════════════════════════════════════════════
header(1, '8-Node Network Completeness');
{
  const EXPECTED_NODES = ['CC','N1','F1','P1','H1','H2','R1','R2'];
  const actualNodes = Object.keys(network);

  check('Network has exactly 8 nodes',     actualNodes.length === 8, actualNodes.length, 8);
  for (const n of EXPECTED_NODES) {
    check(`Node "${n}" present in graph`,  actualNodes.includes(n),  actualNodes, n);
  }

  // Verify all adjacencies are symmetric (undirected graph)
  let symmetric = true;
  for (const [u, nbrs] of Object.entries(network)) {
    for (const [v, w] of Object.entries(nbrs)) {
      if (!network[v] || network[v][u] !== w) { symmetric = false; break; }
    }
  }
  check('All edges are symmetric (undirected)', symmetric, symmetric, true);

  // Edge count
  const edgeCount = Object.values(network).reduce((s, n) => s + Object.keys(n).length, 0) / 2;
  check('Network has 12 edges', edgeCount === 12, edgeCount, 12);

  // Every node reachable from CC
  let allReachable = true;
  for (const n of EXPECTED_NODES) {
    if (n === 'CC') continue;
    const r = findShortestPath(network, 'CC', n);
    if (r.status !== 'reachable') { allReachable = false; break; }
  }
  check('All 7 non-CC nodes reachable from CC', allReachable, allReachable, true);
}

// ════════════════════════════════════════════════════════════════════════
// 2. REAL DIJKSTRA SHORTEST-PATH RESULTS
// ════════════════════════════════════════════════════════════════════════
header(2, 'Real Dijkstra Shortest-Path Results');
{
  const cases = [
    { src: 'CC', dst: 'N1', path: ['CC','N1'],        cost: 5  },
    { src: 'CC', dst: 'H1', path: ['CC','N1','H1'],   cost: 12 },
    { src: 'CC', dst: 'H2', path: ['CC','N1','H2'],   cost: 15 },
    { src: 'CC', dst: 'F1', path: ['CC','F1'],         cost: 8  },
    { src: 'CC', dst: 'P1', path: ['CC','P1'],         cost: 12 },
    { src: 'CC', dst: 'R2', path: ['CC','P1','R2'],    cost: 20 },
    { src: 'CC', dst: 'R1', path: ['CC','N1','R1'],     cost: 17 },  // N1→R1=12 beats N1→H2→R1=16

    { src: 'N1', dst: 'R2', path: ['N1','R1','R2'],    cost: 16 },
    { src: 'H1', dst: 'R2', path: ['H1','H2','R1','R2'], cost: 15 },
    { src: 'F1', dst: 'R2', path: ['F1','P1','R2'],    cost: 15 },
    { src: 'R1', dst: 'R2', path: ['R1','R2'],         cost: 4  },
  ];

  for (const { src, dst, path, cost } of cases) {
    const r = findShortestPath(network, src, dst);
    check(`${src}→${dst}: status reachable`,    r.status === 'reachable',      r.status,      'reachable');
    check(`${src}→${dst}: totalDelay = ${cost}`, r.totalDelay === cost,        r.totalDelay,  cost);
    // Only check exact path for single-path routes; for ties check cost only
    if (path) {
      check(`${src}→${dst}: path correct`,      JSON.stringify(r.path) === JSON.stringify(path), r.path, path);
    }
  }
}

// ════════════════════════════════════════════════════════════════════════
// 3. ROUTE OUTPUT: path, cost, hops (frontend adapter)
// ════════════════════════════════════════════════════════════════════════
header(3, 'Route Output: path / cost / hops (getRoute adapter)');
{
  const r = getRoute(network, 'CC', 'H1');
  check('getRoute returns non-null',               r !== null,                                r, '{…}');
  check('route.path is array',                     Array.isArray(r?.path),                    typeof r?.path, 'array');
  check('route.cost = totalDelay (12)',             r?.cost === 12,                            r?.cost, 12);
  check('route.hops = path.length - 1 (2)',        r?.hops === 2,                             r?.hops, 2);
  check('route.path[0] = source CC',               r?.path[0] === 'CC',                       r?.path[0], 'CC');
  check('route.path[last] = dest H1',              r?.path[r.path.length-1] === 'H1',         r?.path.at(-1), 'H1');

  // Unreachable → null
  const sim = new NetworkSimulator(network);
  sim.setRouter(findShortestPath);
  sim.failLink('P1','R2'); sim.failLink('R1','R2');
  const r2 = getRoute(sim.getGraph(), 'CC', 'R2');
  check('getRoute returns null when unreachable',  r2 === null,                               r2, null);
}

// ════════════════════════════════════════════════════════════════════════
// 4. EMERGENCY MESSAGE PATH VALIDITY
// ════════════════════════════════════════════════════════════════════════
header(4, 'Emergency Message Path Validity');
{
  // Simulate the message-send flow: find route → validate path is traversable
  const pairs = [
    ['CC','H1'], ['CC','R2'], ['F1','R2'], ['N1','H2'], ['P1','R1']
  ];

  for (const [src, dst] of pairs) {
    const r = findShortestPath(network, src, dst);
    // Validate path traversability: each step must be a real edge
    let valid = r.status === 'reachable' && r.path.length >= 2;
    if (valid) {
      for (let i = 0; i < r.path.length - 1; i++) {
        const u = r.path[i], v = r.path[i+1];
        if (network[u]?.[v] === undefined) { valid = false; break; }
      }
    }
    check(`Message path ${src}→${dst} fully traversable`, valid, r.path, valid);
  }

  // Same-node message should have path length 1
  const self = findShortestPath(network, 'CC', 'CC');
  check('Same-node message: path [CC], cost 0', self.totalDelay === 0 && self.path.length === 1, self, {path:['CC'],cost:0});
}

// ════════════════════════════════════════════════════════════════════════
// 5. LINK FAILURE → AUTOMATIC REROUTING
// ════════════════════════════════════════════════════════════════════════
header(5, 'Link Failure → Automatic Rerouting');
{
  const sim = new NetworkSimulator(network);
  sim.setRouter(findShortestPath);

  // Test A: CC↔N1 fails — CC→H1 was CC→N1→H1 (12), reroutes via F1
  const baseH1 = sim.findRoute('CC','H1');
  check('[A] baseline CC→H1 cost 12', baseH1.totalDelay === 12, baseH1.totalDelay, 12);

  sim.failLink('CC','N1');
  const rerouteH1 = sim.autoReroute('CC','H1', baseH1.path, baseH1.totalDelay);
  check('[A] rerouted=true',               rerouteH1.rerouted,                                  rerouteH1.rerouted, true);
  check('[A] bypass path CC→F1→H1',        JSON.stringify(rerouteH1.path) === JSON.stringify(['CC','F1','H1']), rerouteH1.path, ['CC','F1','H1']);
  check('[A] new cost 14 (8+6)',           rerouteH1.totalDelay === 14,                         rerouteH1.totalDelay, 14);
  check('[A] delayDelta +2',              rerouteH1.delayDelta === 2,                           rerouteH1.delayDelta, 2);
  check('[A] status still reachable',     rerouteH1.status === 'reachable',                    rerouteH1.status, 'reachable');

  // Test B: CC↔N1 + CC↔F1 fail — CC→H2 reroutes via P1→F1→H1→H2
  const sim2 = new NetworkSimulator(network);
  sim2.setRouter(findShortestPath);
  const baseH2 = sim2.findRoute('CC','H2');
  check('[B] baseline CC→H2 cost 15', baseH2.totalDelay === 15, baseH2.totalDelay, 15);

  sim2.failLink('CC','N1');
  sim2.failLink('CC','F1');
  const rerouteH2 = sim2.autoReroute('CC','H2', baseH2.path, baseH2.totalDelay);
  check('[B] rerouted after 2 link failures', rerouteH2.rerouted, rerouteH2.rerouted, true);
  check('[B] bypass is reachable',            rerouteH2.status === 'reachable', rerouteH2.status, 'reachable');
  // Only CC→P1→F1→H1→H2 remains, cost 12+7+6+5 = 30
  check('[B] new cost 30',                    rerouteH2.totalDelay === 30, rerouteH2.totalDelay, 30);
}

// ════════════════════════════════════════════════════════════════════════
// 6. NODE FAILURE → AUTOMATIC REROUTING
// ════════════════════════════════════════════════════════════════════════
header(6, 'Node Failure → Automatic Rerouting');
{
  // Test A: N1 fails — CC→H1 reroutes CC→F1→H1
  const sim = new NetworkSimulator(network);
  sim.setRouter(findShortestPath);

  const base = sim.findRoute('CC','H1');
  sim.failNode('N1');

  const reRoute = sim.autoReroute('CC','H1', base.path, base.totalDelay);
  check('[A] N1 fail: rerouted=true',          reRoute.rerouted,                          reRoute.rerouted, true);
  check('[A] N1 fail: path CC→F1→H1',          JSON.stringify(reRoute.path) === JSON.stringify(['CC','F1','H1']), reRoute.path, ['CC','F1','H1']);
  check('[A] N1 fail: cost 14',                reRoute.totalDelay === 14,                 reRoute.totalDelay, 14);
  check('[A] N1 fail: status reachable',       reRoute.status === 'reachable',            reRoute.status, 'reachable');
  check('[A] N1 in failedNodes set',           sim.getStatus().failedNodesList.includes('N1'), sim.getStatus().failedNodesList, ['N1']);

  // Test B: F1 fails — CC→H1 must reroute elsewhere (N1→H1 still works)
  const sim2 = new NetworkSimulator(network);
  sim2.setRouter(findShortestPath);
  sim2.failNode('F1');

  const rF1 = sim2.findRoute('CC','H1');
  check('[B] F1 fail: CC→H1 still reachable via N1', rF1.status === 'reachable', rF1.status, 'reachable');
  check('[B] F1 fail: path does not include F1',      !rF1.path.includes('F1'),  rF1.path, 'no F1');

  // Test C: event tracking
  let nodeFailEventFired = false;
  const sim3 = new NetworkSimulator(network);
  sim3.on('node-fail', ({ nodeId }) => { if (nodeId === 'H2') nodeFailEventFired = true; });
  sim3.failNode('H2');
  check('[C] node-fail event fired with correct id', nodeFailEventFired, nodeFailEventFired, true);
}

// ════════════════════════════════════════════════════════════════════════
// 7. NETWORK RESTORATION
// ════════════════════════════════════════════════════════════════════════
header(7, 'Network Restoration');
{
  const sim = new NetworkSimulator(network);
  sim.setRouter(findShortestPath);

  // A. Restore single link
  sim.failLink('CC','N1');
  const afterFail = sim.findRoute('CC','H1');
  check('[A] after link fail: longer path',    afterFail.totalDelay > 12, afterFail.totalDelay, '>12');

  const restLink = sim.restoreLink('CC','N1');
  check('[A] restoreLink succeeded',           restLink.failureStatus.success, restLink.failureStatus.success, true);
  check('[A] weight restored to 5',            restLink.failureStatus.weight === 5, restLink.failureStatus.weight, 5);
  const afterRestLink = sim.findRoute('CC','H1');
  check('[A] after restore: path CC→N1→H1',   JSON.stringify(afterRestLink.path) === JSON.stringify(['CC','N1','H1']), afterRestLink.path, ['CC','N1','H1']);
  check('[A] after restore: cost 12',          afterRestLink.totalDelay === 12, afterRestLink.totalDelay, 12);

  // B. Restore single node
  sim.failNode('N1');
  const afterNodeFail = sim.findRoute('CC','H1');
  check('[B] after node fail: longer path',    afterNodeFail.totalDelay > 12, afterNodeFail.totalDelay, '>12');

  const restNode = sim.restoreNode('N1');
  check('[B] restoreNode succeeded',           restNode.failureStatus.success, restNode.failureStatus.success, true);
  const afterRestNode = sim.findRoute('CC','H1');
  check('[B] after node restore: cost 12',     afterRestNode.totalDelay === 12, afterRestNode.totalDelay, 12);

  // C. restoreAll: multiple simultaneous failures
  sim.failNode('N1'); sim.failNode('H1'); sim.failLink('P1','R2');
  const s = sim.getStatus();
  check('[C] 2 nodes + 1 link failed',         s.failedNodesCount === 2 && s.failedLinksCount > 0, `nodes:${s.failedNodesCount} links:${s.failedLinksCount}`, 'nodes:2 links:>=1');

  sim.restoreAll();
  const sAfter = sim.getStatus();
  check('[C] restoreAll: failedNodesCount = 0', sAfter.failedNodesCount === 0, sAfter.failedNodesCount, 0);
  check('[C] restoreAll: failedLinksCount = 0', sAfter.failedLinksCount === 0, sAfter.failedLinksCount, 0);
  check('[C] restoreAll: activeNodes = 8',      sAfter.activeNodesCount === 8, sAfter.activeNodesCount, 8);
  check('[C] restoreAll: route optimal again',  sim.findRoute('CC','H1').totalDelay === 12, sim.findRoute('CC','H1').totalDelay, 12);
}

// ════════════════════════════════════════════════════════════════════════
// 8. UNREACHABLE DESTINATION HANDLING
// ════════════════════════════════════════════════════════════════════════
header(8, 'Unreachable Destination Handling');
{
  // A. Cut all access routes to R2 (P1↔R2 and R1↔R2)
  const sim = new NetworkSimulator(network);
  sim.setRouter(findShortestPath);
  sim.failLink('P1','R2');
  sim.failLink('R1','R2');

  const r = sim.autoReroute('CC','R2');
  check('[A] status: unreachable',         r.status === 'unreachable',    r.status, 'unreachable');
  check('[A] path: empty array',           r.path.length === 0,           r.path.length, 0);
  check('[A] totalDelay: Infinity',        r.totalDelay === Infinity,     r.totalDelay, Infinity);
  check('[A] reason mentions R2',          r.reason.includes('R2'),       r.reason.slice(0,60), '…R2…');
  check('[A] getRoute returns null',       getRoute(sim.getGraph(),'CC','R2') === null, null, null);

  // B. Completely isolate a node — remove all its connections
  const sim2 = new NetworkSimulator(network);
  sim2.setRouter(findShortestPath);
  // R2 has only P1 and R1 as neighbors
  sim2.failNode('R2');
  const r2 = sim2.findRoute('CC','R2');
  check('[B] after node remove: status unreachable', r2.status === 'unreachable', r2.status, 'unreachable');

  // C. findShortestPath on bad inputs
  const badSrc = findShortestPath(network, 'INVALID', 'H1');
  check('[C] invalid source → unreachable', badSrc.status === 'unreachable', badSrc.status, 'unreachable');
  const badDst = findShortestPath(network, 'CC', 'NOWHERE');
  check('[C] invalid destination → unreachable', badDst.status === 'unreachable', badDst.status, 'unreachable');

  // D. After reaching unreachable, restoring restores connectivity
  sim.restoreLink('P1','R2');
  const restored = sim.findRoute('CC','R2');
  check('[D] after restoring one link: R2 reachable', restored.status === 'reachable', restored.status, 'reachable');
}

// ════════════════════════════════════════════════════════════════════════
// Summary
// ════════════════════════════════════════════════════════════════════════
const bar = '═'.repeat(64);
console.log(`\n${bar}`);
console.log(`${B}Scenario Verification Results — Smart Emergency Routing${X}`);
console.log(bar);
console.log(`  Scenarios tested:  8`);
console.log(`  ${G}${B}PASS: ${totalPass}${X}`);

if (totalFail > 0) {
  console.log(`  ${R}${B}FAIL: ${totalFail}${X}`);
  console.log(`\n${R}Failed checks:${X}`);
  failures.forEach(f => console.log(`  • ${f.label}\n    got: ${JSON.stringify(f.got)}`));
  console.log(`\n${R}${B}❌ Verification FAILED — do not push${X}\n`);
  process.exit(1);
} else {
  console.log(`  ${Y}FAIL: 0${X}`);
  console.log(`\n${G}${B}✅ All ${totalPass} scenario checks PASSED${X}\n`);
}
