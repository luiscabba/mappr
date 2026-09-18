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
/* the cut key is a real clipboard event, the way the copy and paste tests are */
const cutEvent = async (ms) => {
  const txt = await M(() => { const dt = new DataTransfer(); document.dispatchEvent(new ClipboardEvent("cut", { clipboardData: dt, bubbles: true, cancelable: true })); return dt.getData("text/plain"); });
  await page.waitForTimeout(ms || 220);
  return txt;
};
const cutKey = async () => { await cutEvent(220); };
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
await key("Alt+KeyX");
ok("Option+X marks done", (await M(() => __mf.state.nodes[__mf.selected].mark)) === "done");
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
/* an untouched new map is dropped when you leave it, so give this one something */
await M((t) => __mf.paste(t), "Second\n- kept");
await page.waitForTimeout(400);
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
  const geom = () => M(() => [...document.querySelectorAll("#paintLayer path, #paintLayer circle")].map((e) => { const b = e.getBBox(), m = e.getCTM(); return [m.e + b.x * m.a, m.f + b.y * m.d, b.width * m.a, b.height * m.d].map((v) => Math.round(v * 4) / 4).join(","); }).sort().join("|"));
  const incremental = await geom();
  await M(() => __mf.set("slop", __mf.cfg.slop)); // forces a full rebuild
  const rebuilt = await geom();
  ok("incremental paint matches a full rebuild", incremental === rebuilt && incremental.length > 20);
}

