#!/usr/bin/env python3
"""Fulgaronte v04 - rebuild of the v03 blockout for fidelity to the approved concept art.

Run with Blender. The build machine has no standalone Python, so the numpy /
trimesh / VTK generator used by v01 and v02 was ported to Blender's bundled
Python. Nothing else about the method changed: controlled anatomical cross
sections, faceted planes, colour only in the UV atlas.

    blender --background --factory-startup --python build.py

Outputs:
    ../fulgaronte_v04_blockout_fiel.glb   static GLB
    ../fulgaronte_v04_uv_albedo.png       single UV atlas, embedded in the GLB
    ./fulgaronte_v04.blend                editable project

Axes while building: +X forward (head), +Y lateral, +Z up, ground at Z = 0.
The glTF exporter converts to the Y-up convention of the format.

No rig, no skinning, no clips, no electricity VFX: those are later stages.
"""
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(__file__).resolve().parent
GLB = ROOT / "fulgaronte_v04_blockout_fiel.glb"
ATLAS = ROOT / "fulgaronte_v04_uv_albedo.png"
BLEND = SRC / "fulgaronte_v04.blend"
METRICS = SRC / "build_metrics.json"
ATLAS_PX = 1024

# --------------------------------------------------------------------------
# UV atlas
# --------------------------------------------------------------------------
# Region boxes in UV space: name -> (u0, u1, v0, v1)
REGION = {
    "back":  (0.005, 0.495, 0.505, 0.995),
    "tail":  (0.505, 0.775, 0.505, 0.995),
    "head":  (0.005, 0.275, 0.005, 0.495),
    "limb":  (0.285, 0.495, 0.005, 0.495),
    "sail":  (0.505, 0.775, 0.005, 0.495),
    "plate": (0.785, 0.995, 0.285, 0.495),
    "bone":  (0.785, 0.995, 0.505, 0.715),
    "mouth": (0.785, 0.885, 0.725, 0.825),
    "teeth": (0.895, 0.995, 0.725, 0.825),
    "claw":  (0.785, 0.885, 0.845, 0.945),
    "eye":   (0.895, 0.995, 0.845, 0.945),
}


def srgb_to_linear(c):
    c = np.asarray(c, dtype=np.float64) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def value_noise(h, w, cells, rng):
    """Blocky value noise, smoothed twice: keeps patches angular, as the style asks."""
    cells = max(2, int(cells))
    base = rng.random((cells, cells))
    img = np.kron(base, np.ones((math.ceil(h / cells), math.ceil(w / cells))))[:h, :w]
    for _ in range(5):
        img = (img
               + np.roll(img, 1, 0) + np.roll(img, -1, 0)
               + np.roll(img, 1, 1) + np.roll(img, -1, 1)) / 5.0
    lo, hi = img.min(), img.max()
    return (img - lo) / max(hi - lo, 1e-6)


