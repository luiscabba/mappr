/**
 * Mappr performance benchmark.
 *
 *   node tests/bench.mjs
 *   node tests/bench.mjs --json before.json
 *
 * Measures the things that scale with map size and with how many maps are saved:
 * full render cost, the save round-trip, the cost of creating one node, and how
 * much the undo stack holds. Each scenario runs in its own browser context so
 * localStorage really is empty (the app saves on `beforeunload`, so clearing
 * storage and reloading the same page does not reset anything).
 */
import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = "file://" + path.resolve(HERE, "..", "index.html");
const EXEC = process.env.CHROMIUM || undefined;
const jsonAt = process.argv.includes("--json") ? process.argv[process.argv.indexOf("--json") + 1] : null;

const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {});
const results = {};
const row = (label, ms, extra) =>
  console.log("  " + label.padEnd(30) + String(ms).padStart(9) + (typeof ms === "number" ? " ms" : "   ") + (extra ? "   " + extra : ""));

let ctx = null;
async function fresh() {
  if (ctx) await ctx.close();
  ctx = await browser.newContext({ viewport: { width: 1500, height: 920 } });
  const page = await ctx.newPage();
  await page.goto(APP);
  await page.waitForFunction(() => !!window.__mf);
  return page;
}

// A branchy outline roughly `target` lines long: branches of 6 topics of 3 leaves.
function outline(target) {
  const lines = [];
  let n = 0;
  for (let b = 0; n < target; b++) {
    lines.push("- Branch " + b); n++;
    for (let i = 0; i < 6 && n < target; i++) {
      lines.push("  - Topic " + b + "." + i); n++;
      for (let j = 0; j < 3 && n < target; j++) { lines.push("    - Leaf " + b + "." + i + "." + j); n++; }
    }
  }
  return lines.join("\n");
}
const build = async (size) => {
  const page = await fresh();
  await page.evaluate((o) => __mf.paste(o), outline(size));
  await page.waitForTimeout(600); // edits save on a 400ms debounce
  return page;
};

/* ---------- 1. render cost vs map size ---------- */
console.log("\nrender cost (one full render, median of 15)");
results.render = {};
for (const size of [50, 200, 600, 1200]) {
  const page = await build(size);
  const r = await page.evaluate(() => {
    const id = __mf.selected, t = [];
    for (let i = 0; i < 15; i++) { const a = performance.now(); __mf.select(id); t.push(performance.now() - a); }
    t.sort((x, y) => x - y);
    return { ms: Math.round(t[7] * 100) / 100, nodes: Object.keys(__mf.state.nodes).length };
  });
  results.render[r.nodes] = r.ms;
  row(r.nodes + " nodes", r.ms);
}

