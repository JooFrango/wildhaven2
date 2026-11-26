#!/usr/bin/env python3
"""Wildhaven - Serracorion v01 original static, UV painted anatomical blockout.
Coordinate system: X forward is NEGATIVE, Y up, Z bilateral. 1 unit = 1 m.
Only silhouette/anatomical components use faces. All markings and colours are raster UV paint.
"""
import json, hashlib, math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import trimesh
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals

ROOT=Path(__file__).resolve().parents[1]
TEX=ROOT/'textures'/'serracorion-v01-painted-uv.png'
GLB=ROOT/'serracorion-v01-anatomical-blockout.glb'

# UV regions from upper edge of the image in GLTF V convention
BANDS={ 'hide':(.82,.99),'armor':(.65,.81),'limb':(.47,.64),
        'chela':(.30,.46),'spine':(.14,.29),'mouth':(.02,.13) }
SWATCH={'eye':(.94,.085),'pupil':(.97,.067),'teeth':(.24,.18),'inner':(.53,.055),
        'darkclaw':(.73,.23),'jaw':(.52,.090)}

def create_atlas():
    """Produce *actual painted pixels* for the color variation, not decorative geometry."""
    sz=2048
    rng=np.random.default_rng(1102026)
    yy,xx=np.ogrid[:sz,:sz]
    u,v=np.broadcast_arrays(xx/sz,1-yy/sz)
    small=rng.standard_normal((192,192)).astype(np.float32)
    medium=rng.standard_normal((512,512)).astype(np.float32)
    def resz(a):
        # Image mode F preserves floating point
        return np.asarray(Image.fromarray(a,mode='F').resize((sz,sz),Image.Resampling.BICUBIC),dtype=np.float32)
    noise=.75*resz(small)+.24*resz(medium)
    a=np.zeros((sz,sz,3),dtype=np.float32)
    bands=[(.81,1.001,(214,185,144)),(.64,.82,(188,125,71)),(.46,.65,(174,107,55)),
           (.29,.47,(198,141,86)),(.13,.30,(217,153,95)),(0,.14,(83,44,35))]
    for lo,hi,c in bands:
        mask=(v>=lo)&(v<hi)
        for k in range(3): a[:,:,k][mask]=c[k]
    # body: pale ivory scales, dark vermilion banding, with irregular painted transition
    body=(v>.82)
    phase=(u*12.4+0.12*np.sin(v*40)+0.13*noise/3) % 1.0
    stripes=(phase>.60)&(phase<.83)&body
    a[stripes]=a[stripes]*.30+np.array([139,61,39])*.70
    bel=(v>.945)
    a[bel]=a[bel]*.5+np.array([238,214,178])*.5
    # armor: mottled ochre / deep burnt-orange under-edge
    armor=((v>.65)&(v<.82))
    ridge=(np.sin(u*60+noise*.6)>0.65)&armor
    a[ridge]=a[ridge]*.55+np.array([233,170,95])*.45
    line=(v>.657)&(v<.675)
    a[line]=a[line]*.6+np.array([118,65,42])*.4
    # horn tips charcoal and burnt sienna, paint gradient along band
    spine=(v>.14)&(v<.29)
    grad=np.clip((.29-v)/.15,0,1)
    a[spine]=a[spine]*(1-grad[spine,None]*.55) + np.array([84,48,40])*grad[spine,None]*.55
    # mouth tiny regions: bespoke painted sclera/teeth/gums/eye and claw tip
    for name,(uu,vv) in SWATCH.items():
        color={'eye':(30,24,20),'pupil':(4,8,9),'teeth':(240,223,177),
          'inner':(64,21,27),'darkclaw':(45,37,33),'jaw':(101,53,43)}[name]
        mask=(np.abs(u-uu)<.015)&(np.abs(v-vv)<.012)
        for k in range(3): a[:,:,k][mask]=color[k]
    # pixel-grain mottling, compact sand scratches and scales
    a+=noise[:,:,None]*10
    im=Image.fromarray(np.uint8(np.clip(a,0,255)),'RGB').convert('RGBA')
    painted=Image.new('RGBA',(sz,sz),(0,0,0,0));d=ImageDraw.Draw(painted,'RGBA')
    for k in range(460):
        x=int(rng.integers(10,2038));y=int(rng.integers(25,1970))
        # body, armor and limb scratch marks; no mesh geometry
        if k%3==0:
            length=int(rng.integers(7,38)); d.line((x,y,x+length,y+int(rng.integers(-7,8))),
                 fill=(84,42,24,int(rng.integers(26,80))),width=int(rng.integers(1,4)))
        else:
            rx=int(rng.integers(5,25));ry=int(rng.integers(3,12))
            d.ellipse((x-rx,y-ry,x+rx,y+ry),fill=(110,70,45,int(rng.integers(9,38))))
    painted=painted.filter(ImageFilter.GaussianBlur(.95))
    im=Image.alpha_composite(im,painted).convert('RGB')
    im.save(TEX,optimize=True)

