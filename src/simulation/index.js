/**
 * index.js
 *
 * Public entry point for Alston's Failure & Recovery Module.
 * Smart Emergency Communication Routing System.
 *
 * Module Deliverables:
 * - Link failure: failLink(graph, u, v)
 * - Node failure: failNode(graph, node)
 * - Automatic rerouting: autoReroute(graph, src, dst, routerFn, currentPath)
 * - Network restoration: restoreLink(), restoreNode(), restoreNetwork()
 * - Failure/status handling: structured failureStatus objects + getNetworkHealth()
 * - Stateful NetworkSimulator with Aisha's event bus integration
 *
 * Integration Contract:
 *   graph + failed link/node  -->  updated graph + failure status
 */

export {
  cloneGraph,
  failLink,
  failNode,
  restoreLink,
  restoreNode,
  restoreNetwork,
  isPathValid,
  calculatePathDelay,
  dijkstraRouting,
  autoReroute,
  getNetworkHealth,
  getCanonicalLinkKey
} from './failureRecovery.js';

export { NetworkSimulator } from './networkSimulator.js';
