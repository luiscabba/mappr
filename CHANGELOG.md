# Changelog

All notable changes to Mappr. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions follow semver.

## [0.10.2] - 2026-09-15

### Changed
- **Deleting a map asks once.** It was a single unconfirmed click that removed
  the map's storage key outright, with no undo: the node undo stack does not
  reach map-level operations, so a slip lost the map for good. The button now
  arms on the first click, reading `Sure?`, and only the second click on that
  same map deletes it. It disarms itself after a few seconds, when the panel
  closes, and when anything else in the panel is clicked, so an armed button is
  never left waiting for a click that meant something else.

## [0.10.1] - 2026-09-15

### Fixed
- **Selecting a row is `⇧` + click, not `⇧` + right-click.** The gesture 0.10.0
  shipped never fired: Chrome and Firefox both reserve shift + right-click for
  their own native menu and hand it to the browser before the page sees the
  event, `preventDefault` included. There is no way for a page to be given that
  chord, so it moves to the left button, where nothing else was using it. Plain
  right-click still focuses a branch and plain click still selects a single
  node; only the modifier is new.

## [0.10.0] - 2026-09-15

### Added
- **Shift + right-click selects a sibling row.** Every child of that node's
  parent, the node itself included, in one gesture. Plain right-click still
  focuses; the modifier is the difference. It is the row, not the depth: two
  branches can both have a third level and selecting one does not reach into
  the other. The centre node of the current view has no siblings on screen, so
  it flashes rather than marking something you cannot see.
- **Fold acts on a selection.** With a row in hand, `⌘E` folds every selected
  node at once. Each one folds its own children, so the row stays on screen and
  everything under it goes: that is the level you picked, hidden. A mixed
  selection resolves one way rather than flip-flopping, folding if any of them
  is open, and the selection survives so the same key opens it again.

### Changed
- **Delete now takes exactly what was selected.** With a selection up, `⌫`
  removes those nodes and nothing else: anything underneath them that you did
  *not* select survives and reattaches to the nearest node that did, in place.
  A lasso can no longer take a branch it did not cover. Survivors that move
  inherit their new parent's direction, as children do everywhere else, and one
  that lands on the centre node keeps the direction it was already drawn with,
  so the picture does not jump. With nothing selected, `⌫` is unchanged: the
  node and its whole branch.

### Removed
- **`All around`**, from Spread. Five modes remain. A map saved in it is baked
  into the shape it was already showing rather than reshaped into a neighbour:
  the directions it was deriving are written in and the map drops to
  `As placed`, the same trade as branching against a mode. Nothing moves.

## [0.9.0] - 2026-09-15

### Added
- **Spread**, in the style panel: how the root's branches fan out. Six modes.
  `As placed` is every previous version's behaviour and stays the default, so no
  existing map changes shape. `Right and left`, `Top and bottom` and `All around`
  give the classic mindmap shapes; `All right` and `All bottom` turn the same map
  into a left-to-right tree or a top-down org chart.

  It is derived, not applied. The directions are computed at layout time rather
  than written into the nodes, so flipping between modes is a view change you can
  do freely and reverse: going back to `As placed` returns the map to exactly the
  placement you gave it. Branching *against* the current mode (pressing `⌘↑` in
  `All right`, say) hands control back: the directions on screen are written in,
  the map drops to `As placed`, nothing moves, and your placement lands.
  Branching *with* the mode is not a takeover.

  Direction now has one source of truth for the whole app, so navigation,
  `Tab` cycling, `⌥`+arrow moves and insert-between all follow what is on
  screen rather than what was once stored.

## [0.8.3] - 2026-09-15

### Added
- Copying an outline now puts a nested bullet list on the clipboard as well as
  the text. Pasting into a document, a wiki or another mindmap gives real nested
  bullets instead of lines of text, because the copy carries a `text/html`
  flavour with the `<ul>`/`<li>` structure alongside the plain text. This is the
  other half of 0.8.2: the same nesting Mappr now reads on the way in, it writes
  on the way out. Both flavours round-trip back into an empty map as the same
  map. `⌘C` and the Export menu's `Copy outline` both do it, and a frame still
  copies only itself.

## [0.8.2] - 2026-09-15

### Fixed
- Pasting an outline copied out of a rendered page now reads the clipboard's
  html flavour, not just its text. 0.8.1 taught the text parser about invisible
  indentation and bullet glyphs, which was not enough: some pages hand over
  every line flush left with no bullets at all, leaving the plain text with no
  record of depth to recover. The same copy's `text/html` still carries the real
  `<ul>`/`<li>` nesting. Both flavours are now parsed and whichever recovered
  more structure is used, so a genuine plain-text outline is never overridden by
  scaffolding html. The `Paste outline` button reads both flavours too, which
  needed `clipboard.read()` in place of `readText()`, since `readText` can only
  ever return the flattened version.

## [0.8.1] - 2026-09-15

### Added
- Outlines copied out of rendered documents now paste with their structure
  intact. Three things arrive in the clipboard that the parser used to throw
  away: indentation made of non-breaking and other invisible Unicode spaces,
  which flattened everything to one level; the `•` `◦` `▪` bullet glyphs Word
  and Google Docs nest with, which were neither stripped nor understood; and
  copies that carry no indentation at all, where the glyph is the only record of
  depth left. Depth is now read off the glyphs, in their documented order, but
  only when the indentation says nothing, so a properly indented outline is
  never second-guessed.
- Right-click focuses, as the mouse equivalent of `⌘/`. Two-finger click and
  ctrl-click are the same gesture on a Mac and all three work. On a node it focuses
  into that branch; on empty canvas it steps back out a level, the same as
  `Esc`. The native menu is suppressed across the stage so the gesture is
  consistent, except inside the node you are typing in, where the browser's own
  cut and paste menu is the useful thing. Double-click is untouched and still
  retypes a node.
- A guide on an untouched map: the first two moves, set above and below the
  centre node in the app's own hand, with the paste shortcut underneath. It is
  anchored to the node rather than the window, so it sits with it at any zoom,
  and it disappears the moment the map has any content, so there is nothing to
  dismiss. Being DOM rather than SVG, it can never end up in an export.

### Fixed
- Pasting a whole map into a new one left the pasted centre hanging off the
  "Central idea" placeholder. On a map nobody has touched yet, a pasted outline
  with a single top-level line now becomes the centre node. An outline with
  several top-level lines has no one centre to promote, so the placeholder stays
  and they branch off it as before.

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
