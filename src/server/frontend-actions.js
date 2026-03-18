// ==================== Role Actions (Account, Start/Stop, Config) ====================
// Extracted from frontend.js for file size compliance (<500 lines)
// Depends on: authFetch, esc, API, appendFeedMessage, fetchAll, closePanel from frontend.js

async function switchAccount(slug, roleName, sel) {
  const an = sel.value, opt = sel.selectedOptions[0];
  if (!confirm(`Switch ${roleName} to "${an}"?`)) { fetchAll(); return; }
  try {
    const r = await authFetch(`${API}/projects/${slug}/roles/${roleName}/account`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountName: an, accountPath: opt?.dataset?.path }),
    });
    if (!r.ok) { appendFeedMessage(`Failed to switch account for <strong>${esc(roleName)}</strong>: ${r.status}`, 'system'); return; }
    const d = await r.json();
    if (d.ok) {
      appendFeedMessage(`Account: <strong>${esc(roleName)}</strong> -> ${esc(an)}${d.restarted ? ' (restarting)' : ''}`, 'system');
      closePanel(`${slug}/${roleName}`);
      setTimeout(fetchAll, 5000);
    } else {
      appendFeedMessage(`Failed to switch account for <strong>${esc(roleName)}</strong>`, 'system');
    }
  } catch { appendFeedMessage('Failed to switch account', 'system'); }
}

async function saveAndRestart(slug, roleName) {
  const memInput = document.querySelector(`.res-input[data-slug="${slug}"][data-role="${roleName}"][data-field="memory"]`);
  const cpuInput = document.querySelector(`.res-input[data-slug="${slug}"][data-role="${roleName}"][data-field="cpus"]`);
  const memory = memInput?.value?.trim() || null;
  const cpus = cpuInput?.value?.trim() || null;

  try {
    const r = await authFetch(`${API}/projects/${slug}/roles/${roleName}/config`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memory, cpus }),
    });
    if (!r.ok) {
      appendFeedMessage(`Failed to save config for <strong>${esc(roleName)}</strong>: ${r.status}`, 'system');
      return;
    }
  } catch (e) {
    appendFeedMessage(`Failed to save config for <strong>${esc(roleName)}</strong>`, 'system');
    return;
  }

  await restartRole(slug, roleName);
}

async function restartRole(slug, roleName) {
  if (!confirm(`Restart "${roleName}"? Session will reconnect automatically.`)) return;
  try {
    appendFeedMessage(`Restarting <strong>${esc(roleName)}</strong>...`, 'system');
    const r = await authFetch(`${API}/projects/${slug}/roles/${roleName}/restart`, { method: 'POST' });
    if (!r.ok) { appendFeedMessage(`Failed to restart <strong>${esc(roleName)}</strong>: ${r.status}`, 'system'); return; }
    const d = await r.json();
    if (d.ok) {
      appendFeedMessage(`<strong>${esc(roleName)}</strong> restarting`, 'system');
      closePanel(`${slug}/${roleName}`);
      setTimeout(fetchAll, 5000);
    } else {
      appendFeedMessage(`Failed to restart <strong>${esc(roleName)}</strong>`, 'system');
    }
  } catch { appendFeedMessage('Failed to restart', 'system'); }
}

async function stopRole(slug, roleName) {
  if (!confirm(`Stop "${roleName}"?`)) return;
  try {
    const r = await authFetch(`${API}/projects/${slug}/roles/${roleName}/stop`, { method: 'POST' });
    if (!r.ok) { appendFeedMessage(`Failed to stop <strong>${esc(roleName)}</strong>: ${r.status}`, 'system'); return; }
    const d = await r.json();
    if (d.ok) {
      appendFeedMessage(`<strong>${esc(roleName)}</strong> stopped`, 'system');
      closePanel(`${slug}/${roleName}`);
      setTimeout(fetchAll, 3000);
    } else {
      appendFeedMessage(`Failed to stop <strong>${esc(roleName)}</strong>`, 'system');
    }
  } catch { appendFeedMessage('Failed to stop', 'system'); }
}

async function saveLaunchMode(slug, roleName, mode) {
  try {
    const r = await authFetch(`${API}/projects/${slug}/roles/${roleName}/config`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ launch_mode: mode }),
    });
    if (!r.ok) { appendFeedMessage(`Failed to save launch mode for <strong>${esc(roleName)}</strong>: ${r.status}`, 'system'); return; }
    const d = await r.json();
    if (d.ok) {
      appendFeedMessage(`<strong>${esc(roleName)}</strong> launch mode → ${esc(mode)} (restart to apply)`, 'system');
    } else {
      appendFeedMessage(`Failed to save launch mode for <strong>${esc(roleName)}</strong>`, 'system');
    }
  } catch { appendFeedMessage('Failed to save launch mode', 'system'); }
}
