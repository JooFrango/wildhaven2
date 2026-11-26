#!/usr/bin/env python3
"""Wildhaven Fulgaronte v06: original animated v05 GLB -> improved motion curves.
Preserves original mesh, UVs, joints, skin and all non-target animations.
Produces new binary GLB; no Blender/GPU/third-party dependencies.
"""
from __future__ import annotations
import json, math, pathlib, struct, hashlib

ROOT=pathlib.Path(__file__).resolve().parents[1]
BASE=ROOT.parent/"v05"/"fulgaronte_v05_rig_animated.glb"
OUT=ROOT/"fulgaronte_v06_motion_review.glb"
TARGETS={
    "heavy_walk":(3.6,73,True),
    "charge":(1.65,57,True),
    "swim":(3.6,65,True),
    "bite_heavy":(2.25,55,False),
    "tail_sweep":(2.60,65,False),
    "overload_warning":(5.0,81,True),
    "overload_burst":(2.55,71,False),
    "overload_recovery":(4.2,73,False),
}
PI=math.pi

def smooth(x):
    u=max(0.,min(1.,x))
    return u*u*(3-2*u)
def gauss(x,c,width):
    return math.exp(-((x-c)/width)**2)
def phase_curve(t,points):
    """Piecewise smooth hermite movement through purposeful keyed poses."""
    if t<=points[0][0]: return points[0][1]
    if t>=points[-1][0]: return points[-1][1]
    for (ta,va),(tb,vb) in zip(points,points[1:]):
        if ta<=t<=tb: return va+(vb-va)*smooth((t-ta)/(tb-ta))
    return 0.
def gait(u,phase,stance=.68):
    p=(u+phase)%1.
    if p<stance:
        # grounded foot travels back relative to moving body; planted phase
        travel=.5-p/stance
        lift=0.
        toe=.01
    else:
        k=(p-stance)/(1-stance)
        travel=-.5+smooth(k)
        lift=math.sin(PI*k)**1.25
        toe=math.sin(PI*k)*.13
    return travel,lift,toe
def quat(rx,ry,rz):
    x,y,z=rx/2,ry/2,rz/2
    cx,sx=math.cos(x),math.sin(x)
    cy,sy=math.cos(y),math.sin(y)
    cz,sz=math.cos(z),math.sin(z)
    return (sx*cy*cz-cx*sy*sz,
            cx*sy*cz+sx*cy*sz,
            cx*cy*sz-sx*sy*cz,
            cx*cy*cz+sx*sy*sz)

