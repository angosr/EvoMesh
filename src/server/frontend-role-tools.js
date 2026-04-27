let _roleTemplatesCache = null;

function roleAccountOptions(provider, selectedPath = '') {
  const providerName = provider || 'claude';
  const defaultLabel = providerName === 'codex' ? 'Provider Default (~/.codex)' : 'Provider Default (~/.claude)';
  const options = [`<option value="">${esc(defaultLabel)}</option>`];
  state.accounts
    .filter(a => (a.provider || 'claude') === providerName)
    .forEach(a => {
      options.push(`<option value="${esc(a.path)}"${selectedPath === a.path ? ' selected' : ''}>${esc(formatAccountOptionLabel(a))}</option>`);
    });
  return options.join('');
}

async function loadRoleTemplates() {
  if (_roleTemplatesCache) return _roleTemplatesCache;
  const res = await authFetch(`${API}/templates`);
  const data = await res.json();
  _roleTemplatesCache = data.templates || [];
  return _roleTemplatesCache;
}

function showRoleModal(title, bodyHtml) {
  const overlay = document.createElement('div');
  overlay.className = 'copy-modal-overlay';
  overlay.innerHTML = `<div class="copy-modal" style="width:680px;max-width:95vw">
    <div class="copy-modal-header">
      <span>${esc(title)}</span>
      <button class="copy-modal-close" data-role-close>&times;</button>
    </div>
    ${bodyHtml}
  </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('[data-role-close]')?.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  return { overlay, close };
}

async function openCreateRoleModal(slug) {
  const project = state.projects.find(p => p.slug === slug);
  if (!project) return;
  const templates = await loadRoleTemplates();
  const templateOptions = templates.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
  const { overlay, close } = showRoleModal(`Add Role: ${project.name}`, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <label style="font-size:12px;color:var(--text-dim)">Role Name
        <input id="role-create-name" style="width:100%;margin-top:4px;padding:8px;background:var(--bg-input);border:1px solid var(--border);color:var(--text);border-radius:var(--radius-sm)" placeholder="e.g. codex-dev">
      </label>
      <label style="font-size:12px;color:var(--text-dim)">Role Kind
        <select id="role-create-kind" style="width:100%;margin-top:4px;padding:8px;background:var(--bg-input);border:1px solid var(--border);color:var(--text);border-radius:var(--radius-sm)">
          <option value="agent">Template Agent</option>
          <option value="terminal">Bare Terminal</option>
        </select>
      </label>
      <label id="role-create-template-wrap" style="font-size:12px;color:var(--text-dim)">Template
        <select id="role-create-template" style="width:100%;margin-top:4px;padding:8px;background:var(--bg-input);border:1px solid var(--border);color:var(--text);border-radius:var(--radius-sm)">
          ${templateOptions}
        </select>
      </label>
      <label style="font-size:12px;color:var(--text-dim)">Account
        <select id="role-create-account" style="width:100%;margin-top:4px;padding:8px;background:var(--bg-input);border:1px solid var(--border);color:var(--text);border-radius:var(--radius-sm)">
          ${roleAccountOptions('claude')}
        </select>
      </label>
      <label style="font-size:12px;color:var(--text-dim)">Provider
        <select id="role-create-provider" style="width:100%;margin-top:4px;padding:8px;background:var(--bg-input);border:1px solid var(--border);color:var(--text);border-radius:var(--radius-sm)">
          <option value="claude">Claude</option>
          <option value="codex">Codex</option>
        </select>
      </label>
      <label style="font-size:12px;color:var(--text-dim)">Launch Mode
        <select id="role-create-launch" style="width:100%;margin-top:4px;padding:8px;background:var(--bg-input);border:1px solid var(--border);color:var(--text);border-radius:var(--radius-sm)">
          <option value="docker">docker</option>
          <option value="host">host</option>
        </select>
      </label>
    </div>
    <label style="display:block;margin-top:10px;font-size:12px;color:var(--text-dim)">Description
      <input id="role-create-description" style="width:100%;margin-top:4px;padding:8px;background:var(--bg-input);border:1px solid var(--border);color:var(--text);border-radius:var(--radius-sm)" placeholder="What this role is for">
    </label>
    <div id="role-create-help" style="margin-top:8px;font-size:11px;color:var(--text-faint)"></div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="dash-action" id="role-create-save">Create</button>
      <button class="dash-action danger" id="role-create-cancel">Cancel</button>
    </div>
  `);

  const kindEl = overlay.querySelector('#role-create-kind');
  const providerEl = overlay.querySelector('#role-create-provider');
  const accountEl = overlay.querySelector('#role-create-account');
  const templateWrap = overlay.querySelector('#role-create-template-wrap');
  const helpEl = overlay.querySelector('#role-create-help');

  const sync = () => {
    const kind = kindEl.value;
    const provider = providerEl.value;
    const selectedPath = accountEl.value;
    accountEl.innerHTML = roleAccountOptions(provider, selectedPath);
    templateWrap.style.display = kind === 'agent' ? 'block' : 'none';
    helpEl.textContent = provider === 'codex'
      ? 'Codex roles start with provider default login unless you explicitly pick a Codex account. Loop can be enabled later.'
      : kind === 'terminal'
        ? 'Bare Terminal creates only the terminal workspace directory, without ROLE.md template initialization.'
        : 'Claude roles start with provider default login unless you explicitly pick a Claude account.';
  };

  kindEl.addEventListener('change', sync);
  providerEl.addEventListener('change', sync);
  sync();

  overlay.querySelector('#role-create-cancel')?.addEventListener('click', close);
  overlay.querySelector('#role-create-save')?.addEventListener('click', async () => {
    const payload = {
      name: overlay.querySelector('#role-create-name')?.value?.trim(),
      kind: kindEl.value,
      template: overlay.querySelector('#role-create-template')?.value,
      accountPath: overlay.querySelector('#role-create-account')?.value || '',
      provider: providerEl.value,
      launch_mode: overlay.querySelector('#role-create-launch')?.value,
      description: overlay.querySelector('#role-create-description')?.value?.trim() || '',
      automation_mode: providerEl.value === 'codex' ? 'manual' : undefined,
    };
    if (!payload.name) { overlay.querySelector('#role-create-name')?.focus(); return; }
    const res = await authFetch(`${API}/projects/${slug}/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) { alert(data.error || 'Failed to create role'); return; }
    appendFeedMessage(`Role <strong>${esc(payload.name)}</strong> created [${esc(payload.kind)}]`, 'system');
    close();
    fetchAll();
  });
}

function openRoleEditModal(slug, roleName) {
  const project = state.projects.find(p => p.slug === slug);
  const role = project?.roles?.find(r => r.name === roleName);
  if (!role) return;
  const isCodex = (role.provider || 'claude') === 'codex';
  const enabled = isCodex && role.automation_mode === 'prompt';
  const prompt = role.automation_prompt || '';
  const { overlay, close } = showRoleModal(`Edit Role: ${roleName}`, `
    <label style="display:block;font-size:12px;color:var(--text-dim)">Description
      <input id="role-edit-description" value="${esc(role.description || '')}" style="width:100%;margin-top:4px;padding:8px;background:var(--bg-input);border:1px solid var(--border);color:var(--text);border-radius:var(--radius-sm)">
    </label>
    <label style="display:block;margin-top:10px;font-size:12px;color:var(--text-dim)">Interval
      <input id="role-loop-interval" value="${esc(role.loop_interval || '10m')}" style="width:100%;margin-top:4px;padding:8px;background:var(--bg-input);border:1px solid var(--border);color:var(--text);border-radius:var(--radius-sm)">
    </label>
    ${isCodex ? `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-md);margin-bottom:12px">
      <div>
        <div style="font-size:13px;color:var(--text)">Scheduled Prompt Loop</div>
        <div style="font-size:11px;color:var(--text-faint)">Turn recurring prompt injection on or off for this Codex role.</div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;color:var(--text);font-size:12px">
        <input type="checkbox" id="role-loop-enabled"${enabled ? ' checked' : ''}>
        <span id="role-loop-state">${enabled ? 'On' : 'Off'}</span>
      </label>
    </div>
    <label style="display:block;margin-top:10px;font-size:12px;color:var(--text-dim)">Prompt
      <textarea id="role-loop-prompt" rows="8" placeholder="Write the prompt Codex should receive each cycle..." style="width:100%;margin-top:4px;padding:8px;background:var(--bg-input);border:1px solid var(--border);color:var(--text);border-radius:var(--radius-sm);font-family:var(--font-mono);font-size:12px">${esc(prompt)}</textarea>
    </label>
    ` : `
    <div style="margin-top:12px;padding:10px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-md);font-size:11px;color:var(--text-faint)">
      Claude roles use native /loop. External scheduled prompt loop is only available for Codex roles.
    </div>
    `}
    <div id="role-loop-help" style="margin-top:8px;font-size:11px;color:var(--text-faint)"></div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="dash-action" id="role-loop-save">${isCodex ? (enabled ? 'Save' : 'Save & Enable') : 'Save'}</button>
      <button class="dash-action danger" id="role-loop-disable"${isCodex && enabled ? '' : ' disabled'}>Disable Loop</button>
      <button class="dash-action" id="role-loop-cancel">Cancel</button>
    </div>
  `);

  const enabledEl = overlay.querySelector('#role-loop-enabled');
  const stateEl = overlay.querySelector('#role-loop-state');
  const promptEl = overlay.querySelector('#role-loop-prompt');
  const disableBtn = overlay.querySelector('#role-loop-disable');
  const saveBtn = overlay.querySelector('#role-loop-save');
  const helpEl = overlay.querySelector('#role-loop-help');
  const descEl = overlay.querySelector('#role-edit-description');

  const sync = () => {
    if (!isCodex) {
      helpEl.textContent = 'You can update the role description and interval here at any time.';
      return;
    }
    const on = !!enabledEl.checked;
    stateEl.textContent = on ? 'On' : 'Off';
    disableBtn.disabled = !on;
    saveBtn.textContent = on ? 'Save' : 'Save & Enable';
    helpEl.textContent = on
      ? 'Loop is enabled. Saving will update the prompt and interval immediately.'
      : 'Loop is off. Turn it on and save whenever you want to start recurring prompts.';
  };
  if (enabledEl) enabledEl.addEventListener('change', sync);
  sync();

  overlay.querySelector('#role-loop-cancel')?.addEventListener('click', close);
  saveBtn.addEventListener('click', async () => {
    const payload = {
      description: descEl?.value?.trim() || '',
      loop_interval: overlay.querySelector('#role-loop-interval')?.value?.trim() || '10m',
    };
    if (isCodex) {
      const promptValue = promptEl.value.trim();
      if (enabledEl.checked && !promptValue) { promptEl.focus(); return; }
      payload.automation_mode = enabledEl.checked ? 'prompt' : 'manual';
      payload.automation_prompt = promptValue;
    }
    const res = await authFetch(`${API}/projects/${slug}/roles/${roleName}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) { alert(data.error || 'Failed to save role settings'); return; }
    appendFeedMessage(`${isCodex ? 'Codex loop updated' : 'Role updated'} for <strong>${esc(roleName)}</strong>`, 'system');
    close();
    fetchAll();
  });
  disableBtn.addEventListener('click', async () => {
    if (!isCodex) return;
    const res = await authFetch(`${API}/projects/${slug}/roles/${roleName}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: descEl?.value?.trim() || '',
        automation_mode: 'manual',
        automation_prompt: promptEl.value.trim(),
        loop_interval: overlay.querySelector('#role-loop-interval')?.value?.trim() || '10m',
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) { alert(data.error || 'Failed to disable loop'); return; }
    appendFeedMessage(`Codex loop disabled for <strong>${esc(roleName)}</strong>`, 'system');
    close();
    fetchAll();
  });
}

function openRoleAutomationModal(slug, roleName) {
  openRoleEditModal(slug, roleName);
}

async function toggleCodexLoopQuick(slug, roleName) {
  const project = state.projects.find(p => p.slug === slug);
  const role = project?.roles?.find(r => r.name === roleName);
  if (!role || (role.provider || 'claude') !== 'codex') return;
  const currentPrompt = (role.automation_prompt || '').trim();
  if (role.automation_mode === 'prompt') {
    const res = await authFetch(`${API}/projects/${slug}/roles/${roleName}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: role.description || '',
        loop_interval: role.loop_interval || '10m',
        automation_mode: 'manual',
        automation_prompt: currentPrompt,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) { alert(data.error || 'Failed to disable loop'); return; }
    appendFeedMessage(`Codex loop disabled for <strong>${esc(roleName)}</strong>`, 'system');
    fetchAll();
    return;
  }
  if (!currentPrompt) {
    openRoleEditModal(slug, roleName);
    return;
  }
  const res = await authFetch(`${API}/projects/${slug}/roles/${roleName}/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: role.description || '',
      loop_interval: role.loop_interval || '10m',
      automation_mode: 'prompt',
      automation_prompt: currentPrompt,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) { alert(data.error || 'Failed to enable loop'); return; }
  appendFeedMessage(`Codex loop enabled for <strong>${esc(roleName)}</strong>`, 'system');
  fetchAll();
}
