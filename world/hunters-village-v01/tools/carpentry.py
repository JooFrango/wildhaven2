"""Modular geometry. Each facility is one atlas batch with independent collision footprints."""
import math
import random

from mathutils import Vector

TILES='oak beam bark plaster slate hide stone iron ivory brass banner linen moss clay coal boards'.split()


class MeshKit:
    def __init__(self,seed=9,lod=False):
        self.v=[]; self.f=[]; self.uv=[]; self.color=[]
        self.rng=random.Random(seed); self.lod=lod; self.blockers=[]

    def face(self,points,tile,uv=None,tint=1):
        if len(points)<3:return
        start=len(self.v);self.v.extend([tuple(p) for p in points])
        self.f.append(tuple(range(start,start+len(points))))
        if uv is None:
            if len(points)==3:uv=[(0,0),(1,0),(.5,1)]
            elif len(points)==4:uv=[(0,0),(1,0),(1,1),(0,1)]
            else:uv=[(.5+.47*math.cos(i*math.tau/len(points)),.5+.47*math.sin(i*math.tau/len(points))) for i in range(len(points))]
        idx=TILES.index(tile)
        self.uv.extend([((idx%4+.025+.95*u)/4,1-(idx//4+.025+.95*(1-v))/4) for u,v in uv])
        c=(tint,tint,tint) if isinstance(tint,(float,int)) else tint
        self.color.extend([(*c,1)]*len(points))

    def box(self,x,y,z,w,d,h,tile='oak',tint=1):
        p=[(x+a*w/2,y+b*d/2,z+k*h) for k in (0,1) for a,b in [(-1,-1),(1,-1),(1,1),(-1,1)]]
        for face in [(3,2,1,0),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)]:
            self.face([p[i] for i in face],tile,tint=tint)

    def solid(self,x,y,z,w,d,h,tile,tint=1):
        self.box(x,y,z,w,d,h,tile,tint)
        self.blockers.append([x,y,w,d,z,z+h])

    def log(self,p,q,r,s=None,tile='oak',n=8,tint=1):
        p,q=Vector(p),Vector(q);axis=q-p
        if axis.length<.0001:return
        if abs(axis.z)>1.15 and math.hypot(axis.x,axis.y)<abs(axis.z)*.22 and r>=.10:
            self.blockers.append([(p.x+q.x)/2,(p.y+q.y)/2,2*r+abs(axis.x),2*r+abs(axis.y),
                                  min(p.z,q.z),max(p.z,q.z)])
        axis.normalize();ref=Vector((0,0,1)) if abs(axis.z)<.9 else Vector((0,1,0))
        u=axis.cross(ref).normalized();v=axis.cross(u);s=r if s is None else s
        ring=[math.cos(i*math.tau/n)*u+math.sin(i*math.tau/n)*v for i in range(n)]
        bottom=[p+r*a for a in ring];top=[q+s*a for a in ring]
        for i in range(n):
            j=(i+1)%n
            self.face([bottom[i],bottom[j],top[j],top[i]],tile,[(0,0),(0,1),(1,1),(1,0)],tint)
        self.face(bottom[::-1],tile,tint=tint);self.face(top,tile,tint=tint)

    def post(self,x,y,z,h,r=.22,tile='beam'):
        self.log((x,y,z),(x,y,z+h),r,r*.87,tile,7)

    def curve(self,points,radii,tile='ivory',n=9,tint=1):
        pts=[Vector(v) for v in points];rings=[];old=None
        for i,pt in enumerate(pts):
            t=(pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)]).normalized()
            if old is None:
                old=Vector((0,1,0)) if abs(t.y)<.85 else Vector((1,0,0))
            u=(old-t*t.dot(old)).normalized();v=t.cross(u);old=u
            rings.append([pt+radii[i]*(u*math.cos(k*math.tau/n)+v*math.sin(k*math.tau/n)) for k in range(n)])
        for i in range(len(pts)-1):
            for k in range(n):
                j=(k+1)%n
                self.face([rings[i][k],rings[i][j],rings[i+1][j],rings[i+1][k]],tile,tint=tint)
        self.face(rings[0][::-1],tile,tint=tint);self.face(rings[-1],tile,tint=tint)

    def barrel(self,x,y,z,r=.48,h=1.05):
        self.blockers.append([x,y,r*1.68,r*1.68,z,z+h])
        self.curve([(x,y,z),(x,y,z+.12*h),(x,y,z+.5*h),(x,y,z+.89*h),(x,y,z+h)],
                   [r*.82,r*.92,r,r*.92,r*.81],'boards',9)
        for t in [.18,.8]:
            self.log((x,y,z+h*t),(x,y,z+h*(t+.055)),r*.958,r*.97,'iron',9)
        self.log((x,y,z+h),(x,y,z+h+.025),r*.80,r*.80,'oak',9)

    def crate(self,x,y,z,w=1):
        self.blockers.append([x,y,w,w*.82,z,z+w*.83])
        self.box(x,y,z,w,w*.82,w*.83,'boards')
        for i in [-1,1]:
            self.box(x+i*w*.41,y-w*.42,z,.09,.06,w*.83,'beam')
        self.log((x-w*.43,y-w*.43,z+.08),(x+w*.43,y-w*.43,z+w*.77),.058,None,'oak',4)

    def flag(self,x,y,z,w,h,tile='banner'):
        # Swallowtail cut and folded cloth use the same continuous UV graphic.
        cols=8
        for i in range(cols):
            a,b=i/cols,(i+1)/cols
            def pt(u,v):
                notch=.18*(1-abs(2*u-1)) if tile=='banner' else .035*math.sin(u*math.pi)
                return (x+(u-.5)*w,y+.12*math.sin(u*math.pi*4)+.10*(1-v),
                        z-h*(1-v)*(1-notch)-.09*math.sin(math.pi*u))
            self.face([pt(a,0),pt(b,0),pt(b,1),pt(a,1)],tile,[(a,0),(b,0),(b,1),(a,1)])
        self.log((x-w*.58,y,z+.035),(x+w*.58,y,z+.035),.055,None,'brass',7)

    def lantern(self,x,y,z,s=1):
        self.log((x,y,z),(x,y,z+.17*s),.31*s,.33*s,'iron',5)
        self.log((x,y,z+.15*s),(x,y,z+.78*s),.29*s,.22*s,'linen',5,(1,.69,.25))
        self.log((x,y,z+.76*s),(x,y,z+.98*s),.35*s,.07*s,'iron',5)
        for i in range(4):
            a=i*math.pi/2
            self.log((x+.26*s*math.cos(a),y+.26*s*math.sin(a),z+.16*s),
                     (x+.21*s*math.cos(a),y+.21*s*math.sin(a),z+.79*s),.024*s,None,'iron',4)

    def fence(self,a,b,z,rail=True):
        xa,ya=a;xb,yb=b
        n=max(1,round(math.hypot(xb-xa,yb-ya)/2.6))
        for j in range(n+1):
            t=j/n;self.post(xa+(xb-xa)*t,ya+(yb-ya)*t,z,1.25,.115,'oak')
        if rail:
            for h in [.44,.98]:self.log((xa,ya,z+h),(xb,yb,z+h),.074,None,'beam',6)


def tusks(k,x,y,z,span,height):
    for s in [-1,1]:
        p=[(x+s*span*a,y+span*b,z+height*c) for a,b,c in
           [(.06,.10,0),(.36,.06,.14),(.68,0,.32),(.87,-.035,.55),(.91,-.01,.76),(.81,.045,.93),(.66,.10,1.03)]]
        rr=[span*t for t in [.16,.145,.115,.084,.056,.029,.006]]
        k.curve(p,rr,'ivory',9)
        if not k.lod:
            k.curve([p[0],p[1]],[rr[0]*1.10,rr[1]*1.10],'brass',9)


def roof(k,w,d,wall,rise,cover,style='slate',fancy=False):
    # Split the flared eaves and sagging ridge into courses and longitudinal bays.
    half=w/2;depth=d/2
    stations=[-1,-.77,-.40,0,.40,.77,1] if not k.lod else [-1,0,1]
    ts=[0,.28,.62,.83,1] if not k.lod else [0,.60,1]
    def pt(s,t,v,offset=0):
        lift=(.9 if fancy else .28)*abs(v)**3
        return (s*t*(half+.95+.15*abs(v)),v*(depth+1.0)+.16*v*t,
                wall+rise*(1-t)**1.22+lift*(.68+.32*t)+.14*math.cos(t*math.pi*2)+offset)
    for s in [-1,1]:
        for j,(a,b) in enumerate(zip(stations,stations[1:])):
            if (a+b)*.5>cover:continue
            for i,(t,u) in enumerate(zip(ts,ts[1:])):
                tile=style
                # Longhouse mantle is oxblood leather, with slate along its skirt.
                if fancy and style=='hide' and u>.84:tile='slate'
                pts=[pt(s,u,a),pt(s,u,b),pt(s,t,b),pt(s,t,a)]
                if s<0:pts.reverse()
                k.face(pts,tile,tint=.90+.09*((j+2*i)%4)/3)
                if not k.lod and fancy and t>.7:
                    k.log(pt(s,t,a,.035),pt(s,t,b,.035),.062,None,'beam',5)
            k.log(pt(s,1,a),pt(s,1,b),.15 if fancy else .10,None,'oak',7)
        for v in stations if fancy and not k.lod else [-1,1]:
            for t,u in zip(ts,ts[1:]):
                k.log(pt(s,t,v,.06),pt(s,u,v,.06),.16 if fancy else .087,None,'oak',7)
    for a,b in zip(stations,stations[1:]):
        k.log(pt(1,0,a,.09),pt(1,0,b,.09),.23 if fancy else .12,None,'beam',8)
    return wall+rise+.8


def hall(k,level,w,d):
    wall=4.75;rise=5.4+level*.36; dep=d/2;half=w/2
    # Collidable open gable and side walls. Interior doors have a 3.8 m opening.
    k.box(0,0,-.30,w+.6,d+.6,.5,'stone')
    for s in [-1,1]:
        if level>=2:
            k.solid(s*half,0,.18,.32,d,2.6,'boards')
            ww=half-2.0
            k.solid(s*(2+ww/2),-dep,.18,ww,.35,2.75,'boards')
            k.solid(s*(2+ww/2),dep,.18,ww,.35,3.2,'boards')
    ys=[-dep,-dep*.5,0,dep*.5,dep]
    for j,y in enumerate(ys):
        for s in [-1,1]:
            k.box(s*half,y,-.25,.97,.98,.84,'stone')
            k.log((s*half,y,.45),(s*(half-.45),y,wall+.40),.34,.26,'oak',9)
            k.log((s*(half-.45),y,wall),(0,y,wall+rise+.13),.25,.19,'beam',8)
            if not k.lod:
                k.log((s*(half-.2),y,2.65),(s*(half-2),y,wall+.2),.16,.13,'oak',7)
                k.log((s*(half-.20),y,2.1),(s*(half-.23),y,2.36),.315,.306,'brass',8)
            if j==0:
                k.log((s*(half+1),y-1,wall+.75),(s*1.35,y-1.15,wall+rise-.2),.25,.18,'oak',8)
        k.log((-half,y,wall-.2),(half,y,wall-.2),.25,None,'oak',8)
    top=roof(k,w,d,wall,rise,{1:-.45,2:.18,3:.76,4:1}[level],'hide',True)
    if level>=3:
        for end in [-1,1]:
            yy=end*(dep+.18)
            k.face([(-half+.26,yy,wall),(half-.26,yy,wall),(0,yy,wall+rise+.23)],'boards',tint=.69)
            for s in [-1,1]:
                k.log((0,yy+end*.14,wall+.14),(s*half*.51,yy+end*.14,wall+rise*.48),.18,.14,'oak',7)
                k.flag(s*half*.66,yy+end*.29,wall+.09,1.61,3.15)
        for s in [-1,1]:
            yy=-dep-1.16
            k.curve([(s*(half+.84),yy,wall+.27),(s*(half+.37),yy,wall+1.19),
                     (s*(half-.53),yy,wall+2.26),(s*(half-1.75),yy+.08,wall+3.09)],
                    [.29,.35,.29,.07],'ivory',8)
            if level==4:
                k.curve([(s*(half+.17),yy-.02,wall+1.36),(s*(half+1.19),yy-.15,wall+2.00),
                         (s*(half+1.60),yy-.11,wall+2.77)],[.22,.14,.023],'ivory',8)
    if level>=2:
        for s in [-1,1]:
            k.log((s*2.1,-dep-.24,.2),(s*2.1,-dep-.24,wall-.18),.23,None,'beam',8)
        k.log((-2.7,-dep-.29,wall-.14),(2.7,-dep-.29,wall-.14),.33,None,'oak',8)
    tusks(k,0,-dep-.83,top-.8,2.35+level*.32,1.55+level*.37)
    if level>=3:tusks(k,0,dep+.7,top-.78,2.35,1.65)
    k.flag(0,-dep-1.1,top-.98,1.8+level*.16,3.9 if level>=3 else 2.7)
    if not k.lod:
        for s in [-1,1]:
            k.flag(s*(half-1.8),-dep-.38,wall-.32,1.03,2.05,'banner')
            if level>=2:
                k.lantern(s*2.9,-dep-.53,2.65,.92)
        if level>=3:
            for i in [-2,-1,1,2]:
                k.log((i*1.3,-dep-.45,wall+.22),(i*.65,-dep-.45,wall+rise*.59),.11,None,'oak',6)
    if level<4:
        # Scaffold actually shrinks as work finishes.
        for i in range(4-level):
            y=i*3.3-dep+3
            for xx in [half+1.1,half+2.7]:
                k.post(xx,y,0,wall+1.5,.10,'oak')
                k.log((xx,y,.4),(xx,y+2.9,wall),.08,None,'beam',5)
            k.box(half+1.9,y+1.4,wall-.75,2.05,3.05,.14,'boards')
        if not k.lod:
            for i in range(5):k.log((half+2+i*.38,dep-2,0.19),(half+2+i*.38,dep+2,.19),.18,None,'bark',7)


def hut(k,w,d,phase,role='house'):
    half=w/2;dep=d/2;wall=2.65 if role!='tavern' else 3.4
    rise=w*.34+(phase>=3)*.45
    if phase==1 and role=='house':
        # Ridge tent: split curtains leave the central opening usable.
        for s in [-1,1]:
            k.face([(s*half,-dep,0),(s*half,dep,0),(0,dep,wall),(0,-dep,wall)],'linen')
            k.face([(s*half,-dep,.05),(s*.98,-dep,.06),(0,-dep,wall)],'hide')
            k.log((s*half,-dep,0),(0,-dep,wall+.22),.10,None,'oak',7)
            k.log((s*half,dep,0),(0,dep,wall+.22),.10,None,'oak',7)
            k.blockers.append([s*(half-.3),0,.35,d,0,wall])
        k.log((0,-dep-.4,wall),(0,dep+.4,wall),.11,None,'oak',7)
        return
    k.box(0,0,-.2,w+.30,d+.30,.38,'stone')
    for s in [-1,1]:
        k.solid(s*half,0,.13,.26,d,wall-.15,'plaster')
        front=(w-2.12)/2
        k.solid(s*(1.06+front/2),-dep,.13,front,.26,wall-.15,'boards')
    k.solid(0,dep,.13,w,.25,wall-.15,'plaster')
    for yy in [-dep,0,dep]:
        for s in [-1,1]:
            k.post(s*half,yy,.08,wall+.14,.17,'beam')
            if not k.lod:
                k.log((s*(half+.05),yy,.76),(s*(half+.05),yy+d*.22,wall-.15),.086,None,'oak',6)
    for yy in [-dep,dep]:
        k.face([(-half,yy,wall),(half,yy,wall),(0,yy,wall+rise)],'boards')
        k.log((-half,yy-.10,wall-.10),(half,yy-.10,wall-.10),.18,None,'oak',7)
    roof(k,w,d,wall,rise,1,'slate' if phase>=2 else 'hide',role=='tavern')
    if not k.lod:
        for s in [-1,1]:
            k.post(s*1.06,-dep-.17,.1,wall-.12,.14)
            k.box(s*(half*.66),-dep-.16,1.32,.94,.11,.82,'beam')
            k.box(s*(half*.66),-dep-.26,1.41,.73,.07,.57,'linen',(.8,.67,.36))
            k.post(s*(half*.66),-dep-.32,1.39,.61,.045,'oak')
        if phase>=3:
            k.lantern(1.33,-dep-.35,1.91,.67)
            for i,s in enumerate([-1,1]):
                k.flag(s*(half-.6),-dep-.25,wall+.06,.49,.96,'linen')
    if role=='tavern':
        k.box(-half+.8,dep-.78,wall-.1,1,1,3.3,'stone')
        if not k.lod:k.flag(0,-dep-.5,wall+1.4,1.02,1.34)

