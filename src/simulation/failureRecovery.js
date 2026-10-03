/**
 * failureRecovery.js
 *
 * Core Failure & Recovery module for Smart Emergency Communication Routing.
 *
 * Integration Contract:
 * --------------------
 * Failure:
 *   graph + failed link/node  -->  updated graph + failure status
 *
 * All operations return a fresh clone of the graph ensuring immutability
 * of the input graph, and a structured failureStatus object.
 *
 * Author: Alston (Failure & Recovery Module)
 */

/**
 * Deep clones an adjacency list graph object.
 *
 * @param {Object<string, Object<string, number>>} graph
 * @returns {Object<string, Object<string, number>>}
 */
export function cloneGraph(graph) {
  if (!graph || typeof graph !== 'object') {
    return {};
  }
  const cloned = {};
  for (const [node, neighbors] of Object.entries(graph)) {
    cloned[node] = { ...neighbors };
  }
  return cloned;
}

/**
 * Normalizes an undirected link key (e.g. ['CC', 'N1'] or 'CC-N1' or 'N1-CC')
 * to a canonical alphabetically sorted representation.
 *
 * @param {string} u
 * @param {string} v
 * @returns {string} e.g. "CC<->N1"
 */
export function getCanonicalLinkKey(u, v) {
  return [u, v].sort().join('<->');
}

/**
 * Simulates a link (edge) failure between two nodes in the network.
 * Undirected graph: removes edge in both directions.
 *
 * Contract:
 *   graph + failed link -> updated graph + failure status
 *
 * @param {Object} graph - Current network adjacency list
 * @param {string|string[]} nodeA - First node id, or array of [nodeA, nodeB]
 * @param {string} [nodeB] - Second node id (if nodeA is not an array)
 * @returns {{ graph: Object, failureStatus: Object }}
 */
