"""Export standalone textured coastal GLBs. Run perimeter.py first."""
import io
import json
from math import pi

import numpy as np
from PIL import Image
from scipy.interpolate import LinearNDInterpolator
from scipy.ndimage import gaussian_filter

from perimeter import ROOT, WORLD, A, CORNERS, CELLS, PILOTS, DIR, SEA, center, source, GLB, dump
from terrain import basis, shoreline, build_ground, smooth
from forest import Writer
from prepare_colors import module

NORMALS=(CORNERS+np.roll(CORNERS,-1,axis=0))/(2*A)
EXT='EXT_mesh_gpu_instancing'
WATER={'level_m':SEA,'plane':'viewer only','depth_encoding':'R8; height above sea = normalized red * 640 - 256 m','domain_m':[-2500,2500]}
REVISED={'glacial','dunas','arcos'}
def png(image):
    out=io.BytesIO();image.save(out,format='PNG');return out.getvalue()

def uv_attribute(w,uv):
    ix=w.acc(np.asarray(uv,dtype='<f4').reshape(-1),5126,34962)
    w.d['accessors'][ix].update(type='VEC2',count=len(uv))
    return ix

def material(w,name,pixels):
    blob=png(Image.fromarray(pixels))
    w.bin.extend(bytes((-len(w.bin))%4));offset=len(w.bin);w.bin.extend(blob)
    view=len(w.d['bufferViews'])
    w.d['bufferViews'].append(dict(buffer=0,byteOffset=offset,byteLength=len(blob)))
    image=len(w.d.setdefault('images',[]))
    w.d['images'].append(dict(name=name,bufferView=view,mimeType='image/png'))
    w.d.setdefault('textures',[]).append(dict(source=image))
    w.d['materials'].append(dict(name=name,pbrMetallicRoughness=dict(baseColorTexture=dict(index=image),roughnessFactor=.89,metallicFactor=0)))
    return len(w.d['materials'])-1

def add_mesh(w,name,v,f,c,uv,mat,role):
    if role in ('rock','ice','arch'):
        # Hard planes on fracture surfaces. Positions are welded by coordinate for topology checks.
        ix=f.ravel()
        v,c,uv=v[ix],c[ix],uv[ix]
        f=np.arange(len(ix)).reshape(-1,3)
    mesh=w.mesh(name,v,f,c);prim=w.d['meshes'][mesh]['primitives'][0]
    prim['attributes']['TEXCOORD_0']=uv_attribute(w,uv);prim['material']=mat
    w.node(name=name,mesh=mesh,extras=dict(role=role))
    return mesh

def rock(rng,sx,sz,height,ice):
    n=int(rng.integers(5,10))
    a=(np.arange(n)+rng.uniform(-.24,.24,n))*2*pi/n
    base=np.stack([np.cos(a),np.sin(a)],1)*rng.uniform(.73,1.15,(n,1))
    levels=np.array([0,.23,.46,.49,.73,.94,1.])
    radii=[.82,1,.91,.98,.85,.64,.38] if not ice else [.46,.77,1,.99,.84,.78,.60]
    v=[];f=[];cs=[]
    lean=rng.uniform(-.63,.63,2)
    for j,(lev,rad) in enumerate(zip(levels,radii)):
        xy=base*rad+lean*lev
        h=height*(lev+(.065*np.sin(a*2+.7*j) if j else np.zeros(n)))
        v.extend(np.column_stack([xy[:,0]*sx,h,xy[:,1]*sz]))
        tone=np.array([.27,.24,.204]) if not ice else np.array([.17,.48,.62])
        if ice and j>=5:tone=np.array([.72,.84,.86])
        cs.extend(tone*rng.uniform(.76,1.12,(n,1))*(.78 if j==2 else 1))
        if j:
            for k in range(n):
                lo=(j-1)*n+k;nx=(j-1)*n+(k+1)%n
                f.extend([[lo,lo+n,nx],[nx,lo+n,nx+n]])
    for k in range(1,n-1):f.extend([[0,k,k+1],[(len(levels)-1)*n,(len(levels)-1)*n+k+1,(len(levels)-1)*n+k]])
    return np.array(v),np.array(f),np.array(cs)

