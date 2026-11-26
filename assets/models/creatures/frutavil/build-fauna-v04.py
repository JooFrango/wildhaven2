"""Blender generator for the Frutavil and Cromátil V04 review assets."""
import math
from pathlib import Path
import sys

import bpy
import bmesh
import numpy as np
from mathutils import Vector

sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
from fauna_motion_v04 import animate

PI=math.pi
TAU=math.tau
Y=Vector((0,1,0))
Z=Vector((0,0,1))

TILES=('body','wing','tail','crest','toe','bill','plate','limb','jaw')
BIRD={
    'body':((.50,.236,.109),(.83,.71,.50)),
    'wing':((.177,.29,.39),(.43,.62,.72)),
    'tail':((.26,.30,.35),(.65,.61,.49)),
    'crest':((.31,.122,.072),(.77,.36,.13)),
    'toe':((.144,.119,.101),(.41,.32,.22)),
    'bill':((.12,.16,.185),(.40,.44,.44)),
    'plate':((.47,.26,.093),(.66,.44,.221)),
    'limb':((.22,.14,.10),(.47,.29,.172)),
    'jaw':((.15,.16,.16),(.31,.32,.31)),
}
LIZARD={
    'body':((.24,.30,.15),(.60,.64,.38)),
    'wing':((.21,.28,.13),(.55,.57,.29)),
    'tail':((.22,.30,.14),(.49,.59,.32)),
    'crest':((.32,.15,.077),(.76,.42,.18)),
    'toe':((.14,.17,.11),(.40,.43,.26)),
    'bill':((.19,.22,.14),(.53,.59,.36)),
    'plate':((.17,.24,.15),(.51,.53,.29)),
    'limb':((.21,.28,.13),(.52,.59,.33)),
    'jaw':((.37,.16,.087),(.68,.39,.21)),
}

def v(x):
    return Vector(x)

def blend(a,b,t):
    return {a:1-t,b:t} if a!=b else {a:1}

def uv(kind,u,t):
    col,row=TILES.index(kind)%3,TILES.index(kind)//3
    return ((col+.045+.91*u)/3,(row+.045+.91*t)/3)

