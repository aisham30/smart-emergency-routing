/**
 * app.js — Main Application Controller
 *
 * Fully wires:
 *   • Deon's findShortestPath  (src/algorithm/)
 *   • Alston's NetworkSimulator (src/simulation/)
 *   • Aisha's NetworkVisualizer + UIController (src/frontend/)
 *   • In-Browser Scenario Verification & Test Suite Runner (testRunner.js)
 */

import { GRAPH, NODE_INFO, EDGES }        from './network.js';
import { NetworkVisualizer }               from './visualizer.js';
import { UIController }                    from './ui.js';
import { findShortestPath }                from '../../algorithm/index.js';
import { NetworkSimulator, getCanonicalLinkKey } from '../../simulation/index.js';
import { runBrowserTestSuite }             from './testRunner.js';

const TOTAL_NODES = Object.keys(NODE_INFO).length;
const TOTAL_EDGES = EDGES.length;

class App {
  constructor() {
    this.state = {
      source:       'CC',
      destination:  'H1',
      currentRoute: null,
    };

    // ── Instantiate core modules ─────────────────────────────────────────────
    const svgEl = document.getElementById('network-svg');

    this.viz = new NetworkVisualizer(svgEl, GRAPH, NODE_INFO, EDGES);

    this.ui = new UIController({
      onFindRoute:          this.#handleFindRoute.bind(this),
      onClearRoute:         this.#handleClearRoute.bind(this),
      onNodeClick:          this.#handleNodeClick.bind(this),
      onSendMessage:        this.#handleSendMessage.bind(this),
      onToggleNodeFail:     this.#handleToggleNodeFail.bind(this),
      onToggleLinkFail:     this.#handleToggleLinkFail.bind(this),
      onRestoreAll:         this.#handleRestoreAll.bind(this),
      onRunTestSuite:       this.#handleRunTestSuite.bind(this),
      onRunScenarioPreset:  this.#handleRunScenarioPreset.bind(this),
    });

    // ── Simulator: owns live graph state + pluggable router ──────────────────
    this.sim = new NetworkSimulator(GRAPH);
    this.sim.setRouter(findShortestPath);   // wire Deon's algorithm

    // Sim internal events → visual updates + auto-reroute
    this.sim.on('node-fail',       ({ nodeId }) => this.#onNodeFail(nodeId));
    this.sim.on('node-restore',    ({ nodeId }) => this.#onNodeRestore(nodeId));
    this.sim.on('link-fail',       ({ u, v })   => this.#onLinkFail(u, v));
    this.sim.on('link-restore',    ({ u, v })   => this.#onLinkRestore(u, v));
    this.sim.on('network-restore', ()           => this.#onNetworkRestore());

    // ── Window event bus ─────────────────────────────────────────────────────
    window.addEventListener('sim:node-fail',    e => this.sim.failNode(e.detail));
    window.addEventListener('sim:node-restore', e => this.sim.restoreNode(e.detail));
    window.addEventListener('sim:link-fail',    e => { const { u, v } = e.detail || {}; if (u && v) this.sim.failLink(u, v); });
    window.addEventListener('sim:link-restore', e => { const { u, v } = e.detail || {}; if (u && v) this.sim.restoreLink(u, v); });
    window.addEventListener('sim:network-restore', () => this.sim.restoreAll());

    // ── Render + initial markers ─────────────────────────────────────────────
    this.viz.render();
    this.viz.markSource('CC');
    this.viz.markDest('H1');
    this.ui.updateNetworkStats(TOTAL_NODES, TOTAL_NODES, TOTAL_EDGES, TOTAL_EDGES);

    // Initial default route calculation
    this.#handleFindRoute('CC', 'H1');

    // ── Wire dropdown changes ────────────────────────────────────────────────
    document.getElementById('sel-source')?.addEventListener('change', e => {
      this.state.source = e.target.value;
      this.#resetToMarkers();
    });

    document.getElementById('sel-dest')?.addEventListener('change', e => {
      this.state.destination = e.target.value;
      this.#resetToMarkers();
    });

    // ── SVG map interactions ────────────────────────────────────────────────
    svgEl.addEventListener('node-click', e => {
      const id = e.detail;
      if (id === this.state.source) return;
      this.state.destination = id;
      this.ui.setDest(id);
      this.ui.highlightNodeInList(id);
      this.#resetToMarkers();
      this.#handleFindRoute(this.state.source, id);
    });

    // Clicking a link line or label on SVG toggles its failure state
    svgEl.addEventListener('link-click', e => {
      const { u, v } = e.detail || {};
      if (u && v) this.#handleToggleLinkFail(u, v);
    });
  }

  // ── Route finding (uses sim's live graph — respects failures) ──────────────

  #handleFindRoute(src, dst) {
    const result = this.sim.findRoute(src, dst);

    if (result.status === 'unreachable') {
      this.viz.clearRoute();
      this.state.currentRoute = null;
      this.ui.showError(`No route from <strong>${src}</strong> to <strong>${dst}</strong> — destination unreachable.`);
      return;
    }

    const route = {
      path: result.path,
      cost: result.totalDelay,
      hops: result.path.length - 1,
    };

    this.state.currentRoute = route;
    this.viz.highlightRoute(route.path);
    this.ui.showRoute(route);
  }

  #handleClearRoute() {
    this.state.currentRoute = null;
    this.viz.clearRoute();
    this.viz.markSource(this.state.source);
    this.viz.markDest(this.state.destination);
  }

  #resetToMarkers() {
    this.state.currentRoute = null;
    this.viz.clearRoute();
    this.viz.markSource(this.state.source);
    this.viz.markDest(this.state.destination);
    this.ui.clearRoutePanel();
  }

  // ── Sidebar node click ────────────────────────────────────────────────────

  #handleNodeClick(id) {
    if (id === this.state.source) return;
    this.state.destination = id;
    this.ui.setDest(id);
    this.ui.highlightNodeInList(id);
    this.#resetToMarkers();
    this.#handleFindRoute(this.state.source, id);
  }

  // ── Emergency message send + animation ────────────────────────────────────

  #handleSendMessage(msg) {
    const route = this.state.currentRoute;
    if (!route) return;

    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    this.ui.setTransmitting(true);
    const logEntry = this.ui.addLogEntry({ time, path: route.path, cost: route.cost, msg });

    this.viz.animateMessage(route.path, () => {
      this.ui.setTransmitting(false);
      this.ui.markDelivered(logEntry);
      this.ui.clearMessageInput();
    });
  }

