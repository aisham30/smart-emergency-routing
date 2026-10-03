/**
 * visualizer.js — SVG Network Renderer
 *
 * Handles all drawing and animation for the emergency network map.
 * Completely decoupled from routing logic — receives route arrays from app.js.
 *
 * Public API
 * ──────────
 *   new NetworkVisualizer(svgElement, graph, nodeInfo, edges)
 *   .render()                          — draw all edges and nodes
 *   .highlightRoute(path[])            — light up a route
 *   .clearRoute()                      — reset all highlights
 *   .markSource(id)                    — show blue source ring
 *   .markDest(id)                      — show orange dest ring
 *   .setNodeState(id, 'active'|'failed') — toggle node failure state
 *   .animateMessage(path[], onComplete) — send pulsing dot along route
 *
 * INTEGRATION POINT (Alston — failure simulation):
 *   Call setNodeState(id, 'failed') / setNodeState(id, 'active') from the
 *   simulation module to update the visual without touching routing logic.
 */

import { NODE_TYPES } from './network.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Create an SVG element with a map of attributes. */
function el(tag, attrs = {}, text = '') {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (text) node.textContent = text;
  return node;
}

/** Midpoint of two SVG positions, with an optional perpendicular offset. */
function midpoint(a, b, perpOffset = 0) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  if (perpOffset === 0) return { x: mx, y: my };
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: mx - (dy / len) * perpOffset, y: my + (dx / len) * perpOffset };
}

// Label offsets for specific edges to avoid overlaps
const LABEL_OFFSET = {
  'CC·P1': -14, 'N1·H2': 12, 'N1·R1': -16,
  'F1·P1': 12,  'F1·R1': -12, 'H1·H2': 14,
};

export class NetworkVisualizer {
  /**
   * @param {SVGSVGElement} svgEl
   * @param {object} graph     — adjacency list
   * @param {object} nodeInfo  — NODE_INFO map
   * @param {Array}  edges     — [{from, to, weight}]
   */
  constructor(svgEl, graph, nodeInfo, edges) {
    this.svg      = svgEl;
    this.graph    = graph;
    this.nodeInfo = nodeInfo;
    this.edges    = edges;

    // Element registries
    this._edgeEls = {};   // canonical key → { line, wbg, wlabel }
    this._nodeEls = {};   // id → { g, circle, ring, failIcon }
    this._nodeStates = Object.fromEntries(Object.keys(nodeInfo).map(k => [k, 'active']));
    this._activeRoute = [];

    this.#buildLayers();
  }

  // ── Setup ──────────────────────────────────────────────────────────────────

  #buildLayers() {
    // ① SVG defs: grid pattern + glow filters
    const defs = el('defs');

    const pat = el('pattern', { id: 'ops-grid', width: 45, height: 45, patternUnits: 'userSpaceOnUse' });
    pat.appendChild(el('path', { d: 'M 45 0 L 0 0 0 45', fill: 'none', stroke: '#091424', 'stroke-width': 1 }));
    defs.appendChild(pat);

