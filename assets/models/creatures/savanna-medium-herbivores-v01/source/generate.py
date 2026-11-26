#!/usr/bin/env python3
"""Wildhaven | Four original articulated savanna herbivores.

Reproducible generator: true triangle meshes, hierarchical animated glTF 2.0 GLBs,
authentic VTK offscreen renders, SHA256 manifests. No game/runtime modification.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import struct
from collections import defaultdict
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[5]
TWO_PI = 2 * math.pi
BROWN = (0.28, .15, .085)
CREAM = (.84, .71, .49)
DARK = (.135, .105, .09)
CHARCOAL = (.105, .115, .115)
EYE = (.075, .059, .048)
WHITE = (.95, .86, .68)

SPECS = [
    dict(id="talvero", title="Talvero", variant="Savanna Runner",
         scale=1., length=2.12, width=.57, height=1.10, body_r=.44,
         leg_up=.43, leg_low=.48, neck_dx=.40, neck_dy=.40,
         base=(.56,.295,.14), accent=(.29,.19,.14), belly=(.80,.66,.44),
         markings=(.88,.73,.48), hooves=(.22,.22,.22), mane=(.14,.105,.085),
         group="herd", diet="grass", habitat="open_savanna",
         clips=["idle","walk","trot","gallop","graze","alert","flee","kick","rest","death"]),
    dict(id="rambrel", title="Rambrél", variant="Common Acacia Browser",
         scale=1., length=2.18, width=.49, height=1.32, body_r=.40,
         leg_up=.57, leg_low=.58, neck_dx=.46, neck_dy=.85,
         base=(.65,.35,.17), accent=(.27,.15,.095), belly=(.86,.69,.46),
         markings=(.90,.70,.37), hooves=(.20,.18,.16), mane=(.22,.12,.09),
         group="small_herd", diet="acacia_leaves", habitat="wooded_savanna",
         clips=["idle","walk","trot","run","browse","chew","alert","headbutt","defend","rest","death"]),
    dict(id="rambrel_chapadas", title="Rambrél-das-Chapadas", variant="Giant Acacia Browser",
         scale=1., length=3.80, width=.85, height=2.13, body_r=.63,
         leg_up=.91, leg_low=.87, neck_dx=.72, neck_dy=1.70,
         base=(.52,.28,.15), accent=(.25,.13,.075), belly=(.76,.60,.39),
         markings=(.79,.57,.29), hooves=(.16,.14,.13), mane=(.17,.10,.075),
         group="rare_pair", diet="high_acacia_canopy", habitat="savanna_plateau",
         clips=["idle","walk","trot","charge","browse","chew","alert","headbutt","defend","rest","death"]),
    dict(id="turvagal", title="Turvagal", variant="Wetland Grazer",
         scale=1., length=2.64, width=.92, height=.98, body_r=.61,
         leg_up=.33, leg_low=.34, neck_dx=.37, neck_dy=.12,
         base=(.36,.38,.23), accent=(.22,.26,.16), belly=(.63,.60,.43),
         markings=(.60,.57,.40), hooves=(.21,.215,.18), mane=(.25,.31,.20),
         group="river_family", diet="wet_grass", habitat="savanna_riverbank",
         clips=["idle","walk","trot","graze","drink","wade","swim","emerge","threat","rest","death"]),
]


def normalize(v):
    a = np.asarray(v, dtype=np.float64)
    return a / max(1e-10, float(np.linalg.norm(a)))


def loft_x(rings, sides=18):
    """Anatomical torso made from continuous elliptical cross-sections."""
    vertices = []
    for x, cy, ry, rz in rings:
        for j in range(sides):
            a = TWO_PI * j / sides
            vertices.append((x, cy + ry * math.sin(a), rz * math.cos(a)))
    faces = []
    for i in range(len(rings)-1):
        for j in range(sides):
            a=i*sides+j; b=i*sides+(j+1)%sides
            c=(i+1)*sides+j; d=(i+1)*sides+(j+1)%sides
            faces.extend(((a,c,b),(b,c,d)))
    faces.extend((0,(j+1)%sides,j) for j in range(1,sides-1))
    end=(len(rings)-1)*sides
    faces.extend((end,end+j,end+(j+1)%sides) for j in range(1,sides-1))
    return np.array(vertices,np.float32), np.array(faces,np.uint32)


def tube(points, radii, sides=12):
    """Smooth tapered, spatially curved organic tube: contiguous sidewall mesh."""
    if len(points)!=len(radii):
        raise ValueError("point/radius mismatch")
    points=np.asarray(points,np.float64)
    vertices=[]
    for i,p in enumerate(points):
        tangent=normalize(points[min(i+1,len(points)-1)]-points[max(0,i-1)])
        ref=np.array([0.,0.,1.])
        if abs(float(np.dot(tangent,ref)))>.95:
            ref=np.array([0.,1.,0.])
        a=normalize(np.cross(tangent,ref))
        b=normalize(np.cross(tangent,a))
        ry,rz=(radii[i],radii[i]) if isinstance(radii[i],(float,int)) else radii[i]
        for k in range(sides):
            t=TWO_PI*k/sides
            vertices.append(p+ry*math.cos(t)*a+rz*math.sin(t)*b)
    faces=[]
    for i in range(len(points)-1):
        for j in range(sides):
            a=i*sides+j; b=i*sides+(j+1)%sides
            c=(i+1)*sides+j; d=(i+1)*sides+(j+1)%sides
            faces.extend(((a,c,b),(b,c,d)))
    faces.extend((0,(j+1)%sides,j) for j in range(1,sides-1))
    end=(len(points)-1)*sides
    faces.extend((end,end+j,end+(j+1)%sides) for j in range(1,sides-1))
    return np.array(vertices,np.float32),np.array(faces,np.uint32)


def ellipsoid(cx,cy,cz,rx,ry,rz,rings=9,sides=14):
    verts=[]
    for i in range(rings+1):
        theta=math.pi*i/rings
        for j in range(sides):
            phi=TWO_PI*j/sides
            verts.append((cx+rx*math.cos(theta),
                          cy+ry*math.sin(theta)*math.cos(phi),
                          cz+rz*math.sin(theta)*math.sin(phi)))
    faces=[]
    for i in range(rings):
        for j in range(sides):
            a=i*sides+j; b=i*sides+(j+1)%sides
            c=(i+1)*sides+j; d=(i+1)*sides+(j+1)%sides
            faces.extend(((a,b,c),(b,d,c)))
    return np.array(verts,np.float32),np.array(faces,np.uint32)


def quat_z(a):
    return [0.,0.,float(math.sin(a*.5)),float(math.cos(a*.5))]


def quat_x(a):
    return [float(math.sin(a*.5)),0.,0.,float(math.cos(a*.5))]


class Scene:
    def __init__(self,spec):
        self.s=spec
        self.nodes=[]
        self.geo=defaultdict(lambda:defaultdict(list))
        self.names={}
        self.mats=[]
        self.matids={}
        for key in ("base","accent","belly","markings","hooves","mane"):
            self.matids[key]=self.mat(key,spec[key])
        self.matids["eye"]=self.mat("eye",EYE)
        self.matids["glint"]=self.mat("glint",WHITE)
        self.matids["nose"]=self.mat("nose",CHARCOAL)
        self.matids["horn"]=self.mat("horn",DARK)
        self.root=self.node("root")
        self.body=self.node("body",parent=self.root,offset=(0,spec["height"],0))
        self.rig=[]
        self.build()

    def mat(self,name,rgb):
        m=len(self.mats)
        self.mats.append({"name":name,
            "pbrMetallicRoughness":{"baseColorFactor":[*rgb,1.],
                "metallicFactor":0., "roughnessFactor":.92},
            "doubleSided":True})
        return m

    def node(self,name,parent=None,offset=(0,0,0)):
        i=len(self.nodes)
        self.nodes.append({"name":name,"translation":[float(x) for x in offset]})
        self.names[name]=i
        if parent is not None:
            self.nodes[parent].setdefault("children",[]).append(i)
        return i

    def add(self,node,material,geom):
        self.geo[node][self.matids[material]].append(geom)

    def body_mesh(self):
        s=self.s
        L=s["length"]; r=s["body_r"]; W=s["width"]
        self.add(self.body,"base",loft_x([
            (-.55*L,-.04,.06,.08),(-.48*L,-.02,.70*r,.69*W),
            (-.34*L,0,.94*r,.97*W),(-.06*L,-.025,1.04*r,W),
            (.24*L,.015,1.0*r,.96*W),(.42*L,.03,.87*r,.81*W),
            (.54*L,.01,.10,.11)]))
        self.add(self.body,"belly",ellipsoid(-.10*L,-r*.52,0,.36*L,r*.35,W*.74,9,16))
        # Shoulder and hip volumes are embedded in body silhouette.
        for x in (-.34*L,.33*L):
            for side in (-1,1):
                self.add(self.body,"base",ellipsoid(x,-r*.22,side*W*.68,.21*L,r*.70,W*.33))
        # Organic flank markings float just above the coat, not as fake texture.
        for side in (-1,1):
            for k in range(3):
                x=(-.32+k*.26)*L
                width=(.07 if s["id"]!="turvagal" else .13)*L
                self.add(self.body,"markings",ellipsoid(x,-.10*r,side*(W*.97),
                    width,.17*r,.025*W,7,12))
        if s["id"]=="turvagal":
            for row in range(3):
                for k in range(8):
                    x=(-.43+.12*k)*L + (row%2)*.06*L
                    z=(row-1)*W*.53
                    y=r*.91*(1.-(z/W)**2)**.5 + .016
                    self.add(self.body,"accent",ellipsoid(x,y,z,.072*L,.10*r,.19*W,6,11))
        else:
            for k in range(9 if s["id"]=="talvero" else 6):
                x=(-.38+.085*k)*L
                self.add(self.body,"mane",tube([
                    (x,r*.91,0),(x-.042*L,r*1.24,0),
                    (x-.065*L,r*1.37,0)],[(.064*L,.095*W),(.045*L,.070*W),(.005,.006)],7))

    def add_leg(self,x,side,index):
        s=self.s
        up=s["leg_up"]; low=s["leg_low"]; W=s["width"]
        hip=self.node("leg%d_hip"%index,self.body,(x,-s["body_r"]*.53,side*W*.71))
        knee=self.node("leg%d_knee"%index,hip,(0,-up,0))
        ankle=self.node("leg%d_ankle"%index,knee,(0,-low,0))
        self.rig.extend([hip,knee,ankle])
        thick=.17 if index<2 else .19
        if s["id"]=="turvagal": thick=.30
        self.add(hip,"base",tube([(0,.16,0),(-.035,-.10,0),(.02,-up*.57,0),(0,-up-.035,0)],
            [(.24,.20),(.20,.19),(.15,.14),(thick*.60,thick*.60)],13))
        self.add(knee,"base",tube([(0,.08,0),(.017,-.18*low,0),(-.024,-.73*low,0),(0,-low-.035,0)],
            [(thick*.76,thick*.72),(thick*.79,thick*.73),(.13,.12),(.088,.08)],12))
        # Cloven toes and dark keratin; real separate toes for biomechanical readability.
        self.add(ankle,"hooves",ellipsoid(.065,-.045,-.075,.145,.095,.075,8,14))
        self.add(ankle,"hooves",ellipsoid(.065,-.045,.075,.145,.095,.075,8,14))
        self.add(knee,"accent",ellipsoid(0,-.08,0,.115,.08,.13,7,10))

    def append_head(self,neck):
        s=self.s
        L=s["length"]; big=s["id"]=="rambrel_chapadas"
        head=self.node("head",neck,(s["neck_dx"],s["neck_dy"],0))
        jaw=self.node("jaw",head,(.30, -.08,0))
        self.rig.extend((head,jaw))
        size=.18 if s["id"]!="turvagal" else .24
        self.add(head,"base",tube([
            (-.18,-.035,0),(-.03,.055,0),(.17,.055,0),(.40,-.01,0),(.55,-.06,0)],
            [(size*.73,size*.9),(size*1.12,size*.97),(size*.88,size*.84),
             (size*.72,size*.72),(size*.44,size*.53)],14))
        if s["id"]=="turvagal":
            self.add(head,"nose",ellipsoid(.46,-.062,0,.23,.12,.20))
        else:
            self.add(head,"nose",ellipsoid(.50,-.065,0,.095,.073,.12,7,12))
        self.add(jaw,"belly",ellipsoid(.17,-.06,0,.26,.065,.118,7,12))
        for side in (-1,1):
            self.add(head,"eye",ellipsoid(.115,.12,side*size*.90,.052,.048,.025,8,14))
            self.add(head,"glint",ellipsoid(.128,.133,side*(size*.90+.023),.017,.013,.009,6,10))
            self.add(head,"accent",tube([(-.08,.16,side*.11),(-.17,.37,side*.22),
                         (-.19,.43,side*.23)],[.073,.047,.002],9))
            if s["id"].startswith("rambrel"):
                hornheight=.32 if not big else .54
                for offset in (0,):
                    self.add(head,"horn",tube([(0,.18,side*.085),
                        (-.065,.26,side*.11),(-.18,.18+hornheight*.65,side*.10),
                        (-.21,.18+hornheight,side*.10)],
                        [.083,.068,.041,.005],10))
        if s["id"]=="talvero":
            for k in range(5):
                self.add(head,"mane",tube([
                    (-.20+k*.07,.17,0),(-.23+k*.07,.28,0),
                    (-.29+k*.07,.37,0)],[.07,.043,.004],7))
        if s["id"]=="turvagal":
            for k in range(6):
                self.add(head,"accent",ellipsoid(-.17+k*.095,.20,0,.095,.038,.15,6,10))
        return head,jaw

    def build(self):
        s=self.s
        self.body_mesh()
        for i,(x,side) in enumerate([(s["length"]*.33,-1),(s["length"]*.33,1),
                                      (-s["length"]*.37,-1),(-s["length"]*.37,1)]):
            self.add_leg(x,side,i)
        neck=self.node("neck",self.body,(s["length"]*.35,s["body_r"]*.10,0))
        self.rig.append(neck)
        self.add(neck,"base",tube([
            (-.20,-.20,0),(0,0,0),(.28*s["neck_dx"],.24*s["neck_dy"],0),
            (.71*s["neck_dx"],.75*s["neck_dy"],0),
            (s["neck_dx"]+.04,s["neck_dy"]+.04,0)],
            [(.37,.30),(.34,.27),(.27,.22),(.20,.17),(.14,.13)],16))
        if s["id"].startswith("rambrel"):
            # Dark raised nape crest integrated along the back of the long neck.
            for k in range(8):
                t=k/8
                x=s["neck_dx"]*t-.11
                y=s["neck_dy"]*t+.20
                self.add(neck,"mane",tube([
                    (x,y,0),(x-.09,y+.10,0),(x-.13,y+.14,0)],
                    [(.11,.12),(.062,.075),(.004,.005)],8))
        elif s["id"]=="talvero":
            for k in range(6):
                t=k/7
                self.add(neck,"mane",tube([
                    (s["neck_dx"]*t-.12,s["neck_dy"]*t+.17,0),
                    (s["neck_dx"]*t-.20,s["neck_dy"]*t+.25,0),
                    (s["neck_dx"]*t-.24,s["neck_dy"]*t+.31,0)],
                    [(.095,.085),(.053,.045),(.004,.004)],8))
        self.append_head(neck)
        tail0=self.node("tail0",self.body,(-s["length"]*.49,.14,0))
        tail1=self.node("tail1",tail0,(-.22,-.18,0))
        self.rig.extend((tail0,tail1))
        self.add(tail0,"base",tube([(0,0,0),(-.12,-.10,0),(-.23,-.18,0)],
                                  [(.14,.13),(.094,.087),(.065,.06)],10))
        self.add(tail1,"mane",tube([
            (0,0,0),(-.12,-.15,0),(-.22,-.30,0),(-.31,-.38,0)],
            [(.085,.080),(.110,.093),(.065,.064),(.005,.005)],11))
        self.rig.insert(0,self.body)

    def animation(self,name):
        s=self.s
        duration={"idle":3.0,"walk":1.5,"trot":1.0,"run":.75,
                  "gallop":.75,"flee":.72,"charge":.84,"graze":3.6,
                  "browse":3.6,"chew":2.3,"drink":3.5,"wade":2.1,
                  "swim":1.55,"emerge":2.4,"kick":1.2,"headbutt":1.2,
                  "defend":1.8,"alert":2.,"threat":2.,"rest":3.5,"death":2.3}[name]
        times=[duration*k/8 for k in range(9)]
        channels={}
        move=name in ("walk","trot","run","gallop","flee","charge","wade","swim")
        amp={"walk":.22,"trot":.36,"run":.50,"gallop":.55,"flee":.57,
             "charge":.44,"wade":.17,"swim":.29}.get(name,0)
        for node in self.rig:
            n=self.nodes[node]["name"]
            rotations=[]
            for k,t in enumerate(times):
                u=k/8; phase=TWO_PI*u
                sway=math.sin(phase)
                pitch=0.
                if n=="body":
                    pitch=.02*math.sin(phase) if name=="idle" else (.045*sway if move else 0.)
                    if name in ("graze","browse","drink","chew"): pitch=-.02*math.sin(phase)
                    if name=="death": pitch=-1.26*(.5-.5*math.cos(math.pi*u))
                elif n.endswith("_hip"):
                    leg=int(n[3])
                    if move:
                        # diagonal gait for trot, offset four-beat for gallop.
                        off=[0.,.50,.50,0.][leg] if name!="gallop" else [0.,.18,.55,.72][leg]
                        pitch=amp*math.sin(phase+TWO_PI*off)
                    elif name=="rest": pitch=.48
                    elif name=="death": pitch=.35*u
                    elif name=="kick" and leg>=2: pitch=-.45*math.sin(math.pi*u)
                elif n.endswith("_knee"):
                    leg=int(n[3])
                    if move: pitch=.13+.21*max(0.,math.sin(phase+TWO_PI*([0.,.5,.5,0.][leg])))
                    elif name=="rest": pitch=-.71
                    elif name=="death": pitch=-.44*u
                    elif name=="kick" and leg>=2: pitch=.5*math.sin(math.pi*u)
                elif n.endswith("_ankle"):
                    if move: pitch=-.11*math.sin(phase)
                elif n=="neck":
                    if name in ("graze","drink"): pitch=-.63*(.5-.5*math.cos(math.pi*min(u*2,1)))
                    elif name=="browse": pitch=.23+.09*math.sin(phase)
                    elif name=="alert": pitch=.18*(.5-.5*math.cos(phase))
                    elif name in ("headbutt","threat","defend"): pitch=-.36*math.sin(math.pi*u)
                    elif name=="death": pitch=-.7*u
                    elif name=="chew": pitch=.025*math.sin(phase)
                elif n=="head":
                    if name=="graze": pitch=-.22
                    elif name=="browse": pitch=.18
                    elif name=="headbutt": pitch=-.42*math.sin(math.pi*u)
                    elif name=="alert": pitch=.12*math.sin(phase)
                    elif name in ("chew","drink"): pitch=.07*math.sin(phase)
                elif n=="jaw":
                    if name in ("chew","graze","browse","drink"):
                        pitch=-.10*(.5+.5*math.sin(phase*2))
                elif n.startswith("tail"):
                    pitch=.12*math.sin(phase-(.6 if n=="tail1" else 0))
                    if name=="alert": pitch=.21*math.sin(phase)
                rotations.append(quat_z(pitch))
            channels[n]={"rotation":rotations}
        # Root vertical displacement for death and swimming, with fixed clip duration.
        translation=[]
        for k in range(9):
            u=k/8; phase=TWO_PI*u
            y=0.
            if name=="death": y=-s["height"]*.56*(.5-.5*math.cos(math.pi*u))
            elif name=="swim": y=-.15+.03*math.sin(phase)
            elif move: y=.028*math.sin(2*phase)
            translation.append([0.,y,0.])
        channels["root"]={"translation":translation}
        return times,channels

    def write_glb(self,path):
        binbuf=bytearray()
        gltf={"asset":{"version":"2.0","generator":"Wildhaven Savanna Fauna v01"},
              "scene":0,"scenes":[{"nodes":[self.root]}],
              "nodes":self.nodes,"materials":self.mats,"meshes":[],
              "bufferViews":[],"accessors":[],"animations":[]}
        def view(payload,target=None):
            while len(binbuf)%4: binbuf.append(0)
            start=len(binbuf)
            binbuf.extend(payload)
            obj={"buffer":0,"byteOffset":start,"byteLength":len(payload)}
            if target is not None: obj["target"]=target
            gltf["bufferViews"].append(obj)
            return len(gltf["bufferViews"])-1
        def accessor(arr,component,typename,target=None,minmax=False):
            arr=np.asarray(arr)
            vi=view(arr.tobytes(),target)
            obj={"bufferView":vi,"componentType":component,
                 "count":int(len(arr)),"type":typename}
            if minmax:
                obj["min"]=arr.min(axis=0).astype(float).tolist() if arr.ndim>1 else [float(arr.min())]
                obj["max"]=arr.max(axis=0).astype(float).tolist() if arr.ndim>1 else [float(arr.max())]
            gltf["accessors"].append(obj)
            return len(gltf["accessors"])-1
        tris=0
        for node,materials in sorted(self.geo.items()):
            primitives=[]
            for mat,parts in sorted(materials.items()):
                all_verts=[]; all_faces=[]; start=0
                for v,f in parts:
                    all_verts.append(v)
                    all_faces.append(f+start)
                    start+=len(v)
                v=np.concatenate(all_verts).astype("<f4")
                f=np.concatenate(all_faces).astype("<u4")
                tris+=len(f)
                va=accessor(v,5126,"VEC3",34962,True)
                fa=accessor(f.reshape(-1),5125,"SCALAR",34963)
                primitives.append({"attributes":{"POSITION":va},"indices":fa,
                                   "material":mat,"mode":4})
            gltf["meshes"].append({"name":self.nodes[node]["name"]+"_mesh",
                                   "primitives":primitives})
            self.nodes[node]["mesh"]=len(gltf["meshes"])-1
        for clip in self.s["clips"]:
            times,anim=self.animation(clip)
            timing=accessor(np.asarray(times,dtype="<f4"),5126,"SCALAR",minmax=True)
            entry={"name":clip,"samplers":[],"channels":[]}
            for node_name,paths in anim.items():
                for key,data in paths.items():
                    typ="VEC4" if key=="rotation" else "VEC3"
                    vals=np.asarray(data,dtype="<f4")
                    a=accessor(vals,5126,typ)
                    idx=len(entry["samplers"])
                    entry["samplers"].append({"input":timing,"output":a,"interpolation":"LINEAR"})
                    entry["channels"].append({"sampler":idx,"target":{"node":self.names[node_name],"path":key}})
            gltf["animations"].append(entry)
        while len(binbuf)%4: binbuf.append(0)
        gltf["buffers"]=[{"byteLength":len(binbuf)}]
        chunk=json.dumps(gltf,separators=(",",":"),ensure_ascii=False).encode("utf-8")
        chunk+=b" " * (-len(chunk)%4)
        total=12+8+len(chunk)+8+len(binbuf)
        raw=struct.pack("<4sII",b"glTF",2,total)
        raw+=struct.pack("<I4s",len(chunk),b"JSON")+chunk
        raw+=struct.pack("<I4s",len(binbuf),b"BIN\x00")+bytes(binbuf)
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_bytes(raw)
        assert raw[:4]==b"glTF" and struct.unpack_from("<I",raw,8)[0]==len(raw)
        return dict(file=path.name,bytes=len(raw),
                    sha256=hashlib.sha256(raw).hexdigest(),triangles=tris,
                    meshNodes=len(self.geo),animations=self.s["clips"],
                    animationCount=len(self.s["clips"]),joints=len(self.rig),
                    rig="hierarchical-pivot-animations-no-skin-weights")

    def render(self,out_path,angle="three_quarter"):
        import vtk
        render=vtk.vtkRenderer()
        render.SetBackground(.88,.89,.87)
        render.SetBackground2(.66,.76,.82)
        render.GradientBackgroundOn()
        centers={}
        def position(index):
            if index not in centers:
                n=self.nodes[index]
                p=np.asarray(n.get("translation",[0,0,0]))
                parent=next((i for i,v in enumerate(self.nodes) if index in v.get("children",[])),None)
                centers[index]=p+(position(parent) if parent is not None else np.zeros(3))
            return centers[index]
        for node,materials in self.geo.items():
            origin=position(node)
            for mat,meshes in materials.items():
                verts=[]; faces=[]; off=0
                for v,f in meshes:
                    verts.append(v+origin)
                    faces.append(f+off)
                    off+=len(v)
                points=np.concatenate(verts)
                faces=np.concatenate(faces)
                poly=vtk.vtkPolyData()
                vpoints=vtk.vtkPoints()
                vpoints.SetDataTypeToFloat()
                for p in points: vpoints.InsertNextPoint(*map(float,p))
                poly.SetPoints(vpoints)
                cells=vtk.vtkCellArray()
                for f in faces:
                    tri=vtk.vtkTriangle()
                    for k in range(3): tri.GetPointIds().SetId(k,int(f[k]))
                    cells.InsertNextCell(tri)
                poly.SetPolys(cells)
                norms=vtk.vtkPolyDataNormals()
                norms.SetInputData(poly)
                norms.ConsistencyOn()
                norms.SplittingOff()
                norms.Update()
                mapper=vtk.vtkPolyDataMapper()
                mapper.SetInputConnection(norms.GetOutputPort())
                actor=vtk.vtkActor()
                actor.SetMapper(mapper)
                color=self.mats[mat]["pbrMetallicRoughness"]["baseColorFactor"]
                actor.GetProperty().SetColor(*color[:3])
                actor.GetProperty().SetAmbient(.22)
                actor.GetProperty().SetDiffuse(.77)
                actor.GetProperty().SetSpecular(.055)
                render.AddActor(actor)
        floor=vtk.vtkPlaneSource()
        floor.SetCenter(0,-.13,0)
        floor.SetNormal(0,1,0)
        floor.SetPoint1(6,-.13,0)
        floor.SetPoint2(0,-.13,6)
        floor.SetOrigin(-6,-.13,-6)
        floor.SetPoint1(6,-.13,-6)
        floor.SetPoint2(-6,-.13,6)
        mapper=vtk.vtkPolyDataMapper();mapper.SetInputConnection(floor.GetOutputPort())
        actor=vtk.vtkActor();actor.SetMapper(mapper)
        actor.GetProperty().SetColor(.59,.54,.42);actor.GetProperty().SetAmbient(.35)
        render.AddActor(actor)
        light=vtk.vtkLight()
        light.SetPosition(5,11,9)
        light.SetFocalPoint(0,.8,0)
        light.SetIntensity(.8)
        render.AddLight(light)
        window=vtk.vtkRenderWindow()
        window.SetOffScreenRendering(1)
        window.SetSize(1200,900)
        window.AddRenderer(render)
        camera=render.GetActiveCamera()
        L=self.s["length"]; h=self.s["height"]+self.s["neck_dy"]+.7
        target=(.15*L,h*.48,0)
        d=max(L*1.8,h*1.65,3.6)
        if angle=="side": camera.SetPosition(target[0],target[1]+d*.28,d)
        elif angle=="front": camera.SetPosition(target[0]+d,target[1]+d*.18,0)
        else: camera.SetPosition(target[0]+d*.68,target[1]+d*.50,d*.85)
        camera.SetFocalPoint(*target)
        camera.SetViewUp(0,1,0)
        camera.ParallelProjectionOn()
        camera.SetParallelScale(max(h*.73,L*.53,1.4))
        render.ResetCameraClippingRange()
        window.Render()
        capture=vtk.vtkWindowToImageFilter()
        capture.SetInput(window)
        capture.ReadFrontBufferOff()
        capture.Update()
        writer=vtk.vtkPNGWriter()
        writer.SetFileName(str(out_path))
        writer.SetInputConnection(capture.GetOutputPort())
        writer.Write()
        window.Finalize()


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--render",action="store_true")
    p.add_argument("--only",choices=[s["id"] for s in SPECS])
    a=p.parse_args()
    for spec in SPECS:
        if a.only and a.only!=spec["id"]: continue
        scene=Scene(spec)
        dest=ROOT/"assets/models/creatures"/spec["id"]
        dest.mkdir(parents=True,exist_ok=True)
        model=dest/(spec["id"]+"-savanna-animated-v01.glb")
        info=scene.write_glb(model)
        if a.render:
            for angle in ("three_quarter","side","front"):
                scene.render(dest/(spec["id"]+"-real-3d-"+angle+"-v01.png"),angle)
        manifest={"id":spec["id"],"name":spec["title"],
            "variant":spec["variant"],"stage":"animated_asset_in_review",
            "gameplayIntegrated":False,"source":"assets/models/creatures/savanna-medium-herbivores-v01/source/generate.py",
            "model":info,"note":"Real geometry and exported pivot animation clips; no weighted skinning or AI."}
        (dest/(spec["id"]+"-manifest-v01.json")).write_text(
            json.dumps(manifest,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
        print("BUILT",spec["id"],json.dumps(info),flush=True)

if __name__=="__main__":
    main()
