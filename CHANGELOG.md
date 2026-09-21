# Changelog

All notable changes to Mappr. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions follow semver.

## [1.9.1] - 2026-09-21

### Changed
- **What a holder is ticking off is the top row of the branch, not every node
  under it.** 1.9.0 put a chip on every node in a handed-over branch however
  deep it went, which let you mark someone done with a section while the parts
  of that section sat unticked underneath. There is no honest reading of that,
  so the row is the unit now: being done with a section means being done with
  what is in it. The branch still comes into the view whole and is still drawn
  as a tree, and the deeper parts are still there to read. They just do not
  carry a checklist of their own.
- **To track something deeper on its own, tie a name straight to it.** A name
  tied to a node with no branch of its own takes on that one node, which is
  the rule 1.9.0 already shipped. Nothing new to learn.
- Ticks that were sitting on a deeper node in a 1.9.0 map are cleared the
  first time the map is drawn, in the same step as anything else that tidies
  itself, so one undo puts them back if you were relying on them.

## [1.9.0] - 2026-09-21

### Changed
- **Handing a branch over is just a tie now.** `⌥⇧H` is gone, one release
  after it arrived, and you will not miss it: select a node, `⌘`+click a
  branch, and that node holds the branch. That is the same tie you were
  already making, and it always meant this. If both nodes have branches of
  their own, the one you clicked is the one handed over, so the order you
  click in is the direction. A node tied straight to a single item takes on
  that item.
- **A branch tie is how you say nothing is owned.** Every other tie hands
  something over, so the branch tie is now the one that says these two simply
  relate. Turning a tie into one gives the branch back and says so.
- **Maps made before this release gain hand-overs they never had.** That is
  the point of the rule rather than an accident of it, and it is why the new
  switch starts at Off. A map saved by 1.8.0 opens with exactly the holders it
  had, its ticks intact.

### Added
- **The Holders switch.** Networks has a switch next to the view tabs with
  three positions. **Off** is the map of ties you already knew, with a quiet
  count under each held item so you can see there is something there, and
  clicking that count opens it up. **Chips** puts a holder chip on every item.
  **Lanes** lays the same thing out as a grid. The Style panel loses its row
  for this, because the switch says it better and says it once.

### Changed
- **Networks is quieter.** The centre node stops sitting in the middle of a
  view it has nothing to do with, unless something is tied to it. The tie
  counts only appear when they are counting something you cannot see, since in
  Networks everything on screen is tied by definition. `Esc` always takes you
  back exactly one step, whichever way you came in, and so does `⌘/`.
  Folding a network's first node now says how much it is holding back instead
  of looking like the network disappeared. And the untied parts of the map
  fade out when the view opens rather than blinking away.
- **Tab and the arrows agree about what is next.** Tab walks the networks in
  the order they read on screen, down the page and then across it, and an
  arrow takes the network that way rather than the next one along the tree.

## [1.8.0] - 2026-09-19

### Added
- **Hand a branch to someone.** Select two nodes, the one that takes the work
  first and the branch to hand over second, and press `⌥⇧H`. That node now
  holds the whole branch as its own, and so does anyone else you hand it to.
  Nothing is copied: there is still only one of each item, so renaming one
  renames it for everybody. The right-click menu has the same thing worded
  both ways, and `⌥⇧H` again takes the branch back.
- **Networks shows who holds what, and how far each of them has got.** In
  `⌘2` the held branch is drawn once, as a tree, and each item carries a small
  chip for every holder. Click a holder's chip to mark them done with that
  item, which is how you see at a glance who still owes you the Abstract. It
  is a click and nothing else: there is no key for it.
- **The same thing as a grid.** The Style panel's new **A held branch** row has
  **Lanes**: a row per item, a column per holder, and a cell you click for each
  pair, for when you would rather compare holders than read the branch. Any
  other network in the view is still laid out as a cluster beside it.
- **The map is unchanged.** `⌘1` draws a holding tie as an ordinary tie with a
  small mark at the end that holds it, so you can see which way it points
  without opening Networks. No chips anywhere on the map.

### Changed
- A holding tie and a branch tie are the same tie worn two ways, so making one
  on a pair that has the other swaps it over and says so in the status line.
- Only a node with children can be handed over, and a node can never end up
  holding itself: both are refused with a nudge and a word rather than quietly
  making a tie that means nothing.
- Deleting, merging or moving an item out of a held branch clears it from
  every holder's list in the same step, so one `⌘Z` puts the item and its
  ticks back together.
- Your file carries all of it. Breaking a branch out into its own map takes
  the holders and their ticks with the tie, a copied branch pastes with them,
  and a map saved before this release opens with no holding ties and nothing
  else disturbed.

## [1.7.1] - 2026-09-19

### Changed
- **Networks opens on all of them.** Pressing `⌘2` now fits every network on
  screen rather than centring on the one you were nearest, since seeing them
  together is the point of the view. `Esc` still puts your camera back exactly.
- **The key bar knows the view.** In Networks the bar lists the keys that work
  there, Fold beyond and Copy all among them, and the Dimmed view keeps its own
  row.
- **Typing does not shake the network.** A node you are retyping inside
  Networks holds its place while you type, and the network settles once when
  you finish, rather than re-arranging on every letter.
- **`⌘C` copies every network.** In Networks, copy gives you all the networks as
  one outline, each from its first node, in both plain and rich text, the way
  a single network already did.

## [1.7.0] - 2026-09-19

### Changed
- **Networks, all of them at once.** Connections is now called Networks, and
  pressing ⌘2 lays every network out rather than only the one you step into.
  Nodes with no tie on them leave the view instead of sitting dimmed in the
  background, so what is left on screen is only what relates to something
  else, each network clear of the others and the centre held still as a fixed
  point. Tab still walks them, ⌘/ still opens one on its own, ⌘E folds what is
  only reached through a node, and ⌘0 fits them all. If you preferred the old
  view, the Style panel has it: set Networks to Dimmed and ⌘2 goes back to the
  whole map with the untied parts faded in place.
- **A network holds still while you work in it.** The arrangement of each
  network is worked out once and remembered for as long as the view is open,
  so a keystroke, a selection or a fold no longer re-runs the whole layout,
  and a fold or an edit inside one network never moves the others. One network
  on its own gets the same treatment.
- **The last tie has somewhere to go.** Untying or undoing the last tie while
  Networks is open drops you back on the map, with a word in the status line,
  rather than leaving an empty canvas.

## [1.6.1] - 2026-09-19

### Changed
- **Set up the talk from inside the talk.** T mid-talk, or the Set up button
  in the bar, opens a panel with the five Presenting rows, and a change takes
  effect on the step you are on, camera included. Esc closes it before it ends
  the talk, and it never takes the keyboard, so the arrows still step.
