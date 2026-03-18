// ==================== Unified Feed ====================
// Extracted from frontend.js for file size compliance (<500 lines)
// Depends on: authFetch, esc, API, AUTH_TOKEN from frontend.js

const ROLE_COLORS = {
  lead: '#ef4444', 'core-dev': '#22c55e', frontend: '#3b82f6',
  reviewer: '#a855f7', security: '#f97316', research: '#06b6d4',
  'agent-architect': '#ec4899',
};

function initFeed() {
  const feed = document.getElementById('feed');
  if (!feed) return;

  const seenMessages = new Set();
  const MAX_SEEN = 500;

  // SSE stream for role updates — auto-reconnect on disconnect
  let currentEs = null;
  function connectFeed() {
    if (currentEs) { currentEs.close(); currentEs = null; }
    const es = new EventSource(`${API}/feed/stream?token=${encodeURIComponent(AUTH_TOKEN)}`);
    currentEs = es;
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'user-message') return;
        // Dedup: skip if we already have this message (by role+text+time)
        const key = `${msg.role||''}:${(msg.text||'').slice(0,50)}:${msg.time||''}`;
        if (seenMessages.has(key)) return;
        seenMessages.add(key);
        // Trim dedup set to prevent unbounded memory growth in long sessions
        if (seenMessages.size > MAX_SEEN) {
          const iter = seenMessages.values();
          for (let i = 0; i < 100; i++) seenMessages.delete(iter.next().value);
        }
        appendFeedMessage(msg);
      } catch {}
    };
    es.onopen = () => {
      const dot = document.getElementById('conn-dot');
      const dot2 = document.getElementById('conn-dot2');
      if (dot) dot.className = 'conn-dot connected';
      if (dot2) dot2.className = 'conn-dot connected';
    };
    es.onerror = () => {
      es.close();
      const dot = document.getElementById('conn-dot');
      const dot2 = document.getElementById('conn-dot2');
      if (dot) dot.className = 'conn-dot disconnected';
      if (dot2) dot2.className = 'conn-dot disconnected';
      setTimeout(connectFeed, 3000);
    };
  }
  connectFeed();

  // Send button
  const sendBtn = document.getElementById('feed-send');
  const msgInput = document.getElementById('feed-msg');
  if (sendBtn) sendBtn.addEventListener('click', sendFeedMsg);
  if (msgInput) msgInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendFeedMsg(); }
  });

  // Try to start central AI if enabled but not running
  authFetch(`${API}/admin/status`).then(r => r.json()).then(s => {
    if (s.enabled !== false && !s.running) authFetch(`${API}/admin/start`, { method: 'POST' }).catch(() => {});
  }).catch(() => {});
}

