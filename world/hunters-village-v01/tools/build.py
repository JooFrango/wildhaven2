"""Run with Blender -b -P tools/build.py. Rebuild all four stages from the site and module layout."""
import json
import math
import sys
import time
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0,str(Path(__file__).resolve().parent))
from blender_io import HERE, CACHE, MODELS, collection, from_kit, atlas_material, export
from carpentry import MeshKit
from commons import public_space
from dressing import additions, residents
from facilities import facility, interior
from layout import LOTS, STAGES, terrace
from terrain_nodes import terrain, source_trees, make_forest
from glb import dump


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene=bpy.context.scene;scene.unit_settings.system='METRIC'
    site=json.loads((HERE/'site.json').read_text(encoding='utf8'))
    ground_coll=collection('00 • Terreno e vegetação')
    ground,base=terrain(ground_coll)
    export(MODELS/'hv_01_terrain.glb',[ground])
    library=bpy.data.collections.new('Biblioteca • FX_20 | cinco folhosas e três coníferas')
    source_trees(library);woods=make_forest(ground,ground_coll,library)
    mat=atlas_material();phases=[];layers=[]
    for level,(name,unlocks,decoration) in enumerate(STAGES,1):
        t=time.monotonic()
        group=collection(f'0{level} • {name}');interiors=collection(f'Interiores • {name}',group)
        layers.append(group)
        stage=dict(phase=level,name=name,unlocks=unlocks,decoration=decoration,lots=[],walkable=[],blockers=[])
        for lod in [False,True]:
            coll=collection('Temporário • LOD') if lod else group
            objects=[];inside=[]
            for j,(id_,label,x,y,w,d,rot,start) in enumerate(LOTS):
                if level<start:continue
                k=MeshKit(104+j,lod);facility(k,id_,level,w,d)
                obj=from_kit(id_+('_LOD1' if lod else '')+f'_F{level}',k,coll,mat)
                obj['facility']=id_;obj['phase']=level;obj['label']=label
                z=base+terrace(y)
                obj.location=(x,y,z);obj.rotation_euler.z=math.radians(rot);objects.append(obj)
                if not lod:
                    # Individual final GLBs use a local origin so each is reusable in the game.
                    if level==4:
                        obj.location=(0,0,0);obj.rotation_euler.z=0
                        export(MODELS/'buildings'/(id_+'.glb'),[obj])
                        obj.location=(x,y,z);obj.rotation_euler.z=math.radians(rot)
                    item=dict(id=id_,name=label,anchor=[x,z,-y],yaw=math.radians(rot),firstPhase=start,
                              bounds_m=[w,d],entranceLocal=[0,d/2+.65],collision=k.blockers)
                    item['floorLift']=.20 if id_=='hall' else (.18 if id_ in ('workshop','forge','tavern') or
                        (level>1 and (id_.startswith('house') or id_=='store')) else 0.)
                    stage['lots'].append(item)
                    inner=MeshKit(37+j)
                    interior(inner,id_,w,d,level)
                    if inner.f:
                        obj2=from_kit(id_+'_interior_F'+str(level),inner,interiors,mat)
                        obj2['facility']=id_;obj2.location=(x,y,z);obj2.rotation_euler.z=math.radians(rot);inside.append(obj2)
            kit=MeshKit(114,lod);walk=public_space(kit,level);additions(kit,level)
            if not lod:
                crowd=MeshKit(71);residents(crowd,level)
                actor=from_kit('Habitantes_F'+str(level),crowd,coll,mat)
                actor.location.z=base;actor['role']='preview-residents';objects.append(actor)
            public=from_kit('Praca_pontes_escadas_F'+str(level)+('_LOD1' if lod else ''),kit,coll,mat)
            public.location.z=base;objects.append(public)
            file=f'phase_{level}'+('_lod1' if lod else '')+'.glb'
            export(MODELS/file,objects)
            stage['lod1' if lod else 'exterior']='models/'+file
            if lod:
                for o in objects:
                    mesh=o.data;bpy.data.objects.remove(o,do_unlink=True);bpy.data.meshes.remove(mesh)
                bpy.data.collections.remove(coll)
            else:
                export(MODELS/f'phase_{level}_inside.glb',inside)
                stage['interior']=f'models/phase_{level}_inside.glb'
                stage['walkable']=[[x,-y,w,d,base+h] for x,y,w,d,h in walk]
                stage['blockers']=[[x,-y,w,d,base+lo,base+hi] for x,y,w,d,lo,hi in kit.blockers]
                stage['blockers'].append([-1.1,-.5,2.0,2.0,base+2.36,base+3.5])
        phases.append(stage);print('STAGE',level,'exported',round(time.monotonic()-t,2),flush=True)
    # Only the final phase is initially visible in the authoring scene.
    for grp in layers[:-1]:grp.hide_viewport=True;grp.hide_render=True
    bpy.ops.object.select_all(action='DESELECT');ground.select_set(True);bpy.context.view_layer.objects.active=ground
    direction=Vector((-34,88,-51)).to_track_quat('-Z','Y')
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                view=area.spaces.active;view.region_3d.view_distance=110;view.region_3d.view_location=(0,5,base+5)
                view.region_3d.view_rotation=direction;view.clip_end=50000
                view.shading.type='MATERIAL';view.overlay.show_overlays=False
    scene.render.fps=30
    scene['base_world']='world-visual-coherence-v12 • 170 hexágonos';scene['chunkId']='HV_01'
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'Wildhaven_Vila_Hunters.blend'),compress=True)
    dump(HERE/'progression.json',dict(schema=1,chunkId='HV_01',phases=phases,
        transition={'next':[2,3,4,None],'accountField':'village.phase','costs':None},
        camera={'target':[0,base+5,-5],'offset':[24.42,34.32,67.98],'orthographicWidth':116}))
    print('BLEND_AND_STAGES_READY',flush=True)

if __name__=='__main__':build()

