import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// A guard the graded suite cannot provide for itself.
//
// spec/crit-4.test.ts concatenates EVERY .js under dist/ before matching. Once
// Tone.js is vendored, that concatenation includes 345KB of third-party code,
// and its AudioContext assertion went green here with no instrument written at
// all -- a passing graded test that proved nothing about our work.
//
// These tests pin the same contract to the instrument's OWN script, so a green
// crit-4 run means our code satisfies it rather than a library's. They also
// make the vendored file's banned-word guarantee executable instead of a note
// in vendor/README.md, because that guarantee is per-file and a version bump
// silently invalidates it.

const OURS = resolve("dist/roundhouse.js");
const VENDORED = resolve("dist/vendor/tone.js");

const read = (path: string): string => (existsSync(path) ? readFileSync(path, "utf8") : "");

describe("the instrument's own script carries the contract", () => {
  it("ships as dist/roundhouse.js", () => {
    expect(
      existsSync(OURS),
      "dist/roundhouse.js is missing -- the vendored library alone can satisfy crit-4's AudioContext check, so this must exist independently",
    ).toBe(true);
  });

  it("reaches AudioContext itself, not only through the vendored library", () => {
    expect(
      /AudioContext/.test(read(OURS)),
      "no AudioContext in dist/roundhouse.js -- crit-4 would still pass off vendor/tone.js, which is exactly the false green this guards",
    ).toBe(true);
  });

  it("registers a pointer listener with a literal event name", () => {
    expect(
      /addEventListener\(\s*["'](click|pointerdown|mousedown|touchstart)["']/.test(read(OURS)),
      "crit-4 matches a literal string argument: an event name held in a variable, or a forEach over a list, works in the browser but fails the graded regex",
    ).toBe(true);
  });

  it("registers a keyboard listener with a literal event name", () => {
    expect(
      /addEventListener\(\s*["'](keydown|keyup)["']/.test(read(OURS)),
      "same literal-string rule as the pointer listener above",
    ).toBe(true);
  });
});

describe("the vendored library", () => {
  it("ships to dist/", () => {
    expect(
      read(VENDORED).length > 0,
      "dist/vendor/tone.js is missing -- the page loads it before roundhouse.js, so nothing will sound",
    ).toBe(true);
  });

  it("carries no language the graded regex bans", () => {
    expect(
      /(game\s*over|you\s*(win|lose|lost)|\bscore\b)/i.test(read(VENDORED)),
      "the vendored build matches crit-4's banned-word regex -- that guarantee is per-file, so re-check it whenever the library version changes",
    ).toBe(false);
  });
});
