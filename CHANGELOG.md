# Changelog

All notable changes to Mappr. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions follow semver.

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
