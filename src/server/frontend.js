// Read token from URL param (set by login redirect) or localStorage
let AUTH_TOKEN = new URLSearchParams(location.search).get('token') || localStorage.getItem('evomesh-token') || '';
if (AUTH_TOKEN) localStorage.setItem('evomesh-token', AUTH_TOKEN);
// Clean URL params after extracting token
if (location.search.includes('token=')) history.replaceState(null, '', location.pathname);
const API = `${location.origin}/api`;
function authFetch(url, opts = {}) {
  opts.headers = { ...opts.headers, 'Authorization': `Bearer ${AUTH_TOKEN}` };
  return fetch(url, opts);
}
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function injectTouchScroll(iframe) {
  const POLL_INTERVAL = 500, MAX_ATTEMPTS = 20;
  let attempts = 0;
  let aborted = false;
  let pollTimeout = null;
  function tryInject() {
    if (aborted) return;
    attempts++;
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) { if (attempts < MAX_ATTEMPTS) { pollTimeout = setTimeout(tryInject, POLL_INTERVAL); } return; }
      const xtermScreen = iframeDoc.querySelector('.xterm-screen');
      const xtermViewport = iframeDoc.querySelector('.xterm-viewport');
      if (!xtermScreen || !xtermViewport) { if (attempts < MAX_ATTEMPTS) { pollTimeout = setTimeout(tryInject, POLL_INTERVAL); } return; }
      if (xtermScreen.dataset.touchScrollInjected) return;
      xtermScreen.dataset.touchScrollInjected = 'true';
      let startY = 0, lastY = 0, scrolling = false;
      const THRESHOLD = 8, WHEEL_DELTA = 80;
      xtermScreen.addEventListener('touchstart', e => {
        if (e.touches.length !== 1) return;
        startY = e.touches[0].clientY; lastY = startY; scrolling = false;
      }, { passive: true });
      xtermScreen.addEventListener('touchmove', e => {
        if (e.touches.length !== 1) return;
        const currentY = e.touches[0].clientY, totalDy = Math.abs(currentY - startY);
        if (!scrolling && totalDy > THRESHOLD) { scrolling = true; lastY = currentY; return; }
        if (!scrolling) return;
        const dy = lastY - currentY;
        if (Math.abs(dy) < 4) return;
        xtermViewport.dispatchEvent(new WheelEvent('wheel', {
          deltaY: dy > 0 ? WHEEL_DELTA : -WHEEL_DELTA, deltaX: 0, deltaMode: 0,
          bubbles: true, cancelable: true, clientX: e.touches[0].clientX, clientY: e.touches[0].clientY,
        }));
        lastY = currentY;
        e.preventDefault();
      }, { passive: false });
      xtermScreen.addEventListener('touchend', () => { scrolling = false; });
      xtermScreen.addEventListener('touchcancel', () => { scrolling = false; });
    } catch { if (!aborted && attempts < MAX_ATTEMPTS) { pollTimeout = setTimeout(tryInject, POLL_INTERVAL); } }
  }
  const onLoad = () => { attempts = 0; tryInject(); };
  iframe.addEventListener('load', onLoad);
  tryInject();
  // Store cleanup on iframe — chains with any existing cleanup (e.g. from injectKeyboardScroll)
  const prevCleanup = iframe._scrollCleanup;
  iframe._scrollCleanup = () => {
    aborted = true;
    if (pollTimeout) { clearTimeout(pollTimeout); pollTimeout = null; }
    iframe.removeEventListener('load', onLoad);
    if (typeof prevCleanup === 'function') prevCleanup();
  };
}

