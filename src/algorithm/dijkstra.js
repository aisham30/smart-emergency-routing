function findShortestPath(graph, source, destination) {
  // Check whether source exists
  if (!graph[source]) {
    return {
      path: [],
      totalDelay: Infinity,
      status: "unreachable"
    };
  }

  // Check whether destination exists
  if (!graph[destination]) {
    return {
      path: [],
      totalDelay: Infinity,
      status: "unreachable"
    };
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

      const newDistance =
        distances[currentNode] + edgeWeight;

      // Found a shorter route
      if (newDistance < distances[neighbor]) {
        distances[neighbor] = newDistance;
        previous[neighbor] = currentNode;
      }
    }
  }

  // Destination cannot be reached
  if (distances[destination] === Infinity) {
    return {
      path: [],
      totalDelay: Infinity,
      status: "unreachable"
    };
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
    status: "reachable"
  };
}

module.exports = {
  findShortestPath
};