  // ── Fault Injection Handlers ──────────────────────────────────────────────

  #handleToggleNodeFail(id) {
    if (this.sim.failedNodes.has(id)) {
      this.sim.restoreNode(id);
    } else {
      this.sim.failNode(id);
    }
  }

  #handleToggleLinkFail(u, v) {
    const key = getCanonicalLinkKey(u, v);
    if (this.sim.failedLinks.has(key)) {
      this.sim.restoreLink(u, v);
    } else {
      this.sim.failLink(u, v);
    }
  }

  #handleRestoreAll() {
    this.sim.restoreAll();
  }

  // ── Simulation Event Listeners (fired by NetworkSimulator) ────────────────

  #onNodeFail(id) {
    this.viz.setNodeState(id, 'failed');
    this.ui.updateNodeTag(id, 'failed');
    this.#updateNetworkStats();
    this.ui.updateIncidentAlert(this.sim.failedNodes, this.sim.failedLinks);

    if (this.state.currentRoute?.path.includes(id)) {
      this.#attemptAutoReroute(`Node <strong>${id}</strong> collapsed`);
    }
  }

  #onNodeRestore(id) {
    this.viz.setNodeState(id, 'active');
    this.ui.updateNodeTag(id, 'active');
    this.#updateNetworkStats();
    this.ui.updateIncidentAlert(this.sim.failedNodes, this.sim.failedLinks);

    if (this.state.source && this.state.destination) {
      this.#handleFindRoute(this.state.source, this.state.destination);
    }
  }

  #onLinkFail(u, v) {
    this.viz.setLinkState(u, v, 'failed');
    this.#updateNetworkStats();
    this.ui.updateIncidentAlert(this.sim.failedNodes, this.sim.failedLinks);

    const path = this.state.currentRoute?.path;
    if (path) {
      const affected = path.some((n, i) =>
        i < path.length - 1 &&
        ((path[i] === u && path[i + 1] === v) || (path[i] === v && path[i + 1] === u))
      );
      if (affected) this.#attemptAutoReroute(`Link <strong>${u}↔${v}</strong> severed`);
    }
  }

  #onLinkRestore(u, v) {
    this.viz.setLinkState(u, v, 'active');
    this.#updateNetworkStats();
    this.ui.updateIncidentAlert(this.sim.failedNodes, this.sim.failedLinks);

    if (this.state.source && this.state.destination) {
      this.#handleFindRoute(this.state.source, this.state.destination);
    }
  }

  #onNetworkRestore() {
    this.viz.restoreAll();
    this.ui.resetAllNodes();
    this.#updateNetworkStats();
    this.ui.updateIncidentAlert(this.sim.failedNodes, this.sim.failedLinks);

    if (this.state.source && this.state.destination) {
      this.#handleFindRoute(this.state.source, this.state.destination);
    }
  }

  /**
   * Tries to find a bypass route on the updated (post-failure) graph.
   */
  #attemptAutoReroute(failureReason) {
    const prevPath = this.state.currentRoute?.path ?? null;
    const prevCost = this.state.currentRoute?.cost ?? null;

    const reRoute = this.sim.autoReroute(
      this.state.source,
      this.state.destination,
      prevPath,
      prevCost
    );

    if (reRoute.status === 'unreachable') {
      this.viz.clearRoute();
      this.state.currentRoute = null;
      this.ui.showError(`${failureReason} — <strong>${this.state.destination}</strong> is now unreachable. All connecting routes severed.`);
      this.ui.updateIncidentAlert(this.sim.failedNodes, this.sim.failedLinks, {
        unreachable: true,
        target: this.state.destination
      });
    } else {
      const newRoute = {
        path: reRoute.path,
        cost: reRoute.totalDelay,
        hops: reRoute.path.length - 1,
      };
      this.state.currentRoute = newRoute;
      this.viz.highlightRoute(newRoute.path);
      const rerouteInfo = {
        reason: failureReason,
        prevPath,
        prevCost,
        delayDelta: reRoute.delayDelta
      };
      this.ui.showRoute(newRoute, rerouteInfo);
      this.ui.updateIncidentAlert(this.sim.failedNodes, this.sim.failedLinks, {
        rerouted: true,
        delayDelta: reRoute.delayDelta
      });
    }
  }

  // ── Network stats ──────────────────────────────────────────────────────────

  #updateNetworkStats() {
    const health = this.sim.getStatus();
    this.ui.updateNetworkStats(
      health.activeNodesCount,
      health.totalBaseNodes,
      health.activeLinksCount,
      health.totalBaseLinks
    );
  }

  // ── Test Suite Runner ──────────────────────────────────────────────────────

  #handleRunTestSuite() {
    const results = runBrowserTestSuite();
    this.ui.renderTestResults(results);

    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    this.ui.addLogEntry({
      time,
      path: ['SUITE', 'VERIFY'],
      cost: results.totalTests,
      msg: `Verified 8 Scenarios: ${results.totalPass}/${results.totalTests} CHECKS PASSED ✓`
    });
  }

  // ── Scenario Presets ───────────────────────────────────────────────────────

  #handleRunScenarioPreset(scen) {
    switch (scen) {
      case 1: { // Baseline CC -> H1
        this.sim.restoreAll();
        this.state.source = 'CC';
        this.state.destination = 'H1';
        this.ui.setSource('CC');
        this.ui.setDest('H1');
        this.#handleFindRoute('CC', 'H1');
        this.#handleSendMessage('SCENARIO 1: Primary Medical Dispatch to Hospital 1');
        break;
      }
      case 2: { // Alternate CC -> R2
        this.sim.restoreAll();
        this.state.source = 'CC';
        this.state.destination = 'R2';
        this.ui.setSource('CC');
        this.ui.setDest('R2');
        this.#handleFindRoute('CC', 'R2');
        this.#handleSendMessage('SCENARIO 2: Emergency Relief Dispatch to Camp 2');
        break;
      }
      case 3: { // Link Failure CC<->N1 -> Auto Reroute
        this.sim.restoreAll();
        this.state.source = 'CC';
        this.state.destination = 'H1';
        this.ui.setSource('CC');
        this.ui.setDest('H1');
        this.#handleFindRoute('CC', 'H1');
        setTimeout(() => {
          this.sim.failLink('CC', 'N1');
          this.#handleSendMessage('SCENARIO 3: Rerouted Dispatch via F1 after CC↔N1 failure');
        }, 300);
        break;
      }
      case 4: { // Node Collapse N1 -> Bypass
        this.sim.restoreAll();
        this.state.source = 'CC';
        this.state.destination = 'H1';
        this.ui.setSource('CC');
        this.ui.setDest('H1');
        this.#handleFindRoute('CC', 'H1');
        setTimeout(() => {
          this.sim.failNode('N1');
          this.#handleSendMessage('SCENARIO 4: Urban bypass around collapsed Neighbourhood 1');
        }, 300);
        break;
      }
      case 5: { // Severed corridors to R2 -> Unreachable
        this.sim.restoreAll();
        this.state.source = 'CC';
        this.state.destination = 'R2';
        this.ui.setSource('CC');
        this.ui.setDest('R2');
        this.#handleFindRoute('CC', 'R2');
        setTimeout(() => {
          this.sim.failLink('P1', 'R2');
          this.sim.failLink('R1', 'R2');
        }, 300);
        break;
      }
      default:
        this.sim.restoreAll();
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  setNodeFailed(id)       { this.sim.failNode(id); }
  setNodeActive(id)       { this.sim.restoreNode(id); }
  setLinkFailed(u, v)    { this.sim.failLink(u, v); }
  setLinkActive(u, v)    { this.sim.restoreLink(u, v); }
  restoreAll()            { this.sim.restoreAll(); }
  runTests()              { this.#handleRunTestSuite(); }
  getSimulator()          { return this.sim; }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  window._app = new App();
});
