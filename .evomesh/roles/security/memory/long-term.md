# Long-term Memory

## Architecture Understanding
- Express server on port 8123, binds 0.0.0.0 (intentional, see shared/decisions.md)
- Auth: password-based with PBKDF2 hashing (100K iterations, SHA512, random salt per user)
- Sessions: in-memory Map, token via crypto.randomBytes(32)
- Auth middleware at index.ts:105 protects all /api/* routes
- Terminal proxy has separate auth via extractTerminalToken() in terminal.ts
- Roles run in Docker containers with ttyd terminals proxied through Express

## Key Attack Surface
- Container volume mounts (HOME rw for Central AI, SSH keys for all roles)
- Central AI has host network mode
- Admin endpoints: some check role, some don't (inconsistent)
- Server exposed to network on 0.0.0.0

## Fixed Vulnerabilities (monitor for regression)
- Terminal auth bypass — fixed in terminal.ts
- XSS inline onclick — fixed with addEventListener
- sendInput shell injection — fixed with env var passing