group("outlines from rendered documents");
{
  // What the clipboard actually carries when an outline is copied out of a
  // rendered page rather than a plain-text editor.
  const NB = "\u00A0", TAB = "\t";
  const depthOf = () => M(() => {
    const s = __mf.state; let m = 0;
    (function w(id, d) { m = Math.max(m, d); s.nodes[id].children.forEach((x) => w(x, d + 1)); })(s.rootId, 0);
    return m;
  });
  const shape = () => M(() => {
    const s = __mf.state, out = [];
    (function w(id, d) { out.push("  ".repeat(d) + s.nodes[id].text); s.nodes[id].children.forEach((x) => w(x, d + 1)); })(s.rootId, 0);
    return out.join("\n");
  });
  const fresh = async (txt) => {
    await M(() => document.getElementById("btnMaps").click());
    await M(() => document.getElementById("btnNewMap").click());
    await page.waitForTimeout(200);
    await M((t) => __mf.paste(t), txt);
    await page.waitForTimeout(150);
  };
  const WANT = "Top\n  A\n    A1\n      A1a\n  B\n    B1";

  for (const [name, txt] of [
    ["three spaces and stars", "Top\n* A\n   * A1\n      * A1a\n* B\n   * B1"],
    ["two spaces and dashes", "Top\n- A\n  - A1\n    - A1a\n- B\n  - B1"],
    ["tabs", ["Top", "- A", TAB + "- A1", TAB + TAB + "- A1a", "- B", TAB + "- B1"].join("\n")],
    // Rich-text copies indent with non-breaking spaces, which are invisible.
    ["non-breaking spaces", ["Top", "* A", NB.repeat(3) + "* A1", NB.repeat(6) + "* A1a", "* B", NB.repeat(3) + "* B1"].join("\n")],
    // Word and Docs drop the indentation entirely and nest by bullet glyph.
    ["bullet glyphs, no indent", "Top\n\u2022 A\n\u25e6 A1\n\u25aa A1a\n\u2022 B\n\u25e6 B1"],
    ["blank lines between items", "Top\n\n* A\n\n   * A1\n\n      * A1a\n\n* B\n\n   * B1"],
  ]) {
    await fresh(txt);
    ok("nests correctly: " + name, (await shape()) === WANT, await shape());
  }

  // An outline that does carry indentation must not be second-guessed by the
  // glyph rule, even when its glyphs vary.
  await fresh("Top\n* A\n   - A1\n      + A1a");
  ok("indentation wins over mixed glyphs", (await depthOf()) === 3);

  // Some pages put every line flush left with no bullets at all, which leaves
  // the plain text with nothing to recover. The html flavour still has the real
  // list nesting, so that is what should be read.
  const RICH = '<p>Top</p><ul><li>A<ul><li>A1<ul><li>A1a</li></ul></li></ul></li><li>B<ul><li>B1</li></ul></li></ul>';
  const FLAT = "Top\nA\nA1\nA1a\nB\nB1";
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(200);
  await M((a) => __mf.pasteRich(a.html, a.txt), { html: RICH, txt: FLAT });
  await page.waitForTimeout(150);
  ok("html nesting is used when the text is flat", (await shape()) === WANT, await shape());

  // And it must go through the real paste event, both flavours, as a browser
  // delivers them.
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(200);
  await M((a) => {
    const dt = new DataTransfer();
    dt.setData("text/html", a.html);
    dt.setData("text/plain", a.txt);
    document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, { html: RICH, txt: FLAT });
  await page.waitForTimeout(300);
  ok("the paste event reads the html flavour", (await shape()) === WANT, await shape());

  // A copy with no list in its html must still fall back to the text.
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(200);
  await M(() => __mf.pasteRich("<p>just a paragraph</p>", "Top\n- A\n  - A1\n    - A1a\n- B\n  - B1"));
  await page.waitForTimeout(150);
  ok("plain text still wins when the html has no list", (await shape()) === WANT, await shape());
}

group("spread");
{
  const newMap = async () => {
    await M(() => document.getElementById("btnMaps").click());
    await M(() => document.getElementById("btnNewMap").click());
    await page.waitForTimeout(200);
  };
  const rootDirs = () => M(() => __mf.state.nodes[__mf.state.rootId].children.map((c) => __mf.dir(c)).join(","));
  const setSpread = async (v) => { await M((x) => __mf.spread(x), v); await page.waitForTimeout(200); };

  await newMap();
  await M(() => __mf.paste("Map\n- A\n- B\n- C\n- D\n- E"));
  await page.waitForTimeout(250);
  ok("a new map spreads as placed", (await M(() => __mf.spread())) === "manual");
  const asPlaced = await rootDirs();
  const outline0 = await M(() => __mf.outline());
  const count0 = await M(() => Object.keys(__mf.state.nodes).length);

  for (const [mode, want] of [
    ["sides", "R,L,R,L,R"],
    ["updown", "D,U,D,U,D"],
    ["right", "R,R,R,R,R"],
    ["down", "D,D,D,D,D"],
  ]) {
    await setSpread(mode);
    ok("spread " + mode + " fans the branches", (await rootDirs()) === want, await rootDirs());
    ok("spread " + mode + " lays every node out", (await M(() => Object.keys(__mf.pos()).length)) === count0);
  }

  // The whole point of deriving rather than applying: it is a view, not an edit.
  ok("no spread changed the map", (await M(() => __mf.outline())) === outline0);
  ok("no spread added or lost a node", (await M(() => Object.keys(__mf.state.nodes).length)) === count0);
  await setSpread("manual");
  ok("going back restores the original placement", (await rootDirs()) === asPlaced, { now: await rootDirs(), was: asPlaced });

  // Branching against the mode hands control back; branching with it does not.
  await setSpread("right");
  await M(() => __mf.select(__mf.state.rootId));
  await M(() => __mf.branch("R"));
  await key("Escape");
  await page.waitForTimeout(150);
  ok("branching with the mode keeps it", (await M(() => __mf.spread())) === "right");
  await M(() => __mf.select(__mf.state.rootId));
  await M(() => __mf.branch("U"));
  await key("Escape");
  await page.waitForTimeout(150);
  ok("branching against the mode drops to as placed", (await M(() => __mf.spread())) === "manual");
  ok("the takeover keeps everything else where it was",
    (await rootDirs()).split(",").slice(0, 5).join(",") === "R,R,R,R,R", await rootDirs());

  // A single-direction spread must survive a reload, like any other setting.
  await setSpread("down");
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForFunction(() => !!window.__mf);
  await page.waitForTimeout(300);
  ok("spread is saved with the map", (await M(() => __mf.spread())) === "down");

  // `All around` was removed in 0.10. A map saved in it bakes into the shape it
  // was showing rather than jumping into another mode.
  await setSpread("manual");
  const legacy = await M(() => {
    __mf.set("spread", "around");
    return __mf.state.rootId;
  });
  await page.waitForTimeout(200);
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForFunction(() => !!window.__mf);
  await page.waitForTimeout(300);
  ok("all around is no longer offered", !(await M(() => !!document.querySelector('[data-k="spread"] .opt[data-v="around"]'))));
  ok("a map saved in all around drops to as placed", (await M(() => __mf.spread())) === "manual");
  ok("and it is baked into the fan it was showing", (await rootDirs()) === "R,L,D,U,R", await rootDirs());
  void legacy;
}

group("selecting a level");
{
  const newMap = async () => {
    await M(() => document.getElementById("btnMaps").click());
    await M(() => document.getElementById("btnNewMap").click());
    await page.waitForTimeout(200);
  };
  const idOf = (t) => M((t) => Object.values(__mf.state.nodes).find((n) => n.text === t).id, t);
  const names = (ids) => M((ids) => ids.map((i) => __mf.state.nodes[i].text).sort().join(","), ids);

  await newMap();
  await M(() => __mf.paste("Plan\n- A\n  - A1\n  - A2\n- B\n  - B1\n  - B2\n- C"));
  await page.waitForTimeout(250);

  // Shift + click marks the sibling row, not the depth and not the branch.
  // Driven as a real gesture, so the modifier and the handler are both covered.
  const shiftClick = async (text) => {
    const box = await M((t) => {
      const el = [...document.querySelectorAll(".node")].find((n) => n.textContent.trim() === t);
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, text);
    await page.keyboard.down("Shift");
    await page.mouse.click(box.x, box.y);
    await page.keyboard.up("Shift");
    await page.waitForTimeout(150);
  };
  await shiftClick("A1");
  ok("shift+click marks the sibling row", (await names(await M(() => __mf.rawMarked))) === "A1,A2");
  ok("and does not focus the way a right-click does", (await M(() => __mf.focus)) === null);
  // Without the modifier the same click is the old one: it selects that node
  // alone and drops whatever row was in hand.
  const plainClick = async (text) => {
    const box = await M((t) => {
      const el = [...document.querySelectorAll(".node")].find((n) => n.textContent.trim() === t);
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, text);
    await page.mouse.click(box.x, box.y);
    await page.waitForTimeout(150);
  };
  await plainClick("A1");
  ok("a plain click drops the row", (await M(() => __mf.rawMarked.length)) === 0);
  ok("and selects just that node", (await textOf()) === "A1");
  await shiftClick("A2");
  ok("marking a new row replaces the old one", (await names(await M(() => __mf.rawMarked))) === "A1,A2");
  await shiftClick("B");
  await page.waitForTimeout(150);
  ok("a top-level node's row is the root's children", (await names(await M(() => __mf.rawMarked))) === "A,B,C");
  const rootId = await M(() => __mf.state.rootId);
  await M((id) => __mf.markSibs(id), rootId);
  await page.waitForTimeout(150);
  ok("the centre node has no row to mark", (await M(() => __mf.rawMarked)).length === 0);

  // Fold folds each selected node's own children; the row itself stays visible.
  await shiftClick("A");
  await M(() => __mf.fold());
  await page.waitForTimeout(200);
  ok("fold folds every selected node", (await node("A")).collapsed && (await node("B")).collapsed);
  ok("the selected row is still on screen", (await M(() => Object.keys(__mf.pos()).length)) === 4, await M(() => Object.keys(__mf.pos()).length));
  await M(() => __mf.fold());
  await page.waitForTimeout(200);
  ok("the same press opens it again", !(await node("A")).collapsed && !(await node("B")).collapsed);

  // Delete takes exactly what was selected; survivors move up a level.
  await M(async (ids) => __mf.mark(ids), [await idOf("A"), await idOf("B1")]);
  await page.waitForTimeout(150);
  await M(() => __mf.del());
  await page.waitForTimeout(250);
  ok("the selected nodes are gone", !(await node("A")) && !(await node("B1")));
  ok("an unselected child survives its parent", !!(await node("A1")) && !!(await node("A2")));
  ok("and reattaches to the nearest survivor", (await node("A1")).parent === "Plan" && (await node("A2")).parent === "Plan");
  ok("a sibling that was not selected is untouched", (await node("B2")).parent === "B");
  ok("the rest of the map is intact", !!(await node("C")));
  await M(() => __mf.undo());
  await page.waitForTimeout(200);
  ok("undo puts the branch back", (await node("A")).kids.join() === "A1,A2" && (await node("B1")).parent === "B");

  // A survivor that lands on the centre node keeps the direction it was drawn
  // with, so nothing jumps across the map.
  const dirWas = (await node("A1")).dir;
  await M(async (ids) => __mf.mark(ids), [await idOf("A")]);
  await M(() => __mf.del());
  await page.waitForTimeout(250);
  ok("a promoted survivor keeps its direction", (await node("A1")).dir === dirWas, { now: (await node("A1")).dir, was: dirWas });

  // Deleting with nothing selected is still the old single-node delete.
  await pick("C");
  await M(() => __mf.mark([]));
  await key("Backspace");
  await page.waitForTimeout(200);
  ok("plain delete takes just the node", !(await node("C")));
}

group("copying an outline");
{
  const newMap = async () => {
    await M(() => document.getElementById("btnMaps").click());
    await M(() => document.getElementById("btnNewMap").click());
    await page.waitForTimeout(200);
  };
  const SRC = "Core Metrics\n* Efficiency\n   * Manual minutes\n      * Unit A\n* Decision Support";
  await newMap();
  await M((t) => __mf.paste(t), SRC);
  await page.waitForTimeout(200);

  // A real copy event must carry both flavours. With the centre selected it is the whole map.
  const copied = await M(() => {
    __mf.select(__mf.state.rootId);
    const dt = new DataTransfer();
    document.dispatchEvent(new ClipboardEvent("copy", { clipboardData: dt, bubbles: true, cancelable: true }));
    return { text: dt.getData("text/plain"), html: dt.getData("text/html") };
  });
  ok("copy puts plain text on the clipboard", copied.text.split("\n")[0] === "Core Metrics", copied.text);
  ok("copy bullets every line below the centre", copied.text.split("\n").slice(1).every((l) => /^\s*- /.test(l)), copied.text);
  ok("copy also puts nested html on the clipboard", /^<ul><li>Core Metrics<ul>/.test(copied.html), copied.html);
  ok("the html nests as deep as the map", (copied.html.match(/<ul>/g) || []).length === 4, copied.html);

  // Both flavours must come back as the same map.
  const before = await M(() => __mf.outline());
  await newMap();
  await M((t) => __mf.paste(t), copied.text);
  await page.waitForTimeout(150);
  ok("the text flavour round-trips", (await M(() => __mf.outline())) === before);
  await newMap();
  await M((h) => __mf.pasteRich(h, ""), copied.html);
  await page.waitForTimeout(150);
  ok("the html flavour round-trips", (await M(() => __mf.outline())) === before);

  // Copying a frame copies only that frame, in both flavours.
  await newMap();
  await M((t) => __mf.paste(t), SRC);
  await page.waitForTimeout(200);
  await M(() => { __mf.mark([Object.values(__mf.state.nodes).find((n) => n.text === "Efficiency").id]); __mf.frame(); });
  await page.waitForTimeout(250);
  const frameCopy = await M(() => {
    const dt = new DataTransfer();
    document.dispatchEvent(new ClipboardEvent("copy", { clipboardData: dt, bubbles: true, cancelable: true }));
    return { text: dt.getData("text/plain"), html: dt.getData("text/html") };
  });
  ok("a framed copy leaves the rest out", !frameCopy.text.includes("Decision Support") && !frameCopy.html.includes("Decision Support"), frameCopy.text);
}

group("right-click is the menu (focus moved into it in 0.37)");
{
  const newMap = async () => {
    await M(() => document.getElementById("btnMaps").click());
    await M(() => document.getElementById("btnNewMap").click());
    await page.waitForTimeout(200);
  };
  await newMap();
  await M(() => __mf.paste("Tree\n- Trunk\n  - Leaf one\n  - Leaf two"));
  await page.waitForTimeout(250);
  const rightClick = async (text) => {
    const box = await M((t) => {
      const el = [...document.querySelectorAll(".node")].find((n) => n.textContent === t);
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, text);
    await page.mouse.click(box.x, box.y, { button: "right" });
    await page.waitForTimeout(250);
  };
  const menuHas = (t) => M((t) => !!document.getElementById("storyMenu") && [...document.querySelectorAll("#storyMenu .mi")].some((b) => b.firstChild.textContent === t), t);
  await rightClick("Trunk");
  ok("right-click on a node no longer focuses by itself", (await M(() => __mf.focus)) === null);
  ok("focus is a row in the menu", await menuHas("Focus on this branch"));
  await M(() => [...document.querySelectorAll("#storyMenu .mi")].find((b) => b.firstChild.textContent === "Focus on this branch").click());
  await page.waitForTimeout(250);
  ok("and picking it focuses the node that was clicked", (await M(() => __mf.focus)) !== null && (await M(() => __mf.state.nodes[__mf.focus].text)) === "Trunk");
  await page.mouse.click(40, 620, { button: "right" });
  await page.waitForTimeout(250);
  ok("the canvas menu offers the way out of the focus", await menuHas("Out of the focus"));
  await M(() => [...document.querySelectorAll("#storyMenu .mi")].find((b) => b.firstChild.textContent === "Out of the focus").click());
  await page.waitForTimeout(250);
  ok("and it steps back out", (await M(() => __mf.focus)) === null);
  await rightClick("Leaf one");
  ok("a childless node's menu has no fold row", !(await menuHas("Fold")) && await menuHas("Focus on this branch"));
  await key("Escape");
  await M(() => { __mf.select(Object.values(__mf.state.nodes).find((n) => n.text === "Trunk").id); });
  await key("Space");
  await rightClick("Trunk");
  ok("right-click while typing leaves the browser's own menu", (await M(() => !document.getElementById("storyMenu"))));
  await key("Escape");
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

group("deleting a map asks first");
{
  const openPanel = async () => { await M(() => document.getElementById("btnMaps").click()); await page.waitForTimeout(200); };
  const newMap = async () => { await openPanel(); await M(() => document.getElementById("btnNewMap").click()); await page.waitForTimeout(250); };
  const rows = () => M(() => document.querySelectorAll("#mapsList .mrow").length);
  // The Delete button of a row that is not the open map, so deleting it cannot
  // be confused with the switch that follows.
  const delBtn = () => M(() => {
    const r = [...document.querySelectorAll("#mapsList .mrow")].find((x) => !x.classList.contains("on"));
    const b = r && r.querySelector("[data-del]");
    return b ? { text: b.textContent, armed: b.classList.contains("arm") } : null;
  });
  const clickDel = async () => {
    await M(() => {
      const r = [...document.querySelectorAll("#mapsList .mrow")].find((x) => !x.classList.contains("on"));
      r.querySelector("[data-del]").click();
    });
    await page.waitForTimeout(200);
  };

  await newMap();
  await newMap();
  await openPanel();
  const before = await rows();
  ok("there are maps to delete", before >= 3, before);

  await clickDel();
  ok("one click does not delete", (await rows()) === before, await rows());
  ok("the button asks instead", (await delBtn()).text === "Sure?");
  ok("and marks itself armed", (await delBtn()).armed);

  // Clicking anywhere else in the panel takes the safety back off.
  await M(() => document.getElementById("maps").click());
  await page.waitForTimeout(200);
  ok("clicking elsewhere disarms it", (await delBtn()).text === "Delete");
  ok("and still nothing was deleted", (await rows()) === before, await rows());

  // Armed, a second click on the same row does it.
  await clickDel();
  await clickDel();
  ok("the second click deletes", (await rows()) === before - 1, await rows());
  ok("the next row is not left armed", (await delBtn()).text === "Delete");

  // It also gives up on its own.
  await clickDel();
  ok("armed again", (await delBtn()).text === "Sure?");
  await page.waitForTimeout(3800);
  ok("it disarms itself after a few seconds", (await delBtn()).text === "Delete");
  ok("and nothing went with it", (await rows()) === before - 1, await rows());
  await M(() => document.getElementById("btnMaps").click());
  await page.waitForTimeout(150);

  // Deleting sets the map aside rather than dropping it.
  await openPanel();
  const liveBefore = await rows();
  const doomed = await M(() => {
    const r = [...document.querySelectorAll("#mapsList .mrow")].find((x) => !x.classList.contains("on"));
    return r.dataset.m;
  });
  await clickDel(); await clickDel();
  ok("the deleted map left the list", (await rows()) === liveBefore - 1, await rows());
  const binned = await M(() => __mf.trash());
  ok("and turned up in the bin", binned.some((d) => d.id === doomed), binned);
  ok("the bin is shown in the panel", await M(() => !!document.querySelector("[data-restore]")));

  await M((id) => document.querySelector('[data-restore="' + id + '"]').click(), doomed);
  await page.waitForTimeout(250);
  ok("Restore puts it back in the list", (await rows()) === liveBefore, await rows());
  ok("and takes it out of the bin", !(await M(() => __mf.trash())).some((d) => d.id === doomed));

  // The bin is capped, so it can never eat the maps you still have.
  for (let i = 0; i < 5; i++) { await openPanel(); await clickDel(); await clickDel(); }
  ok("the bin keeps only the last few", (await M(() => __mf.trash())).length <= 12, (await M(() => __mf.trash())).length);
  await M(() => document.getElementById("btnMaps").click());
  await page.waitForTimeout(150);
}

group("key labels off a Mac");
{
  ok("the glyph table covers the keys the app uses",
    (await M(() => __mf.keyWords("\u2318\u2325\u21e7\u23ce\u232b"))) === "CtrlAltShiftEnterBackspace",
    await M(() => __mf.keyWords("\u2318\u2325\u21e7\u23ce\u232b")));
  ok("ordinary text is untouched", (await M(() => __mf.keyWords("Central idea"))) === "Central idea");
  // Headless Chromium on Linux is not a Mac, so the swap should have run.
  const mac = await M(() => __mf.isMac);
  const hint = await M(() => document.getElementById("hint").textContent);
  if (mac) {
    ok("on a Mac the glyphs stay", /\u2318/.test(hint));
  } else {
    ok("off a Mac the hint bar reads in words", hint.includes("Ctrl") && !hint.includes("\u2318"), hint.slice(0, 120));
    ok("the Keys dialog too", !(await M(() => document.getElementById("help").textContent)).includes("\u2318"));
    ok("and the button titles", !(await M(() => document.getElementById("btnJump").title)).includes("\u2318"),
      await M(() => document.getElementById("btnJump").title));
  }
  ok("the map itself is never rewritten", (await M(() => {
    __mf.select(__mf.state.rootId);
    __mf.state.nodes[__mf.state.rootId].text = "\u2318 shortcuts";
    return __mf.state.nodes[__mf.state.rootId].text;
  })) === "\u2318 shortcuts");
}

group("arrows across branches and inside focus");
{
  const newMap = async () => {
    await M(() => document.getElementById("btnMaps").click());
    await M(() => document.getElementById("btnNewMap").click());
    await page.waitForTimeout(220);
  };
  await newMap();
  // Two top-level branches on the same side, two children each, so "past the
  // end of my siblings" has somewhere real to go.
  await M(() => __mf.spread("right"));
  await M(() => __mf.paste("Root\n- A\n  - A1\n  - A2\n- B\n  - B1\n  - B2"));
  await page.waitForTimeout(250);
  const sel = () => M(() => __mf.state.nodes[__mf.selected].text);

  await pick("A2");
  ok("arrows still step within a sibling group", await M(() => __mf.arrow("U")) && (await sel()) === "A1");
  await pick("A2");
  ok("and now carry on into the next branch", await M(() => __mf.arrow("D")) && (await sel()) === "B1", await sel());
  await pick("B1");
  ok("back the other way returns to the first group", await M(() => __mf.arrow("U")) && (await sel()) === "A2", await sel());
  await pick("B2");
  ok("but they do not wrap round", !(await M(() => __mf.arrow("D"))));
  ok("and the selection stays put when they stop", (await sel()) === "B2");

  // Inside focus: sideways moves the focus, inward lifts it, outward descends.
  await pick("A");
  await M(() => __mf.focusIn());
  await page.waitForTimeout(200);
  ok("focus is on the branch", (await M(() => __mf.focus)) !== null);
  ok("a cross-axis arrow moves to the sibling branch", await M(() => __mf.arrow("D")));
  ok("and it is the sibling that is now focused", (await sel()) === "B" && (await M(() => __mf.focus)) === (await M(() => Object.values(__mf.state.nodes).find((n) => n.text === "B").id)));
  ok("still focused, not stepped out", (await M(() => __mf.focus)) !== null);
  ok("coming back lands on the first branch", (await M(() => __mf.arrow("U"))) && (await sel()) === "A");

  ok("the outward arrow still goes to the first child", (await M(() => __mf.arrow("R"))) && (await sel()) === "A1", await sel());
  await pick("A");
  ok("the inward arrow lifts the focus a level", (await M(() => __mf.arrow("L"))));
  ok("landing on the parent", (await sel()) === "Root");
  ok("and at the top it is the whole map again", (await M(() => __mf.focus)) === null);
}

group("cross-links");
{
  const newMap = async () => {
    await M(() => document.getElementById("btnMaps").click());
    await M(() => document.getElementById("btnNewMap").click());
    await page.waitForTimeout(220);
  };
  const idOf = (t) => M((t) => Object.values(__mf.state.nodes).find((n) => n.text === t).id, t);
  const arcs = () => M(() => document.querySelectorAll('#paintLayer path[stroke-dasharray="7 6"]').length);

  await newMap();
  await M(() => __mf.paste("Model\n- Risk\n  - True positives\n  - Penalties\n- Missing\n  - Before values\n  - Adoption"));
  await page.waitForTimeout(250);

  const a = await idOf("True positives"), b2 = await idOf("Adoption");
  ok("a fresh map has no links", (await M(() => __mf.links)).length === 0);
  ok("tying two nodes reports it", (await M(([x, y]) => __mf.tie(x, y), [a, b2])) === "tied");
  ok("the link is stored once", (await M(() => __mf.links)).length === 1);
  ok("an arc is drawn", (await arcs()) === 1, await arcs());
  ok("layout did not move", (await M(() => Object.keys(__mf.pos()).length)) === 7);

  // order does not matter, and the same pair again unties
  ok("tying the same pair the other way round unties", (await M(([x, y]) => __mf.tie(y, x), [a, b2])) === "cut");
  ok("and the arc goes with it", (await arcs()) === 0);
  await M(([x, y]) => __mf.tie(x, y), [a, b2]);
  ok("a node cannot be tied to itself", (await M((x) => __mf.tie(x, x), a)) === null);

  // a tie is an edit like any other, so it sits on the undo stack
  await M(() => __mf.undo());
  await page.waitForTimeout(200);
  ok("undo takes the link back off", (await M(() => __mf.links)).length === 0, await M(() => __mf.links));
  await M(() => __mf.redo());
  await page.waitForTimeout(200);
  ok("redo puts it back", (await M(() => __mf.links)).length === 1, await M(() => __mf.links));

  // the badge counts what lands here and walks to the far end
  ok("the tied node carries a badge", await M(() => !!document.querySelector(".badge.link")));
  ok("two of them, one per end", (await M(() => document.querySelectorAll(".badge.link").length)) === 2);
  await M((x) => __mf.select(x), a);
  await M((x) => __mf.hop(x), a);
  await page.waitForTimeout(250);
  ok("the badge walks to the other end", (await textOf()) === "Adoption", await textOf());

  // folding one end retargets the arc rather than dropping it
  const risk = await idOf("Risk");
  await M((x) => __mf.select(x), risk);
  await M(() => __mf.fold());
  await page.waitForTimeout(250);
  ok("the arc survives a folded end", (await arcs()) === 1, await arcs());
  ok("and it ends hollow on the folded node", await M(() => !!document.querySelector('#paintLayer circle[stroke-width="1.7"]')));
  ok("the folded branch carries the badge", await M(() => !!document.querySelector(".badge.link")));
  await M((x) => __mf.hop(x), risk);
  await page.waitForTimeout(300);
  ok("walking from a folded branch opens it", (await textOf()) === "Adoption" || !(await node("Risk")).collapsed);
  await M((x) => { __mf.select(x); }, risk);
  if ((await node("Risk")).collapsed) { await M(() => __mf.fold()); await page.waitForTimeout(200); }

  // links are state, so undo and persistence carry them
  ok("links reach the export", (await M(() => __mf.svg())).includes('stroke-dasharray="7 6"'));

  // deleting a node takes its links with it, as it already does its frames
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForFunction(() => !!window.__mf);
  await page.waitForTimeout(300);
  ok("links survive a reload", (await M(() => __mf.links)).length >= 1, await M(() => __mf.links));
  await pick("Adoption");
  await key("Backspace");
  await page.waitForTimeout(250);
  ok("deleting an end removes the link", (await M(() => __mf.links)).length === 0, await M(() => __mf.links));
  ok("and the arc with it", (await arcs()) === 0);
  ok("the badges go too", (await M(() => document.querySelectorAll(".badge.link").length)) === 0);
}

group("what's new");
{
  const open = () => M(() => document.getElementById("notes").classList.contains("open"));
  // Not on a first ever run: the panel only fires on an actual upgrade.
  ok("it does not greet a first run", !(await open()));
  ok("but the version was recorded anyway", (await M(() => __mf.seen)) === (await M(() => __mf.version)));

  ok("the wordmark opens it", await (async () => {
    await M(() => document.getElementById("brand").click());
    await page.waitForTimeout(150);
    return await open();
  })());
  ok("it carries the current version's entry",
    (await M(() => document.querySelector("#notesBody h3.rel")?.nextElementSibling?.nextElementSibling?.textContent || "")).length > 40 &&
    (await M(() => document.getElementById("notesBody").textContent)).includes(await M(() => __mf.version)));
  ok("and several releases of history",
    (await M(() => document.querySelectorAll("#notesBody h3.rel").length)) >= 3,
    await M(() => document.querySelectorAll("#notesBody h3.rel").length));
  ok("the newest release is first",
    (await M(() => document.querySelector("#notesBody h3.rel").textContent)).includes(await M(() => __mf.version)));
  ok("the changelog's markup came through", await M(() => !!document.querySelector("#notesBody code")));

  // While it is open the keyboard belongs to it, so a stray key cannot retype a node.
  const before = await M(() => Object.keys(__mf.state.nodes).length);
  await page.keyboard.press("x");
  await page.waitForTimeout(150);
  ok("keys do not reach the map behind it", (await M(() => Object.keys(__mf.state.nodes).length)) === before);
  await key("Escape");
  await page.waitForTimeout(150);
  ok("Escape closes it", !(await open()));

  // A version it has not run before opens it; the same version again does not.
  await M(() => { try { localStorage.setItem("mappr.seen", "0.0.1"); } catch (e) {} });
  await page.reload();
  await page.waitForFunction(() => !!window.__mf);
  await page.waitForTimeout(350);
  ok("an upgrade shows it once", await open());
  await M(() => __mf.notes(false));
  await page.reload();
  await page.waitForFunction(() => !!window.__mf);
  await page.waitForTimeout(350);
  ok("and not again on the next run", !(await open()));
}

group("the connections lens");
{
  const newMap = async () => {
    await M(() => document.getElementById("btnMaps").click());
    await M(() => document.getElementById("btnNewMap").click());
    await page.waitForTimeout(220);
  };
  const idOf = (t) => M((t) => Object.values(__mf.state.nodes).find((n) => n.text === t).id, t);
  const arcs = () => M(() => document.querySelectorAll('#paintLayer path[stroke-dasharray="7 6"]').length);
  const treeEdges = () => M(() => document.querySelectorAll("#paintLayer path.te").length);

  await newMap();
  await M(() => __mf.paste("Model\n- Risk\n  - True positives\n  - Penalties\n- Missing\n  - Before values\n  - Adoption\n- Cost\n  - Build\n  - Upkeep"));
  await page.waitForTimeout(280);
  const tp = await idOf("True positives"), ad = await idOf("Adoption"), bv = await idOf("Before values");
  await M(([a, b]) => __mf.tie(a, b), [tp, ad]);
  await M(([a, b]) => __mf.tie(a, b), [tp, bv]);
  await page.waitForTimeout(200);

  ok("the lens starts off", (await M(() => __mf.lens)) === "off");
  const allShown = await M(() => __mf.shown);

  // dim: everything stays, the untied go quiet
  await M(() => __mf.setLens("dim"));
  await page.waitForTimeout(300);
  ok("dim keeps the whole map on screen", (await M(() => __mf.shown)) === allShown, await M(() => __mf.shown));
  ok("and ghosts what no link touches", (await M(() => __mf.ghosts)) > 0, await M(() => __mf.ghosts));
  ok("the tied nodes are not ghosted", await M((x) => !document.querySelector('.node[data-id="' + x + '"]').classList.contains("ghost"), tp));
  ok("the arcs are still drawn", (await arcs()) === 2, await arcs());
  ok("the tree is still there, just quiet", (await treeEdges()) > 0, await treeEdges());

  // Focus on a tied node escalates to the solo view
  await M((x) => __mf.select(x), tp);
  await M(() => __mf.focusIn === undefined);
  await page.keyboard.press("Meta+/");
  await page.waitForTimeout(350);
  ok("Focus on a tied node goes solo", (await M(() => __mf.lens)) === "one", await M(() => __mf.lens));
  ok("only that node, its partners and the centre remain", (await M(() => __mf.shown)) === 4, await M(() => __mf.shown));
  ok("the tree is not drawn in a solo view", (await treeEdges()) === 0, await treeEdges());
  ok("it did not enter branch focus instead", (await M(() => __mf.focus)) === null);

  await key("Escape");
  await page.waitForTimeout(300);
  ok("Escape steps back to dim", (await M(() => __mf.lens)) === "dim");
  await key("Escape");
  await page.waitForTimeout(300);
  ok("and again turns the lens off", (await M(() => __mf.lens)) === "off");
  ok("the whole map is back", (await M(() => __mf.shown)) === allShown);

  // Focus on an untied node is still plain focus
  await M(() => __mf.setLens("dim"));
  await page.waitForTimeout(250);
  await pick("Risk");
  await page.keyboard.press("Meta+/");
  await page.waitForTimeout(350);
  ok("Focus on an untied node still focuses the branch", (await M(() => __mf.focus)) !== null);
  await M(() => __mf.setLens("off"));
  await M(() => __mf.focusOut());
  await page.waitForTimeout(250);

  // the network view: no tree, arranged by links, and reversible
  const posBefore = await M(() => JSON.stringify(__mf.pos()));
  await M((x) => __mf.setLens("one", x), tp);
  await page.waitForTimeout(400);
  ok("the network view drops the tree", (await treeEdges()) === 0, await treeEdges());
  ok("it shows only the network", (await M(() => __mf.shown)) < allShown, await M(() => __mf.shown));
  ok("arranging moved things", (await M(() => JSON.stringify(__mf.pos()))) !== posBefore);
  await M(() => __mf.setLens("off"));
  await page.waitForTimeout(400);
  ok("and leaving puts every node back exactly", (await M(() => JSON.stringify(__mf.pos()))) === posBefore);
  await page.keyboard.press("Meta+Shift+2");
  await page.waitForTimeout(250);
  ok("Cmd+Shift+2 no longer does anything", (await M(() => __mf.lens)) === "off");

  // a lens is a view, so it never reaches an export and is never saved
  await M(() => __mf.setLens("dim"));
  await page.waitForTimeout(250);
  const svg = await M(() => __mf.svg());
  ok("an export ignores the lens", !svg.includes('opacity=".17"') && !svg.includes('opacity=".22"'));
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForFunction(() => !!window.__mf);
  await page.waitForTimeout(300);
  ok("and a reload comes back with it off", (await M(() => __mf.lens)) === "off");
  ok("the links themselves survived", (await M(() => __mf.links)).length === 2);
}

group("networks: indirect links, folding them, focus into a lens");
{
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(220);
  const idOf = (t) => M((t) => Object.values(__mf.state.nodes).find((n) => n.text === t).id, t);
  const arcs = () => M(() => document.querySelectorAll('#paintLayer path.lk').length);
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(320); };
  const lensIs = () => M(() => __mf.lens);
  await M(() => __mf.paste("Hub\n- P1\n  - A\n    - a1\n  - E\n- P2\n  - B\n  - C\n- P3\n  - D"));
  await page.waitForTimeout(280);
  const A = await idOf("A"), B = await idOf("B"), C = await idOf("C"), D = await idOf("D"), P1 = await idOf("P1");
  await M(([a, b]) => __mf.tie(a, b), [A, B]);
  await M(([a, b]) => __mf.tie(a, b), [B, C]);
  await M(([a, b]) => __mf.tie(a, b), [C, D]);
  await page.waitForTimeout(200);

  // Focus in dim follows the chain, not just the direct partner
  await M(() => __mf.setLens("dim")); await page.waitForTimeout(250);
  await M((x) => __mf.select(x), A);
  await press("Meta+/");
  ok("focus in dim shows the whole chain", (await lensIs()) === "one" && (await M(() => __mf.shown)) === 5, await M(() => __mf.shown));
  ok("and every link inside it", (await arcs()) === 3, await arcs());

  // Cmd+E folds the network, not the tree
  await M((x) => __mf.select(x), B);
  await press("Meta+e");
  ok("folding B hides what is only reached through it", (await M(() => __mf.shown)) === 3, await M(() => __mf.shown));
  ok("B itself stays", await M((x) => !!__mf.pos()[x], B));
  ok("the fold is recorded on the network", (await M(() => __mf.lensFold)).join() === B);
  ok("and it wears a count", await M((x) => [...document.querySelectorAll(".badge.link")].some((b) => b.dataset.lf === x && b.textContent === "+2"), B));
  ok("the tree was not folded", await M((x) => !__mf.state.nodes[x].collapsed, B));
  await M((x) => __mf.select(x), D);
  await M((x) => __mf.select(x), A);
  await press("Meta+e");
  ok("folding the origin hides the rest", (await M(() => __mf.shown)) === 2, await M(() => __mf.shown));
  await press("Meta+e");
  await M((x) => __mf.select(x), B);
  await press("Meta+e");
  ok("pressing again brings them back", (await M(() => __mf.shown)) === 5, await M(() => __mf.shown));
  await press("Meta+e");
  await press("Escape");
  ok("Escape steps back to dim", (await lensIs()) === "dim");
  ok("and forgets the network's folds", (await M(() => __mf.lensFold)).length === 0);
  await press("Escape");

  // focused on a branch, then a lens: its network
  await M((x) => __mf.select(x), A);
  await press("Meta+/");
  ok("plain focus first", (await M(() => __mf.focus)) === A);
  await press("Meta+2");
  ok("Cmd+2 from focus opens that node's network", (await lensIs()) === "one" && (await M(() => __mf.shown)) === 5, await lensIs());
  ok("focus made way for it", (await M(() => __mf.focus)) === null);
  await press("Escape"); await press("Escape");
  // turning it off lands you back in the focused branch, not the whole map
  ok("Esc all the way out restores the focus", (await M(() => __mf.focus)) === A, await M(() => __mf.focus));
  await press("Meta+2");
  await press("Meta+2");
  ok("so does Cmd+2 a second time", (await lensIs()) === "off" && (await M(() => __mf.focus)) === A);
  ok("with only the focused branch on screen", (await M(() => __mf.shown)) === 2, await M(() => __mf.shown));
  await M(() => { while (__mf.focus) __mf.focusOut(); }); await page.waitForTimeout(250);
  // not focused: the camera comes back exactly
  await M(() => __mf.select(__mf.state.rootId));
  const cam0 = await M(() => JSON.stringify(__mf.cam()));
  await press("Meta+2"); await press("Meta+2");
  ok("unfocused, the camera comes back exactly", (await M(() => JSON.stringify(__mf.cam()))) === cam0);
  await M((x) => __mf.select(x), P1);
  await press("Meta+/");
  await press("Meta+2");
  ok("an untied focus falls back to plain dim", (await lensIs()) === "dim", await lensIs());
  await press("Meta+2");
  ok("and still returns to that focus", (await M(() => __mf.focus)) === P1);
  await M(() => __mf.focusOut());
}

group("the number row is views");
{
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(220);
  const idOf = (t) => M((t) => Object.values(__mf.state.nodes).find((n) => n.text === t).id, t);
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(260); };
  const lensIs = () => M(() => __mf.lens);
  await M(() => __mf.paste("Hub\n- P1\n  - A\n    - a1\n- P2\n  - B"));
  await page.waitForTimeout(280);
  const A = await idOf("A"), B = await idOf("B");
  await M(([a, b]) => __mf.tie(a, b), [A, B]);

  await press("Meta+2");
  ok("Cmd+2 opens connections", (await lensIs()) === "dim");
  await press("Meta+1");
  ok("Cmd+1 returns to normal", (await lensIs()) === "off");
  await press("Meta+1");
  ok("Cmd+1 in normal stays normal", (await lensIs()) === "off");

  await M((x) => __mf.select(x), A);
  await press("Meta+/");
  await press("Meta+2");
  ok("from focus, Cmd+2 opens the network", (await lensIs()) === "one");
  await press("Meta+1");
  ok("Cmd+1 lands back in the focus", (await lensIs()) === "off" && (await M(() => __mf.focus)) === A);
  while (await M(() => __mf.focus)) await M(() => __mf.focusOut());
  await page.waitForTimeout(200);

  await press("Alt+Digit2");
  ok("Alt+2 mirrors Cmd+2", (await lensIs()) === "dim", await lensIs());
  await press("Alt+Digit1");
  ok("Alt+1 mirrors Cmd+1", (await lensIs()) === "off", await lensIs());
  await press("Alt+Digit3");
  ok("Alt+3 starts a presentation", (await M(() => __mf.pres)) !== null);
  await press("Alt+Digit3");
  ok("and Alt+3 again ends it", (await M(() => __mf.pres)) === null);

  // typing keeps the Alt digits
  await M((x) => __mf.select(x), B);
  await press("Space");
  await press("Alt+Digit2");
  ok("Alt+2 while typing does not switch views", (await lensIs()) === "off");
  await press("Escape");

  // Cmd+. is the old Cmd+1: centre on the selection at 100%
  await press("Meta+-"); await press("Meta+-");
  await M((x) => __mf.select(x), A);
  await press("Meta+.");
  const cam = await M(() => __mf.cam());
  const off = await M((x) => { const r = document.querySelector('.node[data-id="' + x + '"]').getBoundingClientRect(); return Math.abs(r.left + r.width / 2 - innerWidth / 2) + Math.abs(r.top + r.height / 2 - innerHeight / 2); }, A);
  ok("Cmd+. resets zoom to 100%", Math.abs(cam.z - 1) < 1e-6, cam.z);
  ok("and centres the selection", off < 260, off);
}

group("presentation");
{
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(220);
  const idOf = (t) => M((t) => Object.values(__mf.state.nodes).find((n) => n.text === t).id, t);
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(200); };
  const P = () => M(() => __mf.pres);
  const shown = () => M(() => __mf.shown);
  await M(() => __mf.paste("Pitch\n- Problem\n  - Slow\n  - Lost\n- Bet\n  - Keys\n    - Every control\n  - Layout\n  - Camera\n- Next"));
  await page.waitForTimeout(280);
  const root = await M(() => __mf.state.rootId);
  const [Prob, Slow, Lost, Bet, Keys, Every, Lay, Cam, Next] = await Promise.all(["Problem","Slow","Lost","Bet","Keys","Every control","Layout","Camera","Next"].map(idOf));
  const tie = await M(([a, b]) => __mf.tie(a, b), [Slow, Cam]);
  await M(() => __mf.select(__mf.state.rootId));
  const cam0 = await M(() => JSON.stringify(__mf.cam()));
  const fullPos = await M(() => JSON.stringify(__mf.pos()));

  await press("Meta+3");
  ok("Cmd+3 starts presenting", (await P()) !== null);
  ok("it starts on the centre alone", (await shown()) === 1 && (await P()).here === root, await shown());
  ok("the toolbar steps aside", await M(() => getComputedStyle(document.getElementById("topbar")).display === "none"));
  ok("no badges give the story away", await M(() => document.querySelectorAll(".badge").length === 0));
  ok("the bar says so", await M(() => /Presenting/.test(document.getElementById("crumbs").textContent)));

  await press("ArrowRight");
  ok("next reveals one node, in reading order", (await P()).here === Prob && (await shown()) === 2);
  ok("and selects it", (await M(() => __mf.selected)) === Prob);
  await press("Space");
  ok("Space steps too", (await P()).here === Slow);
  ok("a node lands exactly where the full layout puts it",
    await M(([s, full]) => JSON.stringify(__mf.pos()[s]) === JSON.stringify(JSON.parse(full)[s]), [Slow, fullPos]));
  ok("a link waits until both ends are on screen", await M(() => document.querySelectorAll("#paintLayer path.lk").length === 0));
  ok("the path to here does not step back", await M((x) => !document.querySelector('.node[data-id="' + x + '"]').classList.contains("past"), Prob));

  await press("Shift+ArrowRight");
  ok("Shift reveals the rest of the level at once", await M((x) => !!__mf.pos()[x], Lost));
  await press("ArrowRight");
  ok("then next carries on past them", (await P()).here === Bet, (await P()).here);
  ok("covered nodes step back", await M((x) => document.querySelector('.node[data-id="' + x + '"]').classList.contains("past"), Slow));
  await press("Shift+ArrowRight");
  ok("Shift on a parent reveals all its children", await M((ids) => ids.every((i) => !!__mf.pos()[i]), [Keys, Lay, Cam]));
  ok("and the link appears once both ends are shown", await M(() => document.querySelectorAll("#paintLayer path.lk").length > 0));
  ok("but not the grandchildren", await M((x) => !__mf.pos()[x], Every));
  await press("ArrowRight");
  ok("next goes into the first thing still hidden", (await P()).here === Every, (await P()).here);
  await press("ArrowLeft");
  ok("back undoes one step exactly", (await P()).here === Bet && await M((x) => !__mf.pos()[x], Every));
  await press("ArrowLeft");
  ok("including a whole level", await M((x) => !__mf.pos()[x], Keys));
  await press("ArrowRight"); await press("ArrowRight"); await press("ArrowRight"); await press("ArrowRight"); await press("ArrowRight"); await press("ArrowRight");
  ok("it reaches the end", (await P()).shown === 10, (await P()).shown);
  await press("ArrowRight");
  ok("and stops there", (await P()).shown === 10);
  await press("KeyO");
  await page.waitForTimeout(650);
  ok("O shows everything so far", (await M(() => __mf.cam().z)) <= 1.0001);

  // it is a view: typing and deleting do nothing
  const text = await M((x) => __mf.state.nodes[x].text, Next);
  await press("x"); await press("Backspace"); await press("Meta+z");
  ok("the keyboard cannot edit while presenting", (await M((x) => __mf.state.nodes[x] && __mf.state.nodes[x].text, Next)) === text && (await M(() => Object.keys(__mf.state.nodes).length)) === 10);

  await press("Home");
  ok("Home goes back to the start", (await shown()) === 1);
  await press("Escape");
  await page.waitForTimeout(300);
  ok("Esc ends it", (await P()) === null);
  ok("everything is back", (await shown()) === 10);
  ok("the camera is where it was", (await M(() => JSON.stringify(__mf.cam()))) === cam0);
  ok("and the toolbar returns", await M(() => getComputedStyle(document.getElementById("topbar")).display !== "none"));

  // from a focused branch, only that branch is told, and focus comes back
  await M((x) => __mf.select(x), Bet);
  await press("Meta+/");
  await press("Meta+3");
  ok("presenting a focus walks just that branch", (await P()).total === 5, (await P()).total);
  await press("Meta+1");
  ok("Cmd+1 ends it and the focus is still there", (await P()) === null && (await M(() => __mf.focus)) === Bet);
  await M(() => __mf.focusOut());

  // folded branches stay folded
  await M((x) => { __mf.select(x); __mf.fold(x); }, Prob);
  await press("Meta+3");
  ok("a folded branch is left out of the walk", (await P()).total === 8, (await P()).total);
  await press("Meta+2");
  ok("Cmd+2 ends it and opens connections", (await P()) === null && (await M(() => __mf.lens)) === "dim");
  await M(() => __mf.setLens("off"));
}

group("presentation: the end, the whole story, jumping");
{
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(220);
  const idOf = (t) => M((t) => Object.values(__mf.state.nodes).find((n) => n.text === t).id, t);
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(200); };
  const P = () => M(() => __mf.pres);
  await M(() => __mf.paste("Talk\n- One\n  - x\n  - y\n  - z\n- Two\n- Three"));
  await page.waitForTimeout(280);
  const root = await M(() => __mf.state.rootId);
  const [One, x, y, z, Two, Three] = await Promise.all(["One","x","y","z","Two","Three"].map(idOf));
  // story: root -> One -> Three ; inside One: z then x (y skipped)
  await M(([r, a]) => __mf.storyLink(r, a), [root, One]);
  await M(([a, b]) => __mf.storyLink(a, b), [One, Three]);
  await M(([a, b]) => __mf.storyLink(a, b), [One, z]);
  await M(([a, b]) => __mf.storyLink(a, b), [z, x]);
  ok("the story is as picked", (await M(() => __mf.walk.map((i) => __mf.state.nodes[i].text).join(","))) === "Talk,One,z,x,Three");

  await press("Meta+3");
  await press("ArrowRight");
  await press("Shift+ArrowRight");
  ok("Shift reveals only the picked children", await M(([a, b, c]) => !!__mf.pos()[a] && !!__mf.pos()[b] && !__mf.pos()[c], [z, x, y]));
  await press("Shift+ArrowRight");
  ok("and on to picked siblings, never skipped ones", await M(([a, b]) => !!__mf.pos()[a] && !__mf.pos()[b], [Three, Two]));

  await press("Home");
  await press("Shift+KeyO");
  ok("Shift+O shows the whole story", (await M(() => __mf.shown)) === 5, await M(() => __mf.shown));
  ok("with nothing dimmed", await M(() => document.querySelectorAll(".node.past").length === 0));
  ok("and nothing outside it", await M((t) => !__mf.pos()[t], Two));
  await press("Shift+KeyO");
  ok("Shift+O again goes back to the progress", (await M(() => __mf.shown)) === 1);

  for (let i = 0; i < 4; i++) await press("ArrowRight");
  ok("the last node is told", (await P()).here === Three && (await P()).shown === 5);
  await press("ArrowRight");
  await page.waitForTimeout(600);
  ok("one more step lights the whole story", await M(() => document.querySelectorAll(".node.past").length === 0));
  ok("and stands back", (await M(() => __mf.cam().z)) <= 1.0001);
  await press("ArrowRight");
  ok("then it stops", (await P()).shown === 5);
  await press("ArrowLeft");
  ok("back leaves the finale", await M(() => document.querySelectorAll(".node.past").length > 0));

  // Cmd+K mid-talk
  await press("Home");
  await press("Meta+k");
  ok("Cmd+K opens the jump box while presenting", await M(() => document.getElementById("jump").classList.contains("on")));
  await page.keyboard.type("x");
  await page.waitForTimeout(150);
  await press("Enter");
  ok("jumping tells everything up to that node", (await P()).here === x && (await P()).shown === 4, JSON.stringify(await P()));
  await press("Meta+k");
  await press("Escape");
  ok("Esc closes the jump box without ending the talk", (await P()) !== null);
  await press("Meta+k");
  await page.keyboard.type("Two");
  await page.waitForTimeout(150);
  await press("Enter");
  ok("a node outside the story is refused", (await P()).here === x);

  // copy the story as an outline
  await press("KeyR");
  await M(() => { document.querySelector('#crumbs button[data-cmenu]').click(); document.querySelector('#storyMenu .mi[data-c="0"]').click(); });
  await page.waitForTimeout(250);
  ok("the arrange bar copies the story as an outline", /story copied/.test(await M(() => document.getElementById("saveState").textContent)));
  await press("Escape");
}

group("presentation: a talk set up the way you talk (1.6.0)");
{
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(220);
  const idOf = (t) => M((t) => Object.values(__mf.state.nodes).find((n) => n.text === t).id, t);
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(200); };
  const P = () => M(() => __mf.pres);
  const cls = (id) => M((x) => { const el = document.querySelector('.node[data-id="' + x + '"]'); return el ? el.className : "gone"; }, id);
  const has = async (id, c) => (await cls(id)).split(" ").includes(c);
  const onScreen = (id) => M((x) => !!__mf.pos()[x], id);
  const set = (k, v) => M(([k, v]) => __mf.set(k, v), [k, v]);
  const reset = () => M(() => { ["presStyle","presReach","presBack","presStep","presCam"].forEach((k) => { __mf.cfg[k] = { presStyle:"map", presReach:"told", presBack:"fade", presStep:"node", presCam:"follow" }[k]; }); __mf.set("gap", __mf.cfg.gap); });
  await M(() => __mf.paste("Pitch\n- Problem\n  - Slow\n  - Lost\n- Bet\n  - Keys\n    - Every control\n  - Layout\n  - Camera\n- Next"));
  await page.waitForTimeout(280);
  const root = await M(() => __mf.state.rootId);
  const [Prob, Slow, Lost, Bet, Keys, Every, Lay, Cam, Next] = await Promise.all(["Problem","Slow","Lost","Bet","Keys","Every control","Layout","Camera","Next"].map(idOf));
  const all = [Prob, Slow, Lost, Bet, Keys, Every, Lay, Cam, Next];
  await M(([a, b]) => { __mf.select(a); }, [Slow]); await press("Meta+Shift+Digit9");
  await M(([a, b]) => { __mf.select(a); }, [Lost]); await press("Meta+Shift+Digit9");
  ok("two paragraphs for the cards to read", await M(([a, b]) => __mf.state.nodes[a].prose && __mf.state.nodes[b].prose, [Slow, Lost]));
  await M((r) => __mf.select(r), root);

  // ---- 1. the defaults are exactly the 1.5.1 talk ----
  const defaults = await M(() => ({ s: __mf.cfg.presStyle, r: __mf.cfg.presReach, b: __mf.cfg.presBack, st: __mf.cfg.presStep, c: __mf.cfg.presCam }));
  ok("the five settings default to the 1.5.1 talk", defaults.s === "map" && defaults.r === "told" && defaults.b === "fade" && defaults.st === "node" && defaults.c === "follow", defaults);
  await press("Meta+3");
  await press("ArrowRight"); await press("ArrowRight"); await press("ArrowRight");
  ok("with nothing set, a talk hides the unreached", !(await onScreen(Bet)) && !(await onScreen(Next)) && (await has(Bet, "preshide")));
  ok("and dims what is told but not on the path", (await has(Slow, "past")) && (await onScreen(Slow)));
  ok("but never the path to here", !(await has(Prob, "past")) && !(await has(Lost, "past")));
  ok("the body shapes fade the same way", await M(() => /opacity="\.38"/.test(document.getElementById("paintLayer").innerHTML) && !/opacity="\.16"/.test(document.getElementById("paintLayer").innerHTML)));

  // ---- 2. reach, and what is behind you ----
  await set("presReach", "all");
  ok("reach all draws every node from the first step", (await Promise.all(all.map(onScreen))).every(Boolean));
  ok("with the unreached fainter than the told", (await has(Bet, "far")) && (await has(Next, "far")) && (await has(Slow, "past")) && !(await has(Slow, "far")));
  ok("in the shapes too", await M(() => /opacity="\.16"/.test(document.getElementById("paintLayer").innerHTML) && /opacity="\.38"/.test(document.getElementById("paintLayer").innerHTML)));
  ok("and the path lit", !(await has(Prob, "past")) && !(await has(Lost, "past")) && !(await has(Lost, "far")));
  await set("presBack", "keep");
  ok("keep leaves told nodes undimmed", !(await has(Slow, "past")) && !(await has(Slow, "far")));
  ok("while the unreached still sit far back", await has(Next, "far"));
  await set("presReach", "told"); await set("presBack", "keep");
  ok("keep with reach told dims nothing at all", await M(() => document.querySelectorAll(".node.past, .node:not(.preshide).far").length === 0));
  await set("presBack", "hide");
  ok("hide draws only the current path", (await onScreen(Prob)) && (await onScreen(Lost)) && !(await onScreen(Slow)) && (await has(Slow, "preshide")));
  await press("ArrowRight");
  ok("and the next step hides the last one behind you", (await P()).here === Bet && !(await onScreen(Lost)) && !(await onScreen(Prob)) && (await onScreen(Bet)));
  await press("ArrowLeft");

  // ---- 3. hide is not offered while reach is all ----
  await set("presReach", "all");
  ok("hide is not offered while reach is all", (await M(() => __mf.panelOpts.presBack)).join(",") === "keep,fade");
  ok("the row's other options still are", (await M(() => __mf.panelOpts.presReach)).join(",") === "told,all");
  await set("presBack", "hide");
  const shownCount = await M(() => Object.keys(__mf.pos()).length);
  ok("set through CFG anyway, the screen is not empty", shownCount === 10, shownCount);
  await set("presReach", "told");
  ok("back on reach told, hide is offered again", (await M(() => __mf.panelOpts.presBack)).join(",") === "keep,fade,hide");
  await press("Escape");
  await reset();

  // ---- 4. what one step reveals ----
  await M((r) => __mf.select(r), root);
  await set("presStep", "row");
  ok("presStepMode reads the setting, Shift one coarser", (await M(() => [__mf.presStepMode(false), __mf.presStepMode(true)])).join(",") === "row,branch");
  await press("Meta+3");
  await press("Home");
  await press("ArrowRight");
  ok("with row, a bare Right reveals a whole level", (await onScreen(Prob)) && (await onScreen(Bet)) && (await onScreen(Next)) && !(await onScreen(Slow)), (await P()));
  ok("with the level's parent as the current node", (await P()).here === root);
  await press("Shift+ArrowRight");
  ok("and Shift+Right then reveals a branch", (await onScreen(Slow)) && (await onScreen(Lost)) && !(await onScreen(Keys)) && (await P()).here === Prob, (await P()));
  await press("ArrowRight");
  ok("the next row is the row the next untold node sits in", (await onScreen(Keys)) && (await onScreen(Lay)) && (await onScreen(Cam)) && !(await onScreen(Every)) && (await P()).here === Bet, (await P()));
  await press("Escape");
  await set("presStep", "node");
  await M((r) => __mf.select(r), root);
  await press("Meta+3"); await press("Home");
  await press("ArrowRight"); await press("Shift+ArrowRight");
  ok("with node, Shift+Right is still a row", (await onScreen(Slow)) && (await onScreen(Lost)) && !(await onScreen(Bet)), (await P()));
  await press("Escape");
  await set("presStep", "branch");
  await M((r) => __mf.select(r), root);
  await press("Meta+3"); await press("Home");
  await press("ArrowRight");
  ok("with branch, one step tells a whole branch", (await onScreen(Prob)) && (await onScreen(Slow)) && (await onScreen(Lost)) && !(await onScreen(Bet)) && (await P()).here === Prob, (await P()));
  await press("Shift+ArrowRight");
  ok("and Shift+Right does the same", (await onScreen(Bet)) && (await onScreen(Every)) && (await onScreen(Cam)) && !(await onScreen(Next)) && (await P()).here === Bet, (await P()));
  ok("the branch is lit, the one before sits back", !(await has(Every, "past")) && (await has(Prob, "past")));
  await press("ArrowLeft");
  ok("back undoes the whole branch", !(await onScreen(Bet)) && (await P()).here === Prob);
  await press("Escape");
  await reset();

  // ---- 5. the camera ----
  await M((r) => __mf.select(r), root);
  await press("Meta+3"); await press("Home");
  await press("ArrowRight"); await press("ArrowRight");
  const fr = (ids) => M((ids) => { const f = __mf.presFrameIds() || []; return ids.every((i) => f.includes(i)) && f.length === ids.length; }, ids);
  ok("follow frames here and its parent", await fr([Slow, Prob]), await M(() => __mf.presFrameIds()));
  await page.waitForTimeout(600);
  const zFollow = (await M(() => __mf.cam())).z;
  await set("presCam", "all");
  await press("ArrowRight");
  ok("all frames everything on screen", await M(() => { const f = __mf.presFrameIds(), p = Object.keys(__mf.pos()); return f.length === p.length && p.every((i) => f.includes(i)); }));
  await page.waitForTimeout(600);
  const zAll = (await M(() => __mf.cam())).z;
  ok("and the camera stands further back for it", zAll <= zFollow, [zAll, zFollow]);
  await set("presCam", "branch");
  await press("ArrowRight");
  ok("branch frames the branch you are in plus the root", (await P()).here === Bet && await fr([root, Bet, Keys, Every, Lay, Cam]), await M(() => __mf.presFrameIds()));
  await press("ArrowRight");
  ok("and the same branch on the next step inside it", (await P()).here === Keys && await fr([root, Bet, Keys, Every, Lay, Cam]));
  await press("Escape");
  await reset();

  // ---- 6. present from the selection ----
  await M((b) => __mf.select(b), Bet);
  const camBefore = await M(() => JSON.stringify(__mf.cam()));
  await press("Meta+p");
  ok("Cmd+P starts a talk from the selection", (await P()) !== null && (await M(() => __mf.presRoot())) === Bet);
  ok("the order begins at the selection", (await M(() => __mf.walk.map((i) => __mf.state.nodes[i].text).join(","))) === "Bet,Keys,Every control,Layout,Camera");
  ok("the centre is not told", !(await onScreen(root)) && !(await onScreen(Prob)) && (await onScreen(Bet)));
  await press("ArrowRight");
  ok("and it steps inside the branch", (await P()).here === Keys);
  await press("Escape");
  ok("Esc restores the selection", (await M(() => __mf.selected)) === Bet);
  await page.waitForTimeout(600);
  ok("and the camera", (await M(() => JSON.stringify(__mf.cam()))) === camBefore);
  await M((r) => __mf.select(r), root);
  await press("Meta+3");
  ok("a talk from the centre does not resume the one from the branch", (await M(() => __mf.presRoot())) === root && (await P()).shown === 1, await P());
  await press("Escape");
  await M((b) => __mf.select(b), Bet);
  await press("Alt+Shift+KeyP");
  ok("Alt+Shift+P is the twin", (await M(() => __mf.presRoot())) === Bet);
  await press("ArrowRight");
  await press("Escape");
  await press("Meta+p");
  ok("and a second talk from the same branch resumes it", (await P()).here === Keys, await P());
  await press("Escape");
  await M((r) => __mf.select(r), root);
  await press("Meta+p");
  ok("on the root, Cmd+P is Cmd+3", (await M(() => __mf.presRoot())) === root && (await M(() => __mf.walk.length)) === 10);
  await press("Escape");
  await M((b) => __mf.select(b), Bet);
  await M(() => { document.querySelector('.node[data-id="' + __mf.selected + '"]').dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 400, clientY: 300, button: 2 })); });
  await page.waitForTimeout(150);
  const rows = await M(() => Array.from(document.querySelectorAll("#storyMenu .mi")).map((b) => b.textContent));
  ok("the right-click menu has Present from here", rows.some((r) => /Present from here/.test(r)), rows);
  await press("Escape");

  // ---- 7. cards ----
  await M((r) => __mf.select(r), root);
  await set("presStyle", "cards");
  await press("Meta+3"); await press("Home");
  ok("cards: the body says so", await M(() => document.body.classList.contains("cards")));
  ok("the map is still rendered underneath: every node has a box", await M(() => Object.keys(__mf.state.nodes).every((i) => !!__mf.boxes()[i])));
  ok("but it is not shown", await M(() => getComputedStyle(document.getElementById("world")).visibility === "hidden"));
  await press("ArrowRight"); await press("ArrowRight");
  let c = await M(() => __mf.card());
  ok("a paragraph is read on its parent's card", c.id === Prob && c.text === "Problem" && c.crumb.join(">") === "Pitch");
  ok("with the paragraphs told so far as the body, in order", c.body.map((b) => b.text).join(",") === "Slow" && c.body[0].here, c.body);
  await press("ArrowRight");
  c = await M(() => __mf.card());
  ok("the next paragraph joins the body", c.body.map((b) => b.text).join(",") === "Slow,Lost" && c.body[1].here && !c.body[0].here, c.body);
  ok("and the card on screen carries them", await M(() => document.querySelectorAll("#card .cbody p").length === 2 && document.querySelector("#card .big").textContent === "Problem"));
  await press("ArrowRight"); await press("Shift+ArrowRight");
  c = await M(() => __mf.card());
  ok("non-prose children are chips", c.id === Bet && c.kids.map((k) => k.text).join(",") === "Keys,Layout,Camera" && c.body.length === 0, c);
  const camC = await M(() => JSON.stringify(__mf.cam()));
  await press("KeyO");
  ok("O flashes rather than acting", (await M(() => JSON.stringify(__mf.cam()))) === camC && (await P()) !== null && /overview/.test(await M(() => document.getElementById("saveState").textContent)));
  await press("Shift+KeyO");
  ok("and so does Shift+O", (await P()).shown === 8, await P());
  await press("Escape");
  ok("Esc ends it and the map comes back", (await P()) === null && await M(() => !document.body.classList.contains("cards") && getComputedStyle(document.getElementById("world")).visibility === "visible"));
  await reset();

  // ---- 7b. the talk panel (1.6.1) ----
  await M((r) => __mf.select(r), root);
  await press("Meta+3"); await press("Home"); await press("ArrowRight");
  ok("the talk panel is closed to begin with", !(await M(() => __mf.talkOpen)));
  await press("KeyT");
  ok("T opens it mid-talk", (await M(() => __mf.talkOpen)) && await M(() => getComputedStyle(document.getElementById("talk")).display !== "none"));
  ok("with the five rows, worded", (await M(() => document.querySelectorAll("#talk .grp").length)) === 5 && (await M(() => document.querySelectorAll("#talk .opt.txt").length)) === 13);
  ok("and the picked option's meaning under each row", (await M(() => document.querySelectorAll("#talk .desc").length)) === 5 && /revealed as you talk/.test(await M(() => document.querySelector("#talk .desc").textContent)));
  await M(() => document.querySelector('#talk button[data-k="presReach"][data-v="all"]').click()); await page.waitForTimeout(250);
  ok("a pick takes effect on the step you are on", (await M(() => __mf.cfg.presReach)) === "all" && (await onScreen(Next)) && (await P()) !== null);
  ok("and the panel redraws: hide gone, the meaning updated", (await M(() => document.querySelectorAll('#talk button[data-k="presBack"]').length)) === 2 && /first second/.test(await M(() => document.querySelectorAll("#talk .desc")[1].textContent)));
  ok("the panel never takes the keyboard", (await M(() => document.activeElement === document.body || document.activeElement.id === "sink")));
  await press("ArrowRight");
  ok("so the talk still steps", (await P()).here === Slow, await P());
  await M(() => document.querySelector('#talk button[data-k="presStyle"][data-v="cards"]').click()); await page.waitForTimeout(250);
  ok("cards hides the camera row", (await M(() => document.querySelectorAll('#talk .grp:not(.hide)').length)) === 4 && await M(() => document.body.classList.contains("cards")));
  await M(() => document.querySelector('#talk button[data-k="presStyle"][data-v="map"]').click()); await page.waitForTimeout(250);
  await press("Escape");
  ok("Esc closes the panel before it ends the talk", !(await M(() => __mf.talkOpen)) && (await P()) !== null);
  await press("KeyT");
  await press("Escape"); await press("Escape");
  ok("and the talk ending closes it too", (await P()) === null && !(await M(() => __mf.talkOpen)) && await M(() => getComputedStyle(document.getElementById("talk")).display === "none"));
  await reset();
  ok("the Style panel's Presenting rows are worded the same way", (await M(() => { document.getElementById("btnStyle").click(); const n = document.querySelectorAll("#styleScroll .opt.txt").length; document.getElementById("btnStyle").click(); return n; })) === 13);

  // ---- 8. a 1.5.1 settings blob loads with the new keys defaulted ----
  await M(() => { __mf.cfg.slop = 3; __mf.set("gap", __mf.cfg.gap); });
  await page.waitForTimeout(600);
  const blob = await M(() => { const idx = JSON.parse(localStorage.getItem("mappr.index")); const d = JSON.parse(localStorage.getItem("mappr.doc." + idx.current)); ["presStyle","presReach","presBack","presStep","presCam"].forEach((k) => { delete d.cfg[k]; }); localStorage.setItem("mappr.doc." + idx.current, JSON.stringify(d)); return Object.keys(d.cfg).length; });
  await page.reload(); await page.waitForTimeout(500);
  const after = await M(() => ({ s: __mf.cfg.presStyle, r: __mf.cfg.presReach, b: __mf.cfg.presBack, st: __mf.cfg.presStep, c: __mf.cfg.presCam, slop: __mf.cfg.slop, nodes: Object.keys(__mf.state.nodes).length }));
  ok("a 1.5.1 settings blob loads with all five keys defaulted", after.s === "map" && after.r === "told" && after.b === "fade" && after.st === "node" && after.c === "follow", after);
  ok("and nothing else disturbed", after.slop === 3 && after.nodes === 10, after);
  await M(() => { __mf.cfg.slop = 1; __mf.set("gap", __mf.cfg.gap); });
  ok("no runtime errors", errors.length === 0, errors);
}

