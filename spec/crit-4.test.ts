import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Crit 4 spec (https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/04-instrument/)
// sorted into what a test can hold vs what the crit judges by ear:
//
// mechanically checkable, covered below:
//   - the browser is the instrument — sound made live via the Web Audio API
//   - playable with whatever is at hand — mouse, keyboard or touch
//   - there is no way to play it wrong — no score, no fail state
// already covered elsewhere, no new test needed:
//   - "deployed and live" — CI's deploy/online job
//   - "the starter's invariant checks pass" — spec/invariants.test.ts
//   - "the repo shows the process" — pnpm check:evidence
// judged by a person at the crit, no test can hold these:
//   - it is expressive: the player's choices shape what they hear, and two
//     players sound different
//   - a stranger can play it uninstructed — the opening screen invites the
//     first sound
//   - you can account for how you directed, grounded and corrected the work

function builtScripts(): string {
  const distDir = resolve("dist");
  if (!existsSync(distDir)) return "";
  const collect = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) return collect(full);
      return entry.name.endsWith(".js") ? [full] : [];
    });
  return collect(distDir)
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
}

describe("crit 4: an instrument", () => {
  it("makes sound live via the Web Audio API, not played back from a file", () => {
    const src = builtScripts();
    expect(
      src.length > 0,
      "no built .js found in dist/ — the instrument's script hasn't shipped yet",
    ).toBe(true);
    expect(
      /AudioContext/.test(src),
      "no AudioContext found in the built JS — sound should be synthesised live in the page (OscillatorNode/AudioBufferSourceNode + GainNode off an AudioContext), not played back from a static file",
    ).toBe(true);
  });

  it("is playable with whatever is at hand — a pointer and a keyboard both work", () => {
    const src = builtScripts();
    const hasPointer = /addEventListener\(\s*["'](click|pointerdown|mousedown|touchstart)["']/.test(
      src,
    );
    const hasKeyboard = /addEventListener\(\s*["'](keydown|keyup)["']/.test(src);
    expect(
      hasPointer,
      "no click/pointerdown/mousedown/touchstart listener found — the instrument should respond to a pointer or touch",
    ).toBe(true);
    expect(
      hasKeyboard,
      "no keydown/keyup listener found — the instrument should also be playable from a keyboard",
    ).toBe(true);
  });

  it("has no way to be played wrong — no score, no fail state", () => {
    const distPath = resolve("dist/index.html");
    const src = builtScripts() + (existsSync(distPath) ? readFileSync(distPath, "utf8") : "");
    const failMarkers = /(game\s*over|you\s*(win|lose|lost)|\bscore\b)/i;
    expect(
      failMarkers.test(src),
      "found score/win/lose/game-over language — this week has no score and no fail state (that's next week's C5)",
    ).toBe(false);
  });
});
