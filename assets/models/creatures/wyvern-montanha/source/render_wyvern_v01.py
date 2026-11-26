#!/usr/bin/env python3
"""Real VTK GLTF importer previews: no concept-art renders claimed as GLBs."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import vtk
BASE=Path(__file__).resolve().parent.parent
OUT=BASE/'previews';OUT.mkdir(parents=True,exist_ok=True)
CAMERAS={
 'perfil':((.45,3.2,14.8),(-.15,2.1,0)),
 'frente':((13.4,3.2,0),(-.15,2.1,0)),
 'tres_quartos':((9.8,5.4,11.4),(-.12,2.0,0)),
}
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
def render(sex,kind,view):
 f=BASE/f'wyvern_{sex}_{kind}_v01_blockout.glb'
 ren=vtk.vtkRenderer();ren.SetBackground(.88,.87,.84);ren.SetBackground2(.96,.96,.94);ren.SetGradientBackground(True)
 w=vtk.vtkRenderWindow();w.SetSize(1000,830);w.SetOffScreenRendering(True);w.SetMultiSamples(4);w.AddRenderer(ren)
 imp=vtk.vtkGLTFImporter();imp.SetFileName(str(f));imp.SetRenderWindow(w);imp.Update()
 ren.RemoveAllLights()
 act=ren.GetActors();act.InitTraversal()
 for i in range(act.GetNumberOfItems()):
  prop=act.GetNextActor().GetProperty()
  prop.SetAmbient(.44);prop.SetDiffuse(.62);prop.SetSpecular(.08)
 for pos,color,intensity in [((7,10,9),(1,.95,.89),1.46),((-9,8,-6),(.80,.87,1),.79),((-5,10,6),(1,.87,.77),.45)]:
  l=vtk.vtkLight();l.SetLightTypeToSceneLight();l.SetPosition(*pos);l.SetFocalPoint(0,2.2,0);l.SetColor(*color);l.SetIntensity(intensity);ren.AddLight(l)
 pos,tar=CAMERAS[view];cam=ren.GetActiveCamera();cam.SetPosition(*pos);cam.SetFocalPoint(*tar);cam.SetViewUp(0,1,0)
 cam.ParallelProjectionOn();cam.SetParallelScale(4.0 if view!='frente' else 4.1)
 ren.ResetCameraClippingRange();w.Render()
 flt=vtk.vtkWindowToImageFilter();flt.SetInput(w);flt.SetInputBufferTypeToRGB();flt.ReadFrontBufferOff();flt.Update()
 out=OUT/f'wyvern_{sex}_{kind}_v01_REAL_{view}.png';writer=vtk.vtkPNGWriter();writer.SetFileName(str(out));writer.SetInputConnection(flt.GetOutputPort());writer.Write()
 # Minor contrast correction of a real GLB render; no generated scene imagery.
 raw=Image.open(out).convert('RGB')
 # Raise shadow floor modestly while keeping the faceted light/shadow planes.
 raw.point(lambda c:min(255,int((c/255)**.86*255))).save(out,optimize=True)
 w.Finalize();print('rendered',out.name,out.stat().st_size)

def board(sex,kind):
 views=['perfil','frente','tres_quartos'];imgs=[Image.open(OUT/f'wyvern_{sex}_{kind}_v01_REAL_{v}.png') for v in views]
 W,H=1680,670;out=Image.new('RGB',(W,H),(26,30,37));d=ImageDraw.Draw(out)
 try:t=ImageFont.truetype(FONT,28);f=ImageFont.truetype(FONT,16);g=ImageFont.truetype(FONT,13)
 except:t=f=g=ImageFont.load_default()
 d.text((25,19),f'WILDHAVEN  /  WYVERN DAS ESCARPAS V01  /  {sex.upper()} {kind.upper()}',font=t,fill=(244,231,200))
 d.text((25,62),'RENDER REAL DO GLB REIMPORTADO | TEXTURA UV | BLOQUEIO DE FORMA: AGUARDA APROVAÇÃO',font=g,fill=(188,190,194))
 for i,(view,img) in enumerate(zip(views,imgs)):
  rect=img.resize((540,445));x=12+i*558;out.paste(rect,(x,99))
  d.text((x+22,553),{'perfil':'PERFIL','frente':'FRENTE','tres_quartos':'TRÊS-QUARTOS'}[view],font=f,fill=(227,219,201))
 d.text((23,615),'SEM RIG / SEM ANIMAÇÕES / SEM LODs / 2 PATAS + 2 ASAS, NENHUM BRAÇO ADICIONAL',font=g,fill=(173,175,176))
 file=OUT/f'wyvern_{sex}_{kind}_v01_PRANCHA_GLBS_REAIS.png';out.save(file);print('board',file.name)
if __name__=='__main__':
 import sys
 variants=[(s,k) for s in ('macho','femea') for k in ('selvagem','montaria')]
 if len(sys.argv)==5 and sys.argv[1]=='--render':
  render(sys.argv[2],sys.argv[3],sys.argv[4]);sys.exit(0)
 if len(sys.argv)==4 and sys.argv[1]=='--board':
  board(sys.argv[2],sys.argv[3]);sys.exit(0)
 if len(sys.argv)>1:variants=[('macho','selvagem')]
 for sex,kind in variants:
  for view in CAMERAS:render(sex,kind,view)
  board(sex,kind)