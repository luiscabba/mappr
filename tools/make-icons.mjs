/**
 * Rasterise assets/icon.svg into the PNG sizes the web app manifest and iOS need.
 *
 *   node tools/make-icons.mjs
 *
 * The favicon itself is the SVG, inlined into index.html by build.py. These PNGs
 * exist only for install surfaces (Android home screen, iOS, app switchers),
 * which cannot use an SVG and cannot adapt to a colour scheme, so they are drawn
 * once. Since 1.12.0 the mark is the tile itself, which carries its own Field
 * ground, so the "any" icons are the tile edge to edge and only the maskable
 * one is inset on Field to survive a circular crop.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SVG = fs.readFileSync(path.join(ROOT, "assets", "icon.svg"), "utf8")
  // PNGs cannot react to prefers-color-scheme, so bake the light palette in.
  .replace(/@media[^{]*\{[\s\S]*?\}\s*\}/g, "");

const FIELD = "#121212";

// pad is the share of the tile left empty around the mark.
const JOBS = [
  { file: "icons/icon-192.png", size: 192, pad: 0, bg: FIELD },
  { file: "icons/icon-512.png", size: 512, pad: 0, bg: FIELD },
  // Maskable icons get cropped to a circle or squircle: keep the tile inside.
  { file: "icons/maskable-512.png", size: 512, pad: 0.14, bg: FIELD },
  { file: "icons/apple-touch-icon.png", size: 180, pad: 0, bg: FIELD },
];

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
for (const j of JOBS) {
  const inner = Math.round(j.size * (1 - j.pad * 2));
  const page = await browser.newPage({ viewport: { width: j.size, height: j.size }, deviceScaleFactor: 1 });
  await page.setContent(
    '<!doctype html><meta charset="utf-8">' +
    '<style>html,body{margin:0;width:' + j.size + 'px;height:' + j.size + 'px;background:' + j.bg + ';' +
    'display:flex;align-items:center;justify-content:center}svg{width:' + inner + 'px;height:' + inner + 'px}</style>' +
    SVG
  );
  const out = path.join(ROOT, j.file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out, omitBackground: false });
  await page.close();
  console.log("wrote " + j.file + "  " + j.size + "x" + j.size);
}
await browser.close();
console.log("the tile on " + FIELD);
