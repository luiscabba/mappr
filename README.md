# Mappr

A keyboard-first mindmap app in one HTML file. No build server, no install, no
network. Open `index.html` and start typing.

The point of it is speed: how fast you can create a branch and name it. Every
control is a key, the layout tidies itself after every keystroke, and the camera
follows you so you never have to stop and pan.

![Mappr](docs/screenshot.png)

---

## Run it

```
open index.html
```

That is the whole thing. It works from a `file://` URL, offline, with the font
embedded. Your maps live in that browser's `localStorage` under `mappr.lib`.

## Build it

`index.html` is generated. Do not edit it by hand.

```
python3 build.py        # src/app.html + assets/Excalifont-Regular.woff2 -> index.html
```

The build does two substitutions and nothing else:

| token | becomes |
| --- | --- |
| `__FONT_B64__` | base64 of `assets/Excalifont-Regular.woff2` |
| `__VERSION__` | contents of `VERSION` |

Edit `src/app.html`, run `python3 build.py`, reload the browser.

## Test it

```
npm install playwright        # once
node tests/smoke.mjs
```

The suite drives real key events in headless Chromium and checks the resulting
tree shape, the layout (no overlapping nodes at any setting), the camera, the
outline round-trip, frames and the SVG/PNG export. It prints a summary and exits
non-zero on failure. Run it before every commit; it has caught several real bugs
that were invisible on screen.

If Chromium is not where Playwright expects it, set `CHROMIUM` first:

```
CHROMIUM=/path/to/chromium node tests/smoke.mjs
```

---

## How it is put together

One file, one IIFE, no dependencies. Roughly in reading order:

| Section | What lives there |
| --- | --- |
| **Settings** | `DEFAULTS` / `CFG`, the palettes, and the size / spacing tables. Every visual choice in the app is a key on `CFG`. |
| **Model** | `state = { rootId, nodes, frames }`. A node is `{id, parent, children[], text, dir, collapsed, mark}`. `dir` is `L`/`R`/`U`/`D` and governs which way its subtree grows. |
| **Mutations** | `addNode`, `removeNode`, `branch`, `navigate`, undo/redo snapshots. |
| **Layout** | A tidy-tree. `measureSubtree` computes cross-axis extents, `placeSubtree` assigns centres, `layout()` runs it once per direction group out of the view root. Pure function of `box` (measured DOM sizes) and `CFG`. |
| **Drawing** | Hand-drawn geometry: `wline` wobbles a line, `roughRect` a rectangle, `hachure` a fill. All seeded per element id so shapes never shimmer between renders. |
| **Render** | `render()` syncs DOM nodes, measures them, lays out, then `paint()` regenerates the whole SVG in one `innerHTML` write. |
| **Camera** | `cameraTo` keeps the active node inside a comfort rect and leads in the direction of growth. `fitAll` / `fitHere`. |
| **Frames** | A frame is just `{id, title, roots[]}`. Its rectangle is recomputed from its members' positions every render, so it can never go stale. |
| **Export** | `shapes()` is shared by the screen and the exporter. `textSvgFor` walks DOM ranges to recover wrapped line boxes and emits real `<text>`, so exported SVG keeps live text. |
| **Panels** | Style panel is generated from the `PANEL` array. Jump palette, map library, export menu. |
| **Persistence** | `mappr.lib` in `localStorage`: `{current, docs:{id:{name,count,updated,state,cfg,...}}}`. A map is named after its centre node. |

### Two rules worth knowing before you change anything

1. **The panels must never take the keyboard.** Every floating panel calls
   `preventDefault()` on `mousedown`. Break this and clicking a setting
   mid-sentence kicks you out of the node you were typing in.
2. **Children inherit their parent's `dir`.** Only the root (and a focused node)
   branches in four directions. `layout()` passes one direction down a whole
   subtree, so a node whose stored `dir` disagrees with its branch will render in
   the wrong place. `setDirDeep` exists for exactly this.

### Node size and layout

Nodes are real HTML `div`s, so the browser does the text wrapping and the boxes
size themselves. Everything else (boxes, arrows, frames, selection) is SVG drawn
underneath at the measured positions. That split is why text editing feels
native and the drawing still looks hand-made.

---

## Keys

Press `?` in the app for the full list. The ones that matter:

| | |
| --- | --- |
| `⏎` | new node beside this one, same level |
| `⇧⏎` | same level, next branch along |
| `⌘⏎` | a child, one level deeper |
| `⌘←↑→↓` | branch in a direction; same direction again goes deeper |
| hold `Tab` + arrow | insert a node *in between* (backtrack, add a parent layer) |
| arrows | walk the tree; while typing they commit and move |
| `Tab` | cycle every node at the same level |
| `Space` | retype the selected node |
| `⌥←↑→↓` | move the node itself: reorder, promote, demote |
| `⌘E` | fold / unfold a branch |
| `⌘K` | jump to any node by typing |
| `⌘0` | zoom out to the whole map |
| `⌘G` | wrap the selection in a frame |
| `⌘C` / `⇧⌘C` | copy as outline / as an image |
| `⌘,` | style panel |

---

## Roadmap

Not built yet, roughly in the order worth doing:

- [ ] Frame-aware layout, so a frame is a real container and outside nodes cannot
      drift into its rectangle
- [ ] Node notes: a longer body behind a short label
- [ ] Presentation mode: step through branches one at a time
- [ ] Speed instrumentation (nodes per minute, keystrokes per node) to actually
      measure the thing this app exists to test
- [ ] Images inside nodes
- [ ] A real file format and cross-device sync, if this ever ships

## Versioning

Semver, tagged. `VERSION` is the single source of truth and the build stamps it
into the app; you can see it in the corner of the keys dialog. Bump `VERSION`,
rebuild, update `CHANGELOG.md`, commit, then tag:

```
git tag -a v0.8.0 -m "…"
git push --follow-tags
```
