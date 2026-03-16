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
const state = {
  projects: [], accounts: [], openPanels: {}, activePanel: 'dashboard',
  layout: 'tabs', collapsed: {}, chatProject: null, tabOrder: ['dashboard'],
};

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
        projects.push({ ...p, roles: s.roles || [], accounts: s.accounts || {} });
      } catch { projects.push({ ...p, roles: [], accounts: {} }); }
    }
    state.projects = projects;
    if (!state.chatProject && projects.length > 0) state.chatProject = projects[0].slug;
    renderSidebar(); renderDashboard(); renderChatProjectSelect(); renderOpenTabs();
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
      btn.innerHTML = `<span class="dot ${r.running?'running':'stopped'}"></span><span>${esc(r.name)}</span>${lw}<span class="info">${esc(r.account)}</span><span class="role-actions"><span class="act-restart" onclick="event.stopPropagation();restartRole('${esc(p.slug)}','${esc(r.name)}')" title="Restart">&#8635;</span><span class="act-del" onclick="event.stopPropagation();deleteRole('${esc(p.slug)}','${esc(r.name)}')" title="Delete">&times;</span></span>`;
      btn.onclick = () => openTerminal(p.slug, p.name, r.name, r.terminal);
      rd.appendChild(btn);
    }
    const ab = document.createElement('button'); ab.className = 'add-role-btn'; ab.textContent = '+ Add Role';
    ab.onclick = () => showRoleModal(p.slug); rd.appendChild(ab);
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
    t.innerHTML = `<span class="tab-icon">&#9654;</span><span>${esc(key)}</span><span class="close" onclick="event.stopPropagation();event.preventDefault();closePanel('${key.replace(/'/g, "\\'")}')">&times;</span>`;
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
    const rows = p.roles.map(r => `<tr><td><strong>${esc(r.name)}</strong></td><td><span class="badge ${esc(r.type)}">${esc(r.type)}</span></td><td>${esc(r.loop_interval||'')}</td><td><span class="badge ${r.running?'running':'stopped'}">${r.running?'running':'stopped'}</span>${r.needsLogin?' <span class="badge login-needed">login</span>':''}</td><td><select class="acct-select" data-slug="${esc(p.slug)}" data-role="${esc(r.name)}" onchange="switchAccount('${esc(p.slug)}','${esc(r.name)}',this)">${ao}</select></td><td>${r.terminal?`<a href="${esc(r.terminal)}" target="_blank" style="color:#818cf8">Open</a>`:'-'}</td></tr>`).join('');
    html += `<div class="card"><h3>${esc(p.name)}</h3><table><tr><th>Role</th><th>Type</th><th>Interval</th><th>Status</th><th>Account</th><th>Terminal</th></tr>${rows}</table></div>`;
    setTimeout(() => { for (const r of p.roles) { const s = document.querySelector(`select[data-slug="${p.slug}"][data-role="${r.name}"]`); if (s) s.value = r.account; } }, 0);
  }
  el.innerHTML = html;
}

// ==================== Panels ====================
function openTerminal(slug, projectName, roleName, terminalPath) {
  const key = `${slug}/${roleName}`;
  if (state.openPanels[key]) { switchTo(key); return; }
  if (!terminalPath) { alert(`No terminal for ${projectName}/${roleName}`); return; }
  const authPath = terminalPath + (terminalPath.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(AUTH_TOKEN);
  const panel = document.createElement('div'); panel.className = 'panel'; panel.id = `panel-${key}`;
  const iframe = document.createElement('iframe'); iframe.src = authPath; iframe.allow = 'clipboard-read; clipboard-write';
  // Reconnect overlay (for mobile — no keyboard Enter)
  const overlay = document.createElement('div'); overlay.className = 'reconnect-overlay';
  overlay.innerHTML = `<span class="reconnect-msg">Terminal disconnected</span><button class="reconnect-btn" onclick="reconnectPanel('${esc(key)}')">Reconnect</button>`;
  panel.appendChild(iframe); panel.appendChild(overlay);
  document.getElementById('panels').appendChild(panel);
  // Auto-detect disconnection
  let rTimer = setInterval(() => {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        const text = doc.body?.innerText || '';
        if (text.includes('press Enter to reconnect') || text.includes('Connection Closed')) {
          overlay.classList.add('show');
        }
      }
    } catch { /* cross-origin = ttyd alive */ }
  }, 2000);
  iframe.addEventListener('error', () => overlay.classList.add('show'));
  injectTouchScroll(iframe);
  state.openPanels[key] = { panel, iframe, overlay, reconnectTimer: rTimer };
  if (!state.tabOrder.includes(key)) state.tabOrder.push(key);

  if (state.layout === 'grid') {
    // In grid mode: just add the panel to the grid, don't switch away
    state.activePanel = key;
    refreshGrid();
  } else {
    switchTo(key);
  }
  renderOpenTabs(); saveLayout();
}

