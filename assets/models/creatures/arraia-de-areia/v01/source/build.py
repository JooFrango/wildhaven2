#!/usr/bin/env python3
"""Wildhaven / Arraia-de-Areia v01 -- anatomical, faceted UV-painted static GLB.

A single authored UV/PBR material. Color patches, surface scale marks, striations
are raster-pixel paint, never separate meshes to represent color. Geometry is
reserved for the mantle, mouth cavity, keratin filters, head guards, orbits,
two forward digging tusks, central defensive osteoderms, tail and tail spines.
X is forward, Y vertical, Z right/left wingspan. No rig/animation at this stage.
"""
from __future__ import annotations
import json, math, hashlib, struct
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import trimesh
from trimesh.visual.texture import TextureVisuals
from trimesh.visual.material import PBRMaterial

ROOT=Path(__file__).resolve().parent.parent
TEX=ROOT/'textures'/'arraia-de-areia-v01-albedo-pintado-uv.png'
GLB=ROOT/'arraia-de-areia-v01-blockout-texturizado.glb'
RNG=np.random.default_rng(112026)


def paint_texture():
    """Original 2048² hand-authored procedural raster brush painting; no color meshes.

    The algorithm composes palette masks, eroded daubs, sinew striations,
    mineral abrasion, and freckled dorsal spots as 2D pigment. The UV atlas
    assigns top mantle to v=[.45,.97], belly v=[.20,.43], details v=[.02,.17].
    """
    W=H=2048
    yy,xx=np.indices((H,W))
    u=xx/(W-1);v=1-yy/(H-1)  # glTF V, PIL is inverted
    def smooth_noise(n,scale):
        img=Image.fromarray(RNG.integers(0,256,(n,n),dtype=np.uint8),'L')
        return (np.asarray(img.resize((H,W),Image.Resampling.BICUBIC),dtype=np.float32)-127.5)/127.5*scale
    n1=smooth_noise(18,1);n2=smooth_noise(62,.7);n3=smooth_noise(200,.35)
    grain=RNG.normal(0,1,(H,W)).astype('float32')
    z=np.abs(2*u-1)
    # palette indexed by UV regions; dorsal texture is strongly symmetric in macroform, unique in microdetails
    top=(v>.45)
    belly=(v>.19)&(v<.445)
    detail=~top&~belly
    base=np.empty((H,W,3),dtype='float32');base[...] = (139,91,55)
    t=np.clip((v-.45)/.52,0,1)  # t=0 trailing edge, t=1 front
    # ochre/rust broad natural mineral bands along wing trailing to frontal leading edge
    base[:,:,0]=141+29*t-18*z
    base[:,:,1]=94+19*t-15*z
    base[:,:,2]=58+12*t-8*z
    # Deep stripe patterns at different diagonals; only paint, never silhouette geometry
    s=np.sin(2*math.pi*(t*2.0+z*.38 + .055*n1))
    band=np.clip((s-.15)*2.3,0,1) * (0.8+0.2*(1-z))
    stripe=np.sin(2*math.pi*(t*4.0-z*.32 + .05*n2))
    band2=np.clip((stripe-.53)*1.7,0,1)
    darkness=(band*.56+band2*.18)
    # Middle dark dorsal spine stripe and delicate copper-mottled wing spot-cloud
    darkness+=np.clip(1-z*6.3,0,1)*.22
    base[:,:,0]-=darkness*68
    base[:,:,1]-=darkness*63
    base[:,:,2]-=darkness*48
    # Painted bright scalloped leading rim
    rim=np.clip((t-.90)*10,0,1)*(0.75-0.3*z)
    for i,boost in enumerate([47,38,25]):base[:,:,i]+=rim*boost
    # Pixel-level rough painted patches (non-geometric)
    for i,boost in enumerate([15,11,7]):base[:,:,i]+=(n1*.8+n2*.75+n3*.6+grain*.18)*boost
    # underside with gill striations, sun-bleached bone and warm sandstone grains
    vlow=np.clip((v-.19)/.26,0,1)
    underside=np.stack([204-12*vlow,173-11*vlow,131-9*vlow],axis=-1)
    gill_lines=(np.abs(np.sin(2*math.pi*(u*13.5+.08*np.sin(vlow*10))))>.956)&(z<.60)&(vlow>.27)&(vlow<.81)
    underside[gill_lines]*=.79
    underside+=(n1[:,:,None]*7+n2[:,:,None]*5+grain[:,:,None]*2)
    base[belly]=underside[belly]
    # extra functional swatches, one atlas/material, not extra objects for pigment
    base[detail]=np.array([163,112,74],dtype=np.float32)
    def swatch(lo,hi,rgb):
        mask=(v>=lo)&(v<hi)
        base[mask]=rgb
        base[mask]+=((n2+grain*.3)*11)[mask,None]
    swatch(.02,.040,[34,26,24])     # recessed interior mouth + pupils
    swatch(.043,.065,[221,179,114]) # keratin filtres and tusk tips
    swatch(.070,.092,[98,66,43])    # orbital ridge and osteoderms
    swatch(.096,.119,[176,111,63])  # armored spines and tail
    swatch(.123,.148,[177,122,68])  # sandy-fin tissue
    swatch(.152,.175,[185,113,52])  # amber iris/other accents
    arr=np.uint8(np.clip(base,0,255))
    im=Image.fromarray(arr,'RGB')
    # softer asymmetrical natural irregular ochre/umber freckling across dorsal atlas
    paint=Image.new('RGBA',(W,H),(0,0,0,0));dr=ImageDraw.Draw(paint,'RGBA')
    for k in range(400):
        px=int(RNG.uniform(22,W-22));py=int(RNG.uniform(65,H*.535))
        radius=RNG.uniform(3,30) if k%5 else RNG.uniform(20,71)
        rx=radius*(.8+RNG.random()*.6);ry=radius*(.28+RNG.random()*.55)
        tone=RNG.random()
        col=(53,38,29,int(RNG.uniform(24,115))) if tone<.68 else (239,187,107,int(RNG.uniform(25,85)))
        points=[]
        for j in range(9):
            a=2*math.pi*j/9
            rr=RNG.uniform(.78,1.22)
            points.append((px+math.cos(a)*rx*rr,py+math.sin(a)*ry*rr))
        dr.polygon(points,fill=col)
    paint=paint.filter(ImageFilter.GaussianBlur(2.2))
    im=Image.alpha_composite(im.convert('RGBA'),paint)
    # painted scale flecks and abrasion hatch strokes over dorsal surface
    marks=Image.new('RGBA',(W,H));dm=ImageDraw.Draw(marks,'RGBA')
    for k in range(2600):
        px=int(RNG.uniform(15,2030));py=int(RNG.uniform(55,1120))
        r=RNG.uniform(1,4)
        if RNG.random()<.65:
            dm.arc((px-r*2,py-r,px+r*2,py+r),5,130,fill=(29,26,24,52),width=1)
        else:
            dl=RNG.uniform(3,19)
            dm.line((px,py,px+dl,py+RNG.uniform(-3,3)),fill=(246,200,141,60),width=1)
    im=Image.alpha_composite(im,marks).convert('RGB')
    im.save(TEX,optimize=True)
    return im


