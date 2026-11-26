"""Rebuild the two savanna LOD0s with stitched limbs and a single painted atlas."""
import math
from pathlib import Path
import sys

import bpy
import bmesh
import numpy as np
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fauna_motion_v07_v05 import animate

TAU = math.tau
TALVERO = dict(
    version="v07", withers=1.30, eye=.789, sockets=(1, 6),
    # x, z, half width, sagittal radius; nose points along +X
    body=[
        (-1.08,1.04,.09,.15),(-.97,1.04,.23,.245),(-.76,1.035,.292,.27),
        (-.53,1.04,.264,.249),(-.28,1.039,.243,.242),(-.05,1.035,.262,.26),
        (.16,1.04,.284,.275),(.34,1.057,.269,.274),(.51,1.086,.224,.25),
        (.65,1.19,.172,.233),(.69,1.346,.139,.187),(.755,1.491,.111,.131),
        (.83,1.594,.122,.134),(.962,1.618,.123,.127),(1.075,1.571,.100,.111),
        (1.20,1.501,.087,.080),(1.327,1.453,.096,.059),(1.397,1.448,.069,.044),
    ],
    fore=[(.36,.211,.837,.152,.104),(.405,.202,.682,.113,.085),
          (.392,.196,.521,.078,.058),(.382,.196,.404,.061,.054),
          (.401,.197,.343,.047,.041),(.428,.198,.178,.039,.036),
          (.425,.199,.111,.054,.052),(.469,.200,.055,.068,.057)],
    hind=[(-.782,.215,.840,.198,.115),(-.693,.213,.683,.151,.097),
          (-.619,.205,.548,.099,.062),(-.711,.201,.441,.067,.051),
          (-.791,.203,.347,.05,.043),(-.78,.204,.197,.040,.038),
          (-.777,.204,.111,.053,.051),(-.733,.205,.055,.063,.056)],
    neck=(.49,0,1.18), mid=(.69,0,1.385), head=(.84,0,1.593),
    jaw=(.98,0,1.54),
    tail=[(-1.039,0,1.13,.080),(-1.170,0,1.113,.063),(-1.249,0,1.004,.051),
          (-1.302,.022,.883,.073),(-1.365,.045,.682,.076),(-1.375,.065,.490,.059),
          (-1.438,.088,.359,.015),(-1.46,.087,.323,.005)],
    mane=(8,13), ears=((.874,.081,1.704),(.822,.123,1.908)),
)
RAMBREL = dict(
    version="v05", withers=1.49, eye=.791, sockets=(1, 6),
    body=[
        (-1.02,1.105,.065,.145),(-.92,1.146,.186,.223),(-.75,1.167,.235,.251),
        (-.52,1.176,.239,.224),(-.29,1.173,.21,.212),(-.06,1.189,.225,.234),
        (.156,1.225,.248,.258),(.32,1.263,.247,.257),(.474,1.313,.196,.242),
        (.565,1.461,.142,.191),(.58,1.64,.118,.151),(.618,1.822,.092,.116),
        (.667,2.001,.082,.097),(.731,2.148,.091,.095),(.852,2.176,.106,.104),
        (.962,2.149,.096,.089),(1.071,2.108,.065,.061),(1.161,2.098,.064,.050),
        (1.202,2.100,.048,.040),
    ],
    fore=[(.34,.176,1.076,.118,.088),(.32,.182,.909,.101,.077),
          (.291,.177,.693,.061,.053),(.264,.175,.546,.052,.050),
          (.291,.176,.478,.044,.037),(.338,.174,.205,.034,.036),
          (.334,.173,.106,.042,.044),(.371,.172,.054,.051,.049)],
    hind=[(-.766,.173,.971,.145,.098),(-.666,.184,.802,.111,.079),
          (-.607,.173,.653,.072,.051),(-.709,.168,.519,.057,.046),
          (-.798,.165,.387,.046,.042),(-.808,.164,.193,.035,.035),
          (-.804,.163,.102,.043,.043),(-.766,.162,.057,.051,.047)],
    neck=(.48,0,1.39), mid=(.60,0,1.80), head=(.743,0,2.147),
    jaw=(.883,0,2.113),
    tail=[(-.994,0,1.20,.060),(-1.094,0,1.178,.040),(-1.194,0,1.071,.026),
          (-1.278,.020,.956,.021),(-1.353,.021,.899,.040),(-1.434,.033,.836,.020),
          (-1.495,.055,.800,.003)],
    mane=(8,14), ears=((.743,.079,2.21),(.589,.209,2.286)),
)

