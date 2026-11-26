#!/usr/bin/env python3
"""Actual Blender material/armature renders of the Fulgaronte v04 and v06 GLBs.

Unlike Pillow primitive preview, this uses glTF material nodes, texture filtering,
correct per-pixel depth, shadows/lighting and Blender's evaluated Armature modifier.
Nothing here changes, remodels, or reexports either creature GLB.
Run:
  blender -b -t 2 --python source/blender_preview_v06.py
This lives under v06/preview-fidelity/source; paths derived from __file__.
"""
from pathlib import Path
import bpy, math, json, sys
sys.path.insert(0, '/tmp/wh-bpy-numpy')
from mathutils import Vector

BASE = Path(__file__).resolve().parents[3]
V04 = BASE / "v04" / "fulgaronte_v04_blockout_fiel.glb"
V06 = BASE / "v06" / "fulgaronte_v06_motion_review.glb"
OUT = BASE / "v06" / "preview-fidelity"
OUT.mkdir(parents=True, exist_ok=True)
CLIPS = ("heavy_walk", "bite_heavy", "overload_burst")
SAMPLE_FRACTIONS = (0.0, 0.11, 0.24, 0.38, 0.48, 0.60, 0.76, 0.92)
PREFERRED_SCALE = 19.0

def prepare(glb):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(glb))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    arms = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
    if not meshes: raise RuntimeError("GLB has no meshes: " + str(glb))
    print("GEOMETRY",glb.name,"meshes",len(meshes),"arms",len(arms),
          "actions",[(a.name,tuple(a.frame_range)) for a in bpy.data.actions])
    lo=Vector((1e8,)*3)
    hi=Vector((-1e8,)*3)
    for o in meshes:
        for c in o.bound_box:
            p=o.matrix_world @ Vector(c)
            for k in range(3):
                lo[k]=min(lo[k],p[k]);hi[k]=max(hi[k],p[k])
    center=(hi+lo)/2
    world=bpy.data.worlds.new("Fulgaronte neutral studio")
    world.use_nodes=True
    world.node_tree.nodes["Background"].inputs["Color"].default_value=(.62,.69,.75,1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value=.8
    scene=bpy.context.scene; scene.world=world
    scene.render.engine="CYCLES"
    scene.cycles.device="CPU"
    scene.cycles.samples=9
    scene.render.resolution_x=760
    scene.render.resolution_y=570
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG"
    scene.render.film_transparent=False
    scene.render.threads_mode="FIXED"
    scene.render.threads=2
    scene.view_settings.view_transform="Standard"
    scene.view_settings.look="Medium High Contrast"
    scene.view_settings.exposure=0
    scene.view_settings.gamma=1
    cam_data=bpy.data.cameras.new("Comparative orthographic camera")
    cam_data.type="ORTHO"
    cam_data.ortho_scale=PREFERRED_SCALE
    cam=bpy.data.objects.new("Comparative orthographic camera",cam_data)
    scene.collection.objects.link(cam);scene.camera=cam
    target=bpy.data.objects.new("Model target",None)
    target.location=center
    scene.collection.objects.link(target)
    tr=cam.constraints.new("TRACK_TO")
    tr.target=target; tr.track_axis="TRACK_NEGATIVE_Z";tr.up_axis="UP_Y"
    cam.location=center+Vector((0,-38,2.5))
    for label, loc, power, size in (
        ("key",(13,-17,18),3900,13),
        ("fill",(-10,-16,8),1800,16),
        ("rim",(-10,17,16),3000,14),
    ):
        dat=bpy.data.lights.new(label,"AREA")
        dat.energy=power;dat.size=size
        ob=bpy.data.objects.new(label,dat)
        scene.collection.objects.link(ob)
        ob.location=center+Vector(loc)
        co=ob.constraints.new("TRACK_TO")
        co.target=target;co.track_axis="TRACK_NEGATIVE_Z";co.up_axis="UP_Y"
    # Preserve exact camera placement based on V04's physical bounding box:
    # no arbitrary camera movement per pose; distant tail tip stays in view.
    return scene,arms,meshes

def render(filename):
    scene=bpy.context.scene
    scene.render.filepath=str(OUT/filename)
    bpy.ops.render.render(write_still=True)
    print("WROTE",filename,(OUT/filename).stat().st_size,flush=True)

def clear_animation():
    for obj in bpy.data.objects:
        if obj.animation_data:
            ad=obj.animation_data
            for nt in ad.nla_tracks:nt.mute=True
            ad.action=None
    for ob in bpy.data.objects:
        if ob.type=="ARMATURE":
            ob.data.pose_position="REST"
    bpy.context.scene.frame_set(1)

def run():
    if not V04.exists() or not V06.exists():
        raise FileNotFoundError(f"Missing GLB v04={V04.exists()} v06={V06.exists()}")
    scene,_,_=prepare(V04)
    clear_animation()
    render("fulgaronte_v04_blender_original.png")

    scene,arms,_=prepare(V06)
    if len(arms)!=1:raise RuntimeError("Expected 1 skin armature, got "+str(len(arms)))
    arm=arms[0]
    clear_animation()
    arm.data.pose_position="REST"
    bpy.context.view_layer.update()
    render("fulgaronte_v06_bind_pose_blender.png")
    arm.data.pose_position="POSE"

    actions=list(bpy.data.actions)
    metadata={"v04":str(V04),"v06":str(V06),
              "renders":["fulgaronte_v04_blender_original.png","fulgaronte_v06_bind_pose_blender.png"],
              "clips":{},"action_names":[a.name for a in actions]}
    for clip in CLIPS:
        matches=[a for a in actions if a.name==clip]
        if not matches:
            matches=[a for a in actions if a.name.startswith(clip+".")]
        if not matches:raise RuntimeError(f"Action {clip} not in imported GLB; available {[a.name for a in actions]}")
        action=matches[0]
        # glTF imported armature action; no NLA stacking the same skeleton.
        for ob in bpy.data.objects:
            if ob.animation_data:
                for track in ob.animation_data.nla_tracks:track.mute=True
        arm.animation_data_create()
        arm.animation_data.action=action
        a,b=action.frame_range
        metadata["clips"][clip]={"action":action.name,"frames":[],"range":[float(a),float(b)]}
        for i,f in enumerate(SAMPLE_FRACTIONS):
            frame=int(round(a+(b-a)*f))
            scene.frame_set(frame)
            label=f"{clip}_{i:02d}.png"
            render(label)
            metadata["clips"][clip]["frames"].append(label)
    (OUT/"render_manifest.json").write_text(json.dumps(metadata,indent=2)+"\n",encoding="utf8")
    print("BLENDER_FIDELITY_REVIEW_SUCCESS",json.dumps(metadata["clips"]),flush=True)

run()
