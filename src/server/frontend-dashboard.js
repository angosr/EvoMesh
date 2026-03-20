// ==================== Dashboard: Project Cards, Members, Account Usage ====================
// Extracted from frontend.js for file size compliance (<500 lines)
// Depends on: state, authFetch, esc, API, appendFeedMessage, withLoading,
//   switchAccount, saveAndRestart, stopRole, saveLaunchMode from other files

// ==================== Account Usage (top section) ====================
// Cached to avoid flicker — only update DOM when data actually changes
let _lastAccountHtml = '';

async function renderAccountUsage() {
  const section = document.getElementById('account-usage-section');
  if (!section) return;
  try {
    const r = await authFetch(`${API}/usage/accounts`);
    if (!r.ok) return;
    const data = await r.json();
    const accounts = data.accounts || data;
    if (!accounts || !accounts.length) { section.innerHTML = ''; _lastAccountHtml = ''; return; }
    const fmtNum = n => n >= 1e9 ? (n/1e9).toFixed(1)+'B' : n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'K' : String(n);
    const fmtTime = ms => { if (!ms || ms <= 0) return 'expired'; const h = Math.floor(ms/3600000); const m = Math.floor((ms%3600000)/60000); return h > 0 ? `${h}h ${m}m` : `${m}m`; };
    const html = `<h2 style="color:var(--accent);margin-bottom:10px;font-size:16px;font-family:var(--font-display);font-weight:700;letter-spacing:-0.03em">Account Usage</h2>` +
      accounts.map(a => {
        const u = a.usage24h || {};
        const statusCls = a.needsLogin ? 'needs-login' : (a.tokenExpiresIn && a.tokenExpiresIn < 3600000 ? 'expiring' : 'ok');
        const statusText = a.needsLogin ? 'needs login' : (a.tokenExpiresIn != null ? fmtTime(a.tokenExpiresIn) : '');
        return `<div class="card acct-card-v2">
          <div class="acct-row">
            <span class="acct-dot ${statusCls}"></span>
            <strong class="acct-name">${esc(a.name || a.path)}</strong>
            <span class="badge ${esc(a.subscriptionType || 'free')}">${esc(a.subscriptionType || 'free')}</span>
            ${a.rateLimitTier ? `<span class="acct-tier">${esc(a.rateLimitTier.replace('default_claude_','').replace(/_/g,' '))}</span>` : ''}
            <span class="acct-status ${statusCls}">${statusText}</span>
          </div>
          <div class="acct-stats">
            <span title="Output tokens (24h)">out <b>${fmtNum(u.outputTokens||0)}</b></span>
            <span title="Input tokens (24h)">in <b>${fmtNum(u.inputTokens||0)}</b></span>
            <span title="Cache read tokens (24h)">cache <b>${fmtNum(u.cacheRead||0)}</b></span>
            <span title="Total tokens (24h)">total <b>${fmtNum(u.total||0)}</b></span>
            <span title="Roles using this account">roles <b>${a.roleCount||0}</b></span>
          </div>
        </div>`;
      }).join('');
    if (html !== _lastAccountHtml) { section.innerHTML = html; _lastAccountHtml = html; }
  } catch {}
}