// Inject keyboard handler into iframe for PageUp/PageDown scroll
// Routes through queueScroll (defined in frontend-panels.js) for batched API calls
function injectKeyboardScroll(iframe) {
  const POLL_INTERVAL = 500, MAX_ATTEMPTS = 20;
  let attempts = 0;
  let aborted = false;
  let pollTimeout = null;
  function tryInject() {
    if (aborted) return;
    attempts++;
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) { if (attempts < MAX_ATTEMPTS) { pollTimeout = setTimeout(tryInject, POLL_INTERVAL); } return; }
      if (iframeDoc.body?.dataset?.kbScrollInjected) return;
      const xtermScreen = iframeDoc.querySelector('.xterm-screen');
      if (!xtermScreen) { if (attempts < MAX_ATTEMPTS) { pollTimeout = setTimeout(tryInject, POLL_INTERVAL); } return; }
      iframeDoc.body.dataset.kbScrollInjected = 'true';
      iframeDoc.addEventListener('keydown', e => {
        const keyMap = { PageUp: ['up', 20], PageDown: ['down', 20] };
        const action = keyMap[e.key];
        if (!action) return;
        e.preventDefault();
        e.stopPropagation();
        // Use batched scroll queue instead of direct API call
        if (typeof queueScroll === 'function') queueScroll(action[0], action[1]);
      });
    } catch { if (!aborted && attempts < MAX_ATTEMPTS) { pollTimeout = setTimeout(tryInject, POLL_INTERVAL); } }
  }
  const onLoad = () => { attempts = 0; tryInject(); };
  iframe.addEventListener('load', onLoad);
  tryInject();
  // Store cleanup on iframe — chains with any existing cleanup (e.g. from injectTouchScroll)
  const prevCleanup = iframe._scrollCleanup;
  iframe._scrollCleanup = () => {
    aborted = true;
    if (pollTimeout) { clearTimeout(pollTimeout); pollTimeout = null; }
    iframe.removeEventListener('load', onLoad);
    if (typeof prevCleanup === 'function') prevCleanup();
  };
}
const state = {
  projects: [], accounts: [], openPanels: {}, activePanel: 'dashboard',
  layout: 'tabs', collapsed: {}, chatProject: null, tabOrder: ['dashboard'],
  systemRole: 'user', // 'admin' | 'user' — set from /auth/validate or localStorage
  membersOpen: null, // slug of project with members panel open
};
// Load cached user info
try { const u = JSON.parse(localStorage.getItem('evomesh-user') || '{}'); if (u.role) state.systemRole = u.role; } catch {}

// Hide admin-only UI for non-admin users
if (state.systemRole !== 'admin') {
  const centralSidebar = document.querySelector('#central-btn')?.parentElement;
  if (centralSidebar) centralSidebar.style.display = 'none';
}

// ==================== Data ====================
// Track whether user is actively typing — skip DOM rebuilds to prevent input lag
let _userTyping = false, _typingTimer = null, _pendingRender = false;
// Track IME composition state — during composition, ALL focus changes are blocked
let _imeComposing = false;
document.addEventListener('compositionstart', () => { _imeComposing = true; _userTyping = true; }, true);
document.addEventListener('compositionend', () => {
  // Delay clearing IME flag — some browsers fire compositionend before the final input event
  setTimeout(() => { _imeComposing = false; }, 300);
}, true);
document.addEventListener('input', () => {
  _userTyping = true;
  clearTimeout(_typingTimer);
  _typingTimer = setTimeout(() => {
    if (_imeComposing) return; // Don't clear typing flag while IME is active
    _userTyping = false;
    if (_pendingRender) { _pendingRender = false; renderSidebar(); renderDashboard(); renderOpenTabs(); }
  }, 2000);
}, true);

// ==================== Global focus theft protection ====================
// When the user is actively typing in any input/textarea, prevent ANY focus
// change — including xterm.js inside iframes calling .focus() on load/reconnect.
// We catch this at the document level by monitoring blur events on input elements.
let _focusGuardEl = null;
document.addEventListener('focus', (e) => {
  const tag = e.target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) {
    _focusGuardEl = e.target;
  }
}, true);

document.addEventListener('blur', (e) => {
  if (!_userTyping && !_imeComposing) { _focusGuardEl = null; return; }
  const lost = e.target;
  const tag = lost?.tagName;
  if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT' && !lost?.isContentEditable) return;
  // Focus was stolen from an input while user was typing — restore it immediately
  // Use requestAnimationFrame to run after the browser's focus change completes
  const restoreTarget = lost;
  requestAnimationFrame(() => {
    // Only restore if focus actually moved away (to an iframe or body)
    const now = document.activeElement;
    if (now === restoreTarget) return; // already back
    if (now?.tagName === 'INPUT' || now?.tagName === 'TEXTAREA' || now?.tagName === 'SELECT') return; // user clicked another input
    try { restoreTarget.focus(); } catch {}
  });
}, true);

