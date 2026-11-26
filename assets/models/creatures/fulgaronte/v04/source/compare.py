#!/usr/bin/env python3
"""Build the visual comparison sheet: concept art, v03 and v04, plus a
semi-transparent silhouette overlay of v03 against v04.

    blender --background --factory-startup --python compare.py -- \\
        <concept image> <v03 profile png> <v04 profile png> <out png>

The v03 and v04 panels are the real renders of the re-imported GLBs, produced by
render.py with the same camera, orthographic scale and lighting, so the overlay
compares silhouettes at the same scale and not two different framings.
"""
import sys
from pathlib import Path

import bpy
import numpy as np


def load(path):
    img = bpy.data.images.load(str(path))
    w, h = img.size
    buf = np.empty(w * h * img.channels, dtype=np.float32)
    img.pixels.foreach_get(buf)
    a = buf.reshape(h, w, img.channels)[:, :, :3]
    return np.flipud(a).astype(np.float64)


def resize(a, h, w):
    ys = (np.arange(h) * (a.shape[0] / h)).astype(int).clip(0, a.shape[0] - 1)
    xs = (np.arange(w) * (a.shape[1] / w)).astype(int).clip(0, a.shape[1] - 1)
    return a[ys][:, xs]


def silhouette(a):
    """The renders sit on a flat background, so the corner colour is the key."""
    bg = a[4, 4]
    return np.linalg.norm(a - bg, axis=2) > 0.03


def label_bar(w, height=34):
    bar = np.ones((height, w, 3)) * 0.12
    return bar


def main():
    argv = sys.argv[sys.argv.index("--") + 1:]
    concept, v03, v04, out = (Path(p) for p in argv[:4])
    ch, cw = 520, 700                      # panel size

    panels = [resize(load(p), ch, cw) for p in (concept, v03, v04)]

    m3 = silhouette(resize(load(v03), ch, cw))
    m4 = silhouette(resize(load(v04), ch, cw))
    overlay = np.ones((ch, cw, 3)) * 0.93
    overlay[m3] = overlay[m3] * 0.35 + np.array([0.82, 0.29, 0.20]) * 0.65
    overlay[m4] = overlay[m4] * 0.35 + np.array([0.17, 0.42, 0.62]) * 0.65
    both = m3 & m4
    overlay[both] = np.array([0.20, 0.20, 0.24])
    panels.append(overlay)

    gap = 10
    sheet = np.ones((ch * 2 + gap * 3, cw * 2 + gap * 3, 3)) * 0.08
    for i, p in enumerate(panels):
        r, c = divmod(i, 2)
        y = gap + r * (ch + gap)
        x = gap + c * (cw + gap)
        sheet[y:y + ch, x:x + cw] = p
        sheet[y:y + 5, x:x + cw] = (0.55, 0.5, 0.42) if i != 3 else (0.3, 0.5, 0.6)

    h, w, _ = sheet.shape
    img = bpy.data.images.new("sheet", w, h, alpha=True)
    rgba = np.ones((h, w, 4), dtype=np.float32)
    # Reads come back with the stored sRGB values; writes are interpreted as
    # scene-linear, so convert once before saving to round-trip the colours.
    s = np.clip(sheet, 0, 1)
    rgba[:, :, :3] = np.where(s <= 0.04045, s / 12.92,
                              ((s + 0.055) / 1.055) ** 2.4).astype(np.float32)
    img.pixels.foreach_set(np.flipud(rgba).ravel())
    img.filepath_raw = str(out)
    img.file_format = "PNG"
    img.save()
    print("COMPARE_OK " + str(out))


main()