- **The Presenting rows are worded.** Each option is its word, sized to fit,
  with the picked option's meaning written under the row, in the talk panel
  and in the Style panel alike.

## [1.6.0] - 2026-09-19

### Added
- **A talk you can set up the way you talk.** The Style panel has a Presenting
  section. The whole map can be up from the first second, dimmed, with the
  path to what you are saying lit, so the room always sees where this bit sits
  (On screen: All, with Behind you: Fade). What is behind you can stay as it
  was, sit back, or go away again; "go away again" is not offered while the
  whole map is on screen, because there is nothing for it to hide. A step can
  reveal one node, a whole row or a whole branch, and a row at a time is also
  the answer for tied nodes that sit at the same level, since they arrive
  together because their row does. ⇧→ is always one step coarser than the
  setting: a row when a step is a node, a branch when a step is a row. The
  camera can follow you, hold the whole map, or hold the branch you are in.
  With nothing set, a talk is exactly what it was.
- **Present from here.** ⌘P starts a talk from whatever you have selected
  rather than from the centre, so the rest of the map is never told, and
  leaving and coming back resumes that talk and not the one from the centre.
  ⌥⇧P does the same where the browser keeps ⌘P for print, and the right-click
  menu has it too. On the centre it is ⌘3.
- **Cards.** A talk can drop the map altogether and read as cards, one node to
  a screen with its paragraphs as the body and its other children as chips,
  which is what prose was for. A paragraph is read on its parent's card, lit,
  and the ones told before it sit above it. The map is still there underneath,
  so Esc puts you back exactly where you were; O and ⇧O have nothing to show
  and say so.

## [1.5.1] - 2026-09-18

### Fixed
- **A copy made from something already rendered keeps its headings.** Copy a
  chat answer or a page and the plain text arrives with the bold already gone,
  so 1.5.0 had nothing to read the shape from and everything landed in one
  column. The bold is still there in the clipboard's rich-text flavour, and
  Mappr now reads that flavour whenever it carries headings, bold or code, not
  only when it carries a list. A bold paragraph is a heading, the paragraphs
  after it are its children, and a bold label still opens a definition. The rule
  that keeps a paste honest is unchanged and now carries the whole weight: a row
  with no bold anywhere in it is left exactly as it was pasted, so an indented
  list keeps every level it came with and a branch copied out of a map and
  pasted back comes home unchanged.
- **A code block is one node, and its fences are not nodes at all.** A fenced
  block used to arrive as a stack of lines wrapped in two nodes made of
  backticks. It now comes in as a single node with its lines intact, which
  ⌥S splits again if that is what you wanted, and a copy that put a bullet in
  front of every line, as a chat copy does, has that bullet taken off the code
  too. An unclosed fence still ends, and a code span inside a line is left
  alone.

## [1.5.0] - 2026-09-18

### Added
- **Markdown arrives as a shape, not as asterisks.** Paste a list out of a chat
  or a document and the markdown written inside the lines comes off: bold,
  italic, code, strikethrough and links all arrive as their words. When the
  paste has no indentation left in it, which is what a chat answer and most
  stripped copies give you, the markdown says what the shape was. A line that is
  bold from end to end becomes a heading, a line that ends in a colon with
  nothing after it introduces what follows, and everything after them hangs
  underneath. A list that used to land as forty siblings in one column now lands
  as the two or three levels it was written as.
- **A term and its definition come in as two nodes.** A line like
  **PTP (Promise to Pay):** the borrower commits to an amount and a date becomes
  the term as a node with the sentence as a paragraph under it, so a definition
  list becomes a map rather than a column of long boxes. The same two readings
  work on a rich-text copy, where the bold arrives as real bold rather than
  asterisks.
- **Nothing is invented from a paste that already has a shape.** A paste that
  carries any indentation of its own is taken exactly as it is, and a paste with
  no bold anywhere in it is left flat, so a branch copied out of a map and
  pasted back always comes home unchanged.

### Fixed
- **A paragraph's children are joined to something you can see.** A paragraph
  has no box, so the lines to its children used to start at an edge nobody had
  drawn and read as lines joined to nothing. A paragraph with children on screen
  now carries a lighter rule down the side they leave from, and the lines meet
  it.
- **A row's numbering stays its own.** A bulleted line and a bare line written
  at the same depth are two rows of the tree, but the paste was counting them as
  one when it decided whether a row was numbered, so one row could take the
  other's numbering.

## [1.4.0] - 2026-09-18

### Added
- **Prose.** `⌘⇧9` turns a node into a paragraph: wider, left aligned,
  smaller type, a rule down the side instead of a box, and never numbered.
  `⏎` on a paragraph writes the next one and `⌘⏎` starts an
  ordinary node under it, so a branch can go from map to document and back
  without leaving the map. Numbering skips paragraphs, so a row of paragraph,
  bullet, bullet still counts a. b. Copy still gives you the outline, with your
  paragraphs as paragraphs, and pasting one back brings them in as paragraphs,
  so a branch with prose in it travels without losing what it was. The Style
  panel draws them with a rule or a dotted box. `⌥9` is the twin, for the
  browsers and the iPad that keep the chord. A branch with paragraphs in it is a
  document; the rest of the map is still a map.
- **Two new rows in the copy menu.** Copy as markdown hands over the branch as a
  document, with real headings and sections worked out from what hangs under
  each node, and Copy as JSON hands over the branch itself. Both are on the
  right-click menu on the map and in the Copy menu while presenting or in a
  network.

### Fixed
- **A numbered map stops re-measuring itself.** Every numbered node was being
  measured again on every render, because the size Mappr remembered for it was
  filed without its figure and looked up with one, so the two could never match.
  In a numbered map of 1500 nodes that was 1500 measurements on every keystroke;
  it is now none.

### Changed
- **A numbered row with a paragraph in it copies out as a plain list.** A
  document's numbered list has no way to hold a paragraph between two numbered
  items without either counting it or breaking the list in two, so a row that is
  part document keeps its bullets and carries its figures in the text, the way
  the 1.2.3 scheme already does. A numbered row with no paragraph in it is
  unchanged, and still arrives as a real numbered list.

## [1.3.2] - 2026-09-18

### Fixed
- **A numbered list copies out as a numbered list.** Copying a numbered branch
  and pasting it into a document used to give you two markers on every line,
  the document's own bullet and the figure Mappr had written into the text.
  Mappr now hands over a real numbered list and lets the document draw the
  figures, so what lands looks like what you copied, nested and numbered the
  way it was on the map. Copying part way down a row keeps its place rather
  than restarting at one. The 1.2.3 scheme is the one exception, since a
  document's own lists cannot count that way, so it still travels with its
  figures written in. The story copy and the network copy come through the same
  writer, so a network, where what hangs under the centre is not a row of the
  map, keeps its bullets and its figures as before.
