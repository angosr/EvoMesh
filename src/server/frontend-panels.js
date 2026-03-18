// Panel management + terminal scroll/copy
// Depends on globals from frontend.js: state, authFetch, API, esc, saveLayout, renderOpenTabs, fetchAll, injectTouchScroll

// Cleanup helper: call stored cleanup functions on an iframe before replacing/removing it
function _cleanupIframe(iframe) {
  if (iframe && typeof iframe._scrollCleanup === 'function') {
    iframe._scrollCleanup();
    iframe._scrollCleanup = null;
  }
}

// ==================== Panels ====================
function openTerminal(slug, projectName, roleName, terminalPath) {
  const key = `${slug}/${roleName}`;
  if (state.openPanels[key]) { switchTo(key); return; }
  if (!terminalPath) {
    startAndOpenTerminal(slug, projectName, roleName);
    return;
  }
  const authPath = terminalPath + (terminalPath.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(AUTH_TOKEN);
  const panel = document.createElement('div'); panel.className = 'panel'; panel.id = `panel-${key}`;
  const iframe = document.createElement('iframe'); iframe.src = authPath; iframe.allow = 'clipboard-read; clipboard-write';
  const overlay = document.createElement('div'); overlay.className = 'reconnect-overlay';
  overlay.innerHTML = `<span class="reconnect-msg">Terminal disconnected</span><button class="reconnect-btn">Reconnect</button>`;
  overlay.querySelector('.reconnect-btn').addEventListener('click', () => reconnectPanel(key));
  const toolbar = document.createElement('div');
  toolbar.className = 'term-toolbar';
  // D-pad (arrow keys) + page controls
  const dpad = document.createElement('div'); dpad.className = 'term-dpad';
  const pageCtrl = document.createElement('div'); pageCtrl.className = 'term-page';
  const allBtns = [
    // [label, action, lines, container, cssClass]
    ['\u2191', 'arrow-up', 0, dpad, 'dpad-up'],
    ['\u2190', 'arrow-left', 0, dpad, 'dpad-left'],
    ['\u2192', 'arrow-right', 0, dpad, 'dpad-right'],
    ['\u2193', 'arrow-down', 0, dpad, 'dpad-down'],
    ['\u21DE', 'up', 20, pageCtrl, ''],
    ['\u21DF', 'down', 20, pageCtrl, ''],
    ['Esc', 'esc', 0, pageCtrl, ''],
  ];
  for (const [label, action, lines, container, cls] of allBtns) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.title = label;
    if (cls) btn.className = cls;
    let holdTimer = null;
    const fire = () => termAction(key, action, lines);
    const flash = () => { btn.style.background = 'var(--accent)'; btn.style.color = '#fff'; setTimeout(() => { btn.style.background = ''; btn.style.color = ''; }, 150); };
    const startHold = (e) => {
      e.preventDefault(); e.stopPropagation();
      flash(); fire();
      // Repeat on hold for arrows and scroll
      if (action.startsWith('arrow-') || action === 'up' || action === 'down') {
        holdTimer = setInterval(fire, 120);
      }
    };
    const stopHold = () => { if (holdTimer) { clearInterval(holdTimer); holdTimer = null; } };
    btn.addEventListener('mousedown', startHold);
    btn.addEventListener('mouseup', stopHold);
    btn.addEventListener('mouseleave', stopHold);
    btn.addEventListener('touchstart', startHold, { passive: false });
    btn.addEventListener('touchend', stopHold);
    btn.addEventListener('touchcancel', stopHold);
    btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); flash(); fire(); });
    container.appendChild(btn);
  }
  toolbar.appendChild(dpad);
  toolbar.appendChild(pageCtrl);
  panel.appendChild(iframe); panel.appendChild(toolbar); panel.appendChild(overlay);
  document.getElementById('panels').appendChild(panel);
  // Disconnect detection with grace period — 3 consecutive checks (6s) before showing overlay
  let _disconnectCount = 0;
  const DISCONNECT_THRESHOLD = 3;
  let rTimer = setInterval(() => {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return;
      const xtermScreen = doc.querySelector('.xterm-screen');
      const ttydOverlay = doc.querySelector('#overlay');
      const bodyText = doc.body?.innerText || '';
      const isDisconnected = (ttydOverlay && ttydOverlay.style.display !== 'none') ||
        (!xtermScreen && bodyText.length > 0 && bodyText.length < 200) ||
        (doc.readyState === 'complete' && !xtermScreen && !doc.querySelector('canvas'));
      if (isDisconnected) {
        _disconnectCount++;
        if (_disconnectCount >= DISCONNECT_THRESHOLD) overlay.classList.add('show');
      } else {
        _disconnectCount = 0;
        overlay.classList.remove('show');
      }
    } catch {}
  }, 2000);
  iframe.addEventListener('error', () => overlay.classList.add('show'));
  injectTouchScroll(iframe);
  injectKeyboardScroll(iframe, key);
  state.openPanels[key] = { panel, iframe, overlay, reconnectTimer: rTimer };
  if (!state.tabOrder.includes(key)) state.tabOrder.push(key);

  if (state.layout === 'grid') {
    state.activePanel = key;
    refreshGrid();
  } else {
    switchTo(key);
  }
  renderOpenTabs(); saveLayout();
}

