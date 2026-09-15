# Changelog

All notable changes to Mappr. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions follow semver.

## [0.8.0] - 2026-09-15

### Added
- An icon. The mark is a six-stroke spark drawn in the app's own hand-drawn
  style, inlined into `index.html` as an SVG favicon that follows the tab
  strip's colour scheme, with PNGs for install surfaces that cannot.
- Mappr installs. A web app manifest and a service worker make the hosted app
  installable to a dock or home screen and fully usable offline after the first
  visit, still saving to that device's own browser. An `Install` button appears
  in the bar when the browser offers it, and an `Update ready` button appears
  when a newer build has been fetched in the background, so a reload is never
  forced mid-sentence. Opened as a local file, none of this is active and the
  app is the same single self-contained file it always was.
- `tests/pwa.mjs`: serves the repo and checks the manifest, the icons, that the
  worker takes control, and that the app boots with the network switched off.
- `tests/bench.mjs`: a performance benchmark covering render cost, the save
  round-trip, the cost of creating a node and how much the undo stack holds.
- `tools/make-icons.mjs`: rasterises `assets/icon.svg` into the PNG sizes the
  manifest and iOS need.

### Changed
- Storage is one small index plus one key per map, rather than every map inside
  a single `mappr.lib` value. Saving the map you are editing no longer reads,
  re-serialises and rewrites every other map you have. With 30 maps of ~600
  nodes a save went from 35ms to under 1ms, and it no longer grows with the
  number of maps. Existing `mappr.lib` libraries are split on first open and the
  old key is removed.
- Repainting reuses the drawing it already has. Hand-drawn geometry is cached
  per shape, and each shape keeps its own SVG element, so a repaint touches only
  what actually moved instead of regenerating and reparsing the whole drawing. A
  full render of a 1200-node map went from 158ms to about 8ms.
- Node sizes are measured once and cached until the text, the classes or a
  setting change.
- Edits save on a 400ms debounce rather than synchronously on every keystroke.
  Switching map, importing and closing the tab still flush immediately.
- Creating a node in a 1500-node map went from 176ms to about 65ms overall.
- The undo stack is capped by memory as well as by steps: 140 snapshots of a
  large map could hold tens of MB of strings, and it now stops at roughly 6MB.

### Changed
- Drag-select is much louder. A marked node now carries an accent outline as
  well as a tint, and the whole selection gets one dashed box around it, so it
  reads as a set. The next keystroke acts on whatever is marked, so it should
  not be possible to miss what that is.

### Fixed
- Starting to edit a node no longer lets the browser scroll the stage; the
  camera owns that.

## [0.7.0] - 2026-09-15

### Added
- Jump palette (`⌘K`): fuzzy search across every node, with its path shown.
  Unfolds folded ancestors and steps out of focus to reach the target.
- Move and re-parent with `⌥`+arrows: reorder among siblings, promote a level,
  or demote under the previous sibling. The whole branch travels.
- Foldable branches (`⌘E`) with a `+n` badge showing what is hidden. Arrow
  navigation and `Tab` cycling skip folded subtrees.
- Multiple maps. `Maps ▾` lists every map, newest first, with copy and delete.
  A map is named after its centre node.
- `⌘D` duplicates a branch; `⌘⇧D` marks done (struck through); `⌘⇧F` flags.
- Zoom keys: `⌘0` fits the whole map and exits focus, `⇧⌘0` fits the current
  branch or frame, `⌘1` returns to 100%.

### Changed
- Persistence moved from a single `mindflow.v1` key to a `mappr.lib` library.
  Existing single maps migrate automatically on first open.

### Fixed
- Empty jump palette showed only one result (scoring sign error).

## [0.6.0] - 2026-09-15

### Added
- Renamed to **Mappr**.
- `⇧⏎` creates a node at the same level in the next branch along.
- Hold `Tab` + arrow inserts a node *in between*: pointing back toward the centre
  makes it the parent, pointing outward slides it above the children and adopts
  them.
- Frames. `⇧`+drag lassos part of the map (hand-drawn marquee with marching
  ants), `⌘G` wraps the selection, `⌘⇧G` ungroups. Frames recompute their bounds
  from their members every render.
- Image export. Real vector SVG with the font embedded and live `<text>`, plus
  2x PNG. `⇧⌘C` copies an image to the clipboard, `⌘C` copies the outline.
  Everything acts on the selected frame, or the whole map if none is selected.
- `⌘A` selects everything on screen.

### Changed
- Line break moved from `⇧⏎` to `⌥⏎`.
- `Tab` now cycles on key release so a held `Tab` can wait for an arrow.

## [0.5.0] - 2026-09-15

### Added
- Excalidraw-style floating style panel (`⌘,`): colour mode (by depth, by branch,
  one colour), stroke and background swatches, fill style including hachure,
  stroke width and style, sloppiness, edges, arrow type, arrowheads, font, font
  size, text align, vertical align, node width, spacing, paper, theme, and
  behaviour toggles. Reset to defaults.
- Dark mode with its own palette.
- Uniform node size, which makes vertical align meaningful.

### Fixed
- The open panel used to sit on top of the hint bar and the focus trail, and the
  map could end up hidden behind it. Both now yield the left gutter.

## [0.4.0] - 2026-09-15

### Added
- Sketchbook look: Excalifont embedded as base64, hand-drawn boxes and arrows
  drawn as seeded wobbled paths, graph-paper background that pans and zooms with
  the canvas.
- Outline paste and copy. An indented list becomes a branch; the map copies back
  out as indented bullets. Tabs, spaces, bullets, numbers and markdown headings
  all read as depth. Pasting onto the centre balances the top level left/right.
- Focus mode (`⌘/`): a branch becomes the temporary centre, with a clickable
  trail across the top.

## [0.3.0] - 2026-09-15

### Added
- The camera follows: it holds still while you work mid-screen and slides only
  when you approach an edge, leading in the direction you are growing.
- Arrow keys end typing and move in one press. `⌥`+arrow still moves the caret.
- `⌘.` recentres on the selection.

## [0.2.0] - 2026-09-15

### Changed
- `⏎` now creates a node beside the current one instead of starting typing.
  `Space` retypes, `⌘⏎` goes a level deeper.
- A node left completely blank is dropped.

## [0.1.0] - 2026-09-15

### Added
- First working prototype: `⌘`+arrow branching with direction inheritance,
  `Tab` level cycling, auto-tidying four-direction layout, autosave to
  localStorage and JSON export/import.