- **Pasting a numbered list back into Mappr keeps it numbered.** A copy whose
  first line sits above the list used to have its numbering read off the wrong
  line and lost, so a row copied out numbered came back plain. It comes back
  numbered now.

## [1.3.1] - 2026-09-18

### Changed
- **Numbering leaves a half-hidden row alone.** Numbering a row reads the order
  off the picture, so every node in the row has to be in the picture. If one of
  them is folded away or hidden, the numbers still go on but the order is left
  exactly as it was, and the status line says so. Unhide it and press again for
  the ordered result. Before this, the hidden ones held whatever slot they
  happened to have, which mixed the old creation order back into the result and
  gave you a different answer depending on what was hidden at the time.

## [1.3.0] - 2026-09-18

### Added
- **Cut picks the branch up instead of taking it away.** `⌘X` now copies to
  the clipboard and lifts the selection off the map: it goes faint where it
  was, the arrows walk a ring round the map to choose where it lands, and
  `⌘V` or `⏎` puts it down, `⇧⏎` right after the ringed node.
  Nothing leaves the map until you put it down, and `Esc` puts it back exactly
  where it was. The clipboard still holds what you picked up, so a second
  `⌘V` pastes a copy of it. In a network or during a talk the clipboard is
  written and the map is left alone. `⌥X` is now Done, which is the mark
  you reach for most; `⌥D` still does the same, and `⌘⇧D` is gone,
  since Firefox kept it anyway.
- **Read another mode's keys without leaving the one you are in.** `⌥⇧K`
  walks the key bar through the modes: Map, Focus, Connections, Flags, Network,
  Story, Selection, Carrying, one press each. The bar says which mode it is
  showing and never takes the keyboard, so the next key you press does what it
  always does and brings your own keys back. Five seconds does the same.
- **Tap a selection key twice to take the whole row.** Two presses of the same
  `⇧`+arrow inside four tenths of a second select every node in the row,
  the way `⇧`+click does. One press is still one more node, and
  `⌘⇧`+arrow still takes whole branches.
- **navi, and a row that stops growing.** Where you are is now called navi. A
  long row used to be listed in full, so a row forty wide ran off the bottom of
  the window. It now shows the node you are on with three either side and a
  folded row at each end saying how many more are above and below, the same
  shape the way up already used. The Style panel has three alternatives: the
  whole row in a small box that scrolls, just the one you are on with the
  count, or the row as chips. The chips are capped at ten and a plus whichever
  you pick. Inside a focus, navi shows how deep you are rather than a spine you
  cannot leave: six pips by default, or the depth in words, or the focus root
  and where you are in it.

### Changed
- **Numbering a row also settles its order.** Numbering used to count the
  branches in the order they were made, which on a row that spans both sides of
  the centre had nothing to do with what you were looking at. It now reads the
  row off the picture: down the page on a side row, clockwise from the top for
  the branches round the centre. Numbering the centre's row also fixes the
  branches where they are, so they stop rearranging themselves as you add to
  them. One `⌘Z` puts both the order and the numbers back.
- **A pasted list keeps the kind of list it was.** A numbered list pastes in
  numbered and a bulleted list pastes in plain, with no marker left in the
  text. A list that mixes its markers comes in as one kind of row, whichever
  most of its lines used. A list copied out of a page keeps its numbering even
  where the page printed no figures.
- **A new map you never wrote in no longer joins the library.** Make a map,
  look at it, leave it untouched and it goes with you rather than sitting in
  the list. A map you typed even one letter into stays, so does a map you made
  earlier and came back to, and so does a map something links to.

## [1.2.0] - 2026-09-18

### Added
- **Where you are.** A rail top left that follows the selection and shows only
  the way up and the row you are on: the ancestors as a muted spine, the
  siblings under the parent with yours lit, children as a count and never
  listed, flags with their `!` and numbers with their figures. A deep trail
  folds its middle. When the centre has gone off screen a small arrow points
  to where it is. Click a row to go there. It joins the maps rail in one
  panel, so the two read as one place; the Style panel can give it its own
  bar instead, swap the rail for a pill with the siblings as chips or for a
  drawn sketch of the same, stop it fading when you leave it alone, and set
  when it shows: always, only when the centre is out of view, or never.
  `⌥⇧W` cycles those three.

## [1.1.0] - 2026-09-18

### Added
- **Numbers, like a list in Docs.** `⌘⇧7` (or `⌥7`) numbers the row the
  selected node is on, its siblings in order. With a selection up it numbers
  every row that has a selected node in it, so `⌘⇧→` then `⌘⇧7` turns a
  whole branch into an outline, and `⌘A` then `⌘⇧7` the whole map. On the
  centre alone it numbers the branches. Pressed on rows already numbered, it
  takes the numbers off. A number belongs to the row, not the node: nothing is
  typed into the text, and a move, a sort, a delete or a paste renumbers on its
  own. Rows nest 1. then a. then i., as Docs does; the Style panel has 1.1.1
  and I. A. 1. instead, and draws the number in the gutter (a bare figure
  outside the box, so a long node never wraps earlier), in the box, or as a
  pill on the edge that faces the parent. Numbers export with the map. A copied
  outline writes the number before each line, and a pasted `1.` or `a.` line,
  or a numbered list from Docs, comes in numbered. The right-click menu has the
  row.

## [1.0.2] - 2026-09-17

### Fixed
- **Keys on an iPad.** iPadOS hands hardware-keyboard events and paste to a
  page only while something editable has the cursor; with nothing focused,
  Safari keeps the keys for itself. That is why every shortcut and `⌘V`
  only worked after tapping into a node. Mappr now keeps an invisible
  editable focused whenever no node, frame title or box has the keyboard, so
  the keys always have somewhere to land: arrows, `⌘`/`⌃` chords,
  `⏎`, typing and paste work straight away, and the on-screen keyboard
  stays out of the way. On for iPads and iPhones, and for anyone who adds
  `#sink` to the address.

## [1.0.1] - 2026-09-17

### Fixed
- **Keys the browser keeps.** Firefox and Zen hold `⌘⇧D`, `⌘⇧F`,
  `⌘⇧G` and `⌘⇧C` for themselves, so done, flag, ungroup and copy as
  an image never reached Mappr there. Each now has an Option twin by physical
  key: `⌥D`, `⌥F`, `⌥G`, `⌥C`. The menu shows the twin on those
  browsers. `⌃` has always stood in for `⌘`, which is the key to use on an
  iPad, where Safari keeps `⌘` with the arrows and the number row.
- **The Flags view is always on the mode bar**, muted until the map has a
  flag, with a hint saying how to make one. It used to be hidden, which read
  as missing.
- **Long press opens the menu.** On a node or the canvas, a touch held for
  half a second opens the same menu as a right-click, so every action is
  reachable on a tablet with no chord at all.