def arch(rng,span,height,depth):
    # Asymmetric sandstone rib with a broad buttress, thinner crown and a wave-cut passage.
    axis=np.array([[-.57,0],[-.57,.21],[-.48,.42],[-.46,.67],[-.31,.83],[-.12,.91],[.09,1.0],[.25,.99],[.38,.73],[.43,.45],[.53,.23],[.62,0]])
    v=[];c=[];f=[]
    n=10
    for i,(x,y) in enumerate(axis):
        tangent=axis[min(i+1,len(axis)-1)]-axis[max(0,i-1)]
        tangent*=np.array([span,height]);tangent/=np.linalg.norm(tangent)
        normal=np.array([-tangent[1],tangent[0]])
        radius=(.11+.19*(1-y)**1.6+(.12 if i<4 or i in (7,8) else 0))*height
        for j in range(n):
            a=2*pi*j/n
            rr=radius*(1+.20*np.sin(j*3.7+i*.79))
            xy=np.array([x*span,y*height])+normal*rr*np.cos(a)
            v.append([xy[0],xy[1],depth*(.70+.45*(1-y))*np.sin(a)+depth*.35*np.sin(x*4)])
            c.append(np.array([.415,.25,.143])*(.88+.15*np.cos(a)+.075*np.sin(xy[1]/11)))
        if i:
            for j in range(n):
                lo=(i-1)*n+j;nx=(i-1)*n+(j+1)%n
                f.extend([[lo,nx,lo+n],[nx,nx+n,lo+n]])
    for j in range(1,n-1):f.extend([[0,j+1,j],[(len(axis)-1)*n,(len(axis)-1)*n+j,(len(axis)-1)*n+j+1]])
    v=np.array(v);f=np.array(f)
    tri=v[f]
    if np.einsum('ij,ij->i',tri[:,0],np.cross(tri[:,1],tri[:,2])).sum()<0:f=f[:,::-1]
    return v,f,np.array(c)

def solid_details(kind,w,sample,rng,mat):
    along,out=basis(kind)
    occupied=[];verts=[];faces=[];cols=[];offset=0
    def place(shape,u,delta,role,ice=False):
        nonlocal offset
        v,f,c=shape
        cen=along*u+out*(shoreline(kind,np.array([u]))[0]+delta)
        # Footprint clearance counts the actual transformed mesh.
        xy=cen+v[:,0,None]*along+v[:,2,None]*out
        if (xy@NORMALS.T).max()>A-8:return False
        radius=np.max(np.linalg.norm(xy-cen,axis=1))
        if any(np.linalg.norm(cen-p)<radius+r for p,r in occupied):return False
        ground=float(sample(cen[None])[0])
        if not np.isfinite(ground):return False
        if role=='arch':
            foot=v[:,1]<np.percentile(v[:,1],16)
            h=float(np.min(sample(xy[foot])))-8
        elif ice:
            h=SEA-.34*v[:,1].max()
            if np.max(sample(xy))>h-3:return False
        else:h=float(np.min(sample(xy)))-4
        v=np.column_stack([xy[:,0],v[:,1]+h,xy[:,1]])
        if role=='arch':
            add_mesh(w,'Arco de abrasão '+str(len(occupied)),v,f,c,np.column_stack([(v[:,0]+v[:,2]*.4)/140,v[:,1]/90]),mat,'arch')
        else:
            faces.append(f+offset);verts.append(v);cols.append(c);offset+=len(v)
        occupied.append((cen,radius))
        return True
    if kind in ('arcos','falesia'):
        specs=[(-290,270,670,318,102),(875,154,370,168,73),(-1110,320,250,133,62)] if kind=='arcos' else [(-870,80,415,178,78)]
        for u,d,span,h,dep in specs:
            assert place(arch(rng,span,h,dep),u,d,'arch')
    cold=kind=='glacial'
    for _ in range({'glacial':71,'praia':28,'dunas':21,'falesia':58,'arcos':55}[kind]):
        u=rng.uniform(-1980,1980);d=rng.uniform(105,1000) if cold else rng.uniform(-70,430)
        s=rng.uniform(25,85)
        h=s*rng.uniform(.55,1.55)
        if kind=='falesia':h+=90
        if kind=='arcos':h+=60
        if cold and rng.random()<.30:s*=1.65;h*=2.8
        place(rock(rng,s,s*rng.uniform(.52,1.28),h,cold),u,d,'rock',cold)
    if verts:
        v=np.vstack(verts)
        add_mesh(w,'Gelo à deriva' if cold else 'Afloramentos',v,np.vstack(faces),np.vstack(cols),
                 np.column_stack([(v[:,0]+.4*v[:,2])/93,v[:,1]/69+v[:,2]/370]),mat,'ice' if cold else 'rock')
    return len(occupied)

