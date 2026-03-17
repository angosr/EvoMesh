# Research Report — 2026-03-18: Claude Account Usage Data Format

## Task
Investigate where Claude CLI stores usage/rate-limit information, document data format, and identify approaches for an Account Usage Monitor dashboard feature.

## New Findings

### 1. Local File-Based Usage Data

#### Session JSONL Files (PRIMARY SOURCE)
- **Location**: `~/.claude2/projects/{project-slug}/{session-uuid}.jsonl`
- **Format**: JSONL (one JSON object per line)
- **Record types**: `user`, `assistant`, `custom-title`, `file-history-snapshot`

**Assistant message usage fields** (per-turn token tracking):
```json
{
  "type": "assistant",
  "message": {
    "model": "claude-opus-4-6",
    "usage": {
      "input_tokens": 3,
      "cache_creation_input_tokens": 1314,
      "cache_read_input_tokens": 16156,
      "output_tokens": 133,
      "server_tool_use": {
        "web_search_requests": 0,
        "web_fetch_requests": 0
      },
      "service_tier": "standard",
      "cache_creation": {
        "ephemeral_1h_input_tokens": 1314,
        "ephemeral_5m_input_tokens": 0
      },
      "inference_geo": "",
      "iterations": [],
      "speed": "standard"
    }
  },
  "costUSD": null,
  "timestamp": "...",
  "sessionId": "uuid",
  "requestId": "..."
}
```

**Key fields available per assistant turn**:
| Field | Description |
|-------|-------------|
| `input_tokens` | Non-cached input tokens (after last cache breakpoint) |
| `cache_creation_input_tokens` | Tokens written to cache |
| `cache_read_input_tokens` | Tokens read from cache |
| `output_tokens` | Generated output tokens |
| `server_tool_use.web_search_requests` | Web search tool calls |
| `server_tool_use.web_fetch_requests` | Web fetch tool calls |
| `service_tier` | "standard" or "priority" |
| `speed` | "standard" or "fast" |
| `model` | Model ID (e.g., "claude-opus-4-6") |

**Note**: `costUSD` is always `null` for subscription accounts (Max/Pro). Only populated for API-key (pay-per-token) usage.

#### Aggregate Tool/Skill Usage (in `.claude.json`)
- **Location**: `~/.claude2/.claude.json`
- **Fields**: `toolUsage` and `skillUsage` — per-tool/skill usage counts + last-used timestamps
- Not useful for token-level monitoring, but shows tool adoption patterns

#### OAuth Account Data (in `.claude.json`)
- **`oauthAccount`** field contains: `accountUuid`, `emailAddress`, `organizationUuid`, `organizationName`, `billingType` ("stripe_subscription"), `hasExtraUsageEnabled`, `subscriptionCreatedAt`, `displayName`, `organizationRole`

#### Credentials (in `.credentials.json`)
- **Location**: `~/.claude2/.credentials.json`
- **Key fields**: `subscriptionType` ("max"), `rateLimitTier` ("default_claude_max_20x"), `accessToken`, `refreshToken`, `expiresAt`
- The `rateLimitTier` field is useful for displaying the account's tier

### 2. OAuth Usage API Endpoint (LIVE USAGE DATA)

Community-discovered endpoint for real-time subscription usage:
```
GET https://api.anthropic.com/api/oauth/usage
Authorization: Bearer {accessToken from .credentials.json}
```

Returns 5-hour and 7-day usage windows with utilization percentages and reset times. This is the same data Claude Code uses internally for the `/cost` command and statusline display.

**Authentication**: Uses the OAuth `accessToken` from `~/.claude2/.credentials.json`. On macOS, can also be retrieved from Keychain (`security find-generic-password -s "Claude Code-credentials" -w`).

