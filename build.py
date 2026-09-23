#!/usr/bin/env python3
"""Build Mappr: inline the font, the icon, the version and the release notes.

    python3 build.py            -> index.html

The font and the icon are embedded as base64 so the app works offline from a
file:// URL with no network, no server and no install step. The PWA files
(manifest, service worker, PNG icons) sit beside index.html and are only used
when it is served over http(s).
"""
import base64, html, pathlib, re, sys

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src" / "app.html"
FONT = ROOT / "assets" / "Excalifont-Regular.woff2"
ICON = ROOT / "assets" / "icon.svg"
# the ARGH! faces (1.12.0): one display weight, two reading weights, one for keys
FACES = {
    "__DISP800_B64__": ROOT / "assets" / "bricolage-grotesque-latin-800-normal.woff2",
    "__SANS400_B64__": ROOT / "assets" / "ibm-plex-sans-latin-400-normal.woff2",
    "__SANS600_B64__": ROOT / "assets" / "ibm-plex-sans-latin-600-normal.woff2",
    "__MONO500_B64__": ROOT / "assets" / "ibm-plex-mono-latin-500-normal.woff2",
}
OUT = ROOT / "index.html"
SW_SRC = ROOT / "src" / "sw.js"
SW_OUT = ROOT / "sw.js"
VERSION = (ROOT / "VERSION").read_text().strip()
CHANGELOG = ROOT / "CHANGELOG.md"
NOTE_VERSIONS = 6   # how many releases the What's new panel carries


def notes_html(md, keep=NOTE_VERSIONS):
    """The top few CHANGELOG entries, as the markup the What's new panel shows.

    The changelog is already the honest record of what shipped and why, so the
    panel is built FROM it rather than written twice and allowed to disagree.
    Only a small, known subset of markdown is handled, because that is all the
    changelog uses: version headings, Added/Fixed/Changed headings, bullets
    with hanging indent, `code` and **bold**.
    """
    def inline(t):
        t = html.escape(t)
        t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
        t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
        t = re.sub(r"(?<![\w*])\*([^*\n]+?)\*(?![\w*])", r"<em>\1</em>", t)
        return t

    out, seen, bullets = [], 0, None

    def close():
        nonlocal bullets
        if bullets is not None:
            out.append("<ul>" + "".join("<li>%s</li>" % inline(b) for b in bullets) + "</ul>")
            bullets = None

    for raw in md.splitlines():
        ver = re.match(r"^## \[([^\]]+)\]\s*-\s*(.*)$", raw)
        if ver:
            close()
            seen += 1
            if seen > keep:
                break
            out.append('<h3 class="rel">%s <span>%s</span></h3>'
                       % (inline(ver.group(1)), inline(ver.group(2))))
            continue
        if seen == 0:
            continue
        sec = re.match(r"^### (.+)$", raw)
        if sec:
            close()
            out.append("<h4>%s</h4>" % inline(sec.group(1)))
            continue
        item = re.match(r"^- (.*)$", raw)
        if item:
            if bullets is None:
                bullets = []
            bullets.append(item.group(1))
            continue
        if bullets is not None and raw.startswith("  ") and raw.strip():
            bullets[-1] += " " + raw.strip()      # hanging indent continues the bullet
            continue
        if not raw.strip():
            continue
    close()
    return "".join(out)

def main():
    src = SRC.read_text()
    b64 = base64.b64encode(FONT.read_bytes()).decode()
    icon = base64.b64encode(ICON.read_bytes()).decode()
    notes = notes_html(CHANGELOG.read_text())
    if not notes:
        sys.exit("build failed: no release notes parsed out of CHANGELOG.md")
    out = (src.replace("__FONT_B64__", b64)
              .replace("__ICON_B64__", icon)
              .replace("__NOTES__", notes)
              .replace("__VERSION__", VERSION))
    for token, path in FACES.items():
        out = out.replace(token, base64.b64encode(path.read_bytes()).decode())
    for token in ("__FONT_B64__", "__ICON_B64__", "__VERSION__", "__NOTES__", *FACES):
        if token in out:
            sys.exit("build failed: %s still present" % token)
    OUT.write_text(out)

    # The service worker's cache name is the version, so a release invalidates
    # the old cache and installed copies pick the new build up.
    sw = SW_SRC.read_text().replace("__VERSION__", VERSION)
    if "__VERSION__" in sw:
        sys.exit("build failed: __VERSION__ still present in sw.js")
    SW_OUT.write_text(sw)

    print("built %s  (v%s, %.0f KB) and %s" % (OUT.name, VERSION, len(out) / 1024, SW_OUT.name))

if __name__ == "__main__":
    main()