## [1.0.0] - 2026-09-17

Version one. Everything since 0.36 was the road here: the interaction sweep,
the right-click menu, the speed pass, the rail, the flags. This release is
about how maps are kept.

### Changed
- **Maps live under their root map.** A map that a link opens is kept under
  the map that links to it, up to a root that nothing links to. The Maps menu
  and the switcher list each root with the maps under it, indented, and a
  root row says how many. Copy on a root copies the whole tree with the links
  pointed at the copies; Delete on a root takes the tree to *Recently deleted*,
  each map on its own so any one can come back; the bin holds twelve now.
  Export as JSON bundles the maps under the one you export, and Import
  rebuilds them with fresh ids. A map is listed once, under the first map
  found linking to it.
- **Detach.** A map under another can be made its own again from the Maps
  menu: every link to it, in any map, becomes a plain node carrying its name,
  and it moves up to the roots. The part in the open map is one undo step.
- **A reload keeps your place.** Every map opens at the zoom and place you
  left it, whether you switch to it or reopen the app; only a map never
  opened is fitted. The last few undo steps are kept with the map (as many of
  the most recent as fit a small budget, since each is a whole snapshot), so
  `⌘Z` works after a reload too.

### Fixed
- Deleting the map you were on wrote it straight back into the library on
  the way out. It stays deleted.
- Closing a tab, switching apps on a phone and a tab going to the background
  all flush the map and its undo steps now; before, only a full close did.
- Two tabs of Mappr on the same store: the listings in each refresh when the
  other writes. A map open in both is still last writer wins.

## [0.39.0] - 2026-09-17

### Added
- **The maps rail.** Top left, every map under the root map as a tree, with
  the one you are on lit and each map's size beside it. Click a name to open
  it, `⌥[` and `⌥]` walk them, a twist folds a branch of maps. A
  map linked from two places is listed under the first and marked under the
  second. `⌥⇧M` folds the rail to one line that says where you are,
  root to here, with the count; the choice is remembered. It replaces the
  trail bar and *Linked from*: the lit row is the trail, and a map that
  something links to hangs under it. Nothing shows until the map has a link.
- **Flags, drawn by hand.** The flag is a pennant on a pole in the same hand
  as the boxes, seeded on its node so it is the same every render, and it
  exports. The Style panel offers a ribbon, a ring and an asterisk instead.
- **Flags you can find.** `⌘4` (or `⌥4`) is a view on the number
  row, offered while the map has a flag: everything without one drops to a
  ghost, `Tab` and the arrows step flag to flag, `Esc` puts you back. In
  `⌘K`, `!` first lists only flagged nodes. Sort has *Flagged first*.
  A copied outline writes `!` before a flagged line, and a pasted `!` line
  comes in flagged. The end of a story counts the flags in it.

## [0.38.1] - 2026-09-17

### Fixed
- **A network with a branch tie keeps its trees.** Opening a node's network
  (`⌘/` in connections) arranged every node of a branch-tied subtree as
  a loose point, so the boxes landed on each other and the tree edges ran
  through them. Each tied branch now keeps the shape the map gave it and moves
  as one block; blocks keep clear of each other by their edges, not their
  centres, so a wide branch is given room.

## [0.38.0] - 2026-09-17

### Changed
- **Big maps are quick again.** The bench picked the targets: in a 1500-node
  map, adding a node cost 76ms and a keystroke while typing 22ms, most of it
  spent redrawing shapes that had only shifted and restyling nodes that had
  not changed. Now adding a node costs 11ms and a keystroke 6ms; an arrow move
  is unchanged at 8ms and a full render is 7ms. What changed underneath: a
  shape is drawn once and moved by a transform when its node shifts; nodes and
  shapes sit in one group per branch, so a branch that moves as a block moves
  with one transform; a node's class and place are written only when they
  changed, since writing the same value still makes the browser restyle it;
  and the selection halos are their own layer, so typing beside a big
  selection no longer rebuilds them on every keystroke. Exports draw afresh
  as before. The bench now records the two keys pressed most, a letter and an
  arrow, in a 600 and a 1500-node map.

## [0.37.0] - 2026-09-17

### Added
- **Right-click is Mappr's own menu.** On a node it lists everything that can
  be done to it, each row with its key beside it, so the menu teaches the
  keys: focus, fold, tie to the node you had selected, tie the branches, open
  or break out or link a map, retype, done, flag, duplicate, split, merge,
  sort, carry, frame, copy as an outline or an image, delete. What does not
  apply is not shown, and inside a selection the menu acts on the selection.
  On empty canvas it offers the views, the camera and the maps. In a network
  it works on the network. `Esc` closes it, and any other key closes it and
  still does what it does. Nothing was unbound: every key is still a key.
  Right-click used to focus into a branch; that is the first row now, and
  `⌘/` is unchanged.

### Changed
- **`⌥⏎` crosses a link either way.** On a link it opens the map, as
  before. On any other node it goes back up to the link you came through, at
  the view you left. `⌥U` is gone. Double-click on empty canvas goes back
  up too, the mouse twin of double-clicking a link to go down. The trail in
  the top bar still jumps straight to any map on the way.

## [0.36.0] - 2026-09-17

The interaction sweep. Every feature was checked against every other one:
ties against folds, focus, break out and delete; stories against merge, sort
and delete; presenting against carry, paste and the maps panel; map links
against everything that can put a node somewhere. What follows is what that
turned up.

### Fixed
- **Ties inside a focused branch are drawn again.** Focus on a branch and a
  tie between two of its nodes was not drawn at all, and the nodes wore no
  badge. A tie that leaves the branch still cannot be drawn, but the node now
  wears a badge that counts it as *outside*, and a click on the badge steps out
  of the focus to the other end.
- **Break out keeps the ties across the cut.** They used to be removed. Now
  the link node stands in for the end that left, drawn hollow the way a folded
  branch is, and bringing the map back in puts each tie back on its node.
- **Deleting a node hands its ties to the child that moved up**, the way a
  frame already followed. A branch tie whose ends end up on one line after a
  move, a carry or a merge becomes a plain tie instead of tying a branch to
  itself.
- **Duplicate keeps the ties between the copied nodes**, as copy and paste
  did, and both keep a map link: the copy is a second link to the same map.
- **A link stands in for a whole map, so nothing can be put under it.**
  `⌘`+arrow, paste, `⌥`+arrow, carry and merge all said nothing and did
  something odd; merging into a link threw the merged text away. Each now says
  so and leaves the map alone.
- **A story survives what happens to its nodes.** Deleting or moving a node
  out of an arranged level used to drop everything told after it; the chain
  is spliced instead. Merging told nodes tells the survivor in their place.
  Sorting a told level puts that level back to map order and says so, rather
  than showing one order and telling another.