// Dedup guard: prevent concurrent fetchAll requests from stacking up
let _fetchInProgress = false;

async function fetchAll() {
  if (_fetchInProgress) return;
  _fetchInProgress = true;
  try { await _fetchAllInner(); } finally { _fetchInProgress = false; }
}

async function _fetchAllInner() {
  try {
    const [projRes, acctRes] = await Promise.all([authFetch(`${API}/projects`), authFetch(`${API}/accounts`)]);
    // Auth failed — redirect to login
    if (projRes.status === 401) { localStorage.removeItem('evomesh-token'); location.href = '/login'; return; }
    const projData = await projRes.json();
    const acctData = await acctRes.json();
    state.accounts = acctData.accounts || [];
    const statusResults = await Promise.allSettled(
      projData.projects.map(p =>
        authFetch(`${API}/projects/${p.slug}/status`).then(r => r.json())
      )
    );
    const projects = projData.projects.map((p, i) => {
      const r = statusResults[i];
      if (r.status === 'fulfilled') {
        const s = r.value;
        return { ...p, roles: s.roles || [], accountProfiles: s.accountProfiles || {}, myRole: s.myRole || p.myRole || null, _statusOk: true };
      }
      // API failed — keep previous roles data to avoid closing panels
      const prev = state.projects.find(pp => pp.slug === p.slug);
      return { ...p, roles: prev?.roles || [], accountProfiles: prev?.accountProfiles || {}, myRole: prev?.myRole || p.myRole || null, _statusOk: false };
    });
    state.projects = projects;
    if (!state.chatProject && projects.length > 0) state.chatProject = projects[0].slug;

    // Skip DOM rebuilds while user is typing — defer until idle
    if (_userTyping) {
      _pendingRender = true;
    } else {
      renderSidebar(); renderDashboard();    }

    // Update Central AI status dot + toggle button
    try {
      const centralRes = await authFetch(`${API}/admin/status`);
      const centralData = await centralRes.json();
      const dot = document.getElementById('central-dot');
      const toggle = document.getElementById('central-toggle');
      if (dot) {
        if (centralData.enabled === false) {
          dot.className = 'dot disabled';
        } else {
          dot.className = `dot ${centralData.running ? 'running' : 'stopped'}`;
        }
      }
      if (toggle) {
        toggle.innerHTML = centralData.enabled === false ? '&#9654;' : '&#9724;'; // ▶ or ■
        toggle.title = centralData.enabled === false ? 'Enable Central AI' : 'Disable Central AI';
      }
    } catch {}
    // Clean up tabs only for roles that no longer exist in the project config.
    // Do NOT close panels just because r.terminal is temporarily null (transient
    // API error / slow response) — that causes unnecessary iframe replacement.
    const knownRoles = new Set();
    state.projects.forEach(p => p.roles.forEach(r => knownRoles.add(`${p.slug}/${r.name}`)));
    for (const key of Object.keys(state.openPanels)) {
      if (key === 'dashboard' || key === 'settings' || key === 'central/ai') continue;
      if (!state.openPanels[key].iframe) continue;
      // Only close if the role itself was removed from the project, not just stopped
      if (!knownRoles.has(key)) closePanel(key);
    }
    if (!_userTyping) { renderOpenTabs(); }
  } catch { document.getElementById('status-bar').textContent = 'Connection error'; }
}

// Restore focus to the active panel's iframe after DOM updates
function focusActiveIframe() {
  // ABSOLUTE BLOCK: never touch focus during IME composition — this destroys input
  if (_imeComposing) return;
  // Never steal focus when compose dialog is open
  if (typeof _composeOpen !== 'undefined' && _composeOpen) return;
  // Never steal focus while user is actively typing
  if (_userTyping) return;
  const p = state.openPanels[state.activePanel];
  if (p?.iframe) {
    const ae = document.activeElement;
    // Never steal focus from text inputs
    if (ae && (ae.tagName === 'TEXTAREA' || ae.tagName === 'INPUT' || ae.tagName === 'SELECT' || ae.isContentEditable)) return;
    // Never steal focus from another terminal iframe (user intentionally clicked it)
    if (ae && ae.tagName === 'IFRAME' && ae !== p.iframe) return;
    if (!ae || ae === document.body || ae.tagName === 'BUTTON') {
      p.iframe.focus();
    }
  }
}