class Shape:
    def __init__(self): self.verts=[];self.uv=[];self.faces=[];self.parts={}
    def tri(self,a,b,c,ta,tb,tc,label):
        i=len(self.verts)
        self.verts.extend([a,b,c]); self.uv.extend([ta,tb,tc]); self.faces.append([i,i+1,i+2]);self.parts[label]=self.parts.get(label,0)+1
    def quad(self,a,b,c,d,ta,tb,tc,td,label):
        self.tri(a,b,c,ta,tb,tc,label); self.tri(a,c,d,ta,tc,td,label)
    def tex(self,x,t,band):
        lo,hi=BANDS[band]
        return (float(np.clip((x+9)/21,.005,.99)),float(lo+(hi-lo)*t))
    def fan(self,ring,peak,band,label):
        for i in range(len(ring)):
            q=ring[(i+1)%len(ring)];p=ring[i]
            self.tri(p,q,peak,self.tex(p[0],i/len(ring),band),self.tex(q[0],(i+1)/len(ring),band),self.tex(peak[0],.5,band),label)
    def loft_x(self,sections,n,band,label):
        # sections: x, center height, vertical radius, width
        for i in range(len(sections)-1):
            x,y,ry,rz=sections[i]; x2,y2,r2,s2=sections[i+1]
            for j in range(n):
                a=2*math.pi*j/n; b=2*math.pi*(j+1)/n
                p=(x,y+ry*math.cos(a),rz*math.sin(a));q=(x,y+ry*math.cos(b),rz*math.sin(b))
                r=(x2,y2+r2*math.cos(b),s2*math.sin(b));s=(x2,y2+r2*math.cos(a),s2*math.sin(a))
                self.quad(p,q,r,s,self.tex(x,j/n,band),self.tex(x,(j+1)/n,band),self.tex(x2,(j+1)/n,band),self.tex(x2,j/n,band),label)
        for sec,reverse in [(sections[0],True),(sections[-1],False)]:
            x,y,ry,rz=sec
            for j in range(n):
                a=2*math.pi*j/n;b=2*math.pi*(j+1)/n
                p=(x,y+ry*math.cos(a),rz*math.sin(a));q=(x,y+ry*math.cos(b),rz*math.sin(b))
                c=(x,y,0)
                uv=self.tex(x,.5,band)
                if reverse:self.tri(c,q,p,uv,self.tex(x,(j+1)/n,band),self.tex(x,j/n,band),label)
                else:self.tri(c,p,q,uv,self.tex(x,j/n,band),self.tex(x,(j+1)/n,band),label)
    def tube(self,path,radii,n,band,label,aspect=1.0):
        arr=np.array(path,dtype=float); rings=[]
        for i,pos in enumerate(arr):
            tangent=arr[min(i+1,len(arr)-1)]-arr[max(i-1,0)]
            tangent=tangent/(np.linalg.norm(tangent)+1e-7)
            ref=np.array([0.,1.,0.]) if abs(tangent[1])<.92 else np.array([0.,0.,1.])
            a=np.cross(tangent,ref);a/=np.linalg.norm(a)+1e-8
            b=np.cross(tangent,a);b/=np.linalg.norm(b)+1e-8
            rad=float(radii[i]);
            rings.append([pos+rad*(math.cos(2*math.pi*j/n)*a + math.sin(2*math.pi*j/n)*aspect*b) for j in range(n)])
        for i in range(len(rings)-1):
            for j in range(n):
                j2=(j+1)%n
                p,q,r,s=rings[i][j],rings[i][j2],rings[i+1][j2],rings[i+1][j]
                self.quad(p,q,r,s,self.tex(float(p[0]),j/n,band),self.tex(float(q[0]),j2/n,band),self.tex(float(r[0]),j2/n,band),self.tex(float(s[0]),j/n,band),label)
        for ring,flip in [(rings[0],True),(rings[-1],False)]:
            center=np.mean(ring,axis=0)
            for j in range(n):
                p,q=ring[j],ring[(j+1)%n];uvw=self.tex(float(center[0]),.5,band)
                if flip:self.tri(center,q,p,uvw,self.tex(float(q[0]),.6,band),self.tex(float(p[0]),.5,band),label)
                else:self.tri(center,p,q,uvw,self.tex(float(p[0]),.5,band),self.tex(float(q[0]),.6,band),label)
    def tapered_blade(self,root,shoulder,tip,width,band,label):
        # sharp anatomical chitin edge, double sided with beveled thickness
        p=np.array(root,float);q=np.array(shoulder,float);t=np.array(tip,float)
        up=np.array([0.,0.,1.])
        side=np.cross(q-p,up)
        side=side/(np.linalg.norm(side)+1e-9)
        left=p+side*width*.5;right=p-side*width*.5
        qleft=q+side*width*.34;qright=q-side*width*.34
        # create six triangles, non-coplanar and with a cutting ridge
        mid=(p+q)/2+np.array([0,.12,0]);w=.02
        pts=[left,right,qleft,qright,mid,t]
        U=lambda x:self.tex(float(x[0]),.28 if np.linalg.norm(x-t)<.15 else .73,band)
        for a,b,c in [(0,2,4),(4,2,5),(1,4,3),(4,5,3),(0,4,1),(2,3,5)]:self.tri(pts[a],pts[b],pts[c],U(pts[a]),U(pts[b]),U(pts[c]),label)
    def segment_plate(self,x,y,halfwidth,depth,thick,tipheight,side=0):
        # Raised dorsal scute, organic plate not a paint patch
        zc=side*halfwidth*.62 if side else 0
        w=halfwidth*(.50 if side else .92)
        a=(x-.7,y,zc-w);b=(x+.60,y-.08,zc-w*.78)
        c=(x+.65,y-.08,zc+w*.78);d=(x-.7,y,zc+w)
        crest=(x-.15,y+thick,zc)
        for p,q in [(a,b),(b,c),(c,d),(d,a)]:
            self.tri(p,q,crest,self.tex(p[0],.18,'armor'),self.tex(q[0],.82,'armor'),self.tex(crest[0],.52,'armor'),'dorsal_armor')
        if tipheight>0:
            self.tapered_blade(crest,(x+.05,y+tipheight*.7,zc),(x-.6,y+tipheight,zc+.06),w*.6,'spine','dorsal_scutal_fin')
    def orb(self,pos,r,band,label):
        # faceted lens sitting inside socket, not a floating glossy ball
        rings=[];center=np.array(pos,float)
        for i in range(5):
            theta=math.pi*(i+.35)/5
            ring=[]
            for j in range(9):
                alpha=2*math.pi*j/9
                ring.append(center+np.array([r*math.sin(theta)*math.cos(alpha),r*math.cos(theta),r*math.sin(theta)*math.sin(alpha)]))
            rings.append(ring)
        for k in range(4):
            for j in range(9):
                a,b,c,d=rings[k][j],rings[k][(j+1)%9],rings[k+1][(j+1)%9],rings[k+1][j]
                uv=self.tex(-4.5,.30,band)
                self.quad(a,b,c,d,uv,uv,uv,uv,label)
    def build(self):
        # Trunk: broad shoulder, flattened armored dorsal shell; 1 unit = m
        trunk=[(-3.50,2.90,.90,1.34),(-2.8,2.95,1.19,1.65),(-1.80,3.03,1.47,1.87),
               (-.6,3.07,1.59,2.02),(.55,3.10,1.53,2.10),(1.75,3.02,1.44,2.00),
               (2.95,2.90,1.36,1.76),(4.0,2.91,1.20,1.42),(4.7,2.91,.93,1.05)]
        self.loft_x(trunk,16,'hide','segmented_trunk')
        # lower thorax/abdomen subtle armored ventral plates
        for x in np.linspace(-2.5,3.8,8):
            sides=10
            y=2.2-.06*math.cos(x)
            for side in [-1,1]:
                plate=[(x-.38,y-.10,side*.76),(x+.43,y-.12,side*.9),(x+.36,y-.35,side*1.12),(x-.42,y-.31,side*.99)]
                self.quad(*plate,*[self.tex(p[0],.14+.18*(k/4),'armor') for k,p in enumerate(plate)],'ventral_scutum')
        # Head shield, lowered narrow rostrum over huge mouth
        self.loft_x([(-5.75,2.54,.56,.76),(-5.23,2.82,.77,1.09),(-4.7,3.02,.93,1.32),
                     (-4.17,3.08,1.10,1.48),(-3.48,3.06,1.04,1.43)],12,'armor','cephalic_shield')
        # Lower articulated mandibular mass and throat. Large open mouth
        self.loft_x([(-5.57,1.08,.24,.68),(-5.27,1.17,.32,.85),(-4.82,1.31,.37,.97),
                     (-4.28,1.52,.38,1.15),(-3.65,1.82,.41,1.2)],12,'limb','lower_jaw')
        mouth=[(-5.47,1.75,-.69),(-5.47,1.75,.69),(-4.13,2.25,1.06),(-3.55,2.45,0),(-4.13,2.25,-1.06)]
        self.fan(mouth,(-4.8,2.30,0),'mouth','oral_cavity')
        for side in [-1,1]:
            # Large four-part grasping mandibles and mouth fangs
            self.tube([(-4.65,2.47,side*.94),(-5.02,2.06,side*1.14),(-5.51,1.74,side*1.10),(-5.70,1.39,side*.96)],
                      [.38,.29,.17,.02],8,'spine','chelicerae')
            for i,x in enumerate(np.linspace(-5.57,-4.1,8)):
                z=side*(.55+.39*(x+5.57)/1.47)
                length=.34+(.16 if i%3==0 else .0)
                self.tube([(x,2.23,z),(x-.04,2.00,z+side*.07),(x-.05,2.03-length,z+side*.11)],
                          [.105,.085,.005],5,'spine','teeth')
            for i,x in enumerate(np.linspace(-5.42,-4.3,6)):
                z=side*(.6+.31*(x+5.42)/1.12)
                self.tube([(x,1.43,z),(x-.06,1.63,z),(x-.06,1.75,z)], [.08,.055,.003],5,'spine','lower_teeth')
            # Eye sockets with angular brows and set-in dark eyes
            pos=(-4.42,3.57,side*1.10)
            self.tube([(-4.98,3.42,side*1.07),(-4.48,3.74,side*1.22),(-4.02,3.63,side*1.15)],
                      [.21,.25,.16],7,'armor','orbital_rim')
            self.orb(pos,.26,'mouth','eyeball')
            # nostril gill pits as pigment? no extra polygons to color, a small sensory ridge
            self.tube([(-5.14,3.29,side*.70),(-5.54,3.24,side*.50)], [.15,.035],6,'armor','nasal_crest')
        # dorsal scutes where armor is physically raised and pointed, eight on body
        for i,x in enumerate(np.linspace(-2.7,3.9,8)):
            r=1.4+0.17*math.sin((i+1)*math.pi/9)
            peak=1.0 if i<4 else .48
            self.segment_plate(float(x),3.0+r,1.58,1.0,.29,peak)
        # paired brow horns, flare from hard carapace
        for side in [-1,1]:
            self.tapered_blade((-4.4,3.70,side*1.05),(-4.58,4.6,side*1.17),(-4.92,5.40,side*1.19),.41,'spine','horn_brow')
            self.tapered_blade((-3.75,3.84,side*1.36),(-3.79,4.4,side*1.61),(-4.15,5.08,side*1.80),.48,'spine','horn_temporal')
        # middle and rear legs: three pairs, properly segmented bent from trunk to floor
        for pair,x0 in enumerate([-1.1,1.35,3.23]):
            for side in [-1,1]:
                s=side; front= (-.35 if pair==0 else .45 if pair==2 else .1)
                hip=(x0,2.89,s*1.66)
                femur=(x0+.42,2.57,s*2.38)
                knee=(x0+front,2.00,s*(3.03+(.15 if pair==1 else 0)))
                ankle=(x0+front+.47,.90,s*3.45)
                foot=(x0+front+.17,.13,s*3.7)
                self.tube([hip,femur,knee],[.46,.52,.33],10,'limb','ambulatory_coxa_femur')
                self.tube([knee,(knee[0]+.32,1.5,s*3.21),ankle],[.34,.26,.21],8,'limb','ambulatory_tibia')
                self.tube([ankle,foot,(foot[0]-.24,.05,foot[2]+s*.22)], [.25,.13,.0],7,'spine','tarsal_claw')
                self.tube([knee,(knee[0]+.17,2.15,knee[2]+s*.08)],[.43,.04],7,'armor','knee_knuckle_armor')
                # physical ankle chitin shield, not color-overlay
                self.tapered_blade((ankle[0]+.03,ankle[1]+.24,ankle[2]),(ankle[0]+.20,ankle[1]+.62,ankle[2]),
                                   (ankle[0]-.20,ankle[1]+.84,ankle[2]),.36,'spine','tibial_spur')
        # massive front claws: two separate pinching arms with anatomically meaningful terminal pincers
        for side in [-1,1]:
            s=side
            shoulder=(-2.63,2.99,s*1.51)
            elbow=(-3.3,2.5,s*2.61)
            wrist=(-4.65,1.94,s*3.83)
            manus=(-5.83,1.55,s*4.10)
            self.tube([shoulder,(-2.83,2.82,s*2.02),elbow],[.77,.76,.62],12,'limb','chela_coxa')
            self.tube([elbow,(-3.87,2.21,s*3.15),wrist],[.66,.75,.54],12,'chela','chela_forearm')
            self.tube([wrist,(-5.36,1.68,s*4.0),manus],[.63,.77,.65],12,'chela','chela_palm')
            # large fixed finger and curved mobile digit taper inward to meet at front
            self.tube([(-5.95,1.70,s*3.88),(-6.50,1.32,s*3.52),(-7.08,.84,s*3.25),(-7.31,.43,s*3.25)],
                      [.46,.37,.20,.0],9,'spine','massive_chela_fixed_finger')
            self.tube([(-5.99,1.55,s*4.38),(-6.57,1.27,s*4.78),(-7.10,.75,s*4.60),(-7.27,.37,s*4.06)],
                      [.40,.34,.16,0],9,'spine','massive_chela_movable_finger')
            # raised angular manus shell has meaningful anatomy
            self.tapered_blade((-5.17,2.05,s*3.87),(-5.73,2.68,s*3.91),(-6.25,2.59,s*3.99),.62,'armor','chela_palm_scute')
            self.tapered_blade((-4.20,2.44,s*3.48),(-4.72,2.95,s*3.68),(-5.15,3.08,s*3.85),.48,'armor','forearm_protective_plate')
        # Tail grows from rear body, curves up and over with broad segmented crest
        tailpath=[(4.06,2.92,0),(4.89,3.00,0),(5.72,3.38,0),(6.40,4.07,0),
                  (6.76,5.0,0),(6.86,5.99,0),(6.62,7.0,0),(6.0,7.91,0),
                  (5.10,8.58,0),(4.02,8.90,0),(2.85,9.0,0),(1.75,8.83,0)]
        rr=[.99,.90,.79,.74,.70,.61,.53,.48,.40,.34,.29,.22]
        # loft along tail with armored functional segments
        self.tube(tailpath,rr,12,'hide','segmented_tail')
        for i,pt in enumerate(tailpath[1:-1]):
            x,y,z=pt;rad=rr[i+1]
            # outer ring segmentation: actual protruding distal edge of chitin
            self.tube([(x+.11,y-.12,0),(x-.05,y+.14,0)],[rad*1.07,rad*.99],9,'armor','tail_segment_seam')
            if i%1==0:
                bx,by=x,y+rad*.85
                dx=-.36 if i>5 else .20
                self.tapered_blade((bx,by,0),(bx+dx,by+.37,0),(bx+dx-.45,by+.66,0),.29,'spine','tail_lateral_scutal_spine')
        # terminal backward-forward sweeping dark-tipped sickle, outline critical to art
        self.tube([(1.75,8.83,0),(.97,8.66,0),(-.15,8.05,0),(-1.32,7.18,0),(-2.52,6.35,0)],
                  [.35,.39,.30,.16,.0],10,'spine','caudal_scythe')
        self.tapered_blade((-.85,7.57,0),(-1.74,6.72,0),(-3.14,5.60,0),.48,'spine','caudal_blade_keel')
        return self

