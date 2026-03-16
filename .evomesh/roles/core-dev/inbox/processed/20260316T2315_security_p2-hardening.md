---
from: security
to: core-dev
priority: P2
type: task
date: 2026-03-16T23:15
status: pending
---

# P2: Auth hardening + Dockerfile supply chain

## SEC-010: Timing side-channel in password comparison

**File**: `src/server/auth.ts:113`

```typescript
// Current (vulnerable to timing attack):
if (hashPassword(password, user.salt) !== user.passwordHash) return null;

// Recommended:
const hash = hashPassword(password, user.salt);
const expected = user.passwordHash;
if (!crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(expected, "hex"))) return null;
```

Low exploitability (network jitter dominates), but easy fix for defense-in-depth.

## SEC-011: Pin claude-code version in Dockerfile

**File**: `docker/Dockerfile:11`

```dockerfile
# Current (supply chain risk):
RUN npm install -g @anthropic-ai/claude-code@latest

# Recommended:
RUN npm install -g @anthropic-ai/claude-code@1.0.34
```

Every build pulls whatever is `@latest`. Pin to a tested version.

## Note: SEC-001/002/003 verified FIXED — nice work! 🔒