- **Presenting.** `Esc` from the overview or the whole story goes back to the
  talk instead of ending it. Paste does nothing mid-talk. Starting a talk puts
  a carried node down, closes the maps panel and stashes the selection, which
  is back when the talk ends. The story menu closes when `R` is pressed, and
  a different story picked mid-talk starts from the top. Undo while arranging
  stays on the story and the focus you are arranging. A link node no longer
  advertises `⌥⏎` while presenting, where the key advances the talk.
- **Switching map leaves the lens, the carry and the talk behind.** A dim or
  a network used to follow you into the next map, and a carry could be dropped
  in a map that did not contain it.
- **Maps.** An unrelated undo no longer brings back a map you deleted from the
  panel; only a map set aside by an undo or a bring in comes back with its
  redo. A map set aside by bringing it in is not evicted from Recently deleted
  while undo could still want it. Breaking out a branch that holds links
  records them, so *Linked from* and delete know about them. A frame trimmed
  by a break out is counted in the message.
- Smaller: the fold badge inside a network folds again rather than hopping a
  link; a node whose only ties are hidden says how many rather than `∿0`;
  a story cannot take another story's name; `⌘⇧G` with no frame says what it
  needs; a chord pressed with the sort or copy menu open closes the menu and
  still does what it does; carrying a branch out of a frame leaves the frame
  round what stayed.

## [0.35.1] - 2026-09-17

### Fixed
- **Coming back to a map keeps your view.** Going back up from a linked map
  (`⌥U` or the trail), `⌥` plus backtick, or the map switcher used to fit the
  whole map again. A map you already visited this session now opens at the
  zoom and place you left it, with the same node selected.

## [0.35.0] - 2026-09-17

### Added
- **Branch ties.** `⌘⇧`+click ties the selected node to another as a whole
  branch: one heavier arc with a double tick where it leaves each box, and in
  connections everything under either node counts as the same network. Dimmed,
  both branches stay lit; opened as a network, both come up with their tree
  drawn. The same gesture again removes it, and it turns a plain tie between
  the same two nodes into a branch tie. From the keyboard, select the two
  nodes and press `⌥⇧T`. Copy, paste, merge and break out keep it.

## [0.34.0] - 2026-09-17

### Added
- **Map links.** A link is a node that stands in for a whole map: it shows
  the map's name and size, and its name follows the map. The style panel has
  three looks under *Map links*: a stacked card (the default), dashed, or an
  arrow badge.
- **Break out, `⌥B`.** A branch becomes a map of its own and a link takes its
  place. Marks, folds, frames and the links inside the branch go with it;
  links that crossed the cut are removed and counted. On a link, `⌥B` brings
  the map back in as a branch, and the map goes to Recently deleted unless
  something else still links to it. `⌘Z` undoes either, map and all.
- **Link a node, `⌥K`.** Pick a map to link to, or make a new one named after
  the node.
- **Follow links.** `⌥⏎` or a double-click opens a linked map. A bar under
  the top bar keeps the trail of maps you came through; `⌥U` or a name in it
  goes back up to the link you left from. *Linked from* says which other maps
  link to the one you are on. A link whose map was deleted says so, and
  `⌥⏎` restores the map.

### Changed
- **Undo survives switching maps.** Each map keeps its own undo history for
  the session, so going into a linked map and back, or switching away and
  back, keeps the steps you took.

## [0.33.0] - 2026-09-17

### Added
- **Sort, `⌥O`.** A small menu next to the selection, where a number picks:
  A to Z, Z to A, reverse, biggest branch first, done last, or back to how it
  was. Selected siblings trade places only among the spots they already hold;
  with one node selected, its children are sorted. Names sort the way people
  read them, so "item 9" comes before "item 10", and on the centre each side
  is sorted on its own so nothing changes sides.
- **Carry, `⌥X`.** Picks up the selection, or the selected node. It fades
  where it is while the arrows, or a click, move a ring to where it should go;
  `⏎` drops it inside, `⇧⏎` right after, `Esc` puts it back. Nothing moves
  until the drop, the dropped nodes stay selected, and one undo reverses it.

## [0.32.0] - 2026-09-17

### Added
- **Merge nodes, `⌥J`.** The selected nodes become one: the first in map
  order keeps its place, its text becomes all of theirs, one per line, and it
  takes every child they had. Links and frames follow it. The selection bar
  has a Merge button too.
- **Split a node, `⌥S`.** A node with several lines becomes one node per line,
  as siblings right after it; `⌥⇧S` makes the extra lines its children
  instead. It keeps the first line and its own children, and bullets or
  numbers a pasted line carried are dropped. Works on a whole selection.

## [0.31.0] - 2026-09-17

### Added
- **Group a selection under a new parent.** With nodes selected, hold `Tab`
  and press the arrow back toward the centre: a new parent slides in where
  the first of them was, and every selected branch becomes its child, in map
  order, even ones from elsewhere in the map. Type to name it; one undo takes
  the whole group back out. A frame that wrapped one of them wraps the new
  parent instead.

## [0.30.0] - 2026-09-17

### Added
- **Pinned maps.** `⌥P` pins the open map, and a pin (Mappr's own, drawn to
  match) shows next to the name. Pinned maps sit at the top of the Maps menu,
  each with its number: `⌥⇧1` to `⌥⇧9` open them in pin order.
- **The map switcher, `⌥M`.** Pinned maps first, then recent ones; type to
  filter, arrows and `⏎` to open. It starts on the map you were on before, so
  `⌥M` `⏎` swaps back and forth. `⌥P` and `⌥T` work on the highlighted map.
  The Maps menu opens it too.
- **Colour tags.** `⌥T` gives the open map a colour and steps through six;
  past the last it clears. The dot beside each map in the lists does the same
  on a click, and the colour shows next to the name.
- **Back to the last map.** `⌥` plus the backtick key flips between the map
  you are on and the one before.

### Fixed
- **Shapes going missing after a move in a big map.** Moving a node between
  branches could leave boxes undrawn or drawn in the wrong place until the next
  full repaint. A shortcut in the repaint reused a shape that was still on
  screen elsewhere; it now only takes that shortcut when it is safe.

## [0.29.0] - 2026-09-17

### Added
- **`⌥N` makes a new map**, from anywhere but the middle of typing.
- **A key log for troubleshooting.** Open Mappr with `#keys` at the end of the
  address and a small box lists every key the page receives and whether
  Mappr acted on it, so a browser keeping a shortcut for itself is easy to
  spot.

## [0.28.0] - 2026-09-16

### Added
- **`⌥`+arrow carries on past the edge.** Moving a node past the last of its
  siblings takes it into the next branch along, the way a plain arrow walks
  there: going down it becomes that branch's first child, going up the last
  child of the branch before. A folded branch opens to take it. It stays on
  its side of the map and does not wrap, and a top-level branch stays put. A
  selection hops over together, in order, and one undo puts it all back.

