import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Transitions run at the tiers in lib/springs.ts, so a hover or a fade feels the same everywhere.
// 280ms is the sidebar collapse (in step with its width), 500/700ms are whole-screen scene changes.
const TIERS = new Set(["0", "80", "160", "240", "[280ms]", "360", "400", "500", "700"]);
const ROOT = join(__dirname);
const DURATION = /\bduration-(\[[^\]]+\]|[0-9]+)(?![\w[])/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe("transition durations", () => {
  it("use the motion tiers", () => {
    const offenders = sourceFiles(ROOT).flatMap((path) =>
      [...readFileSync(path, "utf8").matchAll(DURATION)]
        .filter((match) => !TIERS.has(match[1]))
        .map((match) => `${relative(ROOT, path)}: ${match[0]}`),
    );
    expect(offenders).toEqual([]);
  });
});