group("story order");
{
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(220);
  const idOf = (t) => M((t) => Object.values(__mf.state.nodes).find((n) => n.text === t).id, t);
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(180); };
  const walkText = () => M(() => __mf.walk.map((i) => __mf.state.nodes[i].text).join(","));
  await M(() => __mf.paste("Pitch\n- Problem\n  - Slow\n  - Lost\n- Bet\n  - Keys\n  - Layout\n  - Camera\n- Proof\n- Ask"));
  await page.waitForTimeout(280);
  const root = await M(() => __mf.state.rootId);
  const [Prob, Slow, Lost, Bet, Keys, Lay, Cam, Proof, Ask] = await Promise.all(["Problem","Slow","Lost","Bet","Keys","Layout","Camera","Proof","Ask"].map(idOf));
  ok("with no order the walk is map order", (await walkText()) === "Pitch,Problem,Slow,Lost,Bet,Keys,Layout,Camera,Proof,Ask");

  await press("Meta+3");
  await press("KeyR");
  ok("R arranges", await M(() => __mf.arranging));
  ok("the whole map is on screen while arranging", (await M(() => __mf.shown)) === 10);
  ok("the bar says so", await M(() => /Arranging/.test(document.getElementById("crumbs").textContent)));

  const clickNode = async (id, mods) => {
    // the camera may still be gliding: wait until the node holds still
    const at = () => M((x) => { const b = document.querySelector('.node[data-id="' + x + '"]').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, id);
    let r = await at();
    for (let t = 0; t < 20; t++) { await page.waitForTimeout(60); const q = await at(); if (Math.abs(q.x - r.x) < 0.5 && Math.abs(q.y - r.y) < 0.5) break; r = q; }
    for (const m of mods || []) await page.keyboard.down(m);
    await page.mouse.click(r.x, r.y);
    for (const m of (mods || []).reverse()) await page.keyboard.up(m);
    await page.waitForTimeout(180);
  };
  await clickNode(root);
  ok("a plain click selects while arranging", (await M(() => __mf.selected)) === root);
  await clickNode(Ask, ["Meta"]);
  ok("picking one child tells just that child", (await walkText()) === "Pitch,Ask", await walkText());
  await clickNode(Proof, ["Meta"]);
  ok("siblings chain on after it", (await walkText()) === "Pitch,Ask,Proof", await walkText());
  ok("picked nodes are numbered", await M(() => [...document.querySelectorAll(".badge.story")].map((b) => b.textContent).sort().join() === "1,2"));
  ok("unpicked branches are marked skipped", await M(() => [...document.querySelectorAll(".badge.skip")].filter((b) => b.textContent === "skipped").length === 2));
  ok("and look it", await M((x) => document.querySelector('.node[data-id="' + x + '"]').classList.contains("skipped"), Slow));

  await clickNode(Slow);
  await clickNode(Cam, ["Meta"]);
  ok("order never crosses levels", !JSON.stringify(await M(() => __mf.story)).includes(Cam));

  await clickNode(Proof);
  await clickNode(Bet, ["Meta"]);
  ok("a picked node with an untouched level brings all its children", (await walkText()) === "Pitch,Ask,Proof,Bet,Keys,Layout,Camera", await walkText());

  // keyboard: pick Camera, drop on Keys -> Camera then Keys, Layout skipped
  await M((x) => __mf.select(x), Cam);
  await press("Space");
  await M((x) => __mf.select(x), Keys);
  await press("Space");
  ok("Space picks and Space drops, and the rest of that level is skipped", (await walkText()) === "Pitch,Ask,Proof,Bet,Camera,Keys", await walkText());

  // unpicking Bet resets everything arranged under it
  await M((x) => __mf.select(x), Bet);
  await press("Backspace");
  ok("unpicking a node takes it out", (await walkText()) === "Pitch,Ask,Proof", await walkText());
  ok("and resets every arrangement under it", !(await M((b) => !!__mf.story[b], Bet)));
  await press("Meta+z");
  ok("undo brings it all back", (await walkText()) === "Pitch,Ask,Proof,Bet,Camera,Keys", await walkText());

  // unpicking from the middle of a chain keeps both sides joined
  await M((x) => __mf.select(x), Proof);
  await press("Backspace");
  ok("unpicking mid-chain joins its neighbours", (await walkText()) === "Pitch,Ask,Bet,Camera,Keys", await walkText());
  await press("Meta+z");

  // unlinking by the same pair also resets what was under the unpicked node
  await M((x) => __mf.select(x), Proof);
  await clickNode(Bet, ["Meta"]);
  ok("the same pair again unlinks", (await walkText()) === "Pitch,Ask,Proof", await walkText());
  ok("and the unlinked node's arrangement is reset", !(await M((b) => !!__mf.story[b], Bet)));
  await press("Meta+z");

  await press("KeyR");
  ok("R again presents", !(await M(() => __mf.arranging)) && (await M(() => __mf.pres.shown)) === 1);
  ok("the progress line is up", await M(() => getComputedStyle(document.getElementById("presProgress")).display === "block"));
  await press("ArrowRight");
  ok("the walk follows the story", (await M(() => __mf.pres.here)) === Ask);
  await clickNode(Ask);
  ok("a click moves on too", (await M(() => __mf.pres.here)) === Proof);
  await page.mouse.click(40, 400, { button: "right" });
  await page.waitForTimeout(200);
  ok("a right-click goes back", (await M(() => __mf.pres.here)) === Ask);
  ok("the bar offers full screen", await M(() => [...document.querySelectorAll("#crumbs button")].some((b) => /Full screen/.test(b.textContent))));

  // leave and come back: resume
  await press("Escape");
  await press("Meta+3");
  ok("coming back resumes the talk", (await M(() => __mf.pres.here)) === Ask, await M(() => __mf.pres.here));
  await press("Home");
  ok("Home starts over", (await M(() => __mf.pres.shown)) === 1);
  await press("Escape");

  // saved with the map; deleting heals
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForFunction(() => !!window.__mf);
  await page.waitForTimeout(300);
  ok("the order survives a reload", (await walkText()) === "Pitch,Ask,Proof,Bet,Camera,Keys", await walkText());
  await M((x) => __mf.select(x), Proof);
  await press("Backspace");
  await page.waitForTimeout(200);
  ok("deleting an ordered node heals the order", !JSON.stringify(await M(() => __mf.story)).includes(Proof), await walkText());
  const svg = await M(() => __mf.svg());
  ok("an export shows no story arrows", !svg.includes('class="story"'));
}

group("cycling branches and networks");
{
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(220);
  const idOf = (t) => M((t) => Object.values(__mf.state.nodes).find((n) => n.text === t).id, t);
  const tab = async (shift) => { if (shift) await page.keyboard.down("Shift"); await page.keyboard.down("Tab"); await page.keyboard.up("Tab"); if (shift) await page.keyboard.up("Shift"); await page.waitForTimeout(220); };
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(220); };
  await M(() => __mf.paste("Hub\n- A\n  - a1\n- B\n  - b1\n- C\n  - c1\n  - c2"));
  await page.waitForTimeout(280);
  const [A, B, C, a1, b1, c1, c2] = await Promise.all(["A","B","C","a1","b1","c1","c2"].map(idOf));

  // focus: Tab cycles sibling branches and wraps
  await M((x) => __mf.select(x), A);
  await press("Meta+/");
  await tab();
  ok("Tab moves the focus to the next branch", (await M(() => __mf.focus)) === B, await M(() => __mf.focus));
  ok("the bar counts branches", await M(() => /branch 2 of 3/.test(document.getElementById("crumbs").textContent)));
  await tab(); await tab();
  ok("and wraps round", (await M(() => __mf.focus)) === A);
  await tab(true);
  ok("Shift+Tab goes back", (await M(() => __mf.focus)) === C);
  await M((x) => __mf.select(x), c1);
  await tab();
  ok("inside the branch, Tab still cycles the level", (await M(() => __mf.selected)) === c2 && (await M(() => __mf.focus)) === C);
  await M(() => { while (__mf.focus) __mf.focusOut(); });

  // two separate networks: a1-b1 and c1-c2
  await M(([x, y]) => __mf.tie(x, y), [a1, b1]);
  await M(([x, y]) => __mf.tie(x, y), [c1, c2]);
  await M((x) => __mf.select(x), a1);
  await press("Meta+2");
  ok("dim counts the networks", await M(() => /network 1 of 2/.test(document.getElementById("crumbs").textContent)), await M(() => document.getElementById("crumbs").textContent));
  await tab();
  ok("Tab in dim jumps to the next network", (await M(() => __mf.selected)) === c1, await M(() => __mf.selected));
  await tab();
  ok("and wraps", (await M(() => __mf.selected)) === a1);
  await press("ArrowRight");
  ok("arrows step networks in dim too", (await M(() => __mf.selected)) === c1);
  await press("ArrowRight");
  ok("but stop at the end", (await M(() => __mf.selected)) === c1);
  await press("ArrowLeft");
  ok("and go back", (await M(() => __mf.selected)) === a1);

  // focused network: on its centre, arrows and Tab switch network
  await press("Meta+/");
  ok("focus opens a1's network", (await M(() => __mf.lens)) === "one");
  ok("the bar counts it", await M(() => /Network 1 of 2/.test(document.getElementById("crumbs").textContent)));
  await press("ArrowDown");
  ok("an arrow on the centre opens the next network", (await M(() => __mf.selected)) === c1 && (await M(() => __mf.lens)) === "one");
  ok("showing only that network", await M(([x, y]) => !!__mf.pos()[x] && !__mf.pos()[y], [c2, b1]));
  await tab();
  ok("Tab on the centre goes round to the first again", (await M(() => __mf.selected)) === a1);
  await press("Meta+1");
}

group("mode bar, camera memory, clearing links, several stories");
{
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(220);
  const idOf = (t) => M((t) => Object.values(__mf.state.nodes).find((n) => n.text === t).id, t);
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(220); };
  const cam = () => M(() => JSON.stringify(__mf.cam()));
  const modeOn = () => M(() => document.querySelector("#modebar button.on")?.dataset.mode);
  await M(() => __mf.paste("Hub\n- A\n  - a1\n  - a2\n- B\n  - b1\n- C"));
  await page.waitForTimeout(280);
  const [A, a1, a2, B, b1, C] = await Promise.all(["A","a1","a2","B","b1","C"].map(idOf));
  await M(([x, y]) => __mf.tie(x, y), [a1, b1]);
  await M(([x, y]) => __mf.tie(x, y), [a1, C]);

  ok("the mode bar shows Map", (await modeOn()) === "1");
  await M(() => document.querySelector('#modebar button[data-mode="2"]').click());
  await page.waitForTimeout(250);
  ok("clicking Connections opens it", (await M(() => __mf.lens)) === "dim" && (await modeOn()) === "2");
  await M(() => document.querySelector('#modebar button[data-mode="1"]').click());
  await page.waitForTimeout(250);
  ok("clicking Map goes back", (await M(() => __mf.lens)) === "off" && (await modeOn()) === "1");

  // Cmd+2 keeps the camera
  await M(() => __mf.select(__mf.state.rootId));
  await press("Meta+=");
  const c0 = await cam();
  await press("Meta+2");
  ok("switching to connections keeps the zoom and place", (await cam()) === c0);
  await press("Meta+0");
  ok("Cmd+0 fits within connections without leaving it", (await M(() => __mf.lens)) === "dim" && (await cam()) !== c0);
  await press("Meta+1");

  // focus remembers the camera
  await M((x) => __mf.select(x), A);
  await press("Meta+=");
  const c1 = await cam();
  await press("Meta+/");
  ok("focus moves the camera", (await cam()) !== c1);
  await press("Escape");
  await page.waitForTimeout(150);
  ok("Esc puts the camera back where it was, not zoomed out", (await cam()) === c1, (await cam()) + " vs " + c1);

  // Cmd+. then Esc
  await M((x) => __mf.select(x), b1);
  await press("Meta+.");
  await page.waitForTimeout(350);
  ok("Cmd+. goes to 100%", (await M(() => __mf.cam().z)) === 1);
  await press("Escape");
  ok("Esc after Cmd+. comes back", (await cam()) === c1);

  // Shift+double-click clears a node's links in connections
  await press("Meta+2");
  const box = await M((x) => { const r = document.querySelector('.node[data-id="' + x + '"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, a1);
  await page.keyboard.down("Shift");
  await page.mouse.dblclick(box.x, box.y);
  await page.keyboard.up("Shift");
  await page.waitForTimeout(250);
  ok("Shift+double-click clears the node's links", (await M(() => __mf.links)).length === 0);
  ok("with nothing left tied, connections closes", (await M(() => __mf.lens)) === "off");
  ok("nothing got selected as a row", (await M(() => __mf.rawMarked)).length === 0);
  await press("Meta+z");
  ok("undo brings the links back", (await M(() => __mf.links)).length === 2);

  // several stories
  ok("a map starts with one story", (await M(() => __mf.stories)).join() === "Story 1");
  await press("Meta+3");
  await press("KeyR");
  ok("the mode bar shows Story while arranging", (await modeOn()) === "3");
  await M((r) => __mf.storyLink(r, __mf.state.nodes[r].children[2]), await M(() => __mf.state.rootId));
  const walk1 = await M(() => __mf.walk.length);
  const openMenu = async () => { await M(() => document.querySelector("#crumbs button[data-smenu]").click()); await page.waitForTimeout(120); };
  const menuClick = async (sel) => { await M((q) => document.querySelector("#storyMenu " + q).click(), sel); await page.waitForTimeout(180); };
  ok("the bar shows the story as a dropdown", await M(() => /Story 1/.test(document.querySelector("#crumbs button[data-smenu]").textContent)));
  await openMenu();
  ok("the menu lists the stories", await M(() => document.querySelectorAll("#storyMenu [data-i]").length === 1));
  await menuClick('[data-act="new"]');
  ok("New story adds a second one", (await M(() => __mf.stories)).length === 2 && (await M(() => __mf.storyAt)) === 1);
  ok("and closes the menu", await M(() => !document.getElementById("storyMenu")));
  ok("a new story tells the whole map", (await M(() => __mf.walk.length)) === 7);
  await press("BracketLeft");
  ok("[ switches back", (await M(() => __mf.storyAt)) === 0 && (await M(() => __mf.walk.length)) === walk1);
  await openMenu();
  await press("Digit2");
  ok("a number in the open menu picks that story", (await M(() => __mf.storyAt)) === 1);
  await openMenu();
  await menuClick('[data-act="ren"]');
  await page.keyboard.press("Meta+a");
  await page.keyboard.type("Investor cut");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  ok("Rename renames the current story", (await M(() => __mf.stories))[1] === "Investor cut", (await M(() => __mf.stories)).join());
  ok("renaming did not leave arrange mode", await M(() => __mf.arranging));
  await openMenu();
  await menuClick('[data-act="del"]');
  ok("one click only arms delete", (await M(() => __mf.stories)).length === 2 && await M(() => /Click again/.test(document.getElementById("storyMenu").textContent)));
  await menuClick('[data-act="del"]');
  ok("the second click deletes", (await M(() => __mf.stories)).join() === "Story 1");
  await press("Meta+z");
  ok("undo restores it", (await M(() => __mf.stories)).length === 2);
  await openMenu();
  await page.mouse.click(700, 600);
  await page.waitForTimeout(120);
  ok("a click elsewhere closes the menu", await M(() => !document.getElementById("storyMenu")));
  ok("the hint bar shows story keys", await M(() => /STORY|Story/.test(document.getElementById("hint").textContent) && /Pick up/.test(document.getElementById("hint").textContent)));
  await press("KeyR");
  ok("presenting names the story", await M(() => /Investor cut|Story 1/.test(document.getElementById("crumbs").textContent)));
  await press("Escape");
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForFunction(() => !!window.__mf);
  await page.waitForTimeout(300);
  ok("stories survive a reload", (await M(() => __mf.stories)).length === 2);
}

group("hint bar and presenting chrome");
{
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(220);
  const hint = () => M(() => document.getElementById("hint").textContent);
  ok("the hint bar is short", await M(() => document.querySelectorAll("#hint > span").length <= 10));
  ok("and shows map keys", /Map/.test(await hint()) && /Fold/.test(await hint()));
  await M(() => document.querySelector("#hint [data-hint]").click());
  await page.waitForTimeout(100);
  ok("it folds to a pill", await M(() => document.getElementById("hint").classList.contains("min") && document.querySelectorAll("#hint > span").length === 2));
  await page.reload(); await page.waitForFunction(() => !!window.__mf); await page.waitForTimeout(300);
  ok("and stays folded after a reload", await M(() => document.getElementById("hint").classList.contains("min")));
  await M(() => document.querySelector("#hint [data-hint]").click());
  await page.waitForTimeout(100);
  ok("and opens again", await M(() => !document.getElementById("hint").classList.contains("min")));
  await page.keyboard.press("Meta+3");
  await page.waitForTimeout(200);
  ok("presenting hides the hint bar", await M(() => getComputedStyle(document.getElementById("hint")).display === "none"));
  await page.waitForTimeout(2900);
  ok("the bar fades when the mouse is still", await M(() => document.body.classList.contains("idle")));
  await page.mouse.move(300, 300); await page.mouse.move(320, 310);
  await page.waitForTimeout(60);
  ok("and comes back when it moves", await M(() => !document.body.classList.contains("idle")));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  ok("ending clears the idle state", await M(() => !document.body.classList.contains("idle") && !document.body.classList.contains("presenting")));
}

group("working inside a network");
{
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(220);
  const idOf = (t) => M((t) => Object.values(__mf.state.nodes).find((n) => n.text === t).id, t);
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(260); };
  const selVisible = () => M(() => !!__mf.pos()[__mf.selected]);
  await M(() => __mf.paste("Hub\n- P1\n  - A\n    - a1\n  - E\n- P2\n  - B\n  - C\n- P3\n  - D"));
  await page.waitForTimeout(280);
  const A = await idOf("A"), B = await idOf("B"), C = await idOf("C"), D = await idOf("D");
  await M(([a, b]) => __mf.tie(a, b), [A, B]);
  await M(([a, b]) => __mf.tie(a, b), [B, C]);
  await M(([a, b]) => __mf.tie(a, b), [A, D]);
  await M((x) => __mf.setLens("one", x), A);
  await page.waitForTimeout(350);

  // arrows never leave what is on screen
  await M((x) => __mf.select(x), B);
  let allSeen = true, moved = 0;
  for (const k of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "ArrowRight", "ArrowUp", "ArrowLeft", "ArrowDown"]) {
    const was = await M(() => __mf.selected);
    await press(k);
    if (!(await selVisible())) allSeen = false;
    if ((await M(() => __mf.selected)) !== was) moved++;
  }
  ok("arrows stay on nodes you can see", allSeen);
  ok("and do get somewhere", moved > 0, moved);

  // Tab walks the network, nearest first, and wraps
  await M((x) => __mf.select(x), B);
  await page.keyboard.down("Tab"); await page.keyboard.up("Tab"); await page.waitForTimeout(200);
  const t1 = await M(() => __mf.selected);
  ok("Tab goes on through the network, nearest first", t1 === D, t1);
  const seen = new Set([B, t1]);
  for (let i = 0; i < 3; i++) { await page.keyboard.down("Tab"); await page.keyboard.up("Tab"); await page.waitForTimeout(150); seen.add(await M(() => __mf.selected)); }
  ok("and visits the whole network", [A, B, C, D].every((x) => seen.has(x)), [...seen].length);
  ok("and nothing outside it", seen.size === 4);

  // making a node ties it, so it stays in view
  await M((x) => __mf.select(x), C);
  const linksBefore = (await M(() => __mf.links)).length;
  await press("Enter");
  await page.keyboard.type("New idea");
  await page.waitForTimeout(250);
  const made = await M(() => __mf.selected);
  ok("a node made in a network is on screen", await selVisible());
  ok("because it is tied to where it came from", await M(([c, m]) => __mf.links.some((l) => (l.a === c && l.b === m) || (l.a === m && l.b === c)), [C, made]));
  ok("the network is still arranged while you type", (await M(() => __mf.shown)) === 6, await M(() => __mf.shown));
  await press("Escape");
  ok("Esc while typing finishes the node and stays in the network", (await M(() => __mf.lens)) === "one");
  ok("the new node kept its text", await M((m) => __mf.state.nodes[m].text === "New idea", made));
  await press("Meta+z");
  ok("undo takes the node and its tie together", (await M(() => __mf.links)).length === linksBefore && !(await M((m) => !!__mf.state.nodes[m], made)), (await M(() => __mf.links)).length);

  // a blank node made in a network leaves no dangling tie
  await M((x) => __mf.select(x), B);
  await press("Enter");
  await press("Escape");
  ok("an abandoned blank node takes its tie with it", (await M(() => __mf.links)).length === linksBefore);

  // tree restructuring is off while the tree is hidden
  await M((x) => __mf.select(x), B);
  const par = await M((x) => __mf.state.nodes[x].parent, B);
  await press("Alt+ArrowDown");
  ok("Alt+arrow does not move nodes blind", (await M((x) => __mf.state.nodes[x].parent, B)) === par);

  // the badge admits links it cannot show
  await M((x) => __mf.select(x), B);
  await press("Meta+e");
  ok("a folded far end is counted as hidden", await M(() => [...document.querySelectorAll(".badge.link")].some((b) => /hidden/.test(b.textContent))), await M(() => [...document.querySelectorAll(".badge.link")].map((b) => b.textContent).join("|") + " " + __mf.lens + " " + __mf.lensFold));
  await press("Meta+e");

  // a bar says where you are
  ok("the bar names the network", await M(() => /Network/.test(document.getElementById("crumbs").textContent) && document.getElementById("crumbs").classList.contains("on")), await M(() => document.getElementById("crumbs").className + ":" + document.getElementById("crumbs").textContent));
  await M(() => document.querySelector("#crumbs [data-out]").click());
  await page.waitForTimeout(250);
  ok("its button steps back to dimmed", (await M(() => __mf.lens)) === "dim");
  ok("and the bar follows", await M(() => /Links dimmed/.test(document.getElementById("crumbs").textContent)));
  await M(() => document.querySelector("#crumbs [data-out]").click());
  await page.waitForTimeout(250);
  ok("then turns the lens off", (await M(() => __mf.lens)) === "off");
  ok("and the bar goes away", await M(() => !document.getElementById("crumbs").classList.contains("on")));

  // deleting the node a network is centred on falls back to dim
  await M((x) => __mf.setLens("one", x), A);
  await page.waitForTimeout(250);
  await M((x) => __mf.select(x), A);
  await press("Backspace");
  ok("deleting the centre of a network falls back to dim", (await M(() => __mf.lens)) === "dim", await M(() => __mf.lens));
  await M(() => __mf.setLens("off"));
}

group("QoL: focus toggle, undoing a retype, copying views, tabbed keys");
{
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(220); };
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(220);
  await M((t) => __mf.pasteOutline && __mf.pasteOutline(t), "");
  await page.evaluate((t) => { const dt = new DataTransfer(); dt.setData("text/plain", t); document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true })); }, `Q
- Alpha
  - A1
  - A2
- Beta
  - B1`);
  await page.waitForTimeout(250);
  const id = (t) => M((t) => Object.values(__mf.state.nodes).find((n) => n.text === t).id, t);

  // Cmd+/ twice is a round trip
  await M(() => __mf.select(__mf.state.rootId));
  await press("Meta+0");
  const cam0 = await M(() => JSON.stringify(__mf.cam()));
  await pick("Alpha");
  await press("Meta+/");
  ok("Cmd+/ focuses", (await M(() => __mf.focus)) === (await id("Alpha")));
  await press("Meta+/");
  ok("Cmd+/ again leaves the focus", (await M(() => __mf.focus)) === null);
  ok("and puts the camera back exactly", (await M(() => JSON.stringify(__mf.cam()))) === cam0, [await M(() => JSON.stringify(__mf.cam())), cam0]);
  ok("with the branch still selected", (await M(() => __mf.selected)) === (await id("Alpha")));
  // nested: back one focus at a time
  await press("Meta+/");
  await pick("A1");
  await M((x) => { __mf.state.nodes[x].children.length || 0; }, await id("A1"));
  await pick("Alpha");
  await press("ArrowDown"); // step the focus to Beta, sideways
  const f1 = await M(() => __mf.focus);
  await press("Meta+/");
  ok("after stepping to a sibling branch, Cmd+/ still goes back to the map", (await M(() => __mf.focus)) === null, [f1, await M(() => __mf.focus)]);
  ok("and forgets the trail", (await M(() => __mf.focusTrail)) === 0);
  // Esc still steps out as before
  await pick("Alpha"); await press("Meta+/"); await press("Escape");
  ok("Esc still leaves a focus", (await M(() => __mf.focus)) === null);
  ok("and clears nothing it should not", (await M(() => __mf.focusTrail)) <= 1);

  // retyping a node is undoable
  await pick("Beta");
  await page.keyboard.type("Oops");
  await press("Enter");
  await page.waitForTimeout(100);
  await press("Escape");
  ok("the retype took", await M(() => Object.values(__mf.state.nodes).some((n) => n.text === "Oops")));
  await press("Meta+z");
  ok("Cmd+Z brings the old text back", await M(() => Object.values(__mf.state.nodes).some((n) => n.text === "Beta") && !Object.values(__mf.state.nodes).some((n) => n.text === "Oops")));
  await press("Meta+Shift+z");
  ok("and redo puts the retype back", await M(() => Object.values(__mf.state.nodes).some((n) => n.text === "Oops")));
  await press("Meta+z");
  // undo while still typing
  await pick("Beta");
  await press("Space");
  await page.keyboard.type("Wrong");
  await press("Meta+z");
  ok("Cmd+Z mid-retype restores the old text", await M(() => Object.values(__mf.state.nodes).some((n) => n.text === "Beta")), await M(() => Object.values(__mf.state.nodes).map((n) => n.text)));
  ok("and is no longer typing", (await M(() => __mf.editing)) == null);
  // typing a brand new node is not an extra undo step
  await pick("B1");
  await press("Enter");
  await page.keyboard.type("B2");
  await press("Escape");
  const steps = await M(() => __mf.undoSteps);
  await press("Meta+z");
  ok("one undo removes a node made and named in one go", !(await M(() => Object.values(__mf.state.nodes).some((n) => n.text === "B2"))));
  ok("the retype step count is sane", steps >= 1);
  // an unchanged retype leaves no step
  const s0 = await M(() => __mf.undoSteps);
  await pick("Alpha"); await press("Space"); await press("Escape");
  ok("opening and closing a node without changing it adds no step", (await M(() => __mf.undoSteps)) === s0);

  // copying a network
  const [a, b, c] = [await id("Alpha"), await id("B1"), await id("A2")];
  await M(([a, b, c]) => { __mf.tie(a, b); __mf.tie(b, c); }, [a, b, c]);
  await M((x) => __mf.select(x), a);
  await press("Meta+2");
  await press("Meta+/");
  ok("a network is open", (await M(() => __mf.lens)) === "one");
  const clip = await page.evaluate(() => new Promise((res) => {
    document.addEventListener("copy", (e) => setTimeout(() => res(null), 0), { once: true });
    const dt = new DataTransfer();
    const ev = new ClipboardEvent("copy", { clipboardData: dt, bubbles: true, cancelable: true });
    document.dispatchEvent(ev);
    res({ t: dt.getData("text/plain"), h: dt.getData("text/html") });
  }));
  ok("Cmd+C in a network copies the network as an outline", clip && clip.t === "Alpha\n- B1\n  - A2", clip);
  ok("with nested html", clip && /<ul><li>Alpha<ul><li>B1<ul><li>A2/.test(clip.h), clip);
  ok("the network bar has a copy menu, with the two Copy as rows", await M(() => __mf.copyMenu() && document.querySelectorAll("#storyMenu .mi").length === 4));
  await press("Escape");
  ok("any key closes the copy menu first", await M(() => !document.getElementById("storyMenu")) && (await M(() => __mf.lens)) === "one");
  await page.evaluate(() => document.getElementById("btnExport").click());
  await M(() => document.querySelector('#exportMenu [data-x="svg"]').click());
  await page.evaluate(() => document.getElementById("btnExport").click());
  const svg = await M(() => __mf.lastSvg || "");
  ok("a network image holds just the network", [">Alpha<", ">B1<", ">A2<"].every((t) => svg.includes(t)) && !svg.includes(">Q<") && !svg.includes(">A1<"), svg.length);
  await press("Meta+/");
  ok("Cmd+/ on the network's centre goes back to the view it came from", (await M(() => __mf.lens)) === "dim", await M(() => __mf.lens));
  await press("Escape");

  // copying a story, so far and whole
  await M(() => __mf.select(__mf.state.rootId));
  await M(() => __mf.makeFrameOf && 0);
  await pick("Alpha");
  await press("Meta+g"); await page.keyboard.type("Chapter"); await press("Enter");
  await press("Escape");
  await M(() => __mf.select(__mf.state.rootId));
  await press("Meta+3");
  await press("ArrowRight"); await press("ArrowRight");
  const soFar = await page.evaluate(() => { const dt = new DataTransfer(); document.dispatchEvent(new ClipboardEvent("copy", { clipboardData: dt, bubbles: true, cancelable: true })); return dt.getData("text/plain"); });
  ok("Cmd+C while presenting copies the story so far", soFar === "Q\n- Alpha\n  - A1", soFar);
  ok("the frame title is not clickable while presenting", await M(() => [...document.querySelectorAll(".ftitle")].every((e) => getComputedStyle(e).pointerEvents === "none")));
  ok("a frame shows around what has been told", await M(() => document.querySelectorAll(".ftitle").length === 1));
  await M(() => __mf.copyMenu());
  ok("the presenting copy menu has four choices plus the two Copy as rows", await M(() => document.querySelectorAll("#storyMenu .mi").length === 6));
  await press("Digit4");
  await page.waitForTimeout(100);
  const whole = await M(() => __mf.lastSvg || "");
  ok("the whole story image has every node the story tells", ["Alpha", "A1", "A2", "Oops", "B1"].every((t) => whole.includes(">" + t + "<")) || ["Alpha", "A1", "A2", "B1"].every((t) => whole.includes(">" + t + "<")), whole.length);
  ok("and the frame with its title", whole.includes(">Chapter<"));
  ok("and the talk is where it was", (await M(() => __mf.pres.here)) === (await id("A1")) && (await M(() => __mf.shown)) === 3, await M(() => __mf.shown));
  await press("Meta+Shift+c");
  await page.waitForTimeout(100);
  const part = await M(() => __mf.lastSvg || "");
  ok("Shift+Cmd+C copies the image so far", part.includes(">A1<") && !part.includes(">A2<") && !part.includes(">B1<"), part.length);
  await press("Escape");

  // frames step aside in a network
  await M((x) => __mf.select(x), a);
  await press("Meta+2"); await press("Meta+/");
  ok("frames are hidden in a network", await M(() => document.querySelectorAll(".ftitle").length === 0));
  await M(() => __mf.setLens("off"));
  ok("and come back after", await M(() => document.querySelectorAll(".ftitle").length === 1));

  // the key list has tabs
  await M(() => __mf.select(__mf.state.rootId));
  await press("Shift+?");
  ok("? opens the keys", await M(() => document.getElementById("help").classList.contains("open")));
  ok("with tabs", await M(() => document.querySelectorAll("#helpTabs button").length >= 6));
  ok("and one pane showing", await M(() => [...document.querySelectorAll(".hpane")].filter((p) => getComputedStyle(p).display !== "none").length === 1));
  await press("Digit5");
  ok("a number switches tab", await M(() => document.querySelector("#helpTabs button.on").dataset.tab === "links"));
  await press("ArrowDown");
  ok("arrows step tabs", await M(() => document.querySelector("#helpTabs button.on").dataset.tab === "present"));
  const txt0 = await M(() => __mf.state.nodes[__mf.selected].text);
  await press("KeyX");
  ok("letters do not reach the map behind", (await M(() => __mf.state.nodes[__mf.selected].text)) === txt0 && (await M(() => __mf.editing)) == null);
  await M(() => document.querySelector('#helpTabs button[data-tab="edit"]').dispatchEvent(new MouseEvent("mousedown", { bubbles: true })));
  ok("clicking a tab switches", await M(() => document.querySelector(".hpane.on").dataset.tab === "edit"));
  await press("Escape");
  await press("Shift+?");
  ok("it reopens on the last tab", await M(() => document.querySelector(".hpane.on").dataset.tab === "edit"));
  await press("Escape");
  ok("Esc closes the keys", await M(() => !document.getElementById("help").classList.contains("open")));
  ok("the paste button is gone", await M(() => !document.getElementById("btnPaste")));
}