## [0.27.0] - 2026-09-16

### Added
- **`⌘A` selects a level.** The selected node's whole level, across the map;
  press it again for everything on screen.
- **`⌘D` duplicates a selection.** Every selected branch is copied right below
  itself, and the copies come out selected.
- **A selection chip in the top bar** shows how many nodes are selected, with
  Copy, Duplicate and Delete buttons, and an `×` to clear.
- **Paste into a blank node.** Make a node, then paste: the pasted nodes take
  its place instead of hanging off an empty box, and one undo takes both back.
- **Deleting shows where the children went.** They flash in their new place.

### Fixed
- **Branches no longer overlap in the corners.** When a map branches both
  sideways and up or down, a wide up or down branch used to run into a tall
  sideways one. It now steps just far enough away to clear.
- **`⇧⏎` goes to the next parent you can see.** It used to follow the order
  the branches were made in, which often meant the top of the map. It now
  goes top to bottom on a sideways branch and left to right on an up or down
  one, and wraps round without leaving that side.
- **`⌘A` selects every node again**, not just the top level, now that a
  selection shows exactly what is selected.

## [0.26.0] - 2026-09-16

### Added
- **Select with the keyboard.** `⇧`+arrow grows a selection node by node, and
  stepping back lets go of the last one, the way Shift works in text.
  `⌘⇧`+arrow takes whole branches: outward this branch, sideways every
  sibling that way, inward the parent's branch, and from the centre a whole
  side. The key bar switches to selection keys while something is selected.
- **Move a selection.** `⌥`+arrow moves every selected branch at once, by the
  same rules as a single node, and keeps them selected so you can keep going.
- **Copy, cut and paste that keep their shape.** `⌘C` copies exactly what is
  selected, each node under its nearest selected parent, or with nothing
  selected, the selected node's branch. `⌘X` cuts. `⌘V` pastes as children,
  `⇧⌘V` as siblings right after the selection. Pasted nodes point the way
  their new parent does and arrive selected. Copies made in Mappr also keep
  done and flag marks, folds, and links between the copied nodes.

### Changed
- **Deleting a node keeps its children.** `⌫` takes just the node, and its
  children move up into its place. `⌘⌫` deletes the whole branch. A frame
  whose top node is deleted keeps wrapping what moved up.
- **New nodes are selected, not opened.** No cursor blinks in an empty box;
  your first letter starts typing, and a new node left blank is dropped when
  you move on, press `Esc` or click away. *Cursor in new nodes* in the style
  panel brings the old behaviour back.

### Fixed
- **The cursor sits in the middle of an empty node** instead of its corner.

## [0.25.0] - 2026-09-16

### Added
- **Copy what you are looking at.** In a network, `⌘C` copies the network
  as an outline (the centre, what is tied to it, what is tied to those) and
  `⇧⌘C` copies a picture of just the network. While presenting, they copy the
  story told so far, so you can paste it mid-talk; from the overview, the
  finale or arrange mode they copy the whole story. A **Copy** menu in the bar
  has every option, whole story included, and a number picks while it is open.
  Story pictures carry their frames and leave out what the story skips.
- **The key list has tabs.** Create, Move, Edit, Frames, Links, Present, Maps
  and Canvas each get their own page. Arrows or a number switch tabs, it opens
  where you left it, and keys no longer reach the map behind it.

### Changed
- **`⌘/` again takes you back.** Pressing Focus on the branch you are focused
  on returns you to exactly the view you had before, zoom and all, even after
  stepping across to a sibling branch. On a network's centre it goes back to
  wherever you opened the network from. `Esc` still steps out one level.
- **Frames follow the view.** While presenting, a frame grows as its nodes are
  revealed and its title can no longer be clicked by accident; in a network,
  where the tree steps aside, frames do too.
- **The Paste outline button is gone.** `⌘V` does the same job.

### Fixed
- **Retyping a node can be undone.** Overwriting a node's text is now an undo
  step of its own, so `⌘Z` brings the old text back, even mid-retype. A node
  made and dropped without a word no longer leaves an undo step that does
  nothing.

## [0.24.0] - 2026-09-16

### Changed
- **Faster with links.** Working out where each link lands used to happen
  once per node for every link, so a big map with a few hundred links spent
  most of every keystroke on it. It now happens once per render: a
  1200-node map with 150 links went from about 110 ms a render to about
  10 ms. `npm run bench` now measures this, in each view.
- **The story picker is a dropdown.** While arranging, the bar shows the
  current story; its menu switches stories, adds one, renames the current
  one in place, and deletes it (asking twice). `[` and `]` still switch, and
  with the menu open a number picks that story.
- **The key bar is short and follows you.** It shows a handful of keys for
  the mode you are in (map, focus, connections, network or arranging a
  story) instead of twenty at once, with `?` for the rest. `×` folds it to a
  small pill, and it remembers.

### Added
- **Presenting gets out of the way.** After a few quiet seconds the bar
  fades and the pointer hides; moving the mouse brings both back.

## [0.23.0] - 2026-09-16

### Added
- **A mode bar**, top right: Map, Connections and Story, with their number
  keys. It shows where you are and switches on a click. It steps aside while
  you present, so the audience only sees the map.
- **Several stories per map.** While arranging, the bar lists the map's
  stories: click one to switch (or `[` and `]`), `+` adds one, double-click the
  current one to rename it, and `×` deletes it after a second click. A new
  story starts empty, so it tells the whole map until you pick. Presenting
  names the story you are telling, and resuming is per story. Maps saved
  before this keep their order as "Story 1".
- **`⇧` + double-click in connections** clears every link on that node, and
  `⌘Z` brings them back. In connections, `⇧`+click only selects, so the
  gesture never marks a row by accident.

### Changed
- **Switching to connections keeps your camera.** `⌘2` no longer zooms out;
  the view only moves when the picture itself changes (opening a network, or
  coming from a focused branch), and then it keeps your zoom.
- **`⌘0` fits whatever you are in**: the whole map, all the links, a focused
  network, or while presenting, what is on screen.
- **`Esc` goes back to your zoom, not to the whole map.** Leaving a focus
  puts the camera back where it was before you went in, and `Esc` after `⌘.`
  undoes the jump to 100%.

## [0.22.0] - 2026-09-16

### Added
- **`Tab` cycles focused branches.** On a focused branch's own node, `Tab`
  and `⇧Tab` move the focus round its sibling branches, like the arrows do,
  and wrap. Deeper inside the branch, `Tab` still cycles the level. The bar
  says which branch you are on: `branch 2 of 4`.