async function startAndOpenTerminal(slug, projectName, roleName) {
  const key = `${slug}/${roleName}`;
  const panel = document.createElement('div'); panel.className = 'panel'; panel.id = `panel-${key}`;
  panel.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;gap:12px;color:#888">
    <div style="font-size:24px" class="loading-spinner">&#9881;</div>
    <div>Starting ${esc(projectName)}/${esc(roleName)}...</div>
  </div>`;
  document.getElementById('panels').appendChild(panel);
  state.openPanels[key] = { panel, iframe: null, overlay: null, reconnectTimer: null, startPoll: null };
  if (!state.tabOrder.includes(key)) state.tabOrder.push(key);
  renderOpenTabs();
  switchTo(key);

  try {
    const res = await authFetch(`${API}/projects/${slug}/roles/${roleName}/restart`, { method: 'POST' });
    const data = await res.json();
    if (!data.ok) {
      panel.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ef4444">Failed to start: ${esc(data.error || 'unknown error')}</div>`;
      return;
    }
    let retries = 0;
    const check = setInterval(async () => {
      retries++;
      try {
        const s = await (await authFetch(`${API}/projects/${slug}/status`)).json();
        const role = s.roles?.find(r => r.name === roleName);
        if (role?.terminal) {
          clearInterval(check);
          panel.remove();
          delete state.openPanels[key];
          state.tabOrder = state.tabOrder.filter(k => k !== key);
          openTerminal(slug, projectName, roleName, role.terminal);
        }
      } catch {}
      if (retries > 30) {
        clearInterval(check);
        if (state.openPanels[key]) state.openPanels[key].startPoll = null;
        panel.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ef4444">Timeout waiting for terminal. Try refreshing.</div>`;
      }
    }, 2000);
    // Store polling interval so closePanel can clean it up
    if (state.openPanels[key]) state.openPanels[key].startPoll = check;
  } catch (e) {
    panel.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ef4444">Error: ${esc(String(e))}</div>`;
  }
}

