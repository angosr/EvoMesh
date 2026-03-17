// ==================== Role Actions (Account, Start/Stop, Config) ====================
// Extracted from frontend.js for file size compliance (<500 lines)
// Depends on: authFetch, esc, API, addFeedMessage, fetchAll, closePanel from frontend.js

async function switchAccount(slug, roleName, sel) {
  const an = sel.value, opt = sel.selectedOptions[0];
  if (!confirm(`Switch ${roleName} to "${an}"?`)) { fetchAll(); return; }
  try {
    const r = await authFetch(`${API}/projects/${slug}/roles/${roleName}/account`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountName: an, accountPath: opt?.dataset?.path }),
    });
    const d = await r.json();
    if (d.ok) {
      addFeedMessage(`Account: <strong>${esc(roleName)}</strong> -> ${esc(an)}${d.restarted ? ' (restarting)' : ''}`, 'system');
      closePanel(`${slug}/${roleName}`);
      setTimeout(fetchAll, 5000);
    }
  } catch { addFeedMessage('Failed', 'system'); }
}

async function saveAndRestart(slug, roleName) {
  const memInput = document.querySelector(`.res-input[data-slug="${slug}"][data-role="${roleName}"][data-field="memory"]`);
  const cpuInput = document.querySelector(`.res-input[data-slug="${slug}"][data-role="${roleName}"][data-field="cpus"]`);
  const memory = memInput?.value?.trim() || null;
  const cpus = cpuInput?.value?.trim() || null;

  try {
    await authFetch(`${API}/projects/${slug}/roles/${roleName}/config`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memory, cpus }),
    });
  } catch {}

  await restartRole(slug, roleName);
}

async function restartRole(slug, roleName) {
  if (!confirm(`Restart "${roleName}"? Session will reconnect automatically.`)) return;
  try {
    addFeedMessage(`Restarting <strong>${esc(roleName)}</strong>...`, 'system');
    const r = await authFetch(`${API}/projects/${slug}/roles/${roleName}/restart`, { method: 'POST' });
    const d = await r.json();
    if (d.ok) {
      addFeedMessage(`<strong>${esc(roleName)}</strong> restarting`, 'system');
      closePanel(`${slug}/${roleName}`);
      setTimeout(fetchAll, 5000);
    }
  } catch { addFeedMessage('Failed', 'system'); }
}

async function stopRole(slug, roleName) {
  if (!confirm(`Stop "${roleName}"?`)) return;
  try {
    const r = await authFetch(`${API}/projects/${slug}/roles/${roleName}/stop`, { method: 'POST' });
    const d = await r.json();
    if (d.ok) {
      addFeedMessage(`<strong>${esc(roleName)}</strong> stopped`, 'system');
      closePanel(`${slug}/${roleName}`);
      setTimeout(fetchAll, 3000);
    }
  } catch { addFeedMessage('Failed to stop', 'system'); }
}

async function saveLaunchMode(slug, roleName, mode) {
  try {
    const r = await authFetch(`${API}/projects/${slug}/roles/${roleName}/config`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ launch_mode: mode }),
    });
    const d = await r.json();
    if (d.ok) addFeedMessage(`<strong>${esc(roleName)}</strong> launch mode → ${esc(mode)} (restart to apply)`, 'system');
  } catch { addFeedMessage('Failed to save launch mode', 'system'); }
}
