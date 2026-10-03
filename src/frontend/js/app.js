/**
 * app.js — Main Application Controller
 *
 * Wires all three modules together:
 *   • Deon's findShortestPath  (src/algorithm/)
 *   • Alston's NetworkSimulator (src/simulation/)
 *   • Aisha's NetworkVisualizer + UIController (src/frontend/)
 *
 * State ownership
 * ───────────────
 *   NetworkSimulator  — live graph topology (base + failures applied)
 *   App               — UI selection state (source, destination, currentRoute)
 *   NetworkVisualizer — SVG visual state
 *   UIController      — DOM panel state
 *
 * Failure/recovery event flow
 * ───────────────────────────
 *   External trigger (window event or console)
 *     → sim.failNode() / sim.failLink()
 *       → sim fires internal 'node-fail' / 'link-fail'
 *         → App.#onNodeFail() / App.#onLinkFail()
 *           → visual update + auto-reroute via sim.autoReroute()
 *
 * External integration points (for Alston's simulation module)
 * ─────────────────────────────────────────────────────────────
 *   window.dispatchEvent(new CustomEvent('sim:node-fail',    { detail: 'H1' }))
 *   window.dispatchEvent(new CustomEvent('sim:node-restore', { detail: 'H1' }))
 *   window.dispatchEvent(new CustomEvent('sim:link-fail',    { detail: { u:'CC', v:'N1' } }))
 *   window.dispatchEvent(new CustomEvent('sim:link-restore', { detail: { u:'CC', v:'N1' } }))
 *
 *   Or call directly: window._app.setNodeFailed('H1') / window._app.setNodeActive('H1')
 */

