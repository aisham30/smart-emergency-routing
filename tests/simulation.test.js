/**
 * tests/simulation.test.js
 *
 * Automated test suite for Alston's Failure & Recovery Module.
 *
 * Uses Node.js built-in test runner (node:test + node:assert).
 *
 * Run with:
 *   node --test tests/simulation.test.js
 *   or: node tests/simulation.test.js
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import baseNetwork from '../data/network.js';
import {
  cloneGraph,
  failLink,
  failNode,
  restoreLink,
  restoreNode,
  restoreNetwork,
  isPathValid,
  calculatePathDelay,
  dijkstraRouting,
  autoReroute,
  getNetworkHealth,
  getCanonicalLinkKey
} from '../src/simulation/failureRecovery.js';
import { NetworkSimulator } from '../src/simulation/networkSimulator.js';

test('Failure & Recovery - Graph Immutability', () => {
  const originalGraph = cloneGraph(baseNetwork);
  const result = failLink(originalGraph, 'CC', 'N1');

  // Original graph must remain untouched
  assert.equal(originalGraph.CC.N1, 5);
  assert.equal(originalGraph.N1.CC, 5);

  // New graph must reflect the failure
  assert.equal(result.graph.CC.N1, undefined);
  assert.equal(result.graph.N1.CC, undefined);
});

test('Failure & Recovery - failLink contract & bidirectional removal', () => {
  const { graph, failureStatus } = failLink(baseNetwork, 'CC', 'N1');

  // Verify contract fields
  assert.ok(graph, 'Must return updated graph');
  assert.ok(failureStatus, 'Must return failureStatus');
  assert.equal(failureStatus.type, 'link');
  assert.deepEqual(failureStatus.target, ['CC', 'N1']);
  assert.equal(failureStatus.success, true);
  assert.equal(failureStatus.action, 'failed');
  assert.equal(failureStatus.previousWeight, 5);

  // Verify edge removed in both directions
  assert.equal(graph.CC.N1, undefined);
  assert.equal(graph.N1.CC, undefined);

  // Other edges must remain unaffected
  assert.equal(graph.CC.F1, 8);
  assert.equal(graph.CC.P1, 12);
});

test('Failure & Recovery - failLink error handling on non-existent or invalid links', () => {
  const res1 = failLink(baseNetwork, 'CC', 'INVALID');
  assert.equal(res1.failureStatus.success, false);

  const res2 = failLink(baseNetwork, 'CC', 'R2'); // Nodes exist but edge does not
  assert.equal(res2.failureStatus.success, false);
});

test('Failure & Recovery - failNode contract & incident link severing', () => {
  const { graph, failureStatus } = failNode(baseNetwork, 'N1');

  assert.equal(failureStatus.type, 'node');
  assert.equal(failureStatus.target, 'N1');
  assert.equal(failureStatus.success, true);
  assert.equal(failureStatus.action, 'failed');

  // N1 should be deleted from graph
  assert.equal(graph.N1, undefined);

  // Neighbors of N1 (CC, H1, H2, R1) should no longer have edges to N1
  assert.equal(graph.CC.N1, undefined);
  assert.equal(graph.H1.N1, undefined);
  assert.equal(graph.H2.N1, undefined);
  assert.equal(graph.R1.N1, undefined);

  // Other connections must stay intact
  assert.equal(graph.CC.F1, 8);
  assert.equal(graph.F1.H1, 6);
});

test('Failure & Recovery - failNode error handling on invalid node', () => {
  const res = failNode(baseNetwork, 'NON_EXISTENT');
  assert.equal(res.failureStatus.success, false);
});

test('Failure & Recovery - restoreLink restores original weight', () => {
  // First fail the link
  const step1 = failLink(baseNetwork, 'CC', 'N1');
  assert.equal(step1.graph.CC.N1, undefined);

  // Then restore it
  const step2 = restoreLink(step1.graph, baseNetwork, 'CC', 'N1');
  assert.equal(step2.failureStatus.success, true);
  assert.equal(step2.failureStatus.action, 'restored');
  assert.equal(step2.failureStatus.weight, 5);

  assert.equal(step2.graph.CC.N1, 5);
  assert.equal(step2.graph.N1.CC, 5);
});

test('Failure & Recovery - restoreLink fails if endpoint node is currently down', () => {
  const step1 = failNode(baseNetwork, 'N1');
  const step2 = restoreLink(step1.graph, baseNetwork, 'CC', 'N1');

  assert.equal(step2.failureStatus.success, false);
  assert.match(step2.failureStatus.message, /is currently down/);
});

test('Failure & Recovery - restoreNode reconnects only active neighbors', () => {
  // Fail both N1 and H1
  let g = failNode(baseNetwork, 'N1').graph;
  g = failNode(g, 'H1').graph;

  // Restore N1 while H1 remains down
  const { graph, failureStatus } = restoreNode(g, baseNetwork, 'N1');

  assert.equal(failureStatus.success, true);
  assert.ok(graph.N1);

  // Connections to active nodes (CC, H2, R1) should be restored
  assert.equal(graph.N1.CC, 5);
  assert.equal(graph.N1.H2, 10);
  assert.equal(graph.N1.R1, 12);

  // Connection to H1 must NOT be restored since H1 is still down
  assert.equal(graph.N1.H1, undefined);
});

test('Failure & Recovery - restoreNetwork resets to base network', () => {
  let g = failNode(baseNetwork, 'N1').graph;
  g = failLink(g, 'CC', 'F1').graph;

  const { graph, failureStatus } = restoreNetwork(baseNetwork);
  assert.equal(failureStatus.success, true);
  assert.deepEqual(graph, baseNetwork);
});

test('Dijkstra Routing - finds optimal baseline paths', () => {
  // CC -> H2: CC -> N1 -> H2 = 5 + 10 = 15
  const resH2 = dijkstraRouting(baseNetwork, 'CC', 'H2');
  assert.deepEqual(resH2.path, ['CC', 'N1', 'H2']);
  assert.equal(resH2.totalDelay, 15);
  assert.equal(resH2.status, 'reachable');

  // CC -> R2: CC -> P1 -> R2 = 12 + 8 = 20
  const resR2 = dijkstraRouting(baseNetwork, 'CC', 'R2');
  assert.deepEqual(resR2.path, ['CC', 'P1', 'R2']);
  assert.equal(resR2.totalDelay, 20);
  assert.equal(resR2.status, 'reachable');
});

test('Automatic Rerouting - recalculates around failed link', () => {
  // Baseline route
  const baseRoute = dijkstraRouting(baseNetwork, 'CC', 'H2');
  assert.deepEqual(baseRoute.path, ['CC', 'N1', 'H2']);

  // Fail link CC <-> N1
  const { graph } = failLink(baseNetwork, 'CC', 'N1');

  // Auto reroute
  const rerouteResult = autoReroute(graph, 'CC', 'H2', dijkstraRouting, baseRoute.path, baseRoute.totalDelay, baseNetwork);

  assert.equal(rerouteResult.rerouted, true);
  assert.deepEqual(rerouteResult.previousPath, ['CC', 'N1', 'H2']);
  assert.deepEqual(rerouteResult.path, ['CC', 'F1', 'H1', 'H2']);
  assert.equal(rerouteResult.totalDelay, 19); // 8 + 6 + 5 = 19
  assert.equal(rerouteResult.delayDelta, 4); // 19 - 15 = 4
  assert.equal(rerouteResult.status, 'reachable');
});

test('Automatic Rerouting - adapts around failed intermediate node', () => {
  // Baseline route CC -> H1 is CC -> N1 -> H1 (delay 12)
  const baseRoute = dijkstraRouting(baseNetwork, 'CC', 'H1');
  assert.deepEqual(baseRoute.path, ['CC', 'N1', 'H1']);
  assert.equal(baseRoute.totalDelay, 12);

  // Fail node N1
  const { graph } = failNode(baseNetwork, 'N1');

  // Auto reroute around failed node
  const rerouteResult = autoReroute(graph, 'CC', 'H1', dijkstraRouting, baseRoute.path, baseRoute.totalDelay, baseNetwork);

  assert.equal(rerouteResult.rerouted, true);
  assert.deepEqual(rerouteResult.path, ['CC', 'F1', 'H1']);
  assert.equal(rerouteResult.totalDelay, 14); // 8 + 6 = 14
  assert.equal(rerouteResult.delayDelta, 2);
});

test('Automatic Rerouting - handles unreachable destination scenario', () => {
  // Cut both links leading to R2: P1-R2 and R1-R2
  let damaged = failLink(baseNetwork, 'P1', 'R2').graph;
  damaged = failLink(damaged, 'R1', 'R2').graph;

  const res = autoReroute(damaged, 'CC', 'R2');

  assert.equal(res.status, 'unreachable');
  assert.deepEqual(res.path, []);
  assert.equal(res.totalDelay, Infinity);
  assert.match(res.reason, /cannot be reached/);
});

test('NetworkSimulator - complete lifecycle & status tracking', () => {
  const sim = new NetworkSimulator(baseNetwork);

  // Initial state
  let status = sim.getStatus();
  assert.equal(status.activeNodesCount, 8);
  assert.equal(status.failedNodesCount, 0);
  assert.equal(status.failedLinksCount, 0);

  // Fail link
  sim.failLink('CC', 'N1');
  status = sim.getStatus();
  assert.equal(status.failedLinksCount, 1);
  assert.ok(status.failedLinksList.includes('CC<->N1'));

  // Fail node
  sim.failNode('H1');
  status = sim.getStatus();
  assert.equal(status.failedNodesCount, 1);
  assert.ok(status.failedNodesList.includes('H1'));

  // Restore link
  sim.restoreLink('CC', 'N1');
  status = sim.getStatus();
  assert.ok(!status.failedLinksList.includes('CC<->N1'));

  // Restore all
  sim.restoreAll();
  status = sim.getStatus();
  assert.equal(status.activeNodesCount, 8);
  assert.equal(status.failedNodesCount, 0);
  assert.equal(status.failedLinksCount, 0);
});

test('NetworkSimulator - event subscription callback', () => {
  const sim = new NetworkSimulator(baseNetwork);
  let eventReceived = null;

  sim.on('node-fail', (data) => {
    eventReceived = data;
  });

  sim.failNode('F1');

  assert.ok(eventReceived);
  assert.equal(eventReceived.nodeId, 'F1');
  assert.equal(eventReceived.status.success, true);
});

test('NetworkSimulator - pluggable router support', () => {
  const sim = new NetworkSimulator(baseNetwork);

  // Mock router conforming to Deon's contract: (graph, src, dst) -> { path, totalDelay, status }
  const mockRouter = (graph, src, dst) => ({
    path: [src, 'MOCK', dst],
    totalDelay: 42,
    status: 'reachable'
  });

  sim.setRouter(mockRouter);
  const route = sim.findRoute('CC', 'H2');

  assert.deepEqual(route.path, ['CC', 'MOCK', 'H2']);
  assert.equal(route.totalDelay, 42);
  assert.equal(route.status, 'reachable');
});