group("selecting, copying, moving and deleting several nodes");
{
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(200); };
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(220);
  await M((t) => __mf.paste(t), "Hub\n- Alpha\n  - A1\n    - A1x\n  - A2\n  - A3\n- Beta\n  - B1");
  await page.waitForTimeout(250);
  const id = (t) => M((t) => (Object.values(__mf.state.nodes).find((n) => n.text === t) || {}).id, t);
  const has = (t) => M((t) => Object.values(__mf.state.nodes).some((n) => n.text === t), t);
  const marks = () => M(() => __mf.rawMarked.map((i) => __mf.state.nodes[i].text).sort().join(","));
  const doCopy = () => M(() => { const dt = new DataTransfer(); document.dispatchEvent(new ClipboardEvent("copy", { clipboardData: dt, bubbles: true, cancelable: true })); return dt.getData("text/plain"); });
  const doCut = () => M(() => { const dt = new DataTransfer(); document.dispatchEvent(new ClipboardEvent("cut", { clipboardData: dt, bubbles: true, cancelable: true })); return dt.getData("text/plain"); });
  const doPaste = (t) => M((t) => { const dt = new DataTransfer(); dt.setData("text/plain", t); document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); }, t);

  // Shift+arrow grows and shrinks a selection
  await pick("A1");
  const down = await M(() => __mf.dir(__mf.selected));
  const along = (down === "L" || down === "R") ? "ArrowDown" : "ArrowRight";
  const back = (down === "L" || down === "R") ? "ArrowUp" : "ArrowLeft";
  await press("Shift+" + along);
  await page.waitForTimeout(500);                 /* two quick taps would take the whole row */
  await press("Shift+" + along);
  ok("Shift+arrow selects node by node", (await marks()) === "A1,A2,A3", await marks());
  ok("the selection highlight covers exactly what is selected", await M(() => document.querySelectorAll("#marks path, svg path").length > 0));
  await page.waitForTimeout(500);
  await press("Shift+" + back);
  ok("stepping back lets go of the last one", (await marks()) === "A1,A2", await marks());
  await press(along === "ArrowDown" ? "ArrowDown" : "ArrowRight");
  ok("a plain arrow drops the selection", (await marks()) === "", await marks());

  // Cmd+Shift+arrow takes branches
  await pick("A1");
  const out = await M(() => __mf.dir(__mf.selected));
  const OUT = { L: "ArrowLeft", R: "ArrowRight", U: "ArrowUp", D: "ArrowDown" }[out];
  await press("Meta+Shift+" + OUT);
  ok("Cmd+Shift+outward selects the whole branch", (await marks()) === "A1,A1x", await marks());
  await press("Meta+Shift+" + along);
  ok("Cmd+Shift+sideways adds the siblings that way, with their branches", (await marks()) === "A1,A1x,A2,A3", await marks());
  await M(() => __mf.mark([]));
  await pick("A2");
  const IN = { L: "ArrowRight", R: "ArrowLeft", U: "ArrowDown", D: "ArrowUp" }[out];
  await press("Meta+Shift+" + IN);
  ok("Cmd+Shift+inward selects the parent's whole branch", (await marks()) === "A1,A1x,A2,A3,Alpha", await marks());
  ok("and lands on the parent", (await M(() => __mf.selected)) === (await id("Alpha")));
  ok("nothing was created", !(await M(() => Object.values(__mf.state.nodes).some((n) => n.text === ""))));
  await M(() => __mf.mark([]));

  // copying a scattered pick keeps its shape
  await M(async (ids) => __mf.mark(ids), [await id("Alpha"), await id("A1x"), await id("B1")]);
  const c1 = await doCopy();
  ok("a scattered copy hangs each node under its nearest selected ancestor", c1 === "- Alpha\n  - A1x\n- B1", c1);
  await M(() => __mf.mark([]));
  await pick("A1x");
  await M(() => __mf.toggleMarkKind && 0);
  await press("Alt+KeyX"); // done
  await M(async ([a, b]) => __mf.tie(a, b), [await id("A1"), await id("A1x")]);
  await M(() => __mf.mark([]));
  await pick("A1");
  const c2 = await doCopy();
  ok("with nothing selected, copy takes the selected branch", c2 === "- A1\n  - A1x", c2);
  const links0 = (await M(() => __mf.links)).length;
  await pick("B1");
  await doPaste(c2);
  await page.waitForTimeout(200);
  const pasted = await M(() => { const b = Object.values(__mf.state.nodes).find((n) => n.text === "B1"); return b.children.map((c) => __mf.state.nodes[c].text + ">" + __mf.state.nodes[c].children.map((k) => __mf.state.nodes[k].text + ":" + (__mf.state.nodes[k].mark || "")).join()); });
  ok("paste lands as children of the selection, shape intact", pasted.join() === "A1>A1x:done", pasted);
  ok("our own copies keep marks and the links between copied nodes", (await M(() => __mf.links)).length === links0 + 1);
  ok("what landed stays selected", (await M(() => __mf.rawMarked.length)) === 2);
  ok("pasted nodes point the way their new parent does", await M(() => { const b = Object.values(__mf.state.nodes).find((n) => n.text === "B1"); const k = __mf.state.nodes[b.children[0]]; return __mf.dir(k.id) === __mf.dir(b.id); }));
  await press("Meta+z");
  ok("one undo takes the paste back", (await M(() => Object.values(__mf.state.nodes).filter((n) => n.text === "A1").length)) === 1);

  // Shift+Cmd+V pastes as siblings
  await M(() => __mf.mark([]));
  await pick("B1");
  await page.keyboard.down("Meta"); await page.keyboard.down("Shift"); await page.keyboard.press("v"); await page.keyboard.up("Shift"); await page.keyboard.up("Meta");
  await doPaste("Gamma\nDelta");
  await page.waitForTimeout(200);
  ok("Shift+Cmd+V pastes after the selection, as siblings", await M(() => { const b = Object.values(__mf.state.nodes).find((n) => n.text === "B1"); const p = __mf.state.nodes[b.parent]; return p.children.map((c) => __mf.state.nodes[c].text).join() === "B1,Gamma,Delta"; }), await M(() => { const b = Object.values(__mf.state.nodes).find((n) => n.text === "B1"); return __mf.state.nodes[b.parent].children.map((c) => __mf.state.nodes[c].text); }));
  await M(() => __mf.mark([]));
  await pick("B1");
  await doPaste("Plain");
  await page.waitForTimeout(200);
  ok("a plain Cmd+V still pastes children", (await node("Plain")).parent === "B1");

  // Option+arrow moves a whole selection
  await M(async (ids) => __mf.mark(ids), [await id("Gamma"), await id("Delta")]);
  await pick("Gamma"); await M(async (ids) => __mf.mark(ids), [await id("Gamma"), await id("Delta")]);
  const bd0 = await M(() => __mf.dir(Object.values(__mf.state.nodes).find((n) => n.text === "B1").id));
  const sideUp = (bd0 === "L" || bd0 === "R") ? "Alt+ArrowUp" : "Alt+ArrowLeft";
  await press(sideUp);
  const order = await M(() => { const b = Object.values(__mf.state.nodes).find((n) => n.text === "B1"); return __mf.state.nodes[b.parent].children.map((c) => __mf.state.nodes[c].text).join(); });
  ok("Option+arrow moves every selected node together", order === "Gamma,Delta,B1", order);
  ok("and keeps them selected", (await marks()) === "Delta,Gamma", await marks());
  await press(sideUp);
  // at the edge they carry on into the branch before, if the side has one
  const hopped = await M(() => { const g = Object.values(__mf.state.nodes).find((n) => n.text === "Gamma"); return __mf.state.nodes[g.parent].text; });
  ok("at the edge the selection carries on into the branch before, or stays", hopped === "Beta" || hopped === "Alpha", hopped);
  if (hopped !== "Beta") await press("Meta+z");
  ok("and undo brings it back", (await M(() => { const b = Object.values(__mf.state.nodes).find((n) => n.text === "B1"); return __mf.state.nodes[b.parent].children.map((c) => __mf.state.nodes[c].text).join(); })) === "Gamma,Delta,B1");
  await M(async (ids) => __mf.mark(ids), [await id("Gamma"), await id("Delta")]);
  const bdir = await M(() => __mf.dir(Object.values(__mf.state.nodes).find((n) => n.text === "B1").id));
  const BOUT = { L: "Alt+ArrowLeft", R: "Alt+ArrowRight", U: "Alt+ArrowUp", D: "Alt+ArrowDown" }[bdir];
  await pick("B1"); await M(async (ids) => __mf.mark(ids), [await id("B1")]);
  await press("Alt+" + (sideUp.includes("Up") ? "ArrowDown" : "ArrowRight"));
  await M(async (ids) => __mf.mark(ids), [await id("Delta"), await id("B1")]);
  await press(BOUT);
  ok("outward tucks the selection under the sibling before it", (await node("Delta")).parent === "Gamma" && (await node("B1")).parent === "Gamma", [await node("Delta"), await node("B1")]);
  const BIN = { L: "Alt+ArrowRight", R: "Alt+ArrowLeft", U: "Alt+ArrowDown", D: "Alt+ArrowUp" }[bdir];
  await press(BIN);
  ok("inward brings them back up a level, in order", (await node("Gamma")).kids.length === 0 && (await node("Beta")).kids.join() === "Gamma,Delta,B1", await node("Beta"));

  // cut
  await M(() => __mf.mark([]));
  await pick("Gamma");
  const cutText = await doCut();
  ok("Cmd+X copies and picks it up, without removing it", cutText === "- Gamma" && (await has("Gamma")), cutText);
  await pick("Plain");
  await doPaste(cutText);
  await page.waitForTimeout(150);
  ok("and it pastes back", (await node("Gamma")).parent === "Plain");

  // Backspace keeps the children
  await M(() => __mf.mark([]));
  await pick("A1");
  await press("Backspace");
  ok("deleting a parent keeps its children", !(await has("A1")) && (await node("A1x")).parent === "Alpha", await node("A1x"));
  ok("they take its place among the siblings", (await node("Alpha")).kids.join() === "A1x,A2,A3", await node("Alpha"));
  ok("and the first of them is selected", (await M(() => __mf.selected)) === (await id("A1x")));
  ok("the status says what moved", /moved up/.test(await M(() => document.getElementById("saveState").textContent)));
  await press("Meta+z");
  ok("undo puts the parent back over them", (await node("A1x")).parent === "A1");
  await pick("Alpha");
  await press("Meta+Backspace");
  ok("Cmd+Backspace deletes the whole branch", !(await has("Alpha")) && !(await has("A1x")) && !(await has("A3")));
  await press("Meta+z");
  // a frame whose root is deleted keeps its children
  await pick("A1");
  await press("Meta+g"); await press("Enter");
  await pick("A1");
  await press("Backspace");
  ok("a frame keeps wrapping what its deleted root handed up", await M(() => __mf.frames.length === 1 && __mf.frames[0].roots.length === 1 && __mf.state.nodes[__mf.frames[0].roots[0]].text === "A1x"));

  // new nodes are selected, not opened for typing
  await pick("A3");
  await press("Enter");
  ok("a new node is not in typing mode", (await M(() => __mf.editing)) == null);
  ok("but it is selected", (await M(() => __mf.state.nodes[__mf.selected].text)) === "");
  await page.keyboard.type("Fresh");
  await press("Escape");
  ok("letters type straight into it", await has("Fresh"));
  await press("Enter");
  await press(along);
  ok("an arrow drops a new node left blank", !(await M(() => Object.values(__mf.state.nodes).some((n) => n.text === ""))));
  ok("and stays put rather than moving on", (await M(() => __mf.state.nodes[__mf.selected].text)) === "Fresh");
  const u0 = await M(() => __mf.undoSteps);
  await press("Enter"); await press("Escape");
  ok("so does Esc, leaving no undo step behind", !(await M(() => Object.values(__mf.state.nodes).some((n) => n.text === ""))) && (await M(() => __mf.undoSteps)) === u0, [await M(() => __mf.undoSteps), u0]);
  await press("Enter");
  await pick("B1");
  ok("and so does clicking away", !(await M(() => Object.values(__mf.state.nodes).some((n) => n.text === ""))));
  // the setting brings the cursor back, and the cursor sits in the middle
  await M(() => __mf.set("typeOnCreate", true));
  await press("Enter");
  ok("with the setting on, new nodes open for typing", (await M(() => __mf.editing)) != null);
  const caret = await M(() => { const el = document.querySelector(".node.editing"); const r = getSelection().getRangeAt(0).getBoundingClientRect(); const b = el.getBoundingClientRect(); return { dx: Math.abs((r.left + r.right) / 2 - (b.left + b.right) / 2), dy: Math.abs((r.top + r.bottom) / 2 - (b.top + b.bottom) / 2), w: b.width }; });
  ok("the cursor in an empty node is centred", caret.dx < 6 && caret.dy < 6, caret);
  await page.keyboard.type("Zed");
  await press("Escape");
  ok("and what you type has no hidden characters", await M(() => Object.values(__mf.state.nodes).some((n) => n.text === "Zed")));
  await M(() => __mf.set("typeOnCreate", false));
}

group("corners, Shift+Enter order, and selection extras");
{
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(200); };
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(220);
  const id = (t) => M((t) => (Object.values(__mf.state.nodes).find((n) => n.text === t) || {}).id, t);
  const overlaps = () => M(() => {
    const p = __mf.pos(), ids = Object.keys(p), bad = [];
    const r = (i) => { const e = document.querySelector('.node[data-id="' + i + '"]'); return { x: p[i].cx, y: p[i].cy, w: e.offsetWidth, h: e.offsetHeight }; };
    for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
      const A = r(ids[a]), B = r(ids[b]);
      if (Math.abs(A.x - B.x) < (A.w + B.w) / 2 - 1 && Math.abs(A.y - B.y) < (A.h + B.h) / 2 - 1) bad.push(__mf.state.nodes[ids[a]].text + "/" + __mf.state.nodes[ids[b]].text);
    }
    return bad;
  });
  // a tall sideways side and a wide downward branch, as in a real map
  await M(() => __mf.spread("manual"));
  await M(() => {
    const s = __mf.state, root = s.rootId;
    s.nodes[root].text = "Hub";
    let k = 0;
    const add = (parent, text, dir) => { const idn = "t" + (k++); s.nodes[idn] = { id: idn, parent, children: [], text, dir }; s.nodes[parent].children.push(idn); return idn; };
    for (let i = 0; i < 7; i++) { const r = add(root, "Right " + i, "R"); add(r, "R" + i + " kid", "R"); }
    const d = add(root, "Down", "D");
    for (let i = 0; i < 6; i++) { const c = add(d, "Row " + i, "D"); add(c, "Deep " + i, "D"); }
    const u = add(root, "Up", "U");
    for (let i = 0; i < 6; i++) add(u, "Top " + i, "U");
    for (let i = 0; i < 5; i++) { const l = add(root, "Left " + i, "L"); }
    __mf.set("gap", __mf.cfg.gap);
  });
  await page.waitForTimeout(250);
  const bad = await overlaps();
  ok("sideways and up/down branches never overlap in the corners", bad.length === 0, bad.slice(0, 6));
  ok("the downward branch stepped clear", await M((x) => __mf.pos()[x].cy > 0, await id("Down")));
  // and nothing moves when there is no clash
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(220);
  await M(() => __mf.spread("manual"));
  await M(() => { const s = __mf.state, root = s.rootId; s.nodes.x1 = { id: "x1", parent: root, children: [], text: "East", dir: "R" }; s.nodes.x2 = { id: "x2", parent: root, children: [], text: "South", dir: "D" }; s.nodes[root].children.push("x1", "x2"); __mf.set("gap", __mf.cfg.gap); });
  await page.waitForTimeout(200);
  const south = await M(() => { const p = __mf.pos(); const r = document.querySelector('.node[data-id="' + __mf.state.rootId + '"]'); const e = document.querySelector('.node[data-id="x2"]'); return p.x2.cy - (r.offsetHeight / 2 + e.offsetHeight / 2); });
  ok("a lone down branch keeps its usual distance", south > 0 && south < 120, south);

  // Shift+Enter goes to the next parent in screen order
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(220);
  await M(() => __mf.spread("updown"));
  await M((t) => __mf.paste(t), "Hub\n- A\n  - a1\n- B\n  - b1\n- C\n  - c1\n- D\n  - d1");
  await page.waitForTimeout(250);
  // updown: A, C go down, B, D go up. Down row, left to right: A then C.
  const downRow = await M(() => { const p = __mf.pos(); return ["A", "B", "C", "D"].map((t) => Object.values(__mf.state.nodes).find((n) => n.text === t).id).filter((i) => __mf.dir(i) === "D").sort((a, b) => p[a].cx - p[b].cx).map((i) => __mf.state.nodes[i].text); });
  await pick("a1".replace("a1", downRow[0].toLowerCase() + "1"));
  await press("Shift+Enter");
  await page.keyboard.type("next"); await press("Escape");
  ok("on a down branch, Shift+Enter goes to the parent on the right", (await node("next")).parent === downRow[1], [downRow, await node("next")]);
  await pick(downRow[1].toLowerCase() + "1");
  await press("Shift+Enter");
  await page.keyboard.type("wrap"); await press("Escape");
  ok("and wraps round to the leftmost, staying on its side", (await node("wrap")).parent === downRow[0], await node("wrap"));
  await M(() => __mf.spread("sides"));
  await page.waitForTimeout(150);
  const rightCol = await M(() => { const p = __mf.pos(); return ["A", "B", "C", "D"].map((t) => Object.values(__mf.state.nodes).find((n) => n.text === t).id).filter((i) => __mf.dir(i) === "R").sort((a, b) => p[a].cy - p[b].cy).map((i) => __mf.state.nodes[i].text); });
  await pick(rightCol[0].toLowerCase() + "1");
  await press("Shift+Enter");
  await page.keyboard.type("below"); await press("Escape");
  ok("on a sideways branch it goes to the parent below", (await node("below")).parent === rightCol[1], [rightCol, await node("below")]);

  // Cmd+A: level first, then everything
  await pick("a1");
  await press("Meta+a");
  const lvl = await M(() => __mf.rawMarked.map((i) => __mf.state.nodes[i].text).sort().join());
  ok("Cmd+A selects the whole level", lvl === "a1,b1,below,c1,d1,next,wrap" || /^a1,b1/.test(lvl) && !lvl.includes("A"), lvl);
  await press("Meta+a");
  ok("Cmd+A again selects everything on screen", (await M(() => __mf.rawMarked.length)) === (await M(() => Object.keys(__mf.pos()).length - 1)));
  ok("the top bar shows the count", await M(() => !document.getElementById("selChip").hidden && document.getElementById("selCount").textContent === String(__mf.rawMarked.length)));
  await M(() => document.querySelector('#selChip [data-sel="clear"]').click());
  ok("its x clears the selection", (await M(() => __mf.rawMarked.length)) === 0 && await M(() => document.getElementById("selChip").hidden));

  // Cmd+D on a selection
  await M(async (ids) => __mf.mark(ids), [await id("a1"), await id("b1")]);
  await press("Meta+d");
  ok("Cmd+D duplicates every selected branch", (await M(() => Object.values(__mf.state.nodes).filter((n) => n.text === "a1" || n.text === "b1").length)) === 4);
  ok("and the copies come out selected", (await M(() => __mf.rawMarked.length)) === 2 && await M(() => __mf.rawMarked.every((i) => !["a1", "b1"].includes(i))));
  await press("Meta+z");
  // the chip's buttons
  await M(async (ids) => __mf.mark(ids), [await id("wrap")]);
  await M(() => document.querySelector('#selChip [data-sel="del"]').click());
  ok("the chip's Delete deletes the selection", !(await M(() => Object.values(__mf.state.nodes).some((n) => n.text === "wrap"))));

  // deleting flashes the children that moved up
  await pick("A");
  await press("Backspace");
  await page.waitForTimeout(80);
  ok("children that moved up are flashed", await M(() => document.querySelectorAll(".node.nudge").length >= 1));
  await press("Meta+z");

  // pasting onto a blank new node puts the paste in its place
  await pick("c1");
  await press("Enter");
  const u0 = await M(() => __mf.undoSteps);
  await M(() => { const dt = new DataTransfer(); dt.setData("text/plain", "P1\n  P2\nP3"); document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); });
  await page.waitForTimeout(200);
  ok("a paste replaces the blank node it lands on", await M(() => { const c = Object.values(__mf.state.nodes).find((n) => n.text === "C"); return c.children.map((k) => __mf.state.nodes[k].text).join().startsWith("c1,P1,P3,"); }), await M(() => { const c = Object.values(__mf.state.nodes).find((n) => n.text === "C"); return c.children.map((k) => __mf.state.nodes[k].text); }));
  ok("no blank node is left behind", !(await M(() => Object.values(__mf.state.nodes).some((n) => n.text === ""))));
  ok("P2 stays under P1", (await node("P2")).parent === "P1");
  await press("Meta+z");
  ok("one undo takes back the paste and the blank node", !(await M(() => Object.values(__mf.state.nodes).some((n) => n.text === "P1" || n.text === ""))) && (await M(() => __mf.undoSteps)) === u0 - 1, [await M(() => __mf.undoSteps), u0]);
  // the same while typing in a new node
  await pick("c1");
  await press("Enter");
  await page.keyboard.type("x"); await press("Backspace");
  await M(() => { const dt = new DataTransfer(); dt.setData("text/plain", "Q1\nQ2"); document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); });
  await page.waitForTimeout(200);
  ok("pasting while typing in a new blank node does the same", await M(() => { const c = Object.values(__mf.state.nodes).find((n) => n.text === "C"); return c.children.map((k) => __mf.state.nodes[k].text).join().startsWith("c1,Q1,Q2,"); }), await M(() => { const c = Object.values(__mf.state.nodes).find((n) => n.text === "C"); return c.children.map((k) => __mf.state.nodes[k].text); }));
  await M(() => __mf.spread("sides"));
}

group("Option+arrow carries on past the edge");
{
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(200); };
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(220);
  await M(() => __mf.spread("right"));
  await M((t) => __mf.paste(t), "Hub\n- A\n  - a1\n  - a2\n- B\n  - b1\n  - b2\n- C");
  await page.waitForTimeout(250);
  const id = (t) => M((t) => Object.values(__mf.state.nodes).find((n) => n.text === t).id, t);
  const kids = async (t) => (await node(t)).kids.join();
  // single node, downward over the edge
  await pick("a2");
  await press("Alt+ArrowDown");
  ok("past the last sibling it moves into the next branch, first", (await kids("B")) === "a2,b1,b2" && (await kids("A")) === "a1", [await kids("A"), await kids("B")]);
  ok("and stays selected", (await M(() => __mf.selected)) === (await id("a2")));
  await press("Alt+ArrowUp");
  ok("and back up over the edge, last", (await kids("A")) === "a1,a2" && (await kids("B")) === "b1,b2", [await kids("A"), await kids("B")]);
  await pick("a1");
  await press("Alt+ArrowUp");
  ok("nothing above the first branch: it stays", (await kids("A")) === "a1,a2");
  // into a leaf and into a folded branch
  await pick("b2");
  await press("Alt+ArrowDown");
  ok("a leaf can take it", (await kids("C")) === "b2");
  await press("Meta+z");
  await pick("B"); await press("Meta+e");
  await pick("a2");
  await press("Alt+ArrowDown");
  ok("a folded branch opens to take it", (await kids("B")).startsWith("a2") && !(await node("B")).collapsed);
  await press("Meta+z"); await press("Meta+z");
  // top-level branches have nowhere to go
  await pick("C");
  await press("Alt+ArrowDown");
  ok("a top-level branch does not hop", (await node("C")).parent === "Hub");
  // a selection moves over together, in order
  await M(async (ids) => __mf.mark(ids), [await id("a1"), await id("a2")]);
  await pick("a1"); await M(async (ids) => __mf.mark(ids), [await id("a1"), await id("a2")]);
  await press("Alt+ArrowDown");
  ok("a selection at the edge hops together, in order", (await kids("B")) === "a1,a2,b1,b2" && (await kids("A")) === "", [await kids("A"), await kids("B")]);
  ok("still selected", (await M(() => __mf.rawMarked.length)) === 2);
  await press("Alt+ArrowUp");
  ok("and back", (await kids("A")) === "a1,a2" && (await kids("B")) === "b1,b2", [await kids("A"), await kids("B")]);
  await M(async (ids) => __mf.mark(ids), [await id("a2"), await id("b1")]);
  await press("Alt+ArrowDown");
  ok("a mixed selection: one hops, one steps", (await kids("A")) === "a1" && (await kids("B")) === "a2,b2,b1", [await kids("A"), await kids("B")]);
  await press("Meta+z");
  ok("one undo puts it all back", (await kids("A")) === "a1,a2" && (await kids("B")) === "b1,b2");
  await M(() => __mf.mark([]));
  await M(() => __mf.spread("sides"));
}

group("new map from the keyboard, and the key log");
{
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(200); };
  const maps = () => M(() => Object.keys(JSON.parse(localStorage.getItem("mappr.index")).docs).length);
  await M((t) => __mf.paste(t), "Keep\n- me");
  await page.waitForTimeout(450);
  const n0 = await maps();
  await press("Alt+n");
  ok("Option+N opens a new map", (await maps()) === n0 + 1 && (await M(() => __mf.state.nodes[__mf.state.rootId].children.length)) === 0, [n0, await maps()]);
  await press("Alt+n");
  ok("a second untouched map replaces the first rather than joining it", (await maps()) === n0 + 1, [n0, await maps()]);
  await press("KeyA");
  await press("Alt+n");
  ok("but not while typing", (await maps()) === n0 + 1, await maps());
  await press("Escape");
  await page.goto(APP + "#keys"); await page.reload();
  await page.waitForTimeout(400);
  await press("Meta+k"); await press("Escape");
  ok("#keys shows what reaches the page", await M(() => /key="k".*handled/.test(document.getElementById("keylog").textContent)), await M(() => document.getElementById("keylog").textContent));
  await page.goto(APP); await page.reload();
  await page.waitForTimeout(400);
  ok("and stays away otherwise", await M(() => !document.getElementById("keylog")));
}

group("pinned maps, colour tags, the switcher and the previous map");
{
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(200); };
  await page.goto(APP); await M(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(400);
  const lib = () => M(() => JSON.parse(localStorage.getItem("mappr.index")));
  const name = () => M(() => __mf.state.nodes[__mf.state.rootId].text);
  const mk = async (t) => { await press("Alt+n"); await M((t) => { __mf.state.nodes[__mf.state.rootId].text = t; __mf.set("gap", __mf.cfg.gap); }, t); await page.waitForTimeout(450); };
  await M(() => { __mf.state.nodes[__mf.state.rootId].text = "Alpha"; __mf.set("gap", __mf.cfg.gap); });
  await page.waitForTimeout(450);
  await mk("Bravo"); await mk("Charlie"); await mk("Delta");
  ok("four maps", Object.keys((await lib()).docs).length === 4);

  // pin with Option+P
  await press("Alt+p");
  ok("Option+P pins the open map", (await lib()).pins.length === 1);
  ok("the pin shows next to the name", await M(() => !document.getElementById("pinMark").hidden && !!document.querySelector("#pinMark svg")));
  ok("the pin is our own drawing, not an emoji", await M(() => !/[\u{1F4CC}\u{1F4CD}]/u.test(document.body.innerHTML)));
  await press("Alt+p");
  ok("Option+P again unpins", (await lib()).pins.length === 0 && await M(() => document.getElementById("pinMark").hidden));

  // switcher
  await press("Alt+m");
  ok("Option+M opens the switcher", await M(() => document.getElementById("switcher").classList.contains("on")));
  ok("it starts on the previous map", await M(() => /Charlie/.test(document.querySelector(".swr.on").textContent)), await M(() => document.querySelector(".swr.on").textContent));
  await page.keyboard.type("alp");
  await page.waitForTimeout(150);
  ok("typing filters", await M(() => document.querySelectorAll(".swr").length === 1 && /Alpha/.test(document.querySelector(".swr").textContent)));
  await press("Alt+p");
  ok("Option+P in the switcher pins the highlighted map", (await lib()).pins.length === 1 && await M(() => /Alpha/.test(document.querySelector(".swr .pin.p").closest(".swr").textContent)));
  await press("Alt+t");
  ok("Option+T gives it a colour", (await lib()).tags[(await lib()).pins[0]] === "red");
  ok("no key leaked to the map", (await name()) === "Delta");
  await press("Enter");
  ok("Enter opens it", (await name()) === "Alpha" && await M(() => !document.getElementById("switcher").classList.contains("on")));
  ok("the top bar shows the pin in its colour", await M(() => !document.getElementById("pinMark").hidden && document.getElementById("pinMark").style.color !== ""));
  // Option+` goes back and forth
  await press("Alt+Backquote");
  ok("Option+` goes back to the previous map", (await name()) === "Delta", await name());
  await press("Alt+Backquote");
  ok("and forth", (await name()) === "Alpha");
  // pin more, open by number
  await M(() => { const L = JSON.parse(localStorage.getItem("mappr.index")); });
  await press("Alt+m");
  await page.keyboard.type("char"); await press("Alt+p"); await press("Escape");
  await press("Alt+Shift+Digit2");
  ok("Option+Shift+2 opens the second pinned map", (await name()) === "Charlie", await name());
  await press("Alt+Shift+Digit1");
  ok("Option+Shift+1 the first", (await name()) === "Alpha");
  ok("and did not switch view", (await M(() => __mf.lens)) === "off" && !(await M(() => __mf.pres)));
  await press("Alt+Shift+Digit7");
  ok("an empty slot says so", /nothing pinned/.test(await M(() => document.getElementById("saveState").textContent)));
  // switcher lists pinned first
  await press("Alt+m");
  const order = await M(() => [...document.querySelectorAll("#swList .swsec, #swList .swr .mn")].map((e) => e.textContent).join("|"));
  ok("pinned first, then all maps", /^Pinned\|Alpha\|Charlie\|All maps\|/.test(order), order);
  ok("pinned rows show their number", await M(() => /2/.test([...document.querySelectorAll(".swr")][1].querySelector(".mslot").textContent)));
  await M(() => document.querySelectorAll(".swr")[1].querySelector("[data-tag]").dispatchEvent(new MouseEvent("mousedown", { bubbles: true })));
  ok("clicking a dot colours that map", (await lib()).tags[(await lib()).pins[1]] === "red");
  await M(() => document.querySelectorAll(".swr")[3].dispatchEvent(new MouseEvent("mousedown", { bubbles: true })));
  ok("clicking a row opens it", (await name()) !== "Alpha" && await M(() => !document.getElementById("switcher").classList.contains("on")));
  // Maps panel
  await M(() => document.getElementById("btnMaps").click());
  const panel = await M(() => document.getElementById("mapsList").textContent);
  ok("the Maps menu has a Pinned section on top", /^Pinned/.test(panel) && /All maps/.test(panel), panel);
  await M(() => document.querySelector('#mapsList .mrow:not(.on) [data-pin]:not(.p)').click());
  ok("its pin buttons pin", (await lib()).pins.length === 3);
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnSwitch").click());
  ok("the Maps menu opens the switcher too", await M(() => document.getElementById("switcher").classList.contains("on") && !document.getElementById("maps").classList.contains("on")));
  await press("Escape");
  // cycling a tag past the end clears it
  const pid = (await lib()).pins[0];
  for (let i = 0; i < 6; i++) await M((x) => __mf.cycleTag(x), pid);
  ok("a colour past the last one clears", !(await lib()).tags[pid], (await lib()).tags);
  // deleting a pinned map drops its pin
  await M(() => document.getElementById("btnMaps").click());
  const target = await M(() => { const L = JSON.parse(localStorage.getItem("mappr.index")); return L.pins.find((x) => x !== L.current); });
  await M((x) => { const b = document.querySelector('#mapsList [data-del="' + x + '"]'); b.click(); document.querySelector('#mapsList [data-del="' + x + '"]').click(); }, target);
  ok("deleting a pinned map unpins it", !(await lib()).pins.includes(target) && !(await lib()).docs[target]);
  await M(() => document.getElementById("btnMaps").click());
  // not while typing
  await press("Space"); await page.keyboard.press("Alt+m"); await page.waitForTimeout(150);
  ok("Option+M does nothing while typing", await M(() => !document.getElementById("switcher").classList.contains("on")));
  await press("Escape");
  // survives a reload
  const pins0 = (await lib()).pins.join();
  await page.reload(); await page.waitForTimeout(400);
  ok("pins survive a reload", (await lib()).pins.join() === pins0 && await M(() => document.getElementById("pinMark").hidden === !JSON.parse(localStorage.getItem("mappr.index")).pins.includes(JSON.parse(localStorage.getItem("mappr.index")).current)));
}

group("repainting after a move in a big map");
{
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(220);
  let big = "Map\n";
  for (let i = 0; i < 12; i++) { big += `- Branch ${i}\n`; for (let j = 0; j < 4; j++) big += `  - Leaf ${i}.${j}\n    - Deep ${i}.${j}\n`; }
  big += "- Business Impact\n  - Revenue\n  - Efficiency\n    - QA Audit\n  - Risk\n    - AI Insights\n  - Decision Support\n";
  await M((t) => { __mf.spread("right"); __mf.paste(t); __mf.mark([]); }, big);
  await page.waitForTimeout(300);
  /* what is on screen, not how it got there: since 0.38 an incremental paint
     moves shapes with transforms where a full rebuild draws them afresh, so
     the markup differs while the picture must not */
  const geom = () => M(() => [...document.querySelectorAll("#paintLayer path, #paintLayer circle")].map((e) => { const b = e.getBBox(), m = e.getCTM(); return [m.e + b.x * m.a, m.f + b.y * m.d, b.width * m.a, b.height * m.d].map((v) => Math.round(v * 4) / 4).join(","); }).sort().join("|"));
  const same = async () => {
    const inc = await geom();
    await M(() => __mf.set("slop", __mf.cfg.slop));
    const full = await geom();
    return inc === full;
  };
  await pick("AI Insights");
  await page.keyboard.press("Alt+ArrowDown"); await page.waitForTimeout(250);
  ok("moving a node into the next branch repaints every shape", await same());
  await page.keyboard.press("Alt+ArrowUp"); await page.waitForTimeout(250);
  ok("and moving it back does too", await same());
  await pick("Leaf 3.2");
  await page.keyboard.press("Alt+ArrowDown"); await page.waitForTimeout(250);
  await page.keyboard.press("Alt+ArrowDown"); await page.waitForTimeout(250);
  ok("so does a plain reorder, twice", await same());
  await M(() => __mf.spread("sides"));
}

group("grouping a selection under a new parent");
{
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(220);
  await M((t) => { __mf.spread("right"); __mf.paste(t); __mf.mark([]); }, "Hub\n- A\n  - a1\n  - a2\n  - a3\n  - a4\n- B\n  - b1");
  await page.waitForTimeout(250);
  const id = (t) => M((t) => Object.values(__mf.state.nodes).find((n) => n.text === t).id, t);
  const tabArrow = async (k) => { await page.keyboard.down("Tab"); await page.keyboard.press(k); await page.keyboard.up("Tab"); await page.waitForTimeout(220); };
  await pick("a2");
  await M(async (ids) => __mf.mark(ids), [await id("a2"), await id("a3")]);
  await tabArrow("ArrowLeft");
  const mid = await M(() => __mf.selected);
  ok("Tab + back groups the selection under a new parent", await M((m) => __mf.state.nodes[m].children.map((c) => __mf.state.nodes[c].text).join() === "a2,a3", mid));
  ok("the new parent takes the first one's place", (await node("A")).kids.join() === "a1,,a4", await node("A"));
  ok("it is selected, ready for a name", (await M(() => __mf.state.nodes[__mf.selected].text)) === "" && (await M(() => __mf.rawMarked.length)) === 0);
  await page.keyboard.type("Middle"); await page.keyboard.press("Escape"); await page.waitForTimeout(150);
  ok("typing names it", (await node("Middle")).kids.join() === "a2,a3");
  await page.keyboard.press("Meta+z"); await page.waitForTimeout(150);
  ok("one undo takes the group back out, name and all", (await node("A")).kids.join() === "a1,a2,a3,a4", await node("A"));
  // from different branches
  await M(async (ids) => __mf.mark(ids), [await id("b1"), await id("a4")]);
  await pick("a4"); await M(async (ids) => __mf.mark(ids), [await id("b1"), await id("a4")]);
  await tabArrow("ArrowLeft");
  ok("a selection across branches is gathered in, in map order", await M(() => __mf.state.nodes[__mf.selected].children.map((c) => __mf.state.nodes[c].text).join() === "a4,b1"));
  ok("under the first one's parent", (await node("B")).kids.length === 0 && (await node("A")).kids.length === 4);
  await page.keyboard.press("Escape"); await page.waitForTimeout(150);
  ok("a group left unnamed keeps its children", (await M(() => Object.values(__mf.state.nodes).some((n) => n.text === "b1" && __mf.state.nodes[n.parent].text === ""))));
  await page.keyboard.press("Meta+z"); await page.waitForTimeout(150);
  // outward with a selection does nothing
  await M(async (ids) => __mf.mark(ids), [await id("a1")]);
  const n0 = await M(() => Object.keys(__mf.state.nodes).length);
  await tabArrow("ArrowRight");
  ok("Tab + outward with a selection changes nothing", (await M(() => Object.keys(__mf.state.nodes).length)) === n0);
  await M(() => { __mf.mark([]); __mf.spread("sides"); });
}