// ==================== Sidebar ====================
function renderSidebar() {
  const tree = document.getElementById('project-tree');
  tree.innerHTML = '';
  const needLogin = [];
  state.projects.forEach(p => p.roles.forEach(r => { if (r.needsLogin) needLogin.push(`${p.name}/${r.name}`); }));
  if (needLogin.length) { const a = document.createElement('div'); a.className = 'login-alert'; a.textContent = `Login: ${needLogin.join(', ')}`; tree.appendChild(a); }
  let totalRunning = 0, totalRoles = 0;
  for (const p of state.projects) {
    const group = document.createElement('div'); group.className = 'project-group';
    const running = p.roles.filter(r => r.running).length; totalRunning += running; totalRoles += p.roles.length;
    const isOpen = !state.collapsed[p.slug];
    const isOwner = p.myRole === 'owner';
    const header = document.createElement('button'); header.className = 'project-header';
    header.innerHTML = `<span class="arrow ${isOpen?'open':''}">&#9654;</span><span>${esc(p.name)}</span><span class="pstats">${running}/${p.roles.length}</span>`;
    header.onclick = () => { state.collapsed[p.slug] = !state.collapsed[p.slug]; renderSidebar(); };
    group.appendChild(header);
    const rd = document.createElement('div'); rd.className = `project-roles ${isOpen?'':'collapsed'}`;
    for (const r of p.roles) {
      const btn = document.createElement('button'); const key = `${p.slug}/${r.name}`;
      btn.className = `role-btn ${state.activePanel===key?'active':''}`;
      const isCodex = (r.provider || 'claude') === 'codex';
      const loopOn = isCodex && r.automation_mode === 'prompt';
      const lw = r.needsLogin ? '<span class="login-warn">LOGIN</span>' : '';
      const loopTag = loopOn ? '<span class="info loop-on">LOOP</span>' : '';
      const loopAction = isOwner && isCodex ? `<span class="act-loop${loopOn ? ' on' : ''}" title="${loopOn ? 'Disable loop' : 'Enable loop'}">↻</span>` : '';
      const actions = isOwner ? `<span class="role-actions">${loopAction}<span class="act-cfg" title="Edit">⚙</span></span>` : '';
      btn.innerHTML = `<span class="role-main"><span class="dot ${r.running?'running':'stopped'}"></span><span class="role-name">${esc(r.name)}</span>${loopTag}${lw}</span>${actions}`;
      btn.onclick = () => openTerminal(p.slug, p.name, r.name, r.terminal);
      const loop = btn.querySelector('.act-loop');
      if (loop) {
        loop.addEventListener('click', async e => {
          e.stopPropagation();
          e.preventDefault();
          await toggleCodexLoopQuick(p.slug, r.name);
        });
      }
      const cfg = btn.querySelector('.act-cfg');
      if (cfg) {
        cfg.addEventListener('click', e => {
          e.stopPropagation();
          e.preventDefault();
          openRoleEditModal(p.slug, r.name);
        });
      }
      rd.appendChild(btn);
    }
    if (isOwner) {
      const addBtn = document.createElement('button');
      addBtn.className = 'add-role-btn';
      addBtn.textContent = '+ Add Role';
      addBtn.onclick = e => {
        e.stopPropagation();
        openCreateRoleModal(p.slug);
      };
      rd.appendChild(addBtn);
    }
    group.appendChild(rd); tree.appendChild(group);
  }
  document.getElementById('status-bar').textContent = `${state.projects.length} projects · ${totalRunning}/${totalRoles} running`;
}

function toggleOpenTabs() {
  const list = document.getElementById('open-tabs-list');
  const arrow = document.getElementById('tabs-arrow');
  list.classList.toggle('collapsed');
  arrow.classList.toggle('open');
}

