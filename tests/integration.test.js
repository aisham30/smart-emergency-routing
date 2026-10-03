/**
 * tests/integration.test.js
 *
 * Full integration test for Smart Emergency Communication Routing.
 * Tests all three modules working together end-to-end:
 *   • Deon's findShortestPath (src/algorithm/)
 *   • Alston's NetworkSimulator (src/simulation/)
 *   • Data layer from data/network.js
 *
 * Run: node tests/integration.test.js
 *
 * 7 Scenarios covered:
 *   1. Normal shortest path
 *   2. Different source / destination pairs
 *   3. Link failure → automatic rerouting
 *   4. Node failure → automatic rerouting
 *   5. Unreachable destination (all routes severed)
 *   6. Node / link restoration → route returns to optimal baseline
 *   7. Frontend route format adapter (path, cost, hops)
 */

import assert from 'node:assert/strict';
import network from '../data/network.js';
import { findShortestPath }  from '../src/algorithm/index.js';
import { NetworkSimulator }  from '../src/simulation/index.js';
import { failLink, failNode, restoreLink, restoreNode } from '../src/simulation/index.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

let passed = 0, failed = 0;

function scenario(num, name) {
  console.log(`\n${CYAN}${BOLD}[SCENARIO ${num}] ${name}${RESET}`);
}

function check(label, condition, got, expected) {
  if (condition) {
    console.log(`  ${GREEN}✓${RESET} ${label}`);
    passed++;
  } else {
    console.log(`  ${RED}✗${RESET} ${label}`);
    console.log(`    Expected: ${JSON.stringify(expected)}`);
    console.log(`    Got:      ${JSON.stringify(got)}`);
    failed++;
  }
}

// Frontend adapter — mirrors getRoute() in src/frontend/js/network.js
function getRoute(graph, src, dst) {
  const r = findShortestPath(graph, src, dst);
  if (!r || r.status === 'unreachable') return null;
  return { path: r.path, cost: r.totalDelay, hops: r.path.length - 1 };
}

// ═════════════════════════════════════════════════════════════════════════════
// SCENARIO 1 — Normal shortest path (CC -> H1)
// ═════════════════════════════════════════════════════════════════════════════
scenario(1, 'Normal shortest path — CC → H1');
{
  const r = findShortestPath(network, 'CC', 'H1');
  check('status is reachable',        r.status === 'reachable',         r.status, 'reachable');
  check('path is CC→N1→H1',          JSON.stringify(r.path) === JSON.stringify(['CC','N1','H1']), r.path, ['CC','N1','H1']);
  check('totalDelay is 12',          r.totalDelay === 12,               r.totalDelay, 12);
}

// ═════════════════════════════════════════════════════════════════════════════
// SCENARIO 2 — Different source / destination pairs
// ═════════════════════════════════════════════════════════════════════════════
scenario(2, 'Different source/destination pairs');
{
  // CC → R2  (via P1)
  const r1 = findShortestPath(network, 'CC', 'R2');
  check('CC→R2: reachable',          r1.status === 'reachable',         r1.status, 'reachable');
  check('CC→R2: path CC→P1→R2',     JSON.stringify(r1.path) === JSON.stringify(['CC','P1','R2']), r1.path, ['CC','P1','R2']);
  check('CC→R2: totalDelay 20',      r1.totalDelay === 20,              r1.totalDelay, 20);

  // N1 → R2  (via R1)
  const r2 = findShortestPath(network, 'N1', 'R2');
  check('N1→R2: reachable',          r2.status === 'reachable',         r2.status, 'reachable');
  check('N1→R2: path N1→R1→R2',     JSON.stringify(r2.path) === JSON.stringify(['N1','R1','R2']), r2.path, ['N1','R1','R2']);
  check('N1→R2: totalDelay 16',      r2.totalDelay === 16,              r2.totalDelay, 16);

  // H1 → R2
  const r3 = findShortestPath(network, 'H1', 'R2');
  check('H1→R2: reachable',          r3.status === 'reachable',         r3.status, 'reachable');
  check('H1→R2: totalDelay 15',      r3.totalDelay === 15,              r3.totalDelay, 15);
}

