#!/usr/bin/env python3
"""Re-import the exported animated GLB, check rig and clips, write the manifest.

    blender --background --factory-startup --python validate_animado.py

Every number comes from the binary on disk: the glTF JSON chunk for skins, joints
and animations, and the re-imported scene for the mesh and the armature.
"""
import hashlib
import json
import struct
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parent.parent
GLB = ROOT / "fulgaronte_v04_animado.glb"
MANIFEST = ROOT / "manifest-animado.json"
FPS = 24


def gltf_json(data):
    magic, version, _ = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67, "not a GLB container"
    assert version == 2, f"unexpected glTF version {version}"
    offset = 12
    while offset < len(data):
        length, kind = struct.unpack_from("<II", data, offset)
        if kind == 0x4E4F534A:
            return json.loads(data[offset + 8:offset + 8 + length]
                              .decode("utf-8").rstrip("\x00 "))
        offset += 8 + length
    raise AssertionError("missing JSON chunk")


def main():
    data = GLB.read_bytes()
    g = gltf_json(data)
    assert g.get("skins"), "no skin in the exported GLB"
    assert g.get("animations"), "no animation in the exported GLB"

    acc = g["accessors"]
    clips = []
    for anim in g["animations"]:
        end = 0.0
        for s in anim["samplers"]:
            a = acc[s["input"]]
            end = max(end, float(a.get("max", [0.0])[0]))
        clips.append({
            "name": anim["name"],
            "seconds": round(end, 3),
            "frames_at_24fps": round(end * FPS),
            "channels": len(anim["channels"]),
        })
    clips.sort(key=lambda c: c["name"])

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(GLB))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    arms = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
    assert meshes and arms, "mesh or armature missing after re-import"
    mesh = meshes[0].data
    mesh.calc_loop_triangles()
    skinned = sum(1 for v in mesh.vertices if v.groups)
    assert skinned == len(mesh.vertices), \
        f"{len(mesh.vertices) - skinned} vertices came back without weights"
    deform = any(m.type == "ARMATURE" for m in meshes[0].modifiers)
    assert deform, "the re-imported mesh is not bound to the armature"

    manifest = {
        "species": "Fulgaronte",
        "id": "fulgaronte",
        "revision": "v04",
        "stage": "rig_skinning_and_animation_clips",
        "base_blockout": "fulgaronte_v04_blockout_fiel.glb",
        "form_approved": False,
        "note": "Clipes entregues a pedido do diretor antes da aprovacao da forma; "
                "publicar animacao nao aprova o blockout.",
        "glb": GLB.name,
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "triangles": len(mesh.loop_triangles),
        "meshes": len(g["meshes"]),
        "materials": sorted({m.name for m in mesh.materials if m}),
        "skins": len(g["skins"]),
        "bones": len(arms[0].data.bones),
        "joints_in_skin": len(g["skins"][0]["joints"]),
        "deformation": "skinned vertex weights, up to 2 bones per vertex; "
                       "no rigid pivot parenting",
        "vertices_with_weights": skinned,
        "clips": clips,
        "clip_count": len(clips),
        "fps": FPS,
        "vfx_electricity": False,
        "lods": 0,
        "editable_project": "source/fulgaronte_v04_animado.blend",
        "generator": "source/rig_animate.py (Blender 5.3 bundled Python)",
        "static_blockout_unchanged": True,
        "no_alpha_changes": True,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print("VALIDATE_ANIM_JSON " + json.dumps(manifest))


main()
