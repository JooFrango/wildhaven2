"""Assemble the director's contact sheet from the exported models' actual WebGL captures."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
from perimeter import ROOT

PREVIEW=ROOT/'preview'
rows=[('glacial','Frente glacial','WG_05'),('praia','Praia de planície','PL_E_E · PL_E_S · PL_E_SE'),
      ('dunas','Mar de dunas','DN_09'),('falesia','Falésia de selva','JS_-3_12 · JS_-3_13'),
      ('arcos','Arcos da savana','SV2_E')]
def font(size,bold=False):
    for name in (('segoeuib.ttf' if bold else 'segoeui.ttf'),('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf')):
        try:return ImageFont.truetype(name,size)
        except OSError:pass
    return ImageFont.load_default(size=size)

def gallery():
    sheet=Image.new('RGB',(1320,1292),'#ecede6')
    draw=ImageDraw.Draw(sheet)
    draw.text((30,23),'WILDHAVEN  /  AURALIS',fill='#456455',font=font(16,True))
    draw.text((27,45),'Litoral continental',fill='#192b25',font=font(44,True))
    draw.text((972,59),'V01   /   Revisão de protótipos',fill='#43584b',font=font(21))
    for i,(kind,label,neighbors) in enumerate(rows):
        x=30+(i%2)*641;y=128+(i//2)*389
        pic=Image.open(PREVIEW/kind/'mar.jpg')
        sheet.paste(ImageOps.fit(pic,(620,288),centering=(.5,.54)),(x,y))
        draw.text((x,y+294),label,font=font(28,True),fill='#263d32')
        draw.text((x,y+335),neighbors,font=font(17),fill='#43584b')
    x,y=671,906
    pic=Image.open(PREVIEW/'glacial'/'encaixe.jpg')
    sheet.paste(ImageOps.fit(pic,(620,288)),(x,y))
    draw.text((x,y+294),'Encaixe com a montanha',font=font(28,True),fill='#263d32')
    draw.text((x,y+335),'Terreno glacial V01 e WG_05 na mesma cena',font=font(17),fill='#43584b')
    sheet.save(PREVIEW/'litoral-v01.jpg',quality=92)
def revision():
    sheet=Image.new('RGB',(1350,830),'#eeeee8')
    draw=ImageDraw.Draw(sheet)
    draw.text((22,12),'Litoral  /  Revisão de continuidade',font=font(32,True),fill='#253d34')
    for col,(key,title) in enumerate([('arcos','Savana  ·  SV2_E'),('dunas','Dunas  ·  DN_09'),('glacial','Neve  ·  WG_05')]):
        x=20+col*441
        draw.text((x,65),title,font=font(23,True),fill='#284338')
        for row,(folder,label,view) in enumerate([(key,'V01','perspectiva'),(key+'-v02','V02','perspectiva'),(key+'-v02','V02  ·  encaixe com o vizinho','encaixe')]):
            y=110+row*236
            with Image.open(PREVIEW/folder/(view+'.jpg')) as im:
                sheet.paste(ImageOps.fit(im,(430,202)),(x,y))
            draw.text((x,y+204),label,font=font(16),fill='#344c40')
    sheet.save(PREVIEW/'revisao-v02.jpg',quality=93)

if __name__=='__main__':revision()
