"""Render three views from the actual exported GLB, Y-up."""
from pathlib import Path
import vtk,numpy as np,json,hashlib
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'previews';P.mkdir(exist_ok=True)
path=ROOT/'lagarto-papagaio-v01.glb';ren=vtk.vtkRenderer();ren.SetBackground(.64,.70,.68);ren.SetBackground2(.91,.94,.90);ren.GradientBackgroundOn();win=vtk.vtkRenderWindow();win.SetOffScreenRendering(1);win.AddRenderer(ren);win.SetSize(1200,720);win.SetMultiSamples(4)
imp=vtk.vtkGLTFImporter();imp.SetFileName(str(path));imp.SetRenderWindow(win);imp.Update();ren.RemoveAllLights();ren.SetUseImageBasedLighting(False)
for pos,intensity in [((4,8,5),1.3),((-4,4,-6),.9),((4,1,-5),.75),((0,-4,3),.5)]:
 l=vtk.vtkLight();l.SetLightTypeToSceneLight();l.SetPosition(*pos);l.SetFocalPoint(0,.8,0);l.SetIntensity(intensity);ren.AddLight(l)
actors=list(ren.GetActors());assert actors
for a in actors:a.GetProperty().SetAmbient(.32);a.GetProperty().SetDiffuse(.85)
box=actors[0].GetBounds();center=np.array([(box[0]+box[1])/2,(box[2]+box[3])/2,(box[4]+box[5])/2]);print('bounds',box)
views={'perfil':((0,0,1),2.0),'frente':((1,0,0),1.05),'tres_quartos':((.68,.27,1),1.85)}
for n,(direction,scale) in views.items():
 cam=ren.GetActiveCamera();cam.SetFocalPoint(*center);cam.SetPosition(*(center+np.array(direction)*18));cam.SetViewUp(0,1,0);cam.ParallelProjectionOn();cam.SetParallelScale(scale);ren.ResetCameraClippingRange();win.Render();c=vtk.vtkWindowToImageFilter();c.SetInput(win);c.ReadFrontBufferOff();c.Update();w=vtk.vtkPNGWriter();w.SetInputConnection(c.GetOutputPort());w.SetFileName(str(P/(n+'.png')));w.Write()
fontpath='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
try: title=ImageFont.truetype(fontpath,32);label=ImageFont.truetype(fontpath,22)
except: title=label=ImageFont.load_default()
canvas=Image.new('RGB',(1800,920),(228,234,228));d=ImageDraw.Draw(canvas);d.rectangle((0,0,1800,90),fill='#172c22');d.text((35,24),'WILDHAVEN  /  LAGARTO-PAPAGAIO  /  BLOCKOUT GLB v01',font=title,fill='#f3f4e7')
for n,x,y,w,h in [('perfil',0,90,1200,720),('frente',1200,90,600,360),('tres_quartos',1200,470,600,360)]:
 im=Image.open(P/(n+'.png')).convert('RGB');im=im.resize((w,h),Image.Resampling.LANCZOS);canvas.paste(im,(x,y));d=ImageDraw.Draw(canvas);d.text((x+18,y+14),n.replace('_',' ').upper(),font=label,fill='#243c2a')
d.text((30,859),'4.342 triângulos   |   5,66 m   |   textura UV   |   render do GLB reimportado',font=label,fill='#243c2a');canvas.save(P/'3-vistas.png',optimize=True)
(ROOT/'render_report.json').write_text(json.dumps({'source_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'renderer':'VTK vtkGLTFImporter','views':list(views),'actors':len(actors)},indent=2)+'\n')
