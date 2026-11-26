"""Workplaces, village furniture and public routes. Dimensions are in metres."""
import math
from carpentry import hut, hall, roof, tusks
from layout import terrace, town_height, channel_x


def fire(k,x,y,z,s):
    for i in range(5):
        a=i*math.tau/5;px=x+.22*s*math.cos(a);py=y+.22*s*math.sin(a)
        k.curve([(px,py,z),(px+.08*s,py,z+.28*s),(px-.09*s,py+.12*s,z+(.72+.13*(i%3))*s)],
                [.16*s,.22*s,.015*s],'linen',5,(1,.34 if i%2 else .60,.055))


def awning(k,w,d,z,tile='linen',high=0,posts=True):
    for x in [-w/2,w/2]:
        for y in [-d/2,d/2]:
            h=z+high*(y/d+.5)
            if posts:k.post(x,y,0,h+.31,.135,'oak')
    for i in range(6):
        x1=(i/6-.5)*w;x2=((i+1)/6-.5)*w
        points=[(x1,-d/2-.32,z-.16),(x2,-d/2-.32,z-.16),(x2,0,z-.45+high*.4),(x1,0,z-.45+high*.4)]
        k.face(points,tile,tint=.77+.22*(i%2))
        k.face([points[3],points[2],(x2,d/2+.3,z+high),(x1,d/2+.3,z+high)],tile,tint=.77+.22*(i%2))
        k.face([points[0],points[1],(x2,-d/2-.35,z-.46),(x1+.12,-d/2-.35,z-.6)],tile,tint=.76+.2*(i%2))
    k.log((-w/2,-d/2,z),(w/2,-d/2,z),.11,None,'beam',6)


def forge(k,stage,w,d):
    f=1 if stage==1 else 1.3
    k.box(0,0,-.16,w,d,.34,'stone')
    x=-2.0;y=1.3
    for s in [-1,1]:
        k.solid(x+s*1.12*f,y,.13,1.02*f,2.8*f,2.15*f,'stone')
    k.solid(x,y+1.1*f,.13,3.0*f,.66*f,2.66*f,'coal')
    # Voussoirs form the actual opening of the hearth.
    for i in range(9):
        a=i*math.pi/9;b=(i+1)*math.pi/9
        ring=[(x+math.cos(t)*r*f, y-1.17*f, 1.12*f+math.sin(t)*r*f) for t,r in [(a,.81),(b,.81),(b,1.45),(a,1.45)]]
        back=[(px,py+1.15*f,pz) for px,py,pz in ring]
        k.face(ring,'stone',tint=.77+.19*(i%3)/2);k.face(back[::-1],'stone')
        for j in range(4):k.face([ring[j],back[j],back[(j+1)%4],ring[(j+1)%4]],'stone')
    k.box(x,y,.18,2.0*f,2*f,.48*f,'coal')
    k.curve([(x,y+.48*f,2.2*f),(x,y+.6*f,3.6*f),(x+.2*f,y+.85*f,4.4*f),
             (x+.2*f,y+.85*f,(5.9+stage*.57)*f)],[1.67*f,1.13*f,.77*f,.63*f],'stone',8)
    k.log((x+.2*f,y+.85*f,(5.9+stage*.57)*f),(x+.2*f,y+.85*f,(6.12+stage*.57)*f),.81*f,.84*f,'iron',8)
    fire(k,x,y-1.0*f,.63*f,1.25*f)
    # Offset smithy canopy keeps the chimney outside the leather roof.
    for xx in [-.35,w/2]:
        for yy in [-d/2,d/2]:k.post(xx,yy,0,3.65+.35*(yy>0),.22)
    for i in range(4):
        xx=-.60+i*(w/2+.94)/4; x2=xx+(w/2+.94)/4
        k.face([(xx,-d/2-.6,3.40),(x2,-d/2-.6,3.40),(x2,0,3.32),(xx,0,3.32)],'hide')
        k.face([(xx,0,3.32),(x2,0,3.32),(x2,d/2+.4,4.15),(xx,d/2+.4,4.15)],'hide')
    if stage>=3:tusks(k,w*.21,-d*.51,3.55,1.32,1.06)
    if not k.lod:
        k.log((1,-1.7,0),(1,-1.7,.73),.47,.4,'bark',8)
        k.box(1,-1.7,.7,.92,.48,.30,'iron')
        k.curve([(.98,-1.7,1.01),(1.30,-1.7,1.10),(1.95,-1.7,1.10)],[.27,.23,.017],'iron',5)
        for i in range(stage+1):
            xx=w*.30+i*.17
            k.log((xx,1.65,.18),(xx+.17,1.75,1.85),.055,.05,'oak',7)
            k.box(xx+.17,1.75,1.68,.36,.16,.23,'iron')
        k.barrel(w*.36,-2.7,.12)
        if stage>=2:k.flag(2.5,-d*.5-.35,3.64,.85,1.24,'banner')