- **Step through networks.** With the links dimmed (`⌘2`), `Tab` and the
  arrows move the selection from one network to the next. In a focused
  network, they switch to the next network when its centre is selected, and
  move within the network otherwise. `Tab` wraps round; arrows stop at the
  ends. The bar counts them: `network 2 of 5`.
- **The whole story, `⇧O`.** While presenting, `⇧O` shows every node the
  story will tell, lit, not just what you have covered. `⇧O` again (or any
  step) goes back to where you were.
- **The story has an ending.** After the last node, one more step lights the
  whole story and stands back to show it; after that, it stops. `←` steps
  back out of it.
- **`⌘K` while presenting** jumps to any node in the story and tells
  everything before it on the way. `←` undoes the jump.
- **Copy as outline** in the arrange bar copies the story, in story order and
  skipping what the story skips, as nested bullets for speaker notes.

### Changed
- `⇧→` while presenting only reveals children the story tells, never the
  ones you left out.

## [0.21.0] - 2026-09-16

### Changed
- **Picking children now picks them.** A level you never touch is still told
  in map order. Once you pick any of its children (`⌘`+click from the parent
  to the first one, then sibling to sibling), the level is told exactly as
  picked and the children you left out are skipped, with everything under
  them. This replaces "unpicked siblings follow after" from 0.20.0.
- **Unpicking resets what is underneath.** Unlinking a node, or `⌫` on it
  while arranging, takes it out of the story and clears every arrangement in
  its branch. Unpicking from the middle of a chain joins the nodes either side
  of it, so the rest of the order holds.
- **Arrange mode shows what will be skipped.** Skipped branches are struck
  through and labelled `skipped`, and folded branches say how many nodes the
  fold leaves out, so a missing link shows up before the talk rather than
  during it.

### Added
- **Full screen, from a button** in the presentation bar. Ending the
  presentation leaves full screen too.
- **Pick up where you left off.** Leave a presentation and `⌘3` again in the
  same session resumes at the same step, as long as the story has not
  changed. `Home` starts over.
- **Click to move on.** A click anywhere steps forward and a right-click
  steps back, alongside the keys and presentation clickers.
- **A progress line** along the bottom edge while presenting.

## [0.20.0] - 2026-09-16

### Added
- **Tell the story in your own order.** Press `R` while presenting to arrange
  it: the whole walk comes up with every ordered node numbered. `⌘`+click a
  sibling to say *this, then that*; `⌘`+click from a parent to one of its
  children to say which child that level opens with. The same pair again
  undoes. From the keyboard, `Space` picks a node up and `Space` on a sibling
  puts the picked one before it, and `⌫` puts a node back in map order.
  `R` again presents the new order from the top.

  Order only ever changes things inside one level. A branch is told in full
  before the level above carries on, so ordering a branch's children never
  moves the branch itself. Siblings you did not order follow after the ones
  you did, in map order, so forgetting a link can never drop a point from a
  talk; folding a branch is still how you leave it out.

  The order is saved with the map and undo covers it. Deleting or moving a
  node quietly heals any order it was part of, and exports never show it.

## [0.19.0] - 2026-09-16

### Added
- **Presentation mode, on `⌘3`** (or `⌥3`). Walk a story through your map
  without showing anything you have not said yet. It starts on the centre
  alone; each `→` or `Space` reveals the next node in reading order, and the
  camera glides to frame it with its parent. What you have already covered
  stays on screen, stepped back, so the shape of the argument builds up as you
  talk. The toolbar, badges and hints step aside while you present.

  Nodes appear exactly where they will stay. The map is laid out in full and
  the parts you have not reached are simply not drawn yet, so nothing shuffles
  around as the story unfolds.

- **`⇧→` reveals a whole level at once**, for points that belong together: on
  a node with hidden children it shows them all; on a node without, it shows
  the rest of its siblings. The next `→` carries on to whatever is still
  hidden.

- **`←` steps back** exactly one step, whole levels included. `O` shows
  everything covered so far and `O` again returns; `Home` starts over.

- **`Esc`, `⌘1` or `⌘3` ends it** and puts you back where you were. Presenting
  from a focused branch tells just that branch, and folded branches stay
  folded, so folding is how you leave something out. Cross-links appear once
  both of their ends are on screen. While presenting, the keyboard and mouse
  cannot edit the map.

## [0.18.0] - 2026-09-16

### Changed
- **The number row is views.** `⌘1` is the normal map, `⌘2` is connections,
  and `⌘3` is kept for a presentation view that is on its way. From any other
  view, `⌘1` puts you back where you were, focus and all; pressing a view's own
  number again does the same.
- **`⌥1`, `⌥2` and `⌥3` mirror them**, because a browser tab may keep `⌘` plus
  a number for switching tabs and never hand it to the page. They go by the
  physical key, so they work even though `⌥` changes what a digit types on a
  Mac, and they are off while you are typing, so a node can still hold a `£`.
  `⌥L` still works for connections.
- **`⌘.` now takes you to the selection at 100%**, the job `⌘1` used to do.
  `⌘0` is unchanged: it fits the whole map, and `⌘⇧0` fits the focused branch.

## [0.17.0] - 2026-09-16

### Changed
- **The keys follow what you can see in a network.** With the tree hidden,
  arrows used to keep walking it, straight onto nodes that were not on screen.
  Now an arrow goes to the nearest node that way, and `Tab` walks the network
  nearest first and wraps.
- **Anything you make in a network stays in it.** `Enter`, `⇧Enter` and
  `⌘`+arrow tie the new node to the one you made it from, so it appears in the
  network instead of vanishing the moment it exists. Undo takes the node and
  its tie together, and a node you abandon blank takes its tie with it.
- **The link badge admits what it cannot show.** When some of a node's links
  end in a folded part of the network, the badge says so: `∿1 · 1 hidden`.
- **A bar says which view you are in**: the network's centre, how many nodes
  it has and how many are folded, or that the links are dimmed, with a button
  to step back.

### Fixed
- `Esc` while typing in a lens now finishes the node. It used to leave the lens
  instead, and in a network the new node's text went with it.
- Typing in a network no longer snaps every node back to the tree's layout
  while you type.
- Deleting the node a network is centred on falls back to dimmed rather than
  leaving an empty view.
- Moving a node (`⌥`+arrow) and inserting between nodes (hold `Tab`+arrow) are
  off inside a network, where they would rearrange a tree you cannot see.

## [0.16.0] - 2026-09-16

### Changed
- **Leaving a lens puts you back where you were.** Turning the lens off with
  `⌘2` (or `Esc` all the way out) used to drop you on the whole map. Now, if you
  were focused on a branch when the lens came up, you land back in that branch;
  if you were not, the camera returns to exactly where it was.
- **A focused network is always arranged by its links.** `⌘/` on a tied node,
  with the lens up, lays its network out by the links rather than leaving each
  node where the tree put it, so a chain that crosses the hierarchy reads as a
  chain.

