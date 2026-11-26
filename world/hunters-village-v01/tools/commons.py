"""Surface structures and herbaceous understory. They share the same four-stage plan."""
import math
from facilities import fire
from layout import terrace, town_height, PATHS


def stone(k,x,y,z,rx,ry,h,tile='stone',tone=1):
    rng=k.rng;n=7
    dx=rng.uniform(-.12,.12)*rx;dy=rng.uniform(-.14,.14)*ry
    rot=rng.random()*.4
    base=[]; mid=[];top=[]
    for i in range(n):
        a=rot+i*math.tau/n
        xx=rx*math.cos(a)*rng.uniform(.87,1.1);yy=ry*math.sin(a)*rng.uniform(.89,1.09)
        base.append((x+xx*.89,y+yy*.89,z))
        mid.append((x+xx,y+yy,z+h*.51))
        top.append((x+xx*.70+dx,y+yy*.72+dy,z+h*rng.uniform(.84,1.01)))
    for i in range(n):
        j=(i+1)%n
        k.face([base[i],base[j],mid[j],mid[i]],tile,tint=tone*.88)
        k.face([mid[i],mid[j],top[j],top[i]],tile,tint=tone)
    k.face(top,tile,tint=min(1,tone*1.04))


def bridge(k,stage):
    y=-23;lo=-8.1;hi=4.0;width=2.7+.31*stage;h=.22
    for sign in [-1,1]:
        yy=y+sign*(width*.5-.15)
        k.log((lo,yy,h-.15),(hi,yy,h-.15),.21,None,'bark',8)
        for xx in [lo+.35,(lo+hi)/2,hi-.35]:
            k.log((xx,yy,-2.70),(xx,yy,h+1.22),.13,None,'oak',7)
        k.log((lo+.35,yy,h+1),(hi-.35,yy,h+1),.093,None,'oak' if stage>=2 else 'linen',6)
    num=20 if stage==1 else 30
    for i in range(num):
        x=lo+(i+.5)*(hi-lo)/num
        if stage==1:k.log((x,y-width*.5,h-.025),(x,y+width*.5,h-.025),.285,None,'bark',7)
        else:k.box(x,y,h,(hi-lo)/num-.016,width+.08*math.sin(i),.13,'boards',.84+.14*(i%3)/2)
    return [[(lo+hi)/2,y,hi-lo,width,.36]]


def greens(k,x,y,z,scale,flower=False):
    for i in range(5):
        a=1.51*i+x
        dx,dy=scale*math.cos(a),scale*math.sin(a)
        k.face([(x,y,z),(x+dx*.38-dy*.18,y+dy*.38+dx*.18,z+scale*.64),
                (x+dx*.85,y+dy*.85,z+scale*.88),(x+dx*.43+dy*.14,y+dy*.43-dx*.14,z+scale*.46)],'moss',
                tint=(.73,.89,.67) if i%2 else (1,.96,.62))
    if flower:
        k.log((x,y,z),(x,y,z+scale*1.77),.015,None,'moss',4)
        for i in range(3):
            k.log((x,y,z+scale*(1.08+.21*i)),(x,y,z+scale*(1.31+.21*i)),scale*.14,scale*.07,'linen',5,(.76,.46,.91))