// ==================== Project Cards (bottom section) ====================
function renderDashboard() {
  const projectsEl = document.getElementById('dash-projects');
  if (!projectsEl) return;

  if (!state.projects.length) {
    projectsEl.innerHTML = `<div class="card onboarding"><h3>Welcome to EvoMesh</h3>
      <p>Tell Central AI what project you want to work on:</p>
      <ol><li>Open the Feed panel (right side)</li>
      <li>Type: "Create a project for /path/to/my-project"</li>
      <li>Central AI will analyze your code and set up roles</li></ol>
      <p style="color:var(--text-faint)">Or add an existing project by path or GitHub URL.</p></div>`;
    renderAccountUsage();
    return;
  }
  const ao = state.accounts.map(a => `<option value="${esc(a.name)}" data-path="${esc(a.path)}">${esc(a.name)} (${esc(a.path)})${a.needsLogin?' (login)':''}</option>`).join('');
  let html = '';
  for (const p of state.projects) {
    const isOwner = p.myRole === 'owner';
    const rows = p.roles.map(r => {
      const statusBadge = `<span class="badge ${r.running?'running':'stopped'}">${r.running?'running':'stopped'}</span>`;
      const loginBadge = r.needsLogin ? ' <span class="badge login-needed">login</span>' : '';
      const acctCol = isOwner ? `<select class="acct-select" data-slug="${esc(p.slug)}" data-role="${esc(r.name)}">${ao}</select>` : `<span style="color:var(--text-faint)">${esc(r.account)}</span>`;
      // Resources: show actual usage as visible labels + input for limits
      let resCol = '';
      if (isOwner) {
        const memLabel = r.actualMem ? `<span class="res-val">${esc(r.actualMem)}</span>` : '';
        const cpuLabel = r.actualCpu ? `<span class="res-val">${esc(r.actualCpu)}</span>` : '';
        resCol = `<div class="res-group"><span class="res-label">MEM</span>${memLabel}<input class="res-input" data-slug="${esc(p.slug)}" data-role="${esc(r.name)}" data-field="memory" value="${esc(r.memory||'')}" placeholder="limit" title="Memory limit (e.g. 2g)"></div>`
          + `<div class="res-group"><span class="res-label">CPU</span>${cpuLabel}<input class="res-input" data-slug="${esc(p.slug)}" data-role="${esc(r.name)}" data-field="cpus" value="${esc(r.cpus||'')}" placeholder="limit" title="CPU limit (e.g. 1.5)"></div>`;
      }
      const startRestartBtn = `<button class="dash-action" data-action="restart" data-slug="${esc(p.slug)}" data-role="${esc(r.name)}">${r.running ? '↻ Restart' : '▶ Start'}</button>`;
      const stopBtn = r.running ? `<button class="dash-action danger" data-action="stop" data-slug="${esc(p.slug)}" data-role="${esc(r.name)}">■ Stop</button>` : '';
      const launchMode = r.launch_mode || 'docker';
      const modeSelect = `<select class="mode-select" data-slug="${esc(p.slug)}" data-role="${esc(r.name)}"><option value="docker"${launchMode==='docker'?' selected':''}>docker</option><option value="host"${launchMode==='host'?' selected':''}>host</option></select>`;
      const idlePolicy = r.idle_policy || 'ignore';
      const idleSelect = `<select class="idle-select" data-slug="${esc(p.slug)}" data-role="${esc(r.name)}" title="Idle policy (3x idle → action)"><option value="ignore"${idlePolicy==='ignore'?' selected':''}>Ignore</option><option value="compact"${idlePolicy==='compact'?' selected':''}>Compress</option><option value="reset"${idlePolicy==='reset'?' selected':''}>Reset</option></select>`;
      const actCol = isOwner ? `<div class="act-row">${startRestartBtn}${stopBtn}</div><div class="act-row">${modeSelect}${idleSelect}</div>` : '';
      return `<tr>
        <td><strong>${esc(r.name)}</strong> <span class="badge ${esc(r.type)}">${esc(r.type)}</span>${statusBadge}${loginBadge}</td>
        <td>${acctCol}</td>
        <td class="res-cell">${resCol}</td>
        <td class="act-cell">${actCol}</td>
      </tr>`;
    }).join('');
    const roleLabel = isOwner ? `${esc(p.name)}` : `${esc(p.name)} <span class="badge" style="font-size:10px;background:rgba(129,140,248,0.12);color:var(--blue)">${esc(p.myRole||'')}</span>`;
    const membersBtn = isOwner ? ` <button class="dash-action" data-action="members" data-slug="${esc(p.slug)}" style="margin-left:auto;font-size:11px">Members</button>` : '';
    const membersOpen = state.membersOpen === p.slug;
    const membersPanel = membersOpen ? `<div class="members-panel" id="members-${esc(p.slug)}"></div>` : '';
    html += `<div class="card"><h3>${roleLabel}${membersBtn}</h3><table><thead><tr><th>Role</th><th>Account</th><th>Resources</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table>${membersPanel}</div>`;
  }
  // Central AI card
  let centralHtml = '';
  try {
    const centralRes = await authFetch(`${API}/admin/status`);
    const cs = await centralRes.json();
    const statusBadge = cs.enabled === false ? '<span class="badge stopped">disabled</span>'
      : cs.running ? '<span class="badge running">running</span>' : '<span class="badge stopped">stopped</span>';
    const acctOptions = state.accounts.map(a => `<option value="${esc(a.path)}"${(cs.account||'~/.claude')===a.path?' selected':''}>${esc(a.name)} (${esc(a.path)})</option>`).join('');
    const startStopBtn = cs.running
      ? `<button class="dash-action danger" id="central-stop-btn">■ Stop</button>`
      : `<button class="dash-action" id="central-start-btn">▶ Start</button>`;
    centralHtml = `<div class="card"><h3>Central AI</h3><table><thead><tr><th>Role</th><th>Account</th><th>Actions</th></tr></thead><tbody>
      <tr><td><strong>central</strong> <span class="badge lead">orchestrator</span> ${statusBadge}</td>
      <td><select id="central-acct-select">${acctOptions}</select></td>
      <td><div class="act-row">${startStopBtn}</div></td></tr></tbody></table></div>`;
  } catch { /* admin status failed — skip central card */ }

  projectsEl.innerHTML = centralHtml + `<h2 style="color:var(--accent);margin-bottom:14px;font-size:16px;font-family:var(--font-display);font-weight:700;letter-spacing:-0.03em">Project Overview</h2>` + html;
  // Set select values after innerHTML (synchronous DOM update — no setTimeout needed)
  for (const p of state.projects) {
    for (const r of p.roles) {
      const s = projectsEl.querySelector(`select[data-slug="${p.slug}"][data-role="${r.name}"]`);
      if (s) s.value = r.account;
    }
  }
  // Event listeners
  projectsEl.querySelectorAll('.acct-select').forEach(sel => {
    sel.addEventListener('change', () => switchAccount(sel.dataset.slug, sel.dataset.role, sel));
  });
  projectsEl.querySelectorAll('.dash-action[data-action="restart"]').forEach(btn => {
    btn.addEventListener('click', () => withLoading(btn, () => saveAndRestart(btn.dataset.slug, btn.dataset.role)));
  });
  projectsEl.querySelectorAll('.dash-action[data-action="stop"]').forEach(btn => {
    btn.addEventListener('click', () => withLoading(btn, () => stopRole(btn.dataset.slug, btn.dataset.role)));
  });
  projectsEl.querySelectorAll('.mode-select').forEach(sel => {
    sel.addEventListener('change', () => saveLaunchMode(sel.dataset.slug, sel.dataset.role, sel.value));
  });
  projectsEl.querySelectorAll('.idle-select').forEach(sel => {
    sel.addEventListener('change', () => saveIdlePolicy(sel.dataset.slug, sel.dataset.role, sel.value));
  });
  projectsEl.querySelectorAll('.dash-action[data-action="members"]').forEach(btn => {
    btn.addEventListener('click', () => toggleMembers(btn.dataset.slug));
  });
  // Central AI event listeners
  const centralAcctSel = document.getElementById('central-acct-select');
  if (centralAcctSel) {
    centralAcctSel.addEventListener('change', async () => {
      try {
        const r = await authFetch(`${API}/admin/account`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account: centralAcctSel.value }),
        });
        const d = await r.json();
        if (d.ok) appendFeedMessage({ type: 'system', text: `Central AI account → ${centralAcctSel.value}`, time: new Date().toISOString() });
        else alert(d.error || 'Failed');
      } catch { alert('Failed to update Central AI account'); }
    });
  }
  const centralStartBtn = document.getElementById('central-start-btn');
  if (centralStartBtn) centralStartBtn.addEventListener('click', () => withLoading(centralStartBtn, async () => {
    await authFetch(`${API}/admin/start`, { method: 'POST' });
    fetchAll();
  }));
  const centralStopBtn = document.getElementById('central-stop-btn');
  if (centralStopBtn) centralStopBtn.addEventListener('click', () => withLoading(centralStopBtn, async () => {
    await authFetch(`${API}/admin/stop`, { method: 'POST' });
    fetchAll();
  }));
  if (state.membersOpen) loadMembers(state.membersOpen);
  renderAccountUsage();
}

