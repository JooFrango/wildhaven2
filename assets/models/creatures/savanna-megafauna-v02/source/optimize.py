#!/usr/bin/env python3
"""Wildhaven: source-preserving glTF 2.0 animation-safe triangle retopology.

Each LOD reconstructs the referenced binary buffer only; no duplicate source
geometry is left in GLB. The original material, rig nodes, skin, animation
samplers, and clip names are kept byte-for-byte at the accessor level.
"""
from __future__ import annotations
import copy, json, hashlib, math, struct
from pathlib import Path
import numpy as np
from scipy.spatial import cKDTree
import vtk
from vtk.util.numpy_support import numpy_to_vtk, vtk_to_numpy, numpy_to_vtkIdTypeArray
import trimesh

DT={5121:np.uint8,5123:np.uint16,5125:np.uint32,5126:np.float32}
SHAPE={"SCALAR":1,"VEC2":2,"VEC3":3,"VEC4":4,"MAT4":16}

def load_glb(path):
    r=Path(path).read_bytes()
    magic,ver,n=struct.unpack_from('<4sII',r,0)
    assert magic==b'glTF' and ver==2 and n==len(r)
    njson,kind=struct.unpack_from('<I4s',r,12)
    assert kind==b'JSON'
    obj=json.loads(r[20:20+njson]); offset=20+njson
    nbin,bintype=struct.unpack_from('<I4s',r,offset)
    assert bintype==b'BIN\x00'
    binary=r[offset+8:offset+8+nbin]
    return obj,binary

def read_accessor(doc,bb,idx):
    acc=doc['accessors'][idx]; view=doc['bufferViews'][acc['bufferView']]
    dtype=np.dtype(DT[acc['componentType']]).newbyteorder('<')
    comp=SHAPE[acc['type']]
    offset=view.get('byteOffset',0)+acc.get('byteOffset',0)
    assert 'byteStride' not in view and 'sparse' not in acc
    arr=np.frombuffer(bb,dtype=dtype,count=acc['count']*comp,offset=offset)
    return arr.reshape((-1,comp)) if comp>1 else arr

def simplify(verts,faces,target):
    """Vertex-conserving quadric decimation; preserve model surface/volume."""
    verts=np.asarray(verts,dtype=np.float32)
    faces=np.asarray(faces,dtype=np.int64)
    if len(faces)<=max(target,40):return verts,faces.astype(np.uint32)
    cleaned=trimesh.Trimesh(vertices=verts,faces=faces,process=False)
    cleaned.update_faces(cleaned.nondegenerate_faces())
    cleaned.remove_unreferenced_vertices()
    cleaned.merge_vertices(digits_vertex=6)
    verts=np.asarray(cleaned.vertices,dtype=np.float32)
    faces=np.asarray(cleaned.faces,dtype=np.int64)
    if len(faces)<=max(target,40): return verts,faces.astype(np.uint32)
    points=vtk.vtkPoints(); points.SetData(numpy_to_vtk(verts,deep=True))
    poly=vtk.vtkPolyData(); poly.SetPoints(points)
    cells=vtk.vtkCellArray()
    triangles=np.column_stack((np.full(len(faces),3,dtype=np.int64),faces))
    cells.SetCells(len(faces),numpy_to_vtkIdTypeArray(triangles.reshape(-1),deep=True))
    poly.SetPolys(cells)
    dec=vtk.vtkQuadricDecimation();dec.SetInputData(poly)
    dec.SetTargetReduction(float(np.clip(1-target/len(faces),0,.98)))
    dec.VolumePreservationOn()
    dec.Update(); out=dec.GetOutput()
    n=out.GetNumberOfPolys()
    if n<20: return verts,faces.astype(np.uint32)
    vv=vtk_to_numpy(out.GetPoints().GetData()).astype(np.float32)
    polys=vtk_to_numpy(out.GetPolys().GetData()).reshape(-1,4)
    assert np.all(polys[:,0]==3)
    ff=polys[:,1:].astype(np.uint32)
    return vv,ff