function reconnectPanel(key) {
  const p = state.openPanels[key];
  if (!p) return;
  p.overlay.classList.remove('show');
  // Replace iframe instead of reassigning src (avoids "leave page?" prompt)
  const oldSrc = p.iframe.src;
  const newIframe = document.createElement('iframe');
  newIframe.src = oldSrc;
  newIframe.allow = 'clipboard-read; clipboard-write';
  newIframe.style.cssText = p.iframe.style.cssText;
  p.iframe.replaceWith(newIframe);
  p.iframe = newIframe;
  injectTouchScroll(newIframe);
}

function closePanel(key) {
  const p = state.openPanels[key];
  if (!p) return;
  if (p.reconnectTimer) clearInterval(p.reconnectTimer);
  p.panel.remove(); delete state.openPanels[key];
  state.tabOrder = state.tabOrder.filter(k => k !== key);
  if (state.activePanel === key) {
    // Pick another panel or fallback to dashboard
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
  // In grid mode, clicking a tab just updates the "focused" highlight
  document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
  const title = name === 'dashboard' ? 'Dashboard' : name === 'settings' ? 'Settings' : esc(name);
  document.getElementById('panel-title').innerHTML = `<strong>${title}</strong>`;
  // Update sidebar buttons
  const dashBtn = document.getElementById('dashboard-btn');
  const settingsBtn = document.getElementById('settings-btn');
  if (dashBtn) { dashBtn.classList.toggle('active', name === 'dashboard'); }
  if (settingsBtn) {
    settingsBtn.style.background = name === 'settings' ? '#1a1a2e' : '';
    settingsBtn.style.color = name === 'settings' ? '#e94560' : '#ccc';
    settingsBtn.style.fontWeight = name === 'settings' ? '600' : '';
  }
  if (name === 'settings') renderSettings();
  renderOpenTabs(); saveLayout();
}

function refreshGrid() {
  const panels = document.getElementById('panels');
  // Clean grid classes
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

// ==================== Settings Panel ====================
function renderSettings() {
  const user = getCurrentUser();
  const isAdmin = user.role === 'admin';

  // Profile info
  document.getElementById('profile-info').innerHTML = `
    <dt>Username</dt><dd>${esc(user.username || '?')}</dd>
    <dt>Role</dt><dd><span class="role-badge ${user.role || ''}">${esc(user.role || '?')}</span></dd>`;

  // Show user management section for admins
  const usersSection = document.getElementById('users-section');
  usersSection.style.display = isAdmin ? 'block' : 'none';
  if (isAdmin) loadUsers();

  // System info
  const totalRoles = state.projects.reduce((s, p) => s + p.roles.length, 0);
  const runningRoles = state.projects.reduce((s, p) => s + p.roles.filter(r => r.running).length, 0);
  document.getElementById('system-info').innerHTML = `
    <dt>Version</dt><dd>0.1.0</dd>
    <dt>Projects</dt><dd>${state.projects.length}</dd>
    <dt>Roles</dt><dd>${runningRoles} running / ${totalRoles} total</dd>`;

  // Clear password form
  document.getElementById('pw-old').value = '';
  document.getElementById('pw-new').value = '';
  document.getElementById('pw-confirm').value = '';
  document.getElementById('pw-msg').className = 'settings-msg';
  document.getElementById('pw-msg').textContent = '';

  // Update sidebar button
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.classList.toggle('active', state.activePanel === 'settings');
    settingsBtn.style.background = state.activePanel === 'settings' ? '#1a1a2e' : '';
    settingsBtn.style.color = state.activePanel === 'settings' ? '#e94560' : '#ccc';
    settingsBtn.style.fontWeight = state.activePanel === 'settings' ? '600' : '';
  }
}

async function doChangePassword() {
  const oldPw = document.getElementById('pw-old').value;
  const newPw = document.getElementById('pw-new').value;
  const confirm = document.getElementById('pw-confirm').value;
  const msg = document.getElementById('pw-msg');

  if (!oldPw) { msg.className = 'settings-msg error'; msg.textContent = 'Enter current password'; return; }
  if (!newPw || newPw.length < 4) { msg.className = 'settings-msg error'; msg.textContent = 'New password must be at least 4 characters'; return; }
  if (newPw !== confirm) { msg.className = 'settings-msg error'; msg.textContent = 'Passwords do not match'; return; }

  try {
    const r = await authFetch('/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw }) });
    const d = await r.json();
    if (d.ok) {
      msg.className = 'settings-msg success'; msg.textContent = 'Password updated successfully';
      document.getElementById('pw-old').value = '';
      document.getElementById('pw-new').value = '';
      document.getElementById('pw-confirm').value = '';
    } else {
      msg.className = 'settings-msg error'; msg.textContent = d.error || 'Failed to update password';
    }
  } catch { msg.className = 'settings-msg error'; msg.textContent = 'Connection error'; }
}

async function loadUsers() {
  try {
    const r = await authFetch(`${API}/users`);
    const d = await r.json();
    if (!d.users) return;
    const currentUser = getCurrentUser().username;
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = d.users.map(u => `
      <tr>
        <td><strong>${esc(u.username)}</strong>${u.username === currentUser ? ' <span style="color:#888;font-size:10px">(you)</span>' : ''}</td>
        <td><span class="role-badge ${u.role}">${esc(u.role)}</span></td>
        <td style="color:#888;font-size:11px">${new Date(u.createdAt).toLocaleDateString()}</td>
        <td class="actions">
          <button class="act-btn" onclick="resetUserPassword('${esc(u.username).replace(/'/g, "\\'")}')">Reset PW</button>
          ${u.username !== currentUser ? `<button class="act-btn del" onclick="deleteUser('${esc(u.username).replace(/'/g, "\\'")}')">Delete</button>` : ''}
        </td>
      </tr>`).join('');
  } catch {}
}

function toggleAddUser() {
  const form = document.getElementById('add-user-form');
  form.classList.toggle('show');
  if (form.classList.contains('show')) {
    document.getElementById('new-username').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('new-role').value = 'viewer';
    document.getElementById('add-user-msg').className = 'settings-msg';
    document.getElementById('new-username').focus();
  }
}

async function doAddUser() {
  const username = document.getElementById('new-username').value.trim();
  const password = document.getElementById('new-password').value;
  const role = document.getElementById('new-role').value;
  const msg = document.getElementById('add-user-msg');

  if (!username || username.length < 2) { msg.className = 'settings-msg error'; msg.textContent = 'Username must be at least 2 characters'; return; }
  if (!password || password.length < 4) { msg.className = 'settings-msg error'; msg.textContent = 'Password must be at least 4 characters'; return; }

  try {
    const r = await authFetch(`${API}/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, role }) });
    const d = await r.json();
    if (d.ok) {
      msg.className = 'settings-msg success'; msg.textContent = `User "${d.username}" created as ${d.role}`;
      addFeedMessage(`User <strong>${esc(d.username)}</strong> added [${esc(d.role)}]`, 'system');
      loadUsers();
      setTimeout(() => { toggleAddUser(); }, 1500);
    } else {
      msg.className = 'settings-msg error'; msg.textContent = d.error || 'Failed';
    }
  } catch { msg.className = 'settings-msg error'; msg.textContent = 'Connection error'; }
}

