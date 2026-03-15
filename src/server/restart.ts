import { execFileSync } from "node:child_process";

/**
 * Kill any process listening on the given TCP port.
 * Returns true if something was killed.
 */
export function killPortHolder(port: number): boolean {
  try {
    // Use lsof to find PIDs on the port (works on Linux and macOS)
    const out = execFileSync("lsof", ["-ti", `tcp:${port}`], { encoding: "utf-8" }).trim();
    if (!out) return false;

    const pids = out.split("\n").map(s => parseInt(s, 10)).filter(n => !isNaN(n) && n > 0);
    for (const pid of pids) {
      try { process.kill(pid, "SIGTERM"); } catch {}
    }

    // Wait briefly for processes to exit
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const alive = pids.some(pid => {
        try { process.kill(pid, 0); return true; } catch { return false; }
      });
      if (!alive) break;
      // Busy-wait in small increments
      execFileSync("sleep", ["0.2"], { stdio: "ignore" });
    }

    // Force kill any survivors
    for (const pid of pids) {
      try { process.kill(pid, "SIGKILL"); } catch {}
    }

    return true;
  } catch {
    return false;
  }
}
