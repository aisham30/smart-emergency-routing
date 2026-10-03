/**
 * dijkstra.js — Dijkstra's Shortest Path Algorithm
 *
 * Author: Deon (Algorithm Module)
 * Branch: feature/dijkstra
 *
 * Contract
 * ────────
 *   findShortestPath(graph, source, destination)
 *     graph       : adjacency list  { nodeId: { neighborId: weight, … }, … }
 *     source      : string  —  origin node id
 *     destination : string  —  target node id
 *
 *   Returns: { path: string[], totalDelay: number, status: 'reachable'|'unreachable' }
 *
 * Used by:
 *   • src/algorithm/index.js  (public entry point)
 *   • src/simulation/networkSimulator.js  (via setRouter())
 *   • src/frontend/js/app.js  (via NetworkSimulator)
 */

/**
 * Computes the shortest path between two nodes using Dijkstra's algorithm.
 *
 * @param {Object<string, Object<string, number>>} graph  Weighted adjacency list
 * @param {string} source       Origin node id
 * @param {string} destination  Target node id
 * @returns {{ path: string[], totalDelay: number, status: 'reachable'|'unreachable' }}
 */
export function findShortestPath(graph, source, destination) {
  // Check whether source exists
  if (!graph[source]) {
    return { path: [], totalDelay: Infinity, status: 'unreachable' };
  }

  // Check whether destination exists
  if (!graph[destination]) {
    return { path: [], totalDelay: Infinity, status: 'unreachable' };
  }

  // Trivial case: source and destination are the same node
  if (source === destination) {
    return { path: [source], totalDelay: 0, status: 'reachable' };
  }

  // Distance from source to every node
  const distances = {};

  // Previous node in the shortest path
  const previous = {};

  // Nodes whose shortest distance has been finalized
  const visited = new Set();

  // Initialize distances
  for (const node of Object.keys(graph)) {
    distances[node] = Infinity;
    previous[node] = null;
  }

  // Distance from source to itself is 0
  distances[source] = 0;

  while (visited.size < Object.keys(graph).length) {
    let currentNode = null;
    let shortestDistance = Infinity;

    // Find the unvisited node with the smallest distance
    for (const node of Object.keys(graph)) {
      if (!visited.has(node) && distances[node] < shortestDistance) {
        shortestDistance = distances[node];
        currentNode = node;
      }
    }

    // No more reachable nodes
    if (currentNode === null) {
      break;
    }

    // Mark current node as visited
    visited.add(currentNode);

    // Stop once destination is reached
    if (currentNode === destination) {
      break;
    }

    // Check all neighboring nodes
    for (const neighbor of Object.keys(graph[currentNode])) {
      if (visited.has(neighbor)) {
        continue;
      }

      const edgeWeight = graph[currentNode][neighbor];
      const newDistance = distances[currentNode] + edgeWeight;

      // Found a shorter route
      if (newDistance < distances[neighbor]) {
        distances[neighbor] = newDistance;
        previous[neighbor] = currentNode;
      }
    }
  }

  // Destination cannot be reached
  if (distances[destination] === Infinity) {
    return { path: [], totalDelay: Infinity, status: 'unreachable' };
  }

  // Reconstruct shortest path
  const path = [];
  let currentNode = destination;

  while (currentNode !== null) {
    path.unshift(currentNode);
    currentNode = previous[currentNode];
  }

  return {
    path,
    totalDelay: distances[destination],
    status: 'reachable'
  };
}