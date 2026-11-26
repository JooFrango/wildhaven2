"""Render the exported GLBs with a fixed camera, sun and colour management for all stages."""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0,str(Path(__file__).resolve().parent))
from blender_io import HERE,MODELS,collection,mesh_object,material,color_attr
from glb import GLB,BASE,dump

OUT=HERE/'preview'


def load_glb(path):
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path),import_pack_images=True)
    return list(set(bpy.data.objects)-before)


def trees(max_dist=190):
    # Blender import support for EXT_mesh_gpu_instancing varies. Decode the exported GLB directly.
    g=GLB(MODELS/'hv_01_forest.glb');lib=collection('Árvores reimportadas')
    mat=material('Casca e folhas | FX_20')
    for n in g.doc['nodes']:
        p=g.doc['meshes'][n['mesh']]['primitives'][0];v=g.array(p['attributes']['POSITION'])
        o=mesh_object(n['name'],np.column_stack((v[:,0],-v[:,2],v[:,1])),g.array(p['indices']).reshape(-1,3),lib)
        color_attr(o.data,g.array(p['attributes']['COLOR_0']));o.data.materials.append(mat)
        ext=n['extensions']['EXT_mesh_gpu_instancing']['attributes']
        for pt,rot,sc in zip(g.array(ext['TRANSLATION']),g.array(ext['ROTATION']),g.array(ext['SCALE'])):
            if math.hypot(pt[0],pt[2])>max_dist:continue
            copy=o.copy();lib.objects.link(copy);copy.location=(pt[0],-pt[2],pt[1])
            copy.rotation_euler.z=2*math.atan2(rot[1],rot[3]);copy.scale=sc
        bpy.data.objects.remove(o,do_unlink=True)


def render(args):
    OUT.mkdir(exist_ok=True)
    site=json.loads((HERE/'site.json').read_text(encoding='utf8'));base=site['village_datum_m']
    for shot in args.shots:
        bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene
        scene.render.engine='CYCLES';scene.cycles.samples=args.samples;scene.cycles.use_denoising=True
        scene.cycles.max_bounces=4;scene.cycles.transparent_max_bounces=2
        scene.world=bpy.data.worlds.new('Céu | luz da manhã');scene.world.use_nodes=True
        bg=scene.world.node_tree.nodes.get('Background');bg.inputs[0].default_value=(.64,.76,1,1);bg.inputs[1].default_value=.44
        sun=bpy.data.lights.new('Sol','SUN');sun.energy=3.4;sun.angle=math.radians(10);sun.color=(1,.86,.67)
        light=bpy.data.objects.new('Sol',sun);scene.collection.objects.link(light);light.rotation_euler=Vector((.52,.66,-1)).to_track_quat('-Z','Y').to_euler()
        scene.view_settings.view_transform='AgX'
        scene.view_settings.look='AgX - Medium High Contrast'
        scene.render.resolution_x=args.width;scene.render.resolution_y=round(args.width*.64);scene.render.resolution_percentage=100
        scene.render.image_settings.file_format='PNG'
        scene.render.image_settings.color_mode='RGB'
        camera=bpy.data.cameras.new('Câmera');obj=bpy.data.objects.new('Câmera',camera);scene.collection.objects.link(obj);scene.camera=obj
        camera.type='ORTHO';camera.clip_start=.05;camera.clip_end=300000
        target=Vector((0,5,base+5));offset=Vector((37,-103,52))*.66;span=116
        load_glb(MODELS/'hv_01_terrain.glb')
        if shot=='regional':
            trees(4000);span=12500;offset=Vector((.42,-1.18,1.09))*13500
            for e in site['edges']:
                id_=e['id'];world=json.loads((BASE/'composition.json').read_text(encoding='utf8'))
                tile=next(t for t in world['tiles'] if t['id']==id_)
                obs=load_glb(BASE/'detailed'/(id_.lower()+'_v12.glb'))
                for o in obs:
                    if o.parent is None:
                        o.location.x+=tile['center_x']-site['worldCoord'][0];o.location.y-=tile['center_z']-site['worldCoord'][2]
        else:
            trees(200)
        stage=4 if shot in ('top','regional') else int(shot)
        load_glb(MODELS/f'phase_{stage}.glb');load_glb(MODELS/f'phase_{stage}_inside.glb')
        if shot=='top':
            target=Vector((0,6,base));offset=Vector((0,-.001,170));span=113
            scene.render.resolution_y=round(args.width*.89)
        camera.ortho_scale=span;obj.location=target+offset;obj.rotation_euler=(-offset).to_track_quat('-Z','Y').to_euler()
        name='fase_'+shot if shot.isdigit() else shot
        targetfile=(HERE/'.build' if args.draft else OUT)/(name+'.png')
        scene.render.filepath=str(targetfile);bpy.ops.render.render(write_still=True)
        print('RENDERED',targetfile,flush=True)
        if not args.draft:
            dump(OUT/(name+'.json'),dict(source=f'models/phase_{stage}.glb',camera_m=list(obj.location),
                target_m=list(target),orthographic_span_m=span,resolution=[scene.render.resolution_x,scene.render.resolution_y],
                engine='Blender Cycles',samples=args.samples))

if __name__=='__main__':
    arg=argparse.ArgumentParser();arg.add_argument('--shots',nargs='+',default=['1','2','3','4','top'])
    arg.add_argument('--draft',action='store_true');arg.add_argument('--width',type=int,default=1100)
    arg.add_argument('--samples',type=int,default=10)
    render(arg.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []))

