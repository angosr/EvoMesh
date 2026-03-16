# Review: Registry Closed-Loop + Append-Only Shared Docs Spec

## Part 1: Registry Closed-Loop Gap Analysis

### Design Summary
- Config files (workspace.yaml + project.yaml) = source of truth (what SHOULD exist)
- registry.json = runtime snapshot (what IS running), written by Server every 15s
- Clear write ownership: Server → registry.json, Central AI/roles → config files

### Strengths
1. **Single source of truth** — no conflicting state between components
2. **Clear ownership** — each file has exactly one writer
3. **Reactive**: Server detects config changes → auto-updates registry → Web UI reflects
4. **4 scenarios well-covered** (AI creates role, UI creates role, crash, new project)

### Gaps & Edge Cases Found

**Gap 1: Race condition on project.yaml**
- Central AI and a role (e.g., lead modifying another role's config) could write project.yaml simultaneously
- Git handles this for .evomesh/ files within a repo, but if Central AI writes from HOME scope (outside git), there's no merge protection
- **Recommendation**: Document that only Central AI and Server API may write project.yaml. Roles should never modify it directly — send proposals to lead/Central AI.

**Gap 2: registry.json location when multiple projects**
- registry.json is at `~/.evomesh/registry.json` (global) — good, it aggregates all projects
- But if two Server instances run (different ports), they'd clobber each other's registry
- **Recommendation**: Include `server.pid` or `server.port` in registry.json. Second instance should refuse to start or use a different file.

**Gap 3: Stale registry after Server crash**
- If Server crashes, registry.json has stale `timestamp` but containers may still run
- Web UI or Central AI reading old registry may think roles are "running" when Server is down
- **Recommendation**: Consumers should check `timestamp` freshness. If `> 30s old`, treat registry as stale and show warning. This aligns with the heartbeat.json freshness model.

**Gap 4: Config file validation**
- If Central AI writes invalid YAML to project.yaml, Server scan will fail silently or crash
- **Recommendation**: Server should validate project.yaml on each scan. If invalid, log error + keep last-known-good state in registry.json + flag the error.

**Gap 5: No "desired state" for running/stopped**
- project.yaml says what roles EXIST but not whether they SHOULD be running
- When Server discovers a new role in config, should it auto-start? Or wait for user?
- **Recommendation**: Add optional `auto_start: true|false` field to role config in project.yaml. Default: `false` (explicit start required).

**Gap 6: heartbeat.json integration**
- registry.json tracks container state (Docker level). heartbeat.json tracks session state (Claude level).
- Mission Control needs BOTH for accurate status: 🟢 = container running + heartbeat fresh
- **Recommendation**: When heartbeat.json is implemented (Phase 2), Server should read it during the 15s scan and include `session_alive: true|false` in registry.json per role.

### Verdict
Design is solid. 6 edge cases found, none are blockers. Gaps 1, 3, 4 should be addressed before production use. Others can be deferred.

---

## Part 2: Append-Only Shared Docs Format Spec

### Problem
`shared/decisions.md` is currently a flat markdown file that any role can edit. Concurrent edits (multiple roles committing decisions simultaneously) risk git merge conflicts. The current format also allows editing/deleting existing entries, which breaks audit trail.

### Spec: Append-Only Log Format

**File**: `shared/decisions.md` (keep current name per lead's caveat — no rename)

**Convention**: Append-only. New entries go at the BOTTOM. Never edit or delete existing entries.

**Entry format**:
```markdown
## [{date}] {title}

**决策**: {what was decided}
**原因**: {why}
**提出者**: {role-name}
**状态**: active | superseded-by-{date}

---
```

**Rules**:
1. **Append only** — add new entries at bottom, never modify existing
2. **Supersede, don't edit** — to change a decision, add a new entry with `supersedes: [{old-date}] {old-title}` and mark old entry's status as `superseded-by-{new-date}`
3. **One decision per entry** — don't bundle unrelated decisions
4. **Date header is the ID** — use `[YYYY-MM-DD]` format for reference

**Why not rename to .log?**
Lead noted user has strong opinions on the filename. The append-only convention is enforced by protocol, not file extension.

**Git merge behavior**:
Append-only files merge cleanly in git when multiple roles add entries simultaneously — git's default merge handles appended lines without conflict.

### Also apply to: `shared/blockers.md`
Same append-only convention. Each role owns their section. Clear own blockers by appending a resolution entry, not by deleting.