### Removed
- **`⌘⇧2`, the whole-web view.** Focusing on a tied node shows its network,
  arranged the same way, which covers what the whole web was for with less to
  remember. The shortcut does nothing now.

## [0.15.0] - 2026-09-16

### Added
- **Focus follows the whole network.** With a lens up, `⌘/` on a tied node now
  shows everything it is connected to, however indirectly: if A is tied to B
  and B to C, focusing A brings all three. It follows links hop by hop and never
  runs down the tree, so the answer is "what this relates to", not "what sits
  under it".

- **Focus works in the web view too.** In `⌘⇧2`, `⌘/` narrows the web to that
  node's network and keeps it arranged by its links. `Esc` goes back to the
  whole web.

- **`⌘E` folds the network.** Inside a focused network, fold stops meaning the
  tree and starts meaning the links: everything reached only *through* the
  selected node goes, counting outward from the node you focused, and the node
  wears a badge with how many it is hiding. Click the badge or press `⌘E` again
  to bring them back. The tree itself is never touched, and the folds are
  forgotten when you leave, like everything else in a lens.

- **A lens picks up where focus left off.** Focused on a branch whose node is
  tied to something, `⌘2` opens that node's network and `⌘⇧2` arranges it,
  rather than dropping you onto the whole map. On an untied branch they behave
  as before.

## [0.14.0] - 2026-09-16

### Added
- **The connections lens.** Two kinds of relationship now share one picture, and
  past a handful of links the arcs compete with the tree for the same
  attention. `⌘2` (or `⌥L`) dims everything no link touches: the whole map stays
  exactly where it is and drops to a ghost, so the arcs come forward without
  you losing your bearings.

- **Focus escalates it.** With the lens up, `⌘/` on a tied node means *just this
  and what it reaches*: that node, the things tied to it, and nothing else, with
  the tree gone. Focus already meant "just this", so it means "just this and
  what it reaches" once the lens is up. `Esc` steps back to dimmed and again
  turns it off. On a node with nothing tied to it, `⌘/` still focuses the branch
  the way it always did.

- **`⌘⇧2` shows the whole web**, tree hidden, laid out *by the links* rather
  than by the tree. Links become springs with a rest length so tied nodes settle
  a readable distance apart; every pair repels so separate clusters claim
  separate space; and each node stays on a weak spring back to where the tidy
  tree put it, so the result is your map with the tied things drawn closer
  rather than a force-directed blob that threw your placement away.

  This is the one case where arranging earns itself: clusters that disagree with
  the hierarchy become visible as clusters, where on the tree layout the same
  links are a tangle through the middle.

Every part of this is a view. Nothing is saved, nothing moves a node for good,
an export ignores the lens entirely, and leaving puts every node back exactly
where it was.

### Changed
- Connector paths are now marked in the drawing as `te` (tree) or `lk` (link).
  They were indistinguishable from node outlines once rendered, which made the
  lens impossible to assert on.

## [0.13.0] - 2026-09-16

### Added
- **What's new.** The first time you run a version you have not run before, a
  panel says what changed. Click the Mappr wordmark to read it again any time.
  It is stamped in from `CHANGELOG.md` at build time rather than written a
  second time by hand, so it cannot drift from the record of what actually
  shipped: the changelog stays the single source and the panel is a view of it.
  It carries the last six releases.

  It does not greet a first ever run. Someone opening Mappr for the first time
  wants the map, not a list of changes to things they have never seen. The
  version is recorded on every run whether or not the panel appeared, so it can
  only ever fire on a real upgrade, and while it is open the keyboard belongs
  to it, so a stray key cannot retype the node behind it.

## [0.12.0] - 2026-09-16

### Added
- **Cross-links.** `⌘` (or `Ctrl`) + click ties the selected node to the one you
  click, anywhere on the map, and a faint arc joins them. The same pair again
  unties. This is the first thing in Mappr that is not a tree edge, so it is
  built to stay out of the tree's way: links live beside `state.nodes` rather
  than in it, layout never sees one, and tying two nodes never moves the
  picture. A pair is stored once and matched either way round.

  The line is an arc rather than the short way round. A taut line takes the
  direct path, which on a mindmap runs straight through whatever sits between
  the two ends; bowing it out costs space and keeps several links readable when
  they overlap. It is sampled into points and drawn through the same roughness
  as everything else, so it is in the app's own hand.

- **A `∿` badge on a tied node**, counting the links that land on it. The far
  end of a link is usually off screen, so the badge is a button: it walks you
  there, and clicking again cycles the rest. It opens folded branches and steps
  out of focus to get there, the same way Jump does.

- **Folded ends stay honest.** When the node you tied is folded away, the arc
  retargets to the visible ancestor and ends in a hollow dot rather than a solid
  one, and that branch carries the badge for everything tied up inside it. A
  line running into nothing would be worse than a stand-in that says so.

Links are state like anything else, so they undo, redo, save, reload, export to
SVG and PNG, and are swept when a node is deleted, the way frames already were.

## [0.11.0] - 2026-09-15

### Added
- **Touch moves the camera.** One finger pans, two fingers pinch and pan
  together with the point between them staying put. Nothing else on touch
  creates, retypes, lassoes or marks: Mappr is a keyboard app and a thumb has
  no keyboard, so touch is for reading a map you already made rather than a
  second half-built way to build one. A tap on a node still selects, which is
  how you open a folded branch. Until now the app shipped a manifest, an icon
  and an install prompt, then handed anyone who installed it a map they could
  not pan.
- **Key labels read in words off a Mac.** The hint bar, the Keys dialog and
  every button tooltip showed `⌘` and `⌥` to everyone, so Windows and Linux
  visitors were reading instructions for keys they do not have. Handling was
  always cross-platform; only the labels were not. The map itself is never
  rewritten, so a node whose text is literally `⌘` stays as typed.
- **Deleted maps wait in a bin.** A deleted map is set aside under its own key
  instead of dropped, and the last few show under *Recently deleted* in the
  maps panel with a Restore button. Only the last few: localStorage is about
  5MB with no eviction, and a bin that grew without limit would eventually cost
  you the maps you still want.
- **Arrows carry on past a sibling group.** At the edge of a node's own
  siblings the arrow continues into the next branch along at the same level,
  the way `Tab` cycling does. Two deliberate differences: it stays among
  branches pointing the same way, so you never teleport across the centre, and
  it does not wrap, because an arrow is a direction and running out of map
  should stop rather than reappear at the far end.
- **Arrows work inside focus.** On the focused node itself a sideways arrow
  carries the focus to the branch beside it and the inward arrow lifts it a
  level, so a large map can be walked branch by branch without stepping out and
  back in each time. Outward still goes to the first child, so in and out
  remain opposites.

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
