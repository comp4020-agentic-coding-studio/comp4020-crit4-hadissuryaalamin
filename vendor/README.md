# Vendored library: Tone.js

- **Library:** Tone.js
- **Version:** 15.1.22
- **Licence:** MIT
- **Source:** https://cdn.jsdelivr.net/npm/tone@15.1.22/build/Tone.js
- **File in this repo:** `vendor/tone.js` — the non-minified UMD `build/Tone.js`
  distributed by the Tone.js npm package, saved verbatim (unmodified, not
  reformatted, not tree-shaken).

Tone.js is a Web Audio framework for creating interactive music in the
browser. It is used here to synthesise all drum voices for the Roundhouse
instrument at runtime; no audio files are shipped with this repo.

## Why this file exists

The build (`scripts/build-static.mjs`) only copies files with certain
extensions into `dist/` (`.html .css .js .mjs` plus images/media/fonts).
`.txt` is not among them, so a bundled `Tone.js.LICENSE.txt` sitting alongside
the minified build would never ship to `dist/` and the MIT attribution would
be lost. This `README.md` is the attribution of record for the vendored
copy, in addition to the HTML comment placed in the `<head>` of `index.html`.

## Licence

Tone.js is released under the MIT License. Full licence text:

```
Copyright (c) 2014-2024 Yotam Mann

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```