    // Green glow filter (route)
    const gf = el('filter', { id: 'glow-green', x: '-40%', y: '-40%', width: '180%', height: '180%' });
    const gb = el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: 4, result: 'blur' });
    const gm = el('feMerge');
    gm.appendChild(el('feMergeNode', { in: 'blur' }));
    gm.appendChild(el('feMergeNode', { in: 'SourceGraphic' }));
    gf.appendChild(gb); gf.appendChild(gm);
    defs.appendChild(gf);

    // Amber glow filter (message dot)
    const af = el('filter', { id: 'glow-amber', x: '-60%', y: '-60%', width: '220%', height: '220%' });
    const ab = el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: 5, result: 'blur' });
    const am = el('feMerge');
    am.appendChild(el('feMergeNode', { in: 'blur' }));
    am.appendChild(el('feMergeNode', { in: 'SourceGraphic' }));
    af.appendChild(ab); af.appendChild(am);
    defs.appendChild(af);

    this.svg.appendChild(defs);

    // ② Background
    this.svg.appendChild(el('rect', { width: 900, height: 510, fill: 'url(#ops-grid)' }));

    // Vignette overlay (subtle edge darkening)
    const vg = el('radialGradient', { id: 'vignette', cx: '50%', cy: '50%', r: '70%' });
    vg.appendChild(el('stop', { offset: '0%', 'stop-color': 'transparent' }));
    vg.appendChild(el('stop', { offset: '100%', 'stop-color': '#000', 'stop-opacity': 0.4 }));
    defs.appendChild(vg);
    this.svg.appendChild(el('rect', { width: 900, height: 510, fill: 'url(#vignette)', 'pointer-events': 'none' }));

    // ③ Rendering layers (z-order)
    this._lgEdge = el('g', { id: 'layer-edges' });
    this._lgNode = el('g', { id: 'layer-nodes' });
    this._lgAnim = el('g', { id: 'layer-anim', 'pointer-events': 'none' });
    this.svg.appendChild(this._lgEdge);
    this.svg.appendChild(this._lgNode);
    this.svg.appendChild(this._lgAnim);
  }

  // ── Public: render ─────────────────────────────────────────────────────────

  render() {
    this.#drawEdges();
    this.#drawNodes();
  }

  // ── Edges ──────────────────────────────────────────────────────────────────

  #drawEdges() {
    for (const { from, to, weight } of this.edges) {
      const a   = this.nodeInfo[from];
      const b   = this.nodeInfo[to];
      const key = [from, to].sort().join('·');
      const off = LABEL_OFFSET[key] ?? 0;
      const mid = midpoint(a, b, off);

      const line = el('line', {
        class: 'e-line',
        x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        stroke: '#1a3050', 'stroke-width': 2,
        'stroke-linecap': 'round',
      });

      const wbg = el('rect', {
        class: 'e-wbg',
        x: mid.x - 11, y: mid.y - 9, width: 22, height: 16, rx: 3,
        fill: '#06101e', stroke: '#0f2040', 'stroke-width': 1,
      });

      const wlabel = el('text', {
        class: 'e-wlabel',
        x: mid.x, y: mid.y,
        fill: '#2e5070',
        'font-size': 10, 'font-family': "'Courier New', monospace",
        'text-anchor': 'middle', 'dominant-baseline': 'central',
      }, String(weight));

      this._lgEdge.appendChild(line);
      this._lgEdge.appendChild(wbg);
      this._lgEdge.appendChild(wlabel);

      // Register under both directions for highlight lookup
      const edgeObj = { line, wbg, wlabel };
      this._edgeEls[key] = edgeObj;
      this._edgeEls[`${from}·${to}`] = edgeObj;
      this._edgeEls[`${to}·${from}`] = edgeObj;
    }
  }

  // ── Nodes ──────────────────────────────────────────────────────────────────

  #drawNodes() {
    const R = 23;
    for (const [id, info] of Object.entries(this.nodeInfo)) {
      const typeStyle = NODE_TYPES[info.type] || {};
      const g = el('g', { class: 'node-g', 'data-id': id, cursor: 'pointer' });

      // Outer glow ring (pulsed on hover/selection)
      const ring = el('circle', {
        cx: info.x, cy: info.y, r: R + 7,
        fill: 'none', stroke: info.color,
        'stroke-width': 1.5, opacity: 0.2,
        class: 'n-ring',
      });

      // Main body
      const circle = el('circle', {
        cx: info.x, cy: info.y, r: R,
        fill: typeStyle.fill || '#0d1726',
        stroke: info.color, 'stroke-width': 2.5,
        class: 'n-circle',
        style: 'transition: filter 0.25s, stroke-width 0.25s;',
      });

      // Node ID
      const idLabel = el('text', {
        x: info.x, y: info.y - 4,
        fill: info.color,
        'font-size': 11, 'font-weight': 'bold',
        'font-family': "'Courier New', monospace",
        'text-anchor': 'middle', 'dominant-baseline': 'central',
        'pointer-events': 'none',
      }, id);

      // Type icon
      const iconLabel = el('text', {
        x: info.x, y: info.y + 10,
        fill: info.color, opacity: 0.75,
        'font-size': 9, 'font-family': "'Courier New', monospace",
        'text-anchor': 'middle', 'dominant-baseline': 'central',
        'pointer-events': 'none',
      }, typeStyle.icon || '●');

      // Name below circle
      const nameLabel = el('text', {
        x: info.x, y: info.y + R + 14,
        fill: '#3a5878',
        'font-size': 9, 'font-family': "'Courier New', monospace",
        'text-anchor': 'middle',
        'pointer-events': 'none',
      }, info.label);

      // Failure X (hidden by default)
      const failX = el('text', {
        x: info.x, y: info.y + 1,
        fill: '#ff3b3b', 'font-size': 20, 'font-weight': 'bold',
        'text-anchor': 'middle', 'dominant-baseline': 'central',
        'pointer-events': 'none', display: 'none',
        class: 'n-fail-icon',
      }, '✕');

      g.appendChild(ring);
      g.appendChild(circle);
      g.appendChild(idLabel);
      g.appendChild(iconLabel);
      g.appendChild(nameLabel);
      g.appendChild(failX);

      // Hover effect
      g.addEventListener('mouseenter', () => {
        if (this._nodeStates[id] !== 'failed') {
          circle.style.filter = `drop-shadow(0 0 8px ${info.color})`;
          ring.setAttribute('opacity', '0.5');
        }
      });
      g.addEventListener('mouseleave', () => {
        if (!this._activeRoute.includes(id)) {
          circle.style.filter = '';
          ring.setAttribute('opacity', this._activeRoute.includes(id) ? '0.6' : '0.2');
        }
      });

      // Bubble click event to SVG for app.js to intercept
      g.addEventListener('click', () => {
        this.svg.dispatchEvent(new CustomEvent('node-click', { detail: id, bubbles: true }));
      });

      this._lgNode.appendChild(g);
      this._nodeEls[id] = { g, circle, ring, failX, nameLabel, idLabel };
    }
  }

  // ── Public: route highlighting ─────────────────────────────────────────────

  highlightRoute(path) {
    this.clearRoute(false); // clear visual but keep source/dest markers
    this._activeRoute = path;

    // Dim all edges first
    for (const { line, wlabel } of Object.values(this._edgeEls)) {
      line.setAttribute('stroke', '#0d2035');
      line.setAttribute('stroke-width', 1.5);
      wlabel.setAttribute('fill', '#162840');
    }

    // Highlight edges on path
    for (let i = 0; i < path.length - 1; i++) {
      const eKey = [path[i], path[i + 1]].sort().join('·');
      const edgeObj = this._edgeEls[eKey];
      if (!edgeObj) continue;

      edgeObj.line.setAttribute('stroke', '#00e676');
      edgeObj.line.setAttribute('stroke-width', 3.5);
      edgeObj.line.setAttribute('stroke-dasharray', '12 6');
      edgeObj.line.style.animation = 'route-march 0.7s linear infinite';
      edgeObj.line.setAttribute('filter', 'url(#glow-green)');
      edgeObj.wbg.setAttribute('fill', '#001a0d');
      edgeObj.wbg.setAttribute('stroke', '#00e676');
      edgeObj.wlabel.setAttribute('fill', '#00e676');
    }

    // Highlight nodes on path
    for (const id of path) {
      const { circle, ring } = this._nodeEls[id];
      circle.setAttribute('stroke-width', 3.5);
      circle.style.filter = `drop-shadow(0 0 12px ${this.nodeInfo[id].color})`;
      ring.setAttribute('opacity', '0.7');
      ring.setAttribute('stroke-width', 2.5);
    }
  }

  clearRoute(restoreEdges = true) {
    this._activeRoute = [];

    // Restore nodes
    for (const [id, { circle, ring }] of Object.entries(this._nodeEls)) {
      circle.setAttribute('stroke-width', 2.5);
      circle.style.filter = '';
      ring.setAttribute('opacity', '0.2');
      ring.setAttribute('stroke-width', 1.5);
      circle.classList.remove('src-marker', 'dst-marker');
    }

    if (restoreEdges) {
      // Restore all edges
      for (const { line, wbg, wlabel } of Object.values(this._edgeEls)) {
        line.setAttribute('stroke', '#1a3050');
        line.setAttribute('stroke-width', 2);
        line.removeAttribute('stroke-dasharray');
        line.removeAttribute('filter');
        line.style.animation = '';
        wbg.setAttribute('fill', '#06101e');
        wbg.setAttribute('stroke', '#0f2040');
        wlabel.setAttribute('fill', '#2e5070');
      }
    }
  }

  markSource(id) {
    if (!id || !this._nodeEls[id] || this._nodeStates[id] === 'failed') return;
    const { circle, ring } = this._nodeEls[id];
    circle.setAttribute('stroke', '#29b6f6');
    circle.setAttribute('stroke-width', 3.5);
    circle.style.filter = 'drop-shadow(0 0 10px rgba(41,182,246,0.8))';
    ring.setAttribute('stroke', '#29b6f6');
    ring.setAttribute('opacity', '0.5');
  }

  markDest(id) {
    if (!id || !this._nodeEls[id] || this._nodeStates[id] === 'failed') return;
    const { circle, ring } = this._nodeEls[id];
    circle.setAttribute('stroke', '#ff7c2a');
    circle.setAttribute('stroke-width', 3.5);
    circle.style.filter = 'drop-shadow(0 0 10px rgba(255,124,42,0.8))';
    ring.setAttribute('stroke', '#ff7c2a');
    ring.setAttribute('opacity', '0.5');
  }

  // ── Public: node state ─────────────────────────────────────────────────────

  /**
   * setNodeState(id, state)
   *
   * INTEGRATION POINT (Alston — failure simulation):
   *   Call this from src/simulation/ to toggle node failure visuals.
   *   The routing module should then re-run on the modified graph.
   */
  setNodeState(id, state) {
    this._nodeStates[id] = state;
    const { circle, ring, failX, idLabel, nameLabel } = this._nodeEls[id];
    const info = this.nodeInfo[id];

    if (state === 'failed') {
      circle.setAttribute('fill', '#0d0005');
      circle.setAttribute('stroke', '#ff3b3b');
      circle.setAttribute('stroke-width', 2);
      circle.setAttribute('stroke-dasharray', '4 3');
      circle.style.filter = '';
      circle.setAttribute('opacity', '0.6');
      ring.setAttribute('stroke', '#ff3b3b');
      ring.setAttribute('opacity', '0.3');
      idLabel.setAttribute('fill', '#5a2020');
      nameLabel.setAttribute('fill', '#5a2020');
      failX.setAttribute('display', 'block');
    } else {
      const typeStyle = NODE_TYPES[info.type] || {};
      circle.setAttribute('fill', typeStyle.fill || '#0d1726');
      circle.setAttribute('stroke', info.color);
      circle.setAttribute('stroke-width', 2.5);
      circle.removeAttribute('stroke-dasharray');
      circle.setAttribute('opacity', '1');
      ring.setAttribute('stroke', info.color);
      ring.setAttribute('opacity', '0.2');
      idLabel.setAttribute('fill', info.color);
      nameLabel.setAttribute('fill', '#3a5878');
      failX.setAttribute('display', 'none');
    }
  }

  getNodeState(id) { return this._nodeStates[id]; }

  // ── Public: message animation ──────────────────────────────────────────────

  /**
   * animateMessage(path, onComplete)
   *
   * Sends an amber dot along the route with smooth ease-in-out interpolation.
   * Fires a radial burst at the destination node.
   *
   * INTEGRATION POINT (Alston — failure simulation):
   *   animateMessage() is a pure visual method; call it from the simulation
   *   module after your routing logic provides a path.
   */
  animateMessage(path, onComplete) {
    if (path.length < 2) { onComplete?.(); return; }

    // Clear old animation elements
    while (this._lgAnim.firstChild) this._lgAnim.removeChild(this._lgAnim.firstChild);

    const dot = el('circle', {
      r: 8,
      fill: '#ffb547',
      filter: 'url(#glow-amber)',
    });
    this._lgAnim.appendChild(dot);

    const SEGMENT_MS = 420;
    let seg = 0;

    const easeInOut = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    const runSegment = () => {
      if (seg >= path.length - 1) {
        this.#burstEffect(path[path.length - 1]);
        setTimeout(() => {
          this._lgAnim.removeChild(dot);
          onComplete?.();
        }, 350);
        return;
      }

      const from = this.nodeInfo[path[seg]];
      const to   = this.nodeInfo[path[seg + 1]];
      const t0   = performance.now();

      const step = (ts) => {
        const raw    = Math.min((ts - t0) / SEGMENT_MS, 1);
        const eased  = easeInOut(raw);
        dot.setAttribute('cx', from.x + (to.x - from.x) * eased);
        dot.setAttribute('cy', from.y + (to.y - from.y) * eased);
        if (raw < 1) requestAnimationFrame(step);
        else { seg++; runSegment(); }
      };

      dot.setAttribute('cx', from.x);
      dot.setAttribute('cy', from.y);
      requestAnimationFrame(step);
    };

    runSegment();
  }

  #burstEffect(nodeId) {
    const { x, y } = this.nodeInfo[nodeId];
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const ring = el('circle', { cx: x, cy: y, r: 23, fill: 'none', stroke: '#ffb547', 'stroke-width': 2, opacity: 1 });
        this._lgAnim.appendChild(ring);
        let t0 = null;
        const expand = (ts) => {
          if (!t0) t0 = ts;
          const p = Math.min((ts - t0) / 450, 1);
          ring.setAttribute('r', 23 + p * 22);
          ring.setAttribute('opacity', (1 - p).toFixed(3));
          if (p < 1) requestAnimationFrame(expand);
          else if (ring.parentNode) this._lgAnim.removeChild(ring);
        };
        requestAnimationFrame(expand);
      }, i * 110);
    }
  }
}
