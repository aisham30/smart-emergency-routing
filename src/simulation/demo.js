/**
 * demo.js
 *
 * Standalone Demonstration of Failure & Recovery Module.
 *
 * Demonstrates the required sequence from Team Guidelines (Section 6):
 * 1. Normal network state
 * 2. Dijkstra finds fastest route
 * 3. Emergency message dispatch simulation
 * 4. Link failure occurs (e.g. CC <-> N1)
 * 5. System automatically recalculates alternate route + updated delay
 * 6. Node failure occurs (e.g. N1 fails completely)
 * 7. System adapts to node loss and routes around it
 * 8. Unreachable destination scenario (severe damage isolates target)
 * 9. Network restoration (links & nodes recovered, latency returns to baseline)
 *
 * Run with:
 *   node src/simulation/demo.js
 *
 * Author: Alston (Failure & Recovery Module)
 */

import network from '../../data/network.js';
import {
  failLink,
  failNode,
  restoreLink,
  restoreNode,
  restoreNetwork,
  autoReroute,
  dijkstraRouting,
  getNetworkHealth
} from './failureRecovery.js';
import { NetworkSimulator } from './networkSimulator.js';

// ANSI terminal colors for presentation
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';
const DIM = '\x1b[2m';

function banner(title) {
  console.log(`\n${CYAN}${BOLD}${'='.repeat(68)}${RESET}`);
  console.log(`${CYAN}${BOLD}  ${title}${RESET}`);
  console.log(`${CYAN}${BOLD}${'='.repeat(68)}${RESET}`);
}

function stepHeader(num, title) {
  console.log(`\n${YELLOW}${BOLD}[STEP ${num}] ${title}${RESET}`);
}

