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
  ok("plain delete still takes one node and its branch", !(await node("C")));
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

  // A real copy event must carry both flavours.
  const copied = await M(() => {
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

group("focus by right-click");
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

  await rightClick("Trunk");
  ok("right-click on a node focuses into it", (await M(() => __mf.focus)) !== null);
  ok("it focuses the node that was clicked", (await M(() => __mf.state.nodes[__mf.focus].text)) === "Trunk");

  // Empty canvas steps back out, the same as Escape.
  await page.mouse.click(40, 620, { button: "right" });
  await page.waitForTimeout(250);
  ok("right-click on empty canvas steps back out", (await M(() => __mf.focus)) === null);

  // A node with nothing under it has nothing to focus into.
  await rightClick("Leaf one");
  ok("a childless node does not focus", (await M(() => __mf.focus)) === null);

  // The browser's own menu stays available inside the text you are typing.
  await M(() => { __mf.select(Object.values(__mf.state.nodes).find((n) => n.text === "Trunk").id); });
  await key("Space");
  await rightClick("Trunk");
  ok("right-click while typing does not focus", (await M(() => __mf.focus)) === null);
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

group("console");
ok("no runtime errors", errors.length === 0, errors);

await browser.close();
console.log("\n" + pass + " passed, " + fails.length + " failed");
if (fails.length) { console.log("failed: " + fails.join(", ")); process.exit(1); }
