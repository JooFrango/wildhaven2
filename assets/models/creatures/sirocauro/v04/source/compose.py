from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
p=Path('assets/models/creatures/sirocauro/v04/previews')
old=Path('assets/models/creatures/sirocauro/v01/previews/sirocauro-v01-conceito-vs-glb.png')
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',24)
def board(paths,out,labels):
    canvas=Image.new('RGB',(900, len(paths)*560),(239,234,221));d=ImageDraw.Draw(canvas)
    for i,(im,label) in enumerate(zip(paths,labels)):
        d.text((20,i*560+12),label,font=font,fill=(45,42,32));im=im.convert('RGB');im.thumbnail((900,510));canvas.paste(im,((900-im.width)//2,i*560+45))
    canvas.save(out)
board([Image.open(p/(x+'.png')) for x in ['perfil','frente','tres-quartos']],p/'3-vistas.png',['Perfil','Frente','Três-quartos'])
concept=Image.open(old).crop((42,60,924,648))
board([concept,Image.open(p/'v03-base.png'),Image.open(p/'tres-quartos.png')],p/'comparacao.png',['Arte conceitual aprovada (não GLB)','v03 — render do GLB real','v04 — render do GLB real'])
frames=[Image.open(f).convert('RGB').quantize(colors=128) for f in sorted((p/'frames').glob('*.png'))]
assert len(frames)>60
frames[0].save(p/'animacoes.gif',save_all=True,append_images=frames[1:],duration=100,loop=0,disposal=2,optimize=True)
