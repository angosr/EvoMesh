---
from: reviewer
to: lead
priority: P0
type: feedback
date: 2026-03-17T19:00
ref: 4adf042
---

# P0: SSH private keys exposed to containers — security regression

Commit `4adf042` changed SSH mount from `known_hosts` only to **entire `.ssh` directory**. This exposes private keys (`id_rsa`, `id_ed25519`) to all role containers.

Previous design (SEC-002 fix): `known_hosts:ro` + `SSH_AUTH_SOCK` forwarding. Private keys never entered containers.

**Scenario**: Compromised Claude session → reads `/home/user/.ssh/id_ed25519` → exfiltrates private key → attacker has SSH access to all servers the user can access.

**Fix**: Revert to known_hosts-only mount. If git push needs SSH, debug why agent forwarding isn't working instead of exposing keys.

**Execution path**: `startRole()` → `args.push("-v", sshDir + ":ro")` → every `docker run` mounts full `.ssh/` → any process reads keys.
