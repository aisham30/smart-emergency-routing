/**
 * app.js — Main Application Controller
 *
 * Owns app state and wires NetworkVisualizer ↔ UIController together.
 * This is the only file that imports from both ui.js and visualizer.js.
 *
 * State
 * ─────
 *   source, destination   — currently selected node IDs
 *   currentRoute          — { path, cost, hops } | null
 *   nodeStates            — map of id → 'active' | 'failed'
 *
 * INTEGRATION POINTS
 * ──────────────────
 *   • getMockRoute  → swap for dijkstra() once src/algorithm/ is ready
 *   • setNodeFailed / setNodeActive → expose to src/simulation/ module
 *     (Alston can import App and call app.setNodeFailed('H1'), or fire a
 *     custom event on window that App listens for)
 */

import { GRAPH, NODE_INFO, EDGES, getMockRoute } from './network.js';
import { NetworkVisualizer } from './visualizer.js';
import { UIController }      from './ui.js';

const TOTAL_NODES = Object.keys(NODE_INFO).length;
const TOTAL_EDGES = EDGES.length;

class App {
  constructor() {
    this.state = {
      source:       'CC',
      destination:  'H1',
      currentRoute: null,
      nodeStates:   Object.fromEntries(Object.keys(NODE_INFO).map(k => [k, 'active'])),
    };

    // ── Instantiate modules ──────────────────────────────────────────────────
    const svgEl = document.getElementById('network-svg');

    this.viz = new NetworkVisualizer(svgEl, GRAPH, NODE_INFO, EDGES);
    this.ui  = new UIController({
      onFindRoute:  this.#handleFindRoute.bind(this),
      onClearRoute: this.#handleClearRoute.bind(this),
      onNodeClick:  this.#handleNodeClick.bind(this),
      onSendMessage: this.#handleSendMessage.bind(this),
    });

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

    // ── SVG node-click bubble (set as destination) ───────────────────────────
    svgEl.addEventListener('node-click', e => {
      const id = e.detail;
      if (id === this.state.source) return; // can't be both
      this.state.destination = id;
      this.ui.setDest(id);
      this.ui.highlightNodeInList(id);
      this.#resetToMarkers();
    });

    // ── Failure simulation event bus ─────────────────────────────────────────
    // INTEGRATION POINT (Alston):
    //   Fire window.dispatchEvent(new CustomEvent('sim:node-fail',   { detail: 'H1' }))
    //   Fire window.dispatchEvent(new CustomEvent('sim:node-restore', { detail: 'H1' }))
    window.addEventListener('sim:node-fail',    e => this.setNodeFailed(e.detail));
    window.addEventListener('sim:node-restore', e => this.setNodeActive(e.detail));
  }

  // ── Route finding ──────────────────────────────────────────────────────────

  #handleFindRoute(src, dst) {
    const route = getMockRoute(src, dst);   // ← SWAP with dijkstra() when ready
    if (!route) {
      this.ui.showError(`No route available from <strong>${src}</strong> to <strong>${dst}</strong>.`);
      return;
    }
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

  // ── Node sidebar click → set as destination ────────────────────────────────

  #handleNodeClick(id) {
    if (id === this.state.source) return;
    this.state.destination = id;
    this.ui.setDest(id);
    this.ui.highlightNodeInList(id);
    this.#resetToMarkers();
  }

  // ── Emergency message send ─────────────────────────────────────────────────

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

  // ── Failure / recovery API (for simulation module) ─────────────────────────

  /**
   * setNodeFailed(id)
   * Marks a node as failed in both the visual and app state.
   * The simulation module (src/simulation/) should call this, or fire
   * the 'sim:node-fail' event on window.
   */
  setNodeFailed(id) {
    this.state.nodeStates[id] = 'failed';
    this.viz.setNodeState(id, 'failed');
    this.ui.updateNodeTag(id, 'failed');
    this.#updateNetworkStats();
    // If the failed node is on the current route, clear it
    if (this.state.currentRoute?.path.includes(id)) {
      this.#handleClearRoute();
      this.ui.showError(`Node <strong>${id}</strong> failed — route invalidated. Re-route required.`);
    }
  }

  /**
   * setNodeActive(id)
   * Restores a previously failed node.
   */
  setNodeActive(id) {
    this.state.nodeStates[id] = 'active';
    this.viz.setNodeState(id, 'active');
    this.ui.updateNodeTag(id, 'active');
    this.#updateNetworkStats();
  }

  #updateNetworkStats() {
    const activeNodes = Object.values(this.state.nodeStates).filter(s => s === 'active').length;
    this.ui.updateNetworkStats(activeNodes, TOTAL_NODES, TOTAL_EDGES, TOTAL_EDGES);
  }
}

// ── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  window._app = new App(); // expose for simulation module integration
});
