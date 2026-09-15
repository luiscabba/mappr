/**
 * Mappr smoke tests.
 *
 *   npm install playwright
 *   node tests/smoke.mjs
 *
 * Drives real key and mouse events against index.html in headless Chromium and
 * asserts on the resulting state. Exits non-zero if anything fails.
 */
import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = "file://" + path.resolve(HERE, "..", "index.html");
const EXEC = process.env.CHROMIUM || undefined;

let pass = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fails.push(name); console.log("  FAIL " + name + (detail !== undefined ? "  " + JSON.stringify(detail) : "")); }
}
function group(name) { console.log("\n" + name); }

const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {});
const page = await browser.newPage({ viewport: { width: 1500, height: 920 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

const key = async (...ks) => { for (const k of ks) await page.keyboard.press(k); };
const M = (fn, arg) => page.evaluate(fn, arg);
const textOf = () => M(() => __mf.state.nodes[__mf.selected].text);
const pick = (t) => M((t) => __mf.select(Object.values(__mf.state.nodes).find((n) => n.text === t).id), t);
const node = (t) => M((t) => {
  const s = __mf.state, n = Object.values(s.nodes).find((x) => x.text === t);
  return n && { dir: n.dir, parent: n.parent && s.nodes[n.parent].text, kids: n.children.map((c) => s.nodes[c].text), collapsed: !!n.collapsed, mark: n.mark || null };
}, t);

await page.goto(APP);
await M(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(400);

const OUTLINE = `Launch
- Marketing
  - Paid ads
  - Email
  - Events
- Product
  - Onboarding
  - Pricing`;

group("boot");
ok("title is Mappr", (await page.title()) === "Mappr");
ok("version exposed", /^\d+\.\d+\.\d+$/.test(await M(() => __mf.version)), await M(() => __mf.version));
ok("font loaded", await M(() => document.fonts.check('17px "Excalifont"')));

group("outline in / out");
const added = await M((t) => __mf.paste(t), OUTLINE);
ok("pasted 8 nodes", added === 8, added);
ok("bullets nest under a flush title", (await node("Marketing")).parent === "Launch");
const round = await M(() => __mf.outline());
ok("the centre node took the outline's title", round.split("\n")[0].trim() === "Launch");
const beforeRound = await M(() => Object.keys(__mf.state.nodes).length);
// Everything below the title, re-pasted under the selected node: 7 lines, 7 nodes.
ok("children re-paste under the selection", (await M((t) => __mf.paste(t), round.split("\n").slice(1).join("\n"))) === 7);
await M(() => __mf.undo());
ok("undo unwinds the paste", (await M(() => Object.keys(__mf.state.nodes).length)) === beforeRound);

group("creating");
await pick("Paid ads");
await key("Enter"); await page.keyboard.type("Sibling"); await key("Escape");
ok("Enter makes a sibling", (await node("Sibling")).parent === "Marketing");
await pick("Paid ads");
await key("Shift+Enter"); await page.keyboard.type("Next branch"); await key("Escape");
ok("Shift+Enter crosses to the next branch", (await node("Next branch")).parent === "Product");
await pick("Paid ads");
await key("Meta+Enter"); await page.keyboard.type("Deeper"); await key("Escape");
ok("Cmd+Enter goes a level deeper", (await node("Deeper")).parent === "Paid ads");
await pick("Paid ads");
await page.keyboard.down("Tab"); await page.keyboard.press("ArrowLeft"); await page.keyboard.up("Tab");
await page.keyboard.type("Channels"); await key("Escape");
ok("Tab+back inserts a parent", (await node("Paid ads")).parent === "Channels" && (await node("Channels")).parent === "Marketing");
await pick("Product");
const outward = { L: "ArrowLeft", R: "ArrowRight", U: "ArrowUp", D: "ArrowDown" }[(await node("Product")).dir];
await page.keyboard.down("Tab"); await page.keyboard.press(outward); await page.keyboard.up("Tab");
await page.keyboard.type("Phase 1"); await key("Escape");
ok("Tab+out adopts the children", (await node("Product")).kids.join() === "Phase 1" && (await node("Phase 1")).kids.includes("Onboarding"));
await pick("Marketing");
await page.keyboard.down("Tab"); await page.keyboard.up("Tab");
ok("a quick Tab still cycles the level", (await textOf()) !== "Marketing");

group("editing");
await pick("Email");
await key("Space"); await page.keyboard.type("Lifecycle"); await key("ArrowLeft");
ok("arrow ends typing and moves", !(await M(() => !!document.querySelector(".editing"))));
ok("the text survived", !!(await node("Lifecycle")));
const before = await M(() => Object.keys(__mf.state.nodes).length);
await key("Enter", "Escape");
ok("a blank node is dropped", (await M(() => Object.keys(__mf.state.nodes).length)) === before);

group("reshaping");
await pick("Lifecycle");
const order0 = (await node("Marketing")).kids.join();
await key("Alt+ArrowUp");
ok("Alt+arrow reorders siblings", (await node("Marketing")).kids.join() !== order0);
await key("Alt+ArrowRight");
ok("Alt+out demotes", (await node("Lifecycle")).parent !== "Marketing");
await key("Alt+ArrowLeft");
ok("Alt+back promotes", (await node("Lifecycle")).parent === "Marketing");
await pick("Marketing");
await key("Meta+e");
ok("Cmd+E folds", (await node("Marketing")).collapsed);
ok("folded children leave the layout", !(await M(() => { const p = __mf.pos(); return Object.values(__mf.state.nodes).some((n) => n.text === "Paid ads" && p[n.id]); })));
ok("a badge appears", await M(() => !!document.querySelector(".badge")));
await key("ArrowRight");
ok("arrows do not enter a folded branch", (await textOf()) === "Marketing");
await key("Meta+e");
ok("Cmd+E unfolds", !(await node("Marketing")).collapsed);
const n0 = await M(() => Object.keys(__mf.state.nodes).length);
await pick("Product"); await key("Meta+d");
ok("Cmd+D duplicates the branch", (await M(() => Object.keys(__mf.state.nodes).length)) > n0);
await key("Meta+Shift+d");
ok("Cmd+Shift+D marks done", (await M(() => __mf.state.nodes[__mf.selected].mark)) === "done");
ok("done is styled", await M(() => !!document.querySelector(".node.done")));

group("layout");
ok("no two nodes overlap", (await M(() => {
  const p = __mf.pos(), b = __mf.boxes(), ids = Object.keys(p);
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const A = p[ids[i]], B = p[ids[j]], a = b[ids[i]], c = b[ids[j]];
    if (Math.abs(A.cx - B.cx) < (a.w + c.w) / 2 - 1 && Math.abs(A.cy - B.cy) < (a.h + c.h) / 2 - 1) return false;
  }
  return true;
})));
let offscreen = 0;
await pick("Onboarding");
for (let i = 0; i < 7; i++) {
  await key("Meta+ArrowRight"); await page.keyboard.type("Deep " + i);
  await page.waitForTimeout(340);
  if (!(await M(() => __mf.onScreen(__mf.selected)))) offscreen++;
}
await key("Escape");
ok("the camera keeps up over 7 levels", offscreen === 0, offscreen);

group("settings");
const sweep = [["colorMode", "branch"], ["colorMode", "one"], ["fillStyle", "hachure"], ["dash", "dotted"],
  ["slop", 0], ["slop", 3], ["edges", "sharp"], ["arrow", "elbow"], ["arrow", "straight"], ["head", "dot"],
  ["font", "code"], ["size", "xl"], ["nodew", "s"], ["gap", "l"], ["paper", "dots"], ["theme", "dark"],
  ["minSize", true], ["valign", "flex-start"], ["theme", "light"], ["minSize", false], ["colorMode", "depth"],
  ["fillStyle", "solid"], ["dash", "solid"], ["slop", 1], ["edges", "round"], ["arrow", "curve"],
  ["head", "arrow"], ["font", "sketch"], ["size", "m"], ["nodew", "m"], ["gap", "m"], ["paper", "graph"]];
let bad = [];
for (const [k, v] of sweep) {
  const r = await M(([k, v]) => {
    try {
      __mf.set(k, v);
      const p = __mf.pos(), b = __mf.boxes(), ids = Object.keys(p);
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
        const A = p[ids[i]], B = p[ids[j]], a = b[ids[i]], c = b[ids[j]];
        if (Math.abs(A.cx - B.cx) < (a.w + c.w) / 2 - 1 && Math.abs(A.cy - B.cy) < (a.h + c.h) / 2 - 1) return "overlap";
      }
      return document.querySelectorAll("#paintLayer path, #paintLayer circle").length > 5 ? "ok" : "empty";
    } catch (e) { return String(e); }
  }, [k, v]);
  if (r !== "ok") bad.push([k, v, r]);
}
ok(sweep.length + " setting changes all render", bad.length === 0, bad);
await M(() => __mf.panel(true));
await page.click("#styleScroll .grp:nth-child(1) button");
await key("Meta+ArrowRight"); await page.keyboard.type("After click"); await key("Escape");
ok("the style panel never steals the keyboard", !!(await node("After click")));
await M(() => __mf.panel(false));

group("jump");
await key("Meta+k");
ok("palette opens", await M(() => document.getElementById("jump").classList.contains("on")));
ok("empty query lists nodes", (await M(() => document.querySelectorAll(".jr").length)) > 1);
await page.keyboard.type("onb");
await page.waitForTimeout(120);
ok("fuzzy match finds Onboarding", (await M(() => document.querySelector(".jr b")?.textContent)) === "Onboarding");
await key("Enter");
await page.waitForTimeout(320);
ok("jumps and centres", (await textOf()) === "Onboarding" && (await M(() => __mf.onScreen(__mf.selected))));
await pick("Marketing"); await key("Meta+e");
await key("Meta+k"); await page.keyboard.type("paid"); await page.waitForTimeout(120); await key("Enter");
await page.waitForTimeout(250);
ok("jumping unfolds the way in", (await textOf()) === "Paid ads" && !(await node("Marketing")).collapsed);

group("zoom");
await pick("Marketing"); await M(() => __mf.focusIn());
await page.waitForTimeout(250);
ok("focus narrows the view", (await M(() => __mf.focus)) !== null);
await key("Meta+0");
await page.waitForTimeout(350);
ok("Cmd+0 exits focus and fits everything", (await M(() => __mf.focus)) === null && (await M(() => Object.keys(__mf.pos()).every((i) => __mf.onScreen(i)))));

group("frames and export");
await M(() => { const s = __mf.state; __mf.mark(["Marketing", "Product"].map((t) => Object.values(s.nodes).find((n) => n.text === t).id)); __mf.frame(); });
await page.waitForTimeout(120);
await page.keyboard.type("Go-to-market"); await key("Enter");
ok("frame created and named", (await M(() => __mf.frames[0]?.title)) === "Go-to-market");
ok("frame bar shows", await M(() => document.getElementById("framebar").classList.contains("on")));
ok("frame title renders on canvas", await M(() => !!document.querySelector(".ftitle")));
const svg = await M(() => __mf.svg());
ok("SVG export has live text", (svg.match(/<text/g) || []).length > 3);
ok("SVG export embeds the font", svg.includes("@font-face") && svg.includes("base64,"));
ok("SVG export includes the frame title", svg.includes("Go-to-market"));
const png = await M(() => new Promise((r) => __mf.png((b) => r(b ? b.size : 0))));
ok("PNG rasterises", png > 10000, png);
const frameOutline = await M(() => __mf.outline());
ok("Cmd+C on a frame copies only the frame", frameOutline.startsWith("Marketing") && !frameOutline.includes("Central idea"));

group("persistence");
await page.reload();
await page.waitForTimeout(400);
ok("map survives reload", (await M(() => Object.keys(__mf.state.nodes).length)) > 5);
ok("frames survive reload", (await M(() => __mf.frames.length)) === 1);
const beforeSwitch = await M(() => Object.keys(__mf.state.nodes).length);
await M(() => document.getElementById("btnMaps").click());
await M(() => document.getElementById("btnNewMap").click());
await page.waitForTimeout(200);
ok("a second map starts empty", (await M(() => Object.keys(__mf.state.nodes).length)) === 1);
await M(() => { document.getElementById("btnMaps").click(); const rows = [...document.querySelectorAll(".mrow")]; rows[rows.length - 1].click(); });
await page.waitForTimeout(300);
ok("switching back restores the first map", (await M(() => Object.keys(__mf.state.nodes).length)) === beforeSwitch);

group("storage");
const keys = await M(() => Object.keys(localStorage).filter((k) => k.indexOf("mappr.") === 0).sort());
ok("maps are stored one key each", keys.filter((k) => k.indexOf("mappr.doc.") === 0).length >= 2, keys);
ok("there is a separate index", keys.includes("mappr.index"));
ok("the old single blob is gone", !keys.includes("mappr.lib"));
const idxSize = await M(() => localStorage.getItem("mappr.index").length);
const docSize = await M(() => {
  const id = JSON.parse(localStorage.getItem("mappr.index")).current;
  return localStorage.getItem("mappr.doc." + id).length;
});
ok("the index holds metadata, not maps", idxSize < docSize, { idxSize, docSize });
// Saving the open map must not rewrite the other maps' keys.
const otherBefore = await M(() => {
  const idx = JSON.parse(localStorage.getItem("mappr.index"));
  const other = Object.keys(idx.docs).filter((k) => k !== idx.current)[0];
  return { id: other, raw: localStorage.getItem("mappr.doc." + other) };
});
await M(() => { __mf.child(); });
await page.waitForTimeout(600);
const otherAfter = await M((id) => localStorage.getItem("mappr.doc." + id), otherBefore.id);
ok("editing one map leaves the others untouched", otherAfter === otherBefore.raw);

group("migration from mappr.lib");
{
  const lib = await M(() => {
    // Rebuild the pre-0.8 shape: every map inside one value.
    const idx = JSON.parse(localStorage.getItem("mappr.index"));
    const docs = {};
    Object.keys(idx.docs).forEach((id) => { docs[id] = JSON.parse(localStorage.getItem("mappr.doc." + id)); });
    Object.keys(localStorage).filter((k) => k.indexOf("mappr.") === 0).forEach((k) => localStorage.removeItem(k));
    localStorage.setItem("mappr.lib", JSON.stringify({ current: idx.current, docs }));
    return { count: Object.keys(docs).length, nodes: Object.keys(docs[idx.current].state.nodes).length };
  });
  await page.reload();
  await page.waitForFunction(() => !!window.__mf);
  await page.waitForTimeout(400);
  ok("the old map opens after the split", (await M(() => Object.keys(__mf.state.nodes).length)) === lib.nodes);
  const after = await M(() => Object.keys(localStorage).filter((k) => k.indexOf("mappr.doc.") === 0).length);
  ok("every old map got its own key", after === lib.count, { after, expected: lib.count });
  ok("mappr.lib is removed once split", (await M(() => localStorage.getItem("mappr.lib"))) === null);
}

group("painter");
// The painter reuses DOM elements between renders; it must land in the same
// place as a render that rebuilds everything from scratch.
{
  await M(() => __mf.paste("- Painter check\n  - one\n  - two\n    - three"));
  const incremental = await M(() => document.getElementById("paintLayer").innerHTML);
  await M(() => __mf.set("slop", __mf.cfg.slop)); // forces a full rebuild
  const rebuilt = await M(() => document.getElementById("paintLayer").innerHTML);
  ok("incremental paint matches a full rebuild", incremental === rebuilt);
}

group("pasting into an empty map");
{
  const newMap = async () => {
    await M(() => document.getElementById("btnMaps").click());
    await M(() => document.getElementById("btnNewMap").click());
    await page.waitForTimeout(200);
  };
  const MAP = "Roadmap\n- Now\n  - Ship v0.8\n- Next\n  - Node notes\n  - Presenting";

  // Build a map, then export it the way Cmd+C does.
  await newMap();
  ok("a new map starts on the placeholder", (await M(() => __mf.state.nodes[__mf.state.rootId].text)) === "Central idea");
  await M((t) => __mf.paste(t), MAP);
  const exported = await M(() => __mf.outline());
  ok("the centre took the outline's title", exported.split("\n")[0].trim() === "Roadmap");

  // Paste that export into a second empty map: it should come out identical.
  await newMap();
  const n = await M((t) => __mf.paste(t), exported);
  ok("the pasted centre replaces the placeholder", (await M(() => __mf.state.nodes[__mf.state.rootId].text)) === "Roadmap");
  ok("no orphan placeholder is left behind",
    !(await M(() => Object.values(__mf.state.nodes).some((x) => x.text === "Central idea"))));
  ok("every node came across", (await M(() => Object.keys(__mf.state.nodes).length)) === 6, n);
  ok("the whole map round-trips", (await M(() => __mf.outline())) === exported);

  // Several top-level lines have no single centre, so the placeholder stays.
  await newMap();
  await M(() => __mf.paste("- One\n- Two\n- Three"));
  ok("a multi-root outline keeps the placeholder",
    (await M(() => __mf.state.nodes[__mf.state.rootId].text)) === "Central idea");
  ok("its lines branch off the centre",
    (await M(() => __mf.state.nodes[__mf.state.rootId].children.length)) === 3);
}

group("empty-map guide");
{
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(250);
  const hint = () => M(() => {
    const el = document.getElementById("startHint");
    const top = el.querySelector('[data-sh="top"]').getBoundingClientRect();
    const bot = el.querySelector('[data-sh="bottom"]').getBoundingClientRect();
    const root = document.querySelector(".node.root").getBoundingClientRect();
    return { on: el.classList.contains("on"), top, bot, root };
  });
  const h = await hint();
  ok("the guide shows on an untouched map", h.on);
  ok("one block sits above the centre node", h.top.bottom <= h.root.top + 1, { hint: h.top.bottom, node: h.root.top });
  ok("the other sits below it", h.bot.top >= h.root.bottom - 1, { hint: h.bot.top, node: h.root.bottom });
  await M(() => __mf.child());
  await page.waitForTimeout(150);
  ok("it goes away once the map has content", !(await M(() => document.getElementById("startHint").classList.contains("on"))));
  ok("the guide never reaches an export", !(await M(() => __mf.svg())).includes("branch out"));
}

group("console");
ok("no runtime errors", errors.length === 0, errors);

await browser.close();
console.log("\n" + pass + " passed, " + fails.length + " failed");
if (fails.length) { console.log("failed: " + fails.join(", ")); process.exit(1); }
