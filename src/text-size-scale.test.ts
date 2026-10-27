import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Text takes its size from the scale in index.css (text-ui-*, text-chat*), never a one-off pixel
// size: 13 of those crept in, down to 8.5px, and a screen built from them reads as unfinished.
const ROOT = join(__dirname);
// Fluid Functionalism's own type scale, which sizes its components from tokens of its own.
const ALLOWED = new Set(["lib/type-scale.ts"]);
const FIXED_SIZE = /\btext-\[(?:[0-9.]+(?:px|rem|em)|length:var\(--(?:redesign|fs)-[a-z0-9-]+(?:,[^)]*)?\))\]/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe("text sizes", () => {
  it("come from the scale, not a fixed size", () => {
    const offenders = sourceFiles(ROOT).flatMap((path) => {
      const file = relative(ROOT, path);
      if (ALLOWED.has(file)) return [];
      const text = readFileSync(path, "utf8");
      return [...text.matchAll(FIXED_SIZE)].map((match) => `${file}: ${match[0]}`);
    });
    expect(offenders).toEqual([]);
  });
});
