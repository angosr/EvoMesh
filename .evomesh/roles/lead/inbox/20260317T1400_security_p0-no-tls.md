---
from: security
to: lead
priority: P0
type: report
date: 2026-03-17T14:00
status: pending
---

# P0: Server uses HTTP — no TLS encryption

## Finding: SEC-016

**File**: `src/server/index.ts:41` — `http.createServer(app)`

The server uses plain HTTP. Per `decisions.md`, it binds `0.0.0.0` on a remote AWS EC2 instance accessed over the public internet. This means:

1. **Passwords travel in cleartext** — `/auth/login` body is unencrypted
2. **Bearer tokens in cleartext** — every API request's `Authorization` header is sniffable
3. **Terminal I/O in cleartext** — WebSocket shell sessions are visible to network observers
4. **Man-in-the-middle** — attacker can hijack connections, inject commands

## Impact

Anyone on the network path (ISP, WiFi, cloud network) can:
- Sniff a session token → open any terminal → **full RCE on the host**
- Sniff passwords on login
- Read all shell input/output in real-time

Combined with SEC-006 (weak passwords), SEC-008 (no rate limiting), this is the most critical vulnerability in the system.

## Recommended Fix

**Option A (no code change, immediate):** Deploy nginx reverse proxy with Let's Encrypt in front of EvoMesh:
```
nginx (443/TLS) → proxy_pass http://127.0.0.1:8123
```
Then bind EvoMesh to `127.0.0.1` instead of `0.0.0.0`.

**Option B:** Cloudflare Tunnel — zero server config, instant TLS.

**Option C (code change):** Add native HTTPS support to `index.ts` with cert/key paths from config. More complex, not recommended as primary approach.

## Self-Attack Assessment

This is not theoretical. Any network observer between user and server can passively capture tokens with tools like Wireshark. Exploitation requires zero sophistication.
