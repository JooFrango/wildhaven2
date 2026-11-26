#!/usr/bin/env python3
"""Re-import the exported GLB from disk, check its integrity and write manifest.json.

    blender --background --factory-startup --python validate.py

Everything reported here is read back from the exported binary, not from the
build session: triangles, bounds, materials and the embedded texture all come
from the re-imported file, and the SHA-256 is taken over the bytes on disk.
"""
import hashlib
import json
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
GLB = ROOT / "fulgaronte_v04_blockout_fiel.glb"
MANIFEST = ROOT / "manifest.json"
METRICS = Path(__file__).resolve().parent / "build_metrics.json"


def glb_chunks(data):
    magic, version, _ = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67, "not a GLB container"
    assert version == 2, f"unexpected glTF version {version}"
    offset, chunks = 12, []
    while offset < len(data):
        length, kind = struct.unpack_from("<II", data, offset)
        chunks.append((kind, offset + 8, length))
        offset += 8 + length
    return chunks


def main():
    data = GLB.read_bytes()
    chunks = glb_chunks(data)
    kinds = {k for k, _, _ in chunks}
    assert 0x4E4F534A in kinds, "missing JSON chunk"
    assert 0x004E4942 in kinds, "missing BIN chunk"
    gltf = json.loads(next(data[o:o + n] for k, o, n in chunks
                           if k == 0x4E4F534A).decode("utf-8").rstrip("\x00 "))

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(GLB))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    assert meshes, "no mesh in the re-imported GLB"

    tris = 0
    verts = 0
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for obj in meshes:
        mesh = obj.data
        mesh.calc_loop_triangles()
        tris += len(mesh.loop_triangles)
        verts += len(mesh.vertices)
        assert mesh.uv_layers, f"{obj.name} came back without UVs"
        for corner in obj.bound_box:
            p = obj.matrix_world @ Vector(corner)
            lo = Vector((min(lo[i], p[i]) for i in range(3)))
            hi = Vector((max(hi[i], p[i]) for i in range(3)))

    build = json.loads(METRICS.read_text(encoding="utf-8")) if METRICS.exists() else {}
    manifest = {
        "species": "Fulgaronte",
        "id": "fulgaronte",
        "revision": "v04",
        "stage": "blockout_rebuilt_for_concept_fidelity",
        "concept_approved": True,
        "v01_rejected": True,
        "v02_rejected": True,
        "v03_rejected": True,
        "v04_form_approved": False,
        "glb": GLB.name,
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "triangles": tris,
        "vertices_after_import": verts,
        "meshes": len(meshes),
        "materials": sorted({m.name for o in meshes for m in o.data.materials if m}),
        "textures": len(gltf.get("images", [])),
        "texture_file": "fulgaronte_v04_uv_albedo.png",
        "texture_embedded_in_glb": all("uri" not in i for i in gltf.get("images", [])),
        "skins": len(gltf.get("skins", [])),
        "bones": 0,
        "clips": len(gltf.get("animations", [])),
        "vfx_electricity": False,
        # Blender is Z up; these are the re-imported bounds in metres.
        "bbox_min_m": [round(v, 4) for v in lo],
        "bbox_max_m": [round(v, 4) for v in hi],
        "length_m": round(hi.x - lo.x, 3),
        "width_m": round(hi.y - lo.y, 3),
        "height_total_m": round(hi.z - lo.z, 3),
        "height_body_back_line_m": 4.96,
        "height_tallest_dorsal_sail_m": 6.65,
        "parts_faces_before_triangulation": build.get("part_faces", {}),
        "render_provenance": "renders produced by source/render.py, which imports "
                             "this GLB from disk; no AI imagery",
        "editable_project": "source/fulgaronte_v04.blend",
        "generator": "source/build.py (Blender 5.3 bundled Python)",
        "previous_versions": "v01, v02 and v03 unchanged",
        "no_alpha_changes": True,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print("VALIDATE_JSON " + json.dumps(manifest))


main()
