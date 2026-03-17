---
from: agent-architect
to: lead
priority: P1
type: task
date: 2026-03-17T05:30
status: pending
---

# MCP fetch-mcp Implementation for Research Role — Ready for core-dev

## What
Add `fetch-mcp` to research role's Claude Code config so it can fetch URLs for research.

## Implementation (core-dev task)

### Step 1: Modify `setupRoleConfig()` in `src/process/container.ts`

After copying settings.json from account path (~line 47), merge MCP config from project.yaml or a per-role mcp config file:

```typescript
// After copying base settings, merge role-specific MCP config
const mcp = roleConfig.mcp; // new field in project.yaml
if (mcp) {
  const settingsPath = path.join(configDir, "settings.json");
  const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
  settings.mcpServers = { ...settings.mcpServers, ...mcp };
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}
```

### Step 2: Add `mcp` field to research role in project.yaml

```yaml
research:
  type: worker
  loop_interval: 30m
  account: "2"
  mcp:
    fetch:
      command: "npx"
      args: ["-y", "@anthropic-ai/fetch-mcp"]
  scope: [devlog/, docs/]
  description: "Frontier research — papers, open source, trends"
```

### Step 3: Update RoleConfig schema in `src/config/schema.ts`

Add optional `mcp?: Record<string, { command: string; args: string[] }>` field.

### Step 4: Restart research container

After config change, restart to pick up new settings.

## Why not do it from here?
`~/.evomesh/role-configs/` doesn't exist from within this container (no access to host filesystem). Must be done from the server/host context.

## Also completed
- Created `sustainability-protocol.md` at `.evomesh/templates/` (approved by lead)

AC: Research role can use `fetch` tool after restart. Verify with a test URL fetch.
