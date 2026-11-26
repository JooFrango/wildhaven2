"""Settlement-scale detail, with open circulation around every facility."""
import math

from carpentry import tusks
from commons import greens,stone
from layout import LOTS,PATHS,terrace,town_height


def figure(k,x,y,z,angle,role,pose=0):
    # Posed residents give workstations a human scale. The game may replace this group.
    cs,sn=math.cos(angle),math.sin(angle)
    def at(p):
        a,b,h=p
        return (x+a*cs-b*sn,y+a*sn+b*cs,z+h)
    def limb(a,b,r,tile,end=None):
        k.log(at(a),at(b),r,r*.81 if end is None else end,tile,6)
    for s in [-1,1]:
        shift=(-.12 if s<0 else .10) if pose==2 else 0
        limb((s*.124,0,.92),(s*.16,shift,.51),.125,'hide')
        limb((s*.16,shift,.51),(s*.17,shift+.025,.17),.098,'beam')
        limb((s*.17,shift+.03,.12),(s*.17,shift-.16,.10),.108,'beam')
    tunic=['moss','hide','linen','slate'][role%4]
    k.curve([at((0,0,.83)),at((0,0,.99)),at((0,0,1.37)),at((0,-.025,1.45))],[.29,.205,.265,.16],tunic,7)
    limb((0,0,.99),(0,0,1.05),.221,'beam',.225)
    skin=(1,.78,.56) if role%2 else (.77,.49,.31)
    k.curve([at((0,-.03,1.43)),at((0,-.06,1.60)),at((0,-.06,1.75))],[.104,.160,.132],'ivory',7,skin)
    k.log(at((0,-.03,1.68)),at((0,-.04,1.78)),.165,.113,'beam',7)
    for s in [-1,1]:
        elbow=(s*.31,-.04 if pose!=1 else -.22,1.17 if pose!=1 else 1.29)
        hand=(s*.33,-.21,1.02) if pose==0 else ((s*.18,-.41,1.37) if pose==1 else (s*.38,-.22*s,1.04))
        limb((s*.20,0,1.38),elbow,.107,tunic);limb(elbow,hand,.074,'ivory',.055)
    if role%3==0:
        k.curve([at((0,.12,1.39)),at((0,.17,1.19)),at((0,.19,1.02))],[.17,.20,.12],'bark',7)


def rack(k,x,y,z,span=2.9):
    for s in [-1,1]:k.post(x+s*span/2,y,z,2.25,.095,'oak')
    k.log((x-span*.57,y,z+2.1),(x+span*.57,y,z+2.1),.097,None,'oak',7)
    for i in range(4):
        xx=x+(i-1.5)*span*.21
        k.log((xx,y,z+1.82),(xx,y,z+2.11),.025,None,'linen',5)
        k.face([(xx-.24,y,z+1.79),(xx-.17,y+.06,z+.81),(xx+.07,y,z+.67),
                (xx+.20,y-.03,z+1.14),(xx+.26,y,z+1.81)],'hide' if i%2 else 'linen')


