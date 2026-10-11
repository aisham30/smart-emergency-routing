/**
 * ui.js — Dashboard DOM Controller
 *
 * Manages all DOM interactions outside the SVG canvas:
 *   • Source / destination selector dropdowns
 *   • Node status sidebar list with colour-coded indicators & interactive toggles
 *   • Simulation fault injection controls (node/link failure & restore)
 *   • Route detail panel (path chips, cost, hops, quality badge)
 *   • Emergency message compose area + transmission log
 *   • Interactive Scenario Presets & In-Browser Test Suite Runner
 *   • Status bar metric updates & Live clock
 */

import { NODE_INFO, NODE_TYPES, EDGES } from './network.js';

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
   * @param {{ onFindRoute, onClearRoute, onNodeClick, onSendMessage, onToggleNodeFail, onToggleLinkFail, onRestoreAll, onRunTestSuite, onRunScenarioPreset }} callbacks
   */
  constructor({
    onFindRoute,
    onClearRoute,
    onNodeClick,
    onSendMessage,
    onToggleNodeFail,
    onToggleLinkFail,
    onRestoreAll,
    onRunTestSuite,
    onRunScenarioPreset
  }) {
    this._cb = {
      onFindRoute,
      onClearRoute,
      onNodeClick,
      onSendMessage,
      onToggleNodeFail,
      onToggleLinkFail,
      onRestoreAll,
      onRunTestSuite,
      onRunScenarioPreset
    };
    this._logCount = 0;

    this.#populateSelects();
    this.#buildNodeList();
    this.#wireButtons();
    this.#wireTabs();
    this.#startClock();
  }

  // ── Getters & Setters ──────────────────────────────────────────────────────

  getSource() { return document.getElementById('sel-source').value; }
  getDest()   { return document.getElementById('sel-dest').value;   }

  setSource(id) {
    const sel = document.getElementById('sel-source');
    if (sel) sel.value = id;
  }

  setDest(id) {
    const sel = document.getElementById('sel-dest');
    if (sel) sel.value = id;
  }

  getSelectedFaultNode() {
    return document.getElementById('sel-fault-node').value;
  }

  getSelectedFaultLink() {
    const val = document.getElementById('sel-fault-link').value;
    const [u, v] = val.split('·');
    return { u, v };
  }

  // ── Dropdowns ──────────────────────────────────────────────────────────────

  #populateSelects() {
    const src = document.getElementById('sel-source');
    const dst = document.getElementById('sel-dest');
    const faultNode = document.getElementById('sel-fault-node');
    const faultLink = document.getElementById('sel-fault-link');

    src.innerHTML = '';
    dst.innerHTML = '';
    if (faultNode) faultNode.innerHTML = '';
    if (faultLink) faultLink.innerHTML = '';

    for (const [id, info] of Object.entries(NODE_INFO)) {
      const icon = NODE_TYPES[info.type]?.icon ?? '●';
      src.appendChild(new Option(`${icon} ${id}  —  ${info.label}`, id));
      dst.appendChild(new Option(`${icon} ${id}  —  ${info.label}`, id));
      if (faultNode) faultNode.appendChild(new Option(`${icon} ${id} (${info.label})`, id));
    }

    if (faultLink) {
      for (const edge of EDGES) {
        const key = `${edge.from}·${edge.to}`;
        faultLink.appendChild(new Option(`${edge.from} ↔ ${edge.to} (${edge.weight}ms)`, key));
      }
    }

    src.value = 'CC';
    dst.value = 'H1';
    if (faultNode) faultNode.value = 'N1';
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
      tag.title = `Click to toggle failure on node ${id}`;

      // Clicking tag toggles failure directly!
      tag.addEventListener('click', (e) => {
        e.stopPropagation();
        this._cb.onToggleNodeFail?.(id);
      });

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

  resetAllNodes() {
    for (const id of Object.keys(NODE_INFO)) {
      this.updateNodeTag(id, 'active');
    }
  }

  // ── Buttons & Preset Wiring ────────────────────────────────────────────────

  #wireButtons() {
    document.getElementById('btn-find')?.addEventListener('click', () => {
      const src = this.getSource(), dst = this.getDest();
      if (src === dst) { this.showError('Source and destination must be different nodes.'); return; }
      this._cb.onFindRoute?.(src, dst);
    });

    document.getElementById('btn-clear')?.addEventListener('click', () => {
      this._cb.onClearRoute?.();
      this.clearRoutePanel();
    });

    document.getElementById('btn-send')?.addEventListener('click', () => {
      const msg = document.getElementById('msg-input').value.trim();
      if (!msg) return;
      this._cb.onSendMessage?.(msg);
    });

    // Fault Injection buttons
    document.getElementById('btn-toggle-node')?.addEventListener('click', () => {
      const node = this.getSelectedFaultNode();
      this._cb.onToggleNodeFail?.(node);
    });

    document.getElementById('btn-toggle-link')?.addEventListener('click', () => {
      const { u, v } = this.getSelectedFaultLink();
      this._cb.onToggleLinkFail?.(u, v);
    });

    document.getElementById('btn-restore-all')?.addEventListener('click', () => {
      this._cb.onRestoreAll?.();
    });

    // Quick presets bar
    document.getElementById('btn-run-tests')?.addEventListener('click', () => {
      this.switchTab('tab-tests');
      this._cb.onRunTestSuite?.();
    });

    document.getElementById('btn-run-tests-panel')?.addEventListener('click', () => {
      this._cb.onRunTestSuite?.();
    });

    document.getElementById('btn-scen-1')?.addEventListener('click', () => {
      this._cb.onRunScenarioPreset?.(1);
    });

    document.getElementById('btn-scen-2')?.addEventListener('click', () => {
      this._cb.onRunScenarioPreset?.(2);
    });

    document.getElementById('btn-scen-3')?.addEventListener('click', () => {
      this._cb.onRunScenarioPreset?.(3);
    });

    document.getElementById('btn-scen-4')?.addEventListener('click', () => {
      this._cb.onRunScenarioPreset?.(4);
    });

    document.getElementById('btn-scen-5')?.addEventListener('click', () => {
      this._cb.onRunScenarioPreset?.(5);
    });

    document.getElementById('btn-scen-restore')?.addEventListener('click', () => {
      this._cb.onRestoreAll?.();
    });
  }

  // ── Tabs ───────────────────────────────────────────────────────────────────

  #wireTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        this.switchTab(target);
      });
    });
  }

  switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('tab-btn--active', b.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-pane').forEach(p => {
      p.classList.toggle('tab-pane--active', p.id === tabId);
    });
  }

  // ── Route detail panel ─────────────────────────────────────────────────────

  showRoute(route, rerouteInfo = null) {
    const { path, cost, hops } = route;
    const q = qualityFor(cost);

    const chips = path.map((n, i) => {
      const c = NODE_INFO[n].color;
      const chip = `<span class="r-chip" style="background:${c}1a;border:1px solid ${c};color:${c}">${n}</span>`;
      return i < path.length - 1 ? chip + `<span class="r-arrow">→</span>` : chip;
    }).join('');

    const rerouteHtml = rerouteInfo ? `
      <div class="reroute-card">
        <div class="reroute-hdr">
          <span class="reroute-badge">INCIDENT DETOUR</span>
          <span>AUTOMATIC BYPASS ACTIVATED</span>
        </div>
        <div class="reroute-detail">
          <strong>Incident:</strong> ${rerouteInfo.reason}<br>
          ${rerouteInfo.prevPath ? `<strong>Broken Route:</strong> ${rerouteInfo.prevPath.join(' → ')} (${rerouteInfo.prevCost} ms)<br>` : ''}
          <strong>New Bypass:</strong> ${path.join(' → ')} (${cost} ms)<br>
          <span class="reroute-delta">Latency Impact: +${rerouteInfo.delayDelta} ms delay penalty</span>
        </div>
      </div>` : '';

    document.getElementById('route-panel').innerHTML = `
      <div class="r-path">${chips}</div>
      <div class="r-stats">
        <div class="r-stat">
          <span class="r-sl">TOTAL DELAY</span>
          <span class="r-sv" style="color:#00e676">${cost} <small>ms</small></span>
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
          <span class="r-sl">ALGORITHM EXECUTION</span>
          <span class="r-sv mock-badge" style="color:#00e676;border-color:rgba(0,230,118,.3)">DIJKSTRA · DYNAMIC LIVE</span>
        </div>
      </div>
      ${rerouteHtml}`;

    document.getElementById('btn-send').disabled = false;
    document.getElementById('sb-delay').textContent = `${cost} ms`;
    document.getElementById('sb-hops').textContent  = hops;
  }

  showError(msg) {
    document.getElementById('route-panel').innerHTML =
      `<p class="r-empty r-error">${msg}</p>`;
    document.getElementById('btn-send').disabled = true;
    document.getElementById('sb-delay').textContent = '∞';
    document.getElementById('sb-hops').textContent  = '—';
  }

  clearRoutePanel() {
    document.getElementById('route-panel').innerHTML =
      `<p class="r-empty">Select source &amp; destination, then click<br><strong>FIND SHORTEST ROUTE</strong></p>`;
    document.getElementById('btn-send').disabled = true;
    document.getElementById('sb-delay').textContent = '—';
    document.getElementById('sb-hops').textContent  = '—';
  }

  // ── Network Incident Alert Banner ──────────────────────────────────────────

  updateIncidentAlert(failedNodes, failedLinks, incidentDetails = null) {
    const banner = document.getElementById('incident-banner');
    const iconEl = document.getElementById('incident-icon');
    const textEl = document.getElementById('incident-text');
    if (!banner || !iconEl || !textEl) return;

    const nodeCount = failedNodes.size;
    const linkCount = failedLinks.size;

    if (nodeCount === 0 && linkCount === 0) {
      banner.className = 'incident-banner incident-banner--healthy';
      iconEl.textContent = '✅';
      textEl.textContent = 'NETWORK INFRASTRUCTURE 100% HEALTHY · 8/8 NODES · 12/12 LINKS OPERATIONAL';
      return;
    }

    banner.className = 'incident-banner incident-banner--active';
    iconEl.textContent = '🚨';

    const parts = [];
    if (nodeCount > 0) {
      parts.push(`Collapsed Nodes: [${Array.from(failedNodes).join(', ')}]`);
    }
    if (linkCount > 0) {
      const formattedLinks = Array.from(failedLinks).map(k => k.replace('<->', '↔'));
      parts.push(`Severed Links: [${formattedLinks.join(', ')}]`);
    }

    if (incidentDetails?.unreachable) {
      textEl.innerHTML = `SEVERE DISASTER: Destination <strong>${incidentDetails.target}</strong> is ISOLATED! ${parts.join(' · ')} · Delay: ∞`;
    } else if (incidentDetails?.rerouted) {
      textEl.innerHTML = `OUTAGE DETECTED: ${parts.join(' · ')} · ⚡ Rerouted via bypass (+${incidentDetails.delayDelta}ms delta)`;
    } else {
      textEl.innerHTML = `ACTIVE INCIDENT: ${parts.join(' · ')} · Dynamic topology degraded`;
    }
  }

  // ── Test Suite Results Rendering ───────────────────────────────────────────

  renderTestResults(suite) {
    const summaryText = document.getElementById('test-summary-text');
    const listEl = document.getElementById('test-suite-list');

    if (summaryText) {
      summaryText.textContent = `${suite.totalPass} / ${suite.totalTests} CHECKS PASSED ✓`;
      summaryText.style.color = suite.totalFail === 0 ? 'var(--green)' : 'var(--red)';
    }

    if (listEl) {
      listEl.innerHTML = '';
      for (const item of suite.checks) {
        const div = document.createElement('div');
        div.className = `test-item ${item.pass ? 'test-item--pass' : 'test-item--fail'}`;
        div.innerHTML = `
          <span class="test-item-icon">${item.pass ? '✓' : '✗'}</span>
          <span class="test-item-sc">[SC${item.scenario}]</span>
          <span class="test-item-lbl">${item.label}</span>
        `;
        listEl.appendChild(div);
      }
    }
  }

  // ── Emergency message log ──────────────────────────────────────────────────

  addLogEntry({ time, path, cost, msg }) {
    const log = document.getElementById('log-entries');
    const entry = document.createElement('div');
    entry.className = 'log-entry log-sending';
    entry.innerHTML =
      `<span class="log-ts">[${time}]</span> ` +
      `<span class="log-path">${path.join(' → ')}</span> ` +
      `<span class="log-cost">(${cost}ms)</span> — ${msg}`;
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
    const isHealthy = activeNodes === totalNodes && activeEdges === totalEdges;
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