Source: [codelynx.dev statusline guide](https://codelynx.dev/posts/claude-code-usage-limits-statusline)

### 3. API Rate Limit Response Headers (FOR API-KEY ACCOUNTS)

Every Anthropic API response includes rate limit headers:

| Header | Description |
|--------|-------------|
| `anthropic-ratelimit-requests-limit` | Max requests per minute |
| `anthropic-ratelimit-requests-remaining` | Requests remaining in window |
| `anthropic-ratelimit-requests-reset` | RFC 3339 reset timestamp |
| `anthropic-ratelimit-tokens-limit` | Max tokens per minute |
| `anthropic-ratelimit-tokens-remaining` | Tokens remaining (rounded to 1000s) |
| `anthropic-ratelimit-tokens-reset` | RFC 3339 reset timestamp |
| `anthropic-ratelimit-input-tokens-limit` | Max input tokens per minute |
| `anthropic-ratelimit-input-tokens-remaining` | Input tokens remaining |
| `anthropic-ratelimit-output-tokens-limit` | Max output tokens per minute |
| `anthropic-ratelimit-output-tokens-remaining` | Output tokens remaining |

Source: [Anthropic Rate Limits docs](https://platform.claude.com/docs/en/api/rate-limits)

### 4. Existing Community Tools

| Tool | Approach | Source |
|------|----------|--------|
| [ccusage](https://github.com/ryoppippi/ccusage) | Parses local JSONL files, calculates costs | `npx ccusage@latest report daily` |
| [Claude-Code-Usage-Monitor](https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor) | Real-time terminal monitoring + ML predictions | Python, reads local data |

### 5. Directory Naming Convention
- `~/.claude/` — Claude Code v1 (legacy, may not exist)
- `~/.claude2/` — Current Claude Code data directory
- No `~/.claude3/` or higher on this system
- Multi-account: different Linux users = different `~/.claude2/` dirs (aligns with EvoMesh multi-user isolation)

## Analysis

**Best approach for EvoMesh Account Usage Monitor**:

1. **Primary data source**: Parse `~/.claude2/projects/*/uuid.jsonl` files for per-session token usage. This is fully local, no API calls needed, and provides granular per-turn data including model, tokens, cache stats, and tool usage.

2. **Live usage/limits**: Call the OAuth usage endpoint (`/api/oauth/usage`) using the stored `accessToken` from `.credentials.json`. This gives real-time 5-hour and 7-day utilization — critical for preventing rate limit hits across multiple roles.

3. **Account metadata**: Read `oauthAccount` from `.claude.json` for display (account name, org, billing type) and `rateLimitTier` from `.credentials.json` for tier display.

4. **Multi-user support**: Each Linux user's `~/.claude2/` is separate. The EvoMesh server process needs read access to each user's `.claude2/` directory (or a per-user agent that reports its own usage).

**What WON'T work**:
- `costUSD` field is always `null` for subscription accounts — cost must be calculated from token counts using published pricing
- API rate limit headers are only available when making API calls (not for subscription/OAuth users using Claude Code)

## Recommendations

### 1. **IMPLEMENT**: JSONL parser route in Express server
- Endpoint: `GET /api/usage/:user` or `/api/usage/current`
- Parse `~/.claude2/projects/*/uuid.jsonl` → aggregate tokens by session/day/model
- Calculate cost from token counts × published per-token prices
- Return: `{ sessions: [...], daily: [...], totalTokens, estimatedCost }`

### 2. **IMPLEMENT**: OAuth usage proxy endpoint
- Endpoint: `GET /api/usage/live`
- Read `accessToken` from `~/.claude2/.credentials.json`
- Proxy `GET https://api.anthropic.com/api/oauth/usage`
- Return: 5-hour + 7-day utilization, reset times
- **Security note**: Token must be read server-side only, never exposed to browser

### 3. **IMPLEMENT**: Account info endpoint
- Endpoint: `GET /api/account`
- Read from `.claude.json` (`oauthAccount`) + `.credentials.json` (`subscriptionType`, `rateLimitTier`)
- Return: account name, org, tier, subscription type

### 4. **DEFER**: Per-role usage attribution
- Would require correlating JSONL sessionIds to EvoMesh role sessions
- Valuable but complex — defer to after basic usage monitor works

## Self-Attack
- *"Is the OAuth usage endpoint stable?"* — It's undocumented/community-discovered. Could break. Mitigation: JSONL parsing as primary, OAuth endpoint as enhancement.
- *"Token-to-cost calculation accurate?"* — Published pricing changes. Mitigation: make pricing configurable, default to current rates.
- *"Multi-user file access?"* — Reading another user's `~/.claude2/` requires permissions. Solution: per-container agent reporting own usage via file or API, or shared volume mount.
