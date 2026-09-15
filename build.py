#!/usr/bin/env python3
"""Build Mappr: inline the font and the version number into a single HTML file.

    python3 build.py            -> index.html

The font is embedded as base64 so the app works offline from a file:// URL
with no network, no server and no install step.
"""
import base64, pathlib, sys

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src" / "app.html"
FONT = ROOT / "assets" / "Excalifont-Regular.woff2"
OUT = ROOT / "index.html"
VERSION = (ROOT / "VERSION").read_text().strip()

def main():
    src = SRC.read_text()
    b64 = base64.b64encode(FONT.read_bytes()).decode()
    out = src.replace("__FONT_B64__", b64).replace("__VERSION__", VERSION)
    for token in ("__FONT_B64__", "__VERSION__"):
        if token in out:
            sys.exit("build failed: %s still present" % token)
    OUT.write_text(out)
    print("built %s  (v%s, %.0f KB)" % (OUT.name, VERSION, len(out) / 1024))

if __name__ == "__main__":
    main()
