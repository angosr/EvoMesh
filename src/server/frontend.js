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
  function tryInject() {
    attempts++;
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) { if (attempts < MAX_ATTEMPTS) setTimeout(tryInject, POLL_INTERVAL); return; }
      const xtermScreen = iframeDoc.querySelector('.xterm-screen');
      const xtermViewport = iframeDoc.querySelector('.xterm-viewport');
      if (!xtermScreen || !xtermViewport) { if (attempts < MAX_ATTEMPTS) setTimeout(tryInject, POLL_INTERVAL); return; }
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
    } catch { if (attempts < MAX_ATTEMPTS) setTimeout(tryInject, POLL_INTERVAL); }
  }
  iframe.addEventListener('load', () => { attempts = 0; tryInject(); });
  tryInject();
}
const state = {
  projects: [], accounts: [], openPanels: {}, activePanel: 'dashboard',
  layout: 'tabs', collapsed: {}, chatProject: null, tabOrder: ['dashboard'],
  systemRole: 'user', // 'admin' | 'user' — set from /auth/validate or localStorage
  membersOpen: null, // slug of project with members panel open
};
// Load cached user info
try { const u = JSON.parse(localStorage.getItem('evomesh-user') || '{}'); if (u.role) state.systemRole = u.role; } catch {}