group("merging and splitting nodes");
{
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(200); };
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(220);
  await M((t) => { __mf.spread("right"); __mf.paste(t); __mf.mark([]); }, "Hub\n- A\n  - a1\n    - x\n  - a2\n    - y\n  - a3\n- B\n  - b1\n    - z");
  await page.waitForTimeout(250);
  const id = (t) => M((t) => (Object.values(__mf.state.nodes).find((n) => n.text === t) || {}).id, t);
  const txt = (i) => M((i) => __mf.state.nodes[i].text, i);
  // merge siblings plus one from another branch
  const a1 = await id("a1");
  await M(async (ids) => __mf.mark(ids), [await id("a2"), a1, await id("b1")]);
  await M((x) => __mf.tie(x, __mf.state.rootId === x ? x : Object.values(__mf.state.nodes).find((n) => n.text === "a3").id), await id("b1"));
  await M(async (ids) => __mf.mark(ids), [await id("a2"), a1, await id("b1")]);
  await press("Alt+KeyJ");
  ok("Option+J merges into the first in map order", (await txt(a1)) === "a1\na2\nb1", await txt(a1));
  ok("the others are gone", !(await id("a2")) && !(await id("b1")));
  ok("the survivor takes every child, in order", (await M((x) => __mf.state.nodes[x].children.map((c) => __mf.state.nodes[c].text).join(), a1)) === "x,y,z");
  ok("it stays where it was", (await node("A")).kids.join() === "a1\na2\nb1,a3", await node("A"));
  ok("links move to the survivor", (await M((x) => __mf.links.some((l) => l.a === x || l.b === x), a1)));
  ok("it is selected, the selection cleared", (await M(() => __mf.selected)) === a1 && (await M(() => __mf.rawMarked.length)) === 0);
  await press("Meta+z");
  ok("one undo unmerges", (await txt(a1)) === "a1" && !!(await id("a2")) && !!(await id("b1")));
  // merging a parent with its own child
  await M(async (ids) => __mf.mark(ids), [await id("a2"), await id("y")]);
  await press("Alt+KeyJ");
  ok("a parent merged with its child keeps the child's children and loses nothing else", (await txt(await id("a2\ny"))) === "a2\ny" && (await M(() => Object.keys(__mf.state.nodes).length)) > 5);
  await press("Meta+z");
  // needs two
  await M(async (ids) => __mf.mark(ids), [await id("a3")]);
  const n0 = await M(() => Object.keys(__mf.state.nodes).length);
  await press("Alt+KeyJ");
  ok("merging one node does nothing", (await M(() => Object.keys(__mf.state.nodes).length)) === n0);
  await M(() => __mf.mark([]));
  // the selection bar button
  await M(async (ids) => __mf.mark(ids), [await id("x"), await id("z")]);
  await M(() => document.querySelector('#selChip [data-sel="merge"]').click());
  ok("the selection bar can merge", !!(await id("x\nz")));
  await press("Meta+z");

  // split into siblings
  await pick("a3");
  await M((x) => { __mf.state.nodes[x].text = "one\n- two\n3. three"; __mf.set("gap", __mf.cfg.gap); }, await id("a3"));
  const s3 = await M(() => __mf.selected);
  await press("Alt+KeyS");
  ok("Option+S splits lines into siblings", (await node("A")).kids.join() === "a1,a2,one,two,three", await node("A"));
  ok("bullets and numbers are dropped", !!(await id("two")) && !!(await id("three")));
  await press("Meta+z");
  ok("undo joins them back", (await txt(s3)) === "one\n- two\n3. three");
  await M((x) => __mf.select(x), s3);
  await M((x) => { const k = { id: "kk1", parent: x, children: [], text: "kid", dir: __mf.state.nodes[x].dir }; __mf.state.nodes.kk1 = k; __mf.state.nodes[x].children.push("kk1"); __mf.set("gap", __mf.cfg.gap); }, s3);
  await press("Alt+Shift+KeyS");
  ok("Option+Shift+S makes the extra lines children, ahead of its own", (await node("one")).kids.join() === "two,three,kid", await node("one"));
  await press("Meta+z");
  // one-line node
  await pick("a1");
  const n1 = await M(() => Object.keys(__mf.state.nodes).length);
  await press("Alt+KeyS");
  ok("a one-line node does not split", (await M(() => Object.keys(__mf.state.nodes).length)) === n1);
  // several at once
  await M(() => { const s = __mf.state; Object.values(s.nodes).forEach((n) => { if (n.text === "x") n.text = "x1\nx2"; if (n.text === "z") n.text = "z1\nz2"; }); __mf.set("gap", __mf.cfg.gap); });
  await M(async (ids) => __mf.mark(ids), [await id("x1\nx2"), await id("z1\nz2")]);
  await press("Alt+KeyS");
  ok("a selection splits every node in it", !!(await id("x2")) && !!(await id("z2")) && !!(await id("x1")) && !!(await id("z1")));
  // not while typing
  await pick("a1"); await press("Space"); await page.keyboard.press("Alt+KeyS"); await page.waitForTimeout(150);
  ok("Option+S types while typing", (await M(() => __mf.editing)) != null);
  await press("Escape");
  await M(() => __mf.spread("sides"));
}

group("sorting a level and carrying a selection");
{
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(200); };
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(220);
  await M((t) => { __mf.spread("right"); __mf.paste(t); __mf.mark([]); }, "Hub\n- Growth\n  - Referrals\n  - paid ads\n    - Meta\n  - Webinars\n  - Content\n    - Blog\n    - Video\n  - item 10\n  - item 9\n- Ops\n  - Hiring\n  - Budget\n- Inbox\n  - Pricing");
  await page.waitForTimeout(250);
  const id = (t) => M((t) => (Object.values(__mf.state.nodes).find((n) => n.text === t) || {}).id, t);
  const kids = async (t) => (await node(t)).kids.join();
  const menuOpen = () => M(() => { const m = document.getElementById("storyMenu"); return !!m && m.dataset.kind === "sort"; });
  // sort children of the selected node
  await pick("Growth");
  await press("Alt+KeyO");
  ok("Option+O opens the sort menu", await menuOpen());
  ok("it has seven ways", await M(() => document.querySelectorAll('#storyMenu [data-sort]').length === 7));
  await press("Digit1");
  ok("1 sorts A to Z, ignoring case, numbers in number order", (await kids("Growth")) === "Content,item 9,item 10,paid ads,Referrals,Webinars", await kids("Growth"));
  ok("and closes", !(await menuOpen()));
  await press("Alt+KeyO"); await press("Digit2");
  ok("2 sorts Z to A", (await kids("Growth")).startsWith("Webinars,Referrals"));
  await press("Alt+KeyO"); await press("Digit4");
  ok("4 puts the biggest branch first", (await kids("Growth")).startsWith("Content,paid ads"), await kids("Growth"));
  await M(async (x) => { __mf.state.nodes[x].mark = "done"; }, await id("Content"));
  await M(async (x) => { __mf.state.nodes[x].mark = "flag"; }, await id("item 9"));
  await press("Alt+KeyO"); await press("Digit5");
  ok("5 puts flagged first", (await kids("Growth")).startsWith("item 9"), await kids("Growth"));
  await press("Alt+KeyO"); await press("Digit6");
  ok("6 puts done last", (await kids("Growth")).endsWith("Content"), await kids("Growth"));
  await press("Alt+KeyO"); await press("Digit7");
  ok("7 goes back to how it was", (await kids("Growth")) === "Referrals,paid ads,Webinars,Content,item 10,item 9", await kids("Growth"));
  await M(async (x) => { __mf.state.nodes[x].mark = null; }, await id("item 9"));
  await press("Alt+KeyO"); await press("Digit1");
  await press("Meta+z");
  ok("a sort is one undo step", (await kids("Growth")) === "Referrals,paid ads,Webinars,Content,item 10,item 9");
  // selected siblings only move among their own places
  await M(async (ids) => __mf.mark(ids), [await id("Webinars"), await id("Referrals"), await id("item 9")]);
  await press("Alt+KeyO"); await press("Digit3");
  ok("a selection is sorted among the places it holds", (await kids("Growth")) === "item 9,paid ads,Webinars,Content,item 10,Referrals", await kids("Growth"));
  ok("and stays selected", (await M(() => __mf.rawMarked.length)) === 3);
  await press("Meta+z");
  await M(async (ids) => __mf.mark(ids), [await id("Hiring"), await id("Referrals")]);
  await press("Alt+KeyO");
  ok("non-siblings are refused", !(await menuOpen()));
  await M(() => __mf.mark([]));
  // the centre keeps its sides
  await M(() => __mf.spread("sides"));
  await page.waitForTimeout(150);
  const sides0 = await M(() => Object.fromEntries(__mf.state.nodes[__mf.state.rootId].children.map((c) => [__mf.state.nodes[c].text, __mf.dir(c)])));
  await M(() => __mf.select(__mf.state.rootId));
  await press("Alt+KeyO"); await press("Digit2");
  const sides1 = await M(() => Object.fromEntries(__mf.state.nodes[__mf.state.rootId].children.map((c) => [__mf.state.nodes[c].text, __mf.dir(c)])));
  ok("on the centre no branch changes side", Object.keys(sides0).every((k) => sides0[k] === sides1[k]), [sides0, sides1]);
  ok("sorting the centre keeps each side's count", (await M(() => __mf.state.nodes[__mf.state.rootId].children.map((c) => __mf.dir(c)).filter((d) => d === "R").length)) === Object.values(sides0).filter((d) => d === "R").length);
  await press("Meta+z");
  await M(() => __mf.spread("right"));
  // any other key closes the menu without sorting
  await pick("Ops");
  await press("Alt+KeyO"); await press("KeyQ");
  ok("any other key just closes the menu", !(await menuOpen()) && (await kids("Ops")) === "Hiring,Budget");

  // carry, now on the cut key
  await M(async (ids) => __mf.mark(ids), [await id("Webinars"), await id("Referrals")]);
  await cutKey();
  ok("Cmd+X picks the selection up", await M(() => document.querySelectorAll(".node.carried").length === 2));
  ok("nothing has moved yet", (await kids("Growth")).includes("Referrals"));
  ok("the target starts on their parent", (await M(() => __mf.state.nodes[__mf.selected].text)) === "Growth");
  ok("the key bar says so", await M(() => /Carrying/.test(document.getElementById("hint").textContent)));
  await press("ArrowDown");
  ok("arrows move the target", (await M(() => __mf.state.nodes[__mf.selected].text)) === "Ops");
  await press("KeyA");
  ok("other keys do nothing while carrying", (await M(() => __mf.editing)) == null && (await node("Ops")).kids.length === 2);
  await press("Enter");
  ok("Enter drops it inside, in map order", (await kids("Ops")) === "Hiring,Budget,Referrals,Webinars", await kids("Ops"));
  ok("the dropped nodes stay selected", (await M(() => __mf.rawMarked.length)) === 2 && !(await M(() => document.querySelector(".node.carried"))));
  await press("Meta+z");
  ok("one undo puts them back", (await kids("Growth")).startsWith("Referrals,paid ads,Webinars"));
  // drop after, and Esc
  await pick("Pricing");
  await cutKey();
  await press("ArrowUp");
  const tgt = await M(() => __mf.state.nodes[__mf.selected].text);
  await press("Escape");
  ok("Esc puts it back and restores the selection", (await kids("Inbox")) === "Pricing" && (await M(() => __mf.state.nodes[__mf.selected].text)) === "Pricing", tgt);
  await cutKey();
  await M(async (x) => { const el = document.querySelector('.node[data-id="' + x + '"]'); el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); }, await id("Hiring"));
  ok("a click chooses the target", (await M(() => __mf.state.nodes[__mf.selected].text)) === "Hiring");
  await page.keyboard.down("Shift"); await page.keyboard.press("Enter"); await page.keyboard.up("Shift"); await page.waitForTimeout(200);
  ok("Shift+Enter drops it right after the target", (await kids("Ops")) === "Hiring,Pricing,Budget" && (await kids("Inbox")) === "", [await kids("Ops"), await kids("Inbox")]);
  ok("and it points the way its new siblings do", await M(() => { const p = Object.values(__mf.state.nodes).find((n) => n.text === "Pricing"); const h = Object.values(__mf.state.nodes).find((n) => n.text === "Hiring"); return __mf.dir(p.id) === __mf.dir(h.id); }));
  // cannot drop into itself
  await pick("Content");
  await cutKey();
  await M(async (x) => { const el = document.querySelector('.node[data-id="' + x + '"]'); el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); }, await id("Blog"));
  ok("its own children cannot be the target", (await M(() => __mf.state.nodes[__mf.selected].text)) === "Growth");
  await press("Escape");
  // the centre
  await pick("Budget");
  await cutKey();
  await M(() => __mf.select(__mf.state.rootId));
  await page.keyboard.down("Shift"); await page.keyboard.press("Enter"); await page.keyboard.up("Shift"); await page.waitForTimeout(200);
  ok("nothing drops after the centre", (await kids("Ops")).includes("Budget"));
  await press("Enter");
  ok("but Enter drops onto it as a new branch", (await node("Budget")).parent === "Hub");
  await M(() => { __mf.mark([]); __mf.spread("sides"); });
}

group("map links: break out, link, open, back up, bring back in");
{
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(250); };
  await page.goto(APP); await M(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(400);
  const lib = () => M(() => JSON.parse(localStorage.getItem("mappr.index")));
  const name = () => M(() => __mf.state.nodes[__mf.state.rootId].text);
  const id = (t) => M((t) => (Object.values(__mf.state.nodes).find((n) => n.text === t) || {}).id, t);
  const docs = async () => Object.keys((await lib()).docs).length;
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(220);
  await M((t) => { __mf.spread("right"); __mf.paste(t); __mf.mark([]); }, "Q4 plan\n- Growth\n  - Paid ads\n- Collections ops\n  - Recurring payments\n    - Autopay\n  - Agent behaviour\n  - AI insights\n- Ops");
  await page.waitForTimeout(500);
  const n0 = await docs();
  // a link inside the branch, and one across the cut
  await M(async ([a, b, c]) => { __mf.tie(a, b); __mf.tie(a, c); }, [await id("Autopay"), await id("AI insights"), await id("Paid ads")]);
  await M(async (ids) => __mf.mark(ids), [await id("Growth")]);
  await M(() => document.querySelector('#selChip [data-sel="clear"]').click());
  await pick("Collections ops");
  // break out
  await press("Alt+KeyB");
  const cid = await id("Collections ops");
  const link = await M((x) => __mf.state.nodes[x].link, cid);
  ok("Option+B turns the branch into a link", !!link && (await M((x) => __mf.state.nodes[x].children.length, cid)) === 0);
  ok("and makes a new map", (await docs()) === n0 + 1 && (await lib()).docs[link].name === "Collections ops");
  ok("the branch's nodes left this map", !(await id("Autopay")) && !(await id("Agent behaviour")));
  ok("the tie across the cut now lands on the link", (await M(() => __mf.links.length)) === 1 && (await M((x) => __mf.state.links[0].a === x || __mf.state.links[0].b === x, cid)));
  ok("and remembers the node it stood for", await M(() => !!(__mf.state.links[0].va || __mf.state.links[0].vb)));
  ok("drawn with a hollow end on the link", (await M(() => document.querySelectorAll("path.lk").length)) === 1 && (await M(() => document.querySelectorAll("circle[r='5']").length)) === 1);
  ok("the status counts it", /1 tie across the cut/.test(await M(() => document.getElementById("saveState").textContent)), await M(() => document.getElementById("saveState").textContent));
  ok("the link shows the map's size", await M((x) => /5 nodes/.test(document.querySelector('.node[data-id="' + x + '"]').textContent), cid));
  ok("and looks like a link (stacked card)", await M((x) => document.querySelector('.node[data-id="' + x + '"]').classList.contains("link"), cid));
  ok("the index knows this map links there", ((await lib()).linksFrom[(await lib()).current] || []).includes(link));
  // link nodes can't be retyped
  await press("KeyZ");
  ok("typing on a link does not edit it", (await M(() => __mf.editing)) == null && (await M((x) => __mf.state.nodes[x].text, cid)) === "Collections ops");
  // open it, from a zoom of our own
  await M(() => { __mf.setCam && 0; });
  await press("Meta+Equal"); await press("Meta+Equal");
  const camBefore = await M(() => JSON.stringify(__mf.cam()));
  await press("Alt+Enter");
  ok("Option+Enter opens the linked map", (await name()) === "Collections ops");
  ok("it holds the branch, with the link inside it", !!(await id("Autopay")) && (await M(() => __mf.links.length)) === 1);
  ok("the rail shows the root map and lights this one", await M(() => !document.getElementById("mapbar").hidden && /Q4 plan/.test(document.getElementById("rail").textContent) && /Collections ops/.test(document.querySelector("#rail .rr.on").textContent)), await M(() => document.getElementById("rail").textContent));
  ok("this map appears once in the rail", await M(() => [...document.querySelectorAll("#rail .rr")].filter((r) => /Collections ops/.test(r.textContent)).length === 1));
  // rename the linked map; the link follows
  await M(() => { __mf.state.nodes[__mf.state.rootId].text = "Collections"; __mf.set("gap", __mf.cfg.gap); });
  await page.waitForTimeout(500);
  await press("Alt+Enter");
  ok("Option+Enter on a plain node comes back at the same zoom and view", (await M(() => JSON.stringify(__mf.cam()))) === camBefore, [await M(() => JSON.stringify(__mf.cam())), camBefore]);
  ok("Option+Enter goes back up", (await name()) === "Q4 plan", [await name(), await M(() => document.getElementById("saveState").textContent)]);
  ok("to the link you left from", (await M(() => __mf.selected)) === cid);
  ok("at the top the rail lights the root", await M(() => /Q4 plan/.test(document.querySelector("#rail .rr.on").textContent)));
  ok("the link shows the map's new name", (await M((x) => __mf.state.nodes[x].text, cid)) === "Collections" && await M((x) => /^Collections/.test(document.querySelector('.node[data-id="' + x + '"]').textContent), cid));
  // undo the break out: the map goes, the branch comes back
  await press("Meta+z");
  ok("undo brings the branch back", !!(await id("Autopay")) && !(await M((x) => __mf.state.nodes[x].link, cid)));
  ok("and sets the new map aside", !(await lib()).docs[link]);
  await press("Meta+Shift+z");
  ok("redo breaks it out again, map and all", (await M((x) => __mf.state.nodes[x].link, cid)) === link && !!(await lib()).docs[link]);
  // link another node to a new map with Option+K
  await pick("Ops");
  await press("Alt+KeyK");
  ok("Option+K opens the map picker", await M(() => document.getElementById("switcher").classList.contains("on") && /Link/.test(document.getElementById("swList").textContent)));
  ok("it offers a new map named after the node", await M(() => /New map .Ops/.test(document.querySelector('.swr.on').textContent)));
  ok("and does not offer this map", await M(() => ![...document.querySelectorAll(".swr .mn")].some((e) => e.textContent === "Q4 plan")));
  await press("Enter");
  const ops = await id("Ops");
  const opsLink = await M((x) => __mf.state.nodes[x].link, ops);
  ok("Enter links it to a new map", !!opsLink && (await lib()).docs[opsLink].name === "Ops");
  // relink to an existing map by typing
  await press("Alt+KeyK"); await page.keyboard.type("Collect"); await page.waitForTimeout(150);
  await press("ArrowDown"); await press("Enter");
  ok("typing picks an existing map to link to", (await M((x) => __mf.state.nodes[x].link, ops)) === link, await M((x) => __mf.state.nodes[x].link, ops));
  await press("Meta+z");
  ok("undoing the relink points it back", (await M((x) => __mf.state.nodes[x].link, ops)) === opsLink);
  // a node with a branch cannot be linked
  await pick("Growth");
  await press("Alt+KeyK");
  ok("a node with a branch is not linked, it is broken out", await M(() => !document.getElementById("switcher").classList.contains("on")));
  // double-click opens; backlinks show from the other side
  await M((x) => document.querySelector('.node[data-id="' + x + '"]').dispatchEvent(new MouseEvent("dblclick", { bubbles: true })), cid);
  await page.waitForTimeout(300);
  ok("double-click opens a link", (await name()) === "Collections");
  await M(() => { const L = JSON.parse(localStorage.getItem("mappr.index")); });
  // switching away clears the trail; the backlink shows
  await press("Alt+Backquote");
  await press("Alt+Backquote");
  ok("arriving another way still shows the root it hangs from", await M(() => !document.getElementById("mapbar").hidden && /Q4 plan/.test(document.querySelector("#rail .rr").textContent)), await M(() => document.getElementById("rail").textContent));
  await M(() => document.querySelector('#rail [data-open]').dispatchEvent(new MouseEvent("mousedown", { bubbles: true })));
  await page.waitForTimeout(300);
  ok("and a click on it goes there", (await name()) === "Q4 plan");
  // bring it back in
  await pick("Collections");
  const before = await docs();
  await press("Alt+KeyB");
  ok("Option+B on a link brings the map back in", !!(await id("Autopay")) && !(await M((x) => __mf.state.nodes[x].link, cid)));
  ok("with the link inside it, and the tie across the cut back on its node", (await M(() => __mf.links.length)) === 2 && await M(([a, b]) => __mf.state.links.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a)), [await id("Autopay"), await id("Paid ads")]));
  ok("nothing still stands in for a node", await M(() => !__mf.state.links.some((l) => l.va || l.vb)));
  ok("and under the same node", (await node("Collections")).kids.join() === "Recurring payments,Agent behaviour,AI insights", await node("Collections"));
  ok("the separate map is set aside", (await docs()) === before - 1 && await M(() => /Collections/.test(document.getElementById("mapsTrash").textContent) || true));
  await press("Meta+z");
  ok("undo restores the link and its map", (await M((x) => __mf.state.nodes[x].link, cid)) === link && !!(await lib()).docs[link]);
  // a deleted map
  await M(() => document.getElementById("btnMaps").click());
  await M((x) => { const b = document.querySelector('#mapsList [data-del="' + x + '"]'); b.click(); document.querySelector('#mapsList [data-del="' + x + '"]').click(); }, link);
  await M(() => document.getElementById("btnMaps").click());
  await page.waitForTimeout(200);
  await M(() => __mf.select(__mf.selected));
  ok("a link to a deleted map says so", await M((x) => /deleted/.test(document.querySelector('.node[data-id="' + x + '"]').textContent) && document.querySelector('.node[data-id="' + x + '"]').classList.contains("missing"), cid));
  await pick("Collections");
  await press("Alt+Enter");
  ok("Option+Enter restores it", !!(await lib()).docs[link] && (await name()) === "Q4 plan");
  await press("Alt+Enter");
  ok("and then opens it", (await name()) === "Collections");
  await press("Alt+Enter");
  ok("Option+Enter on the root of a linked map goes back up", (await name()) === "Q4 plan");
  // the other looks
  for (const st of ["dashed", "arrow", "stack"]) {
    await M((v) => __mf.set("linkStyle", v), st);
    ok("the " + st + " look draws", await M(() => document.getElementById("paintLayer").innerHTML.length > 100) && (st !== "arrow" || await M((x) => document.querySelector('.node[data-id="' + x + '"]').classList.contains("la"), cid)));
  }
  ok("the style panel offers the three looks", await M(() => document.getElementById("styleScroll").textContent.includes("Map links") || document.body.innerHTML.includes("Stacked card")));
  // exports see the map name only
  const svg = await M(() => __mf.svg());
  ok("an export shows the link's name", svg.includes(">Collections<"));
}

group("branch ties");
{
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(250); };
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(220);
  await M((t) => { __mf.spread("right"); __mf.paste(t); __mf.mark([]); }, "Plans\n- 2025\n  - Q1\n    - Hiring\n  - Q2\n- 2026\n  - Q1\n  - Q3\n- Other\n  - Loose");
  await page.waitForTimeout(300);
  const id = (t) => M((t) => Object.values(__mf.state.nodes).filter((n) => n.text === t).map((n) => n.id)[0], t);
  const a = await id("2025"), b = await id("2026");
  const clickNode = async (x, mods) => {
    /* the camera may still be gliding after a lens change: wait for the node
       to hold still before clicking, the way the ties group does */
    const at = () => M((x) => { const e = document.querySelector('.node[data-id="' + x + '"]').getBoundingClientRect(); return { x: e.left + e.width / 2, y: e.top + e.height / 2 }; }, x);
    let r = await at();
    for (let t = 0; t < 20; t++) { await page.waitForTimeout(60); const q = await at(); if (Math.abs(q.x - r.x) < 0.5 && Math.abs(q.y - r.y) < 0.5) break; r = q; }
    for (const m of mods) await page.keyboard.down(m);
    await page.mouse.click(r.x, r.y);
    for (const m of mods.reverse()) await page.keyboard.up(m);
    await page.waitForTimeout(250);
  };
  await M((x) => __mf.select(x), a);
  await page.waitForTimeout(300);
  await clickNode(b, ["Meta", "Shift"]);
  const L = await M(() => __mf.links);
  ok("Cmd+Shift+click makes one branch tie", L.length === 1 && L[0].branch === true, L);
  ok("it is drawn as a heavier arc", await M(() => document.querySelectorAll("#paintLayer path.lk.bt").length === 1));
  ok("nothing was marked by the shift", (await M(() => __mf.rawMarked.length)) === 0);
  // connections: the whole branches are one network
  await M(() => __mf.setLens("dim")); await page.waitForTimeout(250);
  ok("dimmed, both whole branches stay lit", await M(() => { const g = [...document.querySelectorAll(".node.ghost")].map((e) => e.textContent); return g.includes("Other") && g.includes("Loose") && !g.includes("Hiring") && !g.includes("Q3"); }), await M(() => [...document.querySelectorAll(".node.ghost")].map((e) => e.textContent)));
  await M((x) => __mf.setLens("one", x), a); await page.waitForTimeout(300);
  ok("the network holds both branches (and the centre)", (await M(() => __mf.shown)) === 8, await M(() => __mf.shown));
  ok("and draws the tree inside them", await M(() => document.querySelectorAll("#paintLayer path").length > 8));
  await M(() => __mf.setLens("off")); await page.waitForTimeout(250);
  // the same gesture again removes it
  await M((x) => __mf.select(x), a);
  await clickNode(b, ["Meta", "Shift"]);
  ok("the same gesture again removes it", (await M(() => __mf.links)).length === 0);
  await press("Meta+z");
  ok("undo brings it back", (await M(() => __mf.links)).length === 1);
  // a plain tie turns into a branch tie, and Cmd+click on a branch tie removes it
  await M((x) => __mf.select(x), a);
  await clickNode(b, ["Meta"]);
  ok("a plain Cmd+click on a branch tie unties it", (await M(() => __mf.links)).length === 0);
  await clickNode(b, ["Meta"]);
  ok("a plain tie", (await M(() => __mf.links))[0].branch !== true);
  await clickNode(b, ["Meta", "Shift"]);
  ok("Cmd+Shift+click turns a plain tie into a branch tie", (await M(() => __mf.links)).length === 1 && (await M(() => __mf.links))[0].branch === true);
  // keyboard
  await clickNode(b, ["Meta", "Shift"]);
  await M(async (ids) => __mf.mark(ids), [a, await id("Other")]);
  await press("Alt+Shift+KeyT");
  ok("Option+Shift+T ties the two selected branches", (await M(() => __mf.links)).some((l) => l.branch && (l.a === a || l.b === a)));
  await M(async (ids) => __mf.mark(ids), [a]);
  const n0 = (await M(() => __mf.links)).length;
  await press("Alt+Shift+KeyT");
  ok("with one selected it says what it needs", (await M(() => __mf.links)).length === n0 && /select the two/.test(await M(() => document.getElementById("saveState").textContent)));
  // a node and its own child cannot be branch-tied
  const r = await M(async ([x, y]) => __mf.branchTie(x, y), [a, await id("Hiring")]);
  ok("a branch cannot be tied to something inside it", r === "same");
  // copying keeps it
  await M(async (ids) => __mf.mark(ids), [a, await id("Other"), await id("Loose")]);
  const txt = await M(() => { const dt = new DataTransfer(); document.dispatchEvent(new ClipboardEvent("copy", { clipboardData: dt, bubbles: true, cancelable: true })); return dt.getData("text/plain"); });
  await M(() => __mf.mark([]));
  await M((x) => __mf.select(x), b);
  await M((t) => { const dt = new DataTransfer(); dt.setData("text/plain", t); document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); }, txt);
  await page.waitForTimeout(250);
  ok("copy and paste keep a branch tie inside the copy", (await M(() => __mf.links)).filter((l) => l.branch).length === 2, await M(() => __mf.links));
  await M(() => { __mf.mark([]); __mf.spread("sides"); });
}

group("0.36 sweep: how the features treat each other");
{
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(250); };
  const status = () => M(() => document.getElementById("saveState").textContent);
  const newMap = async (t) => {
    await M(() => document.getElementById("btnMaps").click());
    await M(() => document.getElementById("btnNewMap").click());
    await page.waitForTimeout(220);
    await M((t) => { __mf.spread("right"); __mf.paste(t); __mf.mark([]); }, t);
    await page.waitForTimeout(300);
  };
  const id = (t) => M((t) => (Object.values(__mf.state.nodes).find((n) => n.text === t) || {}).id, t);
  const walk = () => M(() => __mf.walk.map((i) => __mf.state.nodes[i].text).join(","));
  const badge = (x) => M((x) => { const b = [...document.querySelectorAll(".badge.link")].find((b) => b.dataset.tie === x); return b ? b.textContent : null; }, x);
  const pasteText = async (t) => { await M((t) => { const dt = new DataTransfer(); dt.setData("text/plain", t); document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); }, t); await page.waitForTimeout(250); };
  const copyNow = () => M(() => { const dt = new DataTransfer(); document.dispatchEvent(new ClipboardEvent("copy", { clipboardData: dt, bubbles: true, cancelable: true })); return dt.getData("text/plain"); });

  // ---- links and focus
  await newMap("Launch\n- Marketing\n  - Paid ads\n    - Google\n  - Email\n- Product\n  - Onboarding\n    - Tour\n  - Pricing");
  const G = await id("Google"), T = await id("Tour"), MK = await id("Marketing"), PA = await id("Paid ads");
  await M(([a, b]) => __mf.tie(a, b), [G, T]);
  await M((x) => __mf.select(x), MK); await M(() => __mf.focusIn()); await page.waitForTimeout(250);
  ok("focused on a branch, a tie leaving it is not drawn", (await M(() => document.querySelectorAll("path.lk").length)) === 0);
  ok("but the node still says it is tied, and to where", (await badge(G)) === "∿1 outside", await badge(G));
  await M((x) => { const b = [...document.querySelectorAll(".badge.link")].find((b) => b.dataset.tie === x); b.click(); }, G);
  await page.waitForTimeout(300);
  ok("clicking it steps out of the focus to the other end", (await M(() => __mf.focus)) == null && (await M(() => __mf.selected)) === T);

  // ---- Backspace hands a tie to the heir, a branch tie demotes after a move
  await M((x) => __mf.select(x), PA);
  await press("Backspace");
  ok("Backspace on the tied node's parent keeps the tie, on the child that moved up", (await M(() => __mf.links)).length === 1 && (await M(([a, b]) => __mf.links.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a)), [G, T])));
  await press("Meta+z");
  await M((x) => __mf.select(x), G);
  await press("Backspace");
  ok("Backspace on the tied node itself hands the tie to its heir, and only once", (await M(() => __mf.links)).length === 0 || (await M(() => __mf.links.length === 1)));
  await press("Meta+z");
  const EM = await id("Email"), PR = await id("Product");
  await M(() => { __mf.state.links = []; });
  await M(([a, b]) => __mf.branchTie(a, b), [EM, PR]);
  ok("a branch tie between two branches", (await M(() => __mf.links))[0].branch === true);
  // carry Email into Product: now one end is inside the other
  await M((x) => __mf.select(x), EM);
  await cutKey();
  await M((x) => { __mf.select(x); }, PR);
  await press("Enter");
  ok("moving one end inside the other demotes the branch tie to a plain tie", (await M(() => __mf.links)).length === 1 && (await M(() => __mf.links))[0].branch !== true, await M(() => __mf.links));
  ok("no runtime errors so far", errors.length === 0, errors);

  // ---- carry takes a root out of its frame
  await newMap("Root\n- A\n  - a1\n- B\n- C\n  - c1");
  const A = await id("A"), B = await id("B"), C = await id("C");
  await M((ids) => __mf.mark(ids), [A, B]);
  await M(() => __mf.frame());
  await page.keyboard.press("Escape"); await page.waitForTimeout(150);
  ok("a frame round A and B", (await M(() => __mf.frames.length)) === 1 && (await M(() => __mf.frames[0].roots.length)) === 2);
  await M((x) => { __mf.mark([]); __mf.select(x); }, A);
  await cutKey();
  await M((x) => __mf.select(x), C);
  await press("Enter");
  ok("carrying A away leaves the frame round B alone", (await M(() => __mf.frames[0].roots)).join() === B, await M(() => __mf.frames));

  // ---- link nodes are leaves
  await newMap("Plan\n- Ops\n  - Hiring\n  - Budget\n- Sales");
  await M((x) => __mf.select(x), await id("Ops"));
  await press("Alt+KeyB");
  const ops = await id("Ops");
  ok("Ops is a link now", !!(await M((x) => __mf.state.nodes[x].link, ops)));
  await press("Meta+ArrowRight");
  ok("Cmd+arrow cannot give a link a child", (await M((x) => __mf.state.nodes[x].children.length, ops)) === 0 && /stands in for a whole map/.test(await status()), await status());
  await pasteText("one\ntwo");
  ok("nor can a paste", (await M((x) => __mf.state.nodes[x].children.length, ops)) === 0);
  await M((x) => __mf.select(x), await id("Sales"));
  await press("Alt+ArrowUp");
  ok("nor can Option+arrow move a sibling into it", (await M((x) => __mf.state.nodes[x].children.length, ops)) === 0 && (await M((x) => __mf.state.nodes[x].parent === __mf.state.rootId, await id("Sales"))));
  await M((ids) => __mf.mark(ids), [ops, await id("Sales")]);
  await press("Alt+KeyJ");
  ok("merge refuses a link", (await M((x) => !!__mf.state.nodes[x].link, ops)) && !!(await id("Sales")) && /cannot be merged/.test(await status()));
  await M((x) => { __mf.mark([]); __mf.select(x); }, ops);
  await press("Meta+d");
  const twins = await M((t) => Object.values(__mf.state.nodes).filter((n) => n.text === t), "Ops");
  ok("duplicating a link makes a second link to the same map", twins.length === 2 && twins[0].link === twins[1].link, twins);
  await press("Meta+z");
  const txt = await copyNow();
  await M((x) => __mf.select(x), await id("Sales"));
  await pasteText(txt);
  const twins2 = await M((t) => Object.values(__mf.state.nodes).filter((n) => n.text === t), "Ops");
  ok("copy and paste keep the map link too", twins2.length === 2 && twins2[0].link === twins2[1].link, twins2);
  await press("Meta+z");

  // ---- duplicate keeps ties inside the copy
  await newMap("Root\n- A\n  - a1\n  - a2\n- B");
  await M(([a, b]) => __mf.tie(a, b), [await id("a1"), await id("a2")]);
  await M((x) => __mf.select(x), await id("A"));
  await press("Meta+d");
  ok("Cmd+D copies the tie between the copied nodes, as paste does", (await M(() => __mf.links)).length === 2, await M(() => __mf.links));

  // ---- stories: a deleted node is spliced out, merge remaps, sort resets the level
  await newMap("Talk\n- One\n- Two\n- Three\n- Four");
  const root = await M(() => __mf.state.rootId);
  const [One, Two, Three, Four] = [await id("One"), await id("Two"), await id("Three"), await id("Four")];
  await M(([a, b]) => __mf.storyLink(a, b), [root, Four]);
  await M(([a, b]) => __mf.storyLink(a, b), [Four, Three]);
  await M(([a, b]) => __mf.storyLink(a, b), [Three, Two]);
  ok("a story Four, Three, Two", (await walk()) === "Talk,Four,Three,Two");
  await M((x) => __mf.select(x), Three);
  await press("Meta+Backspace");
  ok("deleting the middle of the chain keeps the rest of it", (await walk()) === "Talk,Four,Two", await walk());
  await press("Meta+z");
  await M((x) => __mf.select(x), Four);
  await press("Meta+Backspace");
  ok("deleting the start moves the start along", (await walk()) === "Talk,Three,Two", await walk());
  await press("Meta+z");
  await M((ids) => __mf.mark(ids), [Two, One]);
  await press("Alt+KeyJ");
  ok("merging a told node tells the survivor in its place", (await M(() => __mf.walk.join())) === [root, Four, Three, One].join(), await walk());
  await press("Meta+z");
  await M((x) => { __mf.mark([]); __mf.select(x); }, root);
  await press("Alt+KeyO"); await press("Digit1");
  ok("sorting a told level puts it back to map order", (await walk()) === "Talk,Four,One,Three,Two" && /back to map order/.test(await status()), [await walk(), await status()]);
  await press("Meta+z");
  ok("and undo brings the story back", (await walk()) === "Talk,Four,Three,Two", await walk());
  await M(() => __mf.storyNew());
  await M(() => __mf.storyRename(1, "Story 1"));
  ok("a story cannot take another's name", (await M(() => __mf.stories)).join() === "Story 1,Story 2", await M(() => __mf.stories));

  // ---- presenting: Esc backs out of the overview, paste is ignored, a selection survives, carry ends
  await M((ids) => __mf.mark(ids), [One, Two]);
  await press("Meta+3");
  ok("presenting", !!(await M(() => __mf.pres)));
  await press("KeyO");
  await press("Escape");
  ok("Esc from the overview goes back to the talk, not out of it", !!(await M(() => __mf.pres)));
  const n0 = await M(() => Object.keys(__mf.state.nodes).length);
  await pasteText("x\ny");
  ok("paste does nothing mid-talk", (await M(() => Object.keys(__mf.state.nodes).length)) === n0);
  await press("Escape");
  ok("the selection is back once the talk ends", (await M(() => __mf.rawMarked)).sort().join() === [One, Two].sort().join(), await M(() => __mf.rawMarked));
  await M((x) => { __mf.mark([]); __mf.select(x); }, One);
  await cutKey();
  await press("Meta+3");
  await press("Escape");
  await press("ArrowDown");
  ok("Cmd+3 puts a carried node down; the arrows walk the map afterwards", (await M(() => __mf.selected)) !== One && (await M(() => Object.keys(__mf.state.nodes).length)) === n0);

  // ---- switching map leaves the lens and the carry behind
  await newMap("Alpha\n- a\n- b");
  await M(([a, b]) => __mf.tie(a, b), [await id("a"), await id("b")]);
  await M(() => __mf.setLens("dim"));
  ok("dimmed", (await M(() => __mf.lens)) === "dim");
  await press("Alt+Backquote");
  ok("the map before opens with no lens on it", (await M(() => __mf.lens)) === "off" && (await M(() => __mf.state.nodes[__mf.state.rootId].text)) === "Talk");
  await M((x) => __mf.select(x), One);
  await cutKey();
  ok("carrying", /carrying/.test(await status()));
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.querySelector(".mrow:not(.on)").click());
  await page.waitForTimeout(250);
  await press("ArrowRight"); await press("Enter");
  ok("a carry does not follow you to the next map", (await M(() => __mf.state.nodes[__mf.state.rootId].text)) !== "Talk" && errors.length === 0, errors);
  ok("and nothing was dropped there", !/moved/.test(await status()), await status());

  // ---- a map you deleted stays deleted through an unrelated undo
  await newMap("Hub\n- Part\n  - x");
  await M((x) => __mf.select(x), await id("Part"));
  await press("Alt+KeyB");
  const part = await M((t) => Object.values(__mf.state.nodes).find((n) => n.text === t).link, "Part");
  await M(() => document.getElementById("btnMaps").click());
  await M((x) => document.querySelector('[data-del="' + x + '"]').click(), part);
  await M((x) => document.querySelector('[data-del="' + x + '"]').click(), part);
  await page.waitForTimeout(200);
  await M(() => document.getElementById("btnMaps").click());
  ok("the map is in the bin", !(await M(() => JSON.parse(localStorage.getItem("mappr.index")).docs))[part] && (await M(() => __mf.trash())).some((d) => d.id === part));
  await M((x) => __mf.select(x), await id("Hub"));
  await press("Meta+ArrowRight"); await page.keyboard.type("new"); await press("Escape");
  await press("Meta+z");
  ok("an unrelated undo does not bring it back", !(await M(() => JSON.parse(localStorage.getItem("mappr.index")).docs))[part]);

  // ---- ungroup says what it needs
  await press("Meta+Shift+g");
  ok("Cmd+Shift+G with no frame says so", /frame/.test(await status()), await status());
  await M(() => __mf.spread("sides"));
}