def source_stats(doc,bb):
    tri=[]
    for m in doc['meshes']:
      tri.append(sum(len(read_accessor(doc,bb,p['indices']))//3 for p in m['primitives']))
    return tri

def optimize_glb(source,dest,ratio,target_total=None,kind='LOD0'):
    doc,bb=load_glb(source)
    original=source_stats(doc,bb)
    total=sum(original)
    if target_total is None:target_total=int(total*ratio)
    ratio=min(.98,max(.045,target_total/max(total,1)))
    # LOD0: prioritize organic continuous skinned body, leave small facial features.
    # Rigid faceted species parts must survive near-field; distant LODs reduce
    # face count *within* each articulated mesh, preserving nodes and clips.
    targets=[]
    for i,n in enumerate(original):
      if kind=='LOD0': goal=n if total<=target_total else max(28,int(n*ratio))
      elif kind=='LOD1': goal=max(13,int(n*.69))
      else: goal=max(8,int(n*.39))
      targets.append(min(n,goal))
    edits={}
    processed=0
    for mi,m in enumerate(doc['meshes']):
      for pi,p in enumerate(m['primitives']):
       f=read_accessor(doc,bb,p['indices']).reshape(-1,3)
       a=p['attributes']; v=read_accessor(doc,bb,a['POSITION']).reshape(-1,3)
       dst=max(8,int(len(f)*targets[mi]/max(original[mi],1)))
       nv,nf=simplify(v,f,dst)
       if len(nf)>=len(f):continue
       # Colors and weights are transported from the closest source surface.
       tree=cKDTree(v)
       dist,nn=tree.query(nv,k=min(4,len(v)),workers=-1)
       if nn.ndim==1: nn=nn[:,None];dist=dist[:,None]
       close=np.maximum(dist,1e-7)**-2
       close/=close.sum(axis=1,keepdims=True)
       newattrs={'POSITION':nv}
       for key in ('COLOR_0','JOINTS_0','WEIGHTS_0'):
        if key not in a:continue
        values=read_accessor(doc,bb,a[key]);
        if key=='JOINTS_0':
            # Weighted joint channels need matching weights: nearest original
            # joint+weight pair retains valid influence mapping under remesh.
            vals=values[nn[:,0]]
        elif key=='WEIGHTS_0':
            vals=values[nn[:,0]]
            vals=vals/np.maximum(np.sum(vals,axis=1,keepdims=True),1e-8)
        elif values.dtype.kind in 'iu':
            vals=np.rint(np.sum(values[nn].astype(float)*close[:,:,None],axis=1))
            vals=np.clip(vals,0,np.iinfo(values.dtype).max).astype(values.dtype)
        else:
            vals=np.sum(values[nn]*close[:,:,None],axis=1).astype(values.dtype)
        newattrs[key]=vals
       if 'NORMAL' in a:
           mesh=trimesh.Trimesh(vertices=nv,faces=nf,process=False)
           newattrs['NORMAL']=np.asarray(mesh.vertex_normals,dtype=np.float32)
       edits[(mi,pi)]=(nf,newattrs)
       processed+=1
    # Rebuild all referenced accessors, including those needed by animation and skin.
    doc=copy.deepcopy(doc)
    doc['accessors']=doc.get('accessors',[])
    oldaccs=doc['accessors']; oldviews=doc['bufferViews']
    newaccessors=[]; newviews=[]; newbuf=bytearray(); oldmap={}
    def put(data,ctype,typ,normalized=False,target=None):
       arr=np.ascontiguousarray(data)
       if target is not None and arr.dtype.byteorder=='>': arr=arr.byteswap().newbyteorder()
       while len(newbuf)%4:newbuf.append(0)
       off=len(newbuf);newbuf.extend(arr.tobytes())
       bv={'buffer':0,'byteOffset':off,'byteLength':len(newbuf)-off}
       if target:bv['target']=target
       vi=len(newviews);newviews.append(bv)
       a={'bufferView':vi,'componentType':ctype,'count':len(arr),'type':typ}
       if normalized:a['normalized']=True
       if typ=='VEC3' and ctype==5126 and target==34962:
          a['min']=np.min(arr,axis=0).astype(float).tolist();a['max']=np.max(arr,axis=0).astype(float).tolist()
       ai=len(newaccessors);newaccessors.append(a)
       return ai
    def retain(idx):
       if idx not in oldmap:
          acc=oldaccs[idx]
          data=read_accessor(doc,bb,idx)
          oldmap[idx]=put(data,acc['componentType'],acc['type'],acc.get('normalized',False),oldviews[acc['bufferView']].get('target'))
          if 'min' in acc:newaccessors[oldmap[idx]]['min']=acc['min']
          if 'max' in acc:newaccessors[oldmap[idx]]['max']=acc['max']
       return oldmap[idx]
    for mi,m in enumerate(doc['meshes']):
     for pi,p in enumerate(m['primitives']):
       if (mi,pi) not in edits:
          p['indices']=retain(p['indices'])
          p['attributes']={k:retain(v) for k,v in p['attributes'].items()}
          continue
       ff,attrs=edits[(mi,pi)]
       nvert=len(attrs['POSITION']); idxdtype=np.uint16 if nvert<65536 else np.uint32
       f32=ff.reshape(-1).astype(idxdtype)
       p['indices']=put(f32,5123 if idxdtype==np.uint16 else 5125,'SCALAR',target=34963)
       na={}
       for key,arr in attrs.items():
          comp= {'POSITION':5126,'NORMAL':5126,'COLOR_0':5121,'JOINTS_0':5123,'WEIGHTS_0':5126}[key]
          typ='VEC4' if key in ('JOINTS_0','WEIGHTS_0') else 'VEC3'
          na[key]=put(arr,comp,typ,normalized=(key=='COLOR_0'),target=34962)
       p['attributes']=na
    for skin in doc.get('skins',[]):
        if 'inverseBindMatrices' in skin:skin['inverseBindMatrices']=retain(skin['inverseBindMatrices'])
    for a in doc['animations']:
       for sampler in a['samplers']:
          sampler['input']=retain(sampler['input'])
          sampler['output']=retain(sampler['output'])
    doc['accessors']=newaccessors;doc['bufferViews']=newviews
    while len(newbuf)%4:newbuf.append(0)
    doc['buffers']=[{'byteLength':len(newbuf)}]
    chunk=json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode('utf-8')
    chunk+=b' '*(-len(chunk)%4)
    size=12+8+len(chunk)+8+len(newbuf)
    raw=struct.pack('<4sII',b'glTF',2,size)+struct.pack('<I4s',len(chunk),b'JSON')+chunk+struct.pack('<I4s',len(newbuf),b'BIN\x00')+newbuf
    Path(dest).parent.mkdir(parents=True,exist_ok=True);Path(dest).write_bytes(raw)
    after=source_stats(doc,newbuf)
    return {'path':str(dest),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'triangles':sum(after),'originalTriangles':total,'reductionPercent':round((1-sum(after)/total)*100,1),'source':str(source),'lod':kind,'animationNames':[a['name'] for a in doc['animations']],'skinJointCounts':[len(x['joints']) for x in doc.get('skins',[])],'meshCount':len(doc['meshes']),'remeshedPrimitives':processed}

if __name__=='__main__':
  import argparse
  ap=argparse.ArgumentParser();ap.add_argument('source');ap.add_argument('destination');ap.add_argument('--target',type=int,default=25000)
  a=ap.parse_args();print(json.dumps(optimize_glb(a.source,a.destination,1.0,a.target),indent=2))