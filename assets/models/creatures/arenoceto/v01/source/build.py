#!/usr/bin/env python3
"""Wildhaven Arenoceto v01: original UV-textured, static faceted blockout.
X forward, Y up, Z lateral. Generated coloration is raster texture only.
No rig, no animation, no LODs by design: artistic silhouette checkpoint.
"""
import math, json, hashlib
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import trimesh
from trimesh.visual.texture import TextureVisuals
from trimesh.visual.material import PBRMaterial

ROOT=Path(__file__).resolve().parent.parent
TEX=ROOT/'textures'/'arenoceto-v01-handpaint-atlas.png'
GLB=ROOT/'arenoceto-v01-textured-blockout.glb'
RNG=np.random.default_rng(20261109)

# Paint a reproducible diffuse image atlas. Pigment/mottling is confined to pixels:
# NOT represented as extra polygons, normals or separate geometry.
def paint_atlas():
    w=h=1024
    yy,xx=np.mgrid[:h,:w]
    v=1-yy/h
    low=RNG.normal(0,1,(128,128)).astype('float32')
    mid=RNG.normal(0,1,(256,256)).astype('float32')
    def stretch(a,sz):
        return np.asarray(Image.fromarray(a).resize((sz,sz),Image.Resampling.BILINEAR),dtype='float32')
    noise=stretch(low,w)*0.53+stretch(mid,w)*.22+RNG.normal(0,.19,(h,w))
    arr=np.zeros((h,w,3),dtype=np.float32)
    # main body, bands at atlas v=.06..65; sand-whale pale undersurface
    belly=(np.cos(2*np.pi*(v-.06)/.59)<-.23).astype(float)
    # soften the hand-painted boundary between ochre sides and cream underside
    mix=np.clip((-np.cos(2*np.pi*(v-.06)/.59)-.02)*1.65,0,1)
    sand=np.array([158,101,57]); pale=np.array([204,166,117])
    arr[:,:,:]=(sand[None,None,:]*(1-mix[:,:,None]) + pale[None,None,:]*mix[:,:,None])
    arr+=noise[:,:,None]*16
    im=Image.fromarray(np.uint8(np.clip(arr,0,255)),'RGB')
    stains=Image.new('RGBA',(w,h),(0,0,0,0)); dr=ImageDraw.Draw(stains,'RGBA')
    # organic pigment blooms: broad uneven daubs; all done with raster painting
    for k in range(100):
        px=int(RNG.uniform(50,980)); py=int(RNG.uniform(h*.37,h*.92))
        rx=int(RNG.uniform(10,62)); ry=int(RNG.uniform(4,22))
        if py>h*.75 and RNG.random()<.7: continue
        col=(75,45,31,int(RNG.uniform(19,66))) if RNG.random()<.66 else (241,193,129,int(RNG.uniform(25,65)))
        pts=[(px+int(math.cos(a)*rx*RNG.uniform(.8,1.2)),py+int(math.sin(a)*ry*RNG.uniform(.7,1.35))) for a in np.linspace(0,2*math.pi,10)[:-1]]
        dr.polygon(pts,fill=col)
    stains=stains.filter(ImageFilter.GaussianBlur(3.2)); im=Image.alpha_composite(im.convert('RGBA'),stains)
    # fine directional scuffs and pale scratches along back/flanks painted on top
    scratch=Image.new('RGBA',(w,h)); d=ImageDraw.Draw(scratch,'RGBA')
    for k in range(100):
        x=int(RNG.uniform(10,1010));y=int(RNG.uniform(390,875))
        L=RNG.integers(4,32)
        d.line((x,y,x+L,y+RNG.integers(-4,5)),fill=(50,35,27,80),width=int(RNG.choice([1,1,2,3])))
    im=Image.alpha_composite(im,scratch)
    # atlas stripes for armored plates and lateral fins; painterly pixel variation
    pix=np.array(im.convert('RGB'),dtype=np.uint8)
    y_arm=(v>.70)&(v<.81)
    y_fin=(v>.82)&(v<.925)
    for mask,base in [(y_arm,[100,65,42]),(y_fin,[176,114,64])]:
        jitter=(noise*20 + np.sin(xx/18)*7 + np.sin((xx+yy)/36)*7)
        for c in range(3): pix[:,:,c][mask]=np.uint8(np.clip(base[c]+jitter[mask],0,255))
    # dark inner mouth, pale keratin filter-slats, golden eyes and black pupils.
    # UV constants point to these hand-painted pigment swatches.
    for a,b,color in [(.935,.954,[31,23,23]),(.955,.972,[226,186,120]),(.973,.989,[173,105,37]),(.990,1.0,[13,18,19])]:
        mask=(v>=a)&(v<b)
        pix[mask]=color
    Image.fromarray(pix,'RGB').save(TEX,optimize=True)