# Bottom atlas bands are limbs and the small anatomical materials; top is body UV.
SWATCH = {
    "mane": ((.16,.093,.065),(.32,.20,.124)),
    "horn": ((.13,.111,.096),(.38,.32,.24)),
    "hoof": ((.10,.081,.072),(.265,.215,.165)),
    "ear": ((.28,.122,.112),(.57,.329,.238)),
    "fur": ((.35,.206,.132),(.70,.470,.284)),
    "lip": ((.19,.11,.084),(.37,.233,.168)),
}
SWATCHES = list(SWATCH)

def uv_swatch(name, u, v):
    index = SWATCHES.index(name)
    return ((index + .12 + .76*u)/len(SWATCH), .042+.123*v)

def uv_body(u,v):
    return (.025+.95*u,.386+.586*v)

def atlas(species, seams, eye):
    n=512
    x,y=np.meshgrid(np.linspace(0,1,n,dtype=np.float32),np.linspace(0,1,n,dtype=np.float32))
    rng=np.random.default_rng(1102 if species=="talvero" else 2029)
    def s(a,b,t):
        z=np.clip((t-a)/(b-a),0,1)
        return z*z*(3-2*z)
    def c(rgb):
        return np.array(rgb,dtype=np.float32)[None,None,:]
    def mix(a,b,t):
        return a+(b-a)*t[...,None]
    u=np.clip((x-.025)/.95,0,1)
    v=np.clip((y-.386)/.586,0,1)
    flank=np.minimum(v,1-v)
    fur=(np.sin(x*1150+np.sin(y*110)*1.4+y*115)+np.sin(x*860-y*40))*.013
    grain=fur+rng.normal(0,.012,x.shape)
    haze=np.sin(u*47+np.sin(v*34)*1.2)*np.sin(v*54+u*19)
    horse=species=="talvero"
    base=c((.66,.463,.301) if horse else (.68,.454,.248))
    dorsal=c((.40,.261,.158) if horse else (.48,.295,.148))
    belly=c((.78,.628,.447) if horse else (.76,.589,.353))
    pigment=mix(base,dorsal,(1-s(.03,.225,flank))*.89)
    pigment=mix(pigment,belly,s(.34,.495,flank)*.82)
    side=s(.09,.17,flank)*(1-s(.34,.45,flank))
    if horse:
        for i, center in enumerate((.135,.235,.329)):
            diagonal=center+(flank-.23)*(.34+.08*i)+.009*np.sin(flank*28+i)
            width=(.026-i*.003)*(.68+.30*np.sin(flank*8))
            stripe=(1-s(width*.62,width,np.abs(u-diagonal+grain*.19)))*side
            pigment=mix(pigment,c((.83,.716,.544)),stripe*.86)
    else:
        for i, center in enumerate((.112,.205,.316,.415,.518)):
            dist=np.sqrt(((u-center+.013*np.sin(flank*29+i))/(.047+(.008 if i%2 else 0)))**2+((flank-.24-.06*np.sin(i*2.7))/.115)**2)
            patch=(1-s(.74,1.05,dist+haze*.12))*side
            pigment=mix(pigment,c((.47,.276,.105) if i%2 else (.56,.318,.106)),patch*.86)
    eye_x=TAU*(u-eye)+.20*(flank-.21)
    eye_y=TAU*(flank-.211)-.25*eye_x
    orbit=np.sqrt((eye_x/.173)**2+(eye_y/.216)**2)
    pigment=mix(pigment,c((.23,.131,.083)),(1-s(.55,1.23,orbit))*.85)
    iris=np.sqrt((eye_x/.102)**2+(eye_y/.144)**2)
    pigment=mix(pigment,c((.58,.345,.122)),(1-s(.62,1.0,iris))*.95)
    pupil=np.sqrt((eye_x/.071)**2+(eye_y/.072)**2)
    pigment=mix(pigment,c((.042,.026,.018)),1-s(.60,1.04,pupil))
    glint=np.sqrt(((eye_x-.035)/.018)**2+((eye_y+.055)/.023)**2)
    pigment=mix(pigment,c((.83,.75,.60)),1-s(.45,1.0,glint))
    muzzle=s(.88,.968,u)
    pigment=mix(pigment,c((.44,.305,.231) if horse else (.38,.25,.166)),muzzle*.63)
    nostril=((u-.953)/.014)**2+((flank-.162+(u-.953)*.64)/.020)**2
    pigment=mix(pigment,c((.095,.06,.043)),(1-s(.45,1.12,nostril))*.95)
    lip=(1-s(.004,.012,abs(flank-(.325+.18*(u-.91)))))*s(.865,.932,u)*(1-s(.978,1.,u))
    pigment=mix(pigment,c((.19,.11,.08)),lip*.85)
    limb=np.clip((y-.199)/.160,0,1)
    leg=mix(c((.22,.142,.100)),c((.58,.383,.226) if horse else (.60,.354,.173)),s(.0,.75,limb))
    leg=mix(leg,c((.69,.50,.30)),s(.18,.41,limb)*.34)
    leg*= (1+.068*np.cos(x*TAU+.3)+grain)[...,None]
    coat=pigment*(1+grain+.048*haze)[...,None]
    for i, seam in enumerate(seams):
        region=(x>=i/4)&(x<=(i+1)/4)
        ring=np.clip((x*4-i-.045)/.91,0,1)
        positions=np.asarray(seam+[seam[0]])
        us=np.interp(ring,np.arange(9)/8,positions[:,0])
        vs=np.interp(ring,np.arange(9)/8,positions[:,1])
        px=np.clip(np.round((.025+.95*us)*(n-1)).astype(int),0,n-1)
        py=np.clip(np.round((.386+.586*vs)*(n-1)).astype(int),0,n-1)
        continuity=mix(leg,coat[py,px],s(.56,.96,limb))
        leg=np.where(region[...,None],continuity,leg)
    rgb=np.where((y>=.376)[...,None],coat,leg)
    for index,name in enumerate(SWATCHES):
        u0=x*len(SWATCH)-index
        v0=np.clip((y-.042)/.123,0,1)
        lo,hi=SWATCH[name]
        ridge=np.sin(v0*(135 if name=="horn" else 20)+u0*3)*(.105 if name=="horn" else .05)
        mark=np.clip(.23+.69*v0+ridge+grain,0,1)
        rgba=mix(c(lo),c(hi),mark)
        rgb=np.where(((y<.185)&(u0>=0)&(u0<=1))[...,None],rgba,rgb)
    rgba=np.concatenate((np.clip(rgb,0,1),np.ones((n,n,1),dtype=np.float32)),axis=2)
    img=bpy.data.images.new(f'{species} | pigment atlas',width=n,height=n,alpha=False)
    img.pixels.foreach_set(rgba.astype(np.float32).ravel())
    img.update()
    img.pack()
    mat=bpy.data.materials.new(f'{species} | matte coat and keratin')
    mat.use_nodes=True
    node=mat.node_tree.nodes.new('ShaderNodeTexImage')
    node.image=img
    node.extension='EXTEND'
    shader=mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value=.88
    shader.inputs['Specular IOR Level'].default_value=.28
    mat.node_tree.links.new(node.outputs['Color'],shader.inputs['Base Color'])
    return mat