// ==================== Data ====================
async function fetchAll() {
  try {
    const [projRes, acctRes] = await Promise.all([authFetch(`${API}/projects`), authFetch(`${API}/accounts`)]);
    // Auth failed — redirect to login
    if (projRes.status === 401) { localStorage.removeItem('evomesh-token'); location.href = '/login'; return; }
    const projData = await projRes.json();
    const acctData = await acctRes.json();
    state.accounts = acctData.accounts || [];
    const projects = [];
    for (const p of projData.projects) {
      try {
        const s = await (await authFetch(`${API}/projects/${p.slug}/status`)).json();
        projects.push({ ...p, roles: s.roles || [], accounts: s.accounts || {}, myRole: s.myRole || p.myRole || null });
      } catch { projects.push({ ...p, roles: [], accounts: {}, myRole: p.myRole || null }); }
    }
    state.projects = projects;
    if (!state.chatProject && projects.length > 0) state.chatProject = projects[0].slug;
    renderSidebar(); renderDashboard(); renderChatProjectSelect();
    // Update Central AI status dot
    try {
      const centralRes = await authFetch(`${API}/admin/status`);
      const centralData = await centralRes.json();
      const dot = document.getElementById('central-dot');
      if (dot) dot.className = `dot ${centralData.running ? 'running' : 'stopped'}`;
    } catch {}
    // Clean up tabs for roles that are no longer running
    // BUT don't close panels that are still starting (iframe is null = startAndOpenTerminal in progress)
    const activeTerminals = new Set();
    state.projects.forEach(p => p.roles.forEach(r => { if (r.terminal) activeTerminals.add(`${p.slug}/${r.name}`); }));
    for (const key of Object.keys(state.openPanels)) {
      if (key !== 'dashboard' && key !== 'settings' && key !== 'central/ai' && !activeTerminals.has(key)) {
        // Don't close if panel is still starting (iframe not yet created)
        if (!state.openPanels[key].iframe) continue;
        closePanel(key);
      }
    }
    renderOpenTabs();
  } catch { document.getElementById('status-bar').textContent = 'Connection error'; }
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
    const header = document.createElement('button'); header.className = 'project-header';
    header.innerHTML = `<span class="arrow ${isOpen?'open':''}">&#9654;</span><span>${esc(p.name)}</span><span class="pstats">${running}/${p.roles.length}</span>`;
    header.onclick = () => { state.collapsed[p.slug] = !state.collapsed[p.slug]; renderSidebar(); };
    group.appendChild(header);
    const rd = document.createElement('div'); rd.className = `project-roles ${isOpen?'':'collapsed'}`;
    for (const r of p.roles) {
      const btn = document.createElement('button'); const key = `${p.slug}/${r.name}`;
      btn.className = `role-btn ${state.activePanel===key?'active':''}`;
      const lw = r.needsLogin ? '<span class="login-warn">LOGIN</span>' : '';
      btn.innerHTML = `<span class="dot ${r.running?'running':'stopped'}"></span><span>${esc(r.name)}</span>${lw}`;
      btn.onclick = () => openTerminal(p.slug, p.name, r.name, r.terminal);
      rd.appendChild(btn);
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

// ==================== Dashboard ====================
function renderDashboard() {
  const el = document.getElementById('dash-content');
  if (!state.projects.length) { el.innerHTML = '<div class="card"><p style="color:#888">No projects yet.</p></div>'; return; }
  const ao = state.accounts.map(a => `<option value="${esc(a.name)}" data-path="${esc(a.path)}">${esc(a.name)} (${esc(a.path)})${a.needsLogin?' (login)':''}</option>`).join('');
  let html = '';
  for (const p of state.projects) {
    const isOwner = p.myRole === 'owner';
    const rows = p.roles.map(r => {
      const statusBadge = `<span class="badge ${r.running?'running':'stopped'}">${r.running?'running':'stopped'}</span>`;
      const loginBadge = r.needsLogin ? ' <span class="badge login-needed">login</span>' : '';
      const acctCol = isOwner ? `<select class="acct-select" data-slug="${esc(p.slug)}" data-role="${esc(r.name)}">${ao}</select>` : `<span style="color:#666">${esc(r.account)}</span>`;
      const resCol = isOwner ? `<input class="res-input" data-slug="${esc(p.slug)}" data-role="${esc(r.name)}" data-field="memory" value="${esc(r.memory||'')}" placeholder="mem" title="Memory (e.g. 2g, 512m)"><input class="res-input" data-slug="${esc(p.slug)}" data-role="${esc(r.name)}" data-field="cpus" value="${esc(r.cpus||'')}" placeholder="cpu" title="CPUs (e.g. 1.5, 2)">` : '';
      const actCol = isOwner ? `<button class="dash-action" data-action="restart" data-slug="${esc(p.slug)}" data-role="${esc(r.name)}">${r.running ? '↻ Restart' : '▶ Start'}</button>` : '';
      return `<tr>
        <td><strong>${esc(r.name)}</strong> <span class="badge ${esc(r.type)}">${esc(r.type)}</span></td>
        <td>${statusBadge}${loginBadge}</td>
        <td>${acctCol}</td>
        <td>${resCol}</td>
        <td>${actCol}</td>
      </tr>`;
    }).join('');
    const roleLabel = isOwner ? `${esc(p.name)}` : `${esc(p.name)} <span class="badge" style="font-size:10px;background:#1e1b4b;color:#818cf8">${esc(p.myRole||'')}</span>`;
    const membersBtn = isOwner ? ` <button class="dash-action" data-action="members" data-slug="${esc(p.slug)}" style="float:right;font-size:11px">Members</button>` : '';
    const membersOpen = state.membersOpen === p.slug;
    const membersPanel = membersOpen ? `<div class="members-panel" id="members-${esc(p.slug)}"><div style="color:#888;font-size:12px">Loading...</div></div>` : '';
    html += `<div class="card"><h3>${roleLabel}${membersBtn}</h3><table><tr><th>Role</th><th>Status</th><th>Account</th><th>Resources</th><th>Actions</th></tr>${rows}</table>${membersPanel}</div>`;
    setTimeout(() => { for (const r of p.roles) { const s = document.querySelector(`select[data-slug="${p.slug}"][data-role="${r.name}"]`); if (s) s.value = r.account; } }, 0);
  }
  el.innerHTML = html;
  // Delegated event listeners for dashboard actions (avoids inline onclick XSS risk)
  el.querySelectorAll('.acct-select').forEach(sel => {
    sel.addEventListener('change', () => switchAccount(sel.dataset.slug, sel.dataset.role, sel));
  });
  el.querySelectorAll('.dash-action[data-action="restart"]').forEach(btn => {
    btn.addEventListener('click', () => withLoading(btn, () => saveAndRestart(btn.dataset.slug, btn.dataset.role)));
  });
  el.querySelectorAll('.dash-action[data-action="members"]').forEach(btn => {
    btn.addEventListener('click', () => toggleMembers(btn.dataset.slug));
  });
  // If members panel is open, load its data
  if (state.membersOpen) loadMembers(state.membersOpen);
}

// ==================== Members Panel ====================
function toggleMembers(slug) {
  state.membersOpen = state.membersOpen === slug ? null : slug;
  renderDashboard();
}

async function loadMembers(slug) {
  const panel = document.getElementById(`members-${slug}`);
  if (!panel) return;
  try {
    const res = await authFetch(`${API}/projects/${slug}/members`);
    const data = await res.json();
    let html = `<div style="margin-bottom:8px"><strong>Owner:</strong> ${esc(data.owner)}</div>`;
    if (data.members.length) {
      html += '<table class="members-table"><tr><th>User</th><th>Role</th><th></th></tr>';
      for (const m of data.members) {
        html += `<tr><td>${esc(m.username)}</td><td><span class="badge" style="font-size:10px">${esc(m.role)}</span></td><td><button class="dash-action danger" data-action="remove-member" data-slug="${esc(slug)}" data-username="${esc(m.username)}" style="font-size:10px;padding:2px 6px">Remove</button></td></tr>`;
      }
      html += '</table>';
    } else {
      html += '<div style="color:#666;font-size:12px">No members yet.</div>';
    }
    html += `<div style="margin-top:8px;display:flex;gap:6px;align-items:center">
      <input id="member-user-${esc(slug)}" placeholder="username" style="background:#1a1a2e;border:1px solid #333;color:#eee;padding:4px 8px;border-radius:4px;font-size:12px;width:120px">
      <select id="member-role-${esc(slug)}" style="background:#1a1a2e;border:1px solid #333;color:#eee;padding:4px 8px;border-radius:4px;font-size:12px"><option value="member">member</option><option value="viewer">viewer</option></select>
      <button class="dash-action" data-action="add-member" data-slug="${esc(slug)}" style="font-size:11px">Add</button>
    </div>`;
    panel.innerHTML = html;
    panel.querySelectorAll('[data-action="remove-member"]').forEach(btn => {
      btn.addEventListener('click', () => removeMember(btn.dataset.slug, btn.dataset.username));
    });
    const addBtn = panel.querySelector('[data-action="add-member"]');
    if (addBtn) addBtn.addEventListener('click', () => addMember(addBtn.dataset.slug));
  } catch { panel.innerHTML = '<div style="color:#f87171;font-size:12px">Failed to load members</div>'; }
}

async function addMember(slug) {
  const userInput = document.getElementById(`member-user-${slug}`);
  const roleSelect = document.getElementById(`member-role-${slug}`);
  if (!userInput || !roleSelect) return;
  const username = userInput.value.trim();
  const role = roleSelect.value;
  if (!username) return;
  try {
    const res = await authFetch(`${API}/projects/${slug}/members`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, role }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Failed'); return; }
    loadMembers(slug);
  } catch { alert('Connection error'); }
}

async function removeMember(slug, username) {
  try {
    const res = await authFetch(`${API}/projects/${slug}/members/${encodeURIComponent(username)}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Failed'); return; }
    loadMembers(slug);
  } catch { alert('Connection error'); }
}

// Panels moved to frontend-panels.js

// ==================== Toggle sidebars ====================
function isMobile() { return window.innerWidth <= 768; }

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const overlay = document.getElementById('mobile-overlay');
  if (isMobile()) {
    const isOpen = sb.classList.contains('mobile-open');
    sb.classList.toggle('mobile-open');
    document.getElementById('chat-sidebar').classList.remove('mobile-open');
    overlay.classList.toggle('show', !isOpen);
  } else {
    sb.classList.toggle('hidden');
  }
}

function toggleChat() {
  const chat = document.getElementById('chat-sidebar');
  const overlay = document.getElementById('mobile-overlay');
  if (isMobile()) {
    const isOpen = chat.classList.contains('mobile-open');
    chat.classList.toggle('mobile-open');
    document.getElementById('sidebar').classList.remove('mobile-open');
    overlay.classList.toggle('show', !isOpen);
  } else {
    chat.classList.toggle('hidden');
  }
}

function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('evomesh-user') || '{}'); } catch { return {}; }
}

function doLogout() {
  localStorage.removeItem('evomesh-token');
  localStorage.removeItem('evomesh-user');
  location.href = '/login';
}


// Settings moved to frontend-settings.js


function closeMobileOverlay() {
  document.getElementById('sidebar').classList.remove('mobile-open');
  document.getElementById('chat-sidebar').classList.remove('mobile-open');
  document.getElementById('mobile-overlay').classList.remove('show');
}

// ==================== Swipe-to-close for mobile panels ====================
(function() {
  const SWIPE_THRESHOLD = 60;
  function addSwipeClose(el, direction) {
    let startX = 0, startY = 0, tracking = false;
    el.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
    }, { passive: true });
    el.addEventListener('touchmove', e => {
      if (!tracking || e.touches.length !== 1) return;
      // Cancel if vertical scroll dominates
      if (Math.abs(e.touches[0].clientY - startY) > Math.abs(e.touches[0].clientX - startX)) { tracking = false; }
    }, { passive: true });
    el.addEventListener('touchend', e => {
      if (!tracking) return;
      tracking = false;
      const endX = e.changedTouches[0].clientX;
      const dx = endX - startX;
      // direction: 'left' = swipe left to close, 'right' = swipe right to close
      if (direction === 'left' && dx < -SWIPE_THRESHOLD) closeMobileOverlay();
      if (direction === 'right' && dx > SWIPE_THRESHOLD) closeMobileOverlay();
    });
  }
  const sidebar = document.getElementById('sidebar');
  const chat = document.getElementById('chat-sidebar');
  if (sidebar) addSwipeClose(sidebar, 'left');
  if (chat) addSwipeClose(chat, 'right');
})();

// ==================== Resize handles ====================
function initResize(handleId, target, side) {
  const handle = document.getElementById(handleId);
  const el = document.getElementById(target);
  if (!handle || !el) return;
  let startX, startW;

  function onStart(x) {
    handle.classList.add('active');
    startX = x; startW = el.offsetWidth;
    document.querySelectorAll('iframe').forEach(f => f.style.pointerEvents = 'none');
    document.body.style.cursor = 'col-resize';
  }
  function onMove(x) {
    const dx = side === 'left' ? x - startX : startX - x;
    el.style.width = Math.max(180, startW + dx) + 'px';
  }
  function onEnd() {
    handle.classList.remove('active');
    document.querySelectorAll('iframe').forEach(f => f.style.pointerEvents = '');
    document.body.style.cursor = '';
  }

  // Mouse
  handle.addEventListener('mousedown', e => {
    e.preventDefault(); onStart(e.clientX);
    const mm = ev => onMove(ev.clientX);
    const mu = () => { onEnd(); document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); };
    document.addEventListener('mousemove', mm);
    document.addEventListener('mouseup', mu);
  });

  // Touch
  handle.addEventListener('touchstart', e => {
    e.preventDefault(); onStart(e.touches[0].clientX);
    const tm = ev => { ev.preventDefault(); onMove(ev.touches[0].clientX); };
    const te = () => { onEnd(); document.removeEventListener('touchmove', tm); document.removeEventListener('touchend', te); };
    document.addEventListener('touchmove', tm, { passive: false });
    document.addEventListener('touchend', te);
  }, { passive: false });
}
initResize('rh-left', 'sidebar', 'left');
initResize('rh-right', 'chat-sidebar', 'right');

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

// ==================== Account / Role management ====================
async function switchAccount(slug, roleName, sel) {
  const an = sel.value, opt = sel.selectedOptions[0];
  if (!confirm(`Switch ${roleName} to "${an}"?`)) { fetchAll(); return; }
  try { const r = await authFetch(`${API}/projects/${slug}/roles/${roleName}/account`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({accountName:an,accountPath:opt?.dataset?.path}) }); const d = await r.json(); if (d.ok) { addFeedMessage(`Account: <strong>${esc(roleName)}</strong> -> ${esc(an)}${d.restarted?' (restarting)':''}`, 'system'); closePanel(`${slug}/${roleName}`); setTimeout(fetchAll, 5000); } } catch { addFeedMessage('Failed', 'system'); }
}
async function saveAndRestart(slug, roleName) {
  const memInput = document.querySelector(`.res-input[data-slug="${slug}"][data-role="${roleName}"][data-field="memory"]`);
  const cpuInput = document.querySelector(`.res-input[data-slug="${slug}"][data-role="${roleName}"][data-field="cpus"]`);
  const memory = memInput?.value?.trim() || null;
  const cpus = cpuInput?.value?.trim() || null;

  // Save config first
  try {
    await authFetch(`${API}/projects/${slug}/roles/${roleName}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memory, cpus }),
    });
  } catch {}

  // Then restart
  await restartRole(slug, roleName);
}

