#!/usr/bin/env python3
"""Render pose sheets from the animated GLB: proof the clips deform the mesh.

    blender --background --factory-startup --python render_clips.py -- <glb> <outdir>

For every clip in the re-imported file, four frames spread over the clip are
rendered from the same three-quarter camera, with the same orthographic scale and
lighting as render.py, and composed into one strip per clip plus a contact sheet.
The deformation shown is the one stored in the binary, not a preview of the
authoring session.
"""
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

ORTHO_SCALE = 21.0
RES = (560, 390)
# Fixed frame: the pose changes between clips, so the camera must not follow the
# bounding box or the clips could not be compared with each other.
CENTER = Vector((-0.4, 0.0, 3.0))
SAMPLES = 4
AZ, EL = 52.0, 18.0


def build_scene(center, radius):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x, scene.render.resolution_y = RES
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"
    world = bpy.data.worlds.new("w")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.46, 0.44, 0.41, 1)

    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = ORTHO_SCALE
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    target = bpy.data.objects.new("target", None)
    target.location = center
    scene.collection.objects.link(target)
    c = cam.constraints.new("TRACK_TO")
    c.target = target
    c.track_axis = "TRACK_NEGATIVE_Z"
    c.up_axis = "UP_Y"
    for name, loc, energy, size in (("key", (18, -22, 20), 21000.0, 14.0),
                                    ("fill", (-20, -16, 6), 7000.0, 18.0),
                                    ("rim", (-8, 24, 16), 13000.0, 12.0)):
        d = bpy.data.lights.new(name, "AREA")
        d.energy, d.size = energy, size
        light = bpy.data.objects.new(name, d)
        light.location = Vector(loc) + center
        scene.collection.objects.link(light)
        lc = light.constraints.new("TRACK_TO")
        lc.target = target
        lc.track_axis = "TRACK_NEGATIVE_Z"
        lc.up_axis = "UP_Y"
    a, e = math.radians(AZ), math.radians(EL)
    cam.location = center + Vector((math.sin(a) * math.cos(e),
                                    -math.cos(a) * math.cos(e),
                                    math.sin(e))) * max(radius * 2.2, 24.0)
    return cam


def load(path):
    img = bpy.data.images.load(str(path))
    w, h = img.size
    buf = np.empty(w * h * img.channels, dtype=np.float32)
    img.pixels.foreach_get(buf)
    return np.flipud(buf.reshape(h, w, img.channels)[:, :, :3]).astype(np.float64)


def save(arr, path):
    h, w, _ = arr.shape
    img = bpy.data.images.new(path.stem, w, h, alpha=True)
    rgba = np.ones((h, w, 4), dtype=np.float32)
    s = np.clip(arr, 0, 1)
    rgba[:, :, :3] = np.where(s <= 0.04045, s / 12.92,
                              ((s + 0.055) / 1.055) ** 2.4).astype(np.float32)
    img.pixels.foreach_set(np.flipud(rgba).ravel())
    img.filepath_raw = str(path)
    img.file_format = "PNG"
    img.save()


def main():
    argv = sys.argv[sys.argv.index("--") + 1:]
    glb, outdir = Path(argv[0]), Path(argv[1])
    outdir.mkdir(parents=True, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 24
    bpy.ops.import_scene.gltf(filepath=str(glb))
    arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
    mesh_obj = next(o for o in bpy.context.scene.objects if o.type == "MESH")

    _ = mesh_obj
    build_scene(CENTER, 12.0)

    if not arm.animation_data:
        arm.animation_data_create()
    # glTF import may park the clips in NLA; mute it so the chosen action plays.
    for track in list(arm.animation_data.nla_tracks):
        track.mute = True

    actions = sorted(bpy.data.actions, key=lambda a: a.name)
    strips = []
    for action in actions:
        arm.animation_data.action = action
        start, end = (int(round(v)) for v in action.frame_range)
        tiles = []
        for i in range(SAMPLES):
            f = start + int(round((end - start) * i / max(SAMPLES - 1, 1)))
            bpy.context.scene.frame_set(f)
            path = outdir / f"{action.name}_{i}.png"
            bpy.context.scene.render.filepath = str(path)
            bpy.ops.render.render(write_still=True)
            tiles.append(load(path))
            path.unlink()
        strip = np.concatenate(tiles, axis=1)
        bar = np.zeros((6, strip.shape[1], 3))
        bar[:, :] = (0.30, 0.50, 0.60)
        strip = np.concatenate([bar, strip], axis=0)
        save(strip, outdir / f"clipe_{action.name}.png")
        strips.append(strip)
        print(f"CLIP {action.name} frames {start}-{end}")

    gap = np.zeros((10, strips[0].shape[1], 3)) + 0.08
    sheet = np.concatenate([x for s in strips for x in (gap, s)] + [gap], axis=0)
    save(sheet, outdir / "clipes_todos.png")
    print("CLIPS_OK " + str(len(strips)))




if __name__ == "__main__":
    main()
