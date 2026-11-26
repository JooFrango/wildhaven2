import math
from pathlib import Path

import bpy
import numpy as np

HERE=Path(__file__).resolve().parents[1]
CACHE=HERE/'.build'
MODELS=HERE/'models'


def collection(name,parent=None):
    c=bpy.data.collections.new(name)
    (parent or bpy.context.scene.collection).children.link(c)
    return c


def mesh_object(name,v,f,coll):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(v,[],f);mesh.update()
    obj=bpy.data.objects.new(name,mesh);coll.objects.link(obj)
    return obj


def color_attr(mesh,colors,name='Color'):
    c=mesh.color_attributes.new(name=name,type='FLOAT_COLOR',domain='POINT')
    a=np.asarray(colors,dtype=np.float32)
    if a.shape[1]==3:a=np.column_stack((a,np.ones(len(a),dtype=np.float32)))
    c.data.foreach_set('color',a.ravel())
    mesh.color_attributes.active_color=c


def material(name):
    m=bpy.data.materials.new(name);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Roughness'].default_value=.94
    rgb=m.node_tree.nodes.new('ShaderNodeVertexColor');rgb.layer_name='Color'
    m.node_tree.links.new(rgb.outputs['Color'],bs.inputs['Base Color'])
    return m


def atlas_material():
    m=material('Vila | atlas PBR');n=m.node_tree.nodes;l=m.node_tree.links
    bs=n.get('Principled BSDF');vc=next(x for x in n if x.bl_idname=='ShaderNodeVertexColor')
    def texture(file,linear):
        image=bpy.data.images.load(str(HERE/'textures'/file),check_existing=True)
        if linear:image.colorspace_settings.name='Non-Color'
        image.pack()
        t=n.new('ShaderNodeTexImage');t.image=image;return t
    albedo=texture('village-color.jpg',False)
    mul=n.new('ShaderNodeMixRGB');mul.blend_type='MULTIPLY';mul.inputs[0].default_value=1
    l.new(albedo.outputs['Color'],mul.inputs[1]);l.new(vc.outputs['Color'],mul.inputs[2]);l.new(mul.outputs[0],bs.inputs['Base Color'])
    orm=texture('village-orm.png',True);sep=n.new('ShaderNodeSeparateColor')
    l.new(orm.outputs[0],sep.inputs[0]);l.new(sep.outputs['Green'],bs.inputs['Roughness']);l.new(sep.outputs['Blue'],bs.inputs['Metallic'])
    normal=texture('village-normal.png',True);bump=n.new('ShaderNodeNormalMap');bump.inputs['Strength'].default_value=.42
    l.new(normal.outputs[0],bump.inputs['Color']);l.new(bump.outputs[0],bs.inputs['Normal'])
    return m


def from_kit(name,k,coll,mat):
    o=mesh_object(name,k.v,k.f,coll);me=o.data
    uv=me.uv_layers.new(name='Atlas')
    # MeshKit stores a separate vertex for each face corner.
    uv.data.foreach_set('uv',np.array(k.uv,dtype='f').ravel())
    color_attr(me,k.color);me.materials.append(mat)
    o.modifiers.new('Triangulação para tangentes do atlas','TRIANGULATE')
    return o


def export(path,objects,apply=True,gpu=False):
    path.parent.mkdir(exist_ok=True,parents=True)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.hide_set(False);o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,
        export_apply=apply,export_yup=True,export_extras=True,export_cameras=False,export_lights=False,
        export_animations=False,export_gpu_instances=gpu,export_vertex_color='ACTIVE',export_all_vertex_colors=False,
        export_tangents=any(o.type=='MESH' and len(o.data.uv_layers)>0 for o in objects))

