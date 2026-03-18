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

// ==================== Quick Compose Dialog ====================
let _composeOpen = false;

function toggleCompose() {
  _composeOpen ? closeCompose() : openCompose();
}

function openCompose() {
  const dialog = document.getElementById('compose-dialog');
  const textarea = document.getElementById('compose-textarea');
  const fab = document.getElementById('compose-fab');
  if (!dialog) return;
  dialog.classList.add('open');
  if (fab) fab.classList.add('hidden');
  _composeOpen = true;
  setTimeout(() => textarea.focus(), 50);
}

function closeCompose() {
  const dialog = document.getElementById('compose-dialog');
  const fab = document.getElementById('compose-fab');
  if (!dialog) return;
  dialog.classList.remove('open');
  if (fab) fab.classList.remove('hidden');
  _composeOpen = false;
  focusActiveIframe();
}

async function sendCompose() {
  const textarea = document.getElementById('compose-textarea');
  const btn = document.getElementById('compose-send');
  const text = textarea?.value?.trim();
  if (!text) return;
  await _sendMessage(text, textarea, btn);
  // Keep dialog open for follow-up messages — just clear and refocus
  textarea.focus();
}

// Global keyboard shortcut: Ctrl+/ to toggle compose
document.addEventListener('keydown', e => {
  // Ctrl+/ (or Cmd+/ on mac) — toggle compose
  if ((e.ctrlKey || e.metaKey) && e.key === '/') {
    e.preventDefault();
    toggleCompose();
    return;
  }
  // Escape closes compose if open
  if (e.key === 'Escape' && _composeOpen) {
    e.preventDefault();
    closeCompose();
    return;
  }
});

// Compose textarea handlers (called after DOM ready)
function initCompose() {
  const textarea = document.getElementById('compose-textarea');
  const sendBtn = document.getElementById('compose-send');
  const closeBtn = document.getElementById('compose-close');
  const fab = document.getElementById('compose-fab');
  if (!textarea) return;

  textarea.addEventListener('keydown', e => {
    // Ctrl+Enter or Cmd+Enter to send
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      sendCompose();
      return;
    }
    // Plain Enter without Shift also sends (quick-fire mode)
    // But only if not composing (IME) and not multiline intent
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !e.ctrlKey && !e.metaKey) {
      // If text has newlines already (user used Shift+Enter before), don't auto-send
      if (textarea.value.includes('\n')) return;
      e.preventDefault();
      sendCompose();
    }
  });

  // Auto-resize textarea as user types
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  });

  if (sendBtn) sendBtn.addEventListener('click', sendCompose);
  if (closeBtn) closeBtn.addEventListener('click', closeCompose);
  if (fab) fab.addEventListener('click', toggleCompose);
}
