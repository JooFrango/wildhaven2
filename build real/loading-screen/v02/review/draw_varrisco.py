"""Desenha as doze poses do Varrisco cartum nas coordenadas nativas do painel."""
from pathlib import Path
from math import sin, cos, pi
import json
from PIL import Image, ImageDraw

root=Path(__file__).resolve().parent.parent
ink='#302832'
skin='#b86739'
light='#e09b54'
shade='#894234'
belly='#f2c780'
crest='#443341'
sheet=Image.new('RGBA',(128*12,64))
tracks=[]
def pixel(x,y):return round(x),round(y)
for frame in range(12):
    t=2*pi*frame/12
    bob=round(-1.6*cos(2*t))
    im=Image.new('RGBA',(128,64))
    d=ImageDraw.Draw(im)
    marks={}
    def shape(points,color,outline=None):
        d.polygon([pixel(x,y) for x,y in points],fill=color,outline=outline)
    def body(points,color,outline=None):
        shape([(x,y+bob) for x,y in points],color,outline)
    def limb(points,width,color,highlight):
        points=[pixel(x,y) for x,y in points]
        for w,c in [(width+2,ink),(width,color)]:
            d.line(points,fill=c,width=w,joint='curve')
        d.line(points[:2],fill=highlight,width=max(1,width//3))
    def hind(k,far):
        phase=k*2*pi/12
        if k<=5:fx,fy=75-4*k,61
        else:
            u=(k-5)/7
            fx,fy=55+10*(1-cos(pi*u)),61-13*sin(pi*u)
        hip=(64,35+bob);knee=(73+4*cos(phase),44+bob-3*sin(phase))
        hock=(fx-6,fy-6)
        limb([hip,knee],9,'#6c4848' if far else skin,'#805251' if far else light)
        limb([knee,hock,(fx,fy-2)],4,'#604048' if far else shade,'#745058' if far else '#cb8150')
        shape([(fx-2,fy-4),(fx+2,fy-4),(fx+4,fy-3),(fx+8,fy-3),(fx+9,fy-1),(fx+3,fy),(fx-2,fy)],'#705052' if far else '#c18452',ink)
        d.point(pixel(fx+8,fy-2),fill='#ebca96')
        marks['footR' if far else 'footL']=pixel(fx+4,fy)
    def arm(k,far):
        swing=cos(k*2*pi/12)
        hand=(90-4*swing,41+bob+2*swing)
        limb([(84,30+bob),(81-3*swing,37+bob),hand],3,'#74454a' if far else skin,'#96564a' if far else light)
        x,y=hand
        shape([(x-1,y-1),(x+3,y-2),(x+5,y),(x+5,y+3),(x+2,y+1),(x,y+2)],'#a87d61',ink)
        marks['handR' if far else 'handL']=pixel(x+4,y+2)
    hind((frame+6)%12,True);arm((frame+6)%12,True)
    tip=round(3*sin(t-.7));mid=round(2*sin(t+.3))
    body([(66,23),(52,24),(40,28),(27,30+mid),(17,29+tip),(7,24+tip),(4,24+tip),(12,33+tip),(25,37+mid),(41,38),(55,35),(65,32)],skin,ink)
    body([(9,27+tip),(22,33+mid),(34,33+mid),(48,29),(58,28),(50,32),(36,36),(23,35+mid),(14,32+tip)],light)
    marks['tailD']=pixel(4,24+tip+bob)
    # Sawtooth dorsal silhouette, swept backwards toward the long balancing tail.
    for x,y,h in [(38,29,4),(46,26,6),(54,23,7),(63,21,8),(72,21,7),(81,22,5),(89,19,5)]:
        body([(x-3,y+3),(x-6,y-h),(x-2,y-h+1),(x+5,y+1)],crest,ink)
        body([(x-5,y-h+1),(x-2,y-h+2),(x+1,y-1)],'#ac7050')
    body([(47,29),(53,23),(63,20),(74,20),(84,23),(91,19),(96,13),(103,12),(107,20),(100,28),(92,31),(86,36),(77,39),(65,40),(54,37)],skin,ink)
    body([(54,25),(63,22),(74,22),(81,24),(76,26),(65,25),(58,29),(51,31)],light)
    body([(60,35),(72,35),(82,31),(91,25),(96,22),(95,28),(85,35),(76,38),(66,39)],'#dfaa69')
    for x,y in [(58,25),(66,23),(74,24),(81,25)]:
        body([(x-2,y),(x+2,y),(x+3,y+5),(x+1,y+8),(x,y+4)],shade)
    hind(frame,False);arm(frame,False)
    # Stepped jaw, raised orbital ridge, eye and teeth stay readable at native scale.
    nod=round(sin(t)*1.3)
    def head(points,color,outline=None):body([(x,y+nod) for x,y in points],color,outline)
    head([(90,20),(91,14),(96,10),(103,9),(108,12),(111,14),(119,15),(122,17),(121,20),(114,22),(104,23),(101,28),(94,28)],skin,ink)
    head([(94,15),(97,11),(104,11),(108,14),(101,13),(97,16)],light)
    head([(99,21),(108,19),(119,18),(119,20),(111,22),(105,23),(101,26),(97,25)],ink)
    head([(101,25),(111,22),(117,21),(114,24),(106,27),(100,28)],belly,ink)
    head([(107,20),(110,20),(108,23)],'#fff0c3')
    head([(114,19),(116,19),(115,21)],'#fff0c3')
    head([(98,15),(104,15),(102,18),(99,18)],'#ffe391',ink)
    head([(96,13),(101,13),(105,15),(100,15)],crest)
    head([(117,16),(120,17),(117,18)],ink)
    sheet.paste(im,(frame*128,0));tracks.append(marks)
sheet.save(root/'assets/varrisco.png')
path=root/'motion.js'
motion=json.loads(path.read_text(encoding='utf-8-sig').split('=',1)[1].strip().rstrip(';'))
motion.update(varrisco=tracks,contacts={'footL':0,'footR':6})
path.write_text('const motion = '+json.dumps(motion,separators=(',',':'))+';\n',encoding='utf8')
