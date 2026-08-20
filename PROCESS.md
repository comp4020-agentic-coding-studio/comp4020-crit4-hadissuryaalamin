# Process overview

## What I built

**Roundhouse** — an eight-pad drum machine that records you while you play it.
A hit sounds the instant it lands and is captured into a one-bar loop at the
same time, quantised to sixteenths, so a few gestures in you are building a
groove. Where you strike a pad sets its pitch and weight, so the same kit
sounds different in two people's hands.

## The moments that mattered

### A graded check went green on code I didn't write

Vendoring Tone.js turned crit 4's "sound made live via the Web Audio API" check
green before a line of the instrument existed: that test concatenates every
`.js` under `dist/`, and the library says `AudioContext` five times. Banking the
green was the obvious move. Instead I pinned the same contract to
`dist/roundhouse.js` in `spec/roundhouse.test.ts`, and wrote two rules into
`CLAUDE.md` — that one, and its mirror image: the graded regex matches a
**literal** event name, so the tidy refactor — looping over an array of event
names — would leave a perfectly working instrument failing a check. I knew it
had taken when the new assertions stayed red for a whole task and went green
only against an `AudioContext` that gates the boot, and when two later passes
over that file kept every listener longhand unprompted
([`b3842e5`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-hadissuryaalamin/commit/b3842e5),
[`b3842e5...0da5e1e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-hadissuryaalamin/compare/b3842e5...0da5e1e)).

### 345 KB of somebody else's code

`vendor/tone.js` ships verbatim into `dist/`, where one match against the crit's
banned-word pattern fails a graded check for the whole page. I grepped the
download before committing it — zero matches — and then made that guarantee hold
instead of trusting it: `vendor/* -text` in `.gitattributes`, because
`core.autocrlf` on Windows rewrites line endings on checkout, so the file on
disk stops being the file I read. Confirmed by `dist/vendor/tone.js` coming out
byte-identical at 345,500 bytes after a clean build
([`537735a...ee4231d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-hadissuryaalamin/compare/537735a...ee4231d)).

### Three agents, one working tree

Markup, stylesheet and instrument logic were about to be written in parallel
into one tree, and my plan had left the inside of the instrument unspecified.
Rather than let each pass invent its own selectors and reconcile later, I spent
the first on `index.html` alone and pinned every id, class, `data-*` and custom
property as a contract the other two built against. It held: the stylesheet
pass matched every selector back to a real element, and nothing was renamed
across the three
([`2183e25`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-hadissuryaalamin/commit/2183e25)).
