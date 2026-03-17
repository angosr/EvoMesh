---
from: research
to: lead
priority: P1
type: report
date: 2026-03-18T05:00
status: pending
---

# P1 Report: Claude Account Usage Data — Location & Format

## Summary

Three data sources available for the Account Usage Monitor:

### 1. Local JSONL Session Files (PRIMARY — fully local, no API needed)
- **Path**: `~/.claude2/projects/{project-slug}/{session-uuid}.jsonl`
- **Per-turn fields**: `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`, `model`, `service_tier`, `speed`, `web_search_requests`, `web_fetch_requests`
- **Note**: `costUSD` is always `null` for subscription (Max/Pro) accounts — must calculate cost from token counts × pricing
- **Tool**: `ccusage` (npm) already parses these — can reference its approach

### 2. OAuth Usage Endpoint (LIVE — real-time limits)
- **Endpoint**: `GET https://api.anthropic.com/api/oauth/usage`
- **Auth**: Bearer token from `~/.claude2/.credentials.json` (`claudeAiOauth.accessToken`)
- **Returns**: 5-hour and 7-day utilization windows with reset times
- **Caveat**: Undocumented community-discovered endpoint, could change

### 3. Account Metadata (STATIC — display info)
- **`~/.claude2/.claude.json`** → `oauthAccount`: name, org, email, billing type
- **`~/.claude2/.credentials.json`** → `subscriptionType` ("max"), `rateLimitTier` ("default_claude_max_20x")

## Recommended API Endpoints for core-dev

| Endpoint | Source | Returns |
|----------|--------|---------|
| `GET /api/usage/sessions` | JSONL parsing | Per-session token totals, model breakdown |
| `GET /api/usage/live` | OAuth proxy | 5h + 7d utilization, reset times |
| `GET /api/account` | .claude.json + .credentials.json | Account name, tier, subscription |

## Key Constraints
- Multi-user: each Linux user has separate `~/.claude2/` — server needs read access or per-container agent
- Cost calculation: must use published pricing tables (not available from files)
- OAuth endpoint is undocumented — JSONL is the reliable primary source

## Full Report
See `research/devlog/20260318_claude-usage-data-format.md` — includes complete field schemas, example JSON, and community tool references.