def public_space(k,stage):
    walk=bridge(k,stage)
    # Two continuous retaining banks, broken where people can climb through.
    for y,maxh,runs in [(15.5,3.75,[(-38,-9.3),(2.0,15.6),(24.8,36)]),
                         (6.7,1.79,[(-28,-10.5),(1.7,14.3),(26,38)])]:
        for a,b in runs:
            low=terrace(y-2.9)
            for row in range(3 if maxh>2 else 2):
                count=max(1,int((b-a)/1.85))
                for i in range(count):
                    x=a+(b-a)*(i+.5)/count
                    yy=y+.29*row+.23*math.sin(x*.68+row)
                    z=low+row*maxh/(3 if maxh>2 else 2)-.22
                    stone(k,x,yy,z,1.14,.94,maxh/(3 if maxh>2 else 2)+.36,tone=.74+.19*k.rng.random())
                    if not k.lod and row==1 and i%3==1:greens(k,x,yy-.8,z+.24,.39)
    # Grand stair rises on the measured town terraces. Pillars stand outside its clear width.
    for x,lo,hi in [(-4,5.1,11.3),(-4,12.9,21.1),(19,5.1,11.1),(19,13.1,21.1),(-14,-20,-13.8)]:
        steps=max(2,round((hi-lo)/(.70 if stage==1 else .46)))
        width=(3.2 if stage==1 else 4.5) if x==-4 else 2.65
        for i in range(steps):
            ya=lo+(hi-lo)*i/steps;yb=lo+(hi-lo)*(i+1)/steps
            top=terrace(yb)+.09
            k.box(x,(ya+yb)/2,terrace(ya)-.25,width,(yb-ya)+.01,max(.12,top-terrace(ya)+.25),'stone' if stage>=2 else 'boards',.79+.16*(i%3)/2)
            walk.append([x,(ya+yb)/2,width,yb-ya,top])
        for sign in [-1,1]:
            xx=x+sign*(width/2+.16)
            if stage==1:
                k.log((xx,lo,terrace(lo)+.83),(xx,hi,terrace(hi)+.83),.08,None,'oak',7)
            for yy in [lo,hi]:
                if stage>=2:stone(k,xx,yy,terrace(yy)-.12,.37,.42,.65)
                else:k.post(xx,yy,terrace(yy),1,.115,'oak')
    # A low ceremonial hearth leaves clear paths on both sides of the square.
    cx,cy=-1.1,.5;z=terrace(cy);r=1.13 if stage==1 else 1.68
    for i in range(11):
        a=i*math.tau/11
        stone(k,cx+r*math.cos(a),cy+r*math.sin(a),z-.04,.43,.36,.44,tone=.72+.13*(i%3))
    if not k.lod:fire(k,cx,cy,z+.09,1.37)
    if stage>=3:
        for x,y in [(-10,-2),(5,3),(9,-17),(-17,11),(-29,-19),(26,0),(-9,22),(1,22)]:
            z=terrace(y)
            k.post(x,y,z,3.62,.15)
            k.log((x,y,z+3.42),(x+.89,y,z+3.42),.09,None,'oak',7)
            k.log((x,y,z+2.7),(x+.69,y,z+3.43),.065,None,'oak',6)
            k.lantern(x+.76,y,z+2.55,.84)
            if stage==4 and x in [-10,-9,1,26]:k.flag(x-.53,y,z+2.81,.74,1.48)
        for x in [-11,3]:
            k.post(x,21.9,terrace(22),4.6,.21)
            k.flag(x+.50,21.9,terrace(22)+4.34,1.19,2.23)
    if stage==4:
        # Hemp cord and individual cut pennants along the south market approach.
        for lo,hi,yy in [(6,20,-5),(-33,-20,-16)]:
            zh=terrace(yy)+3.85
            for end in [lo,hi]:k.post(end,yy,terrace(yy),4.04,.12)
            for i in range(12):
                x=lo+(hi-lo)*i/12;x2=lo+(hi-lo)*(i+1)/12
                h=zh-.72*math.sin(i/12*math.pi);h2=zh-.72*math.sin((i+1)/12*math.pi)
                k.log((x,yy,h),(x2,yy,h2),.026,None,'linen',5)
                k.face([(x+.04,yy,h-.02),(x2-.13,yy,h2-.02),((x+x2)/2,yy+.025,(h+h2)*.5-.52)],['hide','linen','moss'][i%3])
    if not k.lod:
        for x,y in [(-34,-4),(-18,17),(4,28),(-36,12),(25,-25)]:
            z=terrace(y)
            if stage<=2:
                for i in range(4):k.log((x,y+i*.40,z+.21),(x+3.2,y+i*.40,z+.21),.20,None,'bark',7)
                k.crate(x+3.8,y,z,.8)
            else:k.barrel(x,y,z,.44,.95)
        for x,y in [(-20,-19),(7,-19),(-14,6),(3,14),(-34,15),(28,15),(26,-23),(-35,-28),(9,26)]:
            for i in range(16):
                px=x+k.rng.uniform(-2.4,2.4);py=y+k.rng.uniform(-1.5,1.5)
                greens(k,px,py,town_height(px,py)-.04,k.rng.uniform(.21,.62),i%4==0)
    return walk

