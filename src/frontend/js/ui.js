/**
 * ui.js — Dashboard DOM Controller
 *
 * Manages all DOM interactions outside the SVG canvas:
 *   • Source / destination selector dropdowns
 *   • Node status sidebar list with colour-coded indicators
 *   • Route detail panel (path chips, cost, hops, quality badge)
 *   • Emergency message compose area + transmission log
 *   • Status bar metric updates
 *   • Live clock
 *
 * Accepts callback hooks for all user actions — zero routing logic here.
 */

import { NODE_INFO, NODE_TYPES } from './network.js';

// Route quality thresholds
const QUALITY = [
  { max: 12, label: 'OPTIMAL',  color: '#00e676' },
  { max: 20, label: 'GOOD',     color: '#a5d6a7' },
  { max: 28, label: 'MODERATE', color: '#ffb547' },
  { max: Infinity, label: 'LONG', color: '#ff5252' },
];

function qualityFor(cost) {
  return QUALITY.find(q => cost <= q.max) || QUALITY[QUALITY.length - 1];
}

export class UIController {
  /**
   * @param {{ onFindRoute, onClearRoute, onNodeClick, onSendMessage }} callbacks
   */
  constructor({ onFindRoute, onClearRoute, onNodeClick, onSendMessage }) {
    this._cb = { onFindRoute, onClearRoute, onNodeClick, onSendMessage };
    this._logCount = 0;

    this.#populateSelects();
    this.#buildNodeList();
    this.#wireButtons();
    this.#startClock();
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  getSource() { return document.getElementById('sel-source').value; }
  getDest()   { return document.getElementById('sel-dest').value;   }

  setDest(id) {
    const sel = document.getElementById('sel-dest');
    if (sel) sel.value = id;
  }

  // ── Dropdowns ──────────────────────────────────────────────────────────────

  #populateSelects() {
    const src = document.getElementById('sel-source');
    const dst = document.getElementById('sel-dest');

    for (const [id, info] of Object.entries(NODE_INFO)) {
      const icon = NODE_TYPES[info.type]?.icon ?? '●';
      src.appendChild(new Option(`${icon} ${id}  —  ${info.label}`, id));
      dst.appendChild(new Option(`${icon} ${id}  —  ${info.label}`, id));
    }

    src.value = 'CC';
    dst.value = 'H1';
  }

  // ── Node status sidebar ────────────────────────────────────────────────────

  #buildNodeList() {
    const list = document.getElementById('node-list');
    list.innerHTML = '';