def market(k,stage,w,d):
    awning(k,w,d,3.0,'linen',.56)
    for s in [-1,1]:
        k.solid(s*w*.29,-d*.22,0,w*.33,1.25,.93,'boards')
        if not k.lod:
            for i in range(4):
                x=s*w*.29+(i-1.5)*.52
                k.log((x,-d*.22,.93),(x,-d*.22,1.27),.25,.32,'clay',8)
                k.log((x,-d*.22,1.26),(x,-d*.22,1.29),.24,None,'coal',8)
        if stage>=3:k.flag(s*w*.41,-d*.53,2.97,.66,1.04)
    if stage==4:
        for x in [-3,0,3]:
            k.lantern(x,-d*.52,2.12,.6)
        k.barrel(w*.43,-d*.12,0)


def tower(k,stage,w,d):
    half=w*.34;h=6.4+.95*(stage-2)
    for s in [-1,1]:
        for t in [-1,1]:
            k.log((s*half*1.22,t*half*1.22,0),(s*half,t*half,h+.88),.22,.14,'oak',8)
        k.log((-half*1.2,s*half*1.2,.45),(half,s*half,h-.4),.13,None,'beam',7)
        k.log((s*half*1.2,-half*1.2,.45),(s*half,half,h-.4),.13,None,'beam',7)
        k.log((-half,s*half,h+.66),(half,s*half,h+.66),.11,None,'oak',6)
    k.box(0,0,h-.29,w,d,.34,'boards')
    for s in [-1,1]:
        k.post(s*.46,-half-.36,0,h+.22,.09)
    if not k.lod:
        for i in range(1,int(h/.38)):
            k.log((-.47,-half-.36,i*.38),(.47,-half-.36,i*.38),.059,None,'oak',6)
    if stage>=3:
        for s in [-1,1]:
            for t in [-1,1]:k.post(s*half,t*half,h,2.2,.13)
        for a,b in [((-1,-1),(1,-1)),((1,-1),(1,1)),((1,1),(-1,1)),((-1,1),(-1,-1))]:
            k.face([(a[0]*w*.59,a[1]*d*.59,h+2.13),(b[0]*w*.59,b[1]*d*.59,h+2.13),(0,0,h+4.1)],'slate')
        k.post(0,0,h+4,1.55,.075,'oak')
        k.face([(0,0,h+5.45),(1.38,0,h+5.13),(.86,0,h+4.98),(0,0,h+4.84)],'hide')
    k.flag(0,-half-.30,h+.62,1.22,2.15)


def training(k,stage,w,d):
    for i in range(stage+1):
        x=(i-stage/2)*2.08;y=d*.30
        k.log((x-.48,y-.38,0),(x,y,2),.10,None,'oak',7)
        k.log((x+.48,y+.38,0),(x,y,2),.10,None,'oak',7)
        for j,(r,tile) in enumerate([(.85,'linen'),(.65,'hide'),(.40,'linen'),(.16,'hide')]):
            k.log((x,y-.018*j,1.92),(x,y-.15-.017*j,1.92),r,r,tile,14)
    k.fence((-w*.49,-d*.38),(-w*.49,d*.48),0)
    k.fence((-w*.49,d*.48),(w*.49,d*.48),0)
    if stage>=2:
        k.post(w*.33,-d*.12,0,1.82,.15)
        k.log((w*.33,-d*.12,1.8),(w*.33,-d*.12,2.20),.41,.27,'linen',7)
        k.log((w*.33-.81,-d*.13,1.47),(w*.33+.81,-d*.13,1.42),.13,None,'hide',6)
    if stage>=3:
        for s in [-1,1]:k.post(s*w*.5,-d*.49,0,3.6,.22)
        k.log((-w*.53,-d*.49,3.42),(w*.53,-d*.49,3.51),.2,None,'oak',7)
        tusks(k,0,-d*.49,3.55,1.75,1.22)


def garden(k,w,d):
    for s in [-1,1]:
        k.fence((s*w*.5,-d*.5),(s*w*.5,d*.5),0)
        k.fence((s*1.3,-d*.5),(s*w*.5,-d*.5),0)
    k.fence((-w*.5,d*.5),(w*.5,d*.5),0)
    for row in range(3):
        yy=(row-1)*2.35
        k.box(0,yy,-.02,w*.73,1.36,.16,'clay',.47)
        for sy in [-1,1]:k.log((-w*.38,yy+sy*.73,.13),(w*.38,yy+sy*.73,.13),.09,None,'oak',7)
        for j in range(12 if not k.lod else 5):
            x=(j/(11 if not k.lod else 4)-.5)*w*.65
            yy2=yy+.2*math.sin(j*13)
            for a in range(4):
                dx=.35*math.cos(a*1.57+j);dy=.35*math.sin(a*1.57+j)
                k.face([(x,yy2,.15),(x+dx*.48-dy*.35,yy2+dy*.48+dx*.35,.34),
                        (x+dx,yy2+dy,.68),(x+dx*.5+dy*.25,yy2+dy*.5-dx*.25,.38)],'moss')
            if row==2 and not k.lod:
                k.log((x,yy2,.3),(x,yy2,.95),.025,None,'moss',4)
                k.log((x,yy2,.83),(x,yy2,1.02),.085,.025,'linen',5,(.85,.48,.86))