/* ---------- 2. save round-trip vs library size ---------- */
console.log("\nsave round-trip (read whole library, re-serialise, write it back)");
results.save = {};
for (const per of [120, 600]) {
  console.log("  maps of ~" + per + " nodes each");
  const page = await build(per);
  for (const maps of [1, 5, 15, 30]) {
    const r = await page.evaluate((maps) => {
      // Works against either storage scheme so before/after are comparable.
      const NEW = !!localStorage.getItem("mappr.index");
      try {
        if (NEW) {
          const idx = JSON.parse(localStorage.getItem("mappr.index"));
          const firstId = Object.keys(idx.docs)[0];
          const one = JSON.parse(localStorage.getItem("mappr.doc." + firstId));
          const l = { current: "bench0", docs: {} };
          for (let i = 0; i < maps; i++) {
            const c = JSON.parse(JSON.stringify(one));
            c.id = "bench" + i; c.name = "Map " + i;
            localStorage.setItem("mappr.doc.bench" + i, JSON.stringify(c));
            l.docs[c.id] = { id: c.id, name: c.name, count: c.count, updated: Date.now() };
          }
          localStorage.setItem("mappr.index", JSON.stringify(l));
          const t = [];
          for (let i = 0; i < 15; i++) {
            const a = performance.now();
            const d = JSON.parse(localStorage.getItem("mappr.doc.bench0"));
            d.updated = Date.now();
            localStorage.setItem("mappr.doc.bench0", JSON.stringify(d));
            const x = JSON.parse(localStorage.getItem("mappr.index"));
            x.docs["bench0"].updated = d.updated;
            localStorage.setItem("mappr.index", JSON.stringify(x));
            t.push(performance.now() - a);
          }
          t.sort((x, y) => x - y);
          let kb = 0;
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k.indexOf("mappr.") === 0) kb += localStorage.getItem(k).length;
          }
          return { ms: Math.round(t[7] * 100) / 100, kb: Math.round(kb / 1024) };
        }
        const lib = JSON.parse(localStorage.getItem("mappr.lib"));
        const one = lib.docs[Object.keys(lib.docs)[0]];
        const l = { current: "bench0", docs: {} };
        for (let i = 0; i < maps; i++) {
          const c = JSON.parse(JSON.stringify(one));
          c.id = "bench" + i; c.name = "Map " + i; l.docs[c.id] = c;
        }
        localStorage.setItem("mappr.lib", JSON.stringify(l));
        const t = [];
        for (let i = 0; i < 15; i++) {
          const a = performance.now();
          const x = JSON.parse(localStorage.getItem("mappr.lib"));
          x.docs["bench0"].updated = Date.now();
          localStorage.setItem("mappr.lib", JSON.stringify(x));
          t.push(performance.now() - a);
        }
        t.sort((x, y) => x - y);
        return { ms: Math.round(t[7] * 100) / 100, kb: Math.round(localStorage.getItem("mappr.lib").length / 1024) };
      } catch (e) { return { quota: true }; }
    }, maps);
    results.save[per + "n/" + maps + "maps"] = r;
    if (r.quota) row("    " + maps + " saved maps", "QUOTA", "localStorage full, the save silently fails");
    else row("    " + maps + " saved map" + (maps > 1 ? "s" : ""), r.ms, r.kb + " KB stored");
  }
  if (per !== 600) continue;
  // how many maps fit at all
  const cap = await page.evaluate(() => {
    const NEW = !!localStorage.getItem("mappr.index");
    let one, put;
    if (NEW) {
      const idx = JSON.parse(localStorage.getItem("mappr.index"));
      one = localStorage.getItem("mappr.doc." + Object.keys(idx.docs)[0]);
      put = (n) => localStorage.setItem("mappr.doc.cap" + n, one);
    } else {
      const lib = JSON.parse(localStorage.getItem("mappr.lib"));
      const d = lib.docs[Object.keys(lib.docs)[0]];
      const l = { current: null, docs: {} };
      put = (n) => { l.docs["cap" + n] = d; localStorage.setItem("mappr.lib", JSON.stringify(l)); };
    }
    let n = 0;
    try { for (n = 1; n <= 400; n++) put(n); } catch (e) { return n - 1; }
    return n;
  });
  results.capMaps = cap;
  console.log("  ceiling: " + cap + " maps of ~120 nodes before localStorage is full");
}

/* ---------- 3. cost of creating one node ---------- */
console.log("\ncost of creating one node (mutate + undo snapshot + render, median of 20)");
results.newNode = {};
for (const size of [50, 600, 1500]) {
  const page = await build(size);
  const r = await page.evaluate(() => {
    __mf.select(__mf.state.rootId);
    const t = [];
    for (let i = 0; i < 20; i++) { const a = performance.now(); __mf.child(); t.push(performance.now() - a); }
    t.sort((x, y) => x - y);
    return { ms: Math.round(t[10] * 100) / 100, nodes: Object.keys(__mf.state.nodes).length };
  });
  results.newNode[r.nodes] = r.ms;
  row("in a " + r.nodes + "-node map", r.ms);
}

