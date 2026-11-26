from pathlib import Path
import sys,re,subprocess,json,shutil
ROOT=Path(__file__).resolve().parents[1]
base=(ROOT/'source/base_build.py').read_text()
render=(ROOT/'source/base_render.py').read_text()
# Cycle 1: head. Wedge, cheek, snout, nostrils and jaw with deeper throat.
s=base
s=s.replace("[(1.20,1.27,.20,.19),(1.39,1.32,.285,.23),(1.58,1.35,.31,.22),(1.78,1.34,.255,.16),(2.04,1.30,.205,.11),(2.25,1.29,.155,.086),(2.34,1.285,.09,.061)]", "[(1.20,1.30,.205,.20),(1.37,1.36,.30,.25),(1.53,1.39,.325,.24),(1.70,1.39,.285,.19),(1.87,1.35,.222,.145),(2.06,1.31,.177,.105),(2.23,1.28,.132,.085),(2.31,1.265,.09,.060)]")
s=s.replace("[(1.32,1.18,.19,.09),(1.50,1.13,.263,.095),(1.71,1.045,.218,.075),(1.94,.99,.175,.058),(2.16,.963,.135,.049),(2.27,.962,.08,.035)]", "[(1.29,1.21,.20,.13),(1.46,1.13,.275,.15),(1.64,1.015,.235,.12),(1.85,.96,.18,.084),(2.05,.93,.128,.056),(2.22,.945,.082,.038)]")
s=s.replace("[(1.37,1.19,.16,.08),(1.51,1.16,.222,.09),(1.73,1.11,.18,.08),(1.97,1.08,.12,.057),(2.13,1.07,.065,.035)]", "[(1.32,1.22,.17,.10),(1.48,1.18,.235,.13),(1.69,1.12,.175,.10),(1.91,1.055,.12,.065),(2.10,1.03,.06,.035)]")
s=s.replace("[1.67,side*.278,1.405]", "[1.66,side*.279,1.455]").replace(".095*math.sin(th)",".079*math.sin(th)").replace(".052*math.sin(th)",".042*math.sin(th)").replace(".077*math.cos(th)",".065*math.cos(th)").replace(".077*math.cos(.035", ".065*math.cos(.035")
s=s.replace("((1.43,side*.235,1.49),.07,.06),((1.60,side*.28,1.49),.067,.045),((1.79,side*.25,1.475),.05,.04),((1.91,side*.20,1.42),.012,.015)","((1.39,side*.22,1.52),.084,.07),((1.54,side*.28,1.55),.077,.054),((1.70,side*.28,1.51),.062,.036),((1.86,side*.22,1.445),.04,.024),((1.99,side*.175,1.39),.012,.012)")
s=s.replace("x=1.68+j*.093;y=side*(.19-.014*j);z=1.208-.009*j", "x=1.67+j*.10;y=side*(.20-.020*j);z=1.238-.014*j")
s=s.replace("# Low swept nape/dorsal scales",'''    # recessed-looking nostril, small anatomical dark cavity shell
    P([((2.145,side*.139,1.319),.027,.021),((2.19,side*.139,1.31),.018,.012)],'mouth','nostril'+str(side),6)
    # smaller lower teeth, rooted in jaw, directed upward and slightly back
    for j in range(4):
        x=1.72+j*.12;y=side*(.17-.021*j);z=1.025-.017*j
        P([((x,y,z),.022,.02),((x+.005,y,z+.045),.013,.012),((x-.02,y,z+.073),.003,.003)],'tooth','lower_tooth'+str(side)+str(j),5)
# Low swept nape/dorsal scales''')
# Avoid >5k triangle count by trimming superfluous lower tooth detail and keeping 12 sides on brow? total 4342+~300.
stages=[s]
# cycle 2: torso arch, neck angle, strong shoulders and haunches, articulated splayed feet, curved tail.
s=s.replace("[(-3.32,.23,.025,.024),(-3.08,.26,.047,.044),(-2.75,.30,.085,.078),(-2.37,.38,.128,.12),(-1.99,.52,.19,.17),(-1.64,.68,.27,.23),(-1.27,.78,.36,.30),(-.91,.84,.49,.38),(-.57,.86,.49,.43),(-.19,.86,.48,.45),(.20,.88,.51,.47),(.56,.93,.53,.47),(.82,.99,.43,.38),(1.04,1.08,.32,.32),(1.25,1.18,.255,.26),(1.46,1.24,.245,.235)]", "[(-3.32,.42,.025,.024),(-3.08,.40,.057,.051),(-2.75,.38,.10,.10),(-2.37,.43,.16,.145),(-1.99,.55,.24,.20),(-1.64,.69,.31,.26),(-1.27,.83,.40,.32),(-.91,.91,.52,.42),(-.57,.95,.56,.48),(-.19,.94,.55,.47),(.20,.92,.51,.41),(.56,.91,.49,.41),(.82,.98,.38,.33),(1.04,1.09,.30,.29),(1.25,1.22,.265,.26),(1.46,1.30,.265,.23)]")
s=s.replace("((.58,side*.31,1.03),.23,.28),((.48,side*.52,.79),.25,.27),((.29,side*.73,.53),.19,.19),((.40,side*.82,.35),.145,.16),((.59,side*.87,.14),.115,.105),((.73,side*.87,.095),.155,.079)", "((.57,side*.30,1.07),.245,.28),((.54,side*.52,.86),.29,.285),((.32,side*.73,.62),.21,.21),((.43,side*.82,.40),.153,.18),((.68,side*.85,.17),.125,.115),((.82,side*.86,.115),.17,.093)")
s=s.replace("((-.91,side*.31,.93),.27,.31),((-.77,side*.54,.73),.30,.29),((-.59,side*.78,.51),.225,.21),((-.80,side*.89,.33),.14,.15),((-.93,side*.96,.15),.12,.12),((-.78,side*.98,.095),.17,.08)","((-.94,side*.32,1.0),.30,.32),((-.81,side*.55,.84),.33,.31),((-.55,side*.77,.62),.235,.23),((-.76,side*.87,.39),.155,.17),((-.94,side*.93,.19),.135,.125),((-.77,side*.94,.115),.18,.095)")
s=s.replace("o=(j-1.5)*.082;dx=.20+.045*(1-abs(j-1.5)/1.5)","o=(j-1.5)*.093;dx=.24+.065*(1-abs(j-1.5)/1.5)").replace("fy+dy*.7,.096","fy+dy*.65,.108").replace("fy+dy*1.55,.073","fy+dy*1.45,.085").replace("fy+dy*1.9,.06","fy+dy*1.85,.067").replace(".054,.045",".061,.051").replace(".047,.037",".050,.041").replace("c[0]+.079,c[1]+dy*.17,.059","c[0]+.105,c[1]+dy*.17,.073").replace("c[0]+.13,c[1]+dy*.24,.026","c[0]+.165,c[1]+dy*.24,.023")
# Tail curve deforms all authored parts consistently. Keep whole animal Y-up at export.
s=s.replace("# merge into one primitive", """# Sweep tail gently in plan, leaving pelvis/limbs untouched.
for vv,ff,tt,nn in parts:
    if nn=='core':
        k=np.clip((-vv[:,0]-1.25)/2.07,0,1);vv[:,1]+=.62*k*k
# merge into one primitive""")
# Feedback from cycle 1 close-up: tooth roots must penetrate the jaw surface.
s=s.replace("x=1.67+j*.10;y=side*(.20-.020*j);z=1.238-.014*j", "x=1.67+j*.10;y=side*(.175-.018*j);z=np.interp(x,[1.53,1.70,1.87,2.06,2.23,2.31],[1.39-.24,1.39-.19,1.35-.145,1.31-.105,1.28-.085,1.265-.06])+.063")
s=s.replace("x=1.72+j*.12;y=side*(.17-.021*j);z=1.025-.017*j", "x=1.72+j*.12;y=side*(.15-.019*j);z=np.interp(x,[1.64,1.85,2.05,2.22],[1.015+.12,.96+.084,.93+.056,.945+.038])-.025")
stages.append(s)
# Cycle 3: distinctive palette/scale rhythm, lower integrated nape scutes.
s=s.replace("green=np.array([49,137,45]); dark=np.array([15,72,38]); lime=np.array([103,157,36]); gold=np.array([246,203,39]); cream=np.array([198,166,75])", "green=np.array([65,155,40]); dark=np.array([12,74,44]); lime=np.array([139,191,40]); gold=np.array([255,218,26]); cream=np.array([231,191,67])")
s=s.replace("freq=10.2 if t=='body' else 2.7", "freq=12.0 if t=='body' else 2.1").replace("ph=freq*u+0.36*np.sin(2*np.pi*v)+.09*np.sin(u*53+v*18)+.04*np.sin(u*111-v*37)","ph=freq*u+0.50*np.sin(2*np.pi*v)+.045*np.sin(u*53+v*18)+.022*np.sin(u*111-v*37)").replace("(d<.22)*mask; inner=(d<.115+.035*np.sin(u*38+v*29))*mask", "(d<.31)*mask; inner=(d<.17+.025*np.sin(u*38+v*29))*mask")
s=s.replace("stripe=np.abs(np.abs(v-.5)-(.29+.055*np.sin(u*3.1)))", "stripe=np.abs(np.abs(v-.5)-(.27+.065*np.sin(u*3.1)))").replace("band=(stripe<.047)*(1-belly); core=(stripe<.024)*(1-belly)","band=(stripe<.10)*(1-belly); core=(stripe<.047)*(1-belly)")
s=s.replace("row=np.floor(v*32); sx=(u*45+(row%2)*.5)%1; sy=(v*32)%1", "row=np.floor(v*24); sx=(u*36+(row%2)*.5)%1; sy=(v*24)%1")
s=s.replace("(-20*np.maximum((edge-.83)/.17,0)+5*np.sin(sy*np.pi))", "(-28*np.maximum((edge-.80)/.20,0)+11*np.sin(sy*np.pi))")
s=s.replace("((x+.07,0,z-.055),w,.06),((x-.02,0,z+.045),w*.75,.043),((x-.16,0,z+h),.006,.008)","((x+.09,0,z-.065),w*1.12,.075),((x-.005,0,z+.025),w*.86,.050),((x-.19,0,z+h*.72),.006,.008)")
# Update scute bases to revised axial profile, with roots inside shell.
s=s.replace("(1.37,1.46,.16,.09),(1.16,1.43,.19,.10),(.96,1.35,.18,.11),(.74,1.32,.17,.12),(.49,1.34,.16,.12),(.24,1.32,.145,.11),(-.02,1.29,.14,.10),(-.27,1.27,.13,.10),(-.54,1.25,.12,.09),(-.80,1.21,.11,.09),(-1.05,1.13,.10,.08),(-1.30,1.03,.085,.065),(-1.56,.9,.07,.05)","(1.37,1.51,.18,.10),(1.16,1.41,.18,.11),(.96,1.35,.17,.12),(.74,1.30,.16,.12),(.49,1.31,.16,.12),(.24,1.32,.15,.12),(-.02,1.38,.15,.12),(-.27,1.40,.14,.11),(-.54,1.40,.13,.10),(-.80,1.33,.11,.09),(-1.05,1.24,.10,.08),(-1.30,1.10,.085,.065),(-1.56,.94,.07,.05)")
# Add physical swept scales in paired rows at nape (not color overlays).
s=s.replace("# Sweep tail gently", """for side in (-1,1):
    for j,(x,z,y) in enumerate([(1.44,1.50,.19),(1.26,1.46,.19),(1.08,1.38,.18)]):
        P([((x+.045,side*y,z-.045),.075,.045),((x-.065,side*(y+.035),z+.025),.063,.029),((x-.205,side*(y+.045),z+.075),.004,.004)],'crest','nape'+str(side)+str(j),7)
# Sweep tail gently""")
s=s.replace("vv[:,1]+=.62*k*k", "vv[:,1]+=.68*k*k;vv[:,0]-=.20*k*k")
stages.append(s)
# Cycle 4, feedback from 03 head close-up: taper snout cap, deeper lower cheek,
# sharpen mouth outline and shorten internal mouth (not a floating tongue).
s=s.replace("(1.53,1.39,.325,.24),(1.70,1.39,.285,.19),(1.87,1.35,.222,.145),(2.06,1.31,.177,.105),(2.23,1.28,.132,.085),(2.31,1.265,.09,.060)","(1.53,1.39,.325,.24),(1.70,1.39,.285,.18),(1.87,1.35,.23,.132),(2.06,1.32,.184,.105),(2.25,1.285,.13,.074),(2.30,1.275,.045,.030)")
s=s.replace("(1.46,1.13,.275,.15),(1.64,1.015,.235,.12),(1.85,.96,.18,.084),(2.05,.93,.128,.056),(2.22,.945,.082,.038)","(1.46,1.12,.275,.15),(1.64,.993,.235,.13),(1.85,.92,.18,.092),(2.11,.90,.13,.061),(2.24,.924,.038,.023)")
s=s.replace("(1.48,1.18,.235,.13),(1.69,1.12,.175,.10),(1.91,1.055,.12,.065),(2.10,1.03,.06,.035)","(1.48,1.14,.235,.125),(1.65,1.085,.181,.085),(1.79,1.02,.125,.06),(1.90,.975,.035,.026)")
s=s.replace("[1.64,1.85,2.05,2.22],[1.015+.12,.96+.084,.93+.056,.945+.038]", "[1.64,1.85,2.11,2.24],[.993+.13,.92+.092,.90+.061,.924+.023]")
s=s.replace("[1.39-.24,1.39-.19,1.35-.145,1.31-.105,1.28-.085,1.265-.06]", "[1.39-.24,1.39-.18,1.35-.132,1.32-.105,1.285-.074,1.275-.03]")
s=s.replace(".095-(.045 if j==3 else 0)",".112-(.045 if j==3 else 0)") if False else s
s=s.replace("z-.095-(.045 if j==3 else 0)","z-.112-(.052 if j==3 else 0)")
s=s.replace("a[:]=[205,149,28]", "a[:]=[238,193,31]")
s=s.replace("N=384;", "N=512;")
s=s.replace("ridge=(np.abs(v-.5)>.42)*.35;", "lip=(np.abs(np.abs(v-.5)-.16)<.025)*np.clip((u-.15)*4,0,1);a=a*(1-lip[...,None])+gold*lip[...,None];ridge=(np.abs(v-.5)>.42)*.35;")
s=s.replace("row=np.floor(v*24); sx=(u*36+(row%2)*.5)%1; sy=(v*24)%1", "rows=24 if t=='body' else 18;cols=36 if t=='body' else 24;row=np.floor(v*rows); sx=(u*cols+(row%2)*.5)%1; sy=(v*rows)%1")
stages.append(s)
for i in ([int(sys.argv[1])] if len(sys.argv)>1 else range(1,5)):
    # Independent GLB each time, source saved for reproducibility.
    dst=ROOT/'iterations'/f'{i:02d}'; (dst/'source').mkdir(parents=True,exist_ok=True)
    src=stages[i-1].replace('v01','v02').replace('<=5000','<=5000')
    (dst/'source/build.py').write_text(src)
    subprocess.run([sys.executable,str(dst/'source/build.py')],check=True)
    rr=render.replace('v01','v02').replace('4.342 triângulos   |   5,66 m',f"{{json.loads((ROOT/'manifest.json').read_text())['triangles']}} triângulos")
    rr=rr.replace("d.text((30,859),'", "d.text((30,859),f'")
    # Better head examination: add a dedicated camera pass, don't alter the three official views.
    rr=rr.replace("fontpath='/usr/share", """cam=ren.GetActiveCamera();cam.SetFocalPoint(1.72,1.30,0);cam.SetPosition(1.72,1.42,12);cam.SetParallelScale(.55);ren.ResetCameraClippingRange();win.Render();c=vtk.vtkWindowToImageFilter();c.SetInput(win);c.ReadFrontBufferOff();c.Update();w=vtk.vtkPNGWriter();w.SetInputConnection(c.GetOutputPort());w.SetFileName(str(P/'cabeca.png'));w.Write()
fontpath='/usr/share""")
    (dst/'source/render.py').write_text(rr)
    subprocess.run([sys.executable,str(dst/'source/render.py')],check=True)