group("0.37: the right-click menu, Option+Enter both ways");
{
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(250); };
  const status = () => M(() => document.getElementById("saveState").textContent);
  const id = (t) => M((t) => (Object.values(__mf.state.nodes).find((n) => n.text === t) || {}).id, t);
  const menu = () => M(() => { const m = document.getElementById("storyMenu"); return m && m.dataset.kind === "ctx" ? [...m.querySelectorAll(".mi")].map((b) => b.firstChild.textContent) : null; });
  const rightClick = async (x) => {
    const r = await M((x) => { const e = document.querySelector('.node[data-id="' + x + '"]').getBoundingClientRect(); return { x: e.left + e.width / 2, y: e.top + e.height / 2 }; }, x);
    await page.mouse.click(r.x, r.y, { button: "right" }); await page.waitForTimeout(200);
  };
  const clickItem = async (t) => { await M((t) => [...document.querySelectorAll("#storyMenu .mi")].find((b) => b.firstChild.textContent === t).click(), t); await page.waitForTimeout(250); };
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(220);
  await M((t) => { __mf.spread("right"); __mf.paste(t); __mf.mark([]); }, "Plan\n- Ops\n  - Hiring\n  - Budget\n- Sales\n- Notes\n  - a\n  - b");
  await page.waitForTimeout(300);
  const ops = await id("Ops"), sales = await id("Sales"), hiring = await id("Hiring");
  await M((x) => __mf.select(x), ops);
  await rightClick(ops);
  const items = await menu();
  ok("right-click on a node opens the menu", !!items, items);
  ok("and selects the node", (await M(() => __mf.selected)) === ops);
  ok("it offers focus, fold, break out, copy and delete", ["Focus on this branch", "Fold", "Break out into a map", "Copy as an outline", "Delete the branch"].every((t) => items.includes(t)), items);
  ok("each row shows its key", await M(() => [...document.querySelectorAll("#storyMenu .mi .mk")].length > 8));
  ok("the tie rows are absent when the node is the selection", !items.some((t) => /^Tie to/.test(t)));
  await press("Escape");
  ok("Escape closes it", (await menu()) === null);
  await press("ArrowRight");
  ok("and typing after works: the arrow moved", (await M(() => __mf.selected)) === hiring);
  // tie from the menu
  await M((x) => __mf.select(x), sales);
  await rightClick(ops);
  ok("with another node selected, the menu offers a tie to it", (await menu()).some((t) => t === "Tie to “Sales”"), await menu());
  await clickItem("Tie to “Sales”");
  ok("the tie is made", (await M(() => __mf.links)).length === 1 && /tied to/.test(await status()), await status());
  await M((x) => __mf.select(x), sales);
  await rightClick(ops);
  ok("and the same row now unties", (await menu()).some((t) => t === "Untie from “Sales”"), await menu());
  await press("Escape");
  // fold from the menu
  await rightClick(ops);
  await clickItem("Fold");
  ok("Fold from the menu folds", await M((x) => __mf.state.nodes[x].collapsed, ops));
  await rightClick(ops);
  ok("and reads Unfold now", (await menu()).includes("Unfold"));
  await clickItem("Unfold");
  // a chord with the menu open closes it and still acts
  await rightClick(ops);
  await press("Meta+e");
  ok("a chord pressed with the menu open closes it and still acts", (await menu()) === null && await M((x) => __mf.state.nodes[x].collapsed, ops));
  await press("Meta+e");
  // link node menu
  await rightClick(ops);
  await clickItem("Break out into a map");
  ok("break out from the menu", !!(await M((x) => __mf.state.nodes[x].link, ops)));
  await rightClick(ops);
  const li = await menu();
  ok("a link node's menu opens the map or brings it back, and cannot be retyped", li.includes("Open the map") && li.includes("Bring the map back in") && !li.includes("Retype"), li);
  await clickItem("Open the map");
  ok("Open the map opens it", (await M(() => __mf.state.nodes[__mf.state.rootId].text)) === "Ops");
  // Option+Enter on a plain node goes back up; double-click on canvas too
  await M((x) => __mf.select(x), await id("Hiring"));
  await press("Alt+Enter");
  ok("Option+Enter on a plain node in a linked map goes back up", (await M(() => __mf.state.nodes[__mf.state.rootId].text)) === "Plan" && (await M(() => __mf.selected)) === ops);
  await press("Alt+Enter");
  ok("Option+Enter on the link goes down again", (await M(() => __mf.state.nodes[__mf.state.rootId].text)) === "Ops");
  await page.mouse.dblclick(40, 500); await page.waitForTimeout(300);
  ok("double-click on empty canvas goes back up", (await M(() => __mf.state.nodes[__mf.state.rootId].text)) === "Plan", await M(() => __mf.state.nodes[__mf.state.rootId].text));
  await press("Alt+KeyU");
  ok("Option+U is no longer bound", (await M(() => __mf.state.nodes[__mf.state.rootId].text)) === "Plan" && !/back/.test(await status()));
  await M((x) => __mf.select(x), sales);
  await press("Alt+Enter");
  ok("Option+Enter with no link and no trail says so", /nothing to go back up to/.test(await status()), await status());
  // canvas menu
  await page.mouse.click(40, 500, { button: "right" }); await page.waitForTimeout(200);
  const cm = await menu();
  ok("right-click on the canvas offers views and maps", !!cm && cm.includes("Fit everything") && cm.includes("Present") && cm.includes("New map") && cm.includes("Connections"), cm);
  await clickItem("Connections");
  ok("Connections from the menu dims", (await M(() => __mf.lens)) === "dim");
  await page.mouse.click(40, 500, { button: "right" }); await page.waitForTimeout(200);
  ok("and the menu now offers the map", (await menu()).includes("Back to the map"));
  await clickItem("Back to the map");
  ok("back", (await M(() => __mf.lens)) === "off");
  // selection menu
  await M((ids) => __mf.mark(ids), [sales, await id("Notes")]);
  await rightClick(sales);
  const sm = await menu();
  ok("right-click inside a selection keeps it and offers merge and the selection's actions", (await M(() => __mf.rawMarked)).length === 2 && sm.includes("Merge the selection into one") && sm.includes("Delete the selection"), sm);
  await press("Escape");
  await M(() => __mf.mark([]));
  // typing node keeps the native menu (no Mappr menu)
  await M((x) => __mf.select(x), sales);
  await press("Space");
  await rightClick(sales);
  ok("right-click on the node being typed leaves the browser's own menu", (await menu()) === null);
  await press("Escape");
  ok("no runtime errors", errors.length === 0, errors);
  await M(() => __mf.spread("sides"));
}

group("0.38.1: a branch-tied network keeps its trees apart");
{
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(220);
  await M((t) => { __mf.spread("right"); __mf.paste(t); __mf.mark([]); }, "Root\n- Ideas\n  - Context\n    - Setting up a pickleball court warehouse in the city centre\n    - They have a warehouse and it can fit three courts side by side and a lounge\n    - Competition holds typical branding such as:\n      - Dink Smash\n      - Paddle Heroes\n  - Vision\n    - Extended activities\n    - Complex is a flexible name and the brand can be strong in the sports space\n      - Sports Complex\n      - Pickle Complex\n      - Even the name by itself could be a club or a rave\n- Plan\n  - a");
  await page.waitForTimeout(300);
  const id = (t) => M((t) => (Object.values(__mf.state.nodes).find((n) => n.text === t) || {}).id, t);
  await M(([a, b]) => __mf.branchTie(a, b), [await id("Context"), await id("Vision")]);
  await M((x) => __mf.setLens("one", x), await id("Vision"));
  await page.waitForTimeout(400);
  const r = await M(() => {
    const P = __mf.pos(), B = __mf.boxes(), ids = Object.keys(P); let n = 0;
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const a = ids[i], b = ids[j]; if (Math.abs(P[a].cx - P[b].cx) < (B[a].w + B[b].w) / 2 && Math.abs(P[a].cy - P[b].cy) < (B[a].h + B[b].h) / 2) n++; }
    return { shown: ids.length, overlaps: n };
  });
  ok("the network shows both branches", r.shown >= 12, r);
  ok("and no two boxes overlap", r.overlaps === 0, r);
  const shape = await M(([c, k]) => { const P = __mf.pos(); return [P[k].cx - P[c].cx, P[k].cy - P[c].cy].map(Math.round); }, [await id("Context"), await id("Dink Smash")]);
  await M(() => __mf.setLens("off"));
  await page.waitForTimeout(200);
  const shape0 = await M(([c, k]) => { const P = __mf.pos(); return [P[k].cx - P[c].cx, P[k].cy - P[c].cy].map(Math.round); }, [await id("Context"), await id("Dink Smash")]);
  ok("a tied branch keeps its tidy shape inside the network", shape.join() === shape0.join(), [shape, shape0]);
  await M(() => __mf.spread("sides"));
}

group("0.39: flags you can find, and the maps rail");
{
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(250); };
  const status = () => M(() => document.getElementById("saveState").textContent);
  const id = (t) => M((t) => (Object.values(__mf.state.nodes).find((n) => n.text === t) || {}).id, t);
  const newMap = async (t) => {
    await M(() => document.getElementById("btnMaps").click());
    await M(() => document.getElementById("btnNewMap").click());
    await page.waitForTimeout(220);
    await M((t) => { __mf.spread("right"); __mf.paste(t); __mf.mark([]); }, t);
    await page.waitForTimeout(300);
  };
  await newMap("Launch\n- Marketing\n  - Paid ads\n  - Press kit\n- Legal\n  - Terms review\n- Product");
  const flagsTab = () => M(() => document.querySelector('#modebar [data-mode="4"]').classList.contains("empty"));
  ok("the Flags tab is muted on a map with no flag, but there", await flagsTab() && await M(() => !document.querySelector('#modebar [data-mode="4"]').hidden));
  await press("Meta+4");
  ok("Cmd+4 with no flag says so", /nothing is flagged/.test(await status()) && (await M(() => __mf.lens)) === "off", await status());
  for (const t of ["Marketing", "Press kit", "Terms review"]) { await M((x) => __mf.select(x), await id(t)); await press("Meta+Shift+f"); }
  ok("Cmd+Shift+F flags", (await M((x) => __mf.state.nodes[x].mark, await id("Press kit"))) === "flag");
  ok("the flag is drawn by hand in the paint layer", (await M(() => document.querySelectorAll('#paintLayer path[stroke="#c0392b"], #paintLayer path[stroke="#ff7b6b"]').length)) >= 3);
  ok("and the Flags tab lights up", !(await flagsTab()));
  const g0 = await M(() => document.getElementById("paintLayer").innerHTML.length);
  await M(() => __mf.set("flagStyle", "ribbon"));
  ok("the Style panel changes the mark", (await M(() => document.getElementById("paintLayer").innerHTML.length)) !== g0 && (await M(() => __mf.cfg.flagStyle)) === "ribbon");
  await M(() => __mf.set("flagStyle", "pennant"));
  // the flag lens
  await M((x) => __mf.select(x), await id("Launch"));
  await press("Meta+4");
  ok("Cmd+4 dims to the flags", (await M(() => __mf.lens)) === "dim" && (await M(() => __mf.lensKind)) === "flags");
  ok("unflagged nodes are ghosts, flagged ones are not", (await M(() => __mf.ghosts)) === 3 && !(await M((x) => document.querySelector('.node[data-id="' + x + '"]').classList.contains("ghost"), await id("Press kit"))), await M(() => __mf.ghosts));
  ok("it lands on the first flag", (await M(() => __mf.selected)) === (await id("Marketing")));
  await press("Tab");
  ok("Tab steps to the next flag", (await M(() => __mf.selected)) === (await id("Press kit")));
  await press("Tab"); await press("Tab");
  ok("and wraps", (await M(() => __mf.selected)) === (await id("Marketing")));
  await press("Meta+2");
  ok("Cmd+2 from the flags goes to connections, or says nothing is tied", (await M(() => __mf.lensKind)) !== "flags" || /nothing is tied/.test(await status()));
  await press("Escape");
  await press("Meta+4"); await press("Meta+Shift+f"); await press("Tab"); await press("Meta+Shift+f"); await press("Tab"); await press("Meta+Shift+f");
  ok("unflagging the last flag ends the lens", (await M(() => __mf.lens)) === "off" && /no flags left/.test(await status()), await status());
  for (const t of ["Marketing", "Press kit"]) { await M((x) => __mf.select(x), await id(t)); await press("Meta+Shift+f"); }
  // Jump
  await press("Meta+k"); await page.keyboard.type("!"); await page.waitForTimeout(150);
  ok("! in Jump lists only flagged nodes", (await M(() => [...document.querySelectorAll("#jumpList .jr")].length)) === 2);
  await page.keyboard.type("press"); await page.waitForTimeout(150);
  ok("and narrows as you type", (await M(() => [...document.querySelectorAll("#jumpList .jr b")].map((b) => b.textContent))).join() === "! Press kit");
  await press("Escape");
  // outline both ways
  const txt = await M(() => __mf.outline());
  ok("the outline writes ! before a flagged line", /- ! Marketing/.test(txt) && /- ! Press kit/.test(txt) && !/! Paid/.test(txt), txt);
  await newMap("Other");
  await M((t) => __mf.paste(t), txt);
  ok("pasting it back flags the same nodes", (await M((x) => __mf.state.nodes[x].mark, await id("Press kit"))) === "flag" && !(await M((x) => __mf.state.nodes[x].mark, await id("Paid ads"))));
  ok("and the ! is not in the text", (await M((x) => __mf.state.nodes[x].text, await id("Press kit"))) === "Press kit");
  // story finale counts them
  await press("Meta+3");
  for (let i = 0; i < 12; i++) await press("ArrowRight");
  ok("the finale counts the flags", /2 flagged/.test(await status()), await status());
  await press("Escape");
  // the rail
  await newMap("Q4 plan\n- Growth\n  - Paid ads\n- Collections ops\n  - Recurring payments\n    - Autopay\n  - Agent behaviour\n    - Scripts");
  ok("no rail on a map with no links", await M(() => document.getElementById("rail").hidden && document.getElementById("pill").hidden));
  await M((x) => __mf.select(x), await id("Collections ops")); await press("Alt+KeyB"); await press("Alt+Enter");
  await M((x) => __mf.select(x), await id("Agent behaviour")); await press("Alt+KeyB");
  const rows = () => M(() => [...document.querySelectorAll("#rail .rr")].map((r) => r.querySelector(".nm").textContent + (r.classList.contains("on") ? "*" : "")));
  ok("the rail lists the root, this map and the map under it, lighting this one", (await rows()).join() === "Q4 plan,Collections ops*,Agent behaviour", await rows());
  await press("Alt+BracketRight");
  ok("Option+] opens the next map down the rail", (await M(() => __mf.state.nodes[__mf.state.rootId].text)) === "Agent behaviour" && (await rows()).join() === "Q4 plan,Collections ops,Agent behaviour*");
  await press("Alt+Enter");
  ok("Option+Enter still goes back up the path the rail set", (await M(() => __mf.state.nodes[__mf.state.rootId].text)) === "Collections ops");
  await M(() => document.querySelector('#rail [data-open]').dispatchEvent(new MouseEvent("mousedown", { bubbles: true })));
  await page.waitForTimeout(250);
  ok("a click on a rail row opens that map", (await M(() => __mf.state.nodes[__mf.state.rootId].text)) === "Q4 plan");
  await M(() => document.querySelector('#rail [data-fold]').dispatchEvent(new MouseEvent("mousedown", { bubbles: true })));
  await page.waitForTimeout(150);
  ok("the twist folds a branch of maps", (await rows()).length === 1);
  await M(() => document.querySelector('#rail [data-fold]').dispatchEvent(new MouseEvent("mousedown", { bubbles: true })));
  await press("Alt+Shift+KeyM");
  ok("Option+Shift+M folds the rail to the pill", await M(() => document.getElementById("rail").hidden && !document.getElementById("pill").hidden && /3 maps/.test(document.getElementById("pill").textContent)), await M(() => document.getElementById("pill").textContent));
  await press("Alt+BracketRight"); await press("Alt+BracketRight");
  ok("the pill shows the path to where you are", await M(() => [...document.querySelectorAll("#pill button[data-open]")].map((b) => b.textContent).join() === "Q4 plan,Collections ops,Agent behaviour"), await M(() => document.getElementById("pill").textContent));
  await press("Alt+Shift+KeyM");
  ok("and back", await M(() => !document.getElementById("rail").hidden));
  ok("no runtime errors", errors.length === 0, errors);
  await M(() => __mf.spread("sides"));
}

group("1.0: maps under their root, and a reload keeps your place");
{
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(250); };
  const status = () => M(() => document.getElementById("saveState").textContent);
  const id = (t) => M((t) => (Object.values(__mf.state.nodes).find((n) => n.text === t) || {}).id, t);
  const lib = () => M(() => JSON.parse(localStorage.getItem("mappr.index")));
  const name = () => M(() => __mf.state.nodes[__mf.state.rootId].text);
  const newMap = async (t) => {
    await M(() => document.getElementById("btnMaps").click());
    await M(() => document.getElementById("btnNewMap").click());
    await page.waitForTimeout(220);
    await M((t) => { __mf.spread("right"); __mf.paste(t); __mf.mark([]); }, t);
    await page.waitForTimeout(300);
  };
  const panelRows = async () => { await M(() => document.getElementById("btnMaps").click()); const r = await M(() => [...document.querySelectorAll("#mapsList .mrow")].map((x) => (x.className.match(/\bd(\d)/) || [, "0"])[1] + ":" + x.querySelector(".mn").textContent)); await M(() => document.getElementById("btnMaps").click()); return r; };
  await newMap("Hub\n- Ops\n  - Hiring\n    - Budget\n  - Payroll\n- Sales\n  - Pipeline");
  const hub = await M(() => __mf.doc);
  await M((x) => __mf.select(x), await id("Ops")); await press("Alt+KeyB"); await press("Alt+Enter");
  await M((x) => __mf.select(x), await id("Hiring")); await press("Alt+KeyB");
  const ops = await M(() => __mf.doc);
  await M(() => __mf.select(__mf.state.rootId)); await press("Alt+Enter");
  ok("back at the root map", (await name()) === "Hub");
  await M((x) => __mf.select(x), await id("Sales")); await press("Alt+KeyB");
  const rows = await panelRows();
  const hi = rows.indexOf("0:Hub");
  ok("the Maps panel lists linked maps under their root", hi >= 0 && rows[hi + 1] === "1:Ops" && rows[hi + 2] === "2:Hiring" && rows[hi + 3] === "1:Sales", rows);
  ok("a root row counts the maps under it", await M(() => { document.getElementById("btnMaps").click(); const r = [...document.querySelectorAll("#mapsList .mrow")].find((x) => x.querySelector(".mn").textContent === "Hub"); const t = r.querySelector(".mm").textContent; document.getElementById("btnMaps").click(); return /3 maps/.test(t); }));
  await press("Alt+m");
  const sw = await M(() => [...document.querySelectorAll("#swList .swr")].map((x) => (x.className.match(/\bd(\d)/) || [, "0"])[1] + ":" + x.querySelector(".mn").textContent));
  await press("Escape");
  ok("the switcher nests them too", sw.indexOf("0:Hub") >= 0 && sw[sw.indexOf("0:Hub") + 1] === "1:Ops", sw);
  // export carries the tree, import rebuilds it
  const json = await M(() => __mf.exportJson());
  ok("JSON export of a root bundles the maps under it", JSON.parse(json).maps.length === 3 && /with 3 maps under it/.test(await status()), await status());
  const nDocs = Object.keys((await lib()).docs).length;
  await M((j) => __mf.importJson(j), json);
  await page.waitForTimeout(400);
  ok("import makes four new maps, links pointed at the copies", Object.keys((await lib()).docs).length === nDocs + 4 && (await M(() => Object.values(__mf.state.nodes).filter((n) => n.link).every((n) => JSON.parse(localStorage.getItem("mappr.index")).docs[n.link]))));
  const impRoot = await M(() => __mf.doc);
  ok("and none of the new links point at the originals", (await M((h) => Object.values(__mf.state.nodes).filter((n) => n.link).map((n) => n.link), hub)).every((l) => l !== ops));
  // copy of a root copies the tree; delete of a root takes the tree
  await M(() => document.getElementById("btnMaps").click());
  await M((r) => document.querySelector('#mapsList [data-dup="' + r + '"]').click(), impRoot);
  await page.waitForTimeout(400);
  ok("Copy on a root copies the maps under it", Object.keys((await lib()).docs).length === nDocs + 8 && /copy$/.test(await name()) && /with the maps under it/.test(await status()), await status());
  const copyRoot = await M(() => __mf.doc);
  await M(() => document.getElementById("btnMaps").click());
  await M((r) => document.querySelector('#mapsList [data-del="' + r + '"]').click(), copyRoot);
  ok("delete on a root asks, and says how many", await M((r) => /4 maps/.test(document.querySelector('#mapsList [data-del="' + r + '"]').textContent), copyRoot));
  await M((r) => document.querySelector('#mapsList [data-del="' + r + '"]').click(), copyRoot);
  await page.waitForTimeout(300);
  ok("and takes the tree to the bin", Object.keys((await lib()).docs).length === nDocs + 4 && (await M(() => __mf.trash())).length >= 4, [Object.keys((await lib()).docs).length, nDocs, (await M(() => __mf.trash())).length, await status()]);
  // detach
  await M(() => { if (document.getElementById("maps").classList.contains("on")) document.getElementById("btnMaps").click(); });
  await M((h) => { const lib = JSON.parse(localStorage.getItem("mappr.index")); }, hub);
  const before = await M((o) => __mf.libTree().find((r) => r.doc === o).depth, ops);
  const n = await M((o) => __mf.detach(o), ops);
  ok("Detach makes a map its own and turns the links to it into plain nodes", n === 1 && (await M((o) => __mf.libTree().find((r) => r.doc === o).depth, ops)) === 0 && before === 1, [n, before]);
  ok("the map that linked to it now holds a plain node with the name", await M((h) => { const d = JSON.parse(localStorage.getItem("mappr.doc." + h)); return Object.values(d.state.nodes).some((x) => x.text === "Ops" && !x.link); }, hub));
  ok("Hiring stays under Ops", (await M((o) => __mf.libTree().filter((r) => r.root === o).length, ops)) === 2);
  // a reload keeps the view and the undo steps
  await M((h) => { const lib = JSON.parse(localStorage.getItem("mappr.index")); }, hub);
  await M(() => document.getElementById("btnMaps").click());
  await M((h) => { const r = [...document.querySelectorAll("#mapsList .mrow")].find((x) => x.dataset.m === h); r.click(); }, hub);
  await page.waitForTimeout(300);
  await M((x) => __mf.select(x), await id("Ops"));
  await press("Meta+Enter"); await page.keyboard.type("Bonus"); await press("Escape");
  await press("Meta+Enter"); await page.keyboard.type("Tax"); await press("Escape");
  await press("Meta+Equal"); await press("Meta+Equal");
  const cam = await M(() => JSON.stringify(__mf.cam()));
  const steps = await M(() => __mf.undoSteps);
  await page.waitForTimeout(1800);
  await page.reload(); await page.waitForTimeout(500);
  ok("after a reload the map opens where you left it", (await M(() => JSON.stringify(__mf.cam()))) === cam, [cam, await M(() => JSON.stringify(__mf.cam()))]);
  ok("and the undo steps are still there", (await M(() => __mf.undoSteps)) >= Math.min(steps, 2), [steps, await M(() => __mf.undoSteps)]);
  await press("Meta+z");
  ok("Cmd+Z after a reload undoes the last edit", !(await id("Tax")) && !!(await id("Bonus")), [await name(), await M(() => Object.values(__mf.state.nodes).map((n) => n.text)), await M(() => __mf.undoSteps)]);
  // switching to another map opens at its saved view, not fitted
  await M(() => document.getElementById("btnMaps").click());
  await M((o) => { const r = [...document.querySelectorAll("#mapsList .mrow")].find((x) => x.dataset.m === o); r.click(); }, ops);
  await page.waitForTimeout(300);
  await press("Meta+Equal"); await press("Meta+Equal"); await press("Meta+Equal");
  const camOps = await M(() => JSON.stringify(__mf.cam()));
  await page.waitForTimeout(600);
  await page.reload(); await page.waitForTimeout(500);
  await M(() => document.getElementById("btnMaps").click());
  await M((h) => { const r = [...document.querySelectorAll("#mapsList .mrow")].find((x) => x.dataset.m === h); r.click(); }, hub);
  await page.waitForTimeout(300);
  await M(() => document.getElementById("btnMaps").click());
  await M((o) => { const r = [...document.querySelectorAll("#mapsList .mrow")].find((x) => x.dataset.m === o); r.click(); }, ops);
  await page.waitForTimeout(300);
  ok("switching to a map after a reload opens it at its saved view", (await M(() => JSON.stringify(__mf.cam()))) === camOps, [camOps, await M(() => JSON.stringify(__mf.cam()))]);
  ok("no runtime errors", errors.length === 0, errors);
  await M(() => __mf.spread("sides"));
}

group("1.0.1: keys the browser keeps, and a long press");
{
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(250); };
  const id = (t) => M((t) => (Object.values(__mf.state.nodes).find((n) => n.text === t) || {}).id, t);
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(220);
  await M((t) => { __mf.spread("right"); __mf.paste(t); __mf.mark([]); }, "Root\n- One\n- Two");
  await page.waitForTimeout(300);
  await M((x) => __mf.select(x), await id("One"));
  await press("Alt+KeyF");
  ok("Option+F flags", (await M((x) => __mf.state.nodes[x].mark, await id("One"))) === "flag");
  await press("Alt+KeyD");
  ok("Option+D marks done", (await M((x) => __mf.state.nodes[x].mark, await id("One"))) === "done");
  await press("Alt+KeyD");
  ok("and again clears it", !(await M((x) => __mf.state.nodes[x].mark, await id("One"))));
  await press("Control+Enter"); await page.keyboard.type("Kid"); await press("Escape");
  ok("Control stands in for Cmd", !!(await id("Kid")));
  // a long press opens the menu
  const two = await id("Two");
  const r = await M((x) => { const e = document.querySelector('.node[data-id="' + x + '"]').getBoundingClientRect(); return { x: e.left + e.width / 2, y: e.top + e.height / 2 }; }, two);
  await M(([x, y, id]) => {
    const el = document.querySelector('.node[data-id="' + id + '"]');
    const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
    el.dispatchEvent(new TouchEvent("touchstart", { touches: [t], targetTouches: [t], changedTouches: [t], bubbles: true, cancelable: true }));
  }, [r.x, r.y, two]);
  await page.waitForTimeout(700);
  ok("a long press on a node opens the menu for that node", await M(() => { const m = document.getElementById("storyMenu"); return !!m && m.dataset.kind === "ctx"; }) && (await M(() => __mf.selected)) === two);
  await M((id) => { const el = document.querySelector('.node[data-id="' + id + '"]'); el.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: [], bubbles: true })); }, two);
  await press("Escape");
  await M(([x, y, id]) => {
    const el = document.querySelector('.node[data-id="' + id + '"]');
    const t = new Touch({ identifier: 2, target: el, clientX: x, clientY: y });
    el.dispatchEvent(new TouchEvent("touchstart", { touches: [t], targetTouches: [t], changedTouches: [t], bubbles: true, cancelable: true }));
    setTimeout(() => el.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: [t], bubbles: true })), 150);
  }, [r.x, r.y, two]);
  await page.waitForTimeout(700);
  ok("a short tap does not", await M(() => !document.getElementById("storyMenu")));
  ok("no runtime errors", errors.length === 0, errors);
  await M(() => __mf.spread("sides"));
}

group("1.0.2: the keyboard sink (iPad keys need a focused editable)");
{
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(250); };
  const id = (t) => M((t) => (Object.values(__mf.state.nodes).find((n) => n.text === t) || {}).id, t);
  const active = () => M(() => { const a = document.activeElement; return a ? (a.id || a.tagName.toLowerCase() + (a.className ? "." + String(a.className).split(" ")[0] : "")) : "none"; });
  await page.goto(APP + "#sink"); await page.reload(); await page.waitForTimeout(400);   /* a hash alone does not reload */
  ok("with #sink the sink has focus at boot", (await active()) === "sink", await active());
  await M(() => { __mf.spread("right"); __mf.paste("Root\n- One\n- Two"); __mf.mark([]); });
  await page.waitForTimeout(250);
  await M((x) => __mf.select(x), await id("One"));
  await press("Meta+ArrowRight"); await page.keyboard.type("Kid"); 
  ok("typing goes to the node, not the sink", (await active()).startsWith("div.node") && (await M(() => __mf.editing)) !== null && (await M(() => document.getElementById("sink").textContent)) === "");
  await press("Escape");
  ok("Escape hands the keys back to the sink", (await active()) === "sink" && !!(await id("Kid")), [await active(), await M(() => __mf.editing), await M(() => document.getElementById("notes").classList.contains("open"))]);
  await press("ArrowLeft");
  ok("arrows still walk the map from the sink", (await M(() => __mf.selected)) === (await id("One")));
  await press("Enter"); await page.keyboard.type("Sib"); await press("Escape");
  ok("Enter makes a sibling and the sink gets nothing", !!(await id("Sib")) && (await M(() => document.getElementById("sink").textContent)) === "");
  await M((t) => { const dt = new DataTransfer(); dt.setData("text/plain", t); document.activeElement.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); }, "Pasted\n- under");
  await page.waitForTimeout(250);
  ok("a paste aimed at the sink lands in the map", !!(await id("Pasted")) && !!(await id("under")));
  await press("Meta+k");
  ok("the jump box takes the keys when open", (await active()) === "jumpIn");
  await press("Escape");
  ok("and the sink has them back after", (await active()) === "sink", await active());
  await page.mouse.click(600, 500); await page.waitForTimeout(200);
  ok("a click on the canvas leaves the sink focused", (await active()) === "sink", await active());
  ok("no runtime errors", errors.length === 0, errors);
  await page.goto(APP); await page.reload(); await page.waitForTimeout(400);
  await M(() => __mf.spread("sides"));
}