function reconnectPanel(key) {
  const p = state.openPanels[key];
  if (!p) return;
  p.overlay.classList.remove('show');
  // Clean up old iframe scroll listeners before replacing
  _cleanupIframe(p.iframe);
  // Clear old reconnect timer and restart it on the new iframe
  if (p.reconnectTimer) { clearInterval(p.reconnectTimer); p.reconnectTimer = null; }
  const oldSrc = p.iframe.src;
  const newIframe = document.createElement('iframe');
  newIframe.src = oldSrc;
  newIframe.allow = 'clipboard-read; clipboard-write';
  newIframe.style.cssText = p.iframe.style.cssText;
  p.iframe.replaceWith(newIframe);
  p.iframe = newIframe;
  injectTouchScroll(newIframe);
  injectKeyboardScroll(newIframe, key);
  // Restart disconnect detection on new iframe — with grace period (3 consecutive checks)
  let _reconnDisconnectCount = 0;
  const RECONN_THRESHOLD = 3;
  p.reconnectTimer = setInterval(() => {
    try {
      const doc = newIframe.contentDocument || newIframe.contentWindow?.document;
      if (!doc) return;
      const xtermScreen = doc.querySelector('.xterm-screen');
      const ttydOverlay = doc.querySelector('#overlay');
      const bodyText = doc.body?.innerText || '';
      const isDisconnected = (ttydOverlay && ttydOverlay.style.display !== 'none') ||
        (!xtermScreen && bodyText.length > 0 && bodyText.length < 200) ||
        (doc.readyState === 'complete' && !xtermScreen && !doc.querySelector('canvas'));
      if (isDisconnected) {
        _reconnDisconnectCount++;
        if (_reconnDisconnectCount >= RECONN_THRESHOLD) p.overlay.classList.add('show');
      } else {
        _reconnDisconnectCount = 0;
        p.overlay.classList.remove('show');
      }
    } catch {}
  }, 2000);
}

function closePanel(key) {
  const p = state.openPanels[key];
  if (!p) return;
  if (p.reconnectTimer) { clearInterval(p.reconnectTimer); p.reconnectTimer = null; }
  if (p.startPoll) { clearInterval(p.startPoll); p.startPoll = null; }
  // Clean up iframe scroll event listeners
  _cleanupIframe(p.iframe);
  p.panel.remove(); delete state.openPanels[key];
  state.tabOrder = state.tabOrder.filter(k => k !== key);
  if (state.activePanel === key) {
    const remaining = state.tabOrder.filter(k => k !== 'dashboard' && state.openPanels[k]);
    state.activePanel = remaining.length > 0 ? remaining[0] : 'dashboard';
  }
  if (state.layout === 'grid') refreshGrid();
  else switchTo(state.activePanel);
  renderOpenTabs(); saveLayout();
}

function switchTo(name) {
  state.activePanel = name;
  if ((name === 'dashboard' || name === 'settings') && state.layout === 'grid') {
    setLayout('tabs');
    return;
  }
  if (state.layout === 'tabs') {
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === `panel-${name}`));
  }
  document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
  const title = name === 'dashboard' ? 'Dashboard' : name === 'settings' ? 'Settings' : esc(name);
  document.getElementById('panel-title').innerHTML = `<strong>${title}</strong>`;
  const dashBtn = document.getElementById('dashboard-btn');
  if (dashBtn) { name === 'dashboard' ? dashBtn.classList.add('active') : dashBtn.classList.remove('active'); }
  if (name === 'settings') renderSettings();
  renderOpenTabs(); saveLayout();
  if (typeof updateMobileNav === 'function') updateMobileNav(name);
  // Close compose when switching to non-terminal panel
  if (typeof _composeOpen !== 'undefined' && _composeOpen && (name === 'dashboard' || name === 'settings')) closeCompose();
  // Focus the terminal iframe — never when compose is open or user is typing
  if (typeof _composeOpen === 'undefined' || !_composeOpen) {
    const sp = state.openPanels[name];
    if (sp?.iframe) {
      const ae = document.activeElement;
      const isTyping = ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT' || ae.tagName === 'SELECT' || ae.isContentEditable);
      if (!isTyping) sp.iframe.focus();
    }
  }
}

function refreshGrid() {
  const panels = document.getElementById('panels');
  panels.className = 'grid';
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active', 'hidden-grid'));
  document.getElementById('panel-dashboard')?.classList.add('hidden-grid');
  document.getElementById('panel-settings')?.classList.add('hidden-grid');
  const visible = document.querySelectorAll('#panels .panel:not(.hidden-grid)').length;
  if (visible <= 1) panels.classList.add('grid-1');
  else if (visible === 2) panels.classList.add('grid-2');
  else if (visible === 3) panels.classList.add('grid-3');
  else if (visible === 4) panels.classList.add('grid-4');
  else panels.classList.add('grid-many');
}