function safeColor(c) { return /^#[0-9a-fA-F]{3,6}$|^[a-zA-Z]+$/.test(c) ? c : '#888'; }

function appendFeedMessage(msg, type) {
  if (typeof msg === 'string') msg = { type: type || 'system', text: msg, time: new Date().toISOString() };
  const feed = document.getElementById('feed');
  if (!feed) return;
  const div = document.createElement('div');
  div.className = `feed-item feed-${msg.type || 'system'}`;

  const time = msg.time ? new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  if (msg.type === 'role') {
    const color = safeColor(ROLE_COLORS[msg.role] || '#888');
    const proj = msg.project ? `<span class="feed-project">${esc(msg.project)}</span>` : '';
    div.innerHTML = `${proj}<span class="feed-role" style="color:${color}">${esc(msg.role || '')}</span>
      <span class="feed-time">${esc(time)}</span>
      <div class="feed-text">${esc(msg.text || '')}</div>`;
  } else if (msg.type === 'central') {
    const lines = (msg.text || '').split('\n').map(l => {
      let s = esc(l);
      s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/^### (.+)/, '<div class="feed-section-title" style="font-size:11px">$1</div>');
      s = s.replace(/^## (.+)/, '<div class="feed-section-title">$1</div>');
      s = s.replace(/^# (.+)/, '<div class="feed-section-title" style="font-size:13px">$1</div>');
      s = s.replace(/^- \[x\] (.+)/, '<span style="color:var(--green)">✓</span> <s style="color:var(--text-faint)">$1</s>');
      s = s.replace(/^- \[ \] (.+)/, '<span style="color:var(--text-faint)">○</span> $1');
      s = s.replace(/^  - /, '&nbsp;&nbsp;• ');
      s = s.replace(/^- /, '• ');
      return s;
    }).join('<br>');
    div.innerHTML = `<span class="feed-role" style="color:#ef4444">Central AI</span>
      <span class="feed-time">${esc(time)}</span>
      <div class="feed-text feed-central-text">${lines}</div>`;
  } else if (msg.type === 'user-message') {
    div.innerHTML = `<div class="feed-text">${esc(msg.text || '')}</div>`;
  } else {
    // System messages are internally generated with pre-escaped user data — render HTML (e.g. <strong>)
    div.innerHTML = `<div class="feed-text feed-system-text">${msg.text || ''}</div>`;
  }

  feed.appendChild(div);
  feed.scrollTop = feed.scrollHeight;
  while (feed.children.length > 200) feed.removeChild(feed.firstChild);
}

// Core send logic — used by both sidebar feed input and compose dialog
async function _sendMessage(text, sourceInput, sourceBtn) {
  if (!text) return;
  const origLabel = sourceBtn?.textContent;
  if (sourceBtn) { sourceBtn.disabled = true; sourceBtn.textContent = '...'; }
  appendFeedMessage({ type: 'user-message', text, time: new Date().toISOString() });
  if (sourceInput) { sourceInput.value = ''; if (sourceInput.style) sourceInput.style.height = 'auto'; }
  try {
    const res = await authFetch(`${API}/admin/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });
    const data = await res.json();
    if (!data.ok) {
      appendFeedMessage({ type: 'system', text: `Error: ${data.error}`, time: new Date().toISOString() });
    }
  } catch { appendFeedMessage({ type: 'system', text: 'Failed to send', time: new Date().toISOString() }); }
  if (sourceBtn) { sourceBtn.disabled = false; sourceBtn.textContent = origLabel; }
}

async function sendFeedMsg() {
  const input = document.getElementById('feed-msg');
  const btn = document.getElementById('feed-send');
  await _sendMessage(input?.value?.trim(), input, btn);
  input?.focus();
}

// ==================== Compose bar — docked input at bottom of #main (tabs only) ====================
let _composeOpen = false;

function _getActiveTerminal() {
  const key = state.activePanel;
  if (!key || key === 'dashboard' || key === 'settings') return null;
  const parts = key.split('/');
  if (parts.length !== 2 || !state.openPanels[key]) return null;
  return { slug: parts[0], role: parts[1], key };
}

function toggleCompose() { _composeOpen ? closeCompose() : openCompose(); }

function _updateComposeBtn() {
  const btn = document.getElementById('compose-toggle-btn');
  if (btn) btn.classList.toggle('active', _composeOpen);
}

function openCompose() {
  if (state.layout !== 'tabs') return;
  const target = _getActiveTerminal();
  if (!target) return;
  const bar = document.getElementById('compose-bar');
  const textarea = document.getElementById('compose-textarea');
  if (!bar) return;
  const targetEl = document.getElementById('compose-target');
  if (targetEl) targetEl.textContent = target.role;
  bar.classList.add('open');
  _composeOpen = true;
  _updateComposeBtn();
  textarea.focus();
}

function closeCompose() {
  const bar = document.getElementById('compose-bar');
  if (!bar) return;
  bar.classList.remove('open');
  _composeOpen = false;
  _updateComposeBtn();
}

async function sendCompose() {
  const textarea = document.getElementById('compose-textarea');
  const btn = document.getElementById('compose-send');
  const text = textarea?.value?.trim();
  if (!text) return;
  const target = _getActiveTerminal();
  if (!target) return;
  if (btn) btn.disabled = true;
  textarea.value = '';
  textarea.style.height = 'auto';
  try {
    const res = await authFetch(`${API}/projects/${target.slug}/roles/${target.role}/input`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!data.ok) {
      textarea.value = text;
      appendFeedMessage({ type: 'system', text: `Send failed: ${data.error || 'unknown'}`, time: new Date().toISOString() });
    }
  } catch {
    textarea.value = text;
    appendFeedMessage({ type: 'system', text: 'Failed to send to terminal', time: new Date().toISOString() });
  }
  if (btn) btn.disabled = false;
  textarea.focus();
}

// Global shortcuts
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === '/') { e.preventDefault(); toggleCompose(); return; }
  if (e.key === 'Escape' && _composeOpen) { e.preventDefault(); closeCompose(); return; }
});

function initCompose() {
  const textarea = document.getElementById('compose-textarea');
  const sendBtn = document.getElementById('compose-send');
  const closeBtn = document.getElementById('compose-close');
  if (!textarea) return;

  textarea.addEventListener('keydown', e => {
    // Enter sends (Shift+Enter for newline)
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault(); sendCompose(); return;
    }
    // PageUp/PageDown → scroll terminal while typing
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      if (typeof queueScroll === 'function') queueScroll(e.key === 'PageUp' ? 'up' : 'down', 20);
      return;
    }
    // Ctrl+Arrow → small scroll
    if (e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      if (typeof queueScroll === 'function') queueScroll(e.key === 'ArrowUp' ? 'up' : 'down', 5);
      return;
    }
  });

  // Auto-resize
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 80) + 'px';
  });

  if (sendBtn) sendBtn.addEventListener('click', sendCompose);
  if (closeBtn) closeBtn.addEventListener('click', closeCompose);

  // Guard: iframe xterm.js steals focus on load/reconnect → reclaim
  window.addEventListener('blur', () => {
    if (!_composeOpen) return;
    setTimeout(() => {
      if (_composeOpen && document.activeElement !== textarea) textarea.focus();
    }, 50);
  });

  // Resize handle — drag to adjust compose bar height
  const resizeHandle = document.getElementById('compose-resize-handle');
  const bar = document.getElementById('compose-bar');
  if (resizeHandle && bar) {
    let startY, startH;
    const onStart = (y) => {
      startY = y; startH = bar.offsetHeight;
      document.querySelectorAll('iframe').forEach(f => f.style.pointerEvents = 'none');
      document.body.style.cursor = 'ns-resize';
    };
    const onMove = (y) => {
      const h = Math.max(60, Math.min(startH + (startY - y), window.innerHeight * 0.6));
      bar.style.height = h + 'px';
    };
    const onEnd = () => {
      document.querySelectorAll('iframe').forEach(f => f.style.pointerEvents = '');
      document.body.style.cursor = '';
    };
    resizeHandle.addEventListener('mousedown', e => {
      e.preventDefault(); onStart(e.clientY);
      const mm = ev => onMove(ev.clientY);
      const mu = () => { onEnd(); document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); };
      document.addEventListener('mousemove', mm);
      document.addEventListener('mouseup', mu);
    });
    resizeHandle.addEventListener('touchstart', e => {
      e.preventDefault(); onStart(e.touches[0].clientY);
      const tm = ev => { ev.preventDefault(); onMove(ev.touches[0].clientY); };
      const te = () => { onEnd(); document.removeEventListener('touchmove', tm); document.removeEventListener('touchend', te); };
      document.addEventListener('touchmove', tm, { passive: false });
      document.addEventListener('touchend', te);
    }, { passive: false });
  }
}