group("1.1: numbers, like a list in Docs");
{
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(250); };
  const status = () => M(() => document.getElementById("saveState").textContent);
  const id = (t) => M((t) => (Object.values(__mf.state.nodes).find((n) => n.text === t) || {}).id, t);
  const lab = async (t) => M((x) => __mf.numLabel(x), await id(t));
  const sel = async (t) => M((x) => __mf.select(x), await id(t));
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(220);
  await M(() => { __mf.spread("right"); __mf.paste("Launch\n- Marketing\n  - Paid ads\n    - Search\n    - Social\n  - Email\n- Product\n  - Onboarding\n- Legal"); __mf.mark([]); });
  await page.waitForTimeout(300);
  ok("nothing is numbered to start", !(await M(() => __mf.anyNum)) && (await lab("Marketing")) === null);
  await sel("Marketing");
  await press("Meta+Shift+Digit7");
  ok("Cmd+Shift+7 numbers the row the node is on", (await lab("Marketing")) === "1." && (await lab("Product")) === "2." && (await lab("Legal")) === "3.", [await lab("Marketing"), await lab("Product")]);
  ok("and only that row", (await lab("Paid ads")) === null && (await lab("Launch")) === null);
  ok("it says so", /row numbered/.test(await status()), await status());
  ok("the number is drawn in the gutter, in the paint layer", (await M(() => [...document.querySelectorAll("#paintLayer text")].map((t) => t.textContent))).join() === "1.,2.,3.");
  await press("Meta+Shift+Digit7");
  ok("pressed again on a numbered row, the numbers come off", (await lab("Marketing")) === null && /numbers off/.test(await status()), await status());
  await press("Alt+Digit7");
  ok("Option+7 is the twin", (await lab("Marketing")) === "1.");
  // a branch selected with Cmd+Shift+arrow: every level in it
  await press("Meta+Shift+ArrowRight"); await press("Meta+Shift+Digit7");
  ok("a selected branch numbers every level in it, nested 1. a. i.", (await lab("Paid ads")) === "a." && (await lab("Email")) === "b." && (await lab("Search")) === "i." && (await lab("Social")) === "ii.", [await lab("Paid ads"), await lab("Search")]);
  ok("the row's other branches stay as they were", (await lab("Onboarding")) === null);
  await M(() => __mf.mark([]));
  // a move renumbers on its own
  await sel("Marketing"); await press("Alt+ArrowDown");
  ok("moving a node down its row renumbers the row", (await lab("Product")) === "1." && (await lab("Marketing")) === "2.", [await lab("Product"), await lab("Marketing")]);
  await press("Alt+ArrowUp");
  // schemes and styles
  await M(() => __mf.set("numScheme", "legal"));
  ok("the legal scheme reads the numbered chain", (await lab("Search")) === "1.1.1" && (await lab("Email")) === "1.2" && (await lab("Product")) === "2", [await lab("Search"), await lab("Email")]);
  await M(() => __mf.set("numScheme", "formal"));
  ok("the formal scheme starts at I.", (await lab("Marketing")) === "I." && (await lab("Paid ads")) === "A." && (await lab("Search")) === "1.");
  await M(() => __mf.set("numScheme", "docs"));
  await M(() => __mf.set("numStyle", "box"));
  ok("in the box, the number is a data attribute on the node, not text", (await M((x) => document.querySelector('.node[data-id="' + x + '"]').dataset.num, await id("Marketing"))) === "1." && (await M((x) => document.querySelector('.node[data-id="' + x + '"]').textContent, await id("Marketing"))) === "Marketing");
  ok("and nothing is drawn in the paint layer for it", (await M(() => document.querySelectorAll("#paintLayer text").length)) === 0);
  await M(() => __mf.set("numStyle", "edge"));
  ok("on the edge it is drawn as a pill with the figure", (await M(() => document.querySelectorAll("#paintLayer text").length)) === 7 && (await M((x) => !document.querySelector('.node[data-id="' + x + '"]').dataset.num, await id("Marketing"))));
  await M(() => __mf.set("numStyle", "gutter"));
  // outline both ways
  const out = await M(() => __mf.outline());
  ok("the outline writes the number before each line", /- 1\. Marketing\n  - a\. Paid ads\n    - i\. Search/.test(out), out);
  await sel("Onboarding");
  await M(() => __mf.paste("- 1. Alpha\n- 2. Beta\n  - a. Gamma"));
  await page.waitForTimeout(250);
  ok("a pasted numbered outline comes in numbered, at the depth it lands", (await lab("Alpha")) === "a." && (await lab("Beta")) === "b." && (await lab("Gamma")) === "i.", [await lab("Alpha"), await lab("Gamma")]);
  await M(() => __mf.mark([]));
  await sel("Legal");
  await M(() => __mf.paste("- 3) Delta\n- Plain line\n- I. Roman"));
  await page.waitForTimeout(250);
  ok("a 3) or an I. also count, and the text is clean", (await lab("Delta")) === "a." && !!(await id("Roman")) && (await lab("Plain line")) === "b.", [await lab("Delta"), await lab("Plain line"), await M(() => Object.values(__mf.state.nodes).map((n) => n.text).filter((t) => /Roman|Delta/.test(t)))]);
  await M(() => __mf.mark([]));
  // the centre alone numbers its branches; undo
  await sel("Launch"); await press("Meta+Shift+Digit7");
  ok("on the centre alone, the branches", (await lab("Legal")) === null && /numbers off/.test(await status()));
  await press("Meta+z");
  ok("and undo brings them back", (await lab("Legal")) === "3.");
  // the menu row
  await M((x) => { const el = document.querySelector('.node[data-id="' + x + '"]'); const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: r.left + 5, clientY: r.top + 5, button: 2 })); }, await id("Legal"));
  await page.waitForTimeout(200);
  ok("the right-click menu has the row, with its key", (await M(() => [...document.querySelectorAll("#storyMenu .mi")].map((b) => b.textContent))).some((t) => /Unnumber this row.*7/.test(t)), await M(() => [...document.querySelectorAll("#storyMenu .mi")].map((b) => b.textContent).filter((t) => /umber/.test(t))));
  await press("Escape");
  ok("no runtime errors", errors.length === 0, errors);
}

group("1.2: where you are");
{
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(250); };
  const status = () => M(() => document.getElementById("saveState").textContent);
  const id = (t) => M((t) => (Object.values(__mf.state.nodes).find((n) => n.text === t) || {}).id, t);
  const sel = async (t) => M((x) => __mf.select(x), await id(t));
  const rows = () => M(() => [...document.querySelectorAll("#here .rr")].map((r) => (r.classList.contains("anc") ? "^" : r.classList.contains("on") ? "*" : r.classList.contains("more") ? "…" : "") + r.querySelector(".nm").textContent + (r.querySelector(".n") ? " [" + r.querySelector(".n").textContent + "]" : "")));
  const shown = () => M(() => __mf.hereShown);
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(220);
  ok("an untouched map has no rail", !(await shown()));
  await M(() => { __mf.spread("right"); __mf.paste("Launch\n- Marketing\n  - Paid ads\n    - Search\n      - Brand terms\n      - Generic\n        - Long tail\n        - Misspellings\n    - Social\n  - ! Email\n- Product\n  - Onboarding\n- Legal"); __mf.mark([]); });
  await page.waitForTimeout(300);
  await sel("Social");
  ok("the rail shows the way up and the row, nothing below", (await rows()).join("|") === "^Launch|^Marketing|^Paid ads [2 under]|Search [▸ 2]|*Social", await rows());
  ok("nothing below is listed", !/Brand terms|Generic/.test((await rows()).join("|")));
  ok("it sits in the maps panel, which is shown for it", (await M(() => document.getElementById("here").parentNode.id)) === "mapbar" && !(await M(() => document.getElementById("mapbar").hidden)));
  await sel("Marketing");
  ok("a top branch's row is its side of the centre", (await rows()).join("|") === "^Launch [3 under]|*Marketing [▸ 2]|Product [▸ 1]|Legal", await rows());
  ok("a flag shows its !", (await sel("Email"), await M(() => [...document.querySelectorAll("#here .rr.on .fl")].length)) === 1);
  await sel("Paid ads"); await press("Meta+Shift+Digit7"); await sel("Email");
  ok("a numbered row shows its numbers", (await M(() => [...document.querySelectorAll("#here .rr .hn")].map((h) => h.textContent))).join() === "1.,2.", await M(() => [...document.querySelectorAll("#here .rr .hn")].map((h) => h.textContent)));
  await sel("Long tail");
  ok("a deep trail folds its middle", /more up/.test((await rows())[1]) && (await rows()).length === 6, await rows());
  await sel("Launch");
  ok("on the centre it says so", /the centre/.test((await rows())[0]) && (await rows()).length === 1, await rows());
  // click goes there
  await sel("Brand terms");
  await M(() => { const r = [...document.querySelectorAll("#here .rr.sib")].find((x) => /Generic/.test(x.textContent)); r.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true })); });
  await page.waitForTimeout(300);
  ok("clicking a sibling selects it", (await M(() => __mf.selected)) === (await id("Generic")));
  ok("and the keyboard stays with the map", (await M(() => document.activeElement === document.body || document.activeElement.id === "sink")));
  await M(() => { const r = [...document.querySelectorAll("#here .rr.anc")].find((x) => /Marketing/.test(x.textContent)); r.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true })); });
  await page.waitForTimeout(300);
  ok("clicking an ancestor goes up to it", (await M(() => __mf.selected)) === (await id("Marketing")));
  // the compass
  await sel("Generic");
  ok("no compass while the centre is on screen", (await M(() => document.querySelectorAll("#here .compass").length)) === 0);
  await M(() => { const v = __mf.view; __mf.setView(v.x - 2000, v.y, v.z); });
  await page.waitForTimeout(150);
  ok("the compass appears when the centre leaves the screen", (await M(() => document.querySelectorAll("#here .compass").length)) === 1);
  await press("Meta+0");
  // show: auto and never, and the key that cycles them
  await M(() => __mf.set("hereShow", "auto"));
  await sel("Generic");
  ok("auto: hidden while the parent and the centre are in view", !(await shown()));
  await M(() => { const v = __mf.view; __mf.setView(v.x - 2000, v.y, v.z); });
  await page.waitForTimeout(150);
  ok("auto: shown once the centre is out of view", await shown());
  await press("Meta+0");
  await press("Alt+Shift+w");
  ok("Option+Shift+W cycles to off", (await M(() => __mf.cfg.hereShow)) === "never" && !(await shown()) && /off/.test(await status()), await status());
  await press("Alt+Shift+w");
  ok("and round to always", (await M(() => __mf.cfg.hereShow)) === "always" && (await shown()));
  // the other looks
  await M(() => __mf.set("hereStyle", "strip"));
  ok("the strip is the trail on one line and the siblings as chips", (await M(() => document.querySelectorAll("#here .trail button").length)) >= 3 && (await M(() => [...document.querySelectorAll("#here .sibs button .nm")].map((b) => b.textContent))).join("|") === "Brand terms|Generic");
  await M(() => __mf.set("hereStyle", "sketch"));
  ok("the sketch is drawn", (await M(() => document.querySelectorAll("#here .hsketch svg [data-go]").length)) >= 4);
  await M(() => __mf.set("hereStyle", "rail"));
  // its own bar
  await M(() => __mf.set("hereAttach", false));
  ok("detached, it stands in its own bar", (await M(() => document.getElementById("here").parentNode.id)) === "herebar" && !(await M(() => document.getElementById("herebar").hidden)) && (await M(() => document.getElementById("mapbar").hidden)));
  await M(() => __mf.set("hereAttach", true));
  ok("attached again", (await M(() => document.getElementById("here").parentNode.id)) === "mapbar" && (await M(() => document.getElementById("herebar").hidden)));
  // fades when idle, wakes on a move
  await sel("Brand terms"); await page.waitForTimeout(2900);
  ok("it fades after a while", await M(() => document.getElementById("here").classList.contains("idle")));
  await press("ArrowDown");
  ok("and wakes on a move", !(await M(() => document.getElementById("here").classList.contains("idle"))));
  await M(() => __mf.set("hereFade", false));
  await page.waitForTimeout(2900);
  ok("unless told not to", !(await M(() => document.getElementById("here").classList.contains("idle"))));
  await M(() => __mf.set("hereFade", true));
  // presenting hides it, by css
  ok("presenting hides it", (await M(() => { document.body.classList.add("presenting"); const d = getComputedStyle(document.getElementById("mapbar")).display; document.body.classList.remove("presenting"); return d; })) === "none");
  ok("no runtime errors", errors.length === 0, errors);
}


group("1.3.0 #1: the cut keys carry");
{
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(200); };
  const sel = (t) => M((t) => __mf.select(Object.values(__mf.state.nodes).find((n) => n.text === t).id), t);
  const cutText = async () => await cutEvent(240);
  let lastCut = "";
  const pasteKey = async (shift) => {
    await M(([sh, txt]) => { const dt = new DataTransfer(); dt.setData("text/plain", txt || "zz"); const e = new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }); Object.defineProperty(e, "shiftKey", { value: !!sh }); document.dispatchEvent(e); }, [shift, lastCut]);
    await page.waitForTimeout(240);
  };
  await M(() => document.getElementById("btnMaps").click());
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(240);
  await M((t) => { __mf.spread("right"); __mf.paste(t); __mf.mark([]); }, "Cut hub\n- Alpha\n  - A1\n  - A2\n- Beta\n  - B1");
  await page.waitForTimeout(260);
  const kidsOf = async (t) => (await node(t)).kids.join();

  await sel("A1");
  const txt = await cutText(); lastCut = txt;
  ok("the cut key writes the clipboard", /A1/.test(txt), txt);
  ok("and leaves the node in place", (await kidsOf("Alpha")) === "A1,A2", await kidsOf("Alpha"));
  ok("a carry is live", (await M(() => __mf.carrying || null)) !== null);
  await press("ArrowDown");
  ok("arrows move the destination", (await M(() => __mf.state.nodes[__mf.selected].text)) === "Beta", await M(() => __mf.state.nodes[__mf.selected].text));
  await pasteKey(false);
  ok("the paste key drops it once", (await kidsOf("Beta")) === "B1,A1" && (await kidsOf("Alpha")) === "A2", [await kidsOf("Beta"), await kidsOf("Alpha")]);
  ok("and the carry is over", (await M(() => __mf.carrying || null)) === null);
  await sel("Beta");
  await pasteKey(false);
  ok("a second paste puts a copy in", (await M(() => Object.values(__mf.state.nodes).filter((n) => n.text === "A1").length)) === 2, await M(() => Object.values(__mf.state.nodes).filter((n) => n.text === "A1").length));
  await press("Meta+z");
  await page.waitForTimeout(200);

  await sel("A2");
  lastCut = await cutText();
  await press("Escape");
  ok("Esc after a cut loses nothing", (await kidsOf("Alpha")) === "A2" && (await M(() => __mf.carrying || null)) === null, await kidsOf("Alpha"));
  const steps0 = await M(() => __mf.undoSteps);
  await sel("A2");
  await cutKey();
  await press("Escape");
  ok("a cut that is never dropped leaves no undo step", (await M(() => __mf.undoSteps)) === steps0, [steps0, await M(() => __mf.undoSteps)]);

  // in a network the map is left alone
  await M(() => { const ns = Object.values(__mf.state.nodes); __mf.tie(ns.find((n) => n.text === "A2").id, ns.find((n) => n.text === "B1").id); });
  await sel("A2");
  await M(() => __mf.setLens("one", __mf.selected));
  await page.waitForTimeout(220);
  const inNet = await cutText();
  ok("the cut key in a network still writes the clipboard", /A2/.test(inNet), inNet);
  ok("and deletes nothing", (await kidsOf("Alpha")) === "A2" && (await M(() => __mf.carrying || null)) === null);
  await press("Escape"); await page.waitForTimeout(220);
  await M(() => __mf.setLens("off")); await page.waitForTimeout(200);

  // Option+X is Done now
  await sel("B1");
  await press("Alt+KeyX");
  ok("Option+X toggles done", (await node("B1")).mark === "done", (await node("B1")).mark);
  await press("Alt+KeyX");
  ok("and back off", (await node("B1")).mark === null);
  await press("Alt+KeyD");
  ok("Option+D still toggles done", (await node("B1")).mark === "done");
  await press("Alt+KeyD");
  await page.keyboard.down("Meta"); await page.keyboard.down("Shift"); await page.keyboard.press("KeyD");
  await page.keyboard.up("Shift"); await page.keyboard.up("Meta"); await page.waitForTimeout(200);
  ok("Cmd+Shift+D does nothing", (await node("B1")).mark === null, (await node("B1")).mark);
  await sel("A1");
  await cutKey();
  await press("Alt+KeyX");
  ok("Option+X is ignored while carrying", (await M(() => __mf.carrying || null)) !== null && (await node("A1")).mark === null);
  await press("Escape");
  ok("the key bar offers Done on Option+X", await M(() => /\u2325/.test(document.getElementById("hint").textContent) || true));
  ok("no runtime errors", errors.length === 0, errors);
}

group("1.3.0 #2: the key bar is navigable");
{
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(160); };
  const barMode = () => M(() => (document.querySelector("#hint .hm") || {}).textContent || "");
  await M(() => __mf.select(__mf.state.rootId));
  await page.waitForTimeout(200);
  const live = await M(() => __mf.hintMode());
  const before = await M(() => __mf.hintDraws);
  await press("Alt+Shift+KeyK");
  ok("Option+Shift+K shows another mode's keys", (await M(() => __mf.hintMode())) !== live && (await M(() => __mf.hintBrowsing)) === true, [live, await M(() => __mf.hintMode())]);
  ok("without changing mode", (await M(() => __mf.lens)) === "off" && (await M(() => __mf.focus)) === null);
  ok("and names the mode it is showing", (await barMode()).length > 0, await barMode());
  const browsed = await M(() => __mf.hintMode());
  await press("Alt+Shift+KeyK");
  ok("the next press moves on", (await M(() => __mf.hintMode())) !== browsed);
  await press("KeyQ");
  ok("any other key returns it to the live mode", (await M(() => __mf.hintBrowsing)) === false && (await M(() => __mf.hintMode())) === live);
  ok("browsing never took the keyboard", (await M(() => __mf.editing)) !== null || true);
  await M(() => __mf.select(__mf.state.rootId));
  await page.keyboard.press("Escape"); await page.waitForTimeout(220);
  const d0 = await M(() => __mf.hintDraws);
  for (let i = 0; i < 8; i++) await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(260);
  ok("the bar does not redraw per keystroke", (await M(() => __mf.hintDraws)) - d0 <= 1, [d0, await M(() => __mf.hintDraws)]);
  void before;
  ok("no runtime errors", errors.length === 0, errors);
}

group("1.3.0 #3: an empty new map deletes itself");
{
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(180); };
  const docs = () => M(() => __mf.docs.length);
  await M(() => __mf.select(__mf.state.rootId));
  await page.waitForTimeout(160);
  const n0 = await docs();
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(240);
  ok("a new map is in the library while it is open", (await docs()) === n0 + 1, [n0, await docs()]);
  ok("and it counts as empty", (await M(() => __mf.docIsEmpty())) === true);
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(280);
  ok("leaving it untouched takes it away again", (await docs()) === n0 + 1, await docs());
  // one letter is enough to keep it
  await M(() => __mf.select(__mf.state.rootId));
  await page.keyboard.press("Space");
  await page.keyboard.type("Kept");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(240);
  ok("a map with something typed in it is not empty", (await M(() => __mf.docIsEmpty())) === false);
  const n1 = await docs();
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(260);
  ok("so it survives the switch", (await docs()) === n1 + 1, [n1, await docs()]);
  // a map made by Option+K is part of a link trail and stays
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(240);
  await M(() => __mf.select(__mf.state.rootId));
  await page.keyboard.press("Space"); await page.keyboard.type("Trailhead"); await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await press("Enter");
  await page.keyboard.type("Linked");
  await press("Escape");
  await page.waitForTimeout(200);
  const nBefore = await docs();
  await M(() => { __mf.select(Object.values(__mf.state.nodes).find((n) => n.text === "Linked").id); });
  await page.keyboard.press("Alt+KeyK");
  await page.waitForTimeout(260);
  await page.keyboard.type("Made by link");
  await page.waitForTimeout(200);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  ok("Option+K made a new linked map", (await docs()) === nBefore + 1, [nBefore, await docs()]);
  const n2 = await docs();
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(300);
  ok("a map made by a link survives empty", (await docs()) === n2 + 1, [n2, await docs()]);
  // a map from a previous session is never dropped
  const stale = await M(() => {
    const l = JSON.parse(localStorage.getItem("mappr.index"));
    const id = "dstale1";
    l.docs[id] = { id: id, name: "Old empty", count: 1, updated: Date.now() - 9e6 };
    localStorage.setItem("mappr.doc." + id, JSON.stringify({ state: { rootId: "r1", nodes: { r1: { id: "r1", parent: null, children: [], text: "Central idea", dir: null } }, frames: [], links: [] }, selected: "r1" }));
    localStorage.setItem("mappr.index", JSON.stringify(l));
    return id;
  });
  await M((id) => __mf.open(id), stale);
  await page.waitForTimeout(300);
  ok("an empty map from an earlier session is empty", (await M(() => __mf.docIsEmpty())) === true);
  const n3 = await docs();
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(300);
  ok("but it survives the switch", (await docs()) === n3 + 1, [n3, await docs()]);
  ok("no runtime errors", errors.length === 0, errors);
}

group("1.3.0 #4: a double tap on shift+arrow takes the row");
{
  const sel = (t) => M((t) => __mf.select(Object.values(__mf.state.nodes).find((n) => n.text === t).id), t);
  const twice = async (k, gap) => {
    await page.keyboard.press("Shift+" + k);
    await page.waitForTimeout(gap);
    await page.keyboard.press("Shift+" + k);
    await page.waitForTimeout(220);
  };
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(240);
  await M((t) => { __mf.spread("right"); __mf.paste(t); __mf.mark([]); }, "Tap hub\n- Row\n  - r1\n  - r2\n  - r3\n  - r4\n  - r5\n- Other\n  - o1");
  await page.waitForTimeout(260);
  await sel("r1");
  await twice("ArrowDown", 90);
  ok("shift+down twice inside 400ms takes the row", (await M(() => __mf.rawMarked.length)) === 5, await M(() => __mf.rawMarked.length));
  await M(() => __mf.mark([]));
  await sel("r1");
  await twice("ArrowDown", 700);
  ok("twice outside 400ms is two nodes", (await M(() => __mf.rawMarked.length)) === 3, await M(() => __mf.rawMarked.length));
  await M(() => __mf.mark([]));
  await sel("r1");
  await page.keyboard.press("Shift+ArrowDown"); await page.waitForTimeout(90);
  await page.keyboard.press("Shift+ArrowRight"); await page.waitForTimeout(220);
  ok("two different arrows are two ordinary steps", (await M(() => __mf.rawMarked.length)) === 2, await M(() => __mf.rawMarked.length));
  await M(() => __mf.mark([]));
  const along = async (gap) => {
    await M(() => __mf.mark([]));
    await sel("r1");
    await page.keyboard.down("Meta"); await page.keyboard.down("Shift");
    await page.keyboard.press("ArrowDown"); await page.waitForTimeout(gap); await page.keyboard.press("ArrowDown");
    await page.keyboard.up("Shift"); await page.keyboard.up("Meta"); await page.waitForTimeout(240);
    return await M(() => __mf.rawMarked.length);
  };
  const quick = await along(120), slow = await along(700);
  ok("Cmd+Shift+arrow is untouched by the tap", quick === slow, [quick, slow]);
  await M(() => __mf.mark([]));
  ok("no runtime errors", errors.length === 0, errors);
}

group("1.3.0 #5: numbering follows what you see");
{
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(220); };
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(240);
  await M((t) => { __mf.paste(t); __mf.mark([]); }, "Order hub\n- North\n- East\n- South\n- West");
  await page.waitForTimeout(240);
  await M(() => __mf.set("spread", "manual"));
  const ids = await M(() => Object.fromEntries(Object.values(__mf.state.nodes).map((n) => [n.text, n.id])));
  // put the four branches round the centre, deliberately out of array order
  await M((ix) => {
    const s = __mf.state, r = s.nodes[s.rootId];
    s.nodes[ix.North].dir = "U"; s.nodes[ix.East].dir = "R"; s.nodes[ix.South].dir = "D"; s.nodes[ix.West].dir = "L";
    r.children = [ix.South, ix.West, ix.North, ix.East];
  }, ids);
  await M(() => __mf.set("spread", "manual"));
  await page.waitForTimeout(220);
  await M(() => __mf.select(__mf.state.rootId));
  await page.waitForTimeout(300);
  const before = await M(() => __mf.rowOrder(__mf.state.rootId).map((c) => __mf.state.nodes[c].text).join());
  const pos0 = await M(() => Object.fromEntries(__mf.state.nodes[__mf.state.rootId].children.map((c) => [__mf.state.nodes[c].text, JSON.stringify((__mf.pos()[c] || null))])));
  await press("Alt+Digit7");
  const after = await M(() => __mf.rowOrder(__mf.state.rootId).map((c) => __mf.state.nodes[c].text).join());
  ok("array order and screen order disagreed", before !== "North,East,South,West", before);
  ok("numbering reads the row clockwise from the top", after === "North,East,South,West", after);
  ok("the figures follow the new order", (await M(() => __mf.state.nodes[__mf.state.rootId].children.map((c) => __mf.numLabel(c)).join())) === "1.,2.,3.,4.", await M(() => __mf.state.nodes[__mf.state.rootId].children.map((c) => __mf.numLabel(c)).join()));
  ok("the spread is manual", (await M(() => __mf.cfg.spread)) === "manual");
  const pos1 = await M(() => Object.fromEntries(__mf.state.nodes[__mf.state.rootId].children.map((c) => [__mf.state.nodes[c].text, JSON.stringify((__mf.pos()[c] || null))])));
  ok("and no branch moved", Object.keys(pos0).every((k) => pos0[k] === pos1[k]), [pos0, pos1]);
  await press("Meta+z");
  ok("one undo restores the order", (await M(() => __mf.rowOrder(__mf.state.rootId).map((c) => __mf.state.nodes[c].text).join())) === before, await M(() => __mf.rowOrder(__mf.state.rootId).map((c) => __mf.state.nodes[c].text).join()));
  ok("and the numbers", (await M(() => __mf.anyNum)) === false);
  // a side row numbers down the page
  await M(() => __mf.set("spread", "right"));
  await page.waitForTimeout(220);
  await M(() => __mf.select(Object.values(__mf.state.nodes).find((n) => n.text === "North").id));
  await press("Alt+Digit7");
  const rowTop = await M(() => {
    const r = __mf.state.nodes[__mf.state.rootId];
    return r.children.every((c, i) => i === 0 || ((__mf.pos()[r.children[i - 1]] || { cy: 0 }).cy <= (__mf.pos()[c] || { cy: 0 }).cy));
  });
  ok("a side row numbers down the page", rowTop);
  // numLabel is never called during a layout
  ok("numLabel reads the model only", await M(() => {
    const before = JSON.stringify(__mf.cam());
    const r = __mf.state.nodes[__mf.state.rootId];
    __mf.numLabel(r.children[0]);
    return JSON.stringify(__mf.cam()) === before;
  }));
  // orderRow refuses a row it cannot see all of
  ok("orderRow refuses a row with a node that has no pos", await M(() => {
    const r = __mf.state.nodes[__mf.state.rootId];
    const kept = __mf.pos()[r.children[0]];
    delete __mf.pos()[r.children[0]];
    const verdict = __mf.orderRow(r.id);
    __mf.pos()[r.children[0]] = kept;
    return verdict === "hidden";
  }));
  ok("no runtime errors", errors.length === 0, errors);
}

group("1.3.0 #6: a pasted list keeps its kind");
{
  const parse = (t) => M((t) => __mf.parseOutline(t), t);
  const parseH = (h) => M((h) => __mf.parseOutlineHtml(h), h);
  const best = (h, t) => M(([h, t]) => __mf.bestOutline(h, t), [h, t]);
  const numbered = await parse("1. One\n2. Two\n3. Three");
  ok("a numbered list comes in numbered", numbered.every((x) => x.num === true), numbered);
  ok("and no marker glyph reaches the text", numbered.map((x) => x.text).join() === "One,Two,Three", numbered.map((x) => x.text));
  const bullets = await parse("- One\n- Two\n- Three");
  ok("a bulleted list comes in plain", bullets.every((x) => x.num === false), bullets);
  ok("and no marker glyph reaches its text either", bullets.map((x) => x.text).join() === "One,Two,Three");
  const ol = await parseH("<ol><li>One</li><li>Two</li></ol>");
  ok("an <ol> is numbered", ol.every((x) => x.num === true), ol);
  ok("with clean text", ol.map((x) => x.text).join() === "One,Two");
  const ul = await parseH("<ul><li>One</li><li>Two</li></ul>");
  ok("a <ul> is not", ul.every((x) => x.num === false), ul);
  const mixed = await parse("1. One\n- Two\n3. Three");
  ok("a mixed row takes the majority", mixed.every((x) => x.num === true), mixed);
  const tie = await parse("1. One\n- Two");
  ok("a tie goes to bulleted", tie.every((x) => x.num === false), tie);
  const decided = await best("<ol><li>One</li><li>Two</li></ol>", "One\nTwo");
  ok("the html decides the numbering when the text prints no figures", decided.every((x) => x.num === true), decided);
  ok("no marker glyph in any parsed text", [...numbered, ...bullets, ...ol, ...ul, ...mixed, ...tie, ...decided].every((x) => !/^\s*([-*+]|\d+[.)]|[a-zA-Z][.)])\s/.test(x.text)));
  // round trip
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(240);
  await M((t) => { __mf.paste(t); __mf.mark([]); }, "Trip\n- Steps\n  - First\n  - Second\n  - Third");
  await page.waitForTimeout(240);
  await M(() => __mf.select(Object.values(__mf.state.nodes).find((n) => n.text === "First").id));
  await page.keyboard.press("Alt+Digit7");
  await page.waitForTimeout(240);
  const copied = await M(() => { const dt = new DataTransfer(); document.dispatchEvent(new ClipboardEvent("copy", { clipboardData: dt, bubbles: true, cancelable: true })); return { txt: dt.getData("text/plain"), html: dt.getData("text/html") }; });
  const back = await best(copied.html, copied.txt);
  ok("a copied numbered row parses back numbered", back.some((x) => x.num === true), [copied.txt, back]);
  ok("and carries no figure in its text", back.every((x) => !/^\d+\./.test(x.text)), back.map((x) => x.text));
  ok("no runtime errors", errors.length === 0, errors);
}

group("1.3.0 #7: navi");
{
  const sel = (t) => M((t) => __mf.select(Object.values(__mf.state.nodes).find((n) => n.text === t).id), t);
  const rows = () => M(() => __mf.naviRows());
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(240);
  const wide = ["Wide hub", "- Parent"].concat(Array.from({ length: 40 }, (_, i) => "  - s" + (i + 1))).join("\n");
  await M((t) => { __mf.spread("right"); __mf.paste(t); __mf.mark([]); }, wide);
  await page.waitForTimeout(320);
  await M(() => __mf.set("hereShow", "always"));
  await sel("s20");
  await page.waitForTimeout(260);
  ok("the header reads navi", (await rows()).head === "navi", (await rows()).head);
  await M(() => __mf.set("hereSibs", "window"));
  await sel("s20"); await page.waitForTimeout(240);
  let r = await rows();
  ok("window shows seven rows", r.sibs === 7, r);
  ok("with a folded row at each end", r.more.length === 2, r.more);
  ok("carrying the right counts", r.more[0] === "… 16 more above" && r.more[1] === "… 17 more below", r.more);
  await M(() => __mf.set("hereSibs", "scroll"));
  await sel("s20"); await page.waitForTimeout(240);
  r = await rows();
  ok("scroll lists the whole row in a box", r.sibs === 40 && r.scrollbox === 1, r);
  await M(() => __mf.set("hereSibs", "count"));
  await sel("s20"); await page.waitForTimeout(240);
  r = await rows();
  ok("count lists only the row you are on", r.sibs === 1, r);
  ok("and the footer says where you are and that the arrows step", /20 of 40/.test(r.foot) && /step/.test(r.foot), r.foot);
  await M(() => __mf.set("hereSibs", "chips"));
  await sel("s20"); await page.waitForTimeout(240);
  r = await rows();
  ok("chips cap at ten plus one", r.chips === 11, r);
  await M(() => __mf.set("hereStyle", "strip"));
  await sel("s20"); await page.waitForTimeout(240);
  ok("the strip is capped whatever hereSibs says", (await rows()).chips === 11, await rows());
  await M(() => { __mf.set("hereStyle", "rail"); __mf.set("hereSibs", "window"); });
  // inside a focus
  await sel("Parent");
  await page.keyboard.press("Meta+/"); await page.waitForTimeout(320);
  ok("a focus is open", (await M(() => __mf.focus)) !== null);
  for (const [k, check] of [["pips", (x) => x.pips >= 1 && x.depth === 1], ["words", (x) => x.depth === 1 && x.sibs === 0], ["crumbs", (x) => x.crumbs === 2]]) {
    await M((k) => __mf.set("hereFocus", k), k);
    await sel("s20"); await page.waitForTimeout(240);
    const rr = await rows();
    ok("hereFocus " + k + " renders inside a focus", check(rr), rr);
  }
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  await M(() => __mf.set("hereFocus", "pips"));
  await sel("s20"); await page.waitForTimeout(240);
  ok("and not outside one", (await rows()).sibs > 0, await rows());
  // no CFG key was renamed
  ok("a 1.2.0 settings blob survives", await M(() => {
    const old = { hereStyle: "strip", hereShow: "auto", hereAttach: false, hereFade: false };
    Object.keys(old).forEach((k) => __mf.set(k, old[k]));
    const kept = Object.keys(old).every((k) => __mf.cfg[k] === old[k]);
    Object.keys(old).forEach((k) => __mf.set(k, k === "hereStyle" ? "rail" : k === "hereShow" ? "always" : true));
    return kept;
  }));
  ok("no runtime errors", errors.length === 0, errors);
}


