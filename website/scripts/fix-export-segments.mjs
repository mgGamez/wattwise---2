// Post-build fix for the static export (Next.js 16.4, output: "export").
//
// The exporter writes per-route prefetch payloads as nested files, e.g.
//   out/analyze/__next.analyze/__PAGE__.txt
// but the client router requests the dotted form
//   out/analyze/__next.analyze.__PAGE__.txt
// (the root route is already written dotted). Without this step every client
// navigation logs a 404 and falls back to a slower full fetch. We add a dotted
// copy next to each nested payload so any static file host serves both.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../out");
let copied = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (!entry.isDirectory()) continue;
    if (entry.name === "_next") continue;
    if (entry.name.startsWith("__next.")) {
      // flatten every file below this __next.<segment>/ directory into dotted names
      const stack = [[full, entry.name]];
      while (stack.length) {
        const [d, prefix] = stack.pop();
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, e.name);
          if (e.isDirectory()) stack.push([p, `${prefix}.${e.name}`]);
          else {
            const target = path.join(dir, `${prefix}.${e.name}`);
            if (!fs.existsSync(target)) {
              fs.copyFileSync(p, target);
              copied++;
            }
          }
        }
      }
    } else walk(full);
  }
}

if (fs.existsSync(OUT)) {
  walk(OUT);
  console.log(`[wattwise] static export: added ${copied} dotted prefetch payload(s)`);
}