def paint(bird):
    n=512
    x,y=np.meshgrid(np.arange(n,dtype=np.float32)/(n-1),np.arange(n,dtype=np.float32)/(n-1))
    rng=np.random.default_rng(104 if bird else 504)
    rgb=np.full((n,n,3),np.nan,dtype=np.float32)
    def color(rgb):
        return np.array(rgb,dtype=np.float32)[None,None,:]
    def clamp(t):
        return np.clip(t,0,1)
    def s(a,b,t):
        t=clamp((t-a)/(b-a))
        return t*t*(3-2*t)
    def mix(a,b,t):
        return a+(b-a)*t[...,None]
    for i,k in enumerate(TILES):
        col,row=i%3,i//3
        u=clamp((x*3-col-.045)/.91)
        t=clamp((y*3-row-.045)/.91)
        a,b=(BIRD if bird else LIZARD)[k]
        grit=rng.normal(0,.016,u.shape)
        if k=='body':
            flank=np.minimum(t,1-t)
            if bird:
                transition=s(.225,.475,flank)
                transition*=.86+.14*np.cos(TAU*u*2-.72)
                m=mix(color(a),color(b),transition)
                m=mix(m,color((.66,.35,.15)),(1-s(.23,.46,flank))*(.33+.11*np.sin(10*u)))
                feather_row=np.floor(u*19)
                tip=abs((t*13+feather_row*.5)%1-.5)
                edge=1-s(.026,.110,abs((u*19)%1-(.85-.77*tip**2)))
                scallop=(np.sin((u+.014*np.sin(t*95))*192)*np.sin(t*146+u*48))*.021-edge*.041
                m+=scallop[...,None]
            else:
                m=mix(color(a),color(b),s(.09,.47,flank)*.86)
                m=mix(m,color((.65,.29,.13)),s(.255,.44,flank)*s(.55,.78,u)*.92)
                band=(np.sin(38*u+3*np.cos(t*TAU))*.06+np.sin(13*u+t*TAU)*.04)*(1-s(.22,.46,flank))
                gx=u*34+.071*np.sin(t*TAU*9)
                gy=t*21+np.floor(gx)*.5+.09*np.sin(u*TAU*7)
                cell=np.minimum(np.abs((gx+.5)%1-.5),np.abs((gy+.5)%1-.5))
                m*= (1+band-.10*(1-s(.018,.105,cell)))[...,None]
            # Iris and brow follow the same surface as the crown and cheek.
            uu=(u-(.863 if bird else .831))*21
            vv=(flank-(.205 if bird else .232))*15-.21*uu
            orbit=(uu/.43)**2+(vv/.43)**2
            m=mix(m,color((.79,.59,.37) if bird else (.55,.278,.108)),1-s(.71,1.32,orbit))
            m=mix(m,color((.19,.093,.050) if bird else (.19,.15,.065)),1-s(.49,.89,orbit))
            eye=(uu/.285)**2+(vv/.238)**2
            m=mix(m,color((.96,.72,.27) if bird else (.83,.63,.21)),1-s(.57,1.03,eye))
            pupil=(uu/(.165 if bird else .068))**2+(vv/.170)**2
            m=mix(m,color((.048,.030,.022)),1-s(.53,1.09,pupil))
            shine=((uu-.083)/.062)**2+((vv+.082)/.057)**2
            m=mix(m,color((.98,.92,.79)),1-s(.36,1.0,shine))
            if not bird:
                seam=(1-s(.004,.013,abs(flank-(.335+.05*np.cos(u*19)))))*s(.77,.90,u)
                m=mix(m,color((.23,.14,.077)),seam*.82)
                nostril=((u-.955)/.020)**2+((flank-.213)/.034)**2
                m=mix(m,color((.12,.126,.059)),1-s(.3,1.1,nostril))
        elif k in ('wing','tail','crest') and bird:
            tip=s(.56,1,u)
            ribs=.08*np.cos(t*TAU)+.07*np.sin(t*18+u*6)+.035*np.sin(t*112+u*36)
            m=mix(color(a),color(b),clamp(.36+tip*.40+ribs))
            shaft=1-s(.018,.058,np.abs(t-.49)+.008*np.cos(u*12))
            m=mix(m,color(b),shaft*.44*(1-s(.7,.98,u)))
            m=mix(m,color(a),s(.87,1,u)*.36)
            if k=='tail':
                tint=s(.12,.42,abs(t-.5))
                m=mix(m,color((.67,.34,.147)),tint*.87)
                accent=(1-s(.039,.115,abs(t-.5)))*s(.15,.35,u)
                m=mix(m,color((.34,.50,.62)),accent*.84)
                bar=s(.71,.78,u)*(1-s(.835,.91,u))
                m=mix(m,color((.77,.65,.43)),bar*.69)
        elif k in ('plate','tail','limb') and not bird:
            grooves=.12*np.sin(u*18+t*13)**4
            ridge=1-s(.13,.58,abs(t-.5))
            m=mix(color(a),color(b),clamp(.18+ridge*.53+grooves))
            m=mix(m,color((.57,.30,.121)),s(.66,1.,u)*(.57 if k=='plate' else .13))
        else:
            m=mix(color(a),color(b),clamp(.23+.60*u+.10*np.cos(t*TAU)))
        m=np.clip(m+grit[...,None],0,1)
        region=(x>=col/3)&(x<=(col+1)/3)&(y>=row/3)&(y<=(row+1)/3)
        rgb[region]=m[region]
    assert np.isfinite(rgb).all(), "Atlas incompleto"
    rgba=np.concatenate((rgb,np.ones((n,n,1),np.float32)),axis=2)
    name='Frutavil' if bird else 'Cromátil'
    img=bpy.data.images.new(name+' | atlas pintado',width=n,height=n,alpha=False)
    img.pixels.foreach_set(rgba.ravel())
    img.update()
    img.pack()
    mat=bpy.data.materials.new(name+' | material fosco')
    mat.use_nodes=True
    nodes=mat.node_tree.nodes
    tex=nodes.new('ShaderNodeTexImage')
    tex.image=img
    bsdf=nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value=.84 if bird else .90
    bsdf.inputs['Specular IOR Level'].default_value=.26
    mat.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
    return mat

