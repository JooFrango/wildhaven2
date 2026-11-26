#!/usr/bin/env python3
"""Render a real GLB from disk in profile, front and three-quarter views.

Run with Blender (no standalone Python / VTK available on the build machine):

    blender --background --factory-startup --python render.py -- <glb> <outdir> <prefix>

The GLB is imported from disk exactly as exported, so every preview produced by
this script is evidence of the binary file, never an illustration. Camera,
orthographic scale and lighting are fixed constants, so renders of different
revisions can be overlaid directly for silhouette comparison.
"""
import sys, math, json
from pathlib import Path
import bpy
from mathutils import Vector

ORTHO_SCALE = 19.0      # metres across the frame; identical for every revision
RES = (1400, 1050)
VIEWS = {               # name -> (azimuth degrees, elevation degrees)
    "perfil": (0.0, 0.0),
    "frente": (90.0, 0.0),
    "tres_quartos": (52.0, 18.0),
}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_glb(path):
    bpy.ops.import_scene.gltf(filepath=str(path))
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]


def world_bbox(objects):
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for obj in objects:
        for corner in obj.bound_box:
            p = obj.matrix_world @ Vector(corner)
            lo = Vector((min(lo[i], p[i]) for i in range(3)))
            hi = Vector((max(hi[i], p[i]) for i in range(3)))
    return lo, hi


def stats(objects):
    deps = bpy.context.evaluated_depsgraph_get()
    tris = 0
    verts = 0
    for obj in objects:
        mesh = obj.evaluated_get(deps).to_mesh()
        mesh.calc_loop_triangles()
        tris += len(mesh.loop_triangles)
        verts += len(mesh.vertices)
        obj.evaluated_get(deps).to_mesh_clear()
    lo, hi = world_bbox(objects)
    return {
        "meshes": len(objects),
        "triangles": tris,
        "vertices": verts,
        "materials": sorted({m.name for o in objects for m in o.data.materials if m}),
        "images": sorted({i.name for i in bpy.data.images if i.source != "VIEWER"}),
        # Blender is Z up; the glTF importer turns the glTF Y-up asset into Z-up.
        "bbox_min": [round(v, 4) for v in lo],
        "bbox_max": [round(v, 4) for v in hi],
        "length_x_m": round(hi.x - lo.x, 3),
        "width_y_m": round(hi.y - lo.y, 3),
        "height_z_m": round(hi.z - lo.z, 3),
    }


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
    world.node_tree.nodes["Background"].inputs[1].default_value = 1.0

    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = ORTHO_SCALE
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    target = bpy.data.objects.new("target", None)
    target.location = center
    scene.collection.objects.link(target)
    track = cam.constraints.new("TRACK_TO")
    track.target = target
    track.track_axis = "TRACK_NEGATIVE_Z"
    track.up_axis = "UP_Y"

    # Fixed three-point rig: key, fill and rim, identical for every revision.
    for name, loc, energy, size in (
        ("key", (18, -22, 20), 21000.0, 14.0),
        ("fill", (-20, -16, 6), 7000.0, 18.0),
        ("rim", (-8, 24, 16), 13000.0, 12.0),
    ):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.size = size
        light = bpy.data.objects.new(name, data)
        light.location = Vector(loc) + center
        scene.collection.objects.link(light)
        c = light.constraints.new("TRACK_TO")
        c.target = target
        c.track_axis = "TRACK_NEGATIVE_Z"
        c.up_axis = "UP_Y"
    return cam, radius


def render_views(cam, center, radius, outdir, prefix):
    dist = max(radius * 2.2, 24.0)
    written = []
    for name, (az, el) in VIEWS.items():
        a = math.radians(az)
        e = math.radians(el)
        cam.location = center + Vector((
            math.sin(a) * math.cos(e),
            -math.cos(a) * math.cos(e),
            math.sin(e),
        )) * dist
        path = Path(outdir) / f"{prefix}_{name}.png"
        bpy.context.scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        written.append(str(path))
    return written


def main():
    argv = sys.argv[sys.argv.index("--") + 1:]
    glb, outdir, prefix = argv[0], argv[1], argv[2]
    Path(outdir).mkdir(parents=True, exist_ok=True)
    reset()
    objects = import_glb(glb)
    info = stats(objects)
    lo = Vector(info["bbox_min"])
    hi = Vector(info["bbox_max"])
    center = (lo + hi) / 2
    radius = (hi - lo).length / 2
    cam, radius = build_scene(center, radius)
    info["renders"] = render_views(cam, center, radius, outdir, prefix)
    info["ortho_scale_m"] = ORTHO_SCALE
    print("STATS_JSON " + json.dumps(info))


main()