export function failLink(graph, nodeA, nodeB) {
  let u, v;
  if (Array.isArray(nodeA)) {
    [u, v] = nodeA;
  } else {
    u = nodeA;
    v = nodeB;
  }

  const updatedGraph = cloneGraph(graph);

  // Validate node existence
  if (!u || !v) {
    return {
      graph: updatedGraph,
      failureStatus: {
        type: 'link',
        target: [u, v],
        success: false,
        action: 'failed',
        message: `Invalid link nodes specified: ${u}, ${v}`,
        timestamp: new Date().toISOString()
      }
    };
  }

  const uExists = Boolean(updatedGraph[u]);
  const vExists = Boolean(updatedGraph[v]);

  if (!uExists || !vExists) {
    return {
      graph: updatedGraph,
      failureStatus: {
        type: 'link',
        target: [u, v],
        success: false,
        action: 'failed',
        message: `Cannot fail link: Node ${!uExists ? u : v} does not exist in graph.`,
        timestamp: new Date().toISOString()
      }
    };
  }

  const edgeExists = updatedGraph[u][v] !== undefined || updatedGraph[v][u] !== undefined;
  if (!edgeExists) {
    return {
      graph: updatedGraph,
      failureStatus: {
        type: 'link',
        target: [u, v],
        success: false,
        action: 'failed',
        message: `Link ${u} <-> ${v} does not exist or is already failed.`,
        timestamp: new Date().toISOString()
      }
    };
  }

  const previousWeight = updatedGraph[u][v] ?? updatedGraph[v][u];

  // Remove bidirectional edge
  delete updatedGraph[u][v];
  delete updatedGraph[v][u];

  return {
    graph: updatedGraph,
    failureStatus: {
      type: 'link',
      target: [u, v],
      canonicalKey: getCanonicalLinkKey(u, v),
      previousWeight,
      success: true,
      action: 'failed',
      message: `Link ${u} <-> ${v} failed (latency was ${previousWeight}ms).`,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Simulates a complete node failure in the network.
 * Removes the target node and all incident edges connecting to it.
 *
 * Contract:
 *   graph + failed node -> updated graph + failure status
 *
 * @param {Object} graph - Current network adjacency list
 * @param {string} nodeId - Target node to fail
 * @returns {{ graph: Object, failureStatus: Object }}
 */
export function failNode(graph, nodeId) {
  const updatedGraph = cloneGraph(graph);

  if (!nodeId || !updatedGraph[nodeId]) {
    return {
      graph: updatedGraph,
      failureStatus: {
        type: 'node',
        target: nodeId,
        success: false,
        action: 'failed',
        message: `Cannot fail node: Node '${nodeId}' does not exist or is already failed.`,
        timestamp: new Date().toISOString()
      }
    };
  }

  const disconnectedLinks = [];
  const neighborWeights = { ...updatedGraph[nodeId] };

  // Remove incident edges from all neighbors pointing to this node
  for (const neighbor of Object.keys(updatedGraph[nodeId])) {
    if (updatedGraph[neighbor]) {
      delete updatedGraph[neighbor][nodeId];
      disconnectedLinks.push([nodeId, neighbor]);
    }
  }

  // Remove the node itself
  delete updatedGraph[nodeId];

  return {
    graph: updatedGraph,
    failureStatus: {
      type: 'node',
      target: nodeId,
      disconnectedLinks,
      neighborWeights,
      success: true,
      action: 'failed',
      message: `Node '${nodeId}' failed. ${disconnectedLinks.length} incident link(s) severed.`,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Restores a previously failed link using original topology weights.
 *
 * @param {Object} graph - Current network adjacency list
 * @param {Object} baseGraph - Pristine reference network topology
 * @param {string|string[]} nodeA - First node id, or array of [nodeA, nodeB]
 * @param {string} [nodeB] - Second node id
 * @returns {{ graph: Object, failureStatus: Object }}
 */
export function restoreLink(graph, baseGraph, nodeA, nodeB) {
  let u, v;
  if (Array.isArray(nodeA)) {
    [u, v] = nodeA;
  } else {
    u = nodeA;
    v = nodeB;
  }

  const updatedGraph = cloneGraph(graph);

  // Validate nodes exist in current active graph
  if (!updatedGraph[u] || !updatedGraph[v]) {
    const missing = !updatedGraph[u] ? u : v;
    return {
      graph: updatedGraph,
      failureStatus: {
        type: 'link',
        target: [u, v],
        success: false,
        action: 'restored',
        message: `Cannot restore link: Node '${missing}' is currently down. Restore the node first.`,
        timestamp: new Date().toISOString()
      }
    };
  }

  // Look up original weight in baseGraph
  const originalWeight = baseGraph?.[u]?.[v] ?? baseGraph?.[v]?.[u];
  if (originalWeight === undefined) {
    return {
      graph: updatedGraph,
      failureStatus: {
        type: 'link',
        target: [u, v],
        success: false,
        action: 'restored',
        message: `Cannot restore link: Link ${u} <-> ${v} was not part of original network topology.`,
        timestamp: new Date().toISOString()
      }
    };
  }

  // Restore bidirectional edge
  updatedGraph[u][v] = originalWeight;
  updatedGraph[v][u] = originalWeight;

  return {
    graph: updatedGraph,
    failureStatus: {
      type: 'link',
      target: [u, v],
      canonicalKey: getCanonicalLinkKey(u, v),
      weight: originalWeight,
      success: true,
      action: 'restored',
      message: `Link ${u} <-> ${v} restored with delay ${originalWeight}ms.`,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Restores a previously failed node and reconnects it to all currently active neighbors.
 *
 * @param {Object} graph - Current network adjacency list
 * @param {Object} baseGraph - Pristine reference network topology
 * @param {string} nodeId - Target node to restore
 * @returns {{ graph: Object, failureStatus: Object }}
 */
export function restoreNode(graph, baseGraph, nodeId) {
  const updatedGraph = cloneGraph(graph);

  if (!baseGraph?.[nodeId]) {
    return {
      graph: updatedGraph,
      failureStatus: {
        type: 'node',
        target: nodeId,
        success: false,
        action: 'restored',
        message: `Cannot restore node: Node '${nodeId}' not found in base network specification.`,
        timestamp: new Date().toISOString()
      }
    };
  }

  if (updatedGraph[nodeId]) {
    return {
      graph: updatedGraph,
      failureStatus: {
        type: 'node',
        target: nodeId,
        success: false,
        action: 'restored',
        message: `Node '${nodeId}' is already active in network.`,
        timestamp: new Date().toISOString()
      }
    };
  }

  // Create node container
  updatedGraph[nodeId] = {};
  const reconnectedLinks = [];

  // Connect only to neighbors that are currently active in updatedGraph
  for (const [neighbor, weight] of Object.entries(baseGraph[nodeId])) {
    if (updatedGraph[neighbor]) {
      updatedGraph[nodeId][neighbor] = weight;
      updatedGraph[neighbor][nodeId] = weight;
      reconnectedLinks.push([nodeId, neighbor]);
    }
  }

  return {
    graph: updatedGraph,
    failureStatus: {
      type: 'node',
      target: nodeId,
      reconnectedLinks,
      success: true,
      action: 'restored',
      message: `Node '${nodeId}' restored. ${reconnectedLinks.length} link(s) re-established.`,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Restores the complete network to its original pristine base state.
 *
 * @param {Object} baseGraph - Pristine reference network topology
 * @returns {{ graph: Object, failureStatus: Object }}
 */
export function restoreNetwork(baseGraph) {
  const updatedGraph = cloneGraph(baseGraph);
  const totalNodes = Object.keys(updatedGraph).length;

  return {
    graph: updatedGraph,
    failureStatus: {
      type: 'network',
      target: 'all',
      totalNodes,
      success: true,
      action: 'restored',
      message: `Network completely restored to operational state (${totalNodes} nodes online).`,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Verifies whether a given path is currently traversable in the graph.
 *
 * @param {Object} graph - Current network adjacency list
 * @param {string[]} path - Ordered array of node ids
 * @returns {boolean}
 */
export function isPathValid(graph, path) {
  if (!Array.isArray(path) || path.length === 0) return false;
  if (path.length === 1) return Boolean(graph[path[0]]);

  for (let i = 0; i < path.length - 1; i++) {
    const u = path[i];
    const v = path[i + 1];
    if (!graph[u] || graph[u][v] === undefined) {
      return false;
    }
  }
  return true;
}

/**
 * Calculates the total delay (cost) along a path.
 *
 * @param {Object} graph - Current network adjacency list
 * @param {string[]} path - Ordered array of node ids
 * @returns {number} Delay in ms, or Infinity if invalid
 */
export function calculatePathDelay(graph, path) {
  if (!isPathValid(graph, path)) {
    return Infinity;
  }
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    total += graph[path[i]][path[i + 1]];
  }
  return total;
}

/**
 * Built-in reference Dijkstra algorithm matching Deon's contract:
 *   graph + source + destination  -->  path + totalDelay + status
 *
 * Provided so Alston's Failure & Recovery module runs independently
 * with zero external dependencies, while accepting any external router.
 *
 * @param {Object} graph - Adjacency list
 * @param {string} source - Origin node
 * @param {string} destination - Target node
 * @returns {{ path: string[], totalDelay: number, status: 'reachable'|'unreachable' }}
 */
export function dijkstraRouting(graph, source, destination) {
  if (!graph || !graph[source] || !graph[destination]) {
    return {
      path: [],
      totalDelay: Infinity,
      status: 'unreachable'
    };
  }

  if (source === destination) {
    return {
      path: [source],
      totalDelay: 0,
      status: 'reachable'
    };
  }

  const distances = {};
  const previous = {};
  const visited = new Set();

  for (const node of Object.keys(graph)) {
    distances[node] = Infinity;
    previous[node] = null;
  }

  distances[source] = 0;

  while (visited.size < Object.keys(graph).length) {
    let currentNode = null;
    let shortestDist = Infinity;

    for (const node of Object.keys(graph)) {
      if (!visited.has(node) && distances[node] < shortestDist) {
        shortestDist = distances[node];
        currentNode = node;
      }
    }

    if (currentNode === null || shortestDist === Infinity) {
      break;
    }

    visited.add(currentNode);

    if (currentNode === destination) {
      break;
    }

    const neighbors = graph[currentNode] || {};
    for (const [neighbor, weight] of Object.entries(neighbors)) {
      if (visited.has(neighbor)) continue;

      const alt = distances[currentNode] + weight;
      if (alt < distances[neighbor]) {
        distances[neighbor] = alt;
        previous[neighbor] = currentNode;
      }
    }
  }

  if (distances[destination] === Infinity) {
    return {
      path: [],
      totalDelay: Infinity,
      status: 'unreachable'
    };
  }

  const path = [];
  let curr = destination;
  while (curr !== null) {
    path.unshift(curr);
    curr = previous[curr];
  }

  return {
    path,
    totalDelay: distances[destination],
    status: 'reachable'
  };
}

/**
 * Automatic Rerouting Engine:
 * Evaluates whether a current active route is impacted by a failure,
 * recalculates the new optimal route on the updated graph, and returns
 * detailed rerouting metrics.
 *
 * @param {Object} graph - Current (potentially damaged) network graph
 * @param {string} source - Dispatch origin (e.g. 'CC')
 * @param {string} destination - Emergency destination (e.g. 'H2', 'R2')
 * @param {Function} [routerFn] - Pluggable router matching (g, s, d) contract
 * @param {string[]} [currentPath] - Previous path before failure occurred
 * @returns {{
 *   path: string[],
 *   totalDelay: number,
 *   status: 'reachable'|'unreachable',
 *   rerouted: boolean,
 *   previousPath: string[]|null,
 *   previousDelay: number|null,
 *   delayDelta: number|null,
 *   reason: string
 * }}
 */
export function autoReroute(graph, source, destination, routerFn = dijkstraRouting, currentPath = null, knownPreviousDelay = null, baseGraph = null) {
  const router = typeof routerFn === 'function' ? routerFn : dijkstraRouting;
  const result = router(graph, source, destination);

  const previousPathValid = currentPath ? isPathValid(graph, currentPath) : false;
  
  let previousDelay = knownPreviousDelay;
  if (previousDelay === null && currentPath) {
    if (previousPathValid) {
      previousDelay = calculatePathDelay(graph, currentPath);
    } else if (baseGraph && isPathValid(baseGraph, currentPath)) {
      previousDelay = calculatePathDelay(baseGraph, currentPath);
    }
  }

  let rerouted = false;
  let reason = '';

  if (result.status === 'unreachable') {
    reason = `Destination ${destination} cannot be reached from ${source}. All connecting routes are severed.`;
  } else if (!currentPath) {
    reason = `Initial optimal route computed from ${source} to ${destination}.`;
  } else if (!previousPathValid) {
    rerouted = true;
    reason = `Active route [${currentPath.join(' -> ')}] was broken by failure. Recalculated new bypass route [${result.path.join(' -> ')}].`;
  } else if (result.path.join('->') !== currentPath.join('->')) {
    rerouted = true;
    reason = `Alternative faster route discovered [${result.path.join(' -> ')}].`;
  } else {
    reason = `Existing route [${currentPath.join(' -> ')}] remains optimal and unaffected.`;
  }

  const delayDelta = (previousDelay !== null && result.totalDelay !== Infinity)
    ? (result.totalDelay - previousDelay)
    : null;

  return {
    path: result.path,
    totalDelay: result.totalDelay,
    status: result.status,
    rerouted,
    previousPath: currentPath ?? null,
    previousDelay,
    delayDelta,
    reason
  };
}

/**
 * Returns overall network health metrics (nodes online, links active, isolated nodes).
 *
 * @param {Object} graph - Current graph
 * @param {Object} baseGraph - Original base graph
 * @returns {Object}
 */
export function getNetworkHealth(graph, baseGraph) {
  const baseNodes = Object.keys(baseGraph);
  const activeNodes = Object.keys(graph);
  const failedNodes = baseNodes.filter(n => !graph[n]);

  const activeLinks = new Set();
  const baseLinks = new Set();

  for (const [u, neighbors] of Object.entries(baseGraph)) {
    for (const v of Object.keys(neighbors)) {
      baseLinks.add(getCanonicalLinkKey(u, v));
    }
  }

  for (const [u, neighbors] of Object.entries(graph)) {
    for (const v of Object.keys(neighbors)) {
      activeLinks.add(getCanonicalLinkKey(u, v));
    }
  }

  const failedLinks = [...baseLinks].filter(l => !activeLinks.has(l));

  // Check for isolated nodes (active node with 0 active connections)
  const isolatedNodes = activeNodes.filter(n => Object.keys(graph[n]).length === 0);

  return {
    totalBaseNodes: baseNodes.length,
    activeNodesCount: activeNodes.length,
    failedNodesCount: failedNodes.length,
    failedNodes,
    totalBaseLinks: baseLinks.size,
    activeLinksCount: activeLinks.size,
    failedLinksCount: failedLinks.length,
    failedLinks,
    isolatedNodes,
    networkOperational: activeNodes.length > 0 && activeLinks.size > 0
  };
}