class Surface:
    def __init__(self):
        self.vertices=[]
        self.weights=[]
        self.faces=[]
        self.coordinates=[]
        self.smoothing=[]
    def vert(self,p,w):
        self.vertices.append(v(p))
        self.weights.append(w)
        return len(self.vertices)-1
    def face(self,f,coords,smooth=False):
        self.faces.append(f)
        self.coordinates.append(coords)
        self.smoothing.append(smooth)
    def bridge(self,a,b,kind,t0,t1,smooth):
        n=len(a)
        for i in range(n):
            j=(i+1)%n
            self.face((a[i],a[j],b[j],b[i]),[uv(kind,u,t) for u,t in ((t0,i/n),(t0,(i+1)/n),(t1,(i+1)/n),(t1,i/n))],smooth)
    def cap(self,r,kind,u=.5,t=.5):
        self.face(tuple(r),[uv(kind,u,t)]*len(r))
    def rings(self,profile,n):
        centers=[v(p[:3]) for p in profile]
        result=[]
        for i,((_,_,_,w,h,weights),p) in enumerate(zip(profile,centers,strict=True)):
            axis=(centers[min(i+1,len(centers)-1)]-centers[max(i-1,0)]).normalized()
            side=Y-axis*axis.dot(Y)
            if side.length<.05:
                side=Z-axis*axis.dot(Z)
            side.normalize()
            upper=axis.cross(side).normalized()
            result.append([self.vert(p+side*w*math.sin(TAU*j/n)+upper*h*math.cos(TAU*j/n),weights(j,n) if callable(weights) else weights) for j in range(n)])
        return result
    def loft(self,profile,n,kind,smooth=True):
        rings=self.rings(profile,n)
        self.cap(rings[0],kind,.0)
        self.cap(rings[-1],kind,.99)
        for i,(a,b) in enumerate(zip(rings,rings[1:])):
            self.bridge(a,b,kind,i/(len(rings)-1),(i+1)/(len(rings)-1),smooth)
        return rings
    def blade(self,root,end,width,rise,kind,weights,normal=Z,feather=False):
        a,b=v(root),v(end)
        side=(b-a).normalized().cross(normal).normalized()
        if side.length<.05:
            side=Y
        w0,w1=weights
        if kind=='crest':
            mid=a.lerp(b,.52)+normal*rise*.42
        else:
            mid=a.lerp(b,.56)+normal*rise*.52
        points=[a-side*width*.31,a+side*width*.33,mid-side*width*.59,mid+side*width*.65,
                mid+normal*rise,b,mid-normal*rise*.48]
        uv_map=((.03,.27),(.03,.72),(.60,.08),(.60,.94),(.55,.51),(.98,.53),(.61,.51))
        faces=((0,1,4),(0,4,2),(1,3,4),(2,4,5),(4,3,5),(1,0,6),(0,2,6),(3,1,6),(2,5,6),(5,3,6))
        if feather:
            rounded=b.lerp(mid,.20)
            points.extend((rounded-side*width*.32,rounded+side*width*.37))
            uv_map+=((.86,.20),(.86,.82))
            faces=((0,1,4),(0,4,2),(1,3,4),(2,4,7),(4,8,7),(4,3,8),(7,8,5),
                   (1,0,6),(0,2,6),(3,1,6),(2,7,6),(7,5,6),(8,3,6),(5,8,6))
        p=[self.vert(point,w0 if i<2 else w1) for i,point in enumerate(points)]
        for f in faces:
            self.face(tuple(p[i] for i in f),[uv(kind,*uv_map[i]) for i in f])
    def assemble(self,name,mat):
        used=sorted({i for f in self.faces for i in f})
        indices={old:new for new,old in enumerate(used)}
        mesh=bpy.data.meshes.new(name+' | topologia')
        mesh.from_pydata([self.vertices[i] for i in used],[],[tuple(indices[i] for i in f) for f in self.faces])
        self.weights=[self.weights[i] for i in used]
        zone=mesh.uv_layers.new(name='Atlas')
        for face,coords,smooth in zip(mesh.polygons,self.coordinates,self.smoothing,strict=True):
            face.use_smooth=smooth
            for loop,coord in zip(face.loop_indices,coords,strict=True):
                zone.data[loop].uv=coord
        bm=bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
        bm.to_mesh(mesh)
        bm.free()
        mesh.update()
        mesh.calc_loop_triangles()
        obj=bpy.data.objects.new(name,mesh)
        bpy.context.collection.objects.link(obj)
        mesh.materials.append(mat)
        return obj