def plant_prototypes(kind):
    if kind=='falesia':
        path=WORLD/'tropical-south-v01/vegetation/JS_-3_13.glb'
    elif kind=='praia':
        path=WORLD/'hunters-village-v01/models/hv_01_forest.glb'
    else:
        g=GLB(source(CELLS[(4,6)]))
        parts=module.components(g,'shrubs')
        out=[]
        for v,f,c in sorted(parts,key=lambda m:-len(m[1]))[:3]:
            v=v.copy();v[:,0]-=v[:,0].mean();v[:,2]-=v[:,2].mean();v[:,1]-=v[:,1].min()
            out.append(('Moita de savana '+str(len(out)),v,f,c))
        return out
    g=GLB(path);out=[]
    for m in g.doc['meshes']:
        if kind=='praia' and 'Folhosa' not in m['name']:continue
        pr=m['primitives'][0];at=pr['attributes']
        out.append((m['name'],g.array(at['POSITION']).astype(float),g.array(pr['indices']).reshape(-1,3),g.array(at['COLOR_0'])[:,:3]))
    return out

def vegetation(kind,w,sample,rng):
    if kind not in ('praia','falesia','arcos'):return 0
    models=plant_prototypes(kind)
    ext='EXT_mesh_gpu_instancing';w.d.update(extensionsRequired=[ext],extensionsUsed=[ext])
    pos=rng.uniform(-2450,2450,({'praia':1200,'falesia':4400,'arcos':2100}[kind],2))
    inside=(pos@NORMALS.T).max(1)<A-95
    pos=pos[inside];h=sample(pos)
    along,out=basis(kind);k=shoreline(kind,pos@along)-pos@out
    gradient=np.hypot((sample(pos+[2,0])-h)/2,(sample(pos+[0,2])-h)/2)
    keep=(k>({'praia':288,'falesia':86,'arcos':254}[kind]))&(gradient<.66)&(h>SEA+24)
    pos=pos[keep];h=h[keep]
    selection=rng.integers(len(models),size=len(h))
    for i,(name,v,f,c) in enumerate(models):
        mask=selection==i;n=mask.sum()
        if not n:continue
        xy=pos[mask];yaw=rng.uniform(0,pi,n);scale=rng.uniform(.72,1.18,n)
        clearance=A-(xy@NORMALS.T).max(1)
        take=clearance>np.max(np.linalg.norm(v[:,[0,2]],axis=1))*scale+1
        xy,yaw,scale,alt=xy[take],yaw[take],scale[take],h[mask][take]
        n=len(xy)
        if not n:continue
        mesh=w.mesh(name,v,f,c);pr=w.d['meshes'][mesh]['primitives'][0]
        pr['attributes']['TEXCOORD_0']=uv_attribute(w,v[:,[0,2]]/45)
        attrs=dict(TRANSLATION=w.acc(np.column_stack([xy[:,0],alt-.15,xy[:,1]]).astype('<f4'),5126,bounds=True),
            ROTATION=w.acc(np.column_stack([np.zeros(n),np.sin(yaw),np.zeros(n),np.cos(yaw)]).astype('<f4'),5126),
            SCALE=w.acc(np.repeat(scale[:,None],3,axis=1).astype('<f4'),5126))
        w.node(name=name,mesh=mesh,extensions={ext:{'attributes':attrs}},extras=dict(role='vegetation'))
    return sum(w.d['accessors'][n['extensions'][ext]['attributes']['TRANSLATION']]['count'] for n in w.d['nodes'] if ext in n.get('extensions',{}))