def build_atlas():
    """Concept palette: rock greys on the dorsum, ochre and gold mottling, pale
    belly, purple membranes. All colour distribution lives here, never in meshes."""
    rng = np.random.default_rng(917733)
    px = np.zeros((ATLAS_PX, ATLAS_PX, 3), dtype=np.float64)
    px[:, :] = np.array([92, 87, 76], dtype=np.float64)

    def box(name):
        u0, u1, v0, v1 = REGION[name]
        return (int(v0 * ATLAS_PX), int(v1 * ATLAS_PX),
                int(u0 * ATLAS_PX), int(u1 * ATLAS_PX))

    def hide(name, dorsum, flank, belly, spot, dark):
        """v runs 0 = belly, 1 = spine, so the value structure is a gradient in v."""
        y0, y1, x0, x1 = box(name)
        h, w = y1 - y0, x1 - x0
        t = np.linspace(0.0, 1.0, h)
        grad = np.empty((h, 3))
        low = t < 0.42
        grad[low] = belly + (flank - belly) * (t[low] / 0.42)[:, None]
        grad[~low] = flank + (dorsum - flank) * ((t[~low] - 0.42) / 0.58)[:, None]
        tile = np.repeat(grad[:, None, :], w, axis=1)
        tt = np.repeat(t[:, None], w, axis=1)
        # Ochre blotches sit on the flanks and dorsum and are blended, not stamped,
        # so the hide keeps the concept's rock-grey value structure.
        mott = value_noise(h, w, w // 9, rng)
        m = np.clip((mott - 0.62) / 0.26, 0, 1)[:, :, None] * np.clip((tt - 0.26) / 0.3, 0, 1)[:, :, None]
        tile = tile * (1 - 0.52 * m) + spot * (0.52 * m)
        speck = value_noise(h, w, w // 5, rng)
        s = np.clip((speck - 0.80) / 0.16, 0, 1)[:, :, None]
        tile = tile * (1 - 0.34 * s) + dark * (0.34 * s)
        tile = tile * (0.95 + 0.09 * value_noise(h, w, w // 22, rng))[:, :, None]
        # Overlapping plate seams, drawn in the atlas instead of added as
        # geometry: offset rows give the staggered scute pattern of the concept.
        warp = (value_noise(h, w, w // 9, rng) - 0.5) * 1.1
        cols = np.broadcast_to(np.linspace(0, 38, w)[None, :], (h, w)) + warp
        rws = np.broadcast_to(np.linspace(0, 15, h)[:, None], (h, w)) + warp * 0.6
        fu = np.abs((((cols + np.floor(rws) * 0.5) + 0.5) % 1.0) - 0.5)
        fv = np.abs(((rws + 0.5) % 1.0) - 0.5)
        seam = np.minimum(fu, fv)
        edge = np.clip((0.035 - seam) / 0.035, 0, 1) * np.clip((tt - 0.18) / 0.25, 0, 1)
        tile = tile * (1 - 0.17 * edge)[:, :, None]
        px[y0:y1, x0:x1] = np.clip(tile, 0, 255)

    rock = np.array([96, 92, 82], dtype=np.float64)
    flank = np.array([138, 128, 104], dtype=np.float64)
    belly = np.array([206, 194, 166], dtype=np.float64)
    gold = np.array([183, 134, 56], dtype=np.float64)
    dark = np.array([64, 58, 46], dtype=np.float64)
    hide("back", rock, flank, belly, gold, dark)
    hide("tail", rock * 0.97, flank, belly * 0.98, gold, dark)
    hide("head", np.array([118, 113, 99.0]), np.array([156, 146, 122.0]),
         np.array([205, 195, 169.0]), np.array([165, 124, 58.0]), dark)
    hide("limb", np.array([120, 114, 98.0]), np.array([152, 142, 118.0]),
         np.array([192, 181, 156.0]), gold, dark)
    hide("plate", np.array([92, 88, 79.0]), np.array([124, 117, 99.0]),
         np.array([156, 147, 125.0]), gold, dark)

    # Membranes: muted purple, darker at the root, ochre along the free edge.
    y0, y1, x0, x1 = box("sail")
    h, w = y1 - y0, x1 - x0
    t = np.linspace(0.0, 1.0, h)[:, None]
    root = np.array([86, 62, 74], dtype=np.float64)
    edge = np.array([152, 114, 126], dtype=np.float64)
    tile = np.repeat((root + (edge - root) * t)[:, None, :], w, axis=1)
    veins = value_noise(h, w, w // 18, rng)
    tile = np.where((veins > 0.74)[:, :, None], np.array([118, 90, 72.0]), tile)
    tile = tile * (0.88 + 0.22 * value_noise(h, w, w // 40, rng))[:, :, None]
    px[y0:y1, x0:x1] = np.clip(tile, 0, 255)

    # Bone / keratin for brows, cranial horns and the dorsal sail buttresses.
    y0, y1, x0, x1 = box("bone")
    h, w = y1 - y0, x1 - x0
    tile = np.repeat(np.repeat(np.array([[[170, 160, 136.0]]]), h, 0), w, 1)
    tile = tile * (0.82 + 0.32 * value_noise(h, w, w // 20, rng))[:, :, None]
    px[y0:y1, x0:x1] = np.clip(tile, 0, 255)

    for name, colour in (("mouth", (82, 44, 52)), ("teeth", (232, 220, 188)),
                         ("claw", (44, 40, 38)), ("eye", (198, 148, 42))):
        y0, y1, x0, x1 = box(name)
        px[y0:y1, x0:x1] = np.array(colour, dtype=np.float64)
    return px


# --------------------------------------------------------------------------
# geometry helpers
# --------------------------------------------------------------------------
VERTS = []
FACES = []
UVS = []          # one entry per face corner, in the same order as FACES
PART_FACES = {}


def remap(region, u, v):
    u0, u1, v0, v1 = REGION[region]
    return (u0 + (u1 - u0) * min(1.0, max(0.0, u)),
            v0 + (v1 - v0) * min(1.0, max(0.0, v)))


def emit(part, region, points, faces, uvs):
    """faces index into points; uvs holds one (u, v) in region space per point."""
    base = len(VERTS)
    VERTS.extend(tuple(p) for p in points)
    for face in faces:
        FACES.append([base + i for i in face])
        for i in face:
            UVS.append(remap(region, *uvs[i]))
    PART_FACES[part] = PART_FACES.get(part, 0) + len(faces)


def section_ring(sec, sides):
    """sec = (x, y, z, half_width, radius_up, radius_down, superellipse_exponent).

    The exponent keeps cross sections boxy, which is what produces readable
    facets instead of a rubber tube."""
    x, y, z, rx, rup, rdn, n = sec
    pts = []
    for i in range(sides):
        a = math.pi / 2 - 2 * math.pi * i / sides     # start on the spine
        ca, sa = math.cos(a), math.sin(a)
        p = 2.0 / n
        yy = rx * math.copysign(abs(ca) ** p, ca)
        zz = (rup if sa >= 0 else rdn) * math.copysign(abs(sa) ** p, sa)
        pts.append((x, y + yy, z + zz))
    return pts


def ring_v(i, sides):
    """0 at the belly, 1 at the spine, mirrored on both flanks."""
    return 1.0 - abs(1.0 - 2.0 * i / sides)


def loft(part, region, sections, sides, cap_front=True, cap_back=True):
    rings = [section_ring(s, sides) for s in sections]
    pts, uvs, faces = [], [], []
    for j, ring in enumerate(rings):
        u = j / (len(rings) - 1)
        for i, p in enumerate(ring):
            pts.append(p)
            uvs.append((u, ring_v(i, sides)))
    for j in range(len(rings) - 1):
        for i in range(sides):
            a = j * sides + i
            b = j * sides + (i + 1) % sides
            faces.append([a, b, b + sides, a + sides])
    if cap_front:
        faces.append(list(range(sides))[::-1])
    if cap_back:
        off = (len(rings) - 1) * sides
        faces.append([off + i for i in range(sides)])
    emit(part, region, pts, faces, uvs)


def frames(points):
    """Tangent / side / up frame at every point of a limb path."""
    out = []
    for i, p in enumerate(points):
        a = Vector(points[max(i - 1, 0)])
        b = Vector(points[min(i + 1, len(points) - 1)])
        t = b - a
        if t.length < 1e-6:
            t = Vector((0, 0, -1))
        t.normalize()
        ref = Vector((1, 0, 0)) if abs(t.x) < 0.9 else Vector((0, 1, 0))
        s = t.cross(ref)
        if s.length < 1e-6:
            s = Vector((0, 1, 0))
        s.normalize()
        u = s.cross(t).normalized()
        out.append((Vector(p), t, s, u))
    return out


def tube(part, region, points, radii, sides=8, squash=1.0,
         cap_front=True, cap_back=True):
    fr = frames(points)
    pts, uvs, faces = [], [], []
    for j, (p, t, s, u) in enumerate(fr):
        r = radii[j]
        for i in range(sides):
            a = 2 * math.pi * i / sides
            q = p + s * (math.cos(a) * r) + u * (math.sin(a) * r * squash)
            pts.append(tuple(q))
            uvs.append((j / (len(fr) - 1), ring_v(i, sides)))
    for j in range(len(fr) - 1):
        for i in range(sides):
            a = j * sides + i
            b = j * sides + (i + 1) % sides
            faces.append([a, b, b + sides, a + sides])
    if cap_front:
        faces.append(list(range(sides))[::-1])
    if cap_back:
        off = (len(fr) - 1) * sides
        faces.append([off + i for i in range(sides)])
    emit(part, region, pts, faces, uvs)


def shell(part, region, outline, normal, thickness, uv_axis=("x", "z")):
    """Closed slab from a planar outline: two faces plus a rim, so a membrane is a
    real volume with a silhouette, never a zero-thickness floating triangle."""
    n = Vector(normal).normalized() * (thickness / 2.0)
    pts = [tuple(Vector(p) + n) for p in outline] + [tuple(Vector(p) - n) for p in outline]
    m = len(outline)
    ia = {"x": 0, "y": 1, "z": 2}[uv_axis[0]]
    ib = {"x": 0, "y": 1, "z": 2}[uv_axis[1]]
    aa = [p[ia] for p in outline]
    bb = [p[ib] for p in outline]
    ra = max(max(aa) - min(aa), 1e-6)
    rb = max(max(bb) - min(bb), 1e-6)
    uvs = [((p[ia] - min(aa)) / ra, (p[ib] - min(bb)) / rb) for p in outline] * 2
    faces = [list(range(m)), [m + i for i in range(m)][::-1]]
    for i in range(m):
        j = (i + 1) % m
        faces.append([i, j, m + j, m + i])
    emit(part, region, pts, faces, uvs)


def spike(part, region, base, direction, length, half, sides=4, sink=0.25):
    """Pyramid whose base is pushed into the host volume, so nothing floats."""
    d = Vector(direction).normalized()
    ref = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
    s = d.cross(ref).normalized()
    u = s.cross(d).normalized()
    origin = Vector(base) - d * sink
    pts = []
    for i in range(sides):
        a = 2 * math.pi * i / sides + math.pi / sides
        pts.append(tuple(origin + s * (math.cos(a) * half) + u * (math.sin(a) * half * 0.75)))
    pts.append(tuple(Vector(base) + d * length))
    faces = [[i, (i + 1) % sides, sides] for i in range(sides)]
    faces.append(list(range(sides))[::-1])
    uvs = [(i / sides, 0.10) for i in range(sides)] + [(0.5, 0.95)]
    emit(part, region, pts, faces, uvs)


def lerp(a, b, t):
    return a + (b - a) * t


# --------------------------------------------------------------------------
# anatomy
# --------------------------------------------------------------------------
# (x, y, z, half_width, radius_up, radius_down, exponent)
# Shoulders carry the mass, the chest is deep and broad, the body sits high on
# the limbs and the tail is thick at the root and sweeps forward.
# Proportions taken from the approved concept art's side view, measured against
# the back line at the shoulder (see source/concept_profile.py and the notes in
# the delivery report): body length 15.9 m, back at the shoulder 4.96 m, belly
# 1.55 m, head 2.54 m long with the snout carried high, dominant sail 1.7 m
# above the back line.
SPINE = [
    (4.86, 0.00, 4.00, 0.66, 0.62, 0.56, 2.8),   # nape, joins the skull
    (4.45, 0.00, 3.92, 0.85, 0.74, 0.70, 2.8),
    (4.00, 0.00, 3.80, 1.08, 0.92, 0.88, 2.9),
    (3.45, 0.00, 3.62, 1.36, 1.20, 1.12, 3.0),
    (2.85, 0.00, 3.44, 1.68, 1.46, 1.46, 3.1),
    (2.25, 0.00, 3.34, 1.88, 1.62, 1.78, 3.2),   # shoulder, back line 4.96
    (1.60, 0.00, 3.30, 1.96, 1.64, 1.76, 3.3),
    (0.95, 0.00, 3.28, 2.00, 1.62, 1.74, 3.3),   # deepest chest
    (0.25, 0.00, 3.28, 1.96, 1.56, 1.72, 3.3),
    (-0.45, 0.00, 3.28, 1.88, 1.50, 1.68, 3.3),
    (-1.15, 0.00, 3.28, 1.82, 1.46, 1.62, 3.3),
    (-1.85, 0.00, 3.26, 1.78, 1.42, 1.54, 3.2),  # hip
    (-2.55, 0.00, 3.20, 1.62, 1.30, 1.42, 3.1),
    (-3.20, 0.00, 3.08, 1.36, 1.12, 1.24, 3.0),  # tail root, still heavy
    # The tail descends and hooks forward near the ground, so its curve and the
    # caudal fin both read in the profile view, as they do in the concept.
    (-3.85, 0.00, 2.92, 1.14, 0.95, 1.02, 2.9),
    (-4.55, 0.03, 2.74, 0.96, 0.82, 0.86, 2.8),
    (-5.25, 0.08, 2.52, 0.80, 0.70, 0.72, 2.7),
    (-5.95, 0.14, 2.26, 0.67, 0.59, 0.60, 2.6),
    (-6.60, 0.20, 1.98, 0.56, 0.50, 0.50, 2.6),
    (-7.20, 0.26, 1.68, 0.47, 0.42, 0.42, 2.5),
    (-7.70, 0.30, 1.38, 0.39, 0.35, 0.34, 2.4),
    (-8.08, 0.33, 1.10, 0.32, 0.29, 0.28, 2.4),
    (-8.34, 0.34, 0.86, 0.26, 0.23, 0.22, 2.3),
    (-8.48, 0.34, 0.66, 0.21, 0.19, 0.18, 2.3),
    (-8.50, 0.32, 0.50, 0.16, 0.14, 0.13, 2.2),
    (-8.42, 0.30, 0.38, 0.11, 0.10, 0.09, 2.2),
    (-8.28, 0.28, 0.32, 0.07, 0.06, 0.05, 2.2),
]
SPINE_SIDES = 12

# Skull: long wedge carried high, heavy upper jaw, brow shelf over the eye.
SKULL = [
    (4.86, 0.00, 4.00, 0.64, 0.60, 0.58, 3.0),
    (5.30, 0.00, 4.02, 0.64, 0.62, 0.62, 3.4),   # orbit and brow shelf
    (5.65, 0.00, 4.01, 0.60, 0.59, 0.59, 3.4),
    (6.10, 0.00, 3.96, 0.48, 0.48, 0.48, 3.1),
    (6.55, 0.00, 3.93, 0.36, 0.35, 0.35, 3.0),
    (7.00, 0.00, 3.91, 0.23, 0.21, 0.21, 2.8),
    (7.28, 0.00, 3.89, 0.14, 0.12, 0.12, 2.6),
    (7.40, 0.00, 3.88, 0.07, 0.07, 0.06, 2.4),   # snout tip
]
# Lower jaw, dropped open: heavy at the hinge, as in the concept head study.
JAW = [
    (4.95, 0.00, 3.18, 0.56, 0.20, 0.34, 3.2),
    (5.45, 0.00, 3.10, 0.56, 0.20, 0.36, 3.2),
    (5.95, 0.00, 3.02, 0.50, 0.19, 0.34, 3.0),
    (6.45, 0.00, 2.96, 0.42, 0.17, 0.30, 2.9),
    (6.95, 0.00, 2.92, 0.30, 0.14, 0.24, 2.7),
    (7.25, 0.00, 2.90, 0.16, 0.10, 0.16, 2.5),
    (7.36, 0.00, 2.89, 0.07, 0.05, 0.07, 2.2),
]


def spine_at(x):
    """Interpolate the torso section at a given x, for mounting structures on it."""
    pts = SPINE
    for i in range(len(pts) - 1):
        if pts[i][0] >= x >= pts[i + 1][0]:
            t = (pts[i][0] - x) / (pts[i][0] - pts[i + 1][0])
            return tuple(lerp(pts[i][k], pts[i + 1][k], t) for k in range(7))
    return pts[0] if x > pts[0][0] else pts[-1]


def back_top(x):
    s = spine_at(x)
    return Vector((x, s[1], s[2] + s[4]))


def build_body():
    loft("torso_neck_tail", "back", SPINE, SPINE_SIDES, cap_front=True, cap_back=True)


def build_head():
    loft("skull", "head", SKULL, 8)
    loft("lower_jaw", "head", JAW, 6)

    # Palate and mouth floor, so the open mouth reads as a cavity, not a hole.
    palate = [(4.92, 0.50, 3.40), (5.50, 0.46, 3.42), (6.10, 0.38, 3.46),
              (6.70, 0.26, 3.60), (7.20, 0.10, 3.74)]
    floor = [(4.96, 0.50, 3.34), (5.50, 0.48, 3.26), (6.05, 0.40, 3.18),
             (6.60, 0.28, 3.10), (7.18, 0.10, 3.00)]
    for name, row, flip in (("palate", palate, False), ("mouth_floor", floor, True)):
        pts, uvs, faces = [], [], []
        for j, (x, hw, z) in enumerate(row):
            pts.append((x, -hw, z))
            pts.append((x, hw, z))
            uvs.append((j / (len(row) - 1), 0.2))
            uvs.append((j / (len(row) - 1), 0.8))
        for j in range(len(row) - 1):
            a = 2 * j
            quad = [a, a + 1, a + 3, a + 2]
            faces.append(quad[::-1] if flip else quad)
        emit(name, "mouth", pts, faces, uvs)

    # Teeth, rooted inside the bone: bases sunk, nothing floating.
    upper = [(5.26, 0.44, 3.40), (5.74, 0.38, 3.43), (6.18, 0.31, 3.49),
             (6.58, 0.24, 3.59), (6.95, 0.17, 3.68), (7.22, 0.11, 3.77)]
    for i, (x, hw, z) in enumerate(upper):
        s = 1.0 if i % 2 == 0 else 0.76
        for sy in (-1, 1):
            spike("tooth_upper", "teeth", (x, sy * hw, z), (0.06 * sy, 0, -1),
                  0.24 * s, 0.135, sides=4, sink=0.22)
    lower = [(5.28, 0.39, 3.33), (5.74, 0.35, 3.26), (6.20, 0.30, 3.19),
             (6.62, 0.23, 3.12), (7.00, 0.16, 3.06)]
    for i, (x, hw, z) in enumerate(lower):
        s = 1.0 if i % 2 == 1 else 0.78
        for sy in (-1, 1):
            spike("tooth_lower", "teeth", (x, sy * hw, z), (0.06 * sy, 0, 1),
                  0.22 * s, 0.128, sides=4, sink=0.21)

    for sy in (-1, 1):
        # Bony brow shelf over the eye: the concept's heavy orbital ridge.
        shell("brow_ridge", "bone",
              [(5.02, sy * 0.60, 4.44), (5.52, sy * 0.72, 4.60),
               (6.02, sy * 0.56, 4.34), (5.96, sy * 0.44, 4.16),
               (5.46, sy * 0.54, 4.20), (5.00, sy * 0.52, 4.28)],
              (0, sy, 0.4), 0.18, uv_axis=("x", "z"))
        spike("eye", "eye", (5.74, sy * 0.56, 4.18), (0.15, sy, 0.05), 0.11, 0.12,
              sides=5, sink=0.10)
        # cheek and mandible scutes: heavy jaw muscles, faceted
        shell("cheek_scute", "plate",
              [(4.90, sy * 0.68, 4.08), (5.46, sy * 0.70, 4.00),
               (5.92, sy * 0.54, 3.78), (5.38, sy * 0.60, 3.64),
               (4.88, sy * 0.60, 3.76)],
              (0, sy, -0.2), 0.14, uv_axis=("x", "z"))
        shell("jaw_scute", "plate",
              [(4.94, sy * 0.54, 3.28), (5.52, sy * 0.54, 3.18),
               (6.04, sy * 0.46, 3.06), (5.94, sy * 0.40, 2.88),
               (5.38, sy * 0.46, 2.92), (4.92, sy * 0.46, 3.02)],
              (0, sy, -0.2), 0.14, uv_axis=("x", "z"))
        # Backswept cranial horns: short, broad blades, the crown of the concept
        # head study, not needles.
        for x, yy, z, ln, hf in ((5.46, 0.58, 4.58, 0.52, 0.22),
                                 (5.08, 0.60, 4.60, 0.68, 0.26),
                                 (4.76, 0.54, 4.52, 0.54, 0.22)):
            spike("cranial_horn", "bone", (x, sy * yy, z),
                  (-0.74, sy * 0.26, 0.62), ln, hf, sides=4, sink=0.30)
        # Throat mass tying the jaw hinge into the neck.
        shell("throat_mass", "limb",
              [(4.78, sy * 0.52, 3.52), (5.20, sy * 0.48, 3.24),
               (4.98, sy * 0.44, 2.96), (4.56, sy * 0.50, 3.10),
               (4.50, sy * 0.54, 3.44)],
              (0.1, sy, -0.3), 0.50, uv_axis=("x", "z"))
    spike("nasal_ridge", "bone", (6.46, 0.0, 4.20), (-0.25, 0, 1.0), 0.22, 0.16,
          sides=4, sink=0.16)
    spike("nasal_ridge", "bone", (6.08, 0.0, 4.36), (-0.30, 0, 1.0), 0.26, 0.19,
          sides=4, sink=0.18)


def build_dorsal():
    """One dominant sail, then sails that shrink and change along the back, each on
    a bony buttress continuous with the spine. No isolated flat triangles."""
    # x_front, x_back, apex x, apex z, membrane thickness
    sails = [
        (3.20, 1.05, 2.75, 6.65, 0.12),   # dominant sail over the shoulder
        (0.75, -0.95, 0.35, 5.95, 0.10),
        (-1.35, -2.75, -1.75, 4.95, 0.09),
    ]
    for x0, x1, ax, apex, th in sails:
        b0 = back_top(x0)
        b1 = back_top(x1)
        bm = back_top((x0 + x1) / 2)
        # Leading edge rises steeply, the tip leans forward, the trailing edge
        # falls back onto the spine: a swept membrane, not an isolated triangle.
        outline = [
            (b0.x, 0.0, b0.z - 0.12),
            (ax + 0.30, 0.0, apex - 0.85),
            (ax, 0.0, apex),
            (ax - 0.78, 0.0, apex - 0.58),
            (b1.x + 0.40, 0.0, lerp(b1.z, apex, 0.30)),
            (b1.x, 0.0, b1.z - 0.12),
        ]
        shell("dorsal_sail_membrane", "sail", outline, (0, 1, 0), th, uv_axis=("x", "z"))
        # Low bony buttress tying the membrane into the back, not sitting on it.
        buttress = [
            (b0.x + 0.10, 0.0, b0.z - 0.06),
            (bm.x, 0.0, bm.z + 0.26),
            (b1.x - 0.10, 0.0, b1.z - 0.06),
            (b1.x - 0.04, 0.0, b1.z - 0.40),
            (b0.x + 0.06, 0.0, b0.z - 0.40),
        ]
        shell("dorsal_sail_buttress", "bone", buttress, (0, 1, 0), th + 0.22,
              uv_axis=("x", "z"))

    # Nuchal blades over the neck and shoulder: flat, backswept plates like the
    # concept's, rooted in the neck rather than spikes planted on it.
    for sy in (-1, 1):
        for x, off, ln, wd in ((4.26, 0.46, 0.50, 0.34), (3.70, 0.54, 0.66, 0.42),
                               (3.08, 0.60, 0.80, 0.50)):
            s = spine_at(x)
            b = Vector((x, sy * s[3] * off, s[2] + s[4] * 0.74))
            d = Vector((-0.62, sy * 0.22, 0.76)).normalized()
            side = Vector((1.0, 0.0, 0.0))
            outline = [tuple(b + side * wd),
                       tuple(b + d * ln + side * (wd * 0.25)),
                       tuple(b + d * (ln * 0.85) - side * (wd * 0.55)),
                       tuple(b - side * wd * 0.9)]
            shell("nuchal_blade", "bone", outline, (0, sy, 0.25), 0.16,
                  uv_axis=("x", "z"))

    # Serrated caudal ridge: the sail series degrades into scutes down the tail.
    for i in range(11):
        x = -2.95 - 0.52 * i
        s = spine_at(x)
        h = max(0.38 - 0.030 * i, 0.09)
        top = s[2] + s[4]
        outline = [(x + 0.28, s[1], top - 0.04),
                   (x - 0.20, s[1], top + h),
                   (x - 0.30, s[1], top - 0.04),
                   (x - 0.24, s[1], top - 0.26),
                   (x + 0.24, s[1], top - 0.26)]
        shell("caudal_ridge_scute", "bone", outline, (0, 1, 0), 0.13, uv_axis=("x", "z"))


def surface_point(x, theta, sy):
    """Point and outward normal on the torso surface, theta measured from the spine.

    theta runs 0 at the back, pi/2 at the flank, pi at the belly."""
    s = spine_at(x)
    p = 2.0 / s[6]
    ct = math.cos(theta)
    y = sy * s[3] * (abs(math.sin(theta)) ** p)
    r = s[4] if ct >= 0 else s[5]
    z = s[2] + r * math.copysign(abs(ct) ** p, ct)
    n = Vector((0.0, sy * math.sin(theta), ct)).normalized()
    return Vector((x, y, z)), n

def build_armour():
    """Few, large faceted plates integrated with the body volume.

    A dense row of identical scutes read as a collage of tiles glued onto the
    back, so the armour is carried by the body's own faceted planes and by the
    UV atlas, with geometry only where it changes the silhouette: the scapular
    and pelvic plates the concept shows as distinct masses."""
    # Flat plates laid on the flank read as slabs stuck to the side, which is the
    # defect the director rejected in v01-v03. At blockout the armour is carried
    # by the torso's own faceted cross sections and by the plate pattern in the
    # UV atlas; separate plate geometry belongs to the refinement stage, where it
    # can be built into the surface instead of onto it.
    return


def foot(part_prefix, wrist, forward, sy, toe_len, spread, ground=0.06):
    """Broad foot with wide toes and heavy claws planted on the ground."""
    f = Vector(forward).normalized()
    side = Vector((-f.y, f.x, 0)).normalized()
    pad_c = Vector((wrist.x + f.x * 0.26, wrist.y + f.y * 0.26, ground + 0.16))
    tube(part_prefix + "_pastern", "limb",
         [tuple(wrist), tuple(pad_c)], [0.34, 0.40], sides=6)
    for k in range(4):
        t = (k - 1.5) / 1.5
        d = (f + side * (t * spread)).normalized()
        start = pad_c + d * 0.18
        tip = Vector((start.x + d.x * toe_len, start.y + d.y * toe_len, ground + 0.10))
        tube(part_prefix + "_toe", "limb", [tuple(start), tuple(tip)],
             [0.17, 0.12], sides=5)
        claw_dir = Vector((d.x, d.y, -0.55)).normalized()
        spike(part_prefix + "_claw", "claw", tuple(tip), tuple(claw_dir),
              0.30, 0.09, sides=4, sink=0.12)


def build_limbs():
    for sy in (-1, 1):
        # Forelimb: columnar and heavy, with the shoulder mass rooted in the chest.
        wrist = Vector((2.32, sy * 2.10, 0.55))
        tube("forelimb", "limb",
             [(2.30, sy * 1.55, 3.40), (2.15, sy * 1.85, 2.40),
              (1.95, sy * 2.02, 1.55), (2.15, sy * 2.08, 1.00), tuple(wrist)],
             [1.05, 0.80, 0.62, 0.54, 0.50], sides=8)
        foot("forefoot", wrist, (1.0, sy * 0.12, 0), sy, 0.74, 0.95)

        # Hindlimb: muscular thigh, real ground support under the hip.
        ankle = Vector((-1.85, sy * 2.02, 0.60))
        tube("hindlimb", "limb",
             [(-1.80, sy * 1.50, 3.45), (-2.10, sy * 1.78, 2.45),
              (-2.32, sy * 1.95, 1.60), (-2.05, sy * 2.00, 1.05), tuple(ankle)],
             [1.15, 0.88, 0.66, 0.56, 0.52], sides=8)
        foot("hindfoot", ankle, (1.0, sy * 0.10, 0), sy, 0.70, 0.90)

        # Forearm membrane: large, curved, swept back, on a leading-edge spine.
        root_a = Vector((2.12, sy * 2.08, 2.30))
        root_b = Vector((2.34, sy * 2.14, 0.84))
        outline = [
            tuple(root_a),
            (1.42, sy * 2.86, 2.76),
            (0.50, sy * 3.20, 2.24),
            (0.08, sy * 3.02, 1.30),
            (0.58, sy * 2.54, 0.56),
            (1.54, sy * 2.30, 0.48),
            tuple(root_b),
        ]
        shell("forearm_fin_membrane", "sail", outline, (0, sy, 0.1), 0.10,
              uv_axis=("x", "z"))
        tube("forearm_fin_spine", "bone",
             [tuple(root_a), (1.42, sy * 2.82, 2.72), (0.54, sy * 3.14, 2.20)],
             [0.15, 0.12, 0.07], sides=4)

        # Small stabilising fin over the hip, as in the concept's rear quarter.
        shell("pelvic_fin", "sail",
              [(-2.15, sy * 1.78, 3.30), (-3.05, sy * 2.10, 2.94),
               (-3.42, sy * 1.96, 2.30), (-2.65, sy * 1.74, 2.36)],
              (0, sy, 0.1), 0.07, uv_axis=("x", "z"))


def build_tail_fin():
    """Large organic caudal fin: two lobes following the tail's forward sweep."""
    # Broad vertical blade over the last stretch of the tail, swept back and up,
    # with its root buried in the tail volume. Outline is in the profile plane so
    # the fin reads at full size from the side, as it does in the concept art.
    y = 0.30
    upper = [(-6.55, y, 1.98), (-7.45, y, 2.76), (-8.15, y, 2.96),
             (-8.52, y, 2.22), (-8.62, y, 1.28), (-8.35, y, 0.45)]
    shell("caudal_fin_upper", "sail", upper, (0, 1, 0), 0.13, uv_axis=("x", "z"))
    lower = [(-8.28, y, 0.42), (-8.58, y, 0.14), (-8.38, y, 0.04),
             (-8.02, y, 0.28)]
    shell("caudal_fin_lower", "sail", lower, (0, 1, 0), 0.12, uv_axis=("x", "z"))
    # Stiff rays so the blade reads as anatomy, not as paper.
    for a, b in (((-7.20, y, 1.60), (-7.62, y, 2.60)),
                 ((-7.80, y, 1.26), (-8.10, y, 2.68)),
                 ((-8.28, y, 0.80), (-8.44, y, 2.10))):
        tube("caudal_fin_ray", "bone", [a, b], [0.10, 0.045], sides=4)


# --------------------------------------------------------------------------
# assembly, texture, export
# --------------------------------------------------------------------------
def make_object():
    mesh = bpy.data.meshes.new("Fulgaronte_v04")
    mesh.from_pydata(VERTS, [], FACES)
    mesh.validate(verbose=False)
    uv = mesh.uv_layers.new(name="UVMap")
    flat = [c for pair in UVS for c in pair]
    uv.data.foreach_set("uv", flat)
    obj = bpy.data.objects.new("Fulgaronte_v04", mesh)
    bpy.context.scene.collection.objects.link(obj)

    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method="SHORT_EDGE")
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = False          # faceted shading is the project's language
    return obj


def make_material(obj):
    px = build_atlas()
    img = bpy.data.images.new("fulgaronte_v04_uv_albedo", ATLAS_PX, ATLAS_PX, alpha=False)
    rgba = np.ones((ATLAS_PX, ATLAS_PX, 4), dtype=np.float32)
    rgba[:, :, :3] = srgb_to_linear(px).astype(np.float32)
    img.pixels.foreach_set(rgba.ravel())
    img.filepath_raw = str(ATLAS)
    img.file_format = "PNG"
    img.save()
    img.pack()

    mat = bpy.data.materials.new("Fulgaronte v04 UV")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.86
    bsdf.inputs["Metallic"].default_value = 0.0
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    tex.interpolation = "Closest"
    tex.location = (-420, 240)
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    obj.data.materials.append(mat)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    VERTS.clear(); FACES.clear(); UVS.clear(); PART_FACES.clear()

    build_body()
    build_head()
    build_dorsal()
    build_armour()
    build_limbs()
    build_tail_fin()

    obj = make_object()
    make_material(obj)

    mesh = obj.data
    mesh.calc_loop_triangles()
    tris = len(mesh.loop_triangles)
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for v in mesh.vertices:
        lo = Vector((min(lo[i], v.co[i]) for i in range(3)))
        hi = Vector((max(hi[i], v.co[i]) for i in range(3)))

    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    bpy.ops.export_scene.gltf(
        filepath=str(GLB),
        export_format="GLB",
        export_apply=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_yup=True,
        use_selection=False,
        export_normals=True,
        export_texcoords=True,
        export_skins=False,
        export_animations=False,
    )
    data = GLB.read_bytes()
    metrics = {
        "triangles": tris,
        "vertices": len(mesh.vertices),
        "quads_and_ngons_before_triangulation": len(FACES),
        "parts": len(PART_FACES),
        "part_faces": dict(sorted(PART_FACES.items())),
        "bbox_min": [round(v, 4) for v in lo],
        "bbox_max": [round(v, 4) for v in hi],
        "length_x_m": round(hi.x - lo.x, 3),
        "width_y_m": round(hi.y - lo.y, 3),
        "height_z_m": round(hi.z - lo.z, 3),
        "glb_bytes": len(data),
        "glb_sha256": hashlib.sha256(data).hexdigest(),
        "atlas_px": ATLAS_PX,
    }
    METRICS.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print("BUILD_JSON " + json.dumps(metrics))


main()