def main():
    create_atlas()
    sculpt=Shape().build()
    mesh=trimesh.Trimesh(vertices=np.asarray(sculpt.verts,dtype=np.float32),faces=np.asarray(sculpt.faces,dtype=np.int32),process=False)
    mat=PBRMaterial(name='Serracorion_AtlasUV_Pintado',baseColorTexture=Image.open(TEX),metallicFactor=0.,roughnessFactor=.91,baseColorFactor=[255,255,255,255])
    mesh.visual=TextureVisuals(uv=np.asarray(sculpt.uv,dtype=np.float32),material=mat)
    scene=trimesh.Scene();scene.add_geometry(mesh,geom_name='Serracorion_v01_Anatomical_Faceted')
    GLB.write_bytes(scene.export(file_type='glb'))
    # Reimport the exported bytes, do NOT measure only source mesh.
    loaded=trimesh.load(GLB,force='scene',process=False)
    geos=list(loaded.geometry.values());triangles=sum(len(g.faces) for g in geos)
    assert triangles==len(sculpt.faces) and triangles>3000
    assert all(hasattr(g.visual,'uv') and len(g.visual.uv)==len(g.vertices) for g in geos)
    data=GLB.read_bytes();
    manifest={'species':'Serracorion (nome provisório)','biome':'Mar de Dunas','version':'v01','status':{'concept':'approved_by_user','blockout_shape':'awaiting_artistic_review','rig':'not_started','integration':'not_in_game'},
      'source':'source/build.py','asset':GLB.name,'texture':'textures/'+TEX.name,'sha256':hashlib.sha256(data).hexdigest(),
      'texture_sha256':hashlib.sha256(TEX.read_bytes()).hexdigest(),'size_bytes':len(data),'triangles':triangles,'mesh_count':len(geos),
      'materials':1,'texture_resolution_px':[2048,2048],'bones':0,'skins':0,'animation_clips':0,
      'bounds_m':np.round(loaded.bounds,3).tolist(),'units':'metres; Y up; head at negative X',
      'texture_rule':'pigment stripes, spots, surface scratches entirely hand-painted UV raster; armor geometry only for physical silhouette',
      'parts_triangles':sculpt.parts,'reference':'predador_das_dunas_em_armadura.png approved conceptual artwork'}
    (ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False),encoding='utf-8')
    print(json.dumps({k:v for k,v in manifest.items() if k!='parts_triangles'},ensure_ascii=False,indent=2))

if __name__=='__main__':main()
