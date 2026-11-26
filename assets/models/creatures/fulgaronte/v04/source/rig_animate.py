#!/usr/bin/env python3
"""Fulgaronte v04 - rig, skinning and animation clips on top of the static blockout.

    blender --background --factory-startup --python rig_animate.py

Reads the published static GLB from disk, builds an armature, skins the mesh with
real vertex weights, authors the clips and exports:

    ../fulgaronte_v04_animado.glb        skinned and animated GLB
    ./fulgaronte_v04_animado.blend       editable project

The static blockout file is never modified. Weights are deformation weights, not
rigid pivots: every vertex gets up to two bones with smooth falloff.

Stage note: the form of the blockout has not been approved by the director. These
clips were requested anyway and do not imply approval of the shape.
"""
from __future__ import annotations

import math
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(__file__).resolve().parent
STATIC = ROOT / "fulgaronte_v04_blockout_fiel.glb"
OUT = ROOT / "fulgaronte_v04_animado.glb"
BLEND = SRC / "fulgaronte_v04_animado.blend"
FPS = 24

# --------------------------------------------------------------------------
# skeleton: name, head, tail, parent
# Coordinates follow build.py: +X forward (head), +Y lateral, +Z up, ground 0.
# --------------------------------------------------------------------------
def skeleton():
    bones = [
        ("root",   (0.00, 0, 0.00), (0.90, 0, 0.00), None),
        ("hips",   (-1.85, 0, 3.22), (-0.45, 0, 3.28), "root"),
        ("spine1", (-0.45, 0, 3.28), (0.95, 0, 3.28), "hips"),
        ("spine2", (0.95, 0, 3.28), (2.25, 0, 3.36), "spine1"),
        ("chest",  (2.25, 0, 3.36), (3.45, 0, 3.66), "spine2"),
        ("neck1",  (3.45, 0, 3.66), (4.10, 0, 3.76), "chest"),
        ("neck2",  (4.10, 0, 3.76), (4.78, 0, 3.82), "neck1"),
        ("head",   (4.78, 0, 3.82), (7.10, 0, 3.58), "neck2"),
        ("jaw",    (4.82, 0, 2.98), (7.30, 0, 2.44), "head"),
        ("tail1",  (-1.85, 0, 3.22), (-3.20, 0, 3.08), "hips"),
        ("tail2",  (-3.20, 0, 3.08), (-4.55, 0, 2.80), "tail1"),
        ("tail3",  (-4.55, 0, 2.80), (-5.75, 0, 2.56), "tail2"),
        ("tail4",  (-5.75, 0, 2.56), (-6.80, 0, 2.35), "tail3"),
        ("tail5",  (-6.80, 0, 2.35), (-7.62, 0, 2.19), "tail4"),
        ("tail6",  (-7.62, 0, 2.19), (-8.56, 0, 2.00), "tail5"),
        ("sail1",  (2.85, 0, 4.90), (2.85, 0, 6.85), "chest"),
        ("sail2",  (-0.20, 0, 4.60), (-0.20, 0, 5.70), "spine1"),
        ("sail3",  (-1.95, 0, 4.30), (-1.95, 0, 4.90), "hips"),
    ]
    for sy, tag in ((1, "L"), (-1, "R")):
        bones += [
            (f"shoulder_{tag}", (2.30, sy * 0.90, 3.42), (2.30, sy * 1.55, 3.42), "chest"),
            (f"upperarm_{tag}", (2.30, sy * 1.55, 3.42), (1.95, sy * 2.54, 1.50),
             f"shoulder_{tag}"),
            (f"forearm_{tag}", (1.95, sy * 2.54, 1.50), (2.34, sy * 2.80, 0.52),
             f"upperarm_{tag}"),
            (f"hand_{tag}", (2.34, sy * 2.80, 0.52), (3.05, sy * 2.90, 0.10),
             f"forearm_{tag}"),
            (f"armfin_{tag}", (2.12, sy * 2.10, 2.30), (0.20, sy * 3.10, 1.35),
             f"upperarm_{tag}"),
            (f"pelvis_{tag}", (-1.80, sy * 0.90, 3.40), (-1.80, sy * 1.50, 3.40), "hips"),
            (f"thigh_{tag}", (-1.80, sy * 1.50, 3.40), (-2.32, sy * 2.48, 1.52),
             f"pelvis_{tag}"),
            (f"shin_{tag}", (-2.32, sy * 2.48, 1.52), (-1.86, sy * 2.72, 0.56),
             f"thigh_{tag}"),
            (f"foot_{tag}", (-1.86, sy * 2.72, 0.56), (-1.15, sy * 2.80, 0.10),
             f"shin_{tag}"),
        ]
    return bones