class Surface:
    def __init__(self):
        self.vertices=[]
        self.faces=[]
        self.uvs=[]
        self.smooth=[]
        self.weights=[]
    def vert(self, p, w):
        self.vertices.append(Vector(p))
        self.weights.append(w)
        return len(self.vertices)-1
    def face(self, face, uv, smooth=False):
        self.faces.append(face)
        self.uvs.append(uv)
        self.smooth.append(smooth)
    def bridge(self, a, b, mapping, u, v, smooth=False):
        n=len(a)
        for i in range(n):
            j=(i+1)%n
            t0,t1=i/n,(i+1)/n
            self.face((a[i], a[j], b[j], b[i]),[mapping(x,y) for x,y in ((u,t0),(u,t1),(v,t1),(v,t0))],smooth)
    def cap(self, ring, uv):
        self.face(tuple(ring),[uv]*len(ring))
    def object(self, name, mat):
        mesh=bpy.data.meshes.new(name+" topology")
        used=sorted({i for f in self.faces for i in f})
        remap={old:new for new,old in enumerate(used)}
        self.vertices=[self.vertices[i] for i in used]
        self.weights=[self.weights[i] for i in used]
        self.faces=[tuple(remap[i] for i in f) for f in self.faces]
        mesh.from_pydata(self.vertices,[],self.faces)
        mesh.update()
        uv=mesh.uv_layers.new()
        for p,values,smooth in zip(mesh.polygons,self.uvs,self.smooth,strict=True):
            p.use_smooth=smooth
            for idx,value in zip(p.loop_indices,values,strict=True):
                uv.data[idx].uv=value
        bm=bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
        bm.to_mesh(mesh)
        bm.free()
        mesh.update()
        obj=bpy.data.objects.new(name,mesh)
        bpy.context.collection.objects.link(obj)
        mesh.materials.append(mat)
        return obj

