#!/usr/bin/env python3
"""Build Mappr: inline the font, the icon and the version number into one HTML file.

    python3 build.py            -> index.html

The font and the icon are embedded as base64 so the app works offline from a
file:// URL with no network, no server and no install step. The PWA files
(manifest, service worker, PNG icons) sit beside index.html and are only used
when it is served over http(s).
"""
import base64, pathlib, sys

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src" / "app.html"
FONT = ROOT / "assets" / "Excalifont-Regular.woff2"
ICON = ROOT / "assets" / "icon.svg"
OUT = ROOT / "index.html"
SW_SRC = ROOT / "src" / "sw.js"
SW_OUT = ROOT / "sw.js"
VERSION = (ROOT / "VERSION").read_text().strip()

def main():
    src = SRC.read_text()
    b64 = base64.b64encode(FONT.read_bytes()).decode()
    icon = base64.b64encode(ICON.read_bytes()).decode()
    out = (src.replace("__FONT_B64__", b64)
              .replace("__ICON_B64__", icon)
              .replace("__VERSION__", VERSION))
    for token in ("__FONT_B64__", "__ICON_B64__", "__VERSION__"):
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