# Bones that must not capture vertices by distance alone: the open mouth puts
# the upper teeth closer to the jaw bone than to the skull bone.
MOUTH_BONES = {"head", "jaw"}


def gape_split(x):
    """z of the plane separating skull from mandible, along the open mouth."""
    t = min(max((x - 4.80) / 2.50, 0.0), 1.0)
    return 3.02 + (2.72 - 3.02) * t


def build_armature(mesh_obj):
    arm_data = bpy.data.armatures.new("Fulgaronte_v04_rig")
    arm = bpy.data.objects.new("Fulgaronte_v04_rig", arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    created = {}
    for name, head, tail, parent in skeleton():
        eb = arm_data.edit_bones.new(name)
        eb.head = Vector(head)
        eb.tail = Vector(tail)
        eb.use_connect = False
        if parent:
            eb.parent = created[parent]
        created[name] = eb
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm


def segment_distance(points, a, b):
    """Distance from each point to the segment a-b."""
    a = np.array(a, dtype=np.float64)
    b = np.array(b, dtype=np.float64)
    ab = b - a
    denom = float(ab @ ab) or 1e-9
    t = np.clip(((points - a) @ ab) / denom, 0.0, 1.0)[:, None]
    return np.linalg.norm(points - (a + t * ab), axis=1)


def skin(mesh_obj, arm):
    """Smooth distance weighting: two bones per vertex, with the mouth resolved
    by the gape plane so the upper teeth stay on the skull."""
    co = np.empty(len(mesh_obj.data.vertices) * 3, dtype=np.float64)
    mesh_obj.data.vertices.foreach_get("co", co)
    pts = co.reshape(-1, 3)

    bones = [(n, h, t) for n, h, t, _ in skeleton() if n != "root"]
    names = [n for n, _, _ in bones]
    dist = np.stack([segment_distance(pts, h, t) for _, h, t in bones], axis=1)

    head_i = names.index("head")
    jaw_i = names.index("jaw")
    # Inside the head, decide by the gape plane instead of by distance.
    in_head = pts[:, 0] > 4.55
    above = pts[:, 2] > np.array([gape_split(x) for x in pts[:, 0]])
    dist[in_head & above, jaw_i] = 1e6
    dist[in_head & ~above, head_i] = 1e6
    # Outside the head neither mouth bone may claim anything.
    dist[~in_head, head_i] = 1e6
    dist[~in_head, jaw_i] = 1e6

    groups = {n: mesh_obj.vertex_groups.new(name=n) for n in names}
    order = np.argsort(dist, axis=1)[:, :2]
    for vi in range(pts.shape[0]):
        i0, i1 = order[vi]
        d0, d1 = dist[vi, i0], dist[vi, i1]
        w0 = 1.0 / max(d0, 1e-3) ** 2
        w1 = 1.0 / max(d1, 1e-3) ** 2
        # A far second bone must not bleed into a limb.
        if d1 > d0 * 2.2:
            w1 = 0.0
        s = w0 + w1
        groups[names[i0]].add([vi], w0 / s, "REPLACE")
        if w1 > 0:
            groups[names[i1]].add([vi], w1 / s, "REPLACE")

    mod = mesh_obj.modifiers.new("Armature", "ARMATURE")
    mod.object = arm
    mesh_obj.parent = arm


# --------------------------------------------------------------------------
# animation
# --------------------------------------------------------------------------
def pose(arm):
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
    return {pb.name: pb for pb in arm.pose.bones}


def key(pb, frame, swing=0.0, bend=0.0, twist=0.0, loc=None):
    """Pose a bone in world terms, whatever its rest orientation.

    swing pitches it nose-down/up (around world Y), bend turns it left/right
    (around world Z) and twist rolls it (around world X). Posing bones in their
    own local axes is unusable here, because each limb bone has a different roll.
    """
    if swing or bend or twist or loc is None:
        world = (Matrix.Rotation(math.radians(bend), 3, "Z")
                 @ Matrix.Rotation(math.radians(swing), 3, "Y")
                 @ Matrix.Rotation(math.radians(twist), 3, "X"))
        rest = pb.bone.matrix_local.to_3x3()
        pb.rotation_quaternion = (rest.inverted() @ world @ rest).to_quaternion()
        pb.keyframe_insert("rotation_quaternion", frame=frame)
    if loc is not None:
        pb.location = Vector(loc)
        pb.keyframe_insert("location", frame=frame)


def new_action(arm, name, length):
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    arm.animation_data_create()
    arm.animation_data.action = action
    for pb in arm.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
    return action, length


def wave(pbs, chain, frames, amp, phase=0.0, decay=1.0):
    """Travelling lateral wave down a bone chain: the body carries the motion."""
    for i, name in enumerate(chain):
        a = amp * (decay ** i)
        for f in frames:
            t = (f - frames[0]) / max(frames[-1] - frames[0], 1)
            key(pbs[name], f, bend=a * math.sin(2 * math.pi * (t + phase) - i * 0.6))


def leg_cycle(pbs, tag, frames, swing, lift, offset):
    """One leg through a gait cycle; offset shifts the phase between limbs."""
    span = max(frames[-1] - frames[0], 1)
    for limb, amp in ((f"upperarm_{tag}", swing), (f"thigh_{tag}", swing * 0.9)):
        for f in frames:
            t = (f - frames[0]) / span
            key(pbs[limb], f, swing=-amp * math.sin(2 * math.pi * (t + offset)))
    for limb, amp in ((f"forearm_{tag}", lift), (f"shin_{tag}", lift)):
        for f in frames:
            t = (f - frames[0]) / span
            # The joint only folds backwards, and most during the swing phase.
            key(pbs[limb], f,
                swing=abs(amp * math.sin(math.pi * (t + offset))) * 0.9)


def clip_idle(arm, pbs):
    """Standing, breathing, slow tail sway, an occasional jaw movement."""
    action, n = new_action(arm, "idle", 96)
    frames = [1, 24, 48, 72, 96]
    for f, a in zip(frames, (0, 1.0, 0, -1.0, 0)):
        key(pbs["chest"], f, swing=a * 0.8)
        key(pbs["spine1"], f, swing=a * 0.5)
        key(pbs["neck2"], f, swing=-a * 1.2)
        key(pbs["head"], f, swing=a * 0.8, bend=a * 2.0)
        key(pbs["jaw"], f, swing=max(a, 0) * 4.0)
    wave(pbs, ["tail1", "tail2", "tail3", "tail4", "tail5", "tail6"],
         frames, 3.0, decay=1.12)
    for tag in ("L", "R"):
        for f, a in zip(frames, (0, 3, 0, -3, 0)):
            key(pbs[f"armfin_{tag}"], f, swing=a)
    return action, n


def clip_walk(arm, pbs):
    """Four-beat walk: diagonal limbs, body roll, tail counter-sway."""
    action, n = new_action(arm, "walk", 48)
    frames = list(range(1, 50, 4))
    for tag, off in (("L", 0.0), ("R", 0.5)):
        leg_cycle(pbs, tag, frames, swing=22.0, lift=26.0, offset=off)
    for f in frames:
        t = (f - 1) / 48
        key(pbs["root"], f, loc=(0, 0, 0.09 * math.sin(4 * math.pi * t)))
        key(pbs["chest"], f, twist=3.0 * math.sin(2 * math.pi * t),
            bend=2.0 * math.sin(2 * math.pi * t))
        key(pbs["hips"], f, twist=-3.0 * math.sin(2 * math.pi * t),
            bend=-2.4 * math.sin(2 * math.pi * t))
        key(pbs["head"], f, swing=1.6 * math.sin(4 * math.pi * t))
    wave(pbs, ["tail1", "tail2", "tail3", "tail4", "tail5", "tail6"],
         frames, 5.0, decay=1.1)
    return action, n


def clip_swim(arm, pbs):
    """Amphibious swim: limbs tucked back, lateral undulation drives the body."""
    action, n = new_action(arm, "swim", 60)
    frames = list(range(1, 62, 5))
    wave(pbs, ["hips", "tail1", "tail2", "tail3", "tail4", "tail5", "tail6"],
         frames, 10.0, decay=1.16)
    wave(pbs, ["chest", "spine2", "spine1"], frames, 4.0, phase=0.35)
    for tag in ("L", "R"):
        for f in frames:
            t = (f - 1) / 60
            key(pbs[f"upperarm_{tag}"], f, swing=30 + 8 * math.sin(2 * math.pi * t))
            key(pbs[f"forearm_{tag}"], f, swing=20)
            key(pbs[f"thigh_{tag}"], f, swing=34)
            key(pbs[f"shin_{tag}"], f, swing=22)
            key(pbs[f"armfin_{tag}"], f,
                swing=16 * math.sin(2 * math.pi * t + 1.0))
    for f in frames:
        key(pbs["root"], f, loc=(0, 0, 0.35))
    return action, n


def clip_feed(arm, pbs):
    """Head down to the carcass, two bites, then back up."""
    action, n = new_action(arm, "feed", 72)
    seq = [(1, 0, 0), (12, 16, 8), (22, 24, 30), (30, 24, 3),
           (40, 22, 28), (48, 22, 3), (60, 9, 10), (72, 0, 0)]
    for f, down, jaw in seq:
        key(pbs["neck1"], f, swing=down * 0.5)
        key(pbs["neck2"], f, swing=down * 0.7)
        key(pbs["head"], f, swing=down * 0.5)
        key(pbs["jaw"], f, swing=jaw)
        key(pbs["chest"], f, swing=down * 0.2)
    wave(pbs, ["tail1", "tail2", "tail3", "tail4"], [1, 24, 48, 72], 4.0)
    return action, n


def clip_alert(arm, pbs):
    """Head and sails raised, mouth half open, weight shifted back."""
    action, n = new_action(arm, "alert", 48)
    seq = [(1, 0, 0, 0), (8, 11, 8, 18), (18, 16, 12, 26), (34, 14, 11, 24),
           (48, 3, 2, 5)]
    for f, up, jaw, sail in seq:
        key(pbs["neck1"], f, swing=-up * 0.7)
        key(pbs["neck2"], f, swing=-up * 0.8)
        key(pbs["head"], f, swing=-up * 0.5)
        key(pbs["jaw"], f, swing=jaw)
        key(pbs["chest"], f, swing=-up * 0.3)
        for i, name in enumerate(("sail1", "sail2", "sail3")):
            key(pbs[name], f, swing=-sail * (1.0 - 0.18 * i))
    wave(pbs, ["tail1", "tail2", "tail3", "tail4", "tail5"], [1, 16, 32, 48], 6.0)
    return action, n


def clip_hit_react(arm, pbs):
    """Short flinch away from the blow, then recovery."""
    action, n = new_action(arm, "hit_react", 36)
    seq = [(1, 0, 0, 0), (4, -15, 12, 16), (9, -9, 18, 9), (16, 5, 7, -6),
           (24, -2, 3, 2), (36, 0, 0, 0)]
    for f, pitch, jaw, side in seq:
        key(pbs["chest"], f, swing=pitch * 0.4, bend=side, twist=side * 0.6)
        key(pbs["neck2"], f, swing=pitch, bend=side * 1.3)
        key(pbs["head"], f, swing=pitch * 0.9, bend=side * 1.8)
        key(pbs["jaw"], f, swing=jaw)
        key(pbs["hips"], f, swing=-pitch * 0.3, bend=-side * 0.7)
    wave(pbs, ["tail1", "tail2", "tail3", "tail4", "tail5", "tail6"],
         [1, 9, 18, 27, 36], 10.0, decay=1.1)
    return action, n


def clip_rest(arm, pbs):
    """Lies down on the belly, limbs folded, slow breathing."""
    action, n = new_action(arm, "rest", 72)
    for f, drop in ((1, 0.0), (18, -1.05), (36, -1.20), (54, -1.18), (72, -1.20)):
        key(pbs["root"], f, loc=(0, 0, drop))
    for f, fold in ((1, 0), (18, 44), (36, 50), (72, 50)):
        for tag in ("L", "R"):
            key(pbs[f"upperarm_{tag}"], f, swing=-fold * 0.55)
            key(pbs[f"forearm_{tag}"], f, swing=fold * 1.05)
            key(pbs[f"thigh_{tag}"], f, swing=-fold * 0.5)
            key(pbs[f"shin_{tag}"], f, swing=fold * 1.0)
    for f, b in ((1, 0), (24, 1.6), (48, 0), (72, 1.6)):
        key(pbs["chest"], f, swing=b)
        key(pbs["head"], f, swing=-b * 0.6)
    wave(pbs, ["tail1", "tail2", "tail3", "tail4"], [1, 24, 48, 72], 2.0)
    return action, n


def clip_death(arm, pbs):
    """Staggers, legs give way, the body rolls onto its side and settles."""
    action, n = new_action(arm, "death", 72)
    seq = [(1, 0, 0, 0.0, 0), (8, -12, 15, 0.0, 5), (18, 7, 22, -0.10, 22),
           (30, 3, 11, -0.22, 52), (44, 1, 5, -0.32, 68), (60, 0, 2, -0.35, 72),
           (72, 0, 0, -0.35, 72)]
    for f, pitch, jaw, drop, roll in seq:
        key(pbs["root"], f, twist=roll, loc=(0, 0, drop))
        key(pbs["neck2"], f, swing=pitch)
        key(pbs["head"], f, swing=pitch * 1.3)
        key(pbs["jaw"], f, swing=jaw)
        key(pbs["chest"], f, swing=pitch * 0.3)
    for f, fold in ((1, 0), (30, 24), (72, 32)):
        for tag in ("L", "R"):
            key(pbs[f"upperarm_{tag}"], f, swing=-fold * 0.6)
            key(pbs[f"thigh_{tag}"], f, swing=-fold * 0.5)
    wave(pbs, ["tail1", "tail2", "tail3", "tail4", "tail5", "tail6"],
         [1, 18, 36, 54, 72], 7.0, decay=1.2)
    return action, n


def clip_electric_charge(arm, pbs):
    """Niche behaviour: braces, raises the sails and rears to discharge.
    Pose and deformation only; this revision carries no electricity VFX."""
    action, n = new_action(arm, "electric_charge", 60)
    seq = [(1, 0, 0, 0), (10, 9, 15, 7), (20, 17, 28, 15), (34, 19, 32, 19),
           (46, 13, 21, 13), (60, 0, 0, 0)]
    for f, up, sail, jaw in seq:
        key(pbs["neck1"], f, swing=-up * 0.5)
        key(pbs["neck2"], f, swing=-up * 0.8)
        key(pbs["head"], f, swing=-up)
        key(pbs["jaw"], f, swing=jaw)
        key(pbs["chest"], f, swing=-up * 0.35)
        for i, name in enumerate(("sail1", "sail2", "sail3")):
            key(pbs[name], f, swing=-sail * (1.0 - 0.15 * i))
    # Fine tremor while charged.
    for f in range(20, 47, 3):
        s = 1.0 if (f // 3) % 2 == 0 else -1.0
        key(pbs["head"], f, swing=-19, bend=s * 1.8)
        key(pbs["hips"], f, bend=s * 1.2)
    wave(pbs, ["tail1", "tail2", "tail3", "tail4", "tail5", "tail6"],
         [1, 15, 30, 45, 60], 5.0, decay=1.15)
    return action, n


CLIPS = [clip_idle, clip_walk, clip_swim, clip_feed, clip_alert,
         clip_hit_react, clip_rest, clip_death, clip_electric_charge]


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = FPS
    bpy.ops.import_scene.gltf(filepath=str(STATIC))
    mesh_obj = next(o for o in bpy.context.scene.objects if o.type == "MESH")
    bpy.ops.object.select_all(action="DESELECT")

    arm = build_armature(mesh_obj)
    skin(mesh_obj, arm)

    bpy.context.view_layer.objects.active = arm
    pbs = pose(arm)
    lengths = {}
    for fn in CLIPS:
        action, n = fn(arm, pbs)
        lengths[action.name] = n
        # Park each action in its own NLA strip so none is lost on export.
        track = arm.animation_data.nla_tracks.new()
        track.name = action.name
        track.strips.new(action.name, 1, action)
        arm.animation_data.action = None

    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(OUT),
        export_format="GLB",
        export_apply=False,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_yup=True,
        use_selection=False,
        export_skins=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_bake_animation=False,
        export_optimize_animation_size=False,
    )
    print("RIG_OK " + str(sorted(lengths.items())))


main()
