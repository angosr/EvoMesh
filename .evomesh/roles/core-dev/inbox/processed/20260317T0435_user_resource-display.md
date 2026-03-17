---
from: user
priority: P1
type: task
date: 2026-03-17T04:35
---

# Dashboard Resources column shows empty — should show actual container usage

## Problem
Resources inputs (mem/cpu) show empty because project.yaml has no memory/cpus configured for most roles. User expects to see actual container resource usage.

## Fix
In `/api/projects/:slug/status`, for each running role, query actual container stats:

```typescript
// Get actual container resource usage
let actualMem = null, actualCpus = null;
if (running) {
  try {
    const stats = execFileSync("docker", [
      "stats", "--no-stream", "--format", "{{.MemUsage}}|{{.CPUPerc}}",
      containerName(slugify(path.basename(p.root)), name)
    ], { encoding: "utf-8", timeout: 5000 }).trim();
    const [mem, cpu] = stats.split("|");
    actualMem = mem; // e.g. "354MiB / 31.2GiB"
    actualCpus = cpu; // e.g. "22.6%"
  } catch {}
}
```

Return both configured limits AND actual usage:
```json
{
  "memory": "2g",           // configured limit (from project.yaml)
  "cpus": "1.5",            // configured limit
  "actualMem": "354MiB",    // current usage
  "actualCpu": "22.6%"      // current usage
}
```

Frontend: show actual usage as placeholder/hint in the input fields:
```
placeholder="${r.actualMem || 'mem'}"
```
So user sees "354MiB" as gray text in the input, and can type a limit to set.
