from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
p=Path('assets/models/creatures/sirocauro/v05/previews')
old=Path('assets/models/creatures/sirocauro/v01/previews/sirocauro-v01-conceito-vs-glb.png')
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',24)
def board(images,out,labels):
    canvas=Image.new('RGB',(900,len(images)*560),(239,234,221));d=ImageDraw.Draw(canvas)
    for i,(im,label) in enumerate(zip(images,labels)):
        d.text((20,i*560+12),label,font=font,fill=(45,42,32));im=im.convert('RGB');im.thumbnail((900,510));canvas.paste(im,((900-im.width)//2,i*560+45))
    canvas.save(out)
board([Image.open(p/(x+'.png')) for x in ['perfil','frente','tres-quartos']],p/'3-vistas.png',['Perfil','Frente','Três-quartos'])
board([Image.open(old).crop((42,60,924,648)),Image.open(p/'v04-base.png'),Image.open(p/'tres-quartos.png')],p/'comparacao.png',['Arte conceitual aprovada (não GLB)','v04 — GLB anterior','v05 — novo GLB real'])