function renderOpenTabs() {
  const list = document.getElementById('open-tabs-list');
  list.innerHTML = '';
  // Update dashboard button active state
  const dashBtn = document.getElementById('dashboard-btn');
  if (dashBtn) dashBtn.classList.toggle('active', state.activePanel === 'dashboard');
  // Only show non-dashboard tabs
  const tabs = state.tabOrder.filter(k => k !== 'dashboard');
  document.getElementById('tab-count').textContent = tabs.length;
  for (const key of tabs) {
    const t = document.createElement('div');
    t.className = `sidebar-tab ${state.activePanel===key?'active':''}`;
    t.draggable = true;
    t.dataset.key = key;
    t.innerHTML = `<span class="tab-icon">&#9654;</span><span>${esc(key)}</span><span class="close">&times;</span>`;
    t.querySelector('.close').addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); closePanel(key); });
    t.onclick = () => switchTo(key);
    // Drag reorder
    t.addEventListener('dragstart', e => { t.classList.add('dragging'); e.dataTransfer.setData('text/plain', key); });
    t.addEventListener('dragend', () => { t.classList.remove('dragging'); list.querySelectorAll('.sidebar-tab').forEach(x => x.classList.remove('drag-over')); });
    t.addEventListener('dragover', e => { e.preventDefault(); if (!t.classList.contains('dragging')) t.classList.add('drag-over'); });
    t.addEventListener('dragleave', () => t.classList.remove('drag-over'));
    t.addEventListener('drop', e => {
      e.preventDefault(); t.classList.remove('drag-over');
      const from = e.dataTransfer.getData('text/plain'); const to = t.dataset.key;
      if (from === to) return;
      const fi = state.tabOrder.indexOf(from), ti = state.tabOrder.indexOf(to);
      if (fi < 0 || ti < 0) return;
      state.tabOrder.splice(fi, 1); state.tabOrder.splice(ti, 0, from);
      renderOpenTabs();
    });
    list.appendChild(t);
  }
}

// Dashboard (renderDashboard, renderAccountUsage, members) moved to frontend-dashboard.js

// Layout (toggleSidebar, toggleChat, theme, swipe, resize) moved to frontend-layout.js

function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('evomesh-user') || '{}'); } catch { return {}; }
}

function doLogout() {
  authFetch(`${API}/auth/logout`, { method: 'POST' }).catch(() => {});
  localStorage.removeItem('evomesh-token');
  localStorage.removeItem('evomesh-user');
  location.href = '/login';
}

// ==================== Button loading state ====================
function withLoading(btn, asyncFn) {
  if (btn.disabled) return;
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = '...';
  btn.classList.add('loading');
  asyncFn().finally(() => {
    btn.disabled = false;
    btn.textContent = orig;
    btn.classList.remove('loading');
  });
}

// Account / Role management moved to frontend-actions.js

// ==================== Chat / Feed ====================
let serverConnected = true;

// ==================== Metrics ====================
let _connFailCount = 0;
const CONN_FAIL_THRESHOLD = 3; // need 3 consecutive failures before declaring disconnected
async function fetchMetrics() {
  try {
    const r = await authFetch(`${API}/metrics`);
    const d = await r.json();
    updateMetric('cpu',d.cpu.percent,`${d.cpu.percent}%`);
    updateMetric('mem',d.memory.percent,`${d.memory.percent}%`);
    updateMetric('disk',d.disk.percent,`${d.disk.percent}%`);
    _connFailCount = 0;
    setConnStatus(true);
  } catch {
    _connFailCount++;
    // Only declare disconnected after multiple consecutive failures
    // A single network hiccup should NOT trigger reconnect of all terminals
    if (_connFailCount >= CONN_FAIL_THRESHOLD) setConnStatus(false);
  }
}
function updateMetric(id, pct, label) { const bar = document.getElementById(`m-${id}2`), val = document.getElementById(`m-${id}-val2`); if (!bar||!val) return; bar.style.width = pct+'%'; bar.className = 'metric-bar-fill '+(pct>90?'crit':pct>70?'warn':'ok'); val.textContent = label; }
function setConnStatus(connected) {
  // Don't trigger mass iframe replacement on reconnect — each terminal's
  // in-iframe auto-reconnect handles its own recovery silently.
  // We only update the visual status indicator here.
  serverConnected = connected;
  for (const id of ['conn-dot','conn-dot2']) { const dot = document.getElementById(id); if (dot) { dot.className = 'conn-dot '+(connected?'connected':'disconnected'); dot.title = connected?'Connected':'Disconnected'; } }
}

