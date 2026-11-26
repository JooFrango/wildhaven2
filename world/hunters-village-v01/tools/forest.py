"""Serialize the exact evaluated Blender point stream as eight GPU instance batches."""
import json
import struct

import numpy as np
from scipy.spatial import Delaunay

from glb import HERE, MODELS, GLB
CACHE=HERE/'.build'


class Writer:
    def __init__(self):
        self.d={'asset':{'version':'2.0','generator':'Wildhaven | Geometry Nodes point stream'},
                'scene':0,'scenes':[{'nodes':[]}],'nodes':[],'meshes':[],'materials':[
                {'name':'FX_20 | color lineal','doubleSided':True,'pbrMetallicRoughness':{'metallicFactor':0,'roughnessFactor':.94}}],
                'accessors':[],'bufferViews':[]}
        self.bin=bytearray()

    def acc(self,values,typ,target=None,norm=False,bounds=False):
        a=np.ascontiguousarray(values)
        while len(self.bin)%4:self.bin.append(0)
        v={'buffer':0,'byteOffset':len(self.bin),'byteLength':a.nbytes}
        if target:v['target']=target
        vi=len(self.d['bufferViews']);self.d['bufferViews'].append(v)
        self.bin.extend(a.tobytes())
        dim=1 if a.ndim==1 else a.shape[1]
        item={'bufferView':vi,'componentType':typ,'count':len(a),'type':{1:'SCALAR',3:'VEC3',4:'VEC4'}[dim]}
        if norm:item['normalized']=True
        if bounds:item.update(min=a.min(axis=0).reshape(-1).tolist(),max=a.max(axis=0).reshape(-1).tolist())
        idx=len(self.d['accessors']);self.d['accessors'].append(item);return idx

    def mesh(self,name,v,f,c):
        tri=v[f]
        fn=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);vn=np.zeros_like(v,dtype=float)
        for j in range(3):np.add.at(vn,f[:,j],fn)
        vn/=np.maximum(1e-12,np.linalg.norm(vn,axis=1,keepdims=True))
        vn[np.linalg.norm(vn,axis=1)<.1]=[0,1,0]
        col=np.uint8(np.round(255*np.clip(c,0,1)));col=np.column_stack((col,np.full(len(v),255,'B')))
        at={'POSITION':self.acc(v.astype('<f4'),5126,34962,bounds=True),
            'NORMAL':self.acc(vn.astype('<f4'),5126,34962),'COLOR_0':self.acc(col,5121,34962,True)}
        ind=f.ravel().astype('<u2' if len(v)<=65535 else '<u4')
        prim={'attributes':at,'indices':self.acc(ind,5123 if ind.itemsize==2 else 5125,34963),'material':0}
        index=len(self.d['meshes']);self.d['meshes'].append({'name':name,'primitives':[prim]});return index

    def node(self,**props):
        self.d['scenes'][0]['nodes'].append(len(self.d['nodes']));self.d['nodes'].append(props)

    def save(self,path):
        self.d['buffers']=[{'byteLength':len(self.bin)}]
        doc=json.dumps(self.d,separators=(',',':'),ensure_ascii=False).encode()
        doc+=b' '*((-len(doc))%4);self.bin.extend(b'\0'*((-len(self.bin))%4))
        hdr=struct.pack('<4sII',b'glTF',2,28+len(doc)+len(self.bin))
        path.write_bytes(hdr+struct.pack('<I4s',len(doc),b'JSON')+doc+struct.pack('<I4s',len(self.bin),b'BIN\0')+self.bin)


def bake():
    w=Writer();ext='EXT_mesh_gpu_instancing';w.d.update(extensionsUsed=[ext],extensionsRequired=[ext])
    data=np.load(CACHE/'forest.npz');pts=data['coords'];gltf=np.column_stack((pts[:,0],pts[:,2],-pts[:,1]))
    yaw=data['tree_yaw'];sc=data['tree_scale']
    cells=np.floor(gltf[:,[0,2]]/210)
    rank=np.argsort(np.linalg.norm((cells+.5)*210-gltf[:,[0,2]],axis=1))
    _,selected=np.unique(cells[rank],axis=0,return_index=True)
    sparse=np.zeros(len(pts),bool);sparse[rank[selected]]=True
    for far in (False,True):
        w=Writer();w.d.update(extensionsUsed=[ext],extensionsRequired=[ext])
        for i,path in enumerate(sorted([*CACHE.glob('Conifera_*.npz'),*CACHE.glob('Folhosa_*.npz')])):
            proto=np.load(path);mesh=w.mesh(path.stem,proto['v'],proto['f'],proto['c'])
            indices=data['tree_kind']==i
            if far:indices &= sparse
            rot=yaw[indices]/2;n=np.count_nonzero(indices)
            attrs={'TRANSLATION':w.acc(gltf[indices].astype('<f4'),5126,bounds=True),
                   'ROTATION':w.acc(np.stack((np.zeros(n),np.sin(rot),np.zeros(n),np.cos(rot)),1).astype('<f4'),5126),
                   'SCALE':w.acc(np.repeat(sc[indices,None],3,axis=1).astype('<f4'),5126)}
            w.node(name=path.stem,mesh=mesh,extensions={ext:{'attributes':attrs}})
        w.save(MODELS/('hv_01_forest_lod1.glb' if far else 'hv_01_forest.glb'))
    # Preserve the entire rim, declutter the small nucleus at continental zoom.
    g=GLB(MODELS/'hv_01_terrain.glb');p=g.doc['meshes'][0]['primitives'][0]
    v=g.array(p['attributes']['POSITION']);xz=v[:,[0,2]].astype(float);c=g.array(p['attributes']['COLOR_0'])
    from prepare import read_edges,A
    norm=np.array([e['normal'] for e in read_edges()])
    rim=A-np.max(xz@norm.T,axis=1)
    cells=np.floor(xz/130).astype(int)
    idx=np.unique(np.r_[np.unique(cells,axis=0,return_index=True)[1],np.flatnonzero(abs(rim)<.002)])
    tri=Delaunay(xz[idx]);faces=tri.simplices[:,::-1];points=xz[idx[faces]]
    a,b=points[:,1]-points[:,0],points[:,2]-points[:,0]
    faces=faces[np.abs(a[:,0]*b[:,1]-a[:,1]*b[:,0])>1.]
    w=Writer();ix=w.mesh('HV_01_paysage',v[idx],faces,c[idx,:3]);w.node(name='HV_01__terrain',mesh=ix)
    w.save(MODELS/'hv_01_terrain_lod1.glb')
    print('Packed',len(pts),'instances. Coarse landscape',len(faces),'triangles.')

if __name__=='__main__':bake()