def pose(clip,name,u):
    tau=2*PI
    p=tau*u
    rx=ry=rz=0.
    tx=ty=tz=0.
    tail= int(name.split("_")[1]) if name.startswith("tail_") else -1
    isfore=name.startswith("fore_")
    ishind=name.startswith("hind_")
    leg=isfore or ishind
    side=1 if name.endswith("_L") else -1
    phase={
        "fore_upper_L":0.0,"fore_lower_L":0.0,"fore_foot_L":0.0,
        "hind_upper_R":.25,"hind_lower_R":.25,"hind_foot_R":.25,
        "fore_upper_R":.50,"fore_lower_R":.50,"fore_foot_R":.50,
        "hind_upper_L":.75,"hind_lower_L":.75,"hind_foot_L":.75,
    }.get(name,0.)
    forefin=name.startswith("fore_fin_")
    upper="_upper_" in name
    lower="_lower_" in name
    foot="_foot_" in name

    if clip in ("heavy_walk","charge"):
        speed=1.0 if clip=="heavy_walk" else 1.55
        if leg:
            d,up,toe=gait(u,phase, .68 if clip=="heavy_walk" else .57)
            if upper:rz=speed*(.23*d-.085*up)
            if lower:rz=speed*(.12*d+.32*up)
            if foot:rz=speed*(-.23*d-.10*up+toe)
        if name in ("spine_mid","spine_chest","shoulders"):
            rx=0.025*speed*math.sin(p-.55)
            rz=0.025*speed*math.sin(2*p-.35)
        if name=="hip": rx=-.021*speed*math.sin(p-.2)
        if name=="neck": rz=-.045*speed*math.sin(p-.65);ry=.025*math.sin(p-.4)
        if name=="head": rz=.018*math.sin(p-.82);ry=-.019*math.sin(p-.7)
        if tail>=0: ry=(.035+.016*tail)*math.sin(p-.31*tail)
        if name=="rig_root":
            ty=(.038 if clip=="heavy_walk" else .085)*(.5+.5*math.cos(4*p+.4))-.023
            tx=.022*math.sin(2*p) if clip=="charge" else 0.
        if forefin:ry=side*(.035+.022*math.sin(p+phase*tau))

    if clip=="swim":
        # Axial lateral wave initiated at hip, amplified toward caudal fin.
        if name=="hip":ry=.045*math.sin(p)
        if name in ("spine_mid","spine_chest","shoulders","neck","head"):
            lag={"spine_mid":.23,"spine_chest":.55,"shoulders":.78,"neck":1.06,"head":1.26}[name]
            ry=.045*math.sin(p+lag)
        if tail>=0:
            ry=(.065+.052*tail)*math.sin(p-0.45*tail)
            rz=(.025+.012*tail)*math.sin(p-.45*tail+1.7)
        if leg:
            q=math.sin(p+(0 if isfore else PI)+ (0 if side>0 else PI))
            if upper:rz=.14*q
            if lower:rz=.17*math.sin(p+.9+(0 if side>0 else PI))
            if foot:rz=-.10*q
        if forefin:ry=side*(.20+.13*math.sin(p+(0 if side>0 else PI)))
        if name=="rig_root":ty=.065*math.sin(p+.3)
        if name=="head":rz=.035*math.sin(p-.4)

    if clip=="bite_heavy":
        # Distinct intentional choreography: see -> draw back -> open -> lunge -> snap -> grab-shake -> recover.
        anticipation=phase_curve(u,[(0,0),(.14,0),(.28,1),(.40,0),(.52,0),(.7,0),(1,0)])
        launch=phase_curve(u,[(0,0),(.29,0),(.43,1),(.53,.65),(.72,.25),(.90,0),(1,0)])
        jaw=phase_curve(u,[(0,0),(.18,.10),(.30,.92),(.44,1),(.52,0),(.62,0),(.70,.26),(.84,.05),(1,0)])
        shake=phase_curve(u,[(0,0),(.52,0),(.59,1),(.66,-1),(.73,.55),(.84,0),(1,0)])
        if name=="head":rz=.16*anticipation-.26*launch;ry=.095*shake
        if name=="neck":rz=.09*anticipation-.16*launch;ry=.035*shake
        if name=="shoulders":rz=.04*anticipation-.09*launch
        if name=="jaw":rz=-.50*jaw
        if name=="rig_root":tx=-.15*anticipation+.28*launch;ty=-.05*launch
        if leg and upper:rz= -.038*anticipation+.056*launch

    if clip=="tail_sweep":
        wind=phase_curve(u,[(0,0),(.14,.1),(.31,-1),(.38,-1),(.48,0),(.65,0),(1,0)])
        lash=phase_curve(u,[(0,0),(.30,0),(.40,.12),(.50,1),(.58,-.28),(.69,.20),(.85,0),(1,0)])
        if name=="hip":ry=.14*wind-.13*lash
        if name in ("spine_mid","shoulders"):ry=-.08*wind+.09*lash
        if tail>=0:
            c=min(1.,.4+.12*tail)
            # More latency for outer tail segments, but controlled amplitude.
            delayed=phase_curve(max(0,min(1,u-.021*tail)),[(0,0),(.29,0),(.45,.1),(.56,1),(.64,-.22),(.81,0),(1,0)])
            ry=c*(-.32*wind+.72*delayed)
            rz=(.035+.012*tail)*math.sin(PI*u)**2
        if name=="head":ry=-.10*wind+.07*lash
        if leg and upper:ry=side*.043*wind
        if name=="rig_root":ty=-.045*gauss(u,.52,.16)

    if clip=="overload_warning":
        # Three progressively stronger whole-body charging pulses, no VFX implied.
        pulse=(.38*gauss(u,.23,.065)+.65*gauss(u,.48,.06)+gauss(u,.75,.055))
        tension=phase_curve(u,[(0,0),(.35,.24),(.66,.56),(.85,.94),(.95,1),(1,0)])
        if name=="rig_root":ty=-.09*tension+.035*pulse
        if name=="head":rz=.12*pulse-.07*tension
        if name=="neck":rz=.08*pulse
        if name=="shoulders":rz=-.06*tension+.06*pulse
        if name=="jaw":rz=-.055*pulse
        if name=="hip":rx=.025*pulse
        if tail>=0:ry=(.025+.02*tail)*math.sin(6*p-.28*tail)*tension
        if leg and upper:rz=-.08*tension
        if forefin:ry=side*(.11*tension+.07*pulse)

    if clip=="overload_burst":
        brace=phase_curve(u,[(0,0),(.14,.25),(.29,1),(.40,1),(.45,0),(.68,0),(1,0)])
        blast=phase_curve(u,[(0,0),(.37,0),(.46,.60),(.51,1),(.60,.35),(.72,0),(1,0)])
        recoil=phase_curve(u,[(0,0),(.55,0),(.65,1),(.80,.47),(1,0)])
        if name=="rig_root":ty=-.22*brace+.23*blast-.16*recoil;tx=-.18*blast
        if name=="shoulders":rz=-.13*brace+.20*blast-.08*recoil
        if name=="hip":rz=-.085*brace+.11*blast-.05*recoil
        if name=="neck":rz=-.08*brace+.23*blast-.14*recoil
        if name=="head":rz=-.06*brace+.29*blast-.15*recoil
        if name=="jaw":rz=-.12*blast
        if tail>=0:ry=(.07+.029*tail)*math.sin(.35*tail+2*PI*u)*blast
        if leg and upper:rz=(-.065*brace+.14*blast-.035*recoil)
        if leg and lower:rz=(.09*brace-.15*blast+.025*recoil)
        if forefin:ry=side*(.4*blast-.14*brace)

    if clip=="overload_recovery":
        slump=phase_curve(u,[(0,1),(.16,1),(.50,.75),(.77,.18),(1,0)])
        shake=(math.sin(2*PI*u*3.5)*math.exp(-u*3.2))
        if name=="rig_root":ty=-.16*slump
        if name=="shoulders":rz=-.10*slump+.025*shake
        if name=="hip":rx=.013*shake
        if name=="neck":rz=-.11*slump
        if name=="head":rz=-.18*slump+.05*shake
        if name=="jaw":rz=-.09*slump
        if tail>=0:ry=(.035+.01*tail)*shake
    return quat(rx,ry,rz),(tx,ty,tz)

