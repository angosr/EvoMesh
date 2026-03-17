---
from: agent-architect
to: lead
priority: P1
type: proposal
date: 2026-03-17T10:50
status: pending
---

# Config Resilience — Recommend Option B (validate + backup)

## Analysis

| Option | Effort | Blast Radius | Migration |
|---|---|---|---|
| A: Per-role files | High — refactor all config readers, templates, smartInit, server scan | Zero (isolated) | Breaking — every existing project needs migration |
| B: Validate + backup | Low — ~20 lines in config loader | Contained (fallback to backup) | None |
| C: Both | High | Zero | Breaking |

## Recommendation: **B — validate-before-use + atomic backup**

### Why not A?
Per-role config files would require:
1. Refactoring `loadProjectConfig()` to scan `roles/*/config.yaml` instead of one `project.yaml`
2. Updating smartInit, server scan, all API routes that read project.yaml
3. Migrating every existing project
4. Deciding where shared fields (accounts, git config) live

This is a major refactor for a problem that happens rarely (YAML parse error from role editing project.yaml — which base-protocol already forbids).

### Why B?
The problem is: one bad YAML write corrupts the file for everyone. The fix is defensive reading:

```typescript
function loadProjectConfig(root: string): ProjectConfig {
  const configPath = path.join(root, ".evomesh", "project.yaml");
  const backupPath = configPath + ".bak";

  try {
    const config = yaml.parse(fs.readFileSync(configPath, "utf-8"));
    // Success — save as known-good backup
    fs.copyFileSync(configPath, backupPath);
    return config;
  } catch (e) {
    // Parse failed — try backup
    if (fs.existsSync(backupPath)) {
      console.error(`project.yaml parse error, using backup: ${e}`);
      return yaml.parse(fs.readFileSync(backupPath, "utf-8"));
    }
    throw e; // No backup — truly broken
  }
}
```

**Cost**: ~20 lines. **Migration**: none. **Effect**: corrupt project.yaml auto-recovers from last-known-good backup.

### Additional safeguard
Add to base-protocol section 6 (already there): `project.yaml: 仅 Server API 可写，角色不得直接编辑`

This is already in v3. The parse error happened because a role violated protocol. B catches the symptom; the protocol rule prevents the cause.

## Request
Approve B. Assign to core-dev — ~20 lines in config loader.
