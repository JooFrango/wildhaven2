"""Editable relief and temperate forest. The evaluated Geometry Nodes are also the export source."""
import math

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

from blender_io import CACHE,MODELS,collection,mesh_object,color_attr,material,export


class Network:
    def __init__(self,name,output='Geometry'):
        self.g=bpy.data.node_groups.new(name,'GeometryNodeTree')
        self.socket('Geometry','NodeSocketGeometry','INPUT')
        self.socket(output,'NodeSocketGeometry','OUTPUT')
        self.input=self.node('NodeGroupInput','Controles',0,0)
        self.output=self.node('NodeGroupOutput','Resultado',8,0)
    def socket(self,name,type_,side='INPUT',default=None,lo=None,hi=None):
        s=self.g.interface.new_socket(name=name,in_out=side,socket_type=type_)
        if default is not None:s.default_value=default
        if lo is not None:s.min_value=lo
        if hi is not None:s.max_value=hi
        return s
    def node(self,type_,label,x,y):
        n=self.g.nodes.new(type_);n.label=label;n.location=(x*220,y*125);return n
    def link(self,value,socket):
        if isinstance(value,bpy.types.NodeSocket):self.g.links.new(value,socket)
        else:socket.default_value=value
    def attr(self,name,x,y,typ='FLOAT'):
        n=self.node('GeometryNodeInputNamedAttribute',name,x,y);n.data_type=typ;n.inputs['Name'].default_value=name
        return n.outputs['Attribute']
    def math(self,op,a,b,label,x,y):
        n=self.node('ShaderNodeMath',label,x,y);n.operation=op
        self.link(a,n.inputs[0]);self.link(b,n.inputs[1]);return n.outputs[0]
    def store(self,geo,name,socket,kind,x,y):
        n=self.node('GeometryNodeStoreNamedAttribute',name,x,y);n.domain='POINT';n.data_type=kind
        self.link(geo,n.inputs['Geometry']);n.inputs['Name'].default_value=name;self.link(socket,n.inputs['Value'])
        return n.outputs['Geometry']


def scalar(mesh,name,values):
    a=mesh.attributes.new(name=name,type='FLOAT',domain='POINT')
    a.data.foreach_set('value',np.asarray(values,dtype='f').ravel())


def terrain(coll):
    data=np.load(CACHE/'terrain.npz');xz=data['xz']
    v=np.column_stack((xz[:,0],-xz[:,1],np.zeros(len(xz))))
    ground=mesh_object('HV_01_Terreno',v,data['faces'][:,::-1],coll)
    ground.data.polygons.foreach_set('use_smooth',np.ones(len(ground.data.polygons),dtype=bool))
    ground.data.materials.append(material('Solo | cores medidas na v12'))
    color_attr(ground.data,data['color'])
    for a in ['h','rim','urban','town','forest']:scalar(ground.data,a,data[a])
    apothem=2500*math.sqrt(3)/2
    side_normals=np.array([(math.cos(i*math.pi/3),math.sin(i*math.pi/3)) for i in range(6)])
    scalar(ground.data,'edge_clearance',apothem-np.max(xz@side_normals.T,axis=1))
    net=Network('HV • Relevo | bordas medidas e patamares')
    net.socket('Amplitude das colinas (m)','NodeSocketFloat',default=87,lo=0,hi=180)
    net.socket('Frequência (1/m)','NodeSocketFloat',default=.0016,lo=.0001,hi=.012)
    net.socket('Elevação da vila (m)','NodeSocketFloat',default=0,lo=-35,hi=35)
    pos=net.node('GeometryNodeInputPosition','Coordenadas do hexágono',0,-2)
    noise=net.node('ShaderNodeTexNoise','Dobras do terreno florestal',1,-2)
    net.link(pos.outputs[0],noise.inputs['Vector']);net.link(net.input.outputs[2],noise.inputs['Scale'])
    noise.inputs['Detail'].default_value=3;noise.inputs['Roughness'].default_value=.55
    n=net.math('SUBTRACT',noise.outputs['Fac'],.5,'Centralizar ruído',2,-2)
    n=net.math('MULTIPLY',n,net.input.outputs[1],'Altura das dobras',3,-2)
    n=net.math('MULTIPLY',n,net.attr('rim',2,-4),'Proteger as seis bordas',4,-2)
    raw=net.math('ADD',net.attr('h',3,0),n,'Relevo natural',5,0)
    town=net.math('ADD',net.attr('town',3,-5),net.input.outputs[3],'Patamares da vila',4,-5)
    mix=net.node('ShaderNodeMix','Clareira e encosta',6,-2);mix.data_type='FLOAT'
    net.link(net.attr('urban',4,-3),mix.inputs[0]);net.link(raw,mix.inputs[2]);net.link(town,mix.inputs[3])
    comb=net.node('ShaderNodeCombineXYZ','Deslocamento vertical',7,-2);net.link(mix.outputs[0],comb.inputs['Z'])
    setp=net.node('GeometryNodeSetPosition','Construir relevo',8,0)
    net.link(net.input.outputs['Geometry'],setp.inputs['Geometry']);net.link(comb.outputs[0],setp.inputs['Offset'])
    net.output.location.x=9*220;net.link(setp.outputs[0],net.output.inputs[0])
    ground.modifiers.new('01 • Relevo e patamares','NODES').node_group=net.g
    ground['chunkId']='HV_01';ground['role']='terrain'
    ground['worldCoord']=[28145.82562299425,0.,-3750.]
    return ground,float(data['base'])