import { GRAPH, NODE_INFO, EDGES }   from './network.js';
import { NetworkVisualizer }          from './visualizer.js';
import { UIController }               from './ui.js';
import { findShortestPath }           from '../../algorithm/index.js';
import { NetworkSimulator }           from '../../simulation/index.js';

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
      onFindRoute:   this.#handleFindRoute.bind(this),
      onClearRoute:  this.#handleClearRoute.bind(this),
      onNodeClick:   this.#handleNodeClick.bind(this),
      onSendMessage: this.#handleSendMessage.bind(this),
    });

    // ── Simulator: owns live graph state + pluggable router ──────────────────
    this.sim = new NetworkSimulator(GRAPH);
    this.sim.setRouter(findShortestPath);   // wire Deon's algorithm

    // Sim internal events → visual updates + auto-reroute
    this.sim.on('node-fail',    ({ nodeId })  => this.#onNodeFail(nodeId));
    this.sim.on('node-restore', ({ nodeId })  => this.#onNodeRestore(nodeId));
    this.sim.on('link-fail',    ({ u, v })    => this.#onLinkFail(u, v));
    this.sim.on('link-restore', ({ u, v })    => this.#onLinkRestore(u, v));

    // ── Window event bus (forward to sim — sim guards against double-calls) ──
    window.addEventListener('sim:node-fail',    e => this.sim.failNode(e.detail));
    window.addEventListener('sim:node-restore', e => this.sim.restoreNode(e.detail));
    window.addEventListener('sim:link-fail',    e => { const { u, v } = e.detail || {}; if (u && v) this.sim.failLink(u, v); });
    window.addEventListener('sim:link-restore', e => { const { u, v } = e.detail || {}; if (u && v) this.sim.restoreLink(u, v); });

    // ── Render + initial markers ─────────────────────────────────────────────
    this.viz.render();
    this.viz.markSource('CC');
    this.viz.markDest('H1');
    this.ui.updateNetworkStats(TOTAL_NODES, TOTAL_NODES, TOTAL_EDGES, TOTAL_EDGES);

    // ── Wire dropdown changes ────────────────────────────────────────────────
    document.getElementById('sel-source').addEventListener('change', e => {
      this.state.source = e.target.value;
      this.#resetToMarkers();
    });

    document.getElementById('sel-dest').addEventListener('change', e => {
      this.state.destination = e.target.value;
      this.#resetToMarkers();
    });

    // ── SVG node-click → set as destination ─────────────────────────────────
    svgEl.addEventListener('node-click', e => {
      const id = e.detail;
      if (id === this.state.source) return;
      this.state.destination = id;
      this.ui.setDest(id);
      this.ui.highlightNodeInList(id);
      this.#resetToMarkers();
    });
  }

  // ── Route finding (uses sim's live graph — respects failures) ──────────────

  #handleFindRoute(src, dst) {
    const result = this.sim.findRoute(src, dst);   // findShortestPath on currentGraph

    if (result.status === 'unreachable') {
      this.ui.showError(`No route from <strong>${src}</strong> to <strong>${dst}</strong> — destination unreachable.`);
      return;
    }

    const route = {
      path: result.path,
      cost: result.totalDelay,          // totalDelay → cost for UI layer
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

  // ── Sidebar node click → set as destination ────────────────────────────────

  #handleNodeClick(id) {
    if (id === this.state.source) return;
    this.state.destination = id;
    this.ui.setDest(id);
    this.ui.highlightNodeInList(id);
    this.#resetToMarkers();
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

  // ── Failure event handlers (fired by NetworkSimulator) ────────────────────

  #onNodeFail(id) {
    this.viz.setNodeState(id, 'failed');
    this.ui.updateNodeTag(id, 'failed');
    this.#updateNetworkStats();

    // If the failed node is on the active route, auto-reroute
    if (this.state.currentRoute?.path.includes(id)) {
      this.#attemptAutoReroute(`Node <strong>${id}</strong> failed`);
    }
  }

  #onNodeRestore(id) {
    this.viz.setNodeState(id, 'active');
    this.ui.updateNodeTag(id, 'active');
    this.#updateNetworkStats();
  }

  #onLinkFail(u, v) {
    this.#updateNetworkStats();
    const path = this.state.currentRoute?.path;
    if (path) {
      // Check if the failed link is on the current route
      const affected = path.some((n, i) =>
        i < path.length - 1 &&
        ((path[i] === u && path[i + 1] === v) || (path[i] === v && path[i + 1] === u))
      );
      if (affected) this.#attemptAutoReroute(`Link <strong>${u}↔${v}</strong> failed`);
    }
  }

  #onLinkRestore(u, v) {
    this.#updateNetworkStats();
  }

  /**
   * Tries to find a bypass route on the updated (post-failure) graph.
   * Updates the display with the rerouted path or shows an unreachable error.
   */
  #attemptAutoReroute(failureReason) {
    const prevPath  = this.state.currentRoute?.path ?? null;
    const prevCost  = this.state.currentRoute?.cost  ?? null;

    const reRoute = this.sim.autoReroute(
      this.state.source,
      this.state.destination,
      prevPath,
      prevCost
    );

    if (reRoute.status === 'unreachable') {
      this.viz.clearRoute();
      this.state.currentRoute = null;
      this.ui.showError(`${failureReason} — <strong>${this.state.destination}</strong> is now unreachable. All routes severed.`);
    } else {
      const newRoute = {
        path: reRoute.path,
        cost: reRoute.totalDelay,
        hops: reRoute.path.length - 1,
      };
      this.state.currentRoute = newRoute;
      this.viz.highlightRoute(newRoute.path);
      this.ui.showRoute(newRoute);
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

  // ── Public API (for simulation module and console testing) ────────────────

  /** Trigger a node failure (updates graph + fires visual events). */
  setNodeFailed(id)  { this.sim.failNode(id); }

  /** Restore a previously failed node. */
  setNodeActive(id)  { this.sim.restoreNode(id); }

  /** Trigger a link failure between two nodes. */
  setLinkFailed(u, v)   { this.sim.failLink(u, v); }

  /** Restore a previously failed link. */
  setLinkActive(u, v)   { this.sim.restoreLink(u, v); }

  /** Restore the full network to baseline. */
  restoreAll()           { this.sim.restoreAll(); }

  /** Expose the simulator for direct access from console. */
  getSimulator()         { return this.sim; }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  window._app = new App();   // exposed for simulation module + console testing
});