def stable(k,w,d,stage):
    roof(k,w,d,2.92,2.01,1,'slate')
    for s in [-1,1]:
        for t in [-1,0,1]:k.post(s*w*.5,t*d*.5,0,3.05,.18)
        k.solid(s*w*.5,0,0,.18,d,1.52,'boards')
    k.solid(0,d*.5,0,w,.19,1.7,'boards')
    for x in [-w/3,0,w/3]:
        k.fence((x,0),(x,d*.49),0)
        if not k.lod:k.box(x+1,d*.34,0,1.5,1.0,.75,'linen',(.9,.73,.38))


def cart(k,x,y,z):
    k.box(x,y,z+.57,1.49,2.05,.19,'boards')
    for s in [-1,1]:
        k.box(x+s*.71,y,z+.72,.13,2.08,.63,'boards')
        px=x+s*.89
        # Open rim and spokes, not a solid disk.
        for i in range(12):
            a=i*math.tau/12;b=(i+1)*math.tau/12
            p=(px,y+.63*math.cos(a),z+.66+.63*math.sin(a))
            q=(px,y+.63*math.cos(b),z+.66+.63*math.sin(b))
            k.log(p,q,.074,None,'iron',5)
            if i%2==0:k.log((px,y,z+.66),p,.055,None,'oak',5)
        k.log((x+s*.63,y-.95,z+.6),(x+s*.5,y-2.55,z+.36),.1,None,'oak',6)
    k.crate(x,y+.12,z+.77,.8)


def facility(k,id_,level,w,d):
    if id_=='hall':hall(k,level,w,d)
    elif id_=='forge':forge(k,level,w,d)
    elif id_.startswith('house'):hut(k,w,d,level)
    elif id_=='tavern':hut(k,w,d,level,'tavern')
    elif id_=='store':
        if level==1:awning(k,w,d,2.5,'linen',.56)
        else:hut(k,w,d,level,'store')
        if not k.lod:
            for i in range(level):k.crate(-w*.4+i*.82,-d*.59,0,.86)
            k.barrel(w*.43,-d*.6,0)
    elif id_=='workshop':
        hut(k,w,d,level,'workshop')
        if not k.lod:
            k.box(-w*.31,-d*.56,.72,2.2,.73,.18,'boards')
            for s in [-1,1]:k.post(-w*.31+s*.8,-d*.56,0,.8,.12)
            k.log((w*.32,-d*.6,.75),(w*.32+.28,-d*.6,.75),.52,None,'stone',12)
            k.post(w*.32,-d*.6,0,.72,.18)
    elif id_=='market':market(k,level,w,d)
    elif id_.startswith('tower'):tower(k,level,w,d)
    elif id_=='training':training(k,level,w,d)
    elif id_=='herbs':garden(k,w,d)
    elif id_=='stable':stable(k,w,d,level)
    elif id_=='transport':
        awning(k,w*.8,d*.8,3,'hide',.5)
        cart(k,w*.3,-d*.68,0)
        k.post(-w*.38,-d*.53,0,3.8,.15)
        k.box(-w*.38,-d*.53,3.32,1.9,.12,.36,'boards')
        k.flag(-w*.38,-d*.56,3.32,.64,1.0)


def interior(k,id_,w,d,level):
    if id_=='hall' or id_=='tavern' or id_.startswith('house'):
        home=id_.startswith('house')
        for s in [-1,1]:
            x=s*w*.29
            k.box(x,0,.71,1.04,d*.48,.16,'boards')
            for t in [-1,1]:
                k.post(x,t*d*.19,0,.77,.12)
                k.box(x+s*.84,t*d*.12,.39,.43,d*.21,.14,'oak')
                k.post(x+s*.84,t*d*.12,0,.42,.12)
            if home:k.box(x,d*.27,.31,1.2,1.82,.25,'linen')
        if id_=='hall':
            k.flag(0,d*.48,3.3,1.63,2.37)
            tusks(k,0,d*.45,2.81,1.28,1.1)
        else:k.barrel(w*.32,d*.31,.17)
    elif id_ in ('forge','workshop','store'):
        for j in range(3):
            k.crate(w*.30,(j-1)*1.06,.18,.91)
        k.box(-w*.28,d*.32,.81,2.3,1.05,.19,'oak')
        for s in [-1,1]:k.post(-w*.28+s*.83,d*.32,.16,.69,.13)
        k.barrel(0,d*.31,.16)

