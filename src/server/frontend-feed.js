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

function appendFeedMessage(msg) {
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
    div.innerHTML = `<div class="feed-text feed-system-text">${esc(msg.text || '')}</div>`;
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

// ==================== Quick Compose — overlays active terminal panel (tabs only) ====================
let _composeOpen = false;

// Get the slug/role for the currently active terminal panel
function _getActiveTerminal() {
  const key = state.activePanel;
  if (!key || key === 'dashboard' || key === 'settings') return null;
  const parts = key.split('/');
  if (parts.length !== 2) return null;
  if (!state.openPanels[key]) return null;
  return { slug: parts[0], role: parts[1], key };
}

function _updateComposeFab() {
  const fab = document.getElementById('compose-fab');
  if (!fab) return;
  // Only show in tabs mode when a terminal panel is active
  const show = state.layout === 'tabs' && _getActiveTerminal() && !_composeOpen;
  fab.classList.toggle('hidden', !show);
}

function toggleCompose() {
  _composeOpen ? closeCompose() : openCompose();
}

function openCompose() {
  if (state.layout !== 'tabs') return; // tabs only
  const target = _getActiveTerminal();
  if (!target) return;
  const dialog = document.getElementById('compose-dialog');
  const textarea = document.getElementById('compose-textarea');
  const titleEl = document.getElementById('compose-target');
  if (!dialog) return;
  titleEl.textContent = `Send to ${target.role}`;
  dialog.classList.add('open');
  _composeOpen = true;
  _updateComposeFab();
  setTimeout(() => textarea.focus(), 50);
}

function closeCompose() {
  const dialog = document.getElementById('compose-dialog');
  if (!dialog) return;
  dialog.classList.remove('open');
  _composeOpen = false;
  _updateComposeFab();
}

async function sendCompose() {
  const textarea = document.getElementById('compose-textarea');
  const btn = document.getElementById('compose-send');
  const text = textarea?.value?.trim();
  if (!text) return;
  const target = _getActiveTerminal();
  if (!target) return;
  const origLabel = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = '...'; }
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
      textarea.value = text; // restore on failure
      appendFeedMessage({ type: 'system', text: `Send failed: ${data.error || 'unknown'}`, time: new Date().toISOString() });
    }
  } catch {
    textarea.value = text; // restore on failure
    appendFeedMessage({ type: 'system', text: 'Failed to send to terminal', time: new Date().toISOString() });
  }
  if (btn) { btn.disabled = false; btn.textContent = origLabel; }
  textarea.focus();
}

// Global keyboard shortcut: Ctrl+/ to toggle compose
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === '/') {
    e.preventDefault();
    toggleCompose();
    return;
  }
  if (e.key === 'Escape' && _composeOpen) {
    e.preventDefault();
    closeCompose();
    return;
  }
});

function initCompose() {
  const textarea = document.getElementById('compose-textarea');
  const sendBtn = document.getElementById('compose-send');
  const closeBtn = document.getElementById('compose-close');
  const fab = document.getElementById('compose-fab');
  if (!textarea) return;

  textarea.addEventListener('keydown', e => {
    // Ctrl+Enter / Cmd+Enter → send
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      sendCompose();
      return;
    }
    // Single Enter sends unless multiline (Shift+Enter was used before)
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !e.ctrlKey && !e.metaKey) {
      if (textarea.value.includes('\n')) return;
      e.preventDefault();
      sendCompose();
      return;
    }
    // PageUp/PageDown → scroll terminal while typing (integrated experience)
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      if (typeof queueScroll === 'function') {
        queueScroll(e.key === 'PageUp' ? 'up' : 'down', 20);
      }
      return;
    }
    // Arrow Up/Down with Ctrl → scroll terminal by small steps
    if (e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      if (typeof queueScroll === 'function') {
        queueScroll(e.key === 'ArrowUp' ? 'up' : 'down', 5);
      }
      return;
    }
  });

  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';
  });

  if (sendBtn) sendBtn.addEventListener('click', sendCompose);
  if (closeBtn) closeBtn.addEventListener('click', closeCompose);
  if (fab) fab.addEventListener('click', toggleCompose);

  // Guard against iframe stealing focus while compose is open.
  // xterm.js inside ttyd iframes calls terminal.focus() on load/reconnect,
  // which pulls browser focus into the iframe. Detect and restore.
  window.addEventListener('blur', () => {
    if (!_composeOpen) return;
    // window.blur fires when focus moves into an iframe — reclaim it
    setTimeout(() => {
      if (_composeOpen && document.activeElement !== textarea) {
        textarea.focus();
      }
    }, 50);
  });
}