def textures(kind,sample,recs,rng):
    size=768
    u=(np.arange(size)+.5)*5000/size-2500
    x,z=np.meshgrid(u,u);p=np.column_stack([x.ravel(),z.ravel()])
    h=np.nan_to_num(sample(p)-SEA,nan=-220).reshape(x.shape)
    noise=rng.normal(size=x.shape)
    broad=gaussian_filter(noise,12)*33
    grain=gaussian_filter(noise,1.4)*4.5
    if kind=='glacial':
        detail=253+1.4*grain+.6*broad
    elif kind=='dunas':
        detail=254+grain*.8
    elif kind=='arcos':
        # The source savanna has untextured vertex albedo. Bedding belongs on the tidal benches.
        bench=1-smooth((h-32)/65)
        detail=254+grain*.75+bench*(-16+8*np.sin(h/6.4+x/330+z/470))
    elif kind=='falesia':
        strata=np.sin(h/6.4+x/330+z/470+.42*broad)
        detail=231+9*strata+6*broad+7*grain-16*np.maximum(0,strata)**7
    else:
        detail=241+4*broad+4*grain+6*np.sin(x/10+z/23+2*np.sin(z/157)+.52*broad)
    dist=np.full(len(p),1e6)
    for rec in recs:
        v=p-rec['a'];s=np.clip(v@rec['axis'],0,2500)
        dist=np.minimum(dist,np.linalg.norm(v-s[:,None]*rec['axis'],axis=1))
    detail=255+(detail-255)*smooth((dist.reshape(h.shape)-10)/150)
    texture=np.uint8(np.clip(detail,0,255))
    depth=np.uint8(np.clip((h+256)/640*255,0,255).round())
    depth_name=kind+('-depth-v02.png' if kind in REVISED else '-depth.png')
    Image.fromarray(depth).resize((384,384),Image.Resampling.BILINEAR).save(ROOT/'viewer'/depth_name)
    return texture

def build(kind):
    rng=np.random.default_rng(710811+list(PILOTS).index(kind))
    v,f,c,recs=build_ground(kind,rng)
    sample=LinearNDInterpolator(v[:,[0,2]],v[:,1])
    w=Writer();w.d['asset']['generator']='Wildhaven | Litoral V01'
    w.d['materials'][0]['name']='Vegetação local'
    tex=textures(kind,sample,recs,rng)
    mat=material(w,'Substrato · '+kind,tex)
    add_mesh(w,'terrain',v,f,c,(v[:,[0,2]]+2500)/5000,mat,'terrain')
    # Separate repeating detail follows vertical bedding on stacks and arches.
    t=np.arange(256);x,y=np.meshgrid(t,t)
    field=np.sin(y*2*pi/27+1.8*np.sin(x*2*pi/256))
    rocktex=230+10*field+7*rng.normal(size=x.shape)-12*np.maximum(field,0)**8
    stone=material(w,'Gelo fraturado' if kind=='glacial' else 'Rocha estratificada',np.uint8(rocktex.clip(0,255)))
    landforms=solid_details(kind,w,sample,rng,stone)
    plants=vegetation(kind,w,sample,rng)
    revision='v02' if kind in REVISED else 'v01'
    path=ROOT/'models'/(kind+'-'+revision+'.glb')
    w.save(path)
    q,r=PILOTS[kind];along,out=basis(kind)
    return dict(id=kind,q=q,r=r,center_xz=center(q,r).tolist(),out=out.tolist(),along=along.tolist(),model='models/'+path.name,
                depth='viewer/'+kind+('-depth-v02.png' if kind in REVISED else '-depth.png'),neighbors=[t['tile']['id'] for t in recs],plants=plants,landforms=landforms)

if __name__=='__main__':
    (ROOT/'models').mkdir(exist_ok=True)
    records=json.loads((ROOT/'prototipos.json').read_text('utf8'))['tiles']
    for i,row in enumerate(records):
        if row['id'] in REVISED:
            records[i]=build(row['id'])
            print(row['id'],records[i]['plants'],flush=True)
    dump(ROOT/'prototipos.json',dict(water=WATER,tiles=records))