// ==================== Members Panel ====================
function toggleMembers(slug) {
  state.membersOpen = state.membersOpen === slug ? null : slug;
  renderDashboard();
}

async function loadMembers(slug) {
  const panel = document.getElementById(`members-${slug}`);
  if (!panel) return;
  panel.innerHTML = '<div style="color:var(--text-faint);font-size:12px">Loading members...</div>';
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
      html += '<div style="color:var(--text-faint);font-size:12px">No members yet.</div>';
    }
    html += `<div style="margin-top:8px;display:flex;gap:6px;align-items:center">
      <input id="member-user-${esc(slug)}" placeholder="username" style="background:var(--bg-input);border:1px solid var(--border);color:var(--text);padding:4px 8px;border-radius:4px;font-size:12px;width:120px">
      <select id="member-role-${esc(slug)}" style="background:var(--bg-input);border:1px solid var(--border);color:var(--text);padding:4px 8px;border-radius:4px;font-size:12px"><option value="member">member</option><option value="viewer">viewer</option></select>
      <button class="dash-action" data-action="add-member" data-slug="${esc(slug)}" style="font-size:11px">Add</button>
    </div>`;
    panel.innerHTML = html;
    panel.querySelectorAll('[data-action="remove-member"]').forEach(btn => {
      btn.addEventListener('click', () => removeMember(btn.dataset.slug, btn.dataset.username));
    });
    const addBtn = panel.querySelector('[data-action="add-member"]');
    if (addBtn) addBtn.addEventListener('click', () => addMember(addBtn.dataset.slug));
  } catch { panel.innerHTML = '<div style="color:var(--red);font-size:12px">Failed to load members</div>'; }
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