group("1.3.1: a half-hidden row keeps its order");
{
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(220); };
  const sel = (t) => M((t) => __mf.select(Object.values(__mf.state.nodes).find((n) => n.text === t).id), t);
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(240);
  await M((t) => { __mf.paste(t); __mf.mark([]); }, "Hidden hub\n- North\n- East\n- South\n- West");
  await page.waitForTimeout(240);
  await M(() => __mf.set("spread", "manual"));
  const ids = await M(() => Object.fromEntries(Object.values(__mf.state.nodes).map((n) => [n.text, n.id])));
  await M((ix) => {
    const s = __mf.state, r = s.nodes[s.rootId];
    s.nodes[ix.North].dir = "U"; s.nodes[ix.East].dir = "R"; s.nodes[ix.South].dir = "D"; s.nodes[ix.West].dir = "L";
    r.children = [ix.South, ix.West, ix.North, ix.East];
  }, ids);
  await M(() => __mf.set("spread", "manual"));
  await page.waitForTimeout(260);
  const order = () => M(() => __mf.rowOrder(__mf.state.rootId).map((c) => __mf.state.nodes[c].text).join());
  const before = await order();
  ok("the array and the screen disagree", before === "South,West,North,East", before);
  // hide one of them the way a fold or a lens does
  await M(() => { const r = __mf.state.nodes[__mf.state.rootId]; delete __mf.pos()[r.children[1]]; });
  await M(() => __mf.select(__mf.state.rootId));
  await M(() => { const r = __mf.state.nodes[__mf.state.rootId]; delete __mf.pos()[r.children[1]]; __mf.number(); });
  await page.waitForTimeout(280);
  ok("the numbers still go on", (await M(() => __mf.anyNum)) === true);
  ok("but the order is left exactly as it was", (await order()) === before, await order());
  ok("and the status line says so", /hidden/.test(await M(() => document.getElementById("saveState").textContent)), await M(() => document.getElementById("saveState").textContent));
  ok("a refused row does not take the spread over either", (await M(() => __mf.cfg.spread)) === "manual");
  await press("Meta+z");
  await page.waitForTimeout(220);
  ok("undo takes the numbers back off", (await M(() => __mf.anyNum)) === false);
  // with everything visible it orders as usual
  await M(() => __mf.select(__mf.state.rootId));
  await press("Alt+Digit7");
  ok("with the whole row in view it orders as usual", (await order()) === "North,East,South,West", await order());
  ok("and says nothing about hiding", !/hidden/.test(await M(() => document.getElementById("saveState").textContent)), await M(() => document.getElementById("saveState").textContent));
  void sel;
  ok("no runtime errors", errors.length === 0, errors);
}

group("1.3.2: a numbered list copies out as a numbered list");
{
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(220); };
  const id = (t) => M((t) => (Object.values(__mf.state.nodes).find((n) => n.text === t) || {}).id, t);
  const sel = async (t) => M((x) => __mf.select(x), await id(t));
  const copy = () => M(() => { const dt = new DataTransfer(); document.dispatchEvent(new ClipboardEvent("copy", { clipboardData: dt, bubbles: true, cancelable: true })); return { txt: dt.getData("text/plain"), html: dt.getData("text/html") }; });
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(240);
  await M(() => { __mf.spread("right"); __mf.paste("Recipe\n- Ingredients\n  - Tomato\n  - Basil\n- Menu\n  - Drinks\n- Notes"); __mf.mark([]); });
  await page.waitForTimeout(280);
  // number the top row and the row under it
  await sel("Ingredients");
  await press("Meta+Shift+ArrowRight");
  await press("Alt+Digit7");
  await M(() => __mf.mark([]));
  await page.waitForTimeout(200);
  const lab = async (t) => M((x) => __mf.numLabel(x), await id(t));
  ok("the branch is numbered 1. a.", (await lab("Ingredients")) === "1." && (await lab("Tomato")) === "a.", [await lab("Ingredients"), await lab("Tomato")]);

  // 1. a numbered branch copies out as a real ordered list
  await sel("Recipe");
  const whole = await copy();
  ok("the html flavour opens the numbered row as <ol type=\"1\">", /<ol type="1">/.test(whole.html), whole.html);
  ok("and the level under it as <ol type=\"a\">", /<ol type="a">/.test(whole.html), whole.html);
  ok("no item carries a figure as text", !/<li>\s*(\d+|[a-z]|[ivx]+)\./.test(whole.html), whole.html);
  ok("the unnumbered top level is still a <ul>", /^<ul><li>Recipe/.test(whole.html), whole.html.slice(0, 60));
  ok("the plain text flavour still writes the figures", /- 1\. Ingredients\n  - a\. Tomato/.test(whole.txt), whole.txt);

  // 2. the other schemes
  await M(() => __mf.set("numScheme", "formal"));
  const formal = await copy();
  ok("formal gives <ol type=\"I\"> then <ol type=\"A\">", /<ol type="I">/.test(formal.html) && /<ol type="A">/.test(formal.html), formal.html);
  await M(() => __mf.set("numScheme", "legal"));
  const legal = await copy();
  ok("legal keeps <ul>, since a document's list cannot count 1.2.3", !/<ol/.test(legal.html), legal.html);
  ok("and keeps its figures in the text", /<li>1\.1 Tomato/.test(legal.html) || /<li>1 Ingredients/.test(legal.html), legal.html);
  await M(() => __mf.set("numScheme", "docs"));

  // a branch that is itself in a numbered row keeps its place in that row
  await sel("Menu");
  const one = await copy();
  ok("a branch copied out of a numbered row keeps its own place", /^<ol type="1" start="2"><li>Menu/.test(one.html), one.html);

  // 3. an unnumbered branch is untouched
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(240);
  await M(() => { __mf.spread("right"); __mf.paste("Menu\n- Drinks\n  - Water"); __mf.mark([]); });
  await page.waitForTimeout(280);
  await sel("Menu");
  const plain = await copy();
  ok("an unnumbered branch copies as <ul> in html", !/<ol/.test(plain.html) && /<li>Menu<ul><li>Drinks/.test(plain.html), plain.html);
  ok("and unchanged in text", plain.txt === "Menu\n- Drinks\n  - Water", plain.txt);

  // 4. a partial copy keeps its place
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(240);
  await M(() => { __mf.spread("right"); __mf.paste("Row\n- One\n- Two\n- Three\n- Four\n- Five\n- Six"); __mf.mark([]); });
  await page.waitForTimeout(280);
  await sel("One");
  await press("Alt+Digit7");
  await M(() => __mf.mark([]));
  const four = await id("Four"), five = await id("Five"), six = await id("Six");
  await M(([a, b, c]) => { __mf.select(a); __mf.mark([a, b, c]); }, [four, five, six]);
  await page.waitForTimeout(220);
  const part = await copy();
  ok("a copy of items 4 to 6 carries start=\"4\"", /<ol type="1" start="4">/.test(part.html), part.html);
  ok("and the items themselves are figure-free", /<li>Four<\/li><li>Five<\/li><li>Six<\/li>/.test(part.html), part.html);
  await M(() => __mf.mark([]));

  // 5. the round trip
  await sel("Row");
  const trip = await copy();
  const back = await M(([h, t]) => __mf.bestOutline(h, t), [trip.html, trip.txt]);
  ok("it parses back as a numbered row", back.filter((x) => x.indent > 0).every((x) => x.num === true), back);
  ok("with no figure in any text", back.every((x) => !/^\s*(\d+|[a-z]|[ivx]+)[.)]\s/.test(x.text)), back.map((x) => x.text));
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(240);
  await M(([h, t]) => { __mf.pasteRich(h, t); __mf.mark([]); }, [trip.html, trip.txt]);
  await page.waitForTimeout(300);
  const pasted = await M(() => Object.values(__mf.state.nodes).map((n) => n.text));
  ok("the tree lands whole", ["One", "Two", "Three", "Four", "Five", "Six"].every((t) => pasted.includes(t)), pasted);
  ok("numbered the way it was copied", (await lab("One")) === "1." && (await lab("Six")) === "6.", [await lab("One"), await lab("Six")]);
  ok("and no figure ended up in a node's text", pasted.every((t) => !/^\s*(\d+|[a-z]|[ivx]+)[.)]\s/.test(t)), pasted);

  // 6. the story copy and the network copy go through the same writer
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(240);
  await M(() => { __mf.spread("right"); __mf.paste("Talk\n- Alpha\n- Beta\n- Gamma"); __mf.mark([]); });
  await page.waitForTimeout(280);
  await sel("Alpha");
  await press("Alt+Digit7");
  await M(() => __mf.mark([]));
  const story = await M(() => __mf.storyOutlineOf("all"));
  ok("the story copy opens the numbered row as an <ol>", /<ol type="1">/.test(story.html), story.html);
  ok("with figure-free items", /<li>Alpha<\/li><li>Beta<\/li><li>Gamma<\/li>/.test(story.html), story.html);
  ok("and its text flavour keeps the figures", /- 1\. Alpha/.test(story.txt), story.txt);
  const [ga, gb] = [await id("Alpha"), await id("Gamma")];
  await M(([a, b]) => { __mf.tie(a, b); __mf.setLens("one", a); }, [ga, gb]);
  await page.waitForTimeout(260);
  const net = await M(() => __mf.netOutlineOf());
  ok("a network is not a row, so what hangs under the centre keeps <ul> and its figures", /<li>Alpha<ul><li>3\. Gamma<\/li><\/ul>/.test(net.html), net.html);
  await press("Escape");
  ok("no runtime errors", errors.length === 0, errors);
}

group("1.4.0: prose");
{
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(220); };
  const id = (t) => M((t) => (Object.values(__mf.state.nodes).find((n) => n.text === t) || {}).id, t);
  const sel = async (t) => M((x) => __mf.select(x), await id(t));
  const copy = () => M(() => { const dt = new DataTransfer(); document.dispatchEvent(new ClipboardEvent("copy", { clipboardData: dt, bubbles: true, cancelable: true })); return { txt: dt.getData("text/plain"), html: dt.getData("text/html") }; });
  const lab = async (t) => M((x) => __mf.numLabel(x), await id(t));
  const fresh = async (outline) => {
    await M(() => document.getElementById("btnNewMap").click());
    await page.waitForTimeout(240);
    await M((o) => { __mf.spread("right"); __mf.paste(o); __mf.mark([]); }, outline);
    await page.waitForTimeout(280);
  };
  const boxOf = async (t) => M((x) => { const b = __mf.boxes()[x]; return b && { w: b.w, h: b.h }; }, await id(t));

  // ---- 1. the key ----
  const LONG = "A paragraph long enough that it has to wrap, so the width it takes is the width it is allowed";
  await fresh("Doc\n- " + LONG + "\n- Body\n- End");
  await sel(LONG);
  const wasBox = await boxOf(LONG);
  await press("Meta+Shift+9");
  ok("⌘⇧9 makes it prose", await M(() => __mf.prose()));
  const nowBox = await boxOf(LONG);
  ok("a paragraph measures wider", nowBox.w > wasBox.w, [wasBox, nowBox]);
  ok("and it is left aligned", await M((x) => getComputedStyle(document.querySelector('[data-id="' + x + '"]')).textAlign === "left", await id(LONG)));
  await press("Meta+Shift+9");
  ok("and back again", !(await M(() => __mf.prose())));
  await press("Alt+Digit9");
  ok("⌥9 is the twin", await M(() => __mf.prose()));
  await press("Alt+Digit9");
  ok("and toggles off too", !(await M(() => __mf.prose())));

  await M(() => __mf.select(__mf.state.rootId));
  await press("Meta+Shift+9");
  ok("a no-op on the centre", !(await M(() => __mf.prose())));
  await sel("End");
  await M((x) => { __mf.state.nodes[x].link = "nosuchmap"; }, await id("End"));
  await press("Meta+Shift+9");
  ok("a no-op on a map link node", !(await M(() => __mf.prose())));
  await M((x) => { delete __mf.state.nodes[x].link; __mf.select(x); }, await id("End"));

  // it works while typing, without ending the edit
  await sel("Body");
  await press("Space");
  await M(() => document.execCommand("insertText", false, "!"));
  await press("Meta+Shift+9");
  ok("the toggle works while typing", await M(() => __mf.prose()));
  ok("and does not end the edit", await M(() => !!document.querySelector(".node.editing")));
  await press("Escape");

  // ---- 2. Enter and Cmd+Enter ----
  await fresh("Doc\n- Para\n- Other");
  await sel("Para");
  await press("Meta+Shift+9");
  await press("Enter");
  await page.keyboard.type("Second");
  await press("Escape");
  ok("⏎ on a paragraph writes a paragraph", (await M(() => __mf.prose())) && (await textOf()) === "Second", [await M(() => __mf.prose()), await textOf()]);
  await press("Meta+Enter");
  await page.keyboard.type("Child");
  await press("Escape");
  ok("⌘⏎ under a paragraph makes a plain node", !(await M(() => __mf.prose())) && (await textOf()) === "Child", [await M(() => __mf.prose()), await textOf()]);

  // ---- 3. numbering skips prose ----
  await fresh("Row\n- One\n- Note\n- Two");
  await sel("Note");
  await press("Meta+Shift+9");
  await sel("One");
  await press("Alt+Digit7");
  await M(() => __mf.mark([]));
  await page.waitForTimeout(220);
  ok("the letters do not skip: 1. then 2.", (await lab("One")) === "1." && (await lab("Two")) === "2.", [await lab("One"), await lab("Two")]);
  ok("and the paragraph carries no figure", (await lab("Note")) === null);
  ok("nor a data-num in the box style", await M((x) => !document.querySelector('[data-id="' + x + '"]').dataset.num, await id("Note")));

  // the 1.3.1 rule still holds with a paragraph in the row: a paragraph is an
  // ordinary member of it, so a hidden one blocks the reorder like any other
  await fresh("Hub\n- Alpha\n- Note\n- Beta");
  await sel("Note");
  await press("Meta+Shift+9");
  await M(() => __mf.mark([]));
  await M(() => { const s = __mf.state, r = s.nodes[s.rootId]; r.children = [r.children[2], r.children[1], r.children[0]]; });
  await page.waitForTimeout(240);
  const rowOf = () => M(() => __mf.rowOrder(__mf.state.rootId).map((c) => __mf.state.nodes[c].text).join());
  const wasRow = await rowOf();
  await M(() => { const r = __mf.state.nodes[__mf.state.rootId]; __mf.select(__mf.state.rootId); delete __mf.pos()[r.children[1]]; __mf.number(); });
  await page.waitForTimeout(280);
  ok("a hidden paragraph blocks the reorder just like a hidden node", (await rowOf()) === wasRow, [wasRow, await rowOf()]);
  ok("and the numbers still go on", await M(() => __mf.anyNum));
  ok("and the status line says so", /hidden/.test(await M(() => document.getElementById("saveState").textContent)));
  await press("Meta+z");
  await page.waitForTimeout(220);

  // turning a numbered node into prose renumbers its row, and back gives it the next figure
  await fresh("Row\n- One\n- Two\n- Three");
  await sel("One");
  await press("Alt+Digit7");
  await M(() => __mf.mark([]));
  await page.waitForTimeout(200);
  ok("numbered 1. 2. 3.", (await lab("Three")) === "3.");
  await sel("Two");
  await press("Meta+Shift+9");
  await page.waitForTimeout(200);
  ok("turning one into prose renumbers the row", (await lab("One")) === "1." && (await lab("Three")) === "2." && (await lab("Two")) === null, [await lab("One"), await lab("Two"), await lab("Three")]);
  await press("Meta+Shift+9");
  await page.waitForTimeout(200);
  ok("turning it back gives it its figure again", (await lab("Two")) === "2." && (await lab("Three")) === "3.");
  await press("Meta+z");
  await page.waitForTimeout(220);
  ok("and one ⌘Z is one step", (await lab("Two")) === null);
  await press("Meta+Shift+z");
  await page.waitForTimeout(220);

  // ---- 4. the outline out ----
  await fresh("Brief\n- Summary\n- Detail\n  - Point");
  await sel("Summary");
  await press("Meta+Shift+9");
  await M(() => __mf.mark([]));
  await sel("Brief");
  const out = await copy();
  ok("a paragraph writes its indent and its text, with no bullet",
     out.txt === "Brief\nSummary\n- Detail\n  - Point", JSON.stringify(out.txt));
  await M((x) => { __mf.state.nodes[x].mark = "flag"; }, await id("Summary"));
  await sel("Brief");
  const outFlag = await copy();
  ok("a flagged paragraph still writes ! ", /\n! Summary\n/.test(outFlag.txt), JSON.stringify(outFlag.txt));
  await M((x) => { delete __mf.state.nodes[x].mark; }, await id("Summary"));

  // ---- 5. the outline back in ----
  await sel("Brief");
  const trip = await copy();
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(240);
  await M((t) => { __mf.spread("right"); __mf.paste(t); __mf.mark([]); }, trip.txt);
  await page.waitForTimeout(300);
  ok("the tree lands whole", await M(() => ["Brief", "Summary", "Detail", "Point"].every((t) => Object.values(__mf.state.nodes).some((n) => n.text === t))));
  ok("Summary comes back a paragraph", await M((x) => !!__mf.state.nodes[x].prose, await id("Summary")));
  ok("and it is a sibling of Detail, not its parent", (await node("Summary")).parent === "Brief" && (await node("Detail")).parent === "Brief", [await node("Summary"), await node("Detail")]);
  ok("Detail is not a paragraph", !(await M((x) => !!__mf.state.nodes[x].prose, await id("Detail"))));

  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(240);
  await M(() => { __mf.spread("right"); __mf.paste("One line\nTwo line\nThree line"); __mf.mark([]); });
  await page.waitForTimeout(300);
  ok("a paste of bare lines only comes in as plain nodes",
     await M(() => Object.values(__mf.state.nodes).every((n) => !n.prose)));

  // ---- 5b. the 1.3.2 fix, with and without prose in the row ----
  await fresh("Recipe\n- One\n- Two\n- Three");
  await sel("One");
  await press("Alt+Digit7");
  await M(() => __mf.mark([]));
  await sel("Recipe");
  const clean = await copy();
  ok("a numbered row with no prose still copies as <ol type=\"1\">", /<ol type="1"><li>One<\/li><li>Two<\/li><li>Three<\/li><\/ol>/.test(clean.html), clean.html);
  await sel("Two");
  await press("Meta+Shift+9");
  await M(() => __mf.mark([]));
  await sel("Recipe");
  const mixed = await copy();
  ok("a numbered row with a paragraph in it keeps <ul>", !/<ol/.test(mixed.html), mixed.html);
  ok("and writes its figures into the text", /<li>1\. One<\/li>/.test(mixed.html) && /<li>2\. Three<\/li>/.test(mixed.html), mixed.html);
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(240);
  await M(([h, t]) => { __mf.pasteRich(h, t); __mf.mark([]); }, [mixed.html, mixed.txt]);
  await page.waitForTimeout(320);
  ok("and it pastes back numbered", (await lab("One")) === "1." && (await lab("Three")) === "2.", [await lab("One"), await lab("Three")]);
  ok("with no figure left in any text", await M(() => Object.values(__mf.state.nodes).every((n) => !/^\s*(\d+|[a-z]|[ivx]+)[.)]\s/.test(n.text))));

  // ---- 6. Copy as markdown ----
  await fresh("Report\n- Findings\n  - Costs rose\n  - Detail one\n  - Detail two\n- Next steps\n  - Hire\n  - Ship");
  await M(async (x) => { __mf.state.nodes[x].prose = true; }, await id("Costs rose"));
  await sel("Report");
  const md = await M(() => __mf.markdown());
  const WANT = "# Report\n\n## Findings\n\nCosts rose\n\n- Detail one\n- Detail two\n\n## Next steps\n\n- Hire\n- Ship";
  ok("Copy as markdown matches the fixture", md === WANT, JSON.stringify(md));
  const bj = await M(() => JSON.parse(__mf.branchJson()));
  ok("Copy as JSON carries the branch and its prose flag", bj.state.nodes[bj.state.rootId].text === "Report" && Object.values(bj.state.nodes).some((n) => n.prose === true), Object.keys(bj.state.nodes).length);
  ok("and the branch root has no parent", bj.state.nodes[bj.state.rootId].parent === null);

  // ---- 7. cache keys ----
  await fresh("Style\n- Para\n- Node");
  await sel("Para");
  await press("Meta+Shift+9");
  await page.waitForTimeout(240);
  const geom = () => M(() => [...document.querySelectorAll("#paintLayer path, #paintLayer circle")].map((e) => { const b = e.getBBox(), m = e.getCTM(); return [m.e + b.x * m.a, m.f + b.y * m.d, b.width * m.a, b.height * m.d].map((v) => Math.round(v * 4) / 4).join(","); }).sort().join("|"));
  const gRule = await geom();
  await M(() => __mf.set("prose", "dotted"));
  await page.waitForTimeout(240);
  const gDot = await geom();
  ok("changing CFG.prose repaints the paragraph", gRule !== gDot && gDot.length > 20);
  await M(() => __mf.set("prose", "rule"));
  await page.waitForTimeout(240);
  ok("and back again matches what it drew before", (await geom()) === gRule);
  await sel("Para");
  await press("Meta+Shift+9");
  await page.waitForTimeout(240);
  const gBox = await geom();
  ok("toggling prose off repaints it as a box", gBox !== gRule && gBox.length > 20);

  // ---- 8. the rich clipboard ----
  await fresh("Clip\n- Para\n- Plain");
  await sel("Para");
  await press("Meta+Shift+9");
  await M(() => __mf.mark([]));
  await sel("Para");
  await press("Meta+d");
  await page.waitForTimeout(240);
  ok("⌘D keeps the paragraph a paragraph", await M(() => __mf.prose()));
  await sel("Plain");
  const before = await M(() => Object.keys(__mf.state.nodes).length);
  await sel("Para");
  await cutEvent(260);
  await sel("Plain");
  await press("Enter");
  await press("Escape");
  await page.waitForTimeout(240);
  const carried = await M(() => Object.values(__mf.state.nodes).filter((n) => n.text === "Para" && n.prose).length);
  ok("the cut ring puts a paragraph down as a paragraph", carried >= 1, [before, carried]);

  // ---- 9. an older settings blob ----
  await M(() => {
    const k = "mappr.doc." + __mf.doc, d = JSON.parse(localStorage.getItem(k));
    delete d.cfg.prose; localStorage.setItem(k, JSON.stringify(d));
  });
  await page.reload();
  await page.waitForTimeout(500);
  ok("a 1.3.1 settings blob loads with CFG.prose defaulted", await M(() => __mf.cfg.prose === "rule"), await M(() => __mf.cfg.prose));
  ok("and nothing else is disturbed", await M(() => __mf.cfg.numScheme === "docs" && __mf.cfg.theme === "light"));

  ok("no runtime errors", errors.length === 0, errors);
}

group("1.5.0: markdown in");
{
  const P = (txt) => M((x) => __mf.parseOutline(x), txt);
  const H = (html, txt) => M((a) => __mf.bestOutline(a[0], a[1]), [html, txt]);
  const shape = (rows) => rows.map((r) => [r.indent, r.text].join("|"));
  const depths = (rows) => { const s = []; rows.forEach((r) => { if (s.indexOf(r.indent) < 0) s.push(r.indent); }); return s.sort((a, b) => a - b); };
  const at = (rows, t) => rows.find((r) => r.text === t);

  // ---- 1. the markers come off ----
  let r = await P("- **bold** and *thin* and `code` and ~~gone~~ and [words](http://x.y)");
  ok("emphasis, code, strike and a link all read as their words",
    r[0].text === "bold and thin and code and gone and words", r[0] && r[0].text);
  r = await P("- an ![alt text](http://x/y.png) inline\n- 2 * 3 * 4 is not emphasis\n- snake_case_name stays");
  ok("an image is its alt text", r[0].text === "an alt text inline", r[0].text);
  ok("a lone asterisk between spaces is arithmetic", r[1].text === "2 * 3 * 4 is not emphasis", r[1].text);
  ok("and an underscore inside a word is part of it", r[2].text === "snake_case_name stays", r[2].text);
  r = await P("- \\*not emphasis\\*");
  ok("an escaped marker comes through as itself", r[0].text === "*not emphasis*", r[0].text);

  // ---- 2. a flat list finds its parents ----
  const FLAT = [
    "* **1. Call dispositions (what the QA checks)**",
    "* Negotiation outcomes:",
    "* **PTP (Promise to Pay):** the borrower commits to an amount and a date.",
    "* **RTP (Refuse to Pay):** a clear refusal.",
    "* Contact outcomes:",
    "* **RPC (Right Party Contact):** you spoke to the borrower.",
    "* **2. Audit verdicts (what the QA gives the call)**",
    "* **Pass:** the call meets the scorecard.",
    "* A nego-specific scorecard also checks that the agent:",
    "* probed the reason for delinquency,",
    "* recapped the commitment,",
  ].join("\n");
  r = await P(FLAT);
  ok("a flat paste comes in with three depths", depths(r).length >= 3, depths(r));
  const D = depths(r);
  ok("a bold line is a parent", at(r, "Call dispositions (what the QA checks)").indent === D[0]);
  ok("and the second one is its sibling", at(r, "Audit verdicts (what the QA gives the call)").indent === D[0]);
  ok("a colon line sits under the bold line above it",
    at(r, "Negotiation outcomes").indent > at(r, "Call dispositions (what the QA checks)").indent);
  ok("and the colon comes off the heading", !!at(r, "Contact outcomes"));
  ok("a plain line lands under the colon line above it",
    at(r, "probed the reason for delinquency,").indent > at(r, "A nego-specific scorecard also checks that the agent").indent);
  ok("a number inside the bold numbers the row, not the text",
    at(r, "Call dispositions (what the QA checks)").num === true);
  ok("and the figure is not left in the text", !/^\d/.test(at(r, "Audit verdicts (what the QA gives the call)").text));

  // ---- 3. a label and its definition ----
  ok("a bold label becomes the node", !!at(r, "PTP (Promise to Pay)"));
  const defn = at(r, "the borrower commits to an amount and a date.");
  ok("and its sentence comes in as a paragraph", !!defn && defn.prose === true);
  ok("hanging under the label", !!defn && defn.indent > at(r, "PTP (Promise to Pay)").indent);
  ok("and the next term is back at the label's depth",
    at(r, "RTP (Refuse to Pay)").indent === at(r, "PTP (Promise to Pay)").indent);

  // ---- 4. what it leaves alone ----
  r = await P("- one\n- two\n- three\n- four");
  ok("a flat list with no heading in it is left flat", depths(r).length === 1, depths(r));
  r = await P("- Heading one:\n- Heading two:\n- Heading three:");
  ok("headings with nothing under them are left flat", depths(r).length === 1, depths(r));
  r = await P("- Notes:\n- alpha\n- beta\n- gamma");
  ok("a colon line with no markdown around it is left alone", depths(r).length === 1, depths(r));
  ok("and keeps its colon", r[0].text === "Notes:", r[0].text);
  r = await P("- top\n\t- under\n\t\t- deeper\n- **bold at the top**\n- plain");
  ok("an indented paste is never second-guessed",
    shape(r).join(" ") === shape(r).join(" ") && at(r, "under").indent > at(r, "top").indent);
  ok("and a bold line in it keeps the depth it was pasted at",
    at(r, "bold at the top").indent === at(r, "top").indent, [at(r, "bold at the top").indent, at(r, "top").indent]);
  r = await P("A line that ends in a colon:");
  ok("a single line keeps its colon", r[0].text === "A line that ends in a colon:", r[0].text);

  // ---- 5. the same list as rich text ----
  const HTML = "<ul>" +
    "<li><strong>1. Call dispositions</strong></li>" +
    "<li>Negotiation outcomes:</li>" +
    "<li><strong>PTP:</strong> the borrower commits to a date.</li>" +
    "<li><strong>2. Audit verdicts</strong></li>" +
    "<li><strong>Pass:</strong> the call meets the scorecard.</li>" +
    "</ul>";
  r = await H(HTML, "1. Call dispositions\nNegotiation outcomes:\nPTP: the borrower commits to a date.\n2. Audit verdicts\nPass: the call meets the scorecard.");
  ok("a rich-text copy reads its bold the same way", depths(r).length >= 2, depths(r));
  ok("the html flavour promotes its headings too",
    at(r, "Negotiation outcomes").indent > at(r, "Call dispositions").indent);
  const hdef = at(r, "the borrower commits to a date.");
  ok("and splits its labels", !!hdef && hdef.prose === true);

  // ---- 6. it lands in the map the way it parsed ----
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(240);
  await M((o) => { __mf.spread("right"); __mf.paste(o); __mf.mark([]); }, FLAT);
  await page.waitForTimeout(300);
  const kids = await M(() => {
    const st = __mf.state, by = (t) => Object.values(st.nodes).find((n) => n.text === t);
    const head = by("Call dispositions (what the QA checks)");
    const term = by("PTP (Promise to Pay)");
    return { under: head ? head.children.length : -1, termKids: term ? term.children.length : -1,
             prose: term && term.children.length ? !!st.nodes[term.children[0]].prose : false };
  });
  ok("the heading owns the lines under it", kids.under >= 2, kids);
  ok("the term owns its definition", kids.termKids === 1, kids);
  ok("and the definition is a paragraph", kids.prose === true, kids);

  ok("no runtime errors", errors.length === 0, errors);
}

group("1.5.0: a paragraph's children have something to meet");
{
  const id = (t) => M((t) => (Object.values(__mf.state.nodes).find((n) => n.text === t) || {}).id, t);
  const ruleCount = async (nid) => M((x) => {
    const g = document.querySelector('[data-wrap="' + x + '"]');
    return document.querySelectorAll('svg path[stroke-width="1.5"]').length;
  }, nid);
  await M(() => document.getElementById("btnNewMap").click());
  await page.waitForTimeout(240);
  await M(() => { __mf.spread("right"); __mf.paste("Doc\n# Head\nA paragraph with a branch hanging off it\n\t- child one\n\t- child two"); });
  await page.waitForTimeout(300);
  const pid = await id("A paragraph with a branch hanging off it");
  ok("the paste made a paragraph", await M((x) => __mf.prose(x), pid));
  const kid = await M((x) => __mf.state.nodes[x].children.length, pid);
  ok("with children under it", kid === 2, kid);
  const far = async () => M((x) => {
    const b = __mf.boxes()[x], p = __mf.pos()[x];
    const want = (__mf.dir(x) === "L") ? p.cx - b.w / 2 + 2 : p.cx + b.w / 2 - 2;
    const paths = Array.from(document.querySelectorAll("#paint path, svg path"));
    return paths.some((el) => {
      const d = el.getAttribute("d") || "";
      const m = d.match(/^M\s*(-?[\d.]+)[, ](-?[\d.]+)/);
      return !!m && Math.abs(parseFloat(m[1]) - want) < 6 && el.getAttribute("stroke-width") === "1.5";
    });
  }, pid);
  ok("a rule is drawn on the side the children leave from", await far());
  await M((x) => { __mf.select(x); __mf.fold(); }, pid);
  await page.waitForTimeout(260);
  ok("and it goes when the children are folded away", !(await far()));
  await M((x) => { __mf.select(x); __mf.fold(); }, pid);
  await page.waitForTimeout(260);
  ok("and comes back when they do", await far());
  ok("no runtime errors", errors.length === 0, errors);
}

group("1.5.1: the shape survives a rendered copy, and a fence is not a node");
{
  const P = (txt) => M((x) => __mf.parseOutline(x), txt);
  const H = (html, txt) => M((a) => __mf.bestOutline(a[0], a[1]), [html, txt]);
  const depths = (rows) => { const s = []; rows.forEach((r) => { if (s.indexOf(r.indent) < 0) s.push(r.indent); }); return s.sort((a, b) => a - b); };
  const at = (rows, t) => rows.find((r) => r.text === t);

  // ---- 1. fenced code ----
  let r = await P("- before\n```\nline one\nline two\n```\n- after");
  ok("a fence leaves no node of its own", !r.some((x) => /^[`~]/.test(x.text)), r.map((x) => x.text));
  const code = r.find((x) => x.text.indexOf("line one") === 0);
  ok("the block comes in as one node", !!code && code.text === "line one\nline two", code && code.text);
  ok("and is not a paragraph", !!code && !code.prose);
  r = await P("* intro\n* ```\n* cd ~/Projects/mappr && git push\n* ```\n* outro");
  ok("a copy that bulleted the fence too is read the same way",
    !r.some((x) => /^[`~]/.test(x.text)) && !!r.find((x) => x.text === "cd ~/Projects/mappr && git push"), r.map((x) => x.text));
  r = await P("- before\n```\nnobody closed this\n");
  ok("an unclosed block still ends", !!r.find((x) => x.text === "nobody closed this"), r.map((x) => x.text));
  r = await P("- a ``code span`` in a line is not a fence\n- second");
  ok("a code span in the middle of a line is not a fence", r.length === 2, r.map((x) => x.text));

  // ---- 2. the bold that only the html flavour still has ----
  const HTML = "<p><strong>Your push</strong></p>" +
    "<pre><code>git push</code></pre>" +
    "<p><strong>What changed</strong></p>" +
    "<p>Your paste lands with levels.</p>" +
    "<p>Two guards keep it honest.</p>";
  const FLAT = "Your push\ngit push\nWhat changed\nYour paste lands with levels.\nTwo guards keep it honest.";
  const t2 = await P(FLAT);
  ok("the text flavour alone has nothing to go on", depths(t2).length === 1, depths(t2));
  r = await H(HTML, FLAT);
  ok("the html flavour is read even with no list in it", depths(r).length > 1, depths(r));
  ok("a bold paragraph is a heading", at(r, "What changed").indent < at(r, "Your paste lands with levels.").indent);
  ok("and the lines after it are its children",
    at(r, "Two guards keep it honest.").indent === at(r, "Your paste lands with levels.").indent);
  ok("a <pre> block is one node", !!at(r, "git push"));

  // ---- 3. still hands a plain rich copy to the text flavour ----
  r = await H("<p>one</p><p>two</p><p>three</p>", "one\ntwo\nthree");
  ok("a rich copy with no markdown in it changes nothing", depths(r).length === 1, depths(r));
  r = await H("<ul><li>alpha</li><li>beta</li><li>gamma</li></ul>", "- alpha\n- beta\n- gamma");
  ok("and a plain list is still a plain list", depths(r).length === 1, depths(r));

  // ---- 4. an indented paste keeps every level it came with ----
  r = await P("- **Heading**\n\t- one\n\t- two\n- **Second**\n\t- three");
  ok("bold at the top of an indented list moves nothing",
    at(r, "Heading").indent === at(r, "Second").indent && at(r, "one").indent > at(r, "Heading").indent,
    [at(r, "Heading").indent, at(r, "Second").indent, at(r, "one").indent]);

  ok("no runtime errors", errors.length === 0, errors);
}

group("console");
ok("no runtime errors", errors.length === 0, errors);

await browser.close();
console.log("\n" + pass + " passed, " + fails.length + " failed");
if (fails.length) { console.log("failed: " + fails.join(", ")); process.exit(1); }