// ==================== Layout persistence ====================
const STORAGE_KEY = 'evomesh-layout';

function saveLayout() {
  const data = {
    openPanels: Object.keys(state.openPanels).map(key => {
      const p = state.openPanels[key];
      return { key, src: p.iframe?.src || '' };
    }),
    activePanel: state.activePanel,
    layout: state.layout,
    collapsed: state.collapsed,
    tabOrder: state.tabOrder,
    sidebarWidth: document.getElementById('sidebar').style.width || '',
    chatWidth: document.getElementById('chat-sidebar').style.width || '',
    sidebarHidden: document.getElementById('sidebar').classList.contains('hidden'),
    chatHidden: document.getElementById('chat-sidebar').classList.contains('hidden'),
  };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

function restoreLayout() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);

    // Restore collapsed projects
    if (data.collapsed) state.collapsed = data.collapsed;

    // Restore sidebar/chat widths
    if (data.sidebarWidth) document.getElementById('sidebar').style.width = data.sidebarWidth;
    if (data.chatWidth) document.getElementById('chat-sidebar').style.width = data.chatWidth;
    if (data.sidebarHidden) document.getElementById('sidebar').classList.add('hidden');
    if (data.chatHidden) document.getElementById('chat-sidebar').classList.add('hidden');

    // Restore open panels (terminals)
    if (data.openPanels) {
      for (const p of data.openPanels) {
        if (p.key === 'dashboard' || !p.src) continue;
        const parts = p.key.split('/');
        if (parts.length === 2) {
          // Extract terminal path from src
          const url = new URL(p.src, location.origin);
          openTerminal(parts[0], parts[0], parts[1], url.pathname);
        }
      }
    }

    // Restore tab order
    if (data.tabOrder) {
      state.tabOrder = data.tabOrder.filter(k => k === 'dashboard' || state.openPanels[k]);
    }

    // Restore active panel
    if (data.activePanel && (data.activePanel === 'dashboard' || state.openPanels[data.activePanel])) {
      switchTo(data.activePanel);
    }

    // Restore layout mode
    if (data.layout === 'grid') setLayout('grid');

    renderOpenTabs();
  } catch {}
}

// Save on resize end
['rh-left', 'rh-right'].forEach(id => {
  const handle = document.getElementById(id);
  handle?.addEventListener('mouseup', () => setTimeout(saveLayout, 100));
});

// ==================== Admin AI Terminal ====================
async function toggleCentralAI() {
  const dot = document.getElementById('central-dot');
  const toggle = document.getElementById('central-toggle');
  // Immediate visual feedback — show spinning state
  if (dot) dot.className = 'dot loading';
  if (toggle) { toggle.disabled = true; toggle.style.opacity = '0.5'; }
  try {
    const statusRes = await authFetch(`${API}/admin/status`);
    const status = await statusRes.json();
    if (status.enabled === false) {
      await authFetch(`${API}/admin/start`, { method: 'POST' });
    } else {
      await authFetch(`${API}/admin/stop`, { method: 'POST' });
      if (state.openPanels['central/ai']) closePanel('central/ai');
    }
    fetchAll();
  } catch (e) { console.error('[central-ai] toggle failed:', e); }
  if (toggle) { toggle.disabled = false; toggle.style.opacity = ''; }
}

function openCentralTerminal() {
  const key = 'central/ai';
  if (state.openPanels[key]) { switchTo(key); return; }
  // Immediate feedback — show loading spinner in dot
  const dot = document.getElementById('central-dot');
  if (dot) dot.className = 'dot loading';
  const btn = document.getElementById('central-btn');
  if (btn) btn.style.pointerEvents = 'none';
  authFetch(`${API}/admin/status`).then(r => r.json()).then(status => {
    if (btn) btn.style.pointerEvents = '';
    if (status.running && status.terminal) {
      openTerminal('central', 'Central AI', 'ai', status.terminal);
    } else {
      startAndOpenCentral();
    }
  }).catch(() => {
    if (btn) btn.style.pointerEvents = '';
    if (dot) dot.className = 'dot stopped';
  });
}