# Each triangle gets its own corners for intentional flat-shaded anatomical planes.
class Sculpt:
    def __init__(self): self.vertices=[];self.uv=[];self.faces=[];self.parts={}
    def triangle(self,a,b,c,ta,tb,tc,name):
        idx=len(self.vertices)
        self.vertices.extend([a,b,c]);self.uv.extend([ta,tb,tc]);self.faces.append([idx,idx+1,idx+2]);self.parts[name]=self.parts.get(name,0)+1
    def quad(self,a,b,c,d,ta,tb,tc,td,name):
        self.triangle(a,b,c,ta,tb,tc,name);self.triangle(a,c,d,ta,tc,td,name)
    def loft(self,sections,sides,name,band=(.06,.65),ends=True):
        # sections (x, centerY, vertical_radius, lateral_radius), hard-edged loft
        for i in range(len(sections)-1):
            x0,y0,ry0,rz0=sections[i];x1,y1,ry1,rz1=sections[i+1]
            for j in range(sides):
                a=2*math.pi*j/sides; b=2*math.pi*(j+1)/sides
                A=(x0,y0+ry0*math.cos(a),rz0*math.sin(a))
                B=(x0,y0+ry0*math.cos(b),rz0*math.sin(b))
                C=(x1,y1+ry1*math.cos(b),rz1*math.sin(b))
                D=(x1,y1+ry1*math.cos(a),rz1*math.sin(a))
                ua=np.clip((x0+21)/39,.005,.995);ub=np.clip((x1+21)/39,.005,.995)
                va=band[0]+(band[1]-band[0])*j/sides;vb=band[0]+(band[1]-band[0])*(j+1)/sides
                self.quad(A,B,C,D,(ua,va),(ua,vb),(ub,vb),(ub,va),name)
        if ends:
            for idx,reverse in [(0,True),(-1,False)]:
                x,y,ry,rz=sections[idx];center=(x,y,0)
                for j in range(sides):
                    a=2*math.pi*j/sides;b=2*math.pi*(j+1)/sides
                    p=(x,y+ry*math.cos(a),rz*math.sin(a));q=(x,y+ry*math.cos(b),rz*math.sin(b))
                    u=np.clip((x+21)/39,.005,.995)
                    if reverse:self.triangle(center,q,p,(u,.48),(u,.5),(u,.52),name)
                    else:self.triangle(center,p,q,(u,.48),(u,.52),(u,.5),name)
    def plate(self,center,length,width,basey,rise,name,band=(.70,.81)):
        x,z=center;v=[(x-length*.52,basey-.05,z-width*.48),
          (x+length*.38,basey-.1,z-width*.54),
          (x+length*.55,basey-.12,z+width*.35),
          (x-length*.25,basey-.02,z+width*.52),
          (x-length*.1,basey+rise,z-width*.15)]
        for a,b,c in [(0,1,4),(1,2,4),(2,3,4),(3,0,4)]:
            pts=[v[a],v[b],v[c]]
            self.triangle(*pts, *[(np.clip((p[0]+21)/39,.02,.98),.74+.04*((p[2]/5)+.7)) for p in pts],name)
        # thin beveled side wall integrated into torso
        for j in range(4):
            p=v[j];q=v[(j+1)%4];d=.24
            self.quad(p,q,(q[0],q[1]-d,q[2]),(p[0],p[1]-d,p[2]),(.17,.72),(.30,.78),(.30,.8),(.17,.8),name)
    def fin(self,sign=1):
        # wide swept sand-paddle, thickness and raised medial ridge are structural
        pts=[(4.3,3.55,3.1*sign),(-.9,3.30,4.4*sign),(-8.6,2.35,9.6*sign),
             (-5.15,2.43,10.9*sign),(4.0,3.25,6.1*sign),(5.7,3.7,4.4*sign)]
        ridge=(0.4,3.95,6.4*sign); low=(.4,2.62,6.4*sign)
        def tuv(p): return (np.clip((p[0]+21)/39,.02,.98),.846+min(abs(p[2])/22,.068))
        for i in range(len(pts)):
            a=pts[i];b=pts[(i+1)%len(pts)]
            self.triangle(ridge,a,b,tuv(ridge),tuv(a),tuv(b),'sand_paddle')
            self.triangle(low,b,a,tuv(low),tuv(b),tuv(a),'sand_paddle')
            self.quad(a,b,(b[0],b[1]-.16,b[2]),(a[0],a[1]-.16,a[2]),tuv(a),tuv(b),tuv(b),tuv(a),'sand_paddle_edge')
    def tail_sail(self):
        # triangular vertical caudal sail at rear, not an unrelated floating spike
        surf=[(-16.0,4.8),(-19.2,6.5),(-20.3,10.9),(-20.2,7.4),(-19.3,3.0),(-17.0,2.5)]
        for sign in [-1,1]:
            origin=(-18.45,5.2,.24*sign)
            for i in range(len(surf)):
                p=(*surf[i],.27*sign);q=(*surf[(i+1)%len(surf)],.27*sign)
                self.triangle(origin,p,q,(.15,.86),(.05+.05*i,.88),(.05+.05*((i+1)%len(surf)),.88),'caudal_sail')
    def bone(self,p,q,width,thickness,name,band=.955):
        p=np.array(p,dtype=float);q=np.array(q,dtype=float); dir=q-p
        tangent=np.cross(dir,[0,0,1]); tangent=tangent/(np.linalg.norm(tangent)+1e-8)*width
        depth=np.array([0,0,thickness])
        pts=[p-tangent*.5-depth,p+tangent*.5-depth,p+tangent*.5+depth,p-tangent*.5+depth,
             q-tangent*.22-depth*.5,q+tangent*.22-depth*.5,q+tangent*.22+depth*.5,q-tangent*.22+depth*.5]
        for i in range(4):
            j=(i+1)%4;self.quad(pts[i],pts[j],pts[j+4],pts[i+4],(.24,band),(.27,band),(.27,band+.012),(.24,band+.012),name)
    def eye(self,sign):
        # inset amber iris on an angular brow (iris is geometric, its color is texture)
        x=10.9;y=5.55;z=3.38*sign
        v=[(x-.65,y+.28,z-.18*sign),(x+.60,y+.24,z-.18*sign),
           (x+.36,y-.35,z+.09*sign),(x-.44,y-.27,z+.09*sign)]
        self.quad(*v, *[(.32,.941)]*4,'recessed_orbit')
        v2=[(x-.23,y+.05,z+.03*sign),(x+.24,y+.04,z+.03*sign),(x+.08,y-.19,z+.12*sign),(x-.12,y-.18,z+.12*sign)]
        self.quad(*v2, *[(.35,.979)]*4,'amber_eye')
        p=(x,y-.08,z+.17*sign);self.triangle(p,(x+.10,y+.08,z+.18*sign),(x+.1,y-.15,z+.2*sign),*( [( .45,.995)]*3 ),'pupil')
    def snout_nostril(self,sign):
        x=15.25;y=6.03;z=1.45*sign
        self.triangle((x-.3,y,z-.25*sign),(x+.35,y-.08,z-.15*sign),(x+.25,y-.03,z+.25*sign),*( [( .45,.995)]*3 ),'nostril')
    def make(self):
        # heavy axial body, sectional proportions carefully sculpted not spheres joined
        xs=np.linspace(-14.6,9.7,30)
        sec=[]
        for x in xs:
            s=(x+14.6)/24.3
            r=(math.sin(math.pi*s)**.53)
            body_width=.5+4.25*r*(.90+.08*math.sin(s*math.pi))
            body_rise=.65+3.08*r
            cy=3.50+.45*math.sin(s*math.pi)+.2*s
            sec.append((float(x),float(cy),float(body_rise),float(body_width)))
        self.loft(sec,16,'trunk')
        # narrow neck transition, angular upper head and flattened wedge front
        cranium=[(8.05,4.69,2.20,3.36),(9.25,4.91,2.20,3.56),
                 (10.7,5.04,1.93,3.61),(12.0,5.10,1.65,3.70),
                 (13.7,5.02,1.35,3.56),(15.0,4.96,1.10,3.24),
                 (16.55,4.8,.85,2.93),(17.1,4.67,.52,2.68)]
        self.loft(cranium,16,'wedge_cranium')
        # separate anatomical lower jaw produces the large filter-mouth opening
        jaw=[(9.35,2.35,.71,3.05),(10.6,2.23,.70,3.17),
             (12.2,2.05,.67,3.22),(13.7,1.99,.65,3.15),
             (15.2,2.08,.59,3.05),(16.7,2.27,.51,2.84),(17.05,2.47,.34,2.57)]
        self.loft(jaw,16,'lower_filter_jaw')
        # dark sand sifting throat, visible through mouth; real structural cavity
        for s in [-1,1]:
            c=[(9.7,3.13,3.07*s),(11.2,3.08,3.28*s),(13.5,3.09,3.23*s),(16.5,3.03,2.93*s)]
            top=[(p[0],p[1]+1.14,p[2]) for p in c]
            for i in range(3):
                self.quad(c[i],c[i+1],top[i+1],top[i],*( [( .50,.943)]*4 ),'mouth_shadow')
        # baleen filter combs inside mouth: structurally required, not pigment patches
        for s in [-1,1]:
            for x in np.linspace(10.05,16.3,13):
                frac=(x-10.05)/6.25
                z=(3.25-.28*frac)*s
                self.bone((x,4.06,z),(x+.08,3.18,z-.11*s),.21,.065,'keratin_filter')
        for s in [-1,1]:
            self.fin(s);self.eye(s);self.snout_nostril(s)
        # paired stabilizer keels at rear
        for s in [-1,1]:
            tail=[(-12,3.50,1.45*s),(-15.5,3.2,1.7*s),(-18.2,2.85,2.8*s),(-16.0,2.83,3.7*s)]
            mid=(-15,3.22,2.5*s)
            for i in range(4):
                self.triangle(mid,tail[i],tail[(i+1)%4],(.12,.865),(.18,.88),(.22,.88),'rear_keel')
        self.loft([(-13.45,3.2,1.8,1.85),(-15.7,3.25,1.45,1.15),(-17.6,3.4,.95,.8),(-19.7,4.0,.58,.43)],12,'caudal_peduncle')
        self.tail_sail()
        # armored dorsal scutes are ABRASION PROTECTION, truly raised geometry
        for x in np.linspace(-10.9,8.2,12):
            # approximate true top of axial surface for plate immersion
            i=int(np.argmin(np.abs(xs-x)));xp,cy,ry,rz=sec[i]
            wave=.1*math.sin(x*1.33)
            self.plate((x,0),2.30,2.52,cy+ry-.15,.36+wave,'dorsal_armor')
        # brow and bony snout cheek shields
        for s in [-1,1]:
            for x,cy,zz in [(10.1,6.55,2.6),(12.55,6.28,2.65),(14.8,5.93,2.35)]:
                self.plate((x,zz*s),2.10,1.55,cy,.2,'cranial_shield')
        return self

