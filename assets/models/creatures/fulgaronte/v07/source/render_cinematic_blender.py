#!/usr/bin/env python3
"""Render only real Blender evaluation of export v07 and Claude v04.
The v04 GLB, its original UV atlas, skin and shader must reimport correctly.
"""
import sys
sys.path.insert(0,"/tmp/wh-bpy-numpy")
import bpy,math,json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
OLD=ROOT.parent/"v04"/"fulgaronte_v04_animado.glb"
GLB=ROOT/"fulgaronte_v07_cinematic_claude36.glb"
OUT=ROOT/"previews";OUT.mkdir(exist_ok=True)
NAMES=("cin_bite_lunge","cin_tail_whip","cin_territorial_roar",
       "cin_electric_warning","cin_electric_burst","cin_heavy_walk",
       "cin_predatory_swim")
SAMPLES=(0.,.09,.20,.33,.45,.55,.67,.78,.89,.97)
def setup(source):
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(source))
 arms=[o for o in bpy.context.scene.objects if o.type=="ARMATURE"]
 meshes=[o for o in bpy.context.scene.objects if o.type=="MESH"]
 assert len(arms)==1 and len(meshes)>=1,(len(arms),len(meshes))
 arm=arms[0]
 mesh=next((o for o in meshes if any(m.type=="ARMATURE" for m in o.modifiers)),None)
 assert mesh is not None,[(o.name,len(o.data.vertices),[m.type for m in o.modifiers]) for o in meshes]
 print("BLENDER_IMPORTED_MESHES",[(o.name,len(o.data.vertices)) for o in meshes],"selected",mesh.name,flush=True)
 assert len(arm.data.bones)==36,len(arm.data.bones)
 assert any(m.type=="ARMATURE" for m in mesh.modifiers)
 assert mesh.data.uv_layers and mesh.data.materials
 scene=bpy.context.scene;scene.render.engine="CYCLES"
 scene.cycles.device="CPU";scene.cycles.samples=7
 scene.render.threads_mode="FIXED";scene.render.threads=2
 scene.render.resolution_x=600;scene.render.resolution_y=420
 scene.render.resolution_percentage=100
 scene.render.image_settings.file_format="PNG"
 scene.render.film_transparent=False
 scene.view_settings.view_transform="Standard"
 w=bpy.data.worlds.new("Wildhaven Studio");w.use_nodes=True
 w.node_tree.nodes["Background"].inputs["Color"].default_value=(.46,.53,.59,1)
 w.node_tree.nodes["Background"].inputs["Strength"].default_value=.8
 scene.world=w
 focus=bpy.data.objects.new("camera focus",None);focus.location=Vector((-.3,0,3.05))
 scene.collection.objects.link(focus)
 cam_data=bpy.data.cameras.new("cam");cam_data.type="ORTHO"
 cam_data.ortho_scale=19.8
 cam=bpy.data.objects.new("cam",cam_data);scene.collection.objects.link(cam)
 cam.location=(25,-35,17);scene.camera=cam
 tr=cam.constraints.new("TRACK_TO");tr.target=focus
 tr.track_axis="TRACK_NEGATIVE_Z";tr.up_axis="UP_Y"
 for name,power,loc,size in (
   ("key",2700,(16,-20,18),12),
   ("fill",1500,(-14,-18,8),17),
   ("rim",2900,(-10,17,15),14)):
  data=bpy.data.lights.new(name,"AREA")
  data.energy=power;data.size=size
  ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob)
  ob.location=Vector(loc)
  tr=ob.constraints.new("TRACK_TO");tr.target=focus
  tr.track_axis="TRACK_NEGATIVE_Z";tr.up_axis="UP_Y"
 arm.animation_data_create()
 for obj in bpy.data.objects:
  if obj.animation_data:
   obj.animation_data.action=None
   for track in obj.animation_data.nla_tracks:track.mute=True
 arm.data.pose_position="REST"
 scene.frame_set(1)
 return arm,mesh
def render(name):
 bpy.context.scene.render.filepath=str(OUT/name)
 bpy.ops.render.render(write_still=True)
 print("BLENDER_REAL_FRAME",name,(OUT/name).stat().st_size,flush=True)
def measure(arm,mesh,action):
 arm.animation_data.action=action
 arm.data.pose_position="POSE"
 start,end=action.frame_range
 dep=bpy.context.evaluated_depsgraph_get()
 def sample(frame):
  bpy.context.scene.frame_set(round(frame))
  eval_mesh=mesh.evaluated_get(dep)
  m=eval_mesh.to_mesh()
  xs=[tuple(m.vertices[i].co) for i in range(0,min(len(m.vertices),400),5)]
  eval_mesh.to_mesh_clear()
  return xs
 a=sample(start);b=sample(start+.52*(end-start))
 score=sum(sum((x-y)**2 for x,y in zip(p,q)) for p,q in zip(a,b))
 assert score>1e-5,(action.name,score)
 print("REAL_SKIN_DEFORMATION",action.name,round(score,5),flush=True)
def main():
 setup(OLD);render("original_claude_v04.png")
 arm,mesh=setup(GLB);render("v07_neutral_bindpose.png")
 acts={a.name:a for a in bpy.data.actions}
 print("BLENDER_ACTUAL_ACTIONS",list(acts),flush=True)
 assert all(n in acts for n in NAMES),sorted(set(NAMES)-set(acts))
 data={"base_glb":"v04 Claude rigged","animated_glb":"v07 36 bones",
       "renderer":"Blender Cycles glTF UV materials","clips":{}}
 for clip in NAMES:
  a=acts[clip]
  arm.animation_data.action=a
  arm.data.pose_position="POSE"
  for track in arm.animation_data.nla_tracks:track.mute=True
  first,last=a.frame_range
  saved=[]
  for i,t in enumerate(SAMPLES):
   bpy.context.scene.frame_set(round(first+t*(last-first)))
   fname=clip+"_"+str(i).zfill(2)+".png"
   render(fname)
   saved.append(fname)
  measure(arm,mesh,a)
  data["clips"][clip]={"frames":saved,"range":[float(first),float(last)]}
 (OUT/"render_manifest.json").write_text(json.dumps(data,indent=2)+"\n")
 print("BLENDER_VISUAL_REIMPORT_COMPLETE",len(data["clips"]),flush=True)
if __name__=="__main__":main()