function setLayout(mode) {
  state.layout = mode;
  // Close compose in grid mode — compose is tabs-only
  if (mode === 'grid' && typeof _composeOpen !== 'undefined' && _composeOpen) closeCompose();
  const panels = document.getElementById('panels');
  document.getElementById('btn-tabs').classList.toggle('active', mode === 'tabs');
  document.getElementById('btn-grid').classList.toggle('active', mode === 'grid');
  if (mode === 'grid') {
    refreshGrid();
  } else {
    panels.className = '';
    document.querySelectorAll('.panel').forEach(p => {
      p.classList.remove('hidden-grid');
      p.classList.toggle('active', p.id === `panel-${state.activePanel}`);
    });
  }
  saveLayout();
}

// ==================== Batched scroll (global — used by keyboard inject too) ====================
let _scrollPendingUp = 0, _scrollPendingDown = 0, _scrollFlushTimer = null;
const SCROLL_FLUSH_INTERVAL = 100; // ms — send at most 10 requests/sec

function queueScroll(direction, lines) {
  if (direction === 'up') _scrollPendingUp += lines;
  else _scrollPendingDown += lines;
  if (!_scrollFlushTimer) _scrollFlushTimer = setTimeout(_flushScroll, SCROLL_FLUSH_INTERVAL);
}

function _flushScroll() {
  _scrollFlushTimer = null;
  const key = state.activePanel;
  if (!key || key === 'dashboard' || key === 'settings') { _scrollPendingUp = _scrollPendingDown = 0; return; }
  const parts = key.split('/');
  if (parts.length !== 2) { _scrollPendingUp = _scrollPendingDown = 0; return; }
  const net = _scrollPendingDown - _scrollPendingUp;
  _scrollPendingUp = _scrollPendingDown = 0;
  if (net === 0) return;
  const direction = net > 0 ? 'down' : 'up';
  const lines = Math.min(Math.abs(net), 30);
  authFetch(`${API}/projects/${parts[0]}/roles/${parts[1]}/scroll`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ direction, lines }),
  }).catch(() => {});
}

// ==================== Terminal scroll + copy ====================
(function() {
  const panels = document.getElementById('panels');
  if (!panels) return;

  panels.addEventListener('wheel', e => {
    if (!state.openPanels[state.activePanel]) return;
    e.preventDefault();
    queueScroll(e.deltaY > 0 ? 'down' : 'up', 3);
  }, { passive: false });

  let touchStartY = 0, touchStartTime = 0, touchMoved = false;
  let lastTouchY = 0, lastTouchTime = 0, velocity = 0, momentumTimer = null;

  panels.addEventListener('touchstart', e => {
    if (!state.openPanels[state.activePanel]) return;
    if (e.touches.length === 1) {
      touchStartY = e.touches[0].clientY;
      lastTouchY = touchStartY;
      touchStartTime = Date.now();
      lastTouchTime = touchStartTime;
      touchMoved = false;
      velocity = 0;
      if (momentumTimer) { cancelAnimationFrame(momentumTimer); momentumTimer = null; }
    }
  }, { passive: true });

  panels.addEventListener('touchmove', e => {
    if (!state.openPanels[state.activePanel]) return;
    if (e.touches.length !== 1) return;
    const currentY = e.touches[0].clientY;
    const dy = currentY - lastTouchY;
    const now = Date.now();
    const dt = now - lastTouchTime;
    if (Math.abs(currentY - touchStartY) > 10) {
      touchMoved = true;
      const lines = Math.min(Math.ceil(Math.abs(dy) / 12), 10);
      if (lines > 0) queueScroll(dy > 0 ? 'up' : 'down', lines);
      // Track velocity for momentum
      if (dt > 0) velocity = dy / dt; // px/ms
    }
    lastTouchY = currentY;
    lastTouchTime = now;
  }, { passive: true });

  panels.addEventListener('touchend', e => {
    if (!state.openPanels[state.activePanel]) return;
    // Don't trigger copy dialog when touch originated from toolbar buttons
    const fromToolbar = e.target.closest('.term-toolbar');
    const duration = Date.now() - touchStartTime;
    if (!touchMoved && duration > 500 && !fromToolbar) {
      showCopyDialog();
      return;
    }
    // Momentum scrolling
    if (touchMoved && Math.abs(velocity) > 0.3) {
      let v = velocity;
      const decay = 0.92;
      const panelKey = state.activePanel;
      function momentumStep() {
        v *= decay;
        if (Math.abs(v) < 0.05) { momentumTimer = null; return; }
        // Stop if the panel was closed
        if (!state.openPanels[panelKey]) { momentumTimer = null; return; }
        const lines = Math.max(1, Math.round(Math.abs(v) * 8));
        queueScroll(v > 0 ? 'up' : 'down', lines);
        momentumTimer = requestAnimationFrame(momentumStep);
      }
      momentumTimer = requestAnimationFrame(momentumStep);
    }
  });
})();