def main():
    TEX.parent.mkdir(parents=True,exist_ok=True)
    paint_atlas()
    b=Sculpt().make()
    material=PBRMaterial(name='Arenoceto_Texture_Pintada_Original',baseColorTexture=Image.open(TEX),
                         metallicFactor=0.,roughnessFactor=.94,baseColorFactor=[1.0,1.0,1.0,1.0])
    mesh=trimesh.Trimesh(vertices=np.asarray(b.vertices), faces=np.asarray(b.faces),process=False)
    mesh.visual=TextureVisuals(uv=np.asarray(b.uv,dtype=np.float32),material=material)
    scene=trimesh.Scene();scene.add_geometry(mesh,geom_name='Arenoceto_v01_UV_Textured_Blockout')
    GLB.write_bytes(scene.export(file_type='glb'))
    data=GLB.read_bytes();reloaded=trimesh.load(GLB,force='scene',process=False)
    parts=list(reloaded.geometry.values());ntri=sum(len(g.faces) for g in parts)
    assert ntri==len(b.faces) and ntri>500
    assert all(hasattr(g.visual,'uv') and len(g.visual.uv)==len(g.vertices) for g in parts)
    assert not reloaded.bounds is None
    report={'species':'Arenoceto','version':'v01','stage':'static_uv_textured_blockout',
            'approval':{'concept':'approved_in_chat_2026-11-09','form':'awaiting_user_review'},
            'asset':str(GLB.relative_to(ROOT)),'texture':str(TEX.relative_to(ROOT)),
            'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),
            'texture_sha256':hashlib.sha256(TEX.read_bytes()).hexdigest(),
            'triangles':ntri,'mesh_groups':len(parts),'nodes':len(reloaded.graph.nodes),
            'skins':0,'bones':0,'animation_clips':0,'lods_generated':0,
            'painted_patterns':'original raster atlas UV, no polygons for stains/colors',
            'bounds_m':np.round(reloaded.bounds,3).tolist(),
            'triangles_by_structure':b.parts}
    (ROOT/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps({k:v for k,v in report.items() if k!='triangles_by_structure'},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