class Anatomy:
    def __init__(self):
        self.surface=Surface()
        self.bones={}
        self.legs={}
    def bone(self,name,a,b,parent=None):
        self.bones[name]=(a,b,parent)
    def leg(self,name,p,parent='root'):
        a,b,c,d=map(v,p)
        self.legs[name]=(a,b,c,d)
        self.bone(name+'.upper',a,b,parent)
        self.bone(name+'.lower',b,c,name+'.upper')
        self.bone(name+'.foot',c,d,name+'.lower')
    def finish(self,species,out):
        name='Frutavil' if species=='frutavil' else 'Cromátil'
        stem=species+'-v04'
        obj=self.surface.assemble(name,paint(species=='frutavil'))
        tri=len(obj.data.loop_triangles)
        assert 0<tri<=1500, (species,tri)
        skel=bpy.data.armatures.new(stem+' | esqueleto')
        arm=bpy.data.objects.new(stem+' | rig',skel)
        bpy.context.collection.objects.link(arm)
        bpy.context.view_layer.objects.active=arm
        arm.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        for name,(a,b,parent) in self.bones.items():
            bone=skel.edit_bones.new(name)
            bone.head,bone.tail=a,b
            if parent is not None:
                bone.parent=skel.edit_bones[parent]
        bpy.ops.object.mode_set(mode='OBJECT')
        groups={b.name:obj.vertex_groups.new(name=b.name) for b in skel.bones}
        for i,amounts in enumerate(self.surface.weights):
            assert abs(sum(amounts.values())-1.)<1.e-5
            for label,value in amounts.items():
                if value>1.e-5:
                    groups[label].add([i],value,'REPLACE')
        obj.modifiers.new('Deformação por pesos','ARMATURE').object=arm
        animate(arm,obj,self.legs,species)
        bpy.context.scene.frame_set(0)
        bpy.ops.export_scene.gltf(filepath=str(out/(stem+'-LOD0.glb')),export_format='GLB',
            export_animation_mode='NLA_TRACKS',export_anim_slide_to_zero=True,
            export_frame_step=2,export_image_format='JPEG',export_jpeg_quality=92,export_yup=True)
        print(stem,tri,'tris',len(skel.bones),'bones',flush=True)