/* ---------- 3b. the two keys pressed most: a letter while typing, an arrow ---------- */
console.log("\ntyping and moving (median of 20, nothing selected)");
results.keys = {};
for (const size of [600, 1500]) {
  const page = await build(size);
  const r = await page.evaluate(() => {
    __mf.mark([]);
    const ids = Object.keys(__mf.state.nodes);
    __mf.select(ids[Math.floor(ids.length / 2)]);
    const move = [];
    for (let i = 0; i < 20; i++) { const a = performance.now(); __mf.arrow(i % 2 ? "D" : "U"); move.push(performance.now() - a); }
    move.sort((x, y) => x - y);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    const type = [];
    for (let i = 0; i < 20; i++) { const a = performance.now(); document.execCommand("insertText", false, "x"); type.push(performance.now() - a); }
    type.sort((x, y) => x - y);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return { nodes: ids.length, move: Math.round(move[10] * 100) / 100, type: Math.round(type[10] * 100) / 100 };
  });
  results.keys[r.nodes] = { move: r.move, type: r.type };
  row("a letter, in a " + r.nodes + "-node map", r.type);
  row("an arrow, in a " + r.nodes + "-node map", r.move);
}

/* The same keystroke, on a map whose every row is numbered. Until 1.4.0 the
   measure cache stored a key without the node's figure in it while looking one
   up with the figure, so the two could never match and every numbered node
   re-measured on every render. This row is what shows that. */
{
  const page = await build(1500);
  const r = await page.evaluate(() => {
    __mf.mark([]);
    const s = __mf.state;
    Object.keys(s.nodes).forEach((id) => { if (s.nodes[id].children.length) s.nodes[id].num = true; });
    __mf.set("numStyle", "box");
    const ids = Object.keys(s.nodes);
    __mf.select(ids[Math.floor(ids.length / 2)]);
    const move = [];
    for (let i = 0; i < 20; i++) { const a = performance.now(); __mf.arrow(i % 2 ? "D" : "U"); move.push(performance.now() - a); }
    move.sort((x, y) => x - y);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    const type = [];
    for (let i = 0; i < 20; i++) { const a = performance.now(); document.execCommand("insertText", false, "x"); type.push(performance.now() - a); }
    type.sort((x, y) => x - y);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    const again = __mf.reMeasured;
    return { nodes: ids.length, again: again, move: Math.round(move[10] * 100) / 100, type: Math.round(type[10] * 100) / 100 };
  });
  results.keysNumbered = { move: r.move, type: r.type, again: r.again };
  row("a letter, in a numbered " + r.nodes + "-node map", r.type);
  row("an arrow, in a numbered " + r.nodes + "-node map", r.move);
  console.log("  " + "nodes re-measured per keystroke".padEnd(34) + String(r.again).padStart(6) + "   ");
}

/* ---------- 3b. navi on a wide row ----------
   The rail used to build one row per sibling on every selection change, so a
   forty-wide row cost forty rows built and written. Capped, it should cost
   less than it did. */
console.log("\nnavi on a 40-sibling row (median of 20 selection changes, 1500-node map)");
{
  const page = await build(1500);
  const r = await page.evaluate(() => {
    __mf.mark([]);
    __mf.set("hereShow", "always");
    const s = __mf.state, root = s.nodes[s.rootId];
    const host = s.nodes[root.children[0]];
    /* build the wide row straight into the model, then lay it out once */
    let n = host.children.length, guard = 0;
    while (host.children.length < 40 && guard++ < 200) {
      const id = "wb" + guard;
      s.nodes[id] = { id: id, parent: host.id, children: [], text: "sib " + (n++), dir: host.dir };
      host.children.push(id);
    }
    __mf.select(host.id);
    const row = host.children.slice(0, 40);
    const t = [];
    for (let i = 0; i < 20; i++) { const a = performance.now(); __mf.select(row[i % row.length]); t.push(performance.now() - a); }
    t.sort((x, y) => x - y);
    return { nodes: Object.keys(s.nodes).length, sel: Math.round(t[10] * 100) / 100, rows: (__mf.naviRows && __mf.naviRows()) ? __mf.naviRows().sibs : -1 };
  });
  results.navi = { sel: r.sel, rows: r.rows };
  row("a selection change, " + r.nodes + " nodes", r.sel);
  row("rail rows built per change", String(r.rows), "");
}

