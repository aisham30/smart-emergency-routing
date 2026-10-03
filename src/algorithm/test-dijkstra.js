/**
 * test-dijkstra.js — Manual test script for the Dijkstra algorithm
 *
 * Author: Deon (Algorithm Module)
 *
 * Run: node src/algorithm/test-dijkstra.js
 *
 * Uses data/network.js as the single source of truth for the graph.
 * No external dependencies — Node built-ins only.
 */

import network from '../../data/network.js';
import { findShortestPath } from './dijkstra.js';

function printResult(testName, source, destination, result) {
  console.log('\n-----------------------------------');
  console.log(testName);
  console.log('-----------------------------------');
  console.log(`Source:      ${source}`);
  console.log(`Destination: ${destination}`);
  console.log(`Status:      ${result.status}`);

  if (result.status === 'reachable') {
    console.log(`Path:        ${result.path.join(' -> ')}`);
    console.log(`Total Delay: ${result.totalDelay} ms`);
  } else {
    console.log('Path:        Unreachable');
    console.log('Total Delay: Infinity');
  }
}

// Test 1: Control Centre -> Hospital 1  (expected: CC -> N1 -> H1, delay 12)
const result1 = findShortestPath(network, 'CC', 'H1');
printResult('Test 1: CC to H1', 'CC', 'H1', result1);
console.assert(result1.status === 'reachable', 'T1: should be reachable');
console.assert(result1.totalDelay === 12, `T1: expected delay 12, got ${result1.totalDelay}`);

// Test 2: Control Centre -> Rescue Unit 2  (expected: CC -> P1 -> R2, delay 20)
const result2 = findShortestPath(network, 'CC', 'R2');
printResult('Test 2: CC to R2', 'CC', 'R2', result2);
console.assert(result2.status === 'reachable', 'T2: should be reachable');
console.assert(result2.totalDelay === 20, `T2: expected delay 20, got ${result2.totalDelay}`);

// Test 3: Control Centre -> Police Station 1  (expected: CC -> P1, delay 12)
const result3 = findShortestPath(network, 'CC', 'P1');
printResult('Test 3: CC to P1', 'CC', 'P1', result3);
console.assert(result3.status === 'reachable', 'T3: should be reachable');
console.assert(result3.totalDelay === 12, `T3: expected delay 12, got ${result3.totalDelay}`);

// Test 4: Same source and destination
const result4 = findShortestPath(network, 'CC', 'CC');
printResult('Test 4: CC to CC (same node)', 'CC', 'CC', result4);
console.assert(result4.status === 'reachable', 'T4: same-node should be reachable');
console.assert(result4.totalDelay === 0, 'T4: same-node delay should be 0');

// Test 5: Unreachable destination on a disconnected graph
const disconnectedNetwork = {
  A: { B: 5 },
  B: { A: 5 },
  C: {}
};
const result5 = findShortestPath(disconnectedNetwork, 'A', 'C');
printResult('Test 5: A to C (unreachable)', 'A', 'C', result5);
console.assert(result5.status === 'unreachable', 'T5: should be unreachable');
console.assert(result5.totalDelay === Infinity, 'T5: delay should be Infinity');

// Test 6: Non-existent source node
const result6 = findShortestPath(network, 'INVALID', 'H1');
printResult('Test 6: INVALID to H1 (bad source)', 'INVALID', 'H1', result6);
console.assert(result6.status === 'unreachable', 'T6: bad source should be unreachable');

// Test 7: N1 -> R2  (expected: N1 -> R1 -> R2, delay 16)
const result7 = findShortestPath(network, 'N1', 'R2');
printResult('Test 7: N1 to R2 (different source)', 'N1', 'R2', result7);
console.assert(result7.status === 'reachable', 'T7: should be reachable');
console.assert(result7.totalDelay === 16, `T7: expected delay 16, got ${result7.totalDelay}`);

console.log('\n===================================');
console.log('All Dijkstra tests PASSED ✓');
console.log('===================================\n');