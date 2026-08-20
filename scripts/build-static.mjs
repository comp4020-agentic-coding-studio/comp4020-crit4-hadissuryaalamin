#!/usr/bin/env node

// Bare-stack build: copy the site into dist/ as-is. Written by the course
// stack skill. Hand-written pages use relative URLs, so no base-path handling
// is needed for GitHub Pages.

import fs from "node:fs";
import path from "node:path";

const SKIP = new Set(["node_modules", "dist", "spec", "scripts", "reflections"]);
const COPY_EXTS = new Set([
  ".html", ".css", ".js", ".mjs",
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif", ".ico", ".bmp",
  ".mp4", ".webm", ".mov", ".mp3", ".ogg", ".wav", ".flac",
  ".woff", ".woff2", ".ttf", ".otf", ".eot", ".pdf",
]);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith(".") || SKIP.has(entry.name)) return [];
    const p = dir === "." ? entry.name : path.join(dir, entry.name);
    return entry.isDirectory() ? walk(p) : [p];
  });
}

fs.rmSync("dist", { recursive: true, force: true });
let copied = 0;
for (const file of walk(".")) {
  if (!COPY_EXTS.has(path.extname(file).toLowerCase())) continue;
  fs.mkdirSync(path.join("dist", path.dirname(file)), { recursive: true });
  fs.copyFileSync(file, path.join("dist", file));
  copied += 1;
}
console.log(`build-static: copied ${copied} files to dist/`);
