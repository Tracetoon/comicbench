"""
Prepares the real-comic anchors for measures v2 (run with python -I).

For each comic in <anchors>/manifest.json writes, under <anchors>/prepared/:
  <id>.png           the comic at 760 px wide (the width our comics are judged at)
  <id>-nopayoff.png  the last panel whited out (the payoff is gone: humor control)
  <id>-flat.png      grey, blurred and washed out (craft control)

The last panel is the bottom-right cell in reading order: the right third of a
one-row strip (wider than 2:1), otherwise the bottom-right quarter of a page.

Usage: python -I scripts/anchors-prep.py <anchors dir>
"""
import json
import os
import sys

from PIL import Image, ImageEnhance, ImageFilter, ImageOps

root = sys.argv[1]
out = os.path.join(root, 'prepared')
os.makedirs(out, exist_ok=True)
manifest = json.load(open(os.path.join(root, 'manifest.json'), encoding='utf-8'))
for m in manifest:
    img = Image.open(os.path.join(root, m['file'])).convert('RGB')
    # Trim blank scan margins: crop to the inked area, plus a small border.
    g = ImageOps.grayscale(img).point(lambda v: 1 if v < 200 else 0)
    W, H = g.size
    px = g.load()
    step = 2
    cols = [x for x in range(0, W, step) if sum(px[x, y] for y in range(0, H, step)) > 0.015 * H / step]
    rows = [y for y in range(0, H, step) if sum(px[x, y] for x in range(0, W, step)) > 0.015 * W / step]
    ink = (cols[0], rows[0], cols[-1] + step, rows[-1] + step) if cols and rows else None
    if ink:
        pad = 8
        img = img.crop((max(0, ink[0] - pad), max(0, ink[1] - pad), min(img.width, ink[2] + pad), min(img.height, ink[3] + pad)))
    w, h = img.size
    scale = 760 / w
    img = img.resize((760, max(1, round(h * scale))), Image.LANCZOS)
    w, h = img.size
    img.save(os.path.join(out, f"{m['id']}.png"))

    nop = img.copy()
    if w / h > 2:
        box = (round(w * 2 / 3), 0, w, h)
    else:
        box = (round(w / 2), round(h / 2), w, h)
    nop.paste((255, 255, 255), box)
    nop.save(os.path.join(out, f"{m['id']}-nopayoff.png"))

    flat = ImageOps.grayscale(img).filter(ImageFilter.GaussianBlur(radius=2.2))
    flat = ImageEnhance.Contrast(flat).enhance(0.45).convert('RGB')
    flat.save(os.path.join(out, f"{m['id']}-flat.png"))
    print(m['id'], img.size)
