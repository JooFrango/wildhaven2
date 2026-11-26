"""Bake the two additional loading scenes at their native pixel resolution."""
from pathlib import Path
from math import sin,cos,pi
import random
from PIL import Image,ImageDraw

OUT=Path(__file__).resolve().parents[1]/'assets'
INK='#352c36'
def poly(d,pts,color,edge=None):
    d.polygon([(round(x),round(y)) for x,y in pts],fill=color,outline=edge)
def line(d,pts,color,width=1):
    d.line([(round(x),round(y)) for x,y in pts],fill=color,width=width,joint='curve')

def whale(d,t):
    lift=round(5*sin(t))
    def body(pts,c,e=None):poly(d,[(x,y+lift) for x,y in pts],c,e)
    tail=6*sin(t-.8)
    body([(39,42),(23,40+tail),(10,31+tail),(1,32+tail),(6,40+tail),(18,47+tail),(8,50+tail),(4,56+tail),(24,51+tail),(44,52)],'#796557',INK)
    body([(22,43),(38,35),(49,26),(66,21),(83,20),(95,23),(107,25),(122,32),(127,39),(124,46),(114,53),(96,57),(66,57),(45,51),(27,49)],'#9e7857',INK)
    body([(32,41),(50,28),(67,23),(83,22),(101,27),(112,31),(101,32),(80,28),(62,29),(50,34)],'#cfab78')
    for x,y in [(50,29),(62,25),(75,24),(86,25)]:
        body([(x-4,y+3),(x-1,y),(x+5,y),(x+8,y+4),(x+4,y+3),(x+1,y+5)],'#756050')
    body([(74,43),(89,40),(103,38),(122,37),(125,40),(118,44),(104,47),(80,49)],INK)
    for j in range(10):
        x=87+3*j;y=43-(j//3)
        body([(x,y-2),(x+2,y-2),(x+1,y+3)],'#e4c897')
    body([(69,50),(91,47),(110,44),(124,40),(121,46),(110,52),(94,55),(70,55)],'#dbb987',INK)
    body([(66,38),(72,40),(68,47),(52,54+4*sin(t+.8)),(45,54+4*sin(t+.8)),(54,44)],'#785d52',INK)
    body([(94,32),(102,31),(101,35),(95,35)],INK)
    body([(96,33),(99,32),(98,34)],'#ffd775')
    # The belly disappears below the sand while the sand wake travels past it.
    d.rectangle((0,55,128,64),fill=(0,0,0,0))
    for j in range(17):
        u=(j/17+t/(2*pi))%1
        x=124-120*u;y=55-abs(sin(pi*u))*((j%4)+2)
        line(d,[(x-4,y+1),(x,y),(x+3,y+1)],['#f3c77f','#c38653','#edb773'][j%3],2)

def boat(d,t):
    b=round(1.5*sin(t))
    def hull(pts,c,e=None):poly(d,[(x,y+b) for x,y in pts],c,e)
    hull([(12,46),(66,46),(86,37),(80,49),(69,54),(29,55),(17,51)],'#824f38',INK)
    hull([(15,46),(64,46),(84,39),(78,45),(64,50),(24,50)],'#c88c51',INK)
    hull([(18,52),(71,52),(86,45),(82,52),(69,57),(27,58)],'#4d4544',INK)
    hull([(20,55),(69,55),(80,51),(74,55),(68,57),(27,57)],'#bcb19a')
    hull([(42,46),(46,6),(48,6),(46,46)],'#573d34',INK)
    billow=round(2*sin(t))
    hull([(47,8),(61,18),(73+billow,32),(77,35),(50,39),(43,41)],'#ead5a2',INK)
    hull([(48,13),(54,18),(62,27),(69,34),(64,35),(57,26)],'#ac5741')
    hull([(46,11),(39,19),(28+billow,31),(17,39),(39,36)],'#cba776',INK)
    hull([(47,6),(33,4+billow),(27,7+billow),(39,8)],'#ad4938',INK)
    line(d,[(47,9+b),(79,43+b)],'#705742')
    hull([(26,39),(29,38),(31,41),(31,46),(25,46)],'#3a4e54')
    hull([(27,35),(30,35),(31,37),(29,39),(26,38)],'#9e633e',INK)
    for x in (18,35,65):hull([(x,47),(x+2,47),(x+2,49),(x,49)],'#ebc580')
    for j in range(8):
        u=(j/8+t/(2*pi))%1
        line(d,[(24-23*u,58-4*sin(pi*u)),(21-23*u,59-4*sin(pi*u))],'#ecc283',2)

def velsari(d,t):
    gait=t/(2*pi);bob=round(2*cos(2*t))
    base='#ce9657'
    pale='#f2d498'
    def body(pts,c,e=None):poly(d,[(x,y+bob) for x,y in pts],c,e)
    def leg(x,shift,fore,far):
        u=(gait+shift)%1
        dx=8-48*u if u<1/3 else -8*cos(pi*(u-1/3)*1.5)
        fy=59 if u<1/3 else 59-12*sin(pi*(u-1/3)*1.5)
        ax=x+dx
        knee=(x+(.44*dx if fore else 5+.32*dx),45+bob-2*cos(2*pi*u))
        ankle=(ax-(1 if fore else 4),fy-5)
        pts=[(x,34+bob),knee,ankle,(ax,fy-2),(ax+3,fy-1)]
        line(d,pts,INK,5);line(d,pts,'#77534c' if far else base,3)
        line(d,[(ax-1,fy-1),(ax+4,fy-1)],INK,2)
    legs=[(30,.08,False,True),(53,.51,True,True),(33,0,False,False),(56,.42,True,False)]
    for args in legs[:2]:leg(*args)
    body([(30, 30), (22, 25), (20, 22), (25, 23), (32, 26)], '#f2dbac', INK)
    body([(24,30),(26,25),(34,23),(45,26),(54,24),(61,20),(65,20),(64,30),(59,36),(51,37),(41,35),(34,39),(27,38)],base,INK)
    body([(26,28),(34,25),(45,28),(54,26),(51,30),(40,30),(32,28)],'#dfaf66')
    body([(35,34),(45,32),(53,32),(59,28),(57,34),(50,36),(43,35)],pale)
    for args in legs[2:]:leg(*args)
    body([(54,28),(58,19),(61,12),(65,12),(66,19),(61,29)],base,INK)
    body([(61,14),(56,9),(52,9),(55,14),(60,17)],'#ce9a60',INK)
    body([(63,13),(62,6),(64,3),(65,9),(67,12)],'#695040',INK)
    body([(66,13),(69,6),(71,4),(70,11),(69,15)],'#846346',INK)
    body([(60,15),(64,11),(70,14),(74,18),(73,20),(67,20),(63,23),(60,21)],base,INK)
    body([(64,19),(72,18),(74,19),(69,21),(65,22)],pale)
    body([(64,15),(67,15),(66,17)],INK)
    for x in (32,37,42):body([(x,28),(x+2,29),(x+1,30)],pale)
def gravarto(d,t):
    # Brown barred monitor, wedge-shaped head and low dorsal scales (Gravarto v01 profile).
    bob=round(1.4*cos(2*t))
    def body(pts,color,edge=None):poly(d,[(x,y+bob) for x,y in pts],color,edge)
    def foot(x,phase,front,far):
        u=(t/(2*pi)+phase)%1
        dx=9-48*u if u<.375 else -9*cos(pi*(u-.375)/.625)
        y=58 if u<.375 else 58-7*sin(pi*(u-.375)/.625)
        knee=(x+(1 if front else -1)*6+dx*.45,49+bob)
        pts=[(x,37+bob),knee,(x+dx-2,y-4),(x+dx,y-1)]
        line(d,pts,INK,8);line(d,pts,'#57443f' if far else '#826047',5)
        for j in range(3):
            line(d,[(x+dx-1,y-2),(x+dx+2+j,y-2+j*.6),(x+dx+5+j,y-1+j*.4)],INK,2)
    foot(60,.5,False,True);foot(94,0,True,True)
    sway=4*sin(t-.75)
    body([(2,48+sway),(18,44+sway),(34,37+2*sin(t)),(49,30),(61,28),(68,40),(47,44),(27,46+sway),(8,50+sway)],'#89694b',INK)
    for x,y in [(17,44+sway),(28,40+sway),(39,35),(48,32)]:
        body([(x,y),(x+3,y-1),(x+2,y+6),(x,y+6)],'#59463c')
    body([(44,35),(50,29),(62,24),(78,23),(91,25),(100,28),(109,23),(116,24),(120,32),(113,37),(102,38),(92,43),(76,46),(62,45),(52,41)],'#906d4e',INK)
    body([(48,34),(57,28),(68,25),(79,25),(88,27),(77,27),(64,28),(52,34)],'#b09263')
    body([(55,39),(68,40),(84,39),(97,34),(104,32),(98,38),(86,42),(70,44),(59,42)],'#b49a72')
    for x,y in [(55,28),(65,25),(76,24),(86,25),(96,28)]:
        body([(x,y),(x+4,y),(x+2,y+5),(x-2,y+10),(x-3,y+9)],'#65503f')
    for x,y in [(28,41),(37,37),(45,33),(52,29),(60,26),(68,24),(76,24),(84,25)]:
        body([(x-3,y+1),(x,y-3),(x+3,y+1)],'#54443a')
    foot(62,0,False,False);foot(96,.5,True,False)
    nod=round(sin(t))
    def head(pts,c,e=None):body([(x,y+nod) for x,y in pts],c,e)
    head([(102,28),(105,23),(113,21),(121,22),(129,25),(134,28),(133,33),(125,36),(113,36),(106,33)],'#88674b',INK)
    head([(104,27),(110,23),(116,23),(122,25),(113,25),(108,28)],'#af8c61')
    head([(113,32),(126,32),(133,30),(132,33),(124,35),(115,35)],'#c2a67d',INK)
    head([(117,25),(122,25),(121,28),(117,28)],INK)
    head([(118,26),(120,26),(119,27)],'#efc35e')
    head([(129,27),(131,27),(131,29)],INK)

def sheet(name,width,fn):
    result=Image.new('RGBA',(width*12,64))
    for i in range(12):
        frame=Image.new('RGBA',(width,64));fn(ImageDraw.Draw(frame),i*pi/6);result.paste(frame,(width*i,0))
    result.save(OUT/(name+'.png'))
sheet('arenoceto',128,whale);sheet('barco',96,boat)
sheet('gravarto',138,gravarto);sheet('velsari',80,velsari)

def landscape(name,savanna):
    rng=random.Random(46 if savanna else 67);w=640
    colors=[('#c4a781','#dcc098'),('#b78c64','#d4ac77'),('#ad804f','#c69b5d')] if savanna else [('#ceb095','#edc7a3'),('#ca926c','#edb782'),('#bb8059','#e6a76c')]
    for k,(shade,lit) in enumerate(colors):
        im=Image.new('RGBA',(w,138));d=ImageDraw.Draw(im)
        ys=[]
        for x in range(w):
            a=x*2*pi/w
            y=round((69+16*k)+(8+4*k)*sin(a*(2+k)+k)+5*sin(3*a+.7*k)+2*sin(7*a))
            ys.append(y)
            d.line((x,y,x,137),fill=shade)
            lip=round(3+(1+sin(a*(2+k)+k+1))*5)
            d.line((x,y,x,y+lip),fill=lit)
        if savanna and k>0:
            for x in [48,151,309,427,552]:
                h=rng.randint(9,15)*k;y=ys[x]+2;tree='#806e51' if k==1 else '#645d46'
                line(d,[(x,y),(x+1,y-h//2),(x-3,y-h+4)],tree,2+k)
                for dx,dy,span in [(-7,1,9),(6,-2,11),(0,-5,8)]:
                    line(d,[(x,y-h//2),(x+dx,y-h+dy)],tree,k+1)
                    d.ellipse((x+dx-span,y-h+dy-2,x+dx+span,y-h+dy+2),fill=tree)
        im.save(OUT/f'{name}-{k}.png')
    im=Image.new('RGB',(160,21),'#bd925e' if savanna else '#d99f68');d=ImageDraw.Draw(im)
    d.rectangle((0,0,159,3),fill='#b5a563' if savanna else '#f1c181')
    for j in range(135):
        x=rng.randrange(160);y=rng.randrange(21)
        line(d,[(x,y),(x+rng.randint(1,6),y)],rng.choice(['#b78e59','#eac38a','#ce9e63']))
    im.save(OUT/(name+'-ground.png'))
landscape('dunas',False);landscape('savana',True)