// ═════════════════════════════════════════════════════════════════════════════
// SCENARIO 3 — Link failure → automatic rerouting
// ═════════════════════════════════════════════════════════════════════════════
scenario(3, 'Link failure → automatic rerouting (CC↔N1 fails)');
{
  const sim = new NetworkSimulator(network);
  sim.setRouter(findShortestPath);

  // Baseline route CC → H2 = CC→N1→H2 (cost 15)
  const base = sim.findRoute('CC', 'H2');
  check('baseline: CC→H2 reachable',                 base.status === 'reachable',          base.status, 'reachable');
  check('baseline: path CC→N1→H2',                   JSON.stringify(base.path) === JSON.stringify(['CC','N1','H2']), base.path, ['CC','N1','H2']);
  check('baseline: totalDelay 15',                   base.totalDelay === 15,               base.totalDelay, 15);

  // Fail link CC ↔ N1
  const failResult = sim.failLink('CC', 'N1');
  check('failLink CC↔N1 succeeded',                  failResult.failureStatus.success,     failResult.failureStatus.success, true);

  // Auto reroute
  const reRoute = sim.autoReroute('CC', 'H2', base.path, base.totalDelay);
  check('rerouted flag is true',                     reRoute.rerouted,                     reRoute.rerouted, true);
  check('rerouted status: reachable',                reRoute.status === 'reachable',       reRoute.status, 'reachable');
  check('rerouted path via F1,H1 (CC→F1→H1→H2)',    JSON.stringify(reRoute.path) === JSON.stringify(['CC','F1','H1','H2']), reRoute.path, ['CC','F1','H1','H2']);
  check('rerouted totalDelay is 19 (8+6+5)',         reRoute.totalDelay === 19,            reRoute.totalDelay, 19);
  check('delayDelta is +4',                          reRoute.delayDelta === 4,             reRoute.delayDelta, 4);
}

// ═════════════════════════════════════════════════════════════════════════════
// SCENARIO 4 — Node failure → automatic rerouting
// ═════════════════════════════════════════════════════════════════════════════
scenario(4, 'Node failure → automatic rerouting (N1 collapses)');
{
  const sim = new NetworkSimulator(network);
  sim.setRouter(findShortestPath);

  // Baseline CC → H1 = CC→N1→H1 (cost 12)
  const base = sim.findRoute('CC', 'H1');
  check('baseline: CC→H1 via N1, cost 12', base.totalDelay === 12, base.totalDelay, 12);

  // Fail node N1
  const failResult = sim.failNode('N1');
  check('failNode N1 succeeded',  failResult.failureStatus.success, failResult.failureStatus.success, true);

  // Auto reroute
  const reRoute = sim.autoReroute('CC', 'H1', base.path, base.totalDelay);
  check('rerouted flag is true',                    reRoute.rerouted,                    reRoute.rerouted, true);
  check('rerouted path via F1 (CC→F1→H1)',          JSON.stringify(reRoute.path) === JSON.stringify(['CC','F1','H1']), reRoute.path, ['CC','F1','H1']);
  check('rerouted totalDelay is 14 (8+6)',           reRoute.totalDelay === 14,           reRoute.totalDelay, 14);
  check('delayDelta is +2',                          reRoute.delayDelta === 2,            reRoute.delayDelta, 2);

  // Verify N1 removed from graph
  const status = sim.getStatus();
  check('N1 in failedNodesList',  status.failedNodesList.includes('N1'), status.failedNodesList, ['N1']);
  check('failedNodesCount is 1',  status.failedNodesCount === 1,         status.failedNodesCount, 1);
}

// ═════════════════════════════════════════════════════════════════════════════
// SCENARIO 5 — Unreachable destination
// ═════════════════════════════════════════════════════════════════════════════
scenario(5, 'Unreachable destination (all routes to R2 severed)');
{
  const sim = new NetworkSimulator(network);
  sim.setRouter(findShortestPath);

  // R2 has only two connections: P1↔R2 and R1↔R2
  sim.failLink('P1', 'R2');
  sim.failLink('R1', 'R2');

  const result = sim.autoReroute('CC', 'R2');
  check('status is unreachable',      result.status === 'unreachable',   result.status, 'unreachable');
  check('path is empty array',        result.path.length === 0,          result.path.length, 0);
  check('totalDelay is Infinity',     result.totalDelay === Infinity,    result.totalDelay, Infinity);
  check('reason mentions R2',         result.reason.includes('R2'),      result.reason, '…R2…');

  // Direct findShortestPath check
  const r = findShortestPath(sim.getGraph(), 'CC', 'R2');
  check('findShortestPath returns unreachable', r.status === 'unreachable', r.status, 'unreachable');
}

