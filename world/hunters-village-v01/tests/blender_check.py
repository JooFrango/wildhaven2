"""Open the editable file, exercise its relief control and reimport every exported asset."""
import json
import sys
from pathlib import Path
import bpy
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from glb import HERE,MODELS,QA,dump

bpy.ops.wm.open_mainfile(filepath=str(HERE/'Wildhaven_Vila_Hunters.blend'))
o=bpy.data.objects['HV_01_Terreno'];m=o.modifiers[0];tree=m.node_group
socket=next(i.identifier for i in tree.interface.items_tree if i.name=='Amplitude das colinas (m)')
def points():
    bpy.context.view_layer.update()
    mesh=o.evaluated_get(bpy.context.evaluated_depsgraph_get()).data
    z=np.zeros(len(mesh.vertices)*3,dtype='f');mesh.vertices.foreach_get('co',z)
    return z.reshape(-1,3)
before=points();getattr(m.properties.inputs,socket).value=0.;o.update_tag();after=points()
delta=abs(before[:,2]-after[:,2])
assert delta.max()>5
x,y=before[:,0],before[:,1]
norm=np.array([(np.cos(i*np.pi/3),np.sin(i*np.pi/3)) for i in range(6)])
rim=np.max(before[:,:2]@norm.T,axis=1)>2165.062
assert delta[rim].max()<.0001
forest=bpy.data.objects['HV_01_Floresta'].modifiers[0].node_group
assert {'GeometryNodeDistributePointsOnFaces','GeometryNodeInstanceOnPoints','GeometryNodeDeleteGeometry'}<={n.bl_idname for n in forest.nodes}
report={'max_change_no_relief_m':float(delta.max()),'max_change_at_rim_m':float(delta[rim].max()),'reopened':[]}
for f in sorted(MODELS.rglob('*.glb')):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(f))
    meshes=[ob for ob in bpy.context.scene.objects if ob.type=='MESH']
    assert meshes and all(len(ob.data.polygons)>0 for ob in meshes)
    report['reopened'].append(f.relative_to(HERE).as_posix())
dump(QA/'blender.json',report)
print('REOPENED',len(report['reopened']))

