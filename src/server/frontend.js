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
    if (p.myRole === 'owner') {
      const ab = document.createElement('button'); ab.className = 'add-role-btn'; ab.textContent = '+ Add Role';
      ab.onclick = () => showRoleModal(p.slug); rd.appendChild(ab);
    }
    group.appendChild(rd); tree.appendChild(group);
  }
  // Hide "Add Project" button for viewers (only admin/user can create)
  const addBtn = document.getElementById('add-project-btn');
  if (addBtn) addBtn.style.display = (state.systemRole === 'admin' || state.systemRole === 'user') ? '' : 'none';
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
      const actCol = isOwner ? `<button class="dash-action" data-action="restart" data-slug="${esc(p.slug)}" data-role="${esc(r.name)}">${r.running ? '↻ Restart' : '▶ Start'}</button><button class="dash-action danger" data-action="delete" data-slug="${esc(p.slug)}" data-role="${esc(r.name)}">Delete</button>` : '';
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
    btn.addEventListener('click', () => saveAndRestart(btn.dataset.slug, btn.dataset.role));
  });
  el.querySelectorAll('.dash-action[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => deleteRole(btn.dataset.slug, btn.dataset.role));
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
  restartRole(slug, roleName);
}

async function restartRole(slug, roleName) {
  if (!confirm(`Restart "${roleName}"? Session will reconnect automatically.`)) return;
  try { addFeedMessage(`Restarting <strong>${esc(roleName)}</strong>...`, 'system'); const r = await authFetch(`${API}/projects/${slug}/roles/${roleName}/restart`, {method:'POST'}); const d = await r.json(); if (d.ok) { addFeedMessage(`<strong>${esc(roleName)}</strong> restarting`, 'system'); closePanel(`${slug}/${roleName}`); setTimeout(fetchAll, 5000); } } catch { addFeedMessage('Failed', 'system'); }
}
async function deleteRole(slug, roleName) {
  if (!confirm(`Delete "${roleName}"?`)) return;
  try { const r = await authFetch(`${API}/projects/${slug}/roles/${roleName}`, {method:'DELETE'}); const d = await r.json(); if (d.ok) { addFeedMessage(`<strong>${esc(roleName)}</strong> deleted`, 'system'); closePanel(`${slug}/${roleName}`); fetchAll(); } } catch { alert('Failed'); }
}
function showRoleModal(slug) { document.getElementById('rm-slug').value = slug; document.getElementById('rm-name').value = ''; const s = document.getElementById('rm-account'); s.innerHTML = state.accounts.map(a => `<option value="${esc(a.name)}">${esc(a.name)}</option>`).join(''); document.getElementById('role-modal-overlay').classList.add('show'); document.getElementById('rm-name').focus(); }
function closeRoleModal() { document.getElementById('role-modal-overlay').classList.remove('show'); }
async function doCreateRole() { const slug = document.getElementById('rm-slug').value, name = document.getElementById('rm-name').value.trim(), template = document.getElementById('rm-template').value, account = document.getElementById('rm-account').value; if (!name) return; try { const r = await authFetch(`${API}/projects/${slug}/roles`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,template,account})}); const d = await r.json(); if (d.ok) { addFeedMessage(`Role <strong>${esc(name)}</strong> created`, 'system'); closeRoleModal(); fetchAll(); } else alert(d.error); } catch { alert('Failed'); } }
document.getElementById('rm-name').addEventListener('keydown', e => { if (e.key==='Enter') doCreateRole(); if (e.key==='Escape') closeRoleModal(); });

// ==================== Add project ====================
function showAddForm() { document.getElementById('add-project-btn').style.display = 'none'; document.getElementById('add-form').style.display = 'block'; document.getElementById('add-input').focus(); }
function hideAddForm() { document.getElementById('add-project-btn').style.display = 'block'; document.getElementById('add-form').style.display = 'none'; document.getElementById('add-input').value = ''; }
async function doAddProject() { const input = document.getElementById('add-input').value.trim(); if (!input) return; const lang = document.getElementById('add-lang').value; const body = input.startsWith('http')||input.startsWith('git@') ? {url:input,lang} : {path:input,lang}; try { addFeedMessage(`Adding: ${esc(input)} (${lang})...`, 'system'); const r = await authFetch(`${API}/projects/add`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); const d = await r.json(); if (d.ok) { addFeedMessage(`<strong>${esc(d.project.name)}</strong> added`, 'system'); hideAddForm(); setTimeout(fetchAll, 3000); } else addFeedMessage(`Error: ${d.error}`, 'system'); } catch { addFeedMessage('Failed', 'system'); } }

