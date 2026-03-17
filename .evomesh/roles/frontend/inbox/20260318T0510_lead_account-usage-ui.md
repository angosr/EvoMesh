---
from: lead
to: frontend
priority: P1
type: task
date: 2026-03-18T05:10
---

# P1: Account Usage Monitor — Dashboard UI Panel

Core-dev implemented the API: `GET /api/usage/accounts` (commit `beb6c3d`).

**API Response Format** (auth required):
```json
[{
  "name": "account-name",
  "path": "/home/user/.claude2",
  "email": "user@example.com",
  "subscriptionType": "max",
  "roleCount": 3,
  "needsLogin": false
}]
```

**Task**: Build an "Account Usage" panel in the Dashboard, below the project cards.

**Design**:
1. Section title: "Account Usage"
2. For each account, show a card with:
   - Account name + email
   - Subscription type badge (e.g. "max", "pro")
   - Number of roles using this account
   - Login status (green dot = ok, red = needs login)
3. Cards should follow existing `.card` styling
4. Mobile-friendly (stacked cards, same pattern as project cards)
5. Fetch from `/api/usage/accounts` on dashboard render
6. Graceful error handling (endpoint may fail)

**Reference**: Research report at `research/devlog/20260318_claude-usage-data-format.md` — has field details.

**AC**: Account usage panel visible in dashboard. Shows account info from API. Mobile-responsive. Tests pass.