async function restartRole(slug, roleName) {
  if (!confirm(`Restart "${roleName}"? Session will reconnect automatically.`)) return;
  try { addFeedMessage(`Restarting <strong>${esc(roleName)}</strong>...`, 'system'); const r = await authFetch(`${API}/projects/${slug}/roles/${roleName}/restart`, {method:'POST'}); const d = await r.json(); if (d.ok) { addFeedMessage(`<strong>${esc(roleName)}</strong> restarting`, 'system'); closePanel(`${slug}/${roleName}`); setTimeout(fetchAll, 5000); } } catch { addFeedMessage('Failed', 'system'); }
}

// ==================== Chat / Feed ====================
let lastRoleStates = {}, serverConnected = true;
function addFeedMessage(html, cls='status') { console.log(`[${cls}] ${html.replace(/<[^>]*>/g,'')}`); }
function renderChatProjectSelect() { /* removed — admin terminal replaces chat */ }
function startSSEFeed() { /* removed — admin terminal replaces status feed */ }

// ==================== Metrics ====================
async function fetchMetrics() { try { const r = await authFetch(`${API}/metrics`); const d = await r.json(); updateMetric('cpu',d.cpu.percent,`${d.cpu.percent}%`); updateMetric('mem',d.memory.percent,`${d.memory.percent}%`); updateMetric('disk',d.disk.percent,`${d.disk.percent}%`); setConnStatus(true); } catch { setConnStatus(false); } }
function updateMetric(id, pct, label) { const bar = document.getElementById(`m-${id}2`), val = document.getElementById(`m-${id}-val2`); if (!bar||!val) return; bar.style.width = pct+'%'; bar.className = 'metric-bar-fill '+(pct>90?'crit':pct>70?'warn':'ok'); val.textContent = label; }
function setConnStatus(connected) { if (connected && !serverConnected) { for (const [key] of Object.entries(state.openPanels)) { reconnectPanel(key); } } serverConnected = connected; for (const id of ['conn-dot','conn-dot2']) { const dot = document.getElementById(id); if (dot) { dot.className = 'conn-dot '+(connected?'connected':'disconnected'); dot.title = connected?'Connected':'Disconnected'; } } }

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