// Path autocomplete
let acTimer = null, acIndex = -1;
const addInput = document.getElementById('add-input'), acBox = document.getElementById('autocomplete');
addInput.addEventListener('input', () => { clearTimeout(acTimer); const v = addInput.value.trim(); if (!v||v.startsWith('http')||v.startsWith('git@')) { acBox.classList.remove('show'); return; } acTimer = setTimeout(() => fetchCompletions(v), 150); });
addInput.addEventListener('keydown', e => {
  const items = acBox.querySelectorAll('.ac-item');
  if (e.key==='ArrowDown' && acBox.classList.contains('show')) { e.preventDefault(); acIndex = Math.min(acIndex+1, items.length-1); items.forEach((el,i) => el.classList.toggle('selected', i===acIndex)); }
  else if (e.key==='ArrowUp' && acBox.classList.contains('show')) { e.preventDefault(); acIndex = Math.max(acIndex-1, 0); items.forEach((el,i) => el.classList.toggle('selected', i===acIndex)); }
  else if ((e.key==='Tab'||e.key==='Enter') && acBox.classList.contains('show') && items.length>0) { e.preventDefault(); const sel = acIndex>=0?items[acIndex]:items[0]; addInput.value = sel.dataset.path; acBox.classList.remove('show'); acIndex=-1; clearTimeout(acTimer); acTimer = setTimeout(() => fetchCompletions(addInput.value), 150); }
  else if (e.key==='Enter') { acBox.classList.remove('show'); doAddProject(); }
  else if (e.key==='Escape') { if (acBox.classList.contains('show')) acBox.classList.remove('show'); else hideAddForm(); }
});
addInput.addEventListener('blur', () => setTimeout(() => acBox.classList.remove('show'), 200));
async function fetchCompletions(q) { try { const r = await authFetch(`${API}/complete-path?q=${encodeURIComponent(q)}`); const d = await r.json(); if (!d.suggestions.length) { acBox.classList.remove('show'); return; } acBox.innerHTML = d.suggestions.map(s => `<div class="ac-item" data-path="${esc(s.path)}"><span>${esc(s.path)}</span>${s.hasEvomesh?'<span class="ac-badge">evomesh</span>':''}</div>`).join(''); acBox.querySelectorAll('.ac-item').forEach(item => { item.addEventListener('mousedown', e => { e.preventDefault(); selectCompletion(item.dataset.path); }); }); acBox.classList.add('show'); acIndex=-1; } catch { acBox.classList.remove('show'); } }
function selectCompletion(p) { addInput.value = p; acBox.classList.remove('show'); acIndex=-1; addInput.focus(); clearTimeout(acTimer); acTimer = setTimeout(() => fetchCompletions(p), 150); }

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

// ==================== Central AI Panel ====================
async function initCentralPanel() {
  // Start central AI container if not running
  try {
    const status = await (await authFetch(`${API}/admin/status`)).json();
    if (!status.running) {
      await authFetch(`${API}/admin/start`, { method: 'POST' });
    }
  } catch {}
  // Load initial status
  refreshCentralStatus();
  setInterval(refreshCentralStatus, 10000);
}

async function refreshCentralStatus() {
  const el = document.getElementById('central-status');
  if (!el) return;
  try {
    // Read central-status.md via a simple API
    const res = await authFetch(`${API}/admin/central-status`);
    if (res.ok) {
      const text = await res.text();
      el.textContent = text || 'Central AI running. Waiting for first status update...';
    }
  } catch { el.textContent = 'Central AI offline'; }
}

function addCentralMessage(html, cls) {
  const feed = document.getElementById('central-feed');
  if (!feed) return;
  const div = document.createElement('div');
  div.style.cssText = `padding:5px 7px;border-radius:5px;font-size:11px;line-height:1.4;background:${cls==='user'?'#1a1a2e':'#111'};border:1px solid #222;${cls==='user'?'margin-left:20px':''}`;
  div.innerHTML = html;
  feed.appendChild(div);
  feed.scrollTop = feed.scrollHeight;
  while (feed.children.length > 100) feed.removeChild(feed.firstChild);
}

async function sendToCentral() {
  const input = document.getElementById('central-input');
  const text = input?.value?.trim();
  if (!text) return;
  addCentralMessage(`<span style="color:#e94560;font-weight:600">You</span> ${esc(text)}`, 'user');
  input.value = '';
  // Write to central AI inbox
  try {
    const res = await authFetch(`${API}/admin/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });
    const data = await res.json();
    if (data.ok) addCentralMessage(`<span style="color:#4ade80">Delivered to Central AI</span>`, 'system');
    else addCentralMessage(`<span style="color:#ef4444">Error: ${esc(data.error)}</span>`, 'system');
  } catch { addCentralMessage('<span style="color:#ef4444">Failed to send</span>', 'system'); }
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
  initCentralPanel();
})();
document.addEventListener('keydown', e => { if (e.ctrlKey && e.key>='1' && e.key<='9') { e.preventDefault(); const k = state.tabOrder[parseInt(e.key)-1]; if (k) switchTo(k); } });
window.addEventListener('beforeunload', saveLayout);