    for (const [id, info] of Object.entries(NODE_INFO)) {
      const item = document.createElement('div');
      item.className = 'node-item';
      item.dataset.id = id;

      const dot = document.createElement('span');
      dot.className = 'node-dot';
      dot.style.setProperty('--nc', info.color);

      const text = document.createElement('div');
      text.className = 'node-item-text';
      text.innerHTML = `<span class="ni-id" style="color:${info.color}">${id}</span>
                        <span class="ni-name">${NODE_TYPES[info.type]?.icon ?? ''} ${info.label}</span>`;

      const tag = document.createElement('span');
      tag.className = 'ni-tag ni-active';
      tag.dataset.tagFor = id;
      tag.textContent = 'ACTIVE';

      item.append(dot, text, tag);
      item.addEventListener('click', () => this._cb.onNodeClick?.(id));
      list.appendChild(item);
    }
  }

  highlightNodeInList(id) {
    document.querySelectorAll('.node-item').forEach(el => {
      el.classList.toggle('node-item--sel', el.dataset.id === id);
    });
  }

  updateNodeTag(id, state) {
    const tag = document.querySelector(`[data-tag-for="${id}"]`);
    if (!tag) return;
    tag.textContent = state === 'failed' ? 'FAILED' : 'ACTIVE';
    tag.className = `ni-tag ${state === 'failed' ? 'ni-failed' : 'ni-active'}`;

    // Update dot colour
    const item = document.querySelector(`.node-item[data-id="${id}"] .node-dot`);
    if (item) item.style.setProperty('--nc', state === 'failed' ? '#ff3b3b' : NODE_INFO[id].color);
  }

  // ── Buttons ────────────────────────────────────────────────────────────────

  #wireButtons() {
    document.getElementById('btn-find').addEventListener('click', () => {
      const src = this.getSource(), dst = this.getDest();
      if (src === dst) { this.showError('Source and destination must be different nodes.'); return; }
      this._cb.onFindRoute?.(src, dst);
    });

    document.getElementById('btn-clear').addEventListener('click', () => {
      this._cb.onClearRoute?.();
      this.clearRoutePanel();
    });

    document.getElementById('btn-send').addEventListener('click', () => {
      const msg = document.getElementById('msg-input').value.trim();
      if (!msg) return;
      this._cb.onSendMessage?.(msg);
    });
  }

  // ── Route detail panel ─────────────────────────────────────────────────────

  showRoute(route) {
    const { path, cost, hops } = route;
    const q = qualityFor(cost);

    const chips = path.map((n, i) => {
      const c = NODE_INFO[n].color;
      const chip = `<span class="r-chip" style="background:${c}1a;border:1px solid ${c};color:${c}">${n}</span>`;
      return i < path.length - 1 ? chip + `<span class="r-arrow">→</span>` : chip;
    }).join('');

    document.getElementById('route-panel').innerHTML = `
      <div class="r-path">${chips}</div>
      <div class="r-stats">
        <div class="r-stat">
          <span class="r-sl">TOTAL DELAY</span>
          <span class="r-sv" style="color:#00e676">${cost} <small>units</small></span>
        </div>
        <div class="r-stat">
          <span class="r-sl">HOPS</span>
          <span class="r-sv" style="color:#00e676">${hops}</span>
        </div>
        <div class="r-stat">
          <span class="r-sl">QUALITY</span>
          <span class="r-sv" style="color:${q.color};font-size:0.75rem">${q.label}</span>
        </div>
        <div class="r-stat r-stat--full">
          <span class="r-sl">DATA SOURCE</span>
          <span class="r-sv mock-badge">MOCK · DIJKSTRA READY</span>
        </div>
      </div>`;

    document.getElementById('btn-send').disabled = false;
    document.getElementById('sb-delay').textContent = `${cost} units`;
    document.getElementById('sb-hops').textContent  = hops;
  }

  showError(msg) {
    document.getElementById('route-panel').innerHTML =
      `<p class="r-empty r-error">${msg}</p>`;
  }

  clearRoutePanel() {
    document.getElementById('route-panel').innerHTML =
      `<p class="r-empty">Select source &amp; destination, then click<br><strong>FIND SHORTEST ROUTE</strong></p>`;
    document.getElementById('btn-send').disabled = true;
    document.getElementById('sb-delay').textContent = '—';
    document.getElementById('sb-hops').textContent  = '—';
  }

  // ── Emergency message log ──────────────────────────────────────────────────

  /**
   * Adds a SENDING entry and returns the DOM element for later status update.
   */
  addLogEntry({ time, path, cost, msg }) {
    const log = document.getElementById('log-entries');
    const entry = document.createElement('div');
    entry.className = 'log-entry log-sending';
    entry.innerHTML =
      `<span class="log-ts">[${time}]</span> ` +
      `<span class="log-path">${path.join(' → ')}</span> ` +
      `<span class="log-cost">(${cost}u)</span> — ${msg}`;
    log.prepend(entry);
    return entry;
  }

  markDelivered(entryEl) {
    entryEl.classList.remove('log-sending');
    entryEl.classList.add('log-delivered');
    entryEl.innerHTML = '✓ ' + entryEl.innerHTML;
  }

  setTransmitting(active) {
    const btn = document.getElementById('btn-send');
    if (active) {
      btn.innerHTML = '<span>⏳</span> TRANSMITTING…';
      btn.disabled = true;
    } else {
      btn.innerHTML = '<span>📡</span> SEND EMERGENCY BROADCAST';
      btn.disabled = false;
    }
  }

  clearMessageInput() {
    document.getElementById('msg-input').value = '';
  }

  // ── Status bar ─────────────────────────────────────────────────────────────

  updateNetworkStats(activeNodes, totalNodes, activeEdges, totalEdges) {
    document.getElementById('sb-nodes').textContent = `${activeNodes} / ${totalNodes}`;
    document.getElementById('sb-edges').textContent = `${activeEdges} / ${totalEdges}`;

    const badge = document.getElementById('net-status-badge');
    const text  = document.getElementById('net-status-text');
    const isHealthy = activeNodes === totalNodes;
    badge.className = `status-badge ${isHealthy ? 'status-online' : 'status-degraded'}`;
    text.textContent = isHealthy ? 'NETWORK ONLINE' : 'NETWORK DEGRADED';
  }

  // ── Clock ──────────────────────────────────────────────────────────────────

  #startClock() {
    const el = document.getElementById('clock');
    const tick = () => {
      el.textContent = new Date().toLocaleTimeString('en-GB', { hour12: false });
    };
    tick();
    setInterval(tick, 1000);
  }
}