// Terminal scroll + copy moved to frontend-panels.js

// ==================== Admin AI Terminal ====================
function openCentralTerminal() {
  const key = 'central/ai';
  if (state.openPanels[key]) { switchTo(key); return; }
  authFetch(`${API}/admin/status`).then(r => r.json()).then(status => {
    if (status.running && status.terminal) {
      openTerminal('central', 'Central AI', 'ai', status.terminal);
    } else {
      startAndOpenCentral();
    }
  }).catch(() => alert('Failed to check Central AI status'));
}

async function startAndOpenCentral() {
  const key = 'central/ai';
  const panel = document.createElement('div'); panel.className = 'panel'; panel.id = `panel-${key}`;
  panel.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;gap:12px;color:#888">
    <div style="font-size:24px" class="loading-spinner">&#9881;</div>
    <div>Starting Central AI...</div>
  </div>`;
  document.getElementById('panels').appendChild(panel);
  state.openPanels[key] = { panel, iframe: null, overlay: null, reconnectTimer: null };
  if (!state.tabOrder.includes(key)) state.tabOrder.push(key);
  renderOpenTabs(); switchTo(key);

  try {
    const res = await authFetch(`${API}/admin/start`, { method: 'POST' });
    const data = await res.json();
    if (!data.ok) {
      panel.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ef4444">Failed to start Central AI: ${esc(data.error || 'unknown')}</div>`;
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
          panel.remove();
          delete state.openPanels[key];
          state.tabOrder = state.tabOrder.filter(k => k !== key);
          openTerminal('central', 'Central AI', 'ai', s.terminal);
        }
      } catch {}
      if (retries > 30) {
        clearInterval(check);
        panel.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ef4444">Timeout. Try refreshing.</div>`;
      }
    }, 2000);
  } catch (e) {
    panel.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ef4444">Error: ${esc(String(e))}</div>`;
  }
}

