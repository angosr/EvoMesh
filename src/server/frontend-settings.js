// Settings panel (profile, password, user management)
// Depends on globals from frontend.js: state, authFetch, API, esc, getCurrentUser, addFeedMessage

// ==================== Settings Panel ====================
function renderSettings() {
  const user = getCurrentUser();
  const isAdmin = user.role === 'admin';

  document.getElementById('profile-info').innerHTML = `
    <dt>Username</dt><dd>${esc(user.username || '?')}</dd>
    <dt>Role</dt><dd><span class="role-badge ${user.role || ''}">${esc(user.role || '?')}</span></dd>`;

  const usersSection = document.getElementById('users-section');
  usersSection.style.display = isAdmin ? 'block' : 'none';
  if (isAdmin) loadUsers();

  const totalRoles = state.projects.reduce((s, p) => s + p.roles.length, 0);
  const runningRoles = state.projects.reduce((s, p) => s + p.roles.filter(r => r.running).length, 0);
  document.getElementById('system-info').innerHTML = `
    <dt>Version</dt><dd>0.1.0</dd>
    <dt>Projects</dt><dd>${state.projects.length}</dd>
    <dt>Roles</dt><dd>${runningRoles} running / ${totalRoles} total</dd>`;

  document.getElementById('pw-old').value = '';
  document.getElementById('pw-new').value = '';
  document.getElementById('pw-confirm').value = '';
  document.getElementById('pw-msg').className = 'settings-msg';
  document.getElementById('pw-msg').textContent = '';
  if (typeof updateThemeButton === 'function') updateThemeButton();
}

async function doChangePassword() {
  const oldPw = document.getElementById('pw-old').value;
  const newPw = document.getElementById('pw-new').value;
  const confirmPw = document.getElementById('pw-confirm').value;
  const msg = document.getElementById('pw-msg');
  const btn = document.querySelector('#pw-form .settings-btn.primary');

  if (!oldPw) { msg.className = 'settings-msg error'; msg.textContent = 'Enter current password'; return; }
  if (!newPw || newPw.length < 4) { msg.className = 'settings-msg error'; msg.textContent = 'New password must be at least 4 characters'; return; }
  if (newPw !== confirmPw) { msg.className = 'settings-msg error'; msg.textContent = 'Passwords do not match'; return; }

  if (btn) { btn.disabled = true; btn.textContent = 'Updating...'; }
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
  if (btn) { btn.disabled = false; btn.textContent = 'Update Password'; }
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
        <td><strong>${esc(u.username)}</strong>${u.username === currentUser ? ' <span style="color:var(--text-faint);font-size:10px">(you)</span>' : ''}</td>
        <td><span class="role-badge ${u.role}">${esc(u.role)}</span></td>
        <td style="color:var(--text-dim);font-size:11px;font-family:var(--font-mono)">${esc(u.linuxUser || '-')}</td>
        <td style="color:var(--text-faint);font-size:11px">${new Date(u.createdAt).toLocaleDateString()}</td>
        <td class="actions">
          <button class="act-btn" data-action="reset-pw" data-username="${esc(u.username)}">Reset PW</button>
          ${u.username !== currentUser ? `<button class="act-btn del" data-action="delete-user" data-username="${esc(u.username)}">Delete</button>` : ''}
        </td>
      </tr>`).join('');
    tbody.querySelectorAll('[data-action="reset-pw"]').forEach(btn => {
      btn.addEventListener('click', () => resetUserPassword(btn.dataset.username));
    });
    tbody.querySelectorAll('[data-action="delete-user"]').forEach(btn => {
      btn.addEventListener('click', () => deleteUser(btn.dataset.username));
    });
  } catch {}
}

function toggleAddUser() {
  const form = document.getElementById('add-user-form');
  form.classList.toggle('show');
  if (form.classList.contains('show')) {
    document.getElementById('new-username').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('new-role').value = 'user';
    const luInput = document.getElementById('new-linuxuser');
    if (luInput) luInput.value = '';
    document.getElementById('add-user-msg').className = 'settings-msg';
    document.getElementById('new-username').focus();
  }
}

async function doAddUser() {
  const username = document.getElementById('new-username').value.trim();
  const password = document.getElementById('new-password').value;
  const role = document.getElementById('new-role').value;
  const linuxUser = document.getElementById('new-linuxuser')?.value?.trim() || '';
  const msg = document.getElementById('add-user-msg');

  if (!username || username.length < 2) { msg.className = 'settings-msg error'; msg.textContent = 'Username must be at least 2 characters'; return; }
  if (!password || password.length < 4) { msg.className = 'settings-msg error'; msg.textContent = 'Password must be at least 4 characters'; return; }

  const addBtn = document.querySelector('#add-user-form .settings-btn.primary');
  if (addBtn) { addBtn.disabled = true; addBtn.textContent = 'Adding...'; }
  try {
    const body = { username, password, role };
    if (linuxUser) body.linuxUser = linuxUser;
    const r = await authFetch(`${API}/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
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
  if (addBtn) { addBtn.disabled = false; addBtn.textContent = 'Add'; }
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