function termAction(key, action, lines) {
  const parts = key.split('/');
  if (parts.length !== 2) return;

  if (action === 'copy') { showCopyDialog(); return; }

  // Esc and arrow keys: direct API call. up/down scroll: batched queue.
  if (action === 'esc' || action.startsWith('arrow-')) {
    authFetch(`${API}/projects/${parts[0]}/roles/${parts[1]}/scroll`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction: action, lines: 0 }),
    }).catch(() => {});
  } else {
    queueScroll(action, lines);
  }
}

// Reusable copy dialog — created once, shown/hidden as needed to avoid listener accumulation
let _copyModal = null, _copyPre = null, _copyBtn = null;
function _ensureCopyModal() {
  if (_copyModal) return;
  _copyModal = document.createElement('div');
  _copyModal.className = 'copy-modal-overlay';
  const inner = document.createElement('div');
  inner.className = 'copy-modal';
  const header = document.createElement('div');
  header.className = 'copy-modal-header';
  header.innerHTML = `<span>Terminal Output</span>`;
  _copyBtn = document.createElement('button');
  _copyBtn.className = 'copy-modal-btn';
  _copyBtn.textContent = 'Copy All';
  header.appendChild(_copyBtn);
  const closeBtn = document.createElement('button');
  closeBtn.className = 'copy-modal-close';
  closeBtn.textContent = '\u00d7';
  closeBtn.addEventListener('click', () => _closeCopyModal());
  header.appendChild(closeBtn);
  _copyPre = document.createElement('pre');
  _copyPre.className = 'copy-modal-content';
  inner.appendChild(header);
  inner.appendChild(_copyPre);
  _copyModal.appendChild(inner);
  _copyModal.addEventListener('click', e => { if (e.target === _copyModal) _closeCopyModal(); });
}
function _closeCopyModal() {
  if (_copyModal && _copyModal.parentNode) _copyModal.parentNode.removeChild(_copyModal);
}

async function showCopyDialog() {
  const key = state.activePanel;
  if (!key) return;
  const parts = key.split('/');
  if (parts.length !== 2) return;
  try {
    const res = await authFetch(`${API}/projects/${parts[0]}/roles/${parts[1]}/log`);
    const text = await res.text();
    const clean = text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/[^\x20-\x7e\n\r\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g, '');
    const last100 = clean.split('\n').slice(-100).join('\n');
    _ensureCopyModal();
    _copyPre.textContent = last100;
    _copyBtn.textContent = 'Copy All';
    // Replace copy button's click handler cleanly using a clone
    const newCopyBtn = _copyBtn.cloneNode(true);
    _copyBtn.parentNode.replaceChild(newCopyBtn, _copyBtn);
    _copyBtn = newCopyBtn;
    _copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(last100);
        _copyBtn.textContent = 'Copied!';
        setTimeout(() => { _copyBtn.textContent = 'Copy All'; }, 1500);
      } catch {
        const range = document.createRange(); range.selectNodeContents(_copyPre);
        const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
      }
    });
    document.body.appendChild(_copyModal);
  } catch {}
}