def unit(x):
    return max(0.,min(1.,x))

def lerp_weights(a,b,t):
    return {a:1-t,b:t} if a!=b else {a:1}

def body_mesh(surface, cfg, horse):
    body=cfg['body']
    centers=[Vector((x,0,z)) for x,z,_,_ in body]
    n=12
    rings=[]
    for i,c in enumerate(centers):
        x,z,w,r=body[i]
        d=(centers[min(i+1,len(body)-1)]-centers[max(i-1,0)]).normalized()
        up=Vector((-d.z,0,d.x))
        ring=[]
        for j in range(n):
            angle=TAU*j/n
            z_factor=math.cos(angle)
            y=math.sin(angle)*w*(.93+.09*abs(z_factor))
            p=c + up*r*z_factor + Vector((0,y,0))
            # The orbital plane is sunk between the cheek and brow at the upper side.
            if i==len(body)-5 and j in (2,n-2):
                p.y*=.91
                p.z+=.012
            if i<8:
                wgt={'torso':1}
            elif i==8:
                wgt=lerp_weights('torso','neck',.36)
            elif i==9:
                wgt=lerp_weights('torso','neck',.79)
            elif i==10:
                wgt=lerp_weights('neck','neck_tip',.29)
            elif i==11:
                wgt=lerp_weights('neck','neck_tip',.80)
            elif i==12 and not horse:
                wgt=lerp_weights('neck_tip','skull',.30)
            elif i==12:
                wgt=lerp_weights('neck_tip','skull',.62)
            elif i==13 and not horse:
                wgt=lerp_weights('neck_tip','skull',.67)
            else:
                jaw=max(0,-z_factor)*max(0,(i-13)/(len(body)-14))
                wgt=lerp_weights('skull','jaw',jaw*.83)
            ring.append(surface.vert(p,wgt))
        rings.append(ring)
    original_uv={idx:(i/(len(body)-1),j/n) for i,row in enumerate(rings) for j,idx in enumerate(row)}
    sockets={}
    excluded=set()
    for name, index in zip(('hind','fore'),cfg['sockets'],strict=True):
        for side,k in (('L',3),('R',7)):
            excluded.update((x,j) for x in (index,index+1) for j in (k,k+1))
            outline=[(index,k),(index+1,k),(index+2,k),(index+2,k+1),
                     (index+2,k+2),(index+1,k+2),(index,k+2),(index,k+1)]
            sockets[name+'.'+side]=[rings[row][j] for row,j in outline]
    for i,(a,b) in enumerate(zip(rings,rings[1:])):
        for j in range(n):
            if (i,j) in excluded:
                continue
            k=(j+1)%n
            u,v=i/(len(body)-1),(i+1)/(len(body)-1)
            surface.face((a[j],a[k],b[k],b[j]),[uv_body(x,y) for x,y in ((u,j/n),(u,(j+1)/n),(v,(j+1)/n),(v,j/n))],i not in (13,15))
    surface.cap(rings[0],uv_body(0,.5))
    nose=surface.vert(centers[-1]+Vector((.014,0,-.003)),{'skull':1})
    for j in range(n):
        surface.face((rings[-1][j],rings[-1][(j+1)%n],nose),
                     [uv_body(1,j/n),uv_body(1,(j+1)/n),uv_body(1,.24)],True)
    return sockets,rings,original_uv