/* ---------- 4. undo stack memory ---------- */
console.log("\nundo stack");
{
  const page = await build(600);
  const r = await page.evaluate(() => {
    for (let i = 0; i < 200; i++) __mf.child();
    const one = JSON.stringify({ s: __mf.state, sel: __mf.selected, f: __mf.focus }).length;
    const held = (typeof __mf.undoBytes === "number") ? __mf.undoBytes : one * 140;
    const steps = (typeof __mf.undoSteps === "number") ? __mf.undoSteps : 140;
    return {
      nodes: Object.keys(__mf.state.nodes).length,
      kb: Math.round(one / 1024),
      heldMB: Math.round(held / 1048576 * 10) / 10,
      steps: steps
    };
  });
  results.undo = r;
  console.log("  " + r.kb + " KB per snapshot in a " + r.nodes + "-node map");
  console.log("  after 200 edits the stack holds " + r.heldMB + " MB over " + r.steps + " steps");
}

/* ---------- 5. renders with cross-links, in each view ---------- */
console.log("\nrender with 150 cross-links in a 1200-node map (median of 9 selection renders)");
{
  const page = await build(1200);
  await page.evaluate(() => {
    const ids = Object.keys(__mf.state.nodes); let s = 7;
    const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 150; i++) { const a = ids[Math.floor(r() * ids.length)], b = ids[Math.floor(r() * ids.length)]; if (a !== b) __mf.state.links.push({ a, b }); }
  });
  results.links = {};
  const hasNetView = await page.evaluate(() => typeof __mf.netView === "function");
  const setView = (v) => page.evaluate((v) => { if (__mf.cfg.netView !== undefined) __mf.set("netView", v); }, v);
  await setView("dim");
  const views = [["map", () => __mf.setLens("off")], ["dimmed", () => __mf.setLens("dim")],
                 /* the biggest network on the map, so the arrange has real work in it */
                 ["one network", () => { const nets = __mf.networks ? __mf.networks() : null; const big = nets ? nets.slice().sort((a, b) => b.length - a.length)[0] : null; __mf.setLens("one", big ? big[0] : __mf.state.links[0].a); }],
                 ["presenting", () => { __mf.setLens("off"); __mf.present(); }]];
  const selRenders = () => page.evaluate(() => {
    const ids = Object.keys(__mf.state.nodes), xs = [];
    for (let i = 0; i < 9; i++) { const t0 = performance.now(); __mf.select(ids[i * 13 + 1]); xs.push(performance.now() - t0); }
    xs.sort((a, b) => a - b); return Math.round(xs[4] * 10) / 10;
  });
  for (const [label, fn] of views) {
    await page.evaluate(fn); await page.waitForTimeout(250);
    const r0 = await page.evaluate(() => __mf.arrangeRuns ? __mf.arrangeRuns() : null);
    const ms = await selRenders();
    const extra = await page.evaluate((r0) => {
      const n = __mf.lens === "one" ? __mf.shown - 1 : null;
      return (n != null ? n + " nodes in it" : "") + (r0 != null && __mf.lens === "one" ? ", " + (__mf.arrangeRuns() - r0) + " relaxations over 9 renders" : "");
    }, r0);
    results.links[label] = ms; row("  " + label, ms, extra);
  }
  await page.evaluate(() => { __mf.presEnd(); __mf.setLens("off"); });
  /* one dense network on its own: 40 nodes tied in a ring with chords, which
     is where the relaxation itself, not the render, is the cost */
  const nLinks = await page.evaluate(() => __mf.state.links.length);
  await page.evaluate(() => {
    const ids = Object.keys(__mf.state.nodes).filter((i) => i !== __mf.state.rootId).slice(200, 240);
    window.__benchRing = ids;
    for (let i = 0; i < ids.length; i++) { __mf.state.links.push({ a: ids[i], b: ids[(i + 1) % ids.length] }); if (i % 4 === 0) __mf.state.links.push({ a: ids[i], b: ids[(i + 7) % ids.length] }); }
    __mf.setLens("one", ids[0]);
  });
  await page.waitForTimeout(250);
  {
    const r0 = await page.evaluate(() => __mf.arrangeRuns ? __mf.arrangeRuns() : null);
    const ms = await page.evaluate(() => {
      const row = Object.keys(__mf.pos()).filter((i) => i !== __mf.state.rootId), xs = [];
      for (let i = 0; i < 9; i++) { const t0 = performance.now(); __mf.select(row[i % row.length]); xs.push(performance.now() - t0); }
      xs.sort((a, b) => a - b); return Math.round(xs[4] * 10) / 10;
    });
    const extra = await page.evaluate((r0) => (__mf.shown - 1) + " nodes in it" + (r0 != null ? ", " + (__mf.arrangeRuns() - r0) + " relaxations over 9 renders" : ""), r0);
    results.links["one dense network"] = ms; row("  one dense network", ms, extra);
    await page.evaluate(() => __mf.setLens("off"));
  }
  /* the arranged view (1.7.0): entering it, a keystroke while it is open, and a fold in one network */
  if (!hasNetView) { row("  networks", "n/a", "no netView in this build"); }
  else {
    await setView("arranged"); await page.waitForTimeout(200);
    const enter = await page.evaluate(() => {
      const xs = [];
      for (let i = 0; i < 5; i++) { __mf.setLens("off"); const t0 = performance.now(); __mf.setLens("dim"); xs.push(performance.now() - t0); }
      xs.sort((a, b) => a - b); return { ms: Math.round(xs[2] * 10) / 10, nets: __mf.networks().length, shown: __mf.shown };
    });
    results.links["networks: enter"] = enter.ms; row("  networks: enter", enter.ms, enter.nets + " networks, " + enter.shown + " nodes shown");
    const keyMs = await page.evaluate(() => {
      const row = __mf.networks().map((c) => c[0]), xs = [], r0 = __mf.arrangeRuns();
      for (let i = 0; i < 9; i++) { const t0 = performance.now(); __mf.select(row[i % row.length]); xs.push(performance.now() - t0); }
      xs.sort((a, b) => a - b); return { ms: Math.round(xs[4] * 10) / 10, runs: __mf.arrangeRuns() - r0 };
    });
    results.links["networks: keystroke"] = keyMs.ms; row("  networks: keystroke", keyMs.ms, keyMs.runs + " relaxations");
    const foldMs = await page.evaluate(() => {
      /* the second node of the dense ring: folding the first would hide the whole network, which is no arrange at all */
      const at = window.__benchRing[1];
      const r0 = __mf.arrangeRuns(); __mf.select(at);
      const t0 = performance.now(); __mf.lensFoldToggle(at); const ms = performance.now() - t0;
      __mf.lensFoldToggle(at);
      return { ms: Math.round(ms * 10) / 10, runs: __mf.arrangeRuns() - r0, nets: __mf.networks().length };
    });
    if (foldMs) { results.links["networks: fold"] = foldMs.ms; row("  networks: fold one", foldMs.ms, foldMs.runs + " relaxations for the fold and unfold, " + foldMs.nets + " networks on screen"); }
    await page.evaluate(() => __mf.setLens("off"));
  }
  /* 1.8.0, reworked in 1.9.0: a handed-over branch with several holders. The
     tie is an ordinary one now, so this is eight plain ties onto one branch.
     Entering the view against the same map, and a tick, which should not
     appear at all. */
  if (!hasNetView) { row("  a held branch", "n/a", "no netView in this build"); }
  else {
    await setView("arranged");
    const made = await page.evaluate(() => {
      const s = __mf.state, ids = Object.keys(s.nodes);
      /* a node with a decent number of children is the source; eight holders */
      const size = (i) => { let n = 0; (function w(x) { n++; s.nodes[x].children.forEach(w); })(i); return n; };
      const src = ids.filter((i) => s.nodes[i].children.length >= 4 && size(i) <= 40)
        .sort((a, b) => s.nodes[b].children.length - s.nodes[a].children.length)[0];
      if (!src) return null;
      const inside = {}; (function w(i) { inside[i] = 1; s.nodes[i].children.forEach(w); })(src);
      const up = {}; { let n = s.nodes[src]; while (n) { up[n.id] = 1; n = n.parent ? s.nodes[n.parent] : null; } }
      const holders = ids.filter((i) => !inside[i] && !up[i] && !s.nodes[i].children.length).slice(0, 8);
      /* the holder is the node you start from, the branch the node you click */
      holders.forEach((h) => __mf.tie(h, src));
      return { src: src, holders: holders.length, items: __mf.holdItems(src).length };
    });
    if (!made) row("  a held branch", "n/a", "no branch wide enough in this map");
    else {
      for (const g of ["off", "chips", "lanes"]) {
        await page.evaluate((v) => { __mf.setLens("off"); __mf.set("netGroup", v); }, g);
        await page.waitForTimeout(120);
        const enter = await page.evaluate(() => {
          const xs = [];
          for (let i = 0; i < 5; i++) { __mf.setLens("off"); const t0 = performance.now(); __mf.setLens("dim"); xs.push(performance.now() - t0); }
          xs.sort((a, b) => a - b);
          return { ms: Math.round(xs[2] * 10) / 10, chips: __mf.chipRows() + __mf.cells() };
        });
        results.links["held branch: enter (" + g + ")"] = enter.ms;
        row("  held branch: enter (" + g + ")", enter.ms, made.holders + " holders, " + made.items + " items, " + enter.chips + " chip elements");
      }
      await page.evaluate((v) => { __mf.setLens("off"); __mf.set("netGroup", v); __mf.setLens("dim"); }, "chips");
      await page.waitForTimeout(120);
      const tick = await page.evaluate((src) => {
        /* only the holders of THIS branch: every tie is a hand-over now, so
           holders() lists the whole map and an arbitrary one would tick nothing */
        const items = __mf.holdItems(src), hs = __mf.holders().filter((h) => h.source === src), xs = [], r0 = __mf.arrangeRuns();
        if (!hs.length || !items.length) return { ms: 0, runs: 0, none: true };
        for (let i = 0; i < 9; i++) {
          const t0 = performance.now();
          __mf.tickHold(hs[i % hs.length].holder, items[i % items.length]);
          xs.push(performance.now() - t0);
        }
        xs.sort((a, b) => a - b);
        return { ms: Math.round(xs[4] * 10) / 10, runs: __mf.arrangeRuns() - r0 };
      }, made.src);
      results.links["held branch: tick"] = tick.ms;
      row("  held branch: tick a chip", tick.ms, tick.runs + " relaxations");
      await page.evaluate((n2) => { __mf.setLens("off"); __mf.state.links.length = n2; }, nLinks);
    }
  }
  await page.evaluate((n) => { __mf.state.links.length = n; }, nLinks);
}

