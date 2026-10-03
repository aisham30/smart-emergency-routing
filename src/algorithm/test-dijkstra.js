const network = require("./network");
const { findShortestPath } = require("./dijkstra");

function printResult(testName, source, destination, result) {
  console.log("\n-----------------------------------");
  console.log(testName);
  console.log("-----------------------------------");

  console.log(`Source: ${source}`);
  console.log(`Destination: ${destination}`);
  console.log(`Status: ${result.status}`);

  if (result.status === "reachable") {
    console.log(`Path: ${result.path.join(" -> ")}`);
    console.log(`Total Delay: ${result.totalDelay} ms`);
  } else {
    console.log("Path: Unreachable");
    console.log("Total Delay: Infinity");
  }
}


// Test 1: Control Center -> Central Hospital
const result1 = findShortestPath(network, "CC", "H1");

printResult(
  "Test 1: CC to H1",
  "CC",
  "H1",
  result1
);


// Test 2: Control Center -> Relief Camp 2
const result2 = findShortestPath(network, "CC", "R2");

printResult(
  "Test 2: CC to R2",
  "CC",
  "R2",
  result2
);


// Test 3: Control Center -> Police Station
const result3 = findShortestPath(network, "CC", "P1");

printResult(
  "Test 3: CC to P1",
  "CC",
  "P1",
  result3
);


// Test 4: Source and destination are the same
const result4 = findShortestPath(network, "CC", "CC");

printResult(
  "Test 4: CC to CC",
  "CC",
  "CC",
  result4
);


// Test 5: Unreachable destination
const disconnectedNetwork = {
  A: {
    B: 5
  },

  B: {
    A: 5
  },

  C: {}
};

const result5 = findShortestPath(
  disconnectedNetwork,
  "A",
  "C"
);

printResult(
  "Test 5: Unreachable destination",
  "A",
  "C",
  result5
);