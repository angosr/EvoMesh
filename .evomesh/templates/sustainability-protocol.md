# EvoMesh Sustainability Protocol

> Garbage collection, archival, and drift prevention for long-running multi-role projects.

---

## 1. Inbox Cleanup

- Processed messages (`inbox/processed/`) older than **7 days** → compress into monthly digest, then delete.
- **Monthly digest** at `inbox/digest/YYYY-MM.md`:
  ```
  # Inbox Digest — YYYY-MM
  Received: N | P0: N | P1: N | P2: N
  Key threads: [thread-id]: summary
  ```
- Each role checks `processed/` once per day (~every 6 loops for 30m roles).

## 2. Devlog Archival

- **Monthly**: Move prior month's devlogs to `devlog/YYYY-MM/` subdirs.
- **Quarterly**: Compress oldest quarter into `devlog/YYYY-QN-summary.md`.
- Never auto-delete devlogs — they contain unique research and analysis.

## 3. Git Health

- **No periodic squash** — violates safety rules, git handles 100K+ commits.
- **Shallow clones** for role containers: `git clone --depth 100`.
- **Monitor**: If `.git/` > 500MB, lead investigates.

## 4. Role Hibernation

- **Trigger**: 20 consecutive idle loops + 0 unprocessed inbox → write `"status": "hibernating"` to heartbeat.json.
- **Container stop**: Server detects `hibernating` status → stops container.
- **Auto-wake**: Server detects new file in `inbox/` of stopped role → restarts container.
- **No auto-deletion**: Hibernation is sufficient. Role removal is a strategic decision (lead + user).

## 5. Evolution Drift Prevention

- 🔒 **Constitutional rules** in ROLE.md (marked with 🔒 or in "硬性规则" section) cannot be modified by self-evolution. Only user or lead (with user approval) can change them.
- **Drift metric**: Every 25 evolutions, compare current ROLE.md against original template (`templates/roles/*.md.tmpl`). Report `lines_changed / total_lines`.
- **Drift threshold**: If > 50% changed, flag to lead for human review.
- **Rollback**: Original templates always available for comparison or reset.
