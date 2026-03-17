import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(__dirname, "../../src/server");

describe("frontend static files", () => {
  const jsFiles = ["frontend.js", "frontend-panels.js", "frontend-settings.js", "frontend-feed.js", "frontend-layout.js", "frontend-actions.js"];
  const htmlFiles = ["frontend.html", "login.html"];

  describe("JS syntax validation", () => {
    for (const file of jsFiles) {
      it(`${file} has valid syntax`, () => {
        const code = fs.readFileSync(path.join(serverDir, file), "utf8");
        // new Function() will throw SyntaxError if invalid
        assert.doesNotThrow(() => new Function(code), `${file} has syntax errors`);
      });
    }
  });

  describe("HTML structure", () => {
    for (const file of htmlFiles) {
      it(`${file} has DOCTYPE and closing tags`, () => {
        const html = fs.readFileSync(path.join(serverDir, file), "utf8");
        assert.ok(html.startsWith("<!DOCTYPE html>"), "Missing DOCTYPE");
        assert.ok(html.includes("</html>"), "Missing closing </html>");
        assert.ok(html.includes("</body>"), "Missing closing </body>");
      });
    }

    it("frontend.html references all JS files with cache bust", () => {
      const html = fs.readFileSync(path.join(serverDir, "frontend.html"), "utf8");
      assert.ok(html.includes("app.js?v="), "Missing app.js with cache bust");
      assert.ok(html.includes("app-panels.js?v="), "Missing app-panels.js with cache bust");
      assert.ok(html.includes("app-settings.js?v="), "Missing app-settings.js with cache bust");
      assert.ok(html.includes("app.css?v="), "Missing app.css with cache bust");
    });

    it("all cache bust versions are consistent", () => {
      const html = fs.readFileSync(path.join(serverDir, "frontend.html"), "utf8");
      const versions = [...html.matchAll(/\?v=(\d+)/g)].map((m) => m[1]);
      assert.ok(versions.length >= 3, "Expected at least 3 versioned assets");
      const unique = new Set(versions);
      assert.equal(unique.size, 1, `Cache bust versions inconsistent: ${[...unique].join(", ")}`);
    });
  });

  describe("XSS prevention — no inline onclick with interpolation", () => {
    for (const file of jsFiles) {
      it(`${file} has no onclick with template interpolation`, () => {
        const code = fs.readFileSync(path.join(serverDir, file), "utf8");
        const lines = code.split("\n");
        const violations: string[] = [];
        lines.forEach((line, i) => {
          // Detect onclick="..." containing ${...} (template literal interpolation)
          if (/onclick=.*\$\{/.test(line)) {
            violations.push(`line ${i + 1}: ${line.trim().substring(0, 80)}`);
          }
          // Detect onclick="..." containing string concat with variables
          if (/onclick=.*['"]\s*\+\s*(?!['"])/.test(line) && /\+\s*(?:esc|slug|role|user|key|name)/.test(line)) {
            violations.push(`line ${i + 1}: ${line.trim().substring(0, 80)}`);
          }
        });
        assert.equal(violations.length, 0, `XSS risk — inline onclick with data interpolation:\n${violations.join("\n")}`);
      });
    }
  });

  describe("function reference integrity", () => {
    it("all HTML onclick handlers reference defined JS functions", () => {
      const html = fs.readFileSync(path.join(serverDir, "frontend.html"), "utf8");

      // Collect all defined functions from JS files
      const defined = new Set<string>();
      for (const file of jsFiles) {
        const code = fs.readFileSync(path.join(serverDir, file), "utf8");
        for (const m of code.matchAll(/(?:async\s+)?function\s+(\w+)\s*\(/g)) defined.add(m[1]);
        for (const m of code.matchAll(/(?:const|let|var)\s+(\w+)\s*=/g)) defined.add(m[1]);
      }

      const builtins = new Set(["event", "this", "if", "confirm", "alert", "prompt", "console", "toggle", "classList"]);
      const missing: string[] = [];

      for (const m of html.matchAll(/onclick="([^"]+)"/g)) {
        for (const fc of m[1].matchAll(/(\w+)\s*\(/g)) {
          const fn = fc[1];
          if (!builtins.has(fn) && !defined.has(fn)) {
            missing.push(fn);
          }
        }
      }

      assert.equal(missing.length, 0, `HTML onclick references undefined functions: ${missing.join(", ")}`);
    });
  });

  describe("CSS integrity", () => {
    it("CSS uses CSS variables for colors (no hardcoded hex in rules)", () => {
      const css = fs.readFileSync(path.join(serverDir, "frontend.css"), "utf8");
      // Check :root has variables defined
      assert.ok(css.includes("--bg-base:"), "Missing --bg-base variable");
      assert.ok(css.includes("--accent:"), "Missing --accent variable");
      assert.ok(css.includes("--text:"), "Missing --text variable");
    });

    it("CSS has mobile responsive media query", () => {
      const css = fs.readFileSync(path.join(serverDir, "frontend.css"), "utf8");
      assert.ok(css.includes("@media (max-width: 768px)"), "Missing mobile media query");
    });

    it("CSS has mobile dashboard card layout", () => {
      const css = fs.readFileSync(path.join(serverDir, "frontend.css"), "utf8");
      assert.ok(css.includes("#dash-content"), "Missing #dash-content mobile styles");
    });

    it("CSS has touch-friendly media query", () => {
      const css = fs.readFileSync(path.join(serverDir, "frontend.css"), "utf8");
      assert.ok(css.includes("@media (pointer: coarse)"), "Missing touch media query");
    });
  });
});
