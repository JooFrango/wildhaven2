#!/usr/bin/env python3
"""Import exported GLBs through VTK and render real geometry+UV from three angles."""
from pathlib import Path
import vtk
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'previews'; OUT.mkdir(parents=True,exist_ok=True)
CAMERAS={
 'perfil':((.0,1.75,7.0),(.08,1.35,0)),
 'frente':((7.,1.75,0),(.08,1.35,0)),
 'tres_quartos':((5.7,2.62,6.8),(.08,1.37,0)),
 'traseira':((-6.,2.4,5.4),(.0,1.37,0)),
}
def render(variant,view):
 pos,target=CAMERAS[view]
 ren=vtk.vtkRenderer();ren.SetBackground(0.91,0.88,0.84);ren.SetBackground2(.98,.97,.95);ren.SetGradientBackground(True)
 win=vtk.vtkRenderWindow();win.SetSize(1040,860);win.SetMultiSamples(8);win.SetOffScreenRendering(True);win.AddRenderer(ren)
 importer=vtk.vtkGLTFImporter();importer.SetFileName(str(ROOT/f'dodarro_{variant}_v02_blockout.glb'));importer.SetRenderWindow(win);importer.Update()
 ren.RemoveAllLights()
 for p,c,power in [((5,8,8),(1.0,.96,.89),1.4),((-4,5,-6),(.83,.88,1),.87),((-5,7,4),(1,.85,.73),.65),((4,-1,6),(1,.97,.90),.40)]:
  L=vtk.vtkLight();L.SetLightTypeToSceneLight();L.SetPosition(*p);L.SetFocalPoint(0,1.4,0);L.SetColor(*c);L.SetIntensity(power);ren.AddLight(L)
 cam=ren.GetActiveCamera();cam.SetPosition(*pos);cam.SetFocalPoint(*target);cam.SetViewUp(0,1,0);cam.ParallelProjectionOn();cam.SetParallelScale(1.63)
 ren.ResetCameraClippingRange();win.Render()
 filt=vtk.vtkWindowToImageFilter();filt.SetInput(win);filt.SetInputBufferTypeToRGB();filt.ReadFrontBufferOff();filt.Update()
 wr=vtk.vtkPNGWriter();dest=OUT/f'dodarro_{variant}_v02_REAL_{view}.png';wr.SetInputConnection(filt.GetOutputPort());wr.SetFileName(str(dest));wr.Write();win.Finalize()
 print('render',dest.name,dest.stat().st_size)
 return dest

def board(variant):
 from PIL import Image,ImageDraw,ImageFont
 views=['perfil','frente','tres_quartos']
 ims=[Image.open(OUT/f'dodarro_{variant}_v02_REAL_{v}.png').convert('RGB') for v in views]
 W=1620;H=650
 result=Image.new('RGB',(W,H),(35,35,39));d=ImageDraw.Draw(result)
 path='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
 try:title=ImageFont.truetype(path,26);medium=ImageFont.truetype(path,15);body=ImageFont.truetype(path,12)
 except:title=medium=body=ImageFont.load_default()
 d.text((26,20),f'WILDHAVEN  /  DODARRO V02  /  {variant.upper()}',fill=(242,223,187),font=title)
 d.text((27,59),'RENDERS REAIS: GLB REIMPORTADO / UV 3072 × 2560 / MODELO ESTÁTICO',fill=(198,194,182),font=medium)
 for i,im in enumerate(ims):
  crop=im.resize((518,432));xx=12+i*538
  result.paste(crop,(xx,108))
  d.text((xx+16,550),['PERFIL','FRENTE','TRÊS-QUARTOS'][i],fill=(225,216,203),font=medium)
 d.text((25,598),'BLOCKOUT V02 — A FORMA 3D AINDA PRECISA DE APROVAÇÃO ARTÍSTICA. SEM RIG OU ANIMAÇÕES.',fill=(195,193,190),font=body)
 dest=OUT/f'dodarro_{variant}_v02_PRANCHA_REAL.png';result.save(dest);print('board',dest)
if __name__=='__main__':
 for name in ('selvagem','montaria'):
  for view in CAMERAS:render(name,view)
  board(name)