def frutavil():
    a=Anatomy()
    m=a.surface
    a.bone('root',(-.10,0,.246),(-.10,0,.346))
    a.bone('neck',(.026,0,.277),(.095,0,.412),'root')
    a.bone('head',(.095,0,.412),(.178,0,.435),'neck')
    a.bone('jaw',(.148,0,.412),(.224,0,.394),'head')
    a.bone('crest',(.094,0,.485),(.007,0,.595),'head')
    a.bone('tail',(-.23,0,.252),(-.40,0,.272),'root')
    a.bone('tail_fan',(-.40,0,.272),(-.62,0,.28),'tail')
    torso=[
        (-.259,0,.239,.044,.045,'root'),(-.218,0,.249,.074,.078,'root'),
        (-.175,0,.246,.088,.103,'root'),(-.124,0,.239,.097,.111,'root'),
        (-.066,0,.239,.095,.115,'root'),(-.010,0,.244,.091,.111,'root'),
        (.036,0,.264,.074,.095,'root'),(.062,0,.291,.058,.083,blend('root','neck',.42)),
        (.072,0,.334,.045,.060,blend('root','neck',.77)),
        (.078,0,.370,.037,.042,'neck'),(.086,0,.408,.038,.041,blend('neck','head',.53)),
        (.100,0,.438,.040,.046,blend('neck','head',.78)),
        (.124,0,.446,.047,.044,'head'),(.149,0,.447,.044,.039,'head'),
        (.176,0,.439,.035,.031,'head'),(.184,0,.432,.027,.026,'head'),
    ]
    profile=[(*p[:5],{p[5]:1} if isinstance(p[5],str) else p[5]) for p in torso]
    m.loft(profile,10,'body')
    m.loft([(.154,0,.440,.032,.017,{'head':1}),(.184,0,.435,.030,.022,{'head':1}),
            (.211,0,.422,.020,.019,{'head':1}),(.231,0,.404,.014,.013,{'head':1}),
            (.230,0,.387,.004,.006,{'head':1})],8,'bill',False)
    m.loft([(.157,0,.411,.025,.009,{'jaw':1}),(.188,0,.407,.023,.008,{'jaw':1}),
            (.219,0,.395,.010,.004,{'jaw':1})],6,'jaw')
    for i in range(6):
        y=(i-2.5)*.0075
        m.blade((.107,y,.476),(-.027-i*.015,y*1.9,.550+.074*math.sin((i+1)/7*PI)),
                .032+.009*(i%2),.011,'crest',(blend('head','crest',.5),{'crest':1}),v((.32,0,1)),True)
    for i in range(-4,5):
        long=.388-.035*abs(i)-.008*(abs(i)%2)
        m.blade((-.222,i*.008,.252),(-.238-long,i*.044,.268+.035*math.cos(i*.50)),
            .070,.005+(.004 if i==0 else 0),'tail',(blend('root','tail',.65),blend('tail','tail_fan',.8)),feather=True)
    for side,sign in (('L',1),('R',-1)):
        sh=(.024,sign*.050,.289)
        elbow=(-.074,sign*.115,.280)
        wrist=(-.197,sign*.130,.233)
        upper,lower,wing=(f'wing.{side}.{k}' for k in ('upper','lower','tip'))
        a.bone(upper,sh,elbow,'root')
        a.bone(lower,elbow,wrist,upper)
        a.bone(wing,wrist,(-.348,sign*.152,.213),lower)
        m.loft([(*sh,.021,.022,blend('root',upper,.59)),
                (-.031,sign*.086,.289,.041,.032,{upper:1}),
                (*elbow,.034,.020,blend(upper,lower,.48)),
                (-.148,sign*.129,.259,.026,.014,{lower:1}),
                (*wrist,.010,.010,blend(lower,wing,.49))],7,'wing')
        for i in range(7):
            root=(-.052-i*.022,sign*(.119+i*.0035),.289-i*.0076)
            tip=(-.147-i*.033,sign*(.163+i*.007),.239-i*.010)
            w=blend(upper,lower,.42+i*.07)
            m.blade(root,tip,.043+.006*(i%2),.007,'wing',(w,blend(lower,wing,min(1,.15+i*.117))),v((0,sign*.56,.83)),True)
        for i in range(4):
            m.blade((-.032-i*.021,sign*(.127+i*.005),.300-i*.009),
                    (-.104-i*.030,sign*(.159+i*.007),.283-i*.011),
                    .034,.0055,'wing',({upper:1},blend(upper,lower,.25+i*.18)),v((.07,sign*.48,.88)),True)
        name='leg.'+side
        hip=(-.115,sign*.053,.193)
        knee=(-.067,sign*.061,.109)
        ankle=(-.096,sign*.066,.033)
        toe=(-.046,sign*.068,.013)
        a.leg(name,(hip,knee,ankle,toe))
        u,l,f=(name+'.'+k for k in ('upper','lower','foot'))
        m.loft([(*hip,.036,.036,blend('root',u,.7)),(-.096,sign*.060,.152,.029,.030,{u:1}),
                (*knee,.020,.018,blend(u,l,.38)),(-.085,sign*.067,.075,.012,.012,{l:1}),
                (*ankle,.009,.009,blend(l,f,.44)),(-.082,sign*.066,.019,.010,.010,{f:1})],7,'limb')
        toe_base=(-.086,sign*.066,.017)
        for j in (-1,0,1,2):
            rear=j==2
            end=(-.120 if rear else -.040-abs(j)*.006,sign*.066+(.009 if rear else j*.017),.0048)
            digit=f'digit.{side}.{j}'
            a.bone(digit,toe_base,end,f)
            middle=v(toe_base).lerp(v(end),.57)
            m.loft([(*toe_base,.0066,.0058,blend(f,digit,.25)),(*middle,.0048,.0050,{digit:1}),
                (*end,.0025,.0021,{digit:1})],4,'toe',False)
    return a

