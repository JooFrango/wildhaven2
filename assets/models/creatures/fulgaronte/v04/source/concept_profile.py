#!/usr/bin/env python3
"""Measure the approved concept art's side silhouette, so the v04 proportions come
from the artwork instead of from guesswork.

    blender --background --factory-startup --python concept_profile.py -- <image> <outdir>

The script masks the flat paper background, drops the inset head study in the top
right corner, and reports, for a set of sample columns, the top and bottom of the
creature's silhouette in units where the body length is 1.0. It also writes a
mask PNG so the measurement itself can be checked by eye.

The concept art is a near-profile drawing with slight perspective, so these
numbers are a proportion guide, not a projection: they fix where the back line,
the sails, the head and the tail sit along the body.
"""
import json
import sys
from pathlib import Path

import bpy
import numpy as np

SAMPLES = 48


def load(path):
    img = bpy.data.images.load(str(path))
    w, h = img.size
    buf = np.empty(w * h * img.channels, dtype=np.float32)
    img.pixels.foreach_get(buf)
    a = buf.reshape(h, w, img.channels)[:, :, :3]
    return np.flipud(a)          # row 0 = top of the picture


def main():
    argv = sys.argv[sys.argv.index("--") + 1:]
    src, outdir = Path(argv[0]), Path(argv[1])
    outdir.mkdir(parents=True, exist_ok=True)
    a = load(src)
    h, w, _ = a.shape

    # The parchment is a smooth gradient, so fit a quadratic background from a
    # band just inside the printed frame and mask whatever departs from it.
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    yn, xn = yy / h, xx / w
    # The creature spans almost the whole frame, so no fixed border band is clean.
    # Fit robustly instead: refit on the better half of the residuals each round.
    basis = np.stack([np.ones_like(xn), xn, yn, xn * yn, xn ** 2, yn ** 2], axis=-1)
    flat = basis.reshape(-1, 6)
    inlier = np.ones(h * w, dtype=bool)
    fit = np.empty_like(a)
    for _ in range(4):
        for c in range(3):
            coef, *_ = np.linalg.lstsq(flat[inlier], a[:, :, c].ravel()[inlier],
                                       rcond=None)
            fit[:, :, c] = (flat @ coef).reshape(h, w)
        res = np.linalg.norm(a - fit, axis=2).ravel()
        inlier = res <= np.percentile(res, 55)
    res = np.linalg.norm(a - fit, axis=2)
    mask = res > 0.055

    # Drop the printed frame and the inset head study in the top right corner.
    pad_x, pad_y = int(w * 0.025), int(h * 0.03)
    mask[:pad_y, :] = False
    mask[-pad_y:, :] = False
    mask[:, :pad_x] = False
    mask[:, -pad_x:] = False
    mask[:int(h * 0.42), int(w * 0.66):] = False
    # Drop the loose ground rocks: small blobs far from the body's column mass.
    cols = mask.sum(axis=0)
    body = cols > (0.02 * h)
    xs = np.flatnonzero(body)
    x0, x1 = xs.min(), xs.max()

    rows = []
    for i in range(SAMPLES):
        x = int(round(x0 + (x1 - x0) * i / (SAMPLES - 1)))
        col = np.flatnonzero(mask[:, x])
        if col.size < 3:
            rows.append(None)
            continue
        rows.append((int(col.min()), int(col.max())))

    span = x1 - x0
    out = {"image": src.name, "width_px": w, "height_px": h,
           "body_x0_px": int(x0), "body_x1_px": int(x1), "span_px": int(span),
           "samples": []}
    for i, r in enumerate(rows):
        u = i / (SAMPLES - 1)
        if r is None:
            out["samples"].append({"u": round(u, 4), "top": None, "bottom": None})
            continue
        top, bot = r
        # y measured upward from the lowest point of the whole silhouette,
        # in units of the body length.
        out["samples"].append({
            "u": round(u, 4),
            "top": round((mask.shape[0] - top) / span, 4),
            "bottom": round((mask.shape[0] - bot) / span, 4),
        })
    ground = min(s["bottom"] for s in out["samples"] if s["bottom"] is not None)
    for s in out["samples"]:
        if s["top"] is not None:
            s["top"] = round(s["top"] - ground, 4)
            s["bottom"] = round(s["bottom"] - ground, 4)
    out["ground_offset"] = round(ground, 4)

    vis = np.zeros((h, w, 4), dtype=np.float32)
    vis[:, :, 3] = 1.0
    vis[mask] = (0.95, 0.35, 0.18, 1.0)
    vis[~mask] = (0.10, 0.10, 0.12, 1.0)
    out_img = bpy.data.images.new("mask", w, h, alpha=True)
    out_img.pixels.foreach_set(np.flipud(vis).ravel())
    out_img.filepath_raw = str(outdir / "conceito_mascara.png")
    out_img.file_format = "PNG"
    out_img.save()

    (outdir / "conceito_perfil.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    print("PROFILE_JSON " + json.dumps(out))


main()