/* ---------- 6. a talk step, in reach "told" and reach "all" ---------- */
console.log("\na talk step (__mf.presNext) in a 1500-node map (median of 9)");
{
  results.pres = {};
  for (const reach of ["told", "all"]) {
    const page = await build(1500);
    const r = await page.evaluate((reach) => {
      if (__mf.cfg.presReach !== undefined) __mf.set("presReach", reach);
      else if (reach === "all") return null;
      __mf.present();
      const xs = [], d0 = __mf.drawn;
      for (let i = 0; i < 9; i++) { const t0 = performance.now(); __mf.presNext(); xs.push(performance.now() - t0); }
      const drawn = (__mf.drawn === undefined) ? null : Math.round((__mf.drawn - d0) / 9);
      __mf.presEnd();
      xs.sort((a, b) => a - b); return { ms: Math.round(xs[4] * 10) / 10, drawn };
    }, reach);
    if (r == null) { row("  reach " + reach, "n/a", "no presReach in this build"); continue; }
    results.pres[reach] = r.ms; row("  reach " + reach, r.ms, r.drawn == null ? "" : r.drawn + " shapes drawn fresh per step");
  }
}

/* ---------- 7. orbital zoom: what a pinch costs ----------
   Zooming was free before 1.10.0 and has to stay that way. A gesture inside
   one band must render nothing at all; a gesture that crosses four thresholds
   gets four renders and no more, whatever the wheel emitted. */