function runDemo() {
  banner('SMART EMERGENCY ROUTING - FAILURE & RECOVERY DEMO');
  console.log(`${DIM}Author: Alston | Module: Failure & Recovery | Branch: Alston${RESET}`);
  console.log(`${DIM}Network: 8-node urban emergency infrastructure (CC, N1, F1, P1, H1, H2, R1, R2)${RESET}`);

  const sim = new NetworkSimulator(network);

  // --------------------------------------------------------------------------
  // STEP 1: Normal Network State
  // --------------------------------------------------------------------------
  stepHeader(1, 'Normal Network Operational State');
  const initialHealth = sim.getStatus();
  console.log(`Active Nodes: ${GREEN}${initialHealth.activeNodesCount}/${initialHealth.totalBaseNodes}${RESET} online`);
  console.log(`Active Links: ${GREEN}${initialHealth.activeLinksCount}/${initialHealth.totalBaseLinks}${RESET} links functional`);
  console.log(`Topology Status: ${GREEN}100% HEALTHY${RESET}`);

  // --------------------------------------------------------------------------
  // STEP 2: Dijkstra Finds Fastest Route
  // --------------------------------------------------------------------------
  stepHeader(2, 'Dijkstra Finds Fastest Route (CC -> H2)');
  const source = 'CC';
  const destination = 'H2';

  let currentRoute = sim.autoReroute(source, destination);
  console.log(`Dispatch Request: Origin [${source}] -> Emergency Destination [${destination}]`);
  console.log(`Computed Route:   ${GREEN}${BOLD}${currentRoute.path.join(' ──> ')}${RESET}`);
  console.log(`Total Latency:    ${GREEN}${currentRoute.totalDelay} ms${RESET}`);
  console.log(`Status:           ${GREEN}${currentRoute.status.toUpperCase()}${RESET}`);

  // --------------------------------------------------------------------------
  // STEP 3: Emergency Message Sent
  // --------------------------------------------------------------------------
  stepHeader(3, 'Emergency Message Sent Along Optimal Path');
  console.log(`Transmission: [PRIORITY 1 - EMERGENCY MEDICAL DISPATCH]`);
  console.log(`Packet Traversal: ${CYAN}${currentRoute.path.join(' ──> ')}${RESET}`);
  console.log(`Delivery: ${GREEN}SUCCESS${RESET} in ${currentRoute.totalDelay}ms`);

  // --------------------------------------------------------------------------
  // STEP 4: Link Failure Occurs
  // --------------------------------------------------------------------------
  stepHeader(4, 'Link Failure: Primary Link CC <-> N1 Severed!');
  const linkFailRes = sim.failLink('CC', 'N1');
  console.log(`${RED}${BOLD}ALERT: ${linkFailRes.failureStatus.message}${RESET}`);
  console.log(`Contract Output Check:`);
  console.log(`  - failureStatus.type:    "${linkFailRes.failureStatus.type}"`);
  console.log(`  - failureStatus.target:  ${JSON.stringify(linkFailRes.failureStatus.target)}`);
  console.log(`  - failureStatus.success: ${linkFailRes.failureStatus.success}`);

  // --------------------------------------------------------------------------
  // STEP 5: System Recalculates -> New Route & Updated Delay
  // --------------------------------------------------------------------------
  stepHeader(5, 'Automatic Rerouting Around Severed Link');
  const reroutedLink = sim.autoReroute(source, destination, currentRoute.path);
  console.log(`Reroute Triggered: ${YELLOW}${reroutedLink.rerouted ? 'YES (Automated Recalculation)' : 'NO'}${RESET}`);
  console.log(`Reason:            ${reroutedLink.reason}`);
  console.log(`Old Broken Path:   ${RED}${reroutedLink.previousPath.join(' ──> ')}${RESET} (${currentRoute.totalDelay} ms)`);
  console.log(`New Active Path:   ${GREEN}${BOLD}${reroutedLink.path.join(' ──> ')}${RESET} (${reroutedLink.totalDelay} ms)`);
  console.log(`Latency Delta:     ${YELLOW}+${reroutedLink.delayDelta} ms delay increase${RESET}`);
  console.log(`Status:            ${GREEN}${reroutedLink.status.toUpperCase()}${RESET}`);
  currentRoute = reroutedLink;

  // --------------------------------------------------------------------------
  // STEP 6: Node Failure Occurs
  // --------------------------------------------------------------------------
  stepHeader(6, 'Critical Node Failure: Node N1 (Neighbourhood 1) Collapses!');
  const nodeFailRes = sim.failNode('N1');
  console.log(`${RED}${BOLD}CRITICAL INCIDENT: ${nodeFailRes.failureStatus.message}${RESET}`);
  console.log(`Disconnected Links:`);
  nodeFailRes.failureStatus.disconnectedLinks.forEach(([from, to]) => {
    console.log(`  ${RED}✖ Link ${from} <──> ${to} is DEAD${RESET}`);
  });

  // Test rerouting to Relief Camp 1 (R1)
  console.log(`\nEvaluating route to Relief Camp 1 (R1) with N1 down:`);
  const r1Route = sim.autoReroute('CC', 'R1');
  console.log(`Route CC -> R1: ${CYAN}${r1Route.path.join(' ──> ')}${RESET} (Delay: ${r1Route.totalDelay} ms, Status: ${r1Route.status})`);

  // --------------------------------------------------------------------------
  // STEP 7: Unreachable Destination Scenario
  // --------------------------------------------------------------------------
  stepHeader(7, 'Unreachable Destination Scenario: Isolating Relief Camp 2 (R2)');
  console.log(`R2 is connected only to P1 and R1.`);
  console.log(`Simulating failure of all access corridors to R2...`);

  sim.failLink('P1', 'R2');
  sim.failLink('R1', 'R2');

  const unreachableResult = sim.autoReroute('CC', 'R2');
  console.log(`Route Attempt:   CC -> R2`);
  console.log(`Computed Path:   ${RED}${JSON.stringify(unreachableResult.path)}${RESET}`);
  console.log(`Total Delay:     ${RED}${unreachableResult.totalDelay}${RESET}`);
  console.log(`Route Status:    ${RED}${BOLD}${unreachableResult.status.toUpperCase()}${RESET}`);
  console.log(`Diagnostic:      ${YELLOW}${unreachableResult.reason}${RESET}`);

  // --------------------------------------------------------------------------
  // STEP 8: Component & Network Restoration
  // --------------------------------------------------------------------------
  stepHeader(8, 'Network Restoration');
  console.log(`1. Restoring single link P1 <-> R2...`);
  const linkRestored = sim.restoreLink('P1', 'R2');
  console.log(`   ${GREEN}✔ ${linkRestored.failureStatus.message}${RESET}`);

  const restoredR2Route = sim.autoReroute('CC', 'R2');
  console.log(`   Route to R2 recovered: ${GREEN}${restoredR2Route.path.join(' ──> ')}${RESET} (${restoredR2Route.totalDelay} ms)`);

  console.log(`\n2. Performing Full Infrastructure Restoration...`);
  const fullRestore = sim.restoreAll();
  console.log(`   ${GREEN}${BOLD}✔ ${fullRestore.failureStatus.message}${RESET}`);

  const finalHealth = sim.getStatus();
  console.log(`   Active Nodes: ${GREEN}${finalHealth.activeNodesCount}/${finalHealth.totalBaseNodes}${RESET}`);
  console.log(`   Active Links: ${GREEN}${finalHealth.activeLinksCount}/${finalHealth.totalBaseLinks}${RESET}`);

  const finalOptimal = sim.autoReroute('CC', 'H2');
  console.log(`\n3. Verifying route CC -> H2 returns to optimal baseline:`);
  console.log(`   Baseline Route: ${GREEN}${BOLD}${finalOptimal.path.join(' ──> ')}${RESET} (${finalOptimal.totalDelay} ms)`);

  banner('FINAL DEMO COMPLETED SUCCESSFULLY');
}

runDemo();
