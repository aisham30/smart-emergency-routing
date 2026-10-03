/**
 * index.js — Public entry point for the Algorithm module
 *
 * Single named export so any consumer can do:
 *   import { findShortestPath } from '../algorithm/index.js';
 *
 * Contract: findShortestPath(graph, source, destination)
 *   → { path: string[], totalDelay: number, status: 'reachable'|'unreachable' }
 */
export { findShortestPath } from './dijkstra.js';
