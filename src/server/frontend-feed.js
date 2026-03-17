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

  // SSE stream for role updates
  try {
    const es = new EventSource(`${API}/feed/stream?token=${encodeURIComponent(AUTH_TOKEN)}`);
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'user-message') return; // Already displayed locally
        appendFeedMessage(msg);
      } catch {}
    };
  } catch {}

  // Send button
  const sendBtn = document.getElementById('feed-send');
  const msgInput = document.getElementById('feed-msg');
  if (sendBtn) sendBtn.addEventListener('click', sendFeedMsg);
  if (msgInput) msgInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendFeedMsg(); }
  });

  // Try to start central AI if not running
  authFetch(`${API}/admin/status`).then(r => r.json()).then(s => {
    if (!s.running) authFetch(`${API}/admin/start`, { method: 'POST' }).catch(() => {});
  }).catch(() => {});
}

function appendFeedMessage(msg) {
  const feed = document.getElementById('feed');
  if (!feed) return;
  const div = document.createElement('div');
  div.className = `feed-item feed-${msg.type || 'system'}`;

  const time = msg.time ? new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  if (msg.type === 'role') {
    const color = ROLE_COLORS[msg.role] || '#888';
    const proj = msg.project ? `<span class="feed-project">${esc(msg.project)}</span>` : '';
    div.innerHTML = `${proj}<span class="feed-role" style="color:${color}">${esc(msg.role || '')}</span>
      <span class="feed-time">${esc(time)}</span>
      <div class="feed-text">${esc(msg.text || '')}</div>`;
  } else if (msg.type === 'central') {
    div.innerHTML = `<span class="feed-role" style="color:#ef4444">Central AI</span>
      <span class="feed-time">${esc(time)}</span>
      <div class="feed-text">${esc(msg.text || '')}</div>`;
  } else if (msg.type === 'user-message') {
    div.innerHTML = `<div class="feed-text">${esc(msg.text || '')}</div>`;
  } else {
    div.innerHTML = `<div class="feed-text feed-system-text">${esc(msg.text || '')}</div>`;
  }

  feed.appendChild(div);
  feed.scrollTop = feed.scrollHeight;
  while (feed.children.length > 200) feed.removeChild(feed.firstChild);
}

async function sendFeedMsg() {
  const input = document.getElementById('feed-msg');
  const text = input?.value?.trim();
  if (!text) return;
  const btn = document.getElementById('feed-send');
  if (btn) { btn.disabled = true; btn.textContent = '...'; }
  appendFeedMessage({ type: 'user-message', text, time: new Date().toISOString() });
  input.value = '';
  if (input.style) input.style.height = 'auto';
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
  if (btn) { btn.disabled = false; btn.textContent = '➤'; }
  input.focus();
}
