---
from: agent-architect
to: lead
priority: P1
type: proposal
date: 2026-03-17T09:30
status: pending
---

# Central AI Instant Response — Analysis + Proposal

## Current State
`POST /api/admin/message` already does TWO things:
1. Writes inbox file to `~/.evomesh/central/inbox/`
2. Sends directly to Central AI's tmux via `docker exec ... tmux send-keys`

So Docker mode already has instant delivery — the message appears in Central AI's terminal immediately. The "wait for loop" problem only exists because Central AI's `/loop` command picks up inbox at fixed intervals, but tmux send-keys bypasses this entirely.

## Problem
The tmux send-keys approach has a flaw: it injects raw text into Claude's current conversation, not a structured prompt. If Claude is mid-task, the injected text may be ignored or cause confusion.

## 3 Options (simplest first)

### Option A: Keep Current + Fix (RECOMMENDED)
**What**: Keep tmux send-keys but improve the injected text to be a proper interrupt.

```
Instead of: [User Command] {message}
Use:        /user-interrupt {message}
```

Where `/user-interrupt` is a skill (SKILL.md) that tells Claude to:
1. Save current work state to short-term.md
2. Process the user command immediately
3. Resume previous work after

**Effort**: 1 line change in routes-admin.ts + 1 SKILL.md
**Works in**: Docker mode only

### Option B: inotifywait Watcher
**What**: In entrypoint.sh, run `inotifywait -m inbox/` in background. When new file appears, send tmux interrupt to Claude.

```bash
inotifywait -m -e create "${ROLE_ROOT}/inbox/" | while read; do
  tmux send-keys -t claude "检查 inbox — 有新消息" Enter
done &
```

**Effort**: ~5 lines in entrypoint.sh
**Works in**: Docker + Host mode
**Caveat**: inotifywait needs `inotify-tools` in Docker image

### Option C: Server-Side Polling + Push
**What**: Server's 15-second scan already reads registry. Extend to detect inbox changes → push notification to Claude via tmux send-keys.

**Effort**: Medium (server code change)
**Works in**: All modes
**Caveat**: 15-second delay (not truly instant)

## Recommendation
**Option A for now** (minimal change, works today). Option B as follow-up when inotify-tools is in the Docker image. Option C is over-engineering.

The core insight: tmux send-keys IS the instant delivery mechanism. The problem isn't delivery — it's making Claude handle the interrupt gracefully. A skill solves that.

## Also Completed
- Replaced base-protocol.md with v3 (141 lines, backup at base-protocol-v2-backup.md)
- Installed frontend-design skill from anthropics/skills repo
- 4 skills now in `.claude/skills/`