def cromatil():
    a=Anatomy()
    m=a.surface
    a.bone('root',(-.06,0,.148),(-.06,0,.248))
    a.bone('chest',(.139,0,.167),(.248,0,.181),'root')
    a.bone('neck',(.225,0,.173),(.319,0,.197),'chest')
    a.bone('head',(.319,0,.197),(.502,0,.190),'neck')
    a.bone('jaw',(.365,0,.155),(.496,0,.129),'head')
    raw=[
        (-.334,0,.125,.088,.064,'root'),(-.278,0,.137,.113,.077,'root'),
        (-.216,0,.146,.141,.089,'root'),(-.154,0,.154,.153,.100,'root'),
        (-.089,0,.154,.152,.106,'root'),(-.019,0,.151,.144,.103,'root'),
        (.052,0,.150,.132,.100,'root'),(.114,0,.153,.119,.094,blend('root','chest',.45)),
        (.170,0,.156,.113,.091,blend('root','chest',.78)),(.224,0,.163,.097,.082,'chest'),
        (.259,0,.174,.077,.072,blend('chest','neck',.60)),(.296,0,.183,.072,.064,blend('neck','head',.39)),
        (.334,0,.201,.098,.072,'head'),(.377,0,.205,.110,.073,'head'),
        (.426,0,.191,.089,.060,'head'),(.473,0,.174,.073,.048,'head'),
        (.520,0,.158,.055,.033,'head'),(.544,0,.158,.037,.026,'head'),
    ]
    profile=[]
    for i,p in enumerate(raw):
        tag=p[5]
        if i>=13:
            weights=lambda j,n,i=i:blend('head','jaw',max(0,-math.cos(TAU*j/n))*min(.98,(i-12)/3))
        else:
            weights={tag:1} if isinstance(tag,str) else tag
        profile.append((*p[:5],weights))
    n=12
    rings=m.rings(profile,n)
    excluded=set()
    for index,leg,x in ((1,'hind',-.207),(6,'fore',.143)):
        for side,sg,k in (('L',1,3),('R',-1,7)):
            name=f'{leg}.{side}'
            excluded.update((i,j) for i in (index,index+1) for j in (k,k+1))
            outline=[(index,k),(index+1,k),(index+2,k),(index+2,k+1),
                     (index+2,k+2),(index+1,k+2),(index,k+2),(index,k+1)]
            boundary=[rings[i][j] for i,j in outline]
            hip=(x,sg*.109,.151)
            knee=(x-.037 if leg=='fore' else x+.069,sg*(.200 if leg=='fore' else .217),.081)
            ankle=(x+.016 if leg=='fore' else x-.013,sg*.226,.024)
            toes=(ankle[0]+.055,sg*.239,.009)
            a.leg(name,(hip,knee,ankle,toes))
            upper,lower,foot=(name+'.'+t for t in ('upper','lower','foot'))
            first=v(hip).lerp(v(knee),.38)
            low=v(knee).lerp(v(ankle),.61)
            profiles=[(*first,.050,.045,blend('root',upper,.57)),(*knee,.038,.032,blend(upper,lower,.39)),
                      (*low,.025,.020,{lower:1}),(*ankle,.020,.014,blend(lower,foot,.82)),
                      (*v(ankle).lerp(v(toes),.46),.030,.014,{foot:1})]
            limb=m.rings(profiles,8)
            opts=[b[i:]+b[:i] for b in (boundary,boundary[::-1]) for i in range(8)]
            ordered=min(opts,key=lambda b:sum((m.vertices[j]-m.vertices[k]).length_squared for j,k in zip(b,limb[0],strict=True)))
            for idx in ordered:
                base='chest' if leg=='fore' else 'root'
                m.weights[idx]=blend(base,upper,.24)
            limb.insert(0,ordered)
            for i,(aa,bb) in enumerate(zip(limb,limb[1:])):
                m.bridge(aa,bb,'limb',i/5,(i+1)/5,True)
            m.cap(limb[-1],'limb',.64,.5)
            for j in range(4):
                end=(toes[0]+.033-.007*abs(j-1.2),toes[1]+sg*(j-1.65)*.017,.0043)
                toe0=(toes[0]-.028,toes[1]+sg*(j-1.65)*.009,.014)
                med=v(toe0).lerp(v(end),.69)
                m.loft([(*toe0,.0080,.0080,{foot:1}),(*med,.0060,.0060,{foot:1}),(*end,.0021,.0023,{foot:1})],4,'toe',False)
    for i,(aa,bb) in enumerate(zip(rings,rings[1:])):
        for j in range(n):
            if (i,j) in excluded:
                continue
            k=(j+1)%n
            x,y=i/(len(rings)-1),(i+1)/(len(rings)-1)
            m.face((aa[j],aa[k],bb[k],bb[j]),[uv('body',u,t) for u,t in ((x,j/n),(x,(j+1)/n),(y,(j+1)/n),(y,j/n))],i not in (12,14,16))
    m.cap(rings[0],'body',0,.5)
    m.cap(rings[-1],'body',1,.33)
    tail=[
        (-.302,0,.127,.104,.063),(-.371,0,.124,.092,.056),(-.459,0,.113,.074,.047),
        (-.554,0,.094,.061,.039),(-.651,0,.075,.052,.035),(-.754,.007,.061,.043,.028),
        (-.861,.013,.051,.034,.023),(-.963,.019,.047,.025,.019),(-1.052,.028,.050,.017,.014),
        (-1.138,.045,.063,.011,.009),(-1.189,.069,.074,.0035,.004),
    ]
    tail=[(-.302+(x+.302)*.87,y,z,w,h) for x,y,z,w,h in tail]
    starts=(0,3,5,7,9)
    for i,j in enumerate(starts):
        a.bone('tail.'+str(i),tail[j][:3],tail[starts[i+1] if i+1<len(starts) else 10][:3],'root' if not i else 'tail.'+str(i-1))
    weights=[blend('root','tail.0',.76),{'tail.0':1},blend('tail.0','tail.1',.39),blend('tail.0','tail.1',.63),
             blend('tail.1','tail.2',.42),blend('tail.1','tail.2',.66),blend('tail.2','tail.3',.45),blend('tail.2','tail.3',.67),
             blend('tail.3','tail.4',.41),blend('tail.3','tail.4',.68),{'tail.4':1}]
    m.loft([(*p,w) for p,w in zip(tail,weights,strict=True)],8,'tail')
    for i in range(8):
        x=.217-i*.069
        z=.224+.025*math.sin((i+1)/9*PI)
        for s in (-1,1):
            w=blend('root','chest',max(0,.82-i*.214))
            m.blade((x,s*.038,z-.016),(x-.101,s*(.075+.017*math.sin(i*.5)),z+.006),
                    .072 if i<6 else .053,.0062,'plate',(w,w),Z)
    for i,j in enumerate(range(2,len(tail)-1)):
        x,y,z,w,h=tail[j]
        m.blade((x+.021,y,z+h*.82),(x-.042,y+.008,z+h+.014-i*.0013),.036-i*.0023,.0053,'plate',(weights[j],weights[j]))
    for s in (-1,1):
        m.blade((.379,s*.061,.266),(.285,s*.076,.299),.041,.013,'crest',({'head':1},{'head':1}))
    return a

if __name__=='__main__':
    for arg in sys.argv[sys.argv.index('--')+1:]:
        out=Path(arg).resolve()
        factory={'frutavil':frutavil,'cromatil':cromatil}[out.name]
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.context.scene.render.fps=30
        factory().finish(out.name,out)