console.log("\na pinch in a 1500-node map (60 wheel steps, one animation frame apart; the time is the zoom's own work)");
{
  results.orbit = {};
  const page = await build(1500);
  const r = await page.evaluate(async () => {
    if (!__mf.curtain) return null;
    const hasRC = typeof __mf.renderCount === "function";
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    /* only the work the zoom itself does is timed; the frame waits in between
       are the harness standing in for a real gesture, not part of the cost */
    let work = 0;
    const zoomTo = async (z) => { const v = __mf.cam(), t = performance.now(); __mf.setView(v.x, v.y, z); work += performance.now() - t; await frame(); };
    const out = {};
    for (const mode of ["shrink", "hold"]) {
      __mf.set("orbitSize", mode);
      await zoomTo(1); await frame();
      /* inside one band: 100% down to 26%, the whole working range, which
         never crosses the 25% the curtain now starts at */
      let n0 = hasRC ? __mf.renderCount() : 0; work = 0;
      for (let i = 0; i < 60; i++) await zoomTo(1 - i * (0.74 / 59));
      out[mode + "Band"] = { ms: Math.round(work * 10) / 10, renders: hasRC ? __mf.renderCount() - n0 : null };
      /* the whole pinch: 100% to 8%, four thresholds */
      await zoomTo(1); await frame();
      n0 = hasRC ? __mf.renderCount() : 0; work = 0;
      for (let i = 0; i < 60; i++) await zoomTo(1 - i * (0.92 / 59));
      await frame();
      out[mode + "Pinch"] = { ms: Math.round(work * 10) / 10, renders: hasRC ? __mf.renderCount() - n0 : null, hidden: __mf.curtainHidden().length, floor: Math.round(__mf.orbitFloor() * 100) / 100 };
    }
    __mf.set("orbitSize", "shrink");
    return out;
  });
  if (r == null) row("  orbital zoom", "n/a", "not in this build");
  else {
    results.orbit = r;
    row("  inside one band, shrink", r.shrinkBand.ms, r.shrinkBand.renders + " renders");
    row("  100% to 8%, shrink", r.shrinkPinch.ms, r.shrinkPinch.renders + " renders, " + r.shrinkPinch.hidden + " nodes off screen at the end");
    row("  inside one band, hold", r.holdBand.ms, r.holdBand.renders + " renders");
    row("  100% to 8%, hold", r.holdPinch.ms, r.holdPinch.renders + " renders, floor " + r.holdPinch.floor);
  }
}

await browser.close();
if (jsonAt) { fs.writeFileSync(jsonAt, JSON.stringify(results, null, 2)); console.log("\nwrote " + jsonAt); }
console.log("");
