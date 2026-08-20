# Process overview

## What I built

**Roundhouse** — an eight-pad drum machine that records you while you play it.
A hit sounds the instant it lands and is captured into a one-bar loop, quantised
to sixteenths, so a few gestures in you are building a groove. Where you strike
a pad sets its pitch and weight.

## How I built it

None of the four steps was me typing the instrument. `comp4020:start` cloned the
repo, carried my `CLAUDE.md` forward and pulled this crit's spec. Then
`pm-discovery` — a skill I wrote — put an agent on Opus in front of me as a
product manager and interviewed me for seven rounds before any code existed:
scope, what a stranger sees first, what gets cut if the week runs short. Its
output is one epic document, done when an agent with no memory of that
conversation could build from it without asking me anything. `epic-dispatch`,
also mine, cut that into eight dependency-tagged tasks and an isolated worktree,
and Sonnet executed them. The task numbers are still on the commits.

The plan had to be that exact because three passes wrote into one tree at once —
and mine had left the instrument's insides unspecified. I spent the first pass
on `index.html` alone, pinning every id and class as a contract the other two
built against. Nothing was renamed across the three
([`2183e25`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-hadissuryaalamin/commit/2183e25)).

## The moments that mattered

### Nothing in the build could hear

The agent called the instrument working and `pnpm check` agreed. Both were
reading a clock: headless Chrome gives a real `AudioContext` and no output
device, so nothing was ever heard, and the timing numbers were good. Trusting
them was the obvious move. Instead I made listening my job mid-build — a
standing instruction that anything settleable only by ear comes back to me
first. What I then heard was the loop replaying my groove with none of the
feedback a live hit gets. Two causes, neither reachable by re-reading code: the
ripple was never called on the replay path, and the playhead ran 49.1 ms ahead
of the sound. Now 1.3 ms ([`25674d1`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-hadissuryaalamin/commit/25674d1)).

### A graded check went green on code I didn't write

Vendoring Tone.js turned this crit's "sound made live via the Web Audio API"
check green before the instrument existed: the test concatenates every `.js`
under `dist/`, and the library says `AudioContext` five times. Banking that was
the obvious move. Instead I pinned the same contract to `dist/roundhouse.js` in
a test of my own, and wrote two rules into `CLAUDE.md` — that one, and its
mirror: the graded regex matches a **literal** event name, so the tidy refactor,
looping over an array of names, leaves a working instrument failing a check. The
new assertions stayed red a whole task and went green only against an
`AudioContext` that gates the boot ([`b3842e5`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-hadissuryaalamin/commit/b3842e5),
[`b3842e5...0da5e1e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-hadissuryaalamin/compare/b3842e5...0da5e1e)).
