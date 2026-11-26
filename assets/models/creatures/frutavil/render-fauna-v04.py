import bpy
from mathutils import Vector
from pathlib import Path
import sys

def load(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and not o.hide_render and o.name != 'Icosphere']
    for obj in bpy.context.scene.objects:
        if obj.type=='MESH' and obj not in meshes:
            obj.hide_render=True
    lo, hi = bounds(meshes)
    return meshes, lo, hi

def bounds(meshes):
    graph = bpy.context.evaluated_depsgraph_get()
    points = [o.matrix_world @ Vector(c) for m in meshes for o in [m.evaluated_get(graph)] for c in o.bound_box]
    return tuple(Vector(f(p[i] for p in points) for i in range(3)) for f in (min, max))

def render_setup(lo, hi, axis, sign, size=480, samples=10):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.render.threads_mode = 'FIXED'
    sc.render.threads = 6
    sc.render.resolution_x, sc.render.resolution_y = size, round(size*.78)
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGB'
    sc.world = bpy.data.worlds.new('World')
    sc.world.use_nodes = True
    sc.world.node_tree.nodes.get('Background').inputs[0].default_value = (.29,.32,.37,1)
    sc.world.node_tree.nodes.get('Background').inputs[1].default_value = .48
    center=(lo+hi)/2
    span=max(hi-lo)
    bpy.ops.mesh.primitive_plane_add(size=span*200, location=(0, 0, lo.z-.002))
    floor=bpy.context.object
    mat=bpy.data.materials.new('Studio floor')
    mat.diffuse_color=(.19,.20,.19,1)
    floor.data.materials.append(mat)
    mat.use_nodes=True
    mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.22,.20,.18,1)
    mat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.91
    f=Vector((sign,0,0) if axis=='x' else (0,sign,0))
    flank=Vector((-f.y,f.x,0))
    up=Vector((0,0,1))
    for direction, energy, color, scale in ((f*2-flank*3+up*5,130,(1,.88,.71),2.8),(-f*2+flank*2+up*4,100,(.75,.84,1),2.5),(f+flank*4+up*2,45,(1,.96,.89),3)):
        bpy.ops.object.light_add(type='AREA', location=center + direction*span*.55)
        light=bpy.context.object
        light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
        light.data.energy=energy*span*span
        light.data.color=color
        light.data.shape='DISK'
        light.data.size=span*scale*.45
    bpy.ops.object.camera_add()
    cam=bpy.context.object
    cam.data.type='ORTHO'
    sc.camera=cam
    sc.view_settings.view_transform='AgX'
    aim={'front':f+up*.10,'side':flank+up*.045,'back':-f+up*.10,'three-quarter':f*.62+flank*.79+up*.33}
    def shot(view, path):
        cam.location=center+aim[view]*span*3.2
        cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
        rotation=cam.rotation_euler.to_matrix()
        right=rotation@Vector((1,0,0))
        vertical=rotation@Vector((0,1,0))
        extent=hi-lo
        width=sum(abs(right[i])*extent[i] for i in range(3))
        height=sum(abs(vertical[i])*extent[i] for i in range(3))
        cam.data.ortho_scale=1.17*max(width,height*sc.render.resolution_x/sc.render.resolution_y)
        sc.render.filepath=str(path)
        bpy.ops.render.render(write_still=True)
    return shot

def render_four(path, prefix, views, size):
    meshes,lo,hi=load(path)
    shot=render_setup(lo,hi,'x',1,size=size)
    for view in views:
        shot(view,prefix.with_name(prefix.name+'-'+view+'.png'))

if __name__=='__main__':
    for arg in sys.argv[sys.argv.index('--')+1:]:
        path=Path(arg).resolve()
        old='-old' in path.stem
        prefix=path.with_name(path.stem.replace('-LOD0',''))
        views=('three-quarter',) if old else ('front','side','back','three-quarter')
        render_four(path,prefix,views,640)

