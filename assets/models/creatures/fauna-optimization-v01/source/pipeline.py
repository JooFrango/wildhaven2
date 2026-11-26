#!/usr/bin/env python3
from __future__ import annotations
import argparse, copy, hashlib, json, math, struct
from pathlib import Path
import numpy as np
from scipy.spatial import cKDTree
import trimesh
import vtk
from vtk.util.numpy_support import numpy_to_vtk, vtk_to_numpy, numpy_to_vtkIdTypeArray
from PIL import Image, ImageDraw, ImageFont

DT={5120:np.int8,5121:np.uint8,5122:np.int16,5123:np.uint16,5125:np.uint32,5126:np.float32}
CTYPE={np.dtype(np.int8):5120,np.dtype(np.uint8):5121,np.dtype(np.int16):5122,np.dtype(np.uint16):5123,np.dtype(np.uint32):5125,np.dtype(np.float32):5126}
SHAPE={"SCALAR":1,"VEC2":2,"VEC3":3,"VEC4":4,"MAT2":4,"MAT3":9,"MAT4":16}
TYPES={1:"SCALAR",2:"VEC2",3:"VEC3",4:"VEC4",9:"MAT3",16:"MAT4"}
BUDGETS=(38000,16000,6500)
SOURCE_NAME='arumbar-savanna-anatomy-animated-v03.glb'
OUT_NAMES=[f'arumbar-savanna-optimized-v04-LOD{i}.glb' for i in range(3)]


def load_glb(path:Path):
    raw=path.read_bytes(); magic,ver,total=struct.unpack_from('<4sII',raw,0)
    if magic!=b'glTF' or ver!=2 or total!=len(raw): raise ValueError(f'invalid GLB {path}')
    jlen,jtype=struct.unpack_from('<I4s',raw,12)
    if jtype!=b'JSON': raise ValueError('missing JSON chunk')
    doc=json.loads(raw[20:20+jlen]); off=20+jlen
    blen,btype=struct.unpack_from('<I4s',raw,off)
    if btype!=b'BIN\x00': raise ValueError('missing BIN chunk')
    return doc,raw[off+8:off+8+blen]


def read_accessor(doc,bb,idx):
    acc=doc['accessors'][idx]
    if 'sparse' in acc: raise ValueError('sparse accessors unsupported')
    view=doc['bufferViews'][acc['bufferView']]
    dtype=np.dtype(DT[acc['componentType']]).newbyteorder('<')
    comp=SHAPE[acc['type']]
    stride=view.get('byteStride')
    offset=view.get('byteOffset',0)+acc.get('byteOffset',0)
    if not stride:
        arr=np.frombuffer(bb,dtype=dtype,count=acc['count']*comp,offset=offset)
        return arr.reshape((-1,comp)) if comp>1 else arr
    # deinterleave generic strided attributes
    item=dtype.itemsize*comp
    out=np.empty((acc['count'],comp),dtype=dtype)
    for i in range(acc['count']):
        out[i]=np.frombuffer(bb,dtype=dtype,count=comp,offset=offset+i*stride)
    return out if comp>1 else out[:,0]


def node_local_matrix(node, overrides=None):
    if overrides and 'matrix' in overrides: return np.array(overrides['matrix'],float).reshape(4,4).T
    if 'matrix' in node and not overrides: return np.array(node['matrix'],float).reshape(4,4).T
    t=np.array((overrides or {}).get('translation',node.get('translation',[0,0,0])),float)
    s=np.array((overrides or {}).get('scale',node.get('scale',[1,1,1])),float)
    q=np.array((overrides or {}).get('rotation',node.get('rotation',[0,0,0,1])),float)
    x,y,z,w=q/max(np.linalg.norm(q),1e-12)
    R=np.array([
      [1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w),0],
      [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w),0],
      [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y),0],
      [0,0,0,1]],float)
    M=np.eye(4);M[:3,3]=t
    S=np.diag([s[0],s[1],s[2],1.0])
    return M@R@S


def transform_positions(v,M):
    h=np.c_[v,np.ones(len(v))]
    return (h@M.T)[:,:3].astype(np.float32)


def transform_normals(n,M):
    A=np.linalg.inv(M[:3,:3]).T
    out=n@A.T; ln=np.linalg.norm(out,axis=1,keepdims=True); out/=np.maximum(ln,1e-12)
    return out.astype(np.float32)