async function startAndOpenCentral() {
  const key = 'central/ai';
  const panel = document.createElement('div'); panel.className = 'panel'; panel.id = `panel-${key}`;
  panel.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;gap:12px;color:var(--text-faint)">
    <div style="font-size:24px" class="loading-spinner">&#9881;</div>
    <div>Starting Central AI...</div>
  </div>`;
  document.getElementById('panels').appendChild(panel);
  state.openPanels[key] = { panel, iframe: null, overlay: null, reconnectTimer: null, startPoll: null };
  if (!state.tabOrder.includes(key)) state.tabOrder.push(key);
  renderOpenTabs(); switchTo(key);

  try {
    const res = await authFetch(`${API}/admin/start`, { method: 'POST' });
    const data = await res.json();
    if (!data.ok) {
      panel.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--red)">Failed to start Central AI: ${esc(data.error || 'unknown')}</div>`;
      return;
    }
    // Poll for terminal readiness
    let retries = 0;
    const check = setInterval(async () => {
      retries++;
      try {
        const s = await (await authFetch(`${API}/admin/status`)).json();
        if (s.running && s.terminal) {
          clearInterval(check);
          const wasActive = state.activePanel === key;
          panel.remove();
          delete state.openPanels[key];
          state.tabOrder = state.tabOrder.filter(k => k !== key);
          if (wasActive) {
            openTerminal('central', 'Central AI', 'ai', s.terminal);
          } else {
            _openTerminalBackground('central', 'Central AI', 'ai', s.terminal);
          }
        }
      } catch {}
      if (retries > 30) {
        clearInterval(check);
        if (state.openPanels[key]) state.openPanels[key].startPoll = null;
        panel.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--red)">Timeout. Try refreshing.</div>`;
      }
    }, 2000);
    // Store polling interval so closePanel can clean it up
    if (state.openPanels[key]) state.openPanels[key].startPoll = check;
  } catch (e) {
    panel.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--red)">Error: ${esc(String(e))}</div>`;
  }
}

// ==================== Init ====================
(async () => {
  if (!AUTH_TOKEN) { location.href = '/login'; return; }
  try {
    const r = await fetch('/auth/validate', { headers: { 'Authorization': 'Bearer ' + AUTH_TOKEN } });
    const d = await r.json();
    if (!d.valid) { localStorage.removeItem('evomesh-token'); localStorage.removeItem('evomesh-user'); location.href = '/login'; return; }
    if (d.username) {
      localStorage.setItem('evomesh-user', JSON.stringify({username:d.username, role:d.role}));
      state.systemRole = d.role || 'user';
      const badge = document.getElementById('user-badge');
      if (badge) badge.textContent = d.username;
    }
  } catch { location.href = '/login'; return; }
  restoreLayout();
  fetchAll(); fetchMetrics();
  // Mobile: slower polling to prevent input lag from DOM rebuilds
  // Relaxed polling — server pushes updates via SSE refresh channel, polling is just a fallback
  const pollInterval = isMobile() ? 25000 : 20000;
  const metricsInterval = isMobile() ? 20000 : 10000;
  const pollTimerId = setInterval(fetchAll, pollInterval); const metricsTimerId = setInterval(fetchMetrics, metricsInterval);
  // Subscribe to refresh events from central AI operations
  try {
    const refreshEs = new EventSource(`${API}/refresh/subscribe?token=${encodeURIComponent(AUTH_TOKEN)}`);
    let _lastRefresh = 0;
    refreshEs.onmessage = () => {
      const now = Date.now();
      if (now - _lastRefresh < 5000) return; // Throttle: max once per 5s
      _lastRefresh = now;
      fetchAll();
    };
  } catch {}
  initFeed();
  initCompose();
})();
document.addEventListener('keydown', e => { if (e.ctrlKey && e.key>='1' && e.key<='9') { e.preventDefault(); const k = state.tabOrder[parseInt(e.key)-1]; if (k) switchTo(k); } });
window.addEventListener('beforeunload', saveLayout);
