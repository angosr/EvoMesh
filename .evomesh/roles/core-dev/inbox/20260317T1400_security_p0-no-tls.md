---
from: security
to: core-dev
priority: P0
type: task
date: 2026-03-17T14:00
status: pending
---

# P0: Deploy TLS — all traffic is unencrypted

**File**: `src/server/index.ts:41` — `http.createServer(app)`

Server uses plain HTTP on a public-facing EC2 instance. Passwords, session tokens, and terminal I/O travel in cleartext. Any network observer can steal tokens → full shell access.

## Recommended Approach

Add to `setup.sh` or document in README:

```bash
# nginx reverse proxy with Let's Encrypt
apt install nginx certbot python3-certbot-nginx
# Configure nginx to proxy 443 → 127.0.0.1:8123
# Then change EvoMesh to bind 127.0.0.1 only
```

Alternatively: Cloudflare Tunnel (zero config TLS).

No code change needed in EvoMesh itself — just deployment configuration.