class MeshBuilder:
    def __init__(self):self.vertices=[];self.faces=[];self.uv=[];self.parts={}
    def tri(self,p,q,r,tp,tq,tr,name):
        i=len(self.vertices)
        self.vertices.extend([p,q,r]);self.uv.extend([tp,tq,tr]);self.faces.append((i,i+1,i+2))
        self.parts[name]=self.parts.get(name,0)+1
    def quad(self,p,q,r,s,tp,tq,tr,ts,name):
        self.tri(p,q,r,tp,tq,tr,name);self.tri(p,r,s,tp,tr,ts,name)
    def fin_uv(self,z,t,top):
        u=.015+.97*(z/18+0.5)
        if top:return(u,.46+.50*t)
        return(u,.205+.22*t)
    def top(self,z,t):
        w=abs(z/9)
        xf=6.35-8.65*w**1.7
        xb=-4.30+1.9*w**1.2
        x=xf*(1-t)+xb*t
        # strong spinal dome and transverse biomechanical radial spars
        hump=1.05*math.exp(-((x-0.4)/3.0)**2)*(1-w)**3.5
        keel=.35*math.exp(-(w/.11)**2)*(0.7+0.3*math.cos((x+1)*.4))
        camber=.33*math.sin(math.pi*t)*(1-w)**.8
        wingtip=1.88*w**5.3
        wave=.13*math.sin((t-.45)*math.pi)*w**1.4
        y=2.05+hump+keel+camber+wingtip+wave
        thickness=.085+1.05*(1-w**1.32)**1.5*(.72+.28*math.sin(math.pi*t))
        return (x,y,z),thickness
    def mantle(self,Nu=28,Nz=47):
        zs=np.linspace(-9,9,Nz)
        ts=np.linspace(0,1,Nu)
        # top & underside continuous meshes; vertex normals deliberately flat
        for upper in [True,False]:
            for j in range(Nz-1):
                za,zb=zs[j:j+2]
                for k in range(Nu-1):
                    ta,tb=ts[k:k+2]
                    p00,h00=self.top(za,ta);p01,h01=self.top(za,tb)
                    p10,h10=self.top(zb,ta);p11,h11=self.top(zb,tb)
                    def height(p,h):return p if upper else (p[0],p[1]-h,p[2])
                    a,b,c,d=height(p00,h00),height(p10,h10),height(p11,h11),height(p01,h01)
                    ap,bp,cp,dp=[self.fin_uv(z,t,upper) for z,t in [(za,ta),(zb,ta),(zb,tb),(za,tb)]]
                    if upper:self.quad(a,b,c,d,ap,bp,cp,dp,'dorsal_mantle')
                    else:self.quad(a,d,c,b,ap,dp,cp,bp,'ventral_mantle')
            # rim and trailing edge are actual thin wedge geometry, not color polygons
        for j in range(Nz-1):
            for t in [0,1]:
                z0,z1=zs[j:j+2];p,h=self.top(z0,t);q,g=self.top(z1,t)
                self.quad(p,q,(q[0],q[1]-g,q[2]),(p[0],p[1]-h,p[2]),
                          self.fin_uv(z0,t,True),self.fin_uv(z1,t,True),
                          self.fin_uv(z1,t,False),self.fin_uv(z0,t,False),'leading_trailing_wing_edge')
        for z in (-9,9):
            for k in range(Nu-1):
                t0,t1=ts[k:k+2];p,h=self.top(z,t0);q,g=self.top(z,t1)
                self.quad(p,q,(q[0],q[1]-g,q[2]),(p[0],p[1]-h,p[2]),
                          self.fin_uv(z,t0,True),self.fin_uv(z,t1,True),
                          self.fin_uv(z,t1,False),self.fin_uv(z,t0,False),'wing_tip_edge')
    def ring_tube(self,name,sections,sides=9,band=(.10,.145),ends=True):
        # (x, y, z, radiusY, radiusZ), with optional non-round narrowing
        for i in range(len(sections)-1):
            a=sections[i];b=sections[i+1]
            for j in range(sides):
                th0=2*math.pi*j/sides;th1=2*math.pi*(j+1)/sides
                def p(sec,t):return (sec[0],sec[1]+sec[3]*math.cos(t),sec[2]+sec[4]*math.sin(t))
                pts=[p(a,th0),p(a,th1),p(b,th1),p(b,th0)]
                t0=band[0]+(band[1]-band[0])*j/sides
                t1=band[0]+(band[1]-band[0])*(j+1)/sides
                # flat material swatch by v, low variations in u per section
                ta=[(.13+.35*i/len(sections),t0),(.13+.35*i/len(sections),t1),
                    (.13+.35*(i+1)/len(sections),t1),(.13+.35*(i+1)/len(sections),t0)]
                self.quad(*pts,*ta,name)
        if ends:
            for i in [0,len(sections)-1]:
                s=sections[i];center=(s[0],s[1],s[2]);q=(.21,sum(band)*.5)
                for j in range(sides):
                    a=2*math.pi*j/sides;b=2*math.pi*(j+1)/sides
                    p=(s[0],s[1]+s[3]*math.cos(a),s[2]+s[4]*math.sin(a))
                    r=(s[0],s[1]+s[3]*math.cos(b),s[2]+s[4]*math.sin(b))
                    self.tri(center,p,r,q,q,q,name)
    def spike(self,x,y,z,base_length,height,width,tip_dx,name,swatch=.083):
        # 3D four-sided beveled osteoderm: protective structure on dorsal keel.
        A=(x-base_length*.48,y-.09,z-width*.48)
        B=(x+base_length*.43,y-.09,z-width*.45)
        C=(x+base_length*.37,y-.09,z+width*.45)
        D=(x-base_length*.48,y-.09,z+width*.45)
        E=(x+tip_dx,y+height,z)
        uv=[(.22,swatch),(.34,swatch),(.29,swatch),(.19,swatch),(.27,swatch)]
        for indices in [(0,1,4),(1,2,4),(2,3,4),(3,0,4)]:
            self.tri(*[ [A,B,C,D,E][n] for n in indices],*[uv[n] for n in indices],name)
        self.quad(A,D,C,B,uv[0],uv[3],uv[2],uv[1],name)
    def mantletop(self,x,z):
        # reconstruct actual top height for anchoring details
        w=abs(z/9)
        xf=6.35-8.65*w**1.7;xb=-4.30+1.9*w**1.2
        t=np.clip((xf-x)/(xf-xb),0,1)
        return self.top(z,t)[0][1]
    def brow(self,sign):
        # A small anatomical inset eye, contained by a raised arc of bone.
        # The color of iris and eyelid is still from UV pigment, not added color meshes.
        x=4.05; z=1.52*sign; y=self.mantletop(x,z)
        rim=[(x-.48,y+.065,z-.26*sign),(x+.30,y+.095,z-.26*sign),
             (x+.39,y+.23,z+.19*sign),(x-.31,y+.26,z+.23*sign)]
        self.quad(*rim,*( [(.28,.110)]*4 ),'orbital_bony_brow')
        # Eye has a narrow almond silhouette, flush in the bony outer socket.
        center=(x+.00,y+.255,z+.27*sign)
        left=(x-.19,y+.24,z+.27*sign);right=(x+.21,y+.24,z+.27*sign)
        top=(x+.012,y+.35,z+.29*sign);bottom=(x+.01,y+.185,z+.32*sign)
        self.tri(left,right,top,*([(.49,.163)]*3),'eye_inset')
        self.tri(left,bottom,right,*([(.49,.163)]*3),'eye_inset')
        # A short narrow slit, not a square pupil painted onto the head.
        self.tri((x+.024,y+.307,z+.315*sign),(x+.058,y+.205,z+.35*sign),
                 (x-.006,y+.195,z+.345*sign),*([(.42,.025)]*3),'pupil_recess')
    def face(self):
        # mouth is a real recessed cavity, not just a flat dark color patch
        x=6.00
        # upper jaw brim and lower forward filtering jaw built to encase opening
        top_lip=[(x+.22,1.96,-2.14),(x+.58,2.05,-1.35),(x+.71,2.08,0),(x+.58,2.05,1.35),(x+.22,1.96,2.14)]
        bot_lip=[(x+.03,1.14,-2.03),(x+.31,1.00,-1.25),(x+.36,.94,0),(x+.31,1.00,1.25),(x+.03,1.14,2.03)]
        # black opening is set BACK along X, framed by lips (anatomical geometry)
        recess=[(p[0]-.28,p[1]-.03,p[2]*.97) for p in top_lip]
        recess2=[(p[0]-.33,p[1]+.06,p[2]*.94) for p in bot_lip]
        for k in range(4):
            # dark cavity quad
            self.quad(recess[k],recess[k+1],recess2[k+1],recess2[k],
                      *([(.43,.028)]*4),'mouth_cavity')
            self.quad(top_lip[k],top_lip[k+1],recess[k+1],recess[k],
                      *([(.51,.137)]*4),'upper_jaw_brim')
            self.quad(bot_lip[k],recess2[k],recess2[k+1],bot_lip[k+1],
                      *([(.48,.138)]*4),'lower_jaw_lip')
        # upper lip has comb-like large keratin filaments for sifting organic debris
        for z in np.linspace(-1.95,1.95,17):
            a=(6.30,1.89,z);b=(6.43,1.27,z-.045)
            self.ring_tube('filtering_keratin_barb',[
                (a[0],a[1],a[2],.046,.075),
                (6.53,1.55,z-.02,.046,.058),
                (b[0],b[1],b[2],.009,.016)],5,band=(.047,.060))
        # two large, curved mineralized digging tusks, distinct from cosmetic strokes
        for sg in [-1,1]:
            z=2.49*sg
            self.ring_tube('front_sand_tusk',[
                (5.12,2.12,z,.40,.38),
                (5.72,1.89,z+.20*sg,.31,.26),
                (6.45,1.52,z+.25*sg,.22,.18),
                (6.98,1.21,z+.30*sg,.10,.09),
                (7.23,1.10,z+.31*sg,.016,.016)],8,band=(.047,.065))
            self.brow(sg)
    def spine_chain(self):
        # dorsal protective armature; radial supports taper into thoracic disc
        for i,x in enumerate(np.linspace(2.4,-3.6,8)):
            top=self.mantletop(x,0)
            h=(.48+.27*math.sin(i/7*math.pi))
            self.spike(x,top,.0,.80,h,.74,-.20,'medial_osteoderm',swatch=.080)
        for s in [-1,1]:
            for i in range(4):
                z=s*(.65+i*.66);x=1.65-.53*i
                self.spike(x,self.mantletop(x,z),z,.70,.21+.08*(1-i/4),.55,-.19,'scapular_support',swatch=.079)
    def tail(self):
        # tail must remain a continuous taper from the disc, not pipe with separate base
        sections=[(-3.8,2.25,0,.46,.65),(-4.65,2.24,0,.39,.47),(-5.7,2.27,0,.32,.35),
                  (-6.9,2.38,0,.23,.26),(-8.1,2.57,0,.20,.19),(-9.3,2.87,0,.16,.16),
                  (-10.55,3.23,0,.13,.12),(-11.85,3.9,0,.085,.075),(-12.35,4.4,0,.02,.02)]
        self.ring_tube('flexible_muscular_tail',sections,sides=10,band=(.104,.142))
        for i,x in enumerate(np.linspace(-4.68,-11.0,9)):
            y=float(np.interp(x,np.array([a[0] for a in sections])[::-1],np.array([a[1]+a[3] for a in sections])[::-1]))
            self.spike(x,y-.025,0,.52,.36*(1-i/12),.26,-.16,'tail_defensive_spines',swatch=.087)
        # terminal upturned diamond-shaped stabilizer sail, actually functional silhouette
        ps=[(-11.62,3.73,-.09),(-12.6,5.35,0),(-11.85,5.22,0),(-11.58,4.20,.18),(-11.58,4.20,-.18)]
        self.tri(ps[0],ps[1],ps[3],(.25,.109),(.3,.11),(.35,.12),'tail_fin')
        self.tri(ps[0],ps[4],ps[1],(.25,.109),(.35,.12),(.3,.11),'tail_fin')
    def create(self):
        self.mantle()
        self.face()
        self.spine_chain()
        self.tail()
        return self