def primitive_triangles(doc,p):
    if p.get('mode',4)!=4: return 0
    if 'indices' in p:return int(doc['accessors'][p['indices']]['count']//3)
    return int(doc['accessors'][p['attributes']['POSITION']]['count']//3)


def glb_stats(path:Path):
    doc,bb=load_glb(path)
    tri_defs=sum(primitive_triangles(doc,p) for m in doc.get('meshes',[]) for p in m.get('primitives',[]))
    draw=0; tri_drawn=0
    for n in doc.get('nodes',[]):
        if 'mesh' in n:
            ps=doc['meshes'][n['mesh']].get('primitives',[]); draw+=len(ps);tri_drawn+=sum(primitive_triangles(doc,p) for p in ps)
    joints=[len(s.get('joints',[])) for s in doc.get('skins',[])]
    return {
      'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
      'trianglesMeshDefinitions':tri_defs,'trianglesDrawnPerInstance':tri_drawn,
      'meshDefinitions':len(doc.get('meshes',[])),'meshNodes':sum('mesh'in n for n in doc.get('nodes',[])),
      'primitives':sum(len(m.get('primitives',[])) for m in doc.get('meshes',[])),
      'estimatedDrawCalls':draw,'materials':len(doc.get('materials',[])),'nodes':len(doc.get('nodes',[])),
      'skins':len(doc.get('skins',[])),'skinJointCounts':joints,
      'animations':[a.get('name',f'clip_{i}') for i,a in enumerate(doc.get('animations',[]))]
    }


def norm_id(s):return s.lower().replace('_','-').replace(' ','-')

def infer_species(path:Path):
    parts=path.parts; idx=parts.index('creatures'); folder=parts[idx+1]; name=path.stem
    if folder=='detritivoros': return norm_id(name.split('-animated')[0])
    if folder=='temperate-wildlife-pair-v01': return norm_id(name.split('_')[0])
    if folder in ('nharuk','rocantraz','arumbar','cavoru','silvarano'): return folder
    return norm_id(folder)

def lod_level(path:Path):
    s=path.as_posix().lower()
    if 'lod2' in s:return 2
    if 'lod1' in s:return 1
    if 'lod0' in s:return 0
    return 0

def version_score(path:Path):
    import re
    nums=[int(x) for x in re.findall(r'v(\d+)',path.as_posix().lower())]
    return max(nums) if nums else 0

def audit(root:Path):
    species_docs={}
    spdir=root/'creatures/species'
    if spdir.exists():
      for p in spdir.glob('*.json'):
        if p.name=='schema.json':continue
        try:
          d=json.loads(p.read_text()); species_docs[norm_id(d.get('id',p.stem))]=d
        except Exception:pass
    rows=[]
    for p in sorted((root/'assets/models/creatures').rglob('*.glb')):
      st=glb_stats(p); sid=infer_species(p); dossier=species_docs.get(norm_id(sid),{})
      habitats=dossier.get('habitats',dossier.get('habitat',[])); habitats=[habitats] if isinstance(habitats,str) else habitats
      duplicate='temperate-wildlife-pair-v01' in p.as_posix()
      rows.append({
        'species':sid,'path':p.relative_to(root).as_posix(),'lod':lod_level(p),'versionScore':version_score(p),
        'habitats':habitats or [],'artisticState':dossier.get('status','unknown'),'duplicateCopy':duplicate,**st})
    modeled={norm_id(r['species']) for r in rows if not r['duplicateCopy']}
    unmodeled=[]
    for sid,d in species_docs.items():
      if sid not in modeled:
        unmodeled.append({'species':sid,'name':d.get('name',sid),'status':d.get('status','unknown'),'habitats':d.get('habitats',d.get('habitat',[]))})
    # latest canonical LOD0 per species for prioritization
    latest=[]
    for sid in sorted(modeled):
      cand=[r for r in rows if norm_id(r['species'])==sid and not r['duplicateCopy'] and r['lod']==0]
      if not cand:continue
      r=sorted(cand,key=lambda x:(x['versionScore'],x['bytes']))[-1].copy()
      family=[x for x in rows if norm_id(x['species'])==sid and not x['duplicateCopy'] and x['versionScore']==r['versionScore']]
      lods=sorted(set(x['lod'] for x in family))
      score=0; reasons=[]
      tri=r['trianglesDrawnPerInstance'] or r['trianglesMeshDefinitions']
      if tri>100000:score+=6;reasons.append('>100k triangles')
      elif tri>50000:score+=4;reasons.append('>50k triangles')
      elif tri>30000:score+=2;reasons.append('>30k triangles')
      if r['estimatedDrawCalls']>200:score+=6;reasons.append('>200 draw calls')
      elif r['estimatedDrawCalls']>80:score+=4;reasons.append('>80 draw calls')
      elif r['estimatedDrawCalls']>40:score+=2;reasons.append('>40 draw calls')
      if 2 not in lods:score+=3;reasons.append('no LOD2')
      if 1 not in lods:score+=2;reasons.append('no LOD1')
      r['availableLods']=lods;r['priorityScore']=score;r['priorityReasons']=reasons;latest.append(r)
    latest.sort(key=lambda x:(x['priorityScore'],x['estimatedDrawCalls'],x['trianglesDrawnPerInstance']),reverse=True)
    out={'generatedFrom':'repository checkout GLB binaries','assetCount':len(rows),'modeledSpeciesCount':len(modeled),'assets':rows,'unmodeledDossiers':unmodeled,'priority':latest}
    docs=root/'docs';docs.mkdir(exist_ok=True)
    (docs/'fauna-3d-inventory-v01.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
    lines=['# Wildhaven — inventário real da fauna 3D v01','',f'Gerado automaticamente a partir de **{len(rows)} GLBs reais** no checkout. Não conta ficha JSON como modelo.','',
           '| Prioridade | Criatura | GLB atual | Triângulos desenhados | Draw calls | Materiais | LODs | Estado |','|---:|---|---|---:|---:|---:|---|---|']
    for i,r in enumerate(latest,1):
      lines.append(f"| {i} | {r['species']} | `{r['path']}` | {r['trianglesDrawnPerInstance']:,} | {r['estimatedDrawCalls']} | {r['materials']} | {','.join(map(str,r['availableLods']))} | {r['artisticState']} |")
    lines += ['','## Dossiês sem GLB publicado']
    if unmodeled:
      for u in unmodeled:lines.append(f"- **{u['species']}** — {u['status']}")
    else:lines.append('- Nenhum.')
    lines += ['','## Regras da auditoria','- Versões duplicadas e cópias de pacotes agregadores continuam listadas no JSON, mas não contam duas vezes na prioridade por espécie.','- `estimatedDrawCalls` mede primitivas instanciadas por nós de malha; é estimativa estrutural, não captura GPU.','- FPS não é inventado: esta etapa produz métricas estruturais reproduzíveis.']
    (docs/'fauna-3d-inventory-v01.md').write_text('\n'.join(lines)+'\n')
    print(json.dumps({'assets':len(rows),'modeled':len(modeled),'priorityTop':latest[:5]},ensure_ascii=False,indent=2))
    return out


def animated_nodes(doc):
    return {c['target']['node'] for a in doc.get('animations',[]) for c in a.get('channels',[]) if 'node' in c.get('target',{})}

def parents(doc):
    p={}
    for i,n in enumerate(doc.get('nodes',[])):
      for c in n.get('children',[]):p[c]=i
    return p

def accessor_schema(doc,idx):
    a=doc['accessors'][idx]
    return (a['componentType'],a['type'],bool(a.get('normalized',False)))

def batch_geometry(doc,bb):
    par=parents(doc); anim=animated_nodes(doc)
    groups={}; unbatchable=[]
    for ni,node in enumerate(doc.get('nodes',[])):
      if 'mesh' not in node:continue
      if ni in anim or 'skin' in node:
        unbatchable.append((ni,node['mesh']));continue
      M=node_local_matrix(node)
      parent=par.get(ni,-1)
      for prim in doc['meshes'][node['mesh']].get('primitives',[]):
        if prim.get('mode',4)!=4 or 'targets' in prim:
          unbatchable.append((ni,node['mesh']));continue
        attrs=prim['attributes']; schema=tuple(sorted((k,)+accessor_schema(doc,v) for k,v in attrs.items()))
        material=prim.get('material',-1)
        key=(parent,material,schema)
        v=read_accessor(doc,bb,attrs['POSITION']).reshape(-1,3).astype(np.float32)
        data={k:read_accessor(doc,bb,a).copy() for k,a in attrs.items()}
        data['POSITION']=transform_positions(v,M)
        if 'NORMAL' in data:data['NORMAL']=transform_normals(data['NORMAL'].reshape(-1,3).astype(np.float32),M)
        if 'TANGENT' in data:
          t=data['TANGENT'].copy(); xyz=transform_normals(t[:,:3].astype(np.float32),M);t[:,:3]=xyz;data['TANGENT']=t
        if 'indices' in prim: f=read_accessor(doc,bb,prim['indices']).reshape(-1,3).astype(np.uint32)
        else:f=np.arange(len(v),dtype=np.uint32).reshape(-1,3)
        groups.setdefault(key,[]).append((data,f,ni))
    # Arumbar contract: all mesh nodes should be static geometry under animated joints.
    if unbatchable: raise RuntimeError(f'unbatchable animated/skinned/morph mesh nodes: {unbatchable[:8]} count={len(unbatchable)}')
    batches=[]
    for key,items in groups.items():
      attrs_out={};offset=0;faces=[]
      keys=items[0][0].keys()
      for k in keys:attrs_out[k]=np.concatenate([x[0][k] for x in items],axis=0)
      for data,f,_ in items:
        faces.append(f+offset);offset+=len(data['POSITION'])
      batches.append({'parent':key[0],'material':key[1],'schema':key[2],'attrs':attrs_out,'faces':np.concatenate(faces,axis=0),'sourceNodes':[x[2] for x in items]})
    return batches


def simplify(verts,faces,target):
    verts=np.asarray(verts,dtype=np.float32); faces=np.asarray(faces,dtype=np.int64)
    if len(faces)<=max(target,8):return verts,faces.astype(np.uint32)
    mesh=trimesh.Trimesh(vertices=verts,faces=faces,process=False)
    mesh.update_faces(mesh.nondegenerate_faces());mesh.remove_unreferenced_vertices();mesh.merge_vertices(digits_vertex=6)
    verts=np.asarray(mesh.vertices,dtype=np.float32);faces=np.asarray(mesh.faces,dtype=np.int64)
    if len(faces)<=max(target,8):return verts,faces.astype(np.uint32)
    pts=vtk.vtkPoints();pts.SetData(numpy_to_vtk(verts,deep=True));poly=vtk.vtkPolyData();poly.SetPoints(pts)
    cells=vtk.vtkCellArray(); arr=np.column_stack((np.full(len(faces),3,dtype=np.int64),faces));cells.SetCells(len(faces),numpy_to_vtkIdTypeArray(arr.reshape(-1),deep=True));poly.SetPolys(cells)
    dec=vtk.vtkQuadricDecimation();dec.SetInputData(poly);dec.SetTargetReduction(float(np.clip(1-target/len(faces),0,.985)));dec.VolumePreservationOn();dec.Update();out=dec.GetOutput()
    if out.GetNumberOfPolys()<4:return verts,faces.astype(np.uint32)
    vv=vtk_to_numpy(out.GetPoints().GetData()).astype(np.float32);polys=vtk_to_numpy(out.GetPolys().GetData()).reshape(-1,4);ff=polys[:,1:].astype(np.uint32)
    return vv,ff


def allocate_targets(counts,total,level):
    keep_threshold=(56,28,12)[level]
    mins=[n if n<=keep_threshold else max(4,min(n,8)) for n in counts]
    if sum(mins)>=total:return mins
    capacity=[max(0,n-m) for n,m in zip(counts,mins)]; remain=total-sum(mins); cap=sum(capacity)
    targets=[m+(round(remain*c/cap) if cap else 0) for m,c in zip(mins,capacity)]
    # trim rounding excess from largest reducible entries
    while sum(targets)>total:
      i=max(range(len(targets)),key=lambda j:targets[j]-mins[j])
      if targets[i]<=mins[i]:break
      targets[i]-=1
    return [min(c,max(m,t)) for c,m,t in zip(counts,mins,targets)]


def animation_signature(doc,bb):
    h=hashlib.sha256()
    for a in doc.get('animations',[]):
      h.update(a.get('name','').encode())
      for c in a.get('channels',[]):h.update(json.dumps(c,sort_keys=True,separators=(',',':')).encode())
      for s in a.get('samplers',[]):
        h.update(read_accessor(doc,bb,s['input']).tobytes());h.update(read_accessor(doc,bb,s['output']).tobytes())
    return h.hexdigest()


def write_glb(doc,newbuf,dest):
    while len(newbuf)%4:newbuf.append(0)
    doc['buffers']=[{'byteLength':len(newbuf)}]
    js=json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode();js+=b' '*(-len(js)%4)
    size=12+8+len(js)+8+len(newbuf)
    raw=struct.pack('<4sII',b'glTF',2,size)+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(newbuf),b'BIN\x00')+newbuf
    dest.write_bytes(raw)


def optimize_arumbar(source:Path,dest:Path,target_total:int,level:int):
    src,bb=load_glb(source); sig=animation_signature(src,bb);batches=batch_geometry(src,bb)
    counts=[len(b['faces']) for b in batches];targets=allocate_targets(counts,target_total,level)
    simplified=[]
    for b,tgt in zip(batches,targets):
      v=b['attrs']['POSITION'];nv,nf=simplify(v,b['faces'],tgt)
      tree=cKDTree(v);_,nn=tree.query(nv,k=1,workers=-1)
      attrs={}
      for k,arr in b['attrs'].items():
        if k=='POSITION':attrs[k]=nv
        elif k=='NORMAL':
          m=trimesh.Trimesh(vertices=nv,faces=nf,process=False);attrs[k]=np.asarray(m.vertex_normals,dtype=np.float32)
        else:attrs[k]=arr[nn].copy()
      simplified.append({**b,'attrs':attrs,'faces':nf})
    doc=copy.deepcopy(src); oldacc=src['accessors']; oldviews=src['bufferViews'];newacc=[];newviews=[];newbuf=bytearray();oldmap={}
    def put(data,ctype=None,typ=None,normalized=False,target=None,minmax=False):
      arr=np.ascontiguousarray(data)
      if arr.ndim==1:comp=1
      else:comp=arr.shape[1]
      if ctype is None:ctype=CTYPE.get(arr.dtype,np.float32)
      if ctype is np.float32:ctype=5126
      if typ is None:typ=TYPES[comp]
      while len(newbuf)%4:newbuf.append(0)
      off=len(newbuf);newbuf.extend(arr.tobytes())
      bv={'buffer':0,'byteOffset':off,'byteLength':len(arr.tobytes())}
      if target:bv['target']=target
      vi=len(newviews);newviews.append(bv);a={'bufferView':vi,'componentType':ctype,'count':len(arr),'type':typ}
      if normalized:a['normalized']=True
      if minmax and arr.ndim==2:a['min']=np.min(arr,axis=0).astype(float).tolist();a['max']=np.max(arr,axis=0).astype(float).tolist()
      ai=len(newacc);newacc.append(a);return ai
    def retain(idx):
      if idx not in oldmap:
        a=oldacc[idx];v=oldviews[a['bufferView']];data=read_accessor(src,bb,idx)
        oldmap[idx]=put(data,a['componentType'],a['type'],a.get('normalized',False),v.get('target'))
        for k in ('min','max'):
          if k in a:newacc[oldmap[idx]][k]=a[k]
      return oldmap[idx]
    # preserve all animation/skin accessors exactly
    for skin in doc.get('skins',[]):
      if 'inverseBindMatrices' in skin:skin['inverseBindMatrices']=retain(skin['inverseBindMatrices'])
    for a in doc.get('animations',[]):
      for s in a.get('samplers',[]):s['input']=retain(s['input']);s['output']=retain(s['output'])
    # old mesh nodes stay for hierarchy compatibility, but cease rendering
    for n in doc.get('nodes',[]):n.pop('mesh',None);n.pop('skin',None)
    doc['meshes']=[]
    parent_children={i:list(n.get('children',[])) for i,n in enumerate(doc.get('nodes',[]))}
    for bi,b in enumerate(simplified):
      attrs={}
      for k,arr in b['attrs'].items():
        # preserve original schema when available
        schema=dict((x[0],x[1:]) for x in b['schema'])[k];ctype,typ,norm=schema
        attrs[k]=put(arr,ctype,typ,norm,34962,minmax=(k=='POSITION'))
      flat=b['faces'].reshape(-1);dtype=np.uint16 if len(b['attrs']['POSITION'])<65536 else np.uint32
      flat=flat.astype(dtype);idx=put(flat,5123 if dtype==np.uint16 else 5125,'SCALAR',False,34963)
      prim={'attributes':attrs,'indices':idx,'mode':4}
      if b['material']>=0:prim['material']=b['material']
      meshidx=len(doc['meshes']);doc['meshes'].append({'name':f'Arumbar_v04_batch_{bi:03d}','primitives':[prim]})
      nodeidx=len(doc['nodes']);doc['nodes'].append({'name':f'Arumbar_v04_batch_{bi:03d}','mesh':meshidx})
      if b['parent']>=0:
        parent_children.setdefault(b['parent'],list(doc['nodes'][b['parent']].get('children',[]))).append(nodeidx)
      else:
        if doc.get('scenes'):
          doc['scenes'][doc.get('scene',0)].setdefault('nodes',[]).append(nodeidx)
    for i,ch in parent_children.items():
      if ch:doc['nodes'][i]['children']=ch
      else:doc['nodes'][i].pop('children',None)
    doc['accessors']=newacc;doc['bufferViews']=newviews
    write_glb(doc,newbuf,dest)
    d2,b2=load_glb(dest)
    if animation_signature(d2,b2)!=sig:raise RuntimeError('animation signature changed')
    st=glb_stats(dest);st.update({'targetTriangles':target_total,'animationSignature':sig,'batchedGroups':len(batches),'sourceMeshNodes':sum('mesh'in n for n in src.get('nodes',[]))})
    return st


def quat_nlerp(a,b,t):
    if np.dot(a,b)<0:b=-b
    q=a*(1-t)+b*t;return q/max(np.linalg.norm(q),1e-12)
def sample_accessor(times,values,t,path):
    if len(times)==1:return values[0]
    if t<=times[0]:return values[0]
    if t>=times[-1]:return values[-1]
    i=int(np.searchsorted(times,t)-1);u=float((t-times[i])/max(times[i+1]-times[i],1e-12))
    return quat_nlerp(values[i],values[i+1],u) if path=='rotation' else values[i]*(1-u)+values[i+1]*u

def pose_overrides(doc,bb,clip_name=None,phase=.5):
    if not clip_name:return {}
    clip=next((a for a in doc.get('animations',[]) if a.get('name')==clip_name),None)
    if not clip:return {}
    max_t=0
    for s in clip['samplers']:
      tt=read_accessor(doc,bb,s['input']);max_t=max(max_t,float(tt[-1]))
    t=max_t*phase;ov={}
    for c in clip['channels']:
      s=clip['samplers'][c['sampler']];times=read_accessor(doc,bb,s['input']);vals=read_accessor(doc,bb,s['output']);node=c['target']['node'];path=c['target']['path']
      ov.setdefault(node,{})[path]=sample_accessor(times,vals,t,path).tolist()
    return ov

def render(path:Path,out:Path,angle='three_quarter',clip=None,phase=.5,wire=False,width=1200,height=900):
    d,b=load_glb(path);par=parents(d);ov=pose_overrides(d,b,clip,phase);world={}
    def wm(i):
      if i not in world:
        local=node_local_matrix(d['nodes'][i],ov.get(i));world[i]=(wm(par[i])@local) if i in par else local
      return world[i]
    ren=vtk.vtkRenderer();ren.SetBackground(.76,.84,.86);ren.SetBackground2(.96,.91,.80);ren.GradientBackgroundOn();win=vtk.vtkRenderWindow();win.SetOffScreenRendering(1);win.SetSize(width,height);win.AddRenderer(ren)
    mins=np.array([np.inf]*3);maxs=np.array([-np.inf]*3)
    for ni,n in enumerate(d.get('nodes',[])):
      if 'mesh' not in n:continue
      M=wm(ni)
      for p in d['meshes'][n['mesh']]['primitives']:
        v=read_accessor(d,b,p['attributes']['POSITION']).reshape(-1,3).astype(np.float32);v=transform_positions(v,M);f=(read_accessor(d,b,p['indices']).reshape(-1,3) if 'indices' in p else np.arange(len(v),dtype=np.uint32).reshape(-1,3))
        mins=np.minimum(mins,v.min(0));maxs=np.maximum(maxs,v.max(0))
        poly=vtk.vtkPolyData();pts=vtk.vtkPoints();pts.SetData(numpy_to_vtk(v,deep=True));poly.SetPoints(pts);cells=vtk.vtkCellArray();arr=np.column_stack((np.full(len(f),3,dtype=np.int64),f.astype(np.int64)));cells.SetCells(len(f),numpy_to_vtkIdTypeArray(arr.reshape(-1),deep=True));poly.SetPolys(cells)
        norms=vtk.vtkPolyDataNormals();norms.SetInputData(poly);norms.SplittingOff();norms.ConsistencyOn();mapper=vtk.vtkPolyDataMapper();mapper.SetInputConnection(norms.GetOutputPort())
        actor=vtk.vtkActor();actor.SetMapper(mapper)
        if wire:actor.GetProperty().SetRepresentationToWireframe();actor.GetProperty().SetLineWidth(.7);actor.GetProperty().SetColor(.12,.12,.12)
        else:
          mat=d.get('materials',[{}])[p.get('material',0)] if d.get('materials') else {};col=mat.get('pbrMetallicRoughness',{}).get('baseColorFactor',[.55,.38,.22,1])[:3];actor.GetProperty().SetColor(*col);actor.GetProperty().SetAmbient(.28);actor.GetProperty().SetDiffuse(.78)
        ren.AddActor(actor)
    plane=vtk.vtkPlaneSource();plane.SetOrigin(-20,-.05,-20);plane.SetPoint1(20,-.05,-20);plane.SetPoint2(-20,-.05,20);pm=vtk.vtkPolyDataMapper();pm.SetInputConnection(plane.GetOutputPort());pa=vtk.vtkActor();pa.SetMapper(pm);pa.GetProperty().SetColor(.62,.57,.45);ren.AddActor(pa)
    for pos,intensity in [((7,12,10),1.05),((-8,6,-7),.55)]:
      light=vtk.vtkLight();light.SetPosition(*pos);light.SetFocalPoint(0,1,0);light.SetIntensity(intensity);ren.AddLight(light)
    center=(mins+maxs)*.5;ext=max(maxs-mins);cam=ren.GetActiveCamera()
    if angle=='side':cam.SetPosition(center[0]+ext*2.6,center[1]+ext*.18,center[2])
    elif angle=='front':cam.SetPosition(center[0],center[1]+ext*.18,center[2]+ext*2.6)
    else:cam.SetPosition(center[0]+ext*1.8,center[1]+ext*.65,center[2]+ext*2.0)
    cam.SetFocalPoint(*center);cam.SetViewUp(0,1,0);cam.ParallelProjectionOn();cam.SetParallelScale(ext*.62);ren.ResetCameraClippingRange();win.Render()
    cap=vtk.vtkWindowToImageFilter();cap.SetInput(win);cap.ReadFrontBufferOff();cap.Update();out.parent.mkdir(parents=True,exist_ok=True);w=vtk.vtkPNGWriter();w.SetInputConnection(cap.GetOutputPort());w.SetFileName(str(out));w.Write();win.Finalize()
    return {'bytes':out.stat().st_size,'boundsMin':mins.tolist(),'boundsMax':maxs.tolist()}


def make_comparison(original:Path,optimized:Path,out:Path):
    imgs=[Image.open(original).convert('RGB'),Image.open(optimized).convert('RGB')];W=max(i.width for i in imgs);H=max(i.height for i in imgs);canvas=Image.new('RGB',(W*2,H+90),(25,30,31));d=ImageDraw.Draw(canvas)
    for i,im in enumerate(imgs):canvas.paste(im,(i*W,90))
    font=ImageFont.load_default();d.text((20,25),'ARUMBAR v03 ORIGINAL',fill='white',font=font);d.text((W+20,25),'ARUMBAR v04 LOD0 OPTIMIZED',fill='white',font=font);canvas.save(out,optimize=True)


def build(root:Path):
    folder=root/'assets/models/creatures/arumbar';source=folder/SOURCE_NAME;before=glb_stats(source);doc,bb=load_glb(source);sig=animation_signature(doc,bb)
    records=[]
    for i,budget in enumerate(BUDGETS):
      dest=folder/OUT_NAMES[i];records.append(optimize_arumbar(source,dest,budget,i))
      print('built',dest,records[-1]['trianglesDrawnPerInstance'],records[-1]['estimatedDrawCalls'])
    previews={}
    for angle in ('side','front','three-quarter'):
      a='three_quarter' if angle=='three-quarter' else angle;path=folder/f'arumbar-real-3d-{angle}-optimized-v04.png';previews[angle]=render(folder/OUT_NAMES[0],path,a)
    previews['wireframe']=render(folder/OUT_NAMES[0],folder/'arumbar-real-3d-wireframe-optimized-v04.png','three_quarter',wire=True)
    previews['charge']=render(folder/OUT_NAMES[0],folder/'arumbar-real-3d-charge-optimized-v04.png','three_quarter','charge',.55)
    previews['graze']=render(folder/OUT_NAMES[0],folder/'arumbar-real-3d-graze-optimized-v04.png','side','graze',.65)
    original_tmp=root/'build/arumbar-v03-side-audit.png';original_tmp.parent.mkdir(exist_ok=True);render(source,original_tmp,'side')
    make_comparison(original_tmp,folder/'arumbar-real-3d-side-optimized-v04.png',folder/'arumbar-v03-v04-real-comparison.png')
    manifest={'species':'arumbar','version':'v04-optimization','artisticStatus':'preserve_v03_design_pending_review_of_lod_fidelity','source':SOURCE_NAME,'sourceStats':before,'animationSignature':sig,'lods':records,'previews':previews,'method':['batch static mesh children by animated parent + material','bake local transforms before batching','VTK quadric decimation with volume preservation','nearest-surface transport of retained vertex attributes','preserve animation sampler data and animated node indices byte-equivalently at accessor-array level'],'integration':{'gameplay':False,'spawn':False,'world':False,'alpha01Touched':False},'limitations':['rig remains hierarchical rigid-pivot animation, not weighted skinning','no browser FPS claimed in CI; benchmark is structural','artistic approval still required before replacing v03 as recommended asset']}
    (folder/'arumbar-optimization-manifest-v04.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    bench={'source':before,'lods':[],'instances':[10,25,50,100,200]}
    for i,r in enumerate(records):
      bench['lods'].append({'lod':i,'triangles':r['trianglesDrawnPerInstance'],'drawCalls':r['estimatedDrawCalls'],'scenarios':[{'instances':n,'trianglesPerFrame':n*r['trianglesDrawnPerInstance'],'drawCallsPerFrame':n*r['estimatedDrawCalls']} for n in bench['instances']]})
    (folder/'arumbar-structural-benchmark-v04.json').write_text(json.dumps(bench,ensure_ascii=False,indent=2)+'\n')
    return manifest


def validate(root:Path):
    folder=root/'assets/models/creatures/arumbar';source=folder/SOURCE_NAME;sd,sb=load_glb(source);sig=animation_signature(sd,sb);source_stats=glb_stats(source);manifest=json.loads((folder/'arumbar-optimization-manifest-v04.json').read_text());errs=[];last=10**18
    for i,name in enumerate(OUT_NAMES):
      p=folder/name;d,b=load_glb(p);st=glb_stats(p)
      if st['sha256']!=manifest['lods'][i]['sha256']:errs.append(f'hash {i}')
      if animation_signature(d,b)!=sig:errs.append(f'animation signature {i}')
      if st['animations']!=source_stats['animations']:errs.append(f'clips {i}')
      if st['trianglesDrawnPerInstance']>=last:errs.append(f'lod order {i}')
      last=st['trianglesDrawnPerInstance']
      if st['estimatedDrawCalls']>=source_stats['estimatedDrawCalls']:errs.append(f'draw calls not reduced {i}')
      if st['materials']!=source_stats['materials']:errs.append(f'materials changed {i}')
    for name in ['side','front','three-quarter','wireframe','charge','graze']:
      p=folder/f'arumbar-real-3d-{name}-optimized-v04.png'
      if not p.exists() or p.stat().st_size<20000 or not p.read_bytes().startswith(b'\x89PNG\r\n\x1a\n'):errs.append(f'preview {name}')
    cp=folder/'arumbar-v03-v04-real-comparison.png'
    if not cp.exists() or cp.stat().st_size<30000:errs.append('comparison')
    if errs:raise SystemExit('VALIDATION FAILED: '+', '.join(errs))
    print(json.dumps({'ok':True,'source':source_stats,'lods':[glb_stats(folder/n) for n in OUT_NAMES]},ensure_ascii=False,indent=2))


def main():
    ap=argparse.ArgumentParser();ap.add_argument('command',choices=['audit','build','validate','all']);ap.add_argument('--root',type=Path,default=Path('.'));a=ap.parse_args();root=a.root.resolve()
    if a.command in ('audit','all'):audit(root)
    if a.command in ('build','all'):build(root)
    if a.command in ('validate','all'):validate(root)
if __name__=='__main__':main()