def limb_mesh(surface, cfg, sockets, original_uv):
    legs={}
    seams=[]
    for name, profile in (('fore',cfg['fore']),('hind',cfg['hind'])):
        for side, sign in (('L',1),('R',-1)):
            stem=f'{name}.{side}'
            upper,lower,foot=(stem+'.'+part for part in ('upper','lower','foot'))
            rings=[]
            for k,(x,y,z,a,b) in enumerate(profile):
                points=[]
                for j in range(8):
                    t=TAU*j/8
                    points.append(Vector((x+a*math.cos(t),sign*y+b*math.sin(t),z)))
                if k==0:
                    boundary=sockets[stem]
                    options=[indices[i:]+indices[:i] for indices in (boundary,boundary[::-1]) for i in range(8)]
                    a0=min(options,key=lambda order:sum((surface.vertices[id]-p).length_squared for id,p in zip(order,points,strict=True)))
                    seams.append([original_uv[id] for id in a0])
                    for id in a0:
                        surface.weights[id]=lerp_weights('torso',upper,.32)
                    rings.append(a0)
                if k==0:
                    w=lerp_weights('torso',upper,.23)
                elif k==1:
                    w={upper:1}
                elif k==2:
                    w=lerp_weights(upper,lower,.12)
                elif k==3:
                    w=lerp_weights(upper,lower,.58)
                elif k==4:
                    w=lerp_weights(upper,lower,.91)
                elif k==5:
                    w={lower:1}
                elif k==6:
                    w=lerp_weights(lower,foot,.80)
                else:
                    w={foot:1}
                rings.append([surface.vert(p,w) for p in points])
            index=len(seams)-1
            mapping=lambda u,v:((index+.045+.91*v)/4,.200+.158*(1-u))
            for i,(a,b) in enumerate(zip(rings,rings[1:])):
                surface.bridge(a,b,mapping,i/8,(i+1)/8, i not in (4,7))
            surface.cap(rings[-1],uv_swatch('hoof',.5,.66))
            x,y,_,a,b=profile[-1]
            for toe in (-1,1):
                toe_rings=[]
                for i,(h,dx,scale) in enumerate(((.009,.009,1),(.044,.005,1.01),(.083,-.023,.82))):
                    ring=[]
                    for j in range(6):
                        t=TAU*(j+.5)/6
                        ring.append(surface.vert((x+dx+a*scale*math.cos(t),sign*y+toe*b*.48+b*.50*scale*math.sin(t),h),{foot:1}))
                    toe_rings.append(ring)
                mapping=lambda u,v:uv_swatch('hoof',v,u)
                for i,(a0,b0) in enumerate(zip(toe_rings,toe_rings[1:])):
                    surface.bridge(a0,b0,mapping,i/3,(i+1)/3)
                surface.cap(toe_rings[0],uv_swatch('hoof',.5,.13))
                surface.cap(toe_rings[-1],uv_swatch('hoof',.5,.92))
            def position(i):
                x,y,z,_,_=profile[i]
                return Vector((x,sign*y,z))
            legs[stem]=[position(0),position(3),position(6),Vector((x+.015,sign*y,.026))]
    return legs,seams

def tube(surface, pts, material, weights, n=7, smooth=False):
    centers=[Vector(p[:3]) for p in pts]
    rings=[]
    for i,(p,c) in enumerate(zip(pts,centers,strict=True)):
        d=(centers[min(i+1,len(pts)-1)]-centers[max(i-1,0)]).normalized()
        v=d.cross(Vector((0,1,0))).normalized()
        if v.length<.01:
            v=d.cross(Vector((1,0,0))).normalized()
        h=v.cross(d).normalized()
        rings.append([surface.vert(c+p[3]*(v*math.cos(TAU*j/n)+h*math.sin(TAU*j/n)),weights(i)) for j in range(n)])
    mapping=lambda u,v:uv_swatch(material,v,u)
    for i,(a,b) in enumerate(zip(rings,rings[1:])):
        surface.bridge(a,b,mapping,i/(len(rings)-1),(i+1)/(len(rings)-1),smooth)
    for ring in (rings[0],rings[-1]):
        surface.cap(ring,uv_swatch(material,.5,.5))