// ==================== Mission Control ====================
function initMissionControl() {
  // Tab switching
  document.querySelectorAll('.mc-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.mc-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.mc-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = document.getElementById(`mc-${tab.dataset.mcTab}`);
      if (panel) panel.classList.add('active');
      // Hide bottom quick-input when Central AI tab is active (it has its own input)
      const mcCmd = document.getElementById('mc-command');
      if (mcCmd) mcCmd.style.display = tab.dataset.mcTab === 'central' ? 'none' : '';
    });
  });

  // Start polling
  refreshMissionControl();
  setInterval(refreshMissionControl, 5000);

  // Central AI status (less frequent)
  refreshCentralStatus();
  setInterval(refreshCentralStatus, 10000);

  // Try to start central AI if not running
  authFetch(`${API}/admin/status`).then(r => r.json()).then(s => {
    if (!s.running) authFetch(`${API}/admin/start`, { method: 'POST' }).catch(() => {});
  }).catch(() => {});
}

async function refreshMissionControl() {
  try {
    const res = await authFetch(`${API}/mission-control`);
    if (!res.ok) {
      // API not implemented yet — build from existing data
      renderMCFromState();
      return;
    }
    const data = await res.json();
    if (data.activity) renderMCActivity(data.activity);
    if (data.issues) renderMCIssues(data.issues);
    if (data.tasks) renderMCTasks(data.tasks);
  } catch {
    // Fallback: build from existing project/role state
    renderMCFromState();
  }
}

