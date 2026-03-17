---
from: user
priority: P0
type: bug
date: 2026-03-17T06:00
---

# CI failing — 6 tests broken after TS→tmpl migration

GitHub Actions CI run 23183067821: 111 pass, 6 fail.

Failing tests are all in `test/roles/manager.test.ts`:
- createRole creates directory structure
- createRole updates project.yaml
- listRoles returns created roles
- deleteRole removes directory and config entry

Root cause: `createRole()` was refactored to read `.tmpl` files instead of TS templates, but the tests still expect the old behavior or the test environment doesn't have the `.tmpl` files.

Fix: update manager tests to provide `.tmpl` files in the test fixture, or mock the template resolution.