def source_trees(coll):
    mat=material('FX_20 | floresta temperada v12');out=[]
    for path in sorted([*CACHE.glob('Conifera_*.npz'),*CACHE.glob('Folhosa_*.npz')]):
        tree=np.load(path);v=tree['v'];o=mesh_object(path.stem,np.column_stack((v[:,0],-v[:,2],v[:,1])),tree['f'],coll)
        o.data.materials.append(mat);color_attr(o.data,tree['c']);out.append(o)
    return out


def make_forest(ground,coll,templates):
    woods=mesh_object('HV_01_Floresta',[],[],coll)
    net=Network('HV • Floresta temperada | FX_20 em instâncias')
    net.socket('Árvores por km²','NodeSocketFloat',default=91,lo=0,hi=220)
    net.socket('Semente','NodeSocketInt',default=71170,lo=0,hi=200000)
    source=net.node('GeometryNodeObjectInfo','Terreno avaliado',0,-2);source.inputs['Object'].default_value=ground
    dist=net.node('GeometryNodeDistributePointsOnFaces','Clareiras, trilhas e limite da copa',3,0)
    net.link(source.outputs['Geometry'],dist.inputs['Mesh'])
    d=net.math('MULTIPLY',net.input.outputs[1],.000001,'De km² para m²',1,0)
    d=net.math('MULTIPLY',d,net.attr('forest',1,-2),'Densidade local',2,0)
    net.link(d,dist.inputs['Density']);net.link(net.input.outputs[2],dist.inputs['Seed'])
    pos=net.node('GeometryNodeInputPosition','Posição das raízes',2,-4)
    xy=net.node('ShaderNodeVectorMath','Distância horizontal',3,-4);xy.operation='MULTIPLY'
    net.link(pos.outputs[0],xy.inputs[0]);xy.inputs[1].default_value=(1,1,0)
    length=net.node('ShaderNodeVectorMath','Distância à vila',4,-4);length.operation='LENGTH';net.link(xy.outputs[0],length.inputs[0])
    size=net.node('ShaderNodeMapRange','Porte na borda da clareira',5,-4);size.clamp=True
    net.link(length.outputs['Value'],size.inputs['Value'])
    for name,val in [('From Min',62),('From Max',410),('To Min',.16),('To Max',.97)]:size.inputs[name].default_value=val
    def random_socket(name,lo,hi,seed,x,y,kind='FLOAT'):
        n=net.node('FunctionNodeRandomValue',name,x,y);n.data_type=kind
        for nm,val in [('Min',lo),('Max',hi)]:
            sock=next(s for s in n.inputs if s.name==nm and s.enabled);sock.default_value=val
        n.inputs['Seed'].default_value=seed
        return next(s for s in n.outputs if s.enabled)
    scale=net.math('MULTIPLY',size.outputs[0],random_socket('Variação do porte',.71,1.16,427,4,-6),'Escala uniforme',6,-4)
    rot=random_socket('Rotação',0,math.tau,130,4,-7)
    typ=random_socket('Exemplar',0,7,18,5,-8,'INT')
    points=net.store(dist.outputs['Points'],'tree_scale',scale,'FLOAT',7,-1)
    points=net.store(points,'tree_yaw',rot,'FLOAT',8,-1)
    points=net.store(points,'tree_kind',typ,'INT',9,-1)
    max_radius=max(math.hypot(v.co.x,v.co.y) for obj in templates.objects for v in obj.data.vertices)
    required=net.math('MULTIPLY',net.attr('tree_scale',7,-9),max_radius+1,'Envoltória da copa',8,-8)
    crosses=net.math('LESS_THAN',net.attr('edge_clearance',8,-10),required,'Copa cruza a divisa',9,-8)
    remove=net.node('GeometryNodeDeleteGeometry','Manter copas dentro do hexágono',10,-3)
    remove.domain='POINT';net.link(points,remove.inputs['Geometry']);net.link(crosses,remove.inputs['Selection'])
    points=remove.outputs['Geometry']
    # Authored fringe specimens sit on the evaluated relief, clear of the architecture.
    fringe=[(-46,23,.17),(-43,46,.20),(-31,51,.16),(-20,59,.19),(-9,53,.21),(3,61,.23),(16,57,.19),
            (26,51,.23),(38,48,.19),(48,32,.17),(51,19,.18),(52,6,.16),(-49,3,.14),(-51,-17,.15),
            (-39,-38,.12),(-36,-43,.13),(45,-22,.14),(42,-35,.12)]
    deps=bpy.context.evaluated_depsgraph_get();bvh=BVHTree.FromObject(ground,deps)
    coords=[]
    for x,y,_ in fringe:
        loc,_,_,_=bvh.ray_cast(Vector((x,y,3500)),Vector((0,0,-1)));coords.append(tuple(loc))
    fringe_obj=mesh_object('Mudas | orla do núcleo',coords,[],coll)
    scalar(fringe_obj.data,'tree_scale',[a[2] for a in fringe]);scalar(fringe_obj.data,'tree_yaw',[(i*2.39996)%math.tau for i in range(len(fringe))])
    ind=fringe_obj.data.attributes.new(name='tree_kind',type='INT',domain='POINT');ind.data.foreach_set('value',np.array([(i*5+3)%8 for i in range(len(fringe))],dtype='i'))
    info=net.node('GeometryNodeObjectInfo','Espécimes da orla',8,1);info.inputs['Object'].default_value=fringe_obj
    to_mesh=net.node('GeometryNodePointsToVertices','Posições para jogo',10,-1);net.link(points,to_mesh.inputs[0])
    join=net.node('GeometryNodeJoinGeometry','Bosque e mudas',11,0);net.link(to_mesh.outputs[0],join.inputs[0]);net.link(info.outputs['Geometry'],join.inputs[0])
    net.output.location=(12*220,0);net.link(join.outputs[0],net.output.inputs[0])
    mod=woods.modifiers.new('02 • Espécimes temperados','NODES');mod.node_group=net.g
    bpy.context.view_layer.update()
    # Bake the GN point stream only; keep real instancing in the editable graph and GLB.
    evaluated=woods.evaluated_get(bpy.context.evaluated_depsgraph_get());me=evaluated.to_mesh()
    coords=np.array([v.co[:] for v in me.vertices]);records={}
    for key,dtype in [('tree_kind','i'),('tree_scale','f'),('tree_yaw','f')]:
        values=np.zeros(len(coords),dtype=dtype);me.attributes[key].data.foreach_get('value',values);records[key]=values
    evaluated.to_mesh_clear()
    np.savez_compressed(CACHE/'forest.npz',coords=coords,**records)
    lib=net.node('GeometryNodeCollectionInfo','Biblioteca extraída de FX_20',10,-5)
    lib.inputs['Collection'].default_value=templates;lib.inputs['Separate Children'].default_value=True;lib.inputs['Reset Children'].default_value=True
    inst=net.node('GeometryNodeInstanceOnPoints','Instanciar árvores reais',13,0)
    net.link(join.outputs[0],inst.inputs['Points']);net.link(lib.outputs['Instances'],inst.inputs['Instance'])
    inst.inputs['Pick Instance'].default_value=True
    net.link(net.attr('tree_kind',11,-4,'INT'),inst.inputs['Instance Index'])
    net.link(net.attr('tree_scale',11,-6),inst.inputs['Scale'])
    angle=net.node('ShaderNodeCombineXYZ','Giro no eixo vertical',12,-3)
    net.link(net.attr('tree_yaw',11,-2),angle.inputs['Z']);net.link(angle.outputs[0],inst.inputs['Rotation'])
    net.output.location=(14*220,0);net.link(inst.outputs[0],net.output.inputs[0])
    return woods