def read_glb(path):
    b=path.read_bytes()
    assert b[:4]==b"glTF" and struct.unpack_from("<I",b,8)[0]==len(b)
    jlen,jtyp=struct.unpack_from("<II",b,12)
    assert jtyp==0x4E4F534A
    g=json.loads(b[20:20+jlen])
    off=20+jlen
    binlen,bintyp=struct.unpack_from("<II",b,off)
    assert bintyp==0x004E4942
    return b,g,bytearray(b[off+8:off+8+binlen])

def main():
    data,g,bin_data=read_glb(BASE)
    assert len(g["skins"])==1 and len(g["skins"][0]["joints"])==29
    assert len(g["animations"])==22
    nodes={n.get("name"):i for i,n in enumerate(g["nodes"])}
    names=[g["nodes"][i]["name"] for i in g["skins"][0]["joints"]]
    assert "jaw" in names and "fore_foot_R" in names and "tail_6" in names
    def pack(vals,component,type_):
        raw=b"".join(struct.pack("<"+("f" if component==5126 else "H")*len(row),*row) for row in vals)
        while len(bin_data)%4:bin_data.append(0)
        o=len(bin_data);bin_data.extend(raw)
        bid=len(g["bufferViews"])
        g["bufferViews"].append({"buffer":0,"byteOffset":o,"byteLength":len(raw)})
        aid=len(g["accessors"])
        g["accessors"].append({"bufferView":bid,"componentType":component,"count":len(vals),"type":type_})
        return aid
    for a in g["animations"]:
        name=a["name"]
        if name not in TARGETS:continue
        seconds,nframes,loop=TARGETS[name]
        times=[(seconds*i/(nframes-1),) for i in range(nframes)]
        tin=pack(times,5126,"SCALAR")
        samplers=[];channels=[]
        for bn in names:
            rows=[pose(name,bn,i/(nframes-1))[0] for i in range(nframes)]
            if max(abs(x) for q in rows for x in q[:3])<1e-6:continue
            assert max(abs(sum(q*q for q in row)-1) for row in rows)<1e-4
            out=pack(rows,5126,"VEC4")
            sm=len(samplers)
            samplers.append({"input":tin,"output":out,"interpolation":"LINEAR"})
            channels.append({"sampler":sm,"target":{"node":nodes[bn],"path":"rotation"}})
        rootrows=[pose(name,"rig_root",i/(nframes-1))[1] for i in range(nframes)]
        if any(any(abs(x)>1e-6 for x in row) for row in rootrows):
            out=pack(rootrows,5126,"VEC3")
            sm=len(samplers);samplers.append({"input":tin,"output":out,"interpolation":"LINEAR"})
            channels.append({"sampler":sm,"target":{"node":nodes["rig_root"],"path":"translation"}})
        assert channels,name
        a["samplers"]=samplers;a["channels"]=channels
        a["extras"]={"loop":loop,"inPlace":True,"stage":"v06_motion_improvement","source":"v05","independentIK":False}
        print("MOTION",name,"channels",len(channels),"duration",seconds)
    while len(bin_data)%4:bin_data.append(0)
    g["buffers"][0]["byteLength"]=len(bin_data)
    jb=json.dumps(g,separators=(",",":"),ensure_ascii=False).encode("utf8")
    jb+=b" " * (-len(jb)%4)
    result=b"glTF"+struct.pack("<II",2,12+8+len(jb)+8+len(bin_data))+struct.pack("<II",len(jb),0x4E4F534A)+jb+struct.pack("<II",len(bin_data),0x004E4942)+bin_data
    OUT.write_bytes(result)
    bb,j,br=read_glb(OUT)
    assert bb==result and j["meshes"]==g["meshes"]
    assert br[:len(read_glb(BASE)[2])]==read_glb(BASE)[2]
    assert len(j["animations"])==22
    summary={"species":"fulgaronte","version":"v06","stage":"animation_quality_review","source":"v05","bytes":len(bb),"sha256":hashlib.sha256(bb).hexdigest(),"triangles":2476,"bones":29,"clips_total":22,"clips_improved":list(TARGETS),"skins_preserved":True,"original_buffer_prefix_preserved":True,"procedural_ik_implemented":False,"electric_vfx_implemented":False,"alpha_modified":False}
    (ROOT/"manifest.json").write_text(json.dumps(summary,indent=2,ensure_ascii=False)+"\n",encoding="utf8")
    print("SUCCESS",summary)

if __name__=="__main__":main()