// ═════════════════════════════════════════════════════════════════════════════
// SCENARIO 6 — Node / link restoration → route returns to baseline
// ═════════════════════════════════════════════════════════════════════════════
scenario(6, 'Restoration → route returns to optimal baseline');
{
  const sim = new NetworkSimulator(network);
  sim.setRouter(findShortestPath);

  // Fail CC↔N1
  sim.failLink('CC', 'N1');
  const postFail = sim.findRoute('CC', 'H2');
  check('after link fail: rerouted to longer path', postFail.totalDelay > 15, postFail.totalDelay, '>15');

  // Restore CC↔N1
  const restResult = sim.restoreLink('CC', 'N1');
  check('restoreLink succeeded', restResult.failureStatus.success, restResult.failureStatus.success, true);

  const afterRestore = sim.findRoute('CC', 'H2');
  check('after restore: path returns to CC→N1→H2',   JSON.stringify(afterRestore.path) === JSON.stringify(['CC','N1','H2']), afterRestore.path, ['CC','N1','H2']);
  check('after restore: delay returns to 15',          afterRestore.totalDelay === 15,         afterRestore.totalDelay, 15);

  // Fail N1 node entirely, then restoreAll
  sim.failNode('N1');
  const postNode = sim.findRoute('CC', 'H2');
  check('after node fail: longer path used', postNode.totalDelay > 15, postNode.totalDelay, '>15');

  sim.restoreAll();
  const afterAll = sim.findRoute('CC', 'H2');
  check('after restoreAll: baseline restored', afterAll.totalDelay === 15, afterAll.totalDelay, 15);
  check('after restoreAll: failedNodesCount 0', sim.getStatus().failedNodesCount === 0, sim.getStatus().failedNodesCount, 0);
  check('after restoreAll: failedLinksCount 0', sim.getStatus().failedLinksCount === 0, sim.getStatus().failedLinksCount, 0);
}

// ═════════════════════════════════════════════════════════════════════════════
// SCENARIO 7 — Frontend route format adapter (path, cost, hops)
// ═════════════════════════════════════════════════════════════════════════════
scenario(7, 'Frontend route adapter: totalDelay→cost, hops computed correctly');
{
  // Normal route
  const r1 = getRoute(network, 'CC', 'H1');
  check('adapter returns non-null',              r1 !== null,                         r1, '{path,cost,hops}');
  check('adapter: path matches',                 JSON.stringify(r1.path) === JSON.stringify(['CC','N1','H1']), r1.path, ['CC','N1','H1']);
  check('adapter: cost is 12 (from totalDelay)', r1.cost === 12,                     r1.cost, 12);
  check('adapter: hops is 2',                    r1.hops === 2,                       r1.hops, 2);

  // Sim + adapter integration
  const sim = new NetworkSimulator(network);
  sim.setRouter(findShortestPath);
  sim.failLink('CC', 'N1');

  const r2 = getRoute(sim.getGraph(), 'CC', 'H1');
  check('adapter on post-fail graph: non-null',  r2 !== null,                         r2, '{path,cost,hops}');
  check('adapter on post-fail: rerouted path',   !r2.path.includes('N1'),             r2.path, 'no N1');
  check('adapter on post-fail: cost matches totalDelay', typeof r2.cost === 'number', typeof r2.cost, 'number');
  check('adapter on post-fail: hops = path.length-1', r2.hops === r2.path.length - 1, r2.hops, r2.path.length - 1);

  // Unreachable returns null
  const sim2 = new NetworkSimulator(network);
  sim2.setRouter(findShortestPath);
  sim2.failLink('P1', 'R2');
  sim2.failLink('R1', 'R2');
  const r3 = getRoute(sim2.getGraph(), 'CC', 'R2');
  check('adapter on unreachable returns null',   r3 === null,                         r3, null);
}

// ═════════════════════════════════════════════════════════════════════════════
// Summary
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(60));
console.log(`${BOLD}Integration Test Results${RESET}`);
console.log('═'.repeat(60));
console.log(`  ${GREEN}${BOLD}PASSED: ${passed}${RESET}`);
if (failed > 0) {
  console.log(`  ${RED}${BOLD}FAILED: ${failed}${RESET}`);
  console.log('\n❌ Integration tests FAILED — do not merge\n');
  process.exit(1);
} else {
  console.log(`  ${YELLOW}FAILED: 0${RESET}`);
  console.log(`\n${GREEN}${BOLD}✅ All ${passed} integration tests PASSED${RESET}\n`);
}
