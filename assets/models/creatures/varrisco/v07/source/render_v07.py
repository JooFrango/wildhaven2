import bpy, sys, math
from pathlib import Path
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]
src,out,label=Path(args[0]),Path(args[1]),args[2]
out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene
bpy.ops.import_scene.gltf(filepath=str(src.resolve()))
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE')
mesh=next(o for o in bpy.data.objects if o.type=='MESH' and o.find_armature()==arm)
arm.animation_data_clear()
for p in arm.pose.bones:p.matrix_basis.identity()
bpy.context.view_layer.update()
sc.render.engine='CYCLES';sc.cycles.samples=12;sc.cycles.use_denoising=True
sc.render.resolution_x=640;sc.render.resolution_y=440;sc.render.resolution_percentage=100
sc.world=bpy.data.worlds.new('Studio');sc.world.use_nodes=True
sc.world.node_tree.nodes['Background'].inputs[0].default_value=(.32,.35,.4,1)
sc.world.node_tree.nodes['Background'].inputs[1].default_value=.5
sc.view_settings.view_transform='Standard'
def aim(obj,loc,target):
 obj.location=loc;obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
def light(name,loc,energy,size):
 d=bpy.data.lights.new(name,'AREA');d.energy=energy;d.shape='DISK';d.size=size
 o=bpy.data.objects.new(name,d);sc.collection.objects.link(o);aim(o,loc,(0,0,.8))
light('Key',(2,-4,5),600,5);light('Fill',(-2,4,3),400,4);light('Rim',(-3,1,5),500,3)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.02))
floor=bpy.context.object;mat=bpy.data.materials.new('Ground');mat.diffuse_color=(.18,.19,.20,1);floor.data.materials.append(mat)
cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));sc.collection.objects.link(cam);sc.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=3.9
for name,loc in [('perfil',(-.25,-7,1.15)),('frente',(7,0,1.18)),('tres-quartos',(5,-5,2.65))]:
 aim(cam,loc,(-.25,0,.8));sc.render.filepath=str((out/f'{label}-{name}.png').resolve());bpy.ops.render.render(write_still=True)
print('REIMPORT',label,len(mesh.data.polygons),len(arm.data.bones),len(bpy.data.actions))