async function deleteUser(username) {
  if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
  try {
    const r = await authFetch(`${API}/users/${encodeURIComponent(username)}`, { method: 'DELETE' });
    const d = await r.json();
    if (d.ok) {
      addFeedMessage(`User <strong>${esc(username)}</strong> deleted`, 'system');
      loadUsers();
    } else { alert(d.error || 'Failed'); }
  } catch { alert('Connection error'); }
}

async function resetUserPassword(username) {
  const password = prompt(`New password for "${username}" (min 4 chars):`);
  if (!password || password.length < 4) { if (password !== null) alert('Password must be at least 4 characters'); return; }
  try {
    const r = await authFetch(`${API}/users/${encodeURIComponent(username)}/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    const d = await r.json();
    if (d.ok) { addFeedMessage(`Password reset for <strong>${esc(username)}</strong>`, 'system'); }
    else { alert(d.error || 'Failed'); }
  } catch { alert('Connection error'); }
}

function closeMobileOverlay() {
  document.getElementById('sidebar').classList.remove('mobile-open');
  document.getElementById('chat-sidebar').classList.remove('mobile-open');
  document.getElementById('mobile-overlay').classList.remove('show');
}

// ==================== Resize handles ====================
function initResize(handleId, target, side) {
  const handle = document.getElementById(handleId);
  const el = document.getElementById(target);
  let startX, startW;
  handle.addEventListener('mousedown', e => {
    e.preventDefault(); handle.classList.add('active');
    startX = e.clientX; startW = el.offsetWidth;
    // Disable iframe pointer-events during drag so mouse events aren't swallowed
    document.querySelectorAll('iframe').forEach(f => f.style.pointerEvents = 'none');
    document.body.style.cursor = 'col-resize';
    const onMove = ev => {
      const dx = side === 'left' ? ev.clientX - startX : startX - ev.clientX;
      el.style.width = Math.max(180, startW + dx) + 'px';
    };
    const onUp = () => {
      handle.classList.remove('active');
      document.querySelectorAll('iframe').forEach(f => f.style.pointerEvents = '');
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}
initResize('rh-left', 'sidebar', 'left');
initResize('rh-right', 'chat-sidebar', 'right');

// ==================== Account / Role management ====================
async function switchAccount(slug, roleName, sel) {
  const an = sel.value, opt = sel.selectedOptions[0];
  if (!confirm(`Switch ${roleName} to "${an}"?`)) { fetchAll(); return; }
  try { const r = await authFetch(`${API}/projects/${slug}/roles/${roleName}/account`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({accountName:an,accountPath:opt?.dataset?.path}) }); const d = await r.json(); if (d.ok) { addFeedMessage(`Account: <strong>${esc(roleName)}</strong> -> ${esc(an)}${d.restarted?' (restarting)':''}`, 'system'); closePanel(`${slug}/${roleName}`); setTimeout(fetchAll, 5000); } } catch { addFeedMessage('Failed', 'system'); }
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
async function fetchCompletions(q) { try { const r = await authFetch(`${API}/complete-path?q=${encodeURIComponent(q)}`); const d = await r.json(); if (!d.suggestions.length) { acBox.classList.remove('show'); return; } acBox.innerHTML = d.suggestions.map(s => { const sp = esc(s.path).replace(/'/g, "\\'"); return `<div class="ac-item" data-path="${esc(s.path)}" onmousedown="event.preventDefault();selectCompletion('${sp}')"><span>${esc(s.path)}</span>${s.hasEvomesh?'<span class="ac-badge">evomesh</span>':''}</div>`; }).join(''); acBox.classList.add('show'); acIndex=-1; } catch { acBox.classList.remove('show'); } }
function selectCompletion(p) { addInput.value = p; acBox.classList.remove('show'); acIndex=-1; addInput.focus(); clearTimeout(acTimer); acTimer = setTimeout(() => fetchCompletions(p), 150); }

// ==================== Chat / Feed ====================
let lastStatusContent = '', serverConnected = true;
function addFeedMessage(html, cls='status') { const feed = document.getElementById('chat-feed'), div = document.createElement('div'); div.className = `feed-msg ${cls}`; div.innerHTML = html; feed.appendChild(div); feed.scrollTop = feed.scrollHeight; while (feed.children.length > 100) feed.removeChild(feed.firstChild); }
function renderChatProjectSelect() { const sel = document.getElementById('chat-project-select'); sel.innerHTML = state.projects.map(p => `<option value="${p.slug}" ${p.slug===state.chatProject?'selected':''}>${esc(p.name)}</option>`).join(''); }
function chatProjectChanged() { state.chatProject = document.getElementById('chat-project-select').value; }
function renderStatusBlock(entries) { const bp = {}; entries.forEach(e => { if (!bp[e.slug]) bp[e.slug]={name:e.project,entries:[]}; bp[e.slug].entries.push(e); }); return Object.entries(bp).map(([,g]) => { const l = g.entries.map(r => `<span class="feed-dot ${r.running?'running':'stopped'}"></span><span class="${r.type==='lead'?'role-name lead':'role-name'}">${esc(r.role)}</span><span class="role-status">${esc(r.status)}</span>`).join('<br>'); return `<span class="proj-label">${esc(g.name)}</span><br>${l}`; }).join('<br>'); }
function startSSEFeed() { const es = new EventSource(`${API}/feed?token=${encodeURIComponent(AUTH_TOKEN)}`); es.onmessage = e => { try { const d = JSON.parse(e.data); if (d.type==='status') { const ts = new Date(d.ts).toLocaleTimeString(), c = renderStatusBlock(d.entries); if (c===lastStatusContent) return; lastStatusContent=c; addFeedMessage(`<span class="ts">${ts}</span>${c}`, 'status'); } } catch {} }; es.onerror = () => { es.close(); setTimeout(startSSEFeed, 5000); }; }
async function sendChat() { const input = document.getElementById('chat-input'), text = input.value.trim(); if (!text||!state.chatProject) return; document.getElementById('chat-send').disabled = true; try { const r = await authFetch(`${API}/projects/${state.chatProject}/chat`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text})}); const d = await r.json(); if (d.ok) { addFeedMessage(`<span class="label">You</span> ${esc(text)}`, 'user'); addFeedMessage(`Delivered to <strong>${esc(d.delivered_to)}</strong>`, 'system'); input.value = ''; } else addFeedMessage(`Error: ${esc(d.error)}`, 'system'); } catch { addFeedMessage('Failed', 'system'); } document.getElementById('chat-send').disabled = false; input.focus(); }
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
document.getElementById('chat-input').addEventListener('keydown', e => { if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); sendChat(); } });

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

// Auto-save on changes
const _origSwitchTo = switchTo;
switchTo = function(name) { _origSwitchTo(name); saveLayout(); };
const _origClosePanel = closePanel;
closePanel = function(key) { _origClosePanel(key); saveLayout(); };
const _origSetLayout = setLayout;
setLayout = function(mode) { _origSetLayout(mode); saveLayout(); };

// Save on resize end
const origInitResize = initResize;
['rh-left', 'rh-right'].forEach(id => {
  const handle = document.getElementById(id);
  handle?.addEventListener('mouseup', () => setTimeout(saveLayout, 100));
});


// ==================== Mobile touch scroll for terminals ====================
// Uses server API to send tmux copy-mode scroll commands.
// Works with tmux mouse OFF (preserves desktop text selection).
(function() {
  const panels = document.getElementById('panels');
  if (!panels) return;
  let touchStartY = 0, lastY = 0, scrolling = false, lastScrollTime = 0;
  const THRESHOLD = 15, STEP_PX = 25, THROTTLE_MS = 100;

  panels.addEventListener('touchstart', e => {
    if (state.activePanel === 'dashboard' || state.activePanel === 'settings') return;
    if (e.touches.length !== 1) return;
    touchStartY = e.touches[0].clientY;
    lastY = touchStartY;
    scrolling = false;
  }, { passive: true });

  panels.addEventListener('touchmove', e => {
    if (!state.openPanels[state.activePanel]) return;
    if (e.touches.length !== 1) return;
    const now = Date.now();
    const currentY = e.touches[0].clientY;
    const totalDy = Math.abs(currentY - touchStartY);

    if (!scrolling && totalDy > THRESHOLD) {
      scrolling = true;
      lastY = currentY;
      return;
    }
    if (!scrolling || now - lastScrollTime < THROTTLE_MS) return;

    const dy = lastY - currentY;
    const lines = Math.floor(Math.abs(dy) / STEP_PX);
    if (lines < 1) return;

    lastScrollTime = now;
    lastY = currentY;

    const parts = state.activePanel.split('/');
    if (parts.length !== 2) return;
    const direction = dy > 0 ? 'Up' : 'Down';

    authFetch(`${API}/projects/${parts[0]}/roles/${parts[1]}/scroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction }),
    }).catch(() => {});
  }, { passive: true });

  panels.addEventListener('touchend', () => { scrolling = false; });
  panels.addEventListener('touchcancel', () => { scrolling = false; });
})();


// ==================== Init ====================
(async () => {
  // Validate auth before starting the app
  if (!AUTH_TOKEN) { location.href = '/login'; return; }
  try {
    const r = await fetch('/auth/validate', { headers: { 'Authorization': 'Bearer ' + AUTH_TOKEN } });
    const d = await r.json();
    if (!d.valid) { localStorage.removeItem('evomesh-token'); localStorage.removeItem('evomesh-user'); location.href = '/login'; return; }
    if (d.username) localStorage.setItem('evomesh-user', JSON.stringify({username:d.username, role:d.role}));
  } catch { location.href = '/login'; return; }
  restoreLayout();
  fetchAll(); fetchMetrics(); setInterval(fetchAll, 8000); setInterval(fetchMetrics, 5000); startSSEFeed();
})();
document.addEventListener('keydown', e => { if (e.ctrlKey && e.key>='1' && e.key<='9') { e.preventDefault(); const k = state.tabOrder[parseInt(e.key)-1]; if (k) switchTo(k); } });
window.addEventListener('beforeunload', saveLayout);