// Fallback: build activity/issues from existing fetchAll data
function renderMCFromState() {
  const feed = document.getElementById('mc-activity-feed');
  const empty = document.getElementById('mc-activity-empty');
  if (!feed) return;

  const items = [];
  const seen = new Set();
  for (const p of state.projects) {
    for (const r of p.roles) {
      const key = `${p.slug}/${r.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        project: p.name,
        role: r.name,
        type: r.type || 'worker',
        running: r.running,
        needsLogin: r.needsLogin,
      });
    }
  }

  if (!items.length) {
    feed.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }

  if (empty) empty.style.display = 'none';
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;

  feed.innerHTML = items.map(it => {
    const roleClass = it.type === 'lead' ? ' lead' : '';
    const status = it.needsLogin ? '<span style="color:var(--red)">needs login</span>'
      : it.running ? '<span style="color:var(--green)">running</span>'
      : '<span style="color:var(--text-faint)">stopped</span>';
    return `<div class="mc-activity-item">
      <span class="mc-time">${esc(timeStr)}</span>
      <span class="mc-project">${esc(it.project)}</span>
      <span class="mc-role${roleClass}">${esc(it.role)}</span>
      <span class="mc-status">${status}</span>
    </div>`;
  }).join('');

  // Build issues from state (login-needed, stopped roles)
  const issuesList = document.getElementById('mc-issues-list');
  const issuesEmpty = document.getElementById('mc-issues-empty');
  if (!issuesList) return;

  const issues = [];
  for (const p of state.projects) {
    for (const r of p.roles) {
      if (r.needsLogin) issues.push({ priority: 'p0', title: `${r.name} needs login`, meta: p.name, slug: p.slug, role: r.name });
      else if (!r.running) issues.push({ priority: 'p1', title: `${r.name} stopped`, meta: p.name, slug: p.slug, role: r.name });
    }
  }

  if (!issues.length) {
    issuesList.innerHTML = '';
    if (issuesEmpty) issuesEmpty.style.display = '';
  } else {
    if (issuesEmpty) issuesEmpty.style.display = 'none';
    issuesList.innerHTML = issues.map(is => `<div class="mc-issue ${esc(is.priority)}">
      <div class="mc-issue-title">${esc(is.title)}</div>
      <div class="mc-issue-meta">${esc(is.meta)}</div>
      <div class="mc-issue-actions">
        <button data-action="mc-restart" data-slug="${esc(is.slug)}" data-role="${esc(is.role)}">Restart</button>
        <button data-action="mc-open" data-slug="${esc(is.slug)}" data-role="${esc(is.role)}">Open</button>
      </div>
    </div>`).join('');
    issuesList.querySelectorAll('[data-action="mc-restart"]').forEach(btn => {
      btn.addEventListener('click', () => withLoading(btn, () => restartRole(btn.dataset.slug, btn.dataset.role)));
    });
    issuesList.querySelectorAll('[data-action="mc-open"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = state.projects.find(proj => proj.slug === btn.dataset.slug);
        if (p) {
          const r = p.roles.find(role => role.name === btn.dataset.role);
          openTerminal(btn.dataset.slug, p.name, btn.dataset.role, r?.terminal);
        }
      });
    });
  }

  // Tasks: show placeholder until API exists
  const tasksList = document.getElementById('mc-tasks-list');
  const tasksEmpty = document.getElementById('mc-tasks-empty');
  if (tasksList && tasksEmpty) {
    tasksList.innerHTML = '';
    tasksEmpty.style.display = '';
    tasksEmpty.textContent = 'Waiting for /api/mission-control endpoint...';
  }
}

function renderMCActivity(activity) {
  const feed = document.getElementById('mc-activity-feed');
  const empty = document.getElementById('mc-activity-empty');
  if (!feed) return;
  if (!activity.length) { feed.innerHTML = ''; if (empty) empty.style.display = ''; return; }
  if (empty) empty.style.display = 'none';
  // Sort by time descending (newest first)
  const sorted = [...activity].sort((a, b) => (b.time || '').localeCompare(a.time || ''));
  feed.innerHTML = sorted.map(a => {
    const roleClass = a.type === 'lead' ? ' lead' : '';
    return `<div class="mc-activity-item">
      <span class="mc-time">${esc(a.time || '')}</span>
      <span class="mc-project">${esc(a.project || '')}</span>
      <span class="mc-role${roleClass}">${esc(a.role || '')}</span>
      <span class="mc-status">${esc(a.status || '')}</span>
    </div>`;
  }).join('');
}

function renderMCIssues(issues) {
  const list = document.getElementById('mc-issues-list');
  const empty = document.getElementById('mc-issues-empty');
  if (!list) return;
  if (!issues.length) { list.innerHTML = ''; if (empty) empty.style.display = ''; return; }
  if (empty) empty.style.display = 'none';
  // Map issue type to CSS class: stopped→p0 (red), stale→p1 (yellow), p0-pending→p0
  const typeToClass = { stopped: 'p0', stale: 'p1', 'p0-pending': 'p0' };
  const typeLabel = { stopped: 'STOPPED', stale: 'STALE', 'p0-pending': 'P0' };
  list.innerHTML = issues.map(is => {
    const cls = typeToClass[is.type] || is.priority || 'p2';
    const badge = typeLabel[is.type] || is.type || '';
    return `<div class="mc-issue ${esc(cls)}">
      <span class="mc-issue-badge">${esc(badge)}</span>
      <div class="mc-issue-title">${esc(is.title || '')}</div>
      <div class="mc-issue-meta">${esc(is.meta || '')}</div>
    </div>`;
  }).join('');
}

function renderMCTasks(tasks) {
  const list = document.getElementById('mc-tasks-list');
  const empty = document.getElementById('mc-tasks-empty');
  if (!list) return;
  if (!tasks.length) { list.innerHTML = ''; if (empty) empty.style.display = ''; return; }
  if (empty) empty.style.display = 'none';
  // Sort by priority: P0 → P1 → P2
  const prioOrder = { p0: 0, p1: 1, p2: 2 };
  const sorted = [...tasks].sort((a, b) => (prioOrder[a.priority] ?? 9) - (prioOrder[b.priority] ?? 9));
  list.innerHTML = sorted.map(t => `<div class="mc-task">
    <span class="mc-task-priority ${esc(t.priority || 'p2')}">${esc((t.priority || 'P2').toUpperCase())}</span>
    <div>
      <div class="mc-task-text">${esc(t.text || '')}</div>
      <div class="mc-task-role">${esc(t.role || '')} · ${esc(t.project || '')}</div>
    </div>
  </div>`).join('');
}

function simpleMarkdown(md) {
  return md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^\| (.+)/gm, (_, row) => {
      const cells = row.split('|').map(c => c.trim()).filter(Boolean);
      return '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
    })
    .replace(/^\|[-| ]+\|?$/gm, '')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    .replace(/(<tr>.*<\/tr>\n?)+/g, m => `<table class="mc-table">${m}</table>`)
    .replace(/\n{2,}/g, '<br>');
}

async function refreshCentralStatus() {
  const el = document.getElementById('central-status');
  if (!el) return;
  try {
    const res = await authFetch(`${API}/admin/central-status`);
    if (res.ok) {
      const text = await res.text();
      el.innerHTML = text ? simpleMarkdown(text) : '<em>Central AI running. Waiting for first status update...</em>';
    }
  } catch { el.innerHTML = '<em>Central AI offline</em>'; }
}

function addCentralMessage(html, cls) {
  const feed = document.getElementById('central-feed');
  if (!feed) return;
  const div = document.createElement('div');
  div.className = `feed-msg ${cls || 'status'}`;
  div.innerHTML = html;
  feed.appendChild(div);
  feed.scrollTop = feed.scrollHeight;
  while (feed.children.length > 100) feed.removeChild(feed.firstChild);
}

async function sendToCentral() {
  const input = document.getElementById('central-input');
  const text = input?.value?.trim();
  if (!text) return;
  const btn = document.getElementById('central-send');
  if (btn) { btn.disabled = true; btn.textContent = '...'; }
  addCentralMessage(`<strong style="color:var(--accent)">You</strong> ${esc(text)}`, 'user');
  input.value = '';
  try {
    const res = await authFetch(`${API}/admin/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });
    const data = await res.json();
    if (data.ok) {
      addCentralMessage(`<span style="color:var(--green)">&#10003; Sent to Central AI inbox. It will process on next loop.</span>`, 'system');
    } else {
      addCentralMessage(`<span style="color:var(--red)">Error: ${esc(data.error)}</span>`, 'system');
    }
  } catch { addCentralMessage(`<span style="color:var(--red)">Failed to send</span>`, 'system'); }
  if (btn) { btn.disabled = false; btn.textContent = 'Send'; }
  input.focus();
}

