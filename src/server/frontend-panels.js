// Panel management + terminal scroll/copy
// Depends on globals from frontend.js: state, authFetch, API, esc, saveLayout, renderOpenTabs, fetchAll, injectTouchScroll

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
  const btns = [
    ['\u25B2', 'up', 5],
    ['\u21DE', 'up', 20],
    ['\u21DF', 'down', 20],
    ['\u25BC', 'down', 5],
    ['Esc', 'esc', 0],
    ['\uD83D\uDCCB', 'copy', 0],
  ];
  for (const [label, action, lines] of btns) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.title = label;
    let holdTimer = null;
    const fire = () => termAction(key, action, lines);
    const startHold = (e) => {
      e.preventDefault(); e.stopPropagation();
      fire();
      if (action === 'up' || action === 'down') {
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
    toolbar.appendChild(btn);
  }
  panel.appendChild(iframe); panel.appendChild(toolbar); panel.appendChild(overlay);
  document.getElementById('panels').appendChild(panel);
  let rTimer = setInterval(() => {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        const text = doc.body?.innerText || '';
        if (text.includes('press Enter to reconnect') || text.includes('Connection Closed')) {
          overlay.classList.add('show');
        }
      }
    } catch {}
  }, 2000);
  iframe.addEventListener('error', () => overlay.classList.add('show'));
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
  state.openPanels[key] = { panel, iframe: null, overlay: null, reconnectTimer: null };
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
        panel.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ef4444">Timeout waiting for terminal. Try refreshing.</div>`;
      }
    }, 2000);
  } catch (e) {
    panel.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#ef4444">Error: ${esc(String(e))}</div>`;
  }
}

function reconnectPanel(key) {
  const p = state.openPanels[key];
  if (!p) return;
  p.overlay.classList.remove('show');
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

// ==================== Terminal scroll + copy ====================
(function() {
  const panels = document.getElementById('panels');
  if (!panels) return;
  let lastScroll = 0;
  const THROTTLE = 50;

  function doScroll(direction, lines) {
    const now = Date.now();
    if (now - lastScroll < THROTTLE) return;
    lastScroll = now;
    const key = state.activePanel;
    if (!key || key === 'dashboard' || key === 'settings') return;
    const parts = key.split('/');
    if (parts.length !== 2) return;
    authFetch(`${API}/projects/${parts[0]}/roles/${parts[1]}/scroll`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction, lines }),
    }).catch(() => {});
  }

  panels.addEventListener('wheel', e => {
    if (!state.openPanels[state.activePanel]) return;
    e.preventDefault();
    doScroll(e.deltaY > 0 ? 'down' : 'up', 3);
  }, { passive: false });

  let touchStartY = 0, touchStartTime = 0, touchMoved = false;

  panels.addEventListener('touchstart', e => {
    if (!state.openPanels[state.activePanel]) return;
    if (e.touches.length === 1) {
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
      touchMoved = false;
    }
  }, { passive: true });

  panels.addEventListener('touchmove', e => {
    if (!state.openPanels[state.activePanel]) return;
    if (e.touches.length !== 1) return;
    const dy = e.touches[0].clientY - touchStartY;
    if (Math.abs(dy) > 10) {
      touchMoved = true;
      const lines = Math.min(Math.ceil(Math.abs(dy) / 8), 15);
      doScroll(dy > 0 ? 'up' : 'down', lines);
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  panels.addEventListener('touchend', e => {
    if (!state.openPanels[state.activePanel]) return;
    const duration = Date.now() - touchStartTime;
    if (!touchMoved && duration > 500) {
      showCopyDialog();
    }
  });
})();

function termAction(key, action, lines) {
  const parts = key.split('/');
  if (parts.length !== 2) return;
  const slug = parts[0], role = parts[1];

  if (action === 'copy') { showCopyDialog(); return; }
  if (action === 'esc') {
    authFetch(`${API}/projects/${slug}/roles/${role}/scroll`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction: 'esc', lines: 0 }),
    }).catch(() => {});
    return;
  }
  authFetch(`${API}/projects/${slug}/roles/${role}/scroll`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ direction: action, lines }),
  }).catch(() => {});
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
    const last500 = clean.split('\n').slice(-100).join('\n');
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:200;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = `<div style="background:#111;border:1px solid #333;border-radius:8px;padding:16px;max-width:90vw;max-height:80vh;overflow:auto;width:600px">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <span style="color:#e94560;font-size:13px;font-weight:600">Terminal Output (select to copy)</span>
        <button onclick="this.closest('div').parentElement.remove()" style="background:none;border:none;color:#888;cursor:pointer;font-size:16px">&times;</button>
      </div>
      <pre style="color:#ccc;font-size:11px;line-height:1.4;white-space:pre-wrap;word-break:break-all;user-select:text;-webkit-user-select:text">${last500.replace(/</g,'&lt;')}</pre>
    </div>`;
    modal.onclick = e => { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
  } catch {}
}