def details(surface, cfg, rings, horse):
    i0,i1=cfg['mane']
    vertices=surface.vertices
    # One continuous mane with a scalloped crest and overlapping planes at the tips.
    rows=[]
    steps=(i1-i0)*3
    for j in range(steps+1):
        i=i0+min(j//3,i1-i0-1)
        t=(j-(i-i0)*3)/3
        a,b=rings[i],rings[i+1]
        def on_body(k):
            return vertices[a[k]].lerp(vertices[b[k]],t)
        p=on_body(0)
        direction=(vertices[b[0]]-vertices[a[0]]).normalized()
        outward=Vector((-direction.z,0,direction.x))
        crest=math.sin(math.pi*j/steps)**.65
        variation=(.64,.95,1.22)[j%3]
        height=.014+(.136 if horse else .073)*crest*variation
        w={}
        for weights,share in ((surface.weights[a[0]],1-t),(surface.weights[b[0]],t)):
            for bone,factor in weights.items():
                w[bone]=w.get(bone,0)+share*factor
        bend=Vector((-(.018+.021*crest)*(1 if horse else .68),0,0))
        side=.031 if horse else .018
        cross=[
            on_body(10).lerp(p,.36 if horse else .64)-outward*.004,
            p+outward*height*.52+bend*.45+Vector((0,-side,.004)),
            p+outward*height+bend+Vector((0,side*.28,.006)),
            p+outward*height*.49+bend*.56+Vector((0,side,.003)),
            on_body(2).lerp(p,.32 if horse else .62)-outward*.004,
            p-outward*.032,
        ]
        rows.append([surface.vert(q,w) for q in cross])
    for i,(a,b) in enumerate(zip(rows,rows[1:])):
        mapping=lambda u,v:uv_swatch('mane',u,[.29,.56,.92,.67,.36,.13,.29][round(v*6)])
        surface.bridge(a,b,mapping,i/steps,(i+1)/steps,True)
    for row in (rows[0],rows[-1]):
        surface.cap(row,uv_swatch('mane',.5,.47))
    if horse:
        for j in (-1,0,1):
            tube(surface,[(.908,j*.021,1.724,.034),(.970,j*.027,1.719,.031),
                          (1.05,j*.033,1.676,.022),(1.12,j*.041,1.640,.004)],
                 'mane',lambda _: {'skull':1},5,True)
    for side,sign in (('L',1),('R',-1)):
        a,b=[Vector((x,sign*y,z)) for x,y,z in cfg['ears']]
        d=b-a
        half=Vector((.059,.016*sign,.01)) if horse else Vector((.059,.024*sign,-.013))
        name='ear.'+side
        outer=[a-half*.58,a+d*.44-half,b,a+d*.49+half,a+half*.50]
        edge=[surface.vert(p,lerp_weights('skull',name,.10 if idx in (0,4) else 1)) for idx,p in enumerate(outer)]
        center=sum(outer,Vector())/5
        inner=[surface.vert(p.lerp(center,.35)+Vector((.009,sign*.004,.006)),{name:1}) for p in outer]
        middle=surface.vert(center+Vector((-.010,-sign*.026,-.005)),{name:1})
        back=surface.vert(center+Vector((-.015,sign*.028,.008)),{name:1})
        for i in range(5):
            j=(i+1)%5
            surface.face((edge[i],edge[j],inner[j],inner[i]),[uv_swatch('fur',t,v) for t,v in ((.1,.30),(.4,.58),(.8,.63),(.7,.45))])
            surface.face((inner[i],inner[j],middle),[uv_swatch('ear',t,v) for t,v in ((.1,.64),(.4,.45),(.8,.10))])
            surface.face((edge[j],edge[i],back),[uv_swatch('fur',t,v) for t,v in ((.1,.27),(.4,.62),(.8,.88))])
        if not horse:
            horn=[(.816,sign*.073,2.245,.061),(.805,sign*.095,2.305,.061),(.768,sign*.119,2.365,.048),
                  (.705,sign*.14,2.405,.036),(.641,sign*.155,2.425,.025),(.581,sign*.168,2.427,.004)]
            tube(surface,horn,'horn',lambda _: {'skull':1},8)
    tail=cfg['tail']
    tube(surface,tail,'mane' if horse else 'fur',
         lambda i:lerp_weights('torso','tail',.7) if i==0 else lerp_weights('tail','tail_tip',unit((i-1)/3)),8,True)
    if not horse:
        tube(surface,tail[-4:],'mane',lambda i:{'tail_tip':1},7)
    return cfg['ears']

def build(species, folder):
    horse=species=='talvero'
    cfg=TALVERO if horse else RAMBREL
    stem=species+'-'+cfg['version']
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps=30
    surface=Surface()
    sockets,rings,original_uv=body_mesh(surface,cfg,horse)
    legs,seams=limb_mesh(surface,cfg,sockets,original_uv)
    details(surface,cfg,rings,horse)
    mesh=surface.object('Talvero' if horse else 'Rambrél',atlas(species,seams,cfg['eye']))
    mesh.data.calc_loop_triangles()
    assert len(mesh.data.loop_triangles)<=2000, len(mesh.data.loop_triangles)
    data=bpy.data.armatures.new(stem+' skeleton')
    rig=bpy.data.objects.new(stem+' rig',data)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active=rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    def add(name,head,tail,parent=None,deforms=True):
        b=data.edit_bones.new(name)
        b.head,b.tail=head,tail
        b.use_deform=deforms
        if parent:
            b.parent=data.edit_bones[parent]
        return b
    pivot=(-.14,0,cfg['withers']-.28)
    add('torso',pivot,(pivot[0],0,pivot[2]+.30))
    add('neck',cfg['neck'],cfg['mid'],'torso')
    add('neck_tip',cfg['mid'],cfg['head'],'neck')
    add('skull',cfg['head'],(cfg['head'][0]+.31,0,cfg['head'][2]-.062),'neck_tip')
    add('jaw',cfg['jaw'],(cfg['jaw'][0]+.22,0,cfg['jaw'][2]-.045),'skull')
    for side,sign in (('L',1),('R',-1)):
        a,b=cfg['ears']
        add('ear.'+side,(a[0],sign*a[1],a[2]),(b[0],sign*b[1],b[2]),'skull')
    add('tail',cfg['tail'][0][:3],cfg['tail'][3][:3],'torso')
    add('tail_tip',cfg['tail'][3][:3],cfg['tail'][-1][:3],'tail')
    for name,(a,b,c,d) in legs.items():
        add(name+'.upper',a,b,'torso')
        add(name+'.lower',b,c,name+'.upper')
        add(name+'.foot',c,d,name+'.lower')
    bpy.ops.object.mode_set(mode='OBJECT')
    groups={b.name:mesh.vertex_groups.new(name=b.name) for b in data.bones}
    for i,w in enumerate(surface.weights):
        assert abs(sum(w.values())-1)<1.e-6
        for name,value in w.items():
            if value>1.e-5:
                groups[name].add((i,),value,'REPLACE')
    mod=mesh.modifiers.new('Weighted deformation','ARMATURE')
    mod.object=rig
    # Keep the bind pose independent from the enabled animation.
    animate(rig,mesh,legs,Vector(pivot),horse)
    bpy.context.scene.frame_set(0)
    bpy.ops.export_scene.gltf(filepath=str(folder/(stem+'-LOD0.glb')),
        export_format='GLB',export_animation_mode='NLA_TRACKS',
        export_anim_slide_to_zero=True,export_image_format='JPEG',export_jpeg_quality=92,
        export_yup=True,export_apply=False,export_animations=True)
    print(stem,len(mesh.data.loop_triangles),'triangles before export',flush=True)

if __name__=='__main__':
    for arg in sys.argv[sys.argv.index('--')+1:]:
        path=Path(arg).resolve()
        build(path.name,path)

