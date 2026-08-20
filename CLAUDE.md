# COMP4020 prototype

Your starter repo for a COMP4020 prototype: a static site in HTML/CSS/TypeScript
that builds to plain HTML/CSS/JS and deploys to GitHub Pages. The deployed site
is what gets marked, not this repo.

The
[course website](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/)
publishes this deliverable's brief and spec, and this repo's name tells you
which deliverable applies. Read both before you plan or build.

## How to work in here

- Keep the dev server running (`pnpm dev`) so you see changes as you make them.
- Run `pnpm check` before you push.
- Open the page in a browser and look at it. The rendered page is the truth;
  your mental model of it isn't.
- When a check fails, read its output before you change anything.
- Never commit a red state.

## The link-preview card

`public/card.png` (1200x630) is the image a shared link shows; `index.html`'s
head points at it. Replace it and the `description` meta, and copy the head
block into any new page. The card URL resolves against the page that names it,
like any link --- `./card.png` is wrong one directory down, and nothing in CI
checks it, so look at the deployed head when you add pages.

## The checks

`pnpm check` runs them (`pnpm check:evidence` is the extra gate before you
ship); CI runs the same plus links, secrets and the deploy. Read the failure.

`spec/README.md`, `PROCESS.md` and `reflections/README.md` are in this repo and
say what they are for.

## This file is yours

A starting point, not a rulebook. As you learn what your prototype needs --- a
convention the work has to hold to, a sensor that keeps catching you out (a
linter, say), a fact about the stack that is easy to get wrong --- write it down
here and wire it into `check`. Growing this file is the work.

## What this prototype has learned

Facts about this stack that are easy to get wrong, and the sensors that now
catch them. Add to this list rather than re-learning an item the hard way.

- **A green graded test can prove nothing.** `spec/crit-4.test.ts` concatenates
  *every* `.js` under `dist/` before matching, so vendoring Tone.js made its
  `AudioContext` assertion pass with no instrument written at all.
  `spec/roundhouse.test.ts` pins the same contract to `dist/roundhouse.js`
  specifically. When a check goes green, ask what it actually read.
- **The listener regexes match a literal string argument.** `addEventListener`
  with an event name held in a variable, or looped over a list, works perfectly
  in the browser and still fails the graded test. Write at least one of each
  longhand.
- **`score` is a banned token**, along with `game over` / `you win` / `you lose`
  / `you lost`, anywhere in `dist/index.html` or any shipped `.js` — copy,
  comment, class name, id or variable. Vocabulary that stays clear of it:
  groove, loop, bar, step, pattern, pass, hit, strike. Scope any grep to
  `dist/`; `.claude/` is never built.
- **`.ts` is not copied to `dist/`.** `scripts/build-static.mjs` copies
  `.html .css .js .mjs` plus media verbatim. There is no bundler and no
  transpile, so shipped code is hand-written browser JavaScript. No CDN
  `<script src="https://…">` either: CI runs a link check and the site must
  stand alone.
- **Vendored libraries need `-text` in `.gitattributes`.** Without it,
  `core.autocrlf=true` rewrites their line endings on checkout and the file on
  disk stops matching the bytes that were reviewed and grepped.
- **`og:image` resolves against the page, not the repo root.** `public/card.png`
  ships to `dist/public/card.png`, so the correct value is `./public/card.png`.
  Nothing in CI checks it — a broken card shows up in the course gallery.
