/**
 * testRunner.js — In-Browser Scenario Verification & Test Runner
 *
 * Runs all 8 end-to-end emergency routing scenarios directly in the browser dashboard.
 * Mirrors tests/scenario.verify.js and tests/simulation.test.js.
 */

import baseNetwork from '../../../data/network.js';
import { findShortestPath } from '../../algorithm/index.js';
import {
  NetworkSimulator,
  failLink, failNode,
  restoreLink, restoreNode, restoreNetwork
} from '../../simulation/index.js';

function getRoute(graph, src, dst) {
  const r = findShortestPath(graph, src, dst);
  if (!r || r.status === 'unreachable') return null;
  return { path: r.path, cost: r.totalDelay, hops: r.path.length - 1 };
}

export function runBrowserTestSuite() {
  const checks = [];
  let totalPass = 0;
  let totalFail = 0;

  function check(scenario, label, pass, got, expected) {
    if (pass) {
      totalPass++;
      checks.push({ scenario, label, pass: true, got, expected });
    } else {
      totalFail++;
      checks.push({ scenario, label, pass: false, got, expected });
    }
  }

  // ── 1. 8-Node Network Completeness ─────────────────────────────────────────
  const EXPECTED_NODES = ['CC','N1','F1','P1','H1','H2','R1','R2'];
  const actualNodes = Object.keys(baseNetwork);
  check(1, 'Network has exactly 8 nodes', actualNodes.length === 8, actualNodes.length, 8);
  for (const n of EXPECTED_NODES) {
    check(1, `Node "${n}" present in graph`, actualNodes.includes(n), true, true);
  }

  let symmetric = true;
  for (const [u, nbrs] of Object.entries(baseNetwork)) {
    for (const [v, w] of Object.entries(nbrs)) {
      if (!baseNetwork[v] || baseNetwork[v][u] !== w) { symmetric = false; break; }
    }
  }
  check(1, 'All edges are symmetric (undirected)', symmetric, true, true);

  const edgeCount = Object.values(baseNetwork).reduce((s, n) => s + Object.keys(n).length, 0) / 2;
  check(1, 'Network has 12 edges', edgeCount === 12, edgeCount, 12);

  let allReachable = true;
  for (const n of EXPECTED_NODES) {
    if (n === 'CC') continue;
    const r = findShortestPath(baseNetwork, 'CC', n);
    if (r.status !== 'reachable') { allReachable = false; break; }
  }
  check(1, 'All 7 non-CC nodes reachable from CC', allReachable, true, true);

  // ── 2. Real Dijkstra Shortest-Path Results ──────────────────────────────────
  const cases = [
    { src: 'CC', dst: 'N1', cost: 5,  path: ['CC','N1'] },
    { src: 'CC', dst: 'H1', cost: 12, path: ['CC','N1','H1'] },
    { src: 'CC', dst: 'H2', cost: 15, path: ['CC','N1','H2'] },
    { src: 'CC', dst: 'F1', cost: 8,  path: ['CC','F1'] },
    { src: 'CC', dst: 'P1', cost: 12, path: ['CC','P1'] },
    { src: 'CC', dst: 'R2', cost: 20, path: ['CC','P1','R2'] },
    { src: 'CC', dst: 'R1', cost: 17, path: ['CC','N1','R1'] },
    { src: 'N1', dst: 'R2', cost: 16, path: ['N1','R1','R2'] },
    { src: 'H1', dst: 'R2', cost: 15, path: ['H1','H2','R1','R2'] },
    { src: 'F1', dst: 'R2', cost: 15, path: ['F1','P1','R2'] },
    { src: 'R1', dst: 'R2', cost: 4,  path: ['R1','R2'] }
  ];

  for (const { src, dst, cost, path } of cases) {
    const r = findShortestPath(baseNetwork, src, dst);
    check(2, `${src}→${dst}: reachable`, r.status === 'reachable', r.status, 'reachable');
    check(2, `${src}→${dst}: delay = ${cost}`, r.totalDelay === cost, r.totalDelay, cost);
    if (path) {
      check(2, `${src}→${dst}: path optimal`, JSON.stringify(r.path) === JSON.stringify(path), r.path, path);
    }
  }

  // ── 3. Route Output Adapter (path, cost, hops) ─────────────────────────────
  const routeH1 = getRoute(baseNetwork, 'CC', 'H1');
  check(3, 'getRoute returns structured object', routeH1 !== null, true, true);
  check(3, 'route.cost matches totalDelay (12)', routeH1?.cost === 12, routeH1?.cost, 12);
  check(3, 'route.hops matches path.length - 1 (2)', routeH1?.hops === 2, routeH1?.hops, 2);
  check(3, 'route starts at CC and ends at H1', routeH1?.path[0] === 'CC' && routeH1?.path.at(-1) === 'H1', true, true);

  // ── 4. Emergency Message Path Validity ─────────────────────────────────────
  const testPairs = [['CC','H1'], ['CC','R2'], ['F1','R2'], ['N1','H2'], ['P1','R1']];
  for (const [src, dst] of testPairs) {
    const r = findShortestPath(baseNetwork, src, dst);
    let valid = r.status === 'reachable' && r.path.length >= 2;
    if (valid) {
      for (let i = 0; i < r.path.length - 1; i++) {
        const u = r.path[i], v = r.path[i+1];
        if (baseNetwork[u]?.[v] === undefined) { valid = false; break; }
      }
    }
    check(4, `Message corridor ${src}→${dst} traversable`, valid, true, true);
  }

  // ── 5. Link Failure → Automatic Rerouting ──────────────────────────────────
  const simLink = new NetworkSimulator(baseNetwork);
  simLink.setRouter(findShortestPath);
  const baseH1 = simLink.findRoute('CC', 'H1');
  check(5, 'Baseline CC→H1 is 12', baseH1.totalDelay === 12, baseH1.totalDelay, 12);

  simLink.failLink('CC', 'N1');
  const rerouteH1 = simLink.autoReroute('CC', 'H1', baseH1.path, baseH1.totalDelay);
  check(5, 'Link CC↔N1 fails → rerouted is true', rerouteH1.rerouted, true, true);
  check(5, 'Bypass path traverses CC→F1→H1', JSON.stringify(rerouteH1.path) === JSON.stringify(['CC','F1','H1']), rerouteH1.path, ['CC','F1','H1']);
  check(5, 'New cost is 14 (+2ms delta)', rerouteH1.totalDelay === 14, rerouteH1.totalDelay, 14);

  // ── 6. Node Failure → Automatic Rerouting ──────────────────────────────────
  const simNode = new NetworkSimulator(baseNetwork);
  simNode.setRouter(findShortestPath);
  const baseNode = simNode.findRoute('CC', 'H1');
  simNode.failNode('N1');
  const rerouteNode = simNode.autoReroute('CC', 'H1', baseNode.path, baseNode.totalDelay);
  check(6, 'Node N1 collapses → rerouted is true', rerouteNode.rerouted, true, true);
  check(6, 'Bypass path traverses CC→F1→H1', JSON.stringify(rerouteNode.path) === JSON.stringify(['CC','F1','H1']), rerouteNode.path, ['CC','F1','H1']);
  check(6, 'N1 is marked in failedNodesList', simNode.getStatus().failedNodesList.includes('N1'), true, true);

  // ── 7. Network Restoration ─────────────────────────────────────────────────
  const simRest = new NetworkSimulator(baseNetwork);
  simRest.setRouter(findShortestPath);
  simRest.failLink('CC', 'N1');
  simRest.restoreLink('CC', 'N1');
  const restLinkPath = simRest.findRoute('CC', 'H1');
  check(7, 'Link restored → returns to optimal baseline (12ms)', restLinkPath.totalDelay === 12, restLinkPath.totalDelay, 12);

  simRest.failNode('N1');
  simRest.restoreNode('N1');
  const restNodePath = simRest.findRoute('CC', 'H1');
  check(7, 'Node restored → returns to optimal baseline (12ms)', restNodePath.totalDelay === 12, restNodePath.totalDelay, 12);

  simRest.failNode('N1');
  simRest.failNode('H1');
  simRest.failLink('P1', 'R2');
  simRest.restoreAll();
  const restAllStatus = simRest.getStatus();
  check(7, 'restoreAll() clears all failed nodes (0)', restAllStatus.failedNodesCount === 0, restAllStatus.failedNodesCount, 0);
  check(7, 'restoreAll() clears all failed links (0)', restAllStatus.failedLinksCount === 0, restAllStatus.failedLinksCount, 0);
  check(7, 'restoreAll() baseline route restored (12ms)', simRest.findRoute('CC', 'H1').totalDelay === 12, 12, 12);

  // ── 8. Unreachable Destination Handling ────────────────────────────────────
  const simIso = new NetworkSimulator(baseNetwork);
  simIso.setRouter(findShortestPath);
  simIso.failLink('P1', 'R2');
  simIso.failLink('R1', 'R2');
  const unreach = simIso.autoReroute('CC', 'R2');
  check(8, 'Isolated R2 status is unreachable', unreach.status === 'unreachable', unreach.status, 'unreachable');
  check(8, 'Total delay is Infinity', unreach.totalDelay === Infinity, unreach.totalDelay, Infinity);
  check(8, 'Path is empty array', unreach.path.length === 0, unreach.path.length, 0);
  check(8, 'Frontend adapter returns null for unreachable', getRoute(simIso.getGraph(), 'CC', 'R2') === null, true, true);

  return {
    totalPass,
    totalFail,
    totalTests: checks.length,
    checks,
    timestamp: new Date().toLocaleTimeString('en-GB')
  };
}