def parse_glb_binary(blob):
    assert blob[:4]==b'glTF'
    assert struct.unpack_from('<I',blob,8)[0]==len(blob)
    n=struct.unpack_from('<I',blob,12)[0]
    return json.loads(blob[20:20+n])


def main():
    TEX.parent.mkdir(parents=True,exist_ok=True)
    paint_texture()
    builder=MeshBuilder().create()
    print('authoring triangle groups:',builder.parts)
    # Retain hard-facet normals by splitting vertices by triangle (1 mesh and 1 material)
    v=np.asarray(builder.vertices,dtype=np.float32);faces=np.asarray(builder.faces,dtype=np.int64)
    uv=np.asarray(builder.uv,dtype=np.float32)
    m=trimesh.Trimesh(vertices=v,faces=faces,process=False)
    material=PBRMaterial(name='ArraiaDeAreia_AtlasUV_Pintado',baseColorTexture=Image.open(TEX),
                         baseColorFactor=[1.,1.,1.,1.],metallicFactor=0,roughnessFactor=.92,doubleSided=True)
    m.visual=TextureVisuals(uv=uv,material=material)
    scene=trimesh.Scene();scene.add_geometry(m,geom_name='ArraiaDeAreia_v01_Static_ArtReview')
    blob=scene.export(file_type='glb')
    GLB.write_bytes(blob)
    r=trimesh.load(GLB,force='scene',process=False)
    parts=list(r.geometry.values())
    triangles=sum(len(g.faces) for g in parts)
    assert triangles==len(faces) and 4000<triangles<7500
    assert len(parts)==1 and all(len(g.visual.uv)==len(g.vertices) for g in parts)
    meta=parse_glb_binary(blob)
    assert len(meta.get('materials',[]))==1
    assert len(meta.get('textures',[]))==1 and len(meta.get('images',[]))==1
    assert not meta.get('animations') and not meta.get('skins')
    assert 'TEXCOORD_0' in meta['meshes'][0]['primitives'][0]['attributes']
    # Verify that GLB PNG contains the original raster painting byte for byte
    img=meta['images'][0];bv=meta['bufferViews'][img['bufferView']]
    json_end=20+struct.unpack_from('<I',blob,12)[0]
    bin_header=json_end;bin_length=struct.unpack_from('<I',blob,bin_header)[0]
    chunk=blob[bin_header+8:bin_header+8+bin_length]
    png=chunk[bv.get('byteOffset',0):bv.get('byteOffset',0)+bv['byteLength']]
    from PIL import Image as PILImage
    import io
    tex=Image.open(TEX);tex_glb=PILImage.open(io.BytesIO(png))
    assert tex_glb.size==(2048,2048) and np.array_equal(np.asarray(tex),np.asarray(tex_glb))
    mini=np.asarray(r.bounds)
    rec={
      'project':'Wildhaven','species':'Arraia-de-Areia','id':'arraia-de-areia','version':'v01',
      'status':{'concept':'approved_by_user','blockout_artistic_review':'pending','integration':'not_in_game'},
      'stage':'static_UV_painted_anatomical_blockout',
      'model':'arraia-de-areia-v01-blockout-texturizado.glb',
      'texture':'textures/arraia-de-areia-v01-albedo-pintado-uv.png',
      'texture_embedded':True,'texture_resolution':[2048,2048],
      'materials':len(meta['materials']),'meshes':len(parts),'triangles':triangles,
      'vertices_flat_shaded':len(v),'joints':0,'skins':0,'animation_clips':0,'lods':0,
      'bytes_glb':len(blob),'sha256_glb':hashlib.sha256(blob).hexdigest(),
      'bytes_texture':TEX.stat().st_size,'sha256_texture':hashlib.sha256(TEX.read_bytes()).hexdigest(),
      'bounds_m':mini.round(3).tolist(),
      'approx_wingspan_m':float(mini[1,2]-mini[0,2]),
      'approx_length_m':float(mini[1,0]-mini[0,0]),
      'textures_are_paint_only':True,'color_patches_extra_meshes':0,
      'feature_triangle_groups':builder.parts,
      'render_source':'VTK vtkGLTFImporter loads exported real GLB'}
    (ROOT/'manifest.json').write_text(json.dumps(rec,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:rec[k] for k in ['triangles','materials','meshes','bytes_glb','sha256_glb','bounds_m','approx_wingspan_m','approx_length_m']},indent=2))

if __name__=='__main__':main()
