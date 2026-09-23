/**
 * Mappr install-and-offline tests.
 *
 *   node tests/pwa.mjs
 *
 * Serves the repo over http (a service worker will not register on file://),
 * then checks the manifest, the icons, that the worker takes control, and that
 * the app still boots with the network switched off.
 */
import { chromium } from "playwright";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXEC = process.env.CHROMIUM || undefined;
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml"
};

let pass = 0; const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fails.push(name); console.log("  FAIL " + name + (detail !== undefined ? "  " + JSON.stringify(detail) : "")); }
}
function group(n) { console.log("\n" + n); }

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end("not found"); return;
  }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
  res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = "http://127.0.0.1:" + server.address().port + "/";

const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {});
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

group("manifest");
await page.goto(BASE);
await page.waitForFunction(() => !!window.__mf);
const manifestHref = await page.getAttribute('link[rel="manifest"]', "href");
ok("page links a manifest", manifestHref === "manifest.webmanifest", manifestHref);
const mres = await page.request.get(BASE + "manifest.webmanifest");
ok("manifest is served", mres.ok(), mres.status());
const man = await mres.json();
ok("manifest is installable (name, start_url, display)",
  man.name === "Mappr" && !!man.start_url && man.display === "standalone", man.display);
ok("manifest declares a maskable icon",
  man.icons.some((i) => (i.purpose || "").includes("maskable")));
for (const i of man.icons) {
  const r = await page.request.get(BASE + i.src);
  ok("icon resolves: " + i.src, r.ok(), r.status());
}
const apple = await page.request.get(BASE + "icons/apple-touch-icon.png");
ok("apple touch icon resolves", apple.ok(), apple.status());

group("favicon");
const icon = await page.getAttribute('link[rel="icon"]', "href");
ok("favicon is inlined as an SVG data URI", !!icon && icon.startsWith("data:image/svg+xml;base64,"));
const svg = Buffer.from(icon.split(",")[1], "base64").toString();
// 1.12.0: the favicon is the mark, Mappr's tile, which carries its own Field
// ground, so it reads on a light tab and a dark one without a variant
ok("favicon is the tile on its own ground", svg.includes("#ffd43b") && svg.includes("#121212"));

group("service worker");
await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller !== undefined, null, { timeout: 15000 });
const reg = await page.evaluate(async () => {
  const r = await navigator.serviceWorker.ready;
  return { scope: r.scope, active: !!r.active };
});
ok("worker is registered and active", reg.active, reg);
ok("worker scope covers the app", reg.scope.endsWith("/"), reg.scope);
await page.reload();
await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
ok("worker controls the page after a reload", true);

group("offline");
// Build something first so there is state to come back to.
await page.evaluate(() => __mf.paste("- Offline branch\n  - Still here"));
await page.waitForTimeout(600);
await ctx.setOffline(true);
await page.reload();
await page.waitForFunction(() => !!window.__mf, null, { timeout: 15000 });
const offline = await page.evaluate(() => ({
  nodes: Object.keys(__mf.state.nodes).length,
  has: Object.values(__mf.state.nodes).some((n) => n.text === "Offline branch")
}));
ok("app boots with the network off", offline.nodes > 1, offline);
ok("the map is still there offline", offline.has);
await ctx.setOffline(false);

group("console");
ok("no runtime errors", errors.length === 0, errors.slice(0, 3));

await browser.close();
server.close();
console.log("\n" + pass + " passed, " + fails.length + " failed\n");
process.exit(fails.length ? 1 : 0);