def additions(k,level):
    # Split local stone into actual pavers with thickness; the dirt path below is vertex colour.
    if level>=2:
        for i in range(85 if level>=3 else 40):
            a=i*2.39996;rad=.72*math.sqrt(i)
            x=-4+rad*math.cos(a);y=1.4+rad*.66*math.sin(a)
            if math.hypot(x+1.1,y-.5)<2.05:continue
            z=town_height(x,y)
            stone(k,x,y,z-.08,.42+.12*k.rng.random(),.31+.15*k.rng.random(),.15,tone=.69+.24*k.rng.random())
    # Prominent paired totems at the bridge approach, with a clear gap between the posts.
    if level>=3:
        for s in [-1,1]:
            x=7.3;y=-23+s*2.6
            k.log((x,y,0),(x+.08,y,3.7),.34,.23,'oak',9)
            for h in [.42,.59,2.55]:k.log((x,y,h),(x,y,h+.12),.34-.024*h,None,'brass',8)
            k.curve([(x,y,3.41),(x,y-s*.10,4.08),(x+.05,y+s*.28,4.77),(x+.12,y+s*.58,5.04)],
                    [.26,.21,.13,.025],'ivory',8)
            k.flag(x+.49,y,3.05,.77,1.42)
            k.lantern(x-.56,y,2.0,.69)
    # Foreground ravine is stony and seasonal. Varied boulders follow its bed below the bridge.
    for i in range(64):
        py=-10-k.rng.random()*43
        px=-2+2.2*math.sin((py+18)/11)+k.rng.uniform(-2.9,2.9)
        if -25.3<py<-20.9:continue
        r=k.rng.uniform(.18,.75)
        stone(k,px,py,town_height(px,py)-.10,r,r*k.rng.uniform(.6,1.3),r*k.rng.uniform(.6,1.2),tone=k.rng.uniform(.57,.94))
    if level>=2:rack(k,-32,-3.5,terrace(-3.5),2.7)
    if level>=3:rack(k,29,-20.3,terrace(-20.3),3.65)
    if level>=4:
        # Second merchant stall has a distinctive green canopy and piled produce.
        for s in [-1,1]:
            for t in [-1,1]:k.post(16.5+s*2.02,-7.7+t*1.21,2.4,2.51,.105,'oak')
        for i in range(5):
            x=14.28+i*.9
            for a,b,za,zb in [(-1.51,0,4.85,5.62),(0,1.5,5.62,4.85)]:
                k.face([(x,-7.7+a,za),(x+.9,-7.7+a,za),(x+.9,-7.7+b,zb),(x,-7.7+b,zb)],'moss' if i%2==0 else 'linen')
        k.box(16.4,-8.51,2.4,3.62,.91,.95,'boards')
        for j in range(5):
            k.log((15.2+j*.60,-8.55,3.36),(15.2+j*.60,-8.55,3.6),.24,.19,'clay',7)
        for x,y in [(-17,-4),(9,-14),(25,-9),(-28,13)]:
            k.crate(x,y,terrace(y),.88);k.barrel(x+1.04,y,terrace(y),.39,.88)
    if not k.lod:
        for cx,cy in [(-19,-29),(-34,-31),(-13,-35),(5,-32),(13,-25),(19,-16),
                      (31,-7),(-32,11),(2,9),(-11,17),(6,21),(29,18),(-40,17)]:
            for i in range(16):
                x=cx+k.rng.uniform(-2.6,2.6);y=cy+k.rng.uniform(-1.6,1.6)
                greens(k,x,y,town_height(x,y)-.08,k.rng.uniform(.22,.64),i%5==0)
    if level>=2:
        # Lantern posts and benches keep the middle terrace legible on approach.
        for x,y in [(-17,1.3),(4,-1.3)]:
            z=terrace(y)
            k.box(x,y,z+.43,2.04,.45,.16,'oak')
            for s in [-1,1]:k.post(x+s*.77,y,z,.44,.12)


def residents(k,phase):
    locs=[(-29,-2.4,1.2,1,1),(-8.4,17.1,-.6,2,2),(29,1.4,2.4,0,1),
          (12,-1.1,3.1,3,1),(-24,-17,.6,0,1),(-8,1.6,2,2,0),
          (19,17,1.2,0,2),(-23,-27,2.7,2,1),(24,-21,-2.1,1,2),
          (1.65,-2.4,2.4,0,0),(11,-4.9,1.82,2,0),(-5.6,23,1.1,3,0),(27,8,1.7,3,1),
          (33,-19.3,-.15,0,1),(16,-10.4,2.6,1,0)]
    for x,y,angle,role,pose in locs[:[3,6,10,15][phase-1]]:
        figure(k,x,y,town_height(x,y),angle,role,pose)