function quickSendToCentral() {
  const input = document.getElementById('mc-quick-input');
  const text = input?.value?.trim();
  if (!text) return;
  input.value = '';
  // Switch to Central AI tab and send from there
  document.querySelectorAll('.mc-tab').forEach(t => t.classList.toggle('active', t.dataset.mcTab === 'central'));
  document.querySelectorAll('.mc-panel').forEach(p => p.classList.toggle('active', p.id === 'mc-central'));
  document.getElementById('mc-command').style.display = 'none';
  const centralInput = document.getElementById('central-input');
  if (centralInput) { centralInput.value = text; sendToCentral(); }
}

// Enter to send
document.getElementById('central-input')?.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendToCentral(); }
});

// ==================== Init ====================
(async () => {
  if (!AUTH_TOKEN) { location.href = '/login'; return; }
  try {
    const r = await fetch('/auth/validate', { headers: { 'Authorization': 'Bearer ' + AUTH_TOKEN } });
    const d = await r.json();
    if (!d.valid) { localStorage.removeItem('evomesh-token'); localStorage.removeItem('evomesh-user'); location.href = '/login'; return; }
    if (d.username) { localStorage.setItem('evomesh-user', JSON.stringify({username:d.username, role:d.role})); state.systemRole = d.role || 'user'; }
  } catch { location.href = '/login'; return; }
  restoreLayout();
  fetchAll(); fetchMetrics(); setInterval(fetchAll, 8000); setInterval(fetchMetrics, 5000); startSSEFeed();
  // Subscribe to refresh events from central AI operations
  try {
    const refreshEs = new EventSource(`${API}/refresh/subscribe?token=${encodeURIComponent(AUTH_TOKEN)}`);
    refreshEs.onmessage = () => { fetchAll(); };
  } catch {}
  initMissionControl();
})();
document.addEventListener('keydown', e => { if (e.ctrlKey && e.key>='1' && e.key<='9') { e.preventDefault(); const k = state.tabOrder[parseInt(e.key)-1]; if (k) switchTo(k); } });
window.addEventListener('beforeunload', saveLayout);
