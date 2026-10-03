/**
 * networkSimulator.js
 *
 * Stateful Network Simulator for Urban Emergency Communication Routing.
 * Manages network topology lifecycle:
 * - Active graph state vs baseline graph
 * - Node and link failure injection
 * - Restoration of individual components or whole network
 * - Real-time shortest path computation and automatic rerouting
 * - Event-driven communication with Aisha's frontend via browser event bus
 *
 * Author: Alston (Failure & Recovery Module)
 */

import networkTopology from '../../data/network.js';
import {
  cloneGraph,
  failLink as fnFailLink,
  failNode as fnFailNode,
  restoreLink as fnRestoreLink,
  restoreNode as fnRestoreNode,
  restoreNetwork as fnRestoreNetwork,
  autoReroute as fnAutoReroute,
  getNetworkHealth as fnGetNetworkHealth,
  dijkstraRouting,
  getCanonicalLinkKey
} from './failureRecovery.js';

export class NetworkSimulator {
  /**
   * @param {Object} [baseGraph] - Optional custom initial network topology. Defaults to data/network.js.
   */
  constructor(baseGraph = networkTopology) {
    this.baseGraph = cloneGraph(baseGraph);
    this.currentGraph = cloneGraph(baseGraph);

    /** @type {Set<string>} Set of currently failed node IDs (e.g. 'N1') */
    this.failedNodes = new Set();

    /** @type {Set<string>} Set of currently failed canonical links (e.g. 'CC<->N1') */
    this.failedLinks = new Set();

    /** @type {Array<Object>} Chronological audit log of simulation events */
    this.history = [];

    /** @type {Map<string, Set<Function>>} Internal event listeners */
    this.listeners = new Map();

    /** @type {Function} Active routing algorithm (defaults to contract Dijkstra) */
    this.routerFn = dijkstraRouting;

    this._logEvent('INITIALIZED', {
      totalNodes: Object.keys(this.baseGraph).length,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Attach a custom router (e.g. Deon's Dijkstra implementation).
   *
   * @param {Function} router - Function matching (graph, source, dest) -> { path, totalDelay, status }
   */
  setRouter(router) {
    if (typeof router === 'function') {
      this.routerFn = router;
    }
  }

  /**
   * Gets a fresh copy of the active network graph.
   *
   * @returns {Object}
   */
  getGraph() {
    return cloneGraph(this.currentGraph);
  }

  /**
   * Gets the pristine base network graph.
   *
   * @returns {Object}
   */
  getBaseGraph() {
    return cloneGraph(this.baseGraph);
  }

  /**
   * Simulates a link failure between two nodes.
   *
   * @param {string|string[]} nodeA - First node id or [nodeA, nodeB]
   * @param {string} [nodeB] - Second node id
   * @returns {{ graph: Object, failureStatus: Object }}
   */
  failLink(nodeA, nodeB) {
    const [u, v] = Array.isArray(nodeA) ? nodeA : [nodeA, nodeB];
    const key = getCanonicalLinkKey(u, v);

    const result = fnFailLink(this.currentGraph, u, v);
    if (result.failureStatus.success) {
      this.currentGraph = result.graph;
      this.failedLinks.add(key);
      this._logEvent('LINK_FAILED', result.failureStatus);
      this._emit('link-fail', { u, v, key, status: result.failureStatus });
      this._dispatchBrowserEvent('sim:link-fail', { u, v, key });
    }
    return result;
  }

  /**
   * Simulates a complete node failure and disconnects its links.
   *
   * @param {string} nodeId - Target node id
   * @returns {{ graph: Object, failureStatus: Object }}
   */
  failNode(nodeId) {
    const result = fnFailNode(this.currentGraph, nodeId);
    if (result.failureStatus.success) {
      this.currentGraph = result.graph;
      this.failedNodes.add(nodeId);

      // Track all severed incident links
      if (this.baseGraph[nodeId]) {
        for (const neighbor of Object.keys(this.baseGraph[nodeId])) {
          this.failedLinks.add(getCanonicalLinkKey(nodeId, neighbor));
        }
      }

      this._logEvent('NODE_FAILED', result.failureStatus);
      this._emit('node-fail', { nodeId, status: result.failureStatus });
      this._dispatchBrowserEvent('sim:node-fail', nodeId);
    }
    return result;
  }

  /**
   * Restores a previously failed link.
   *
   * @param {string|string[]} nodeA
   * @param {string} [nodeB]
   * @returns {{ graph: Object, failureStatus: Object }}
   */
  restoreLink(nodeA, nodeB) {
    const [u, v] = Array.isArray(nodeA) ? nodeA : [nodeA, nodeB];
    const key = getCanonicalLinkKey(u, v);

    const result = fnRestoreLink(this.currentGraph, this.baseGraph, u, v);
    if (result.failureStatus.success) {
      this.currentGraph = result.graph;
      this.failedLinks.delete(key);
      this._logEvent('LINK_RESTORED', result.failureStatus);
      this._emit('link-restore', { u, v, key, status: result.failureStatus });
      this._dispatchBrowserEvent('sim:link-restore', { u, v, key });
    }
    return result;
  }

  /**
   * Restores a previously failed node and reconnects it to operational neighbors.
   *
   * @param {string} nodeId
   * @returns {{ graph: Object, failureStatus: Object }}
   */
  restoreNode(nodeId) {
    const result = fnRestoreNode(this.currentGraph, this.baseGraph, nodeId);
    if (result.failureStatus.success) {
      this.currentGraph = result.graph;
      this.failedNodes.delete(nodeId);

      // Remove severed links from tracking if both ends are now active
      if (this.baseGraph[nodeId]) {
        for (const neighbor of Object.keys(this.baseGraph[nodeId])) {
          if (!this.failedNodes.has(neighbor)) {
            this.failedLinks.delete(getCanonicalLinkKey(nodeId, neighbor));
          }
        }
      }

      this._logEvent('NODE_RESTORED', result.failureStatus);
      this._emit('node-restore', { nodeId, status: result.failureStatus });
      this._dispatchBrowserEvent('sim:node-restore', nodeId);
    }
    return result;
  }

  /**
   * Restores the complete network topology to full baseline health.
   *
   * @returns {{ graph: Object, failureStatus: Object }}
   */
  restoreAll() {
    const result = fnRestoreNetwork(this.baseGraph);
    this.currentGraph = result.graph;
    this.failedNodes.clear();
    this.failedLinks.clear();
    this._logEvent('NETWORK_RESTORED', result.failureStatus);
    this._emit('network-restore', result.failureStatus);
    this._dispatchBrowserEvent('sim:network-restore', { all: true });
    return result;
  }

  /**
   * Computes the current fastest route using the active router.
   *
   * @param {string} source - Origin node (e.g. 'CC')
   * @param {string} destination - Target node (e.g. 'H2')
   * @returns {{ path: string[], totalDelay: number, status: 'reachable'|'unreachable' }}
   */
  findRoute(source, destination) {
    return this.routerFn(this.currentGraph, source, destination);
  }

  /**
   * Evaluates and automatically recalculates routing if a previous route was disrupted.
   *
   * @param {string} source - Origin node
   * @param {string} destination - Target node
   * @param {string[]} [currentActivePath] - Active path before failure
   * @param {number} [previousDelay] - Known delay of previous path
   * @returns {Object} Rerouting metrics
   */
  autoReroute(source, destination, currentActivePath = null, previousDelay = null) {
    const result = fnAutoReroute(
      this.currentGraph,
      source,
      destination,
      this.routerFn,
      currentActivePath,
      previousDelay,
      this.baseGraph
    );
    this._logEvent('REROUTE_EVALUATED', { source, destination, ...result });
    this._emit('reroute', result);
    return result;
  }

  /**
   * Returns complete network health metrics and status summary.
   *
   * @returns {Object}
   */
  getStatus() {
    const health = fnGetNetworkHealth(this.currentGraph, this.baseGraph);
    return {
      ...health,
      failedNodesList: Array.from(this.failedNodes),
      failedLinksList: Array.from(this.failedLinks),
      historyCount: this.history.length
    };
  }

  /**
   * Attach browser event bus listeners to integrate seamlessly with Aisha's frontend.
   * Automatically listens to 'sim:node-fail' and 'sim:node-restore' window events.
   */
  attachBrowserEvents() {
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('sim:node-fail', (event) => {
        const nodeId = event.detail;
        if (nodeId && !this.failedNodes.has(nodeId)) {
          this.failNode(nodeId);
        }
      });

      window.addEventListener('sim:node-restore', (event) => {
        const nodeId = event.detail;
        if (nodeId && this.failedNodes.has(nodeId)) {
          this.restoreNode(nodeId);
        }
      });

      window.addEventListener('sim:link-fail', (event) => {
        const { u, v } = event.detail || {};
        if (u && v) {
          this.failLink(u, v);
        }
      });

      window.addEventListener('sim:link-restore', (event) => {
        const { u, v } = event.detail || {};
        if (u && v) {
          this.restoreLink(u, v);
        }
      });

      // Expose to window._sim for direct console testing if needed
      window._sim = this;
    }
  }

  /**
   * Subscribes a listener callback to an internal simulation event.
   *
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }

  /**
   * Internal event emitter.
   * @private
   */
  _emit(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      for (const cb of callbacks) {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error in simulator listener for '${event}':`, err);
        }
      }
    }
  }

  /**
   * Dispatches custom event on browser window if available.
   * @private
   */
  _dispatchBrowserEvent(eventName, detail) {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent(eventName, { detail }));
      } catch {
        // Fallback for environments where CustomEvent constructor varies
      }
    }
  }

  /**
   * Records an audit log entry.
   * @private
   */
  _logEvent(type, details) {
    this.history.push({
      id: this.history.length + 1,
      type,
      details,
      timestamp: new Date().toISOString()
    });
  }
}
