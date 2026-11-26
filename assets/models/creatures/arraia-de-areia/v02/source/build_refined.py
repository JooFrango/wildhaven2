#!/usr/bin/env python3
"""Arraia-de-Areia v02: anatomical surface refinement of the approved v01.
Reuses the ORIGINAL v01 authored source to preserve design, not its rendered image.
Anatomical changes are genuine mesh; pigments/patterns are UV-raster pixels only.
Separate file paths/branch; v01 is never overwritten. No rig, skins, or animation.
"""
from __future__ import annotations
from pathlib import Path
import importlib.util
import hashlib, json, struct, io, math
import numpy as np
import trimesh
from PIL import Image, ImageDraw, ImageFilter
from trimesh.visual.texture import TextureVisuals
from trimesh.visual.material import PBRMaterial

ROOT=Path(__file__).resolve().parent.parent
# Folder v01 is a sibling of v02 in the GitHub repo's canonical creature path.
V01=ROOT.parent/'v01'
SOURCE=V01/'source'/'build.py'
assert SOURCE.is_file(),f'Approved source missing: {SOURCE}'
spec=importlib.util.spec_from_file_location('wildhaven_arraia_v01', SOURCE)
v01=importlib.util.module_from_spec(spec);spec.loader.exec_module(v01)
BASE_TEX=V01/'textures'/'arraia-de-areia-v01-albedo-pintado-uv.png'
TEX=ROOT/'textures'/'arraia-de-areia-v02-pintura-uv-refinada.png'
GLB=ROOT/'arraia-de-areia-v02-anatomia-refinada.glb'

class Refined(v01.MeshBuilder):
    """Preserve the v01 silhouette and append only volume-bearing structures."""
    def top(self,z,t):
        (x,y,z),h=super().top(z,t)
        # Smoother anatomical transition of cephalic shield to thick mantle.
        # Changed body surface itself rather than adding a cosmetic shell.
        w=abs(z/9)
        cephalic=.16*math.exp(-((x-3.7)/1.7)**2)*math.exp(-(w/.32)**2)
        saddle=.09*math.sin(math.pi*t)**2 * math.exp(-((w-.34)/.23)**2)
        y+=cephalic+saddle
        h+=.075*math.exp(-((w-.27)/.23)**2)*math.sin(math.pi*t)**2
        return (x,y,z),h
    def brow(self,sign):
        # Inset iris inside a real faceted orbital rim on mantle's surface.
        # The color is sampled from the SAME original atlas; no color-only meshes.
        x0,z0=3.95,1.52*sign
        sides=10
        def polar(r1,r2,theta,offset=0.):
            x=x0+math.cos(theta)*r1
            z=z0+math.sin(theta)*r2
            y=self.mantletop(x,z)+offset
            return (x,y,z)
        def s_uv(v):return (.46,v)
        for k in range(sides):
            a=2*math.pi*k/sides; b=2*math.pi*(k+1)/sides
            oa=polar(.43,.29,a,.09);ob=polar(.43,.29,b,.09)
            ia=polar(.29,.19,a,.135);ib=polar(.29,.19,b,.135)
            self.quad(oa,ob,ib,ia,*[self.dorsal_uv(q) for q in (oa,ob,ib,ia)],'inset_orbital_rim')
            center=polar(0,0,0,.15)
            self.tri(ia,ib,center,s_uv(.163),s_uv(.163),s_uv(.163),'iris_inset')
        # Narrow functional pupil surface raised only enough to register the eye shape.
        p1=polar(.07,.10,.5*math.pi,.165)
        p2=polar(.07,.10,1.5*math.pi,.165)
        pc=polar(0,0,0,.181)
        self.tri(p1,p2,pc,s_uv(.028),s_uv(.028),s_uv(.028),'pupil_recess')
    def dorsal_uv(self,p):
        # Sample the mantle UV at the exact anatomical position, no artificial dark strips.
        x,y,z=p;w=abs(z/9)
        xf=6.35-8.65*w**1.7;xb=-4.30+1.9*w**1.2
        t=np.clip((xf-x)/(xf-xb),0,1)
        return self.fin_uv(z,t,True)
    def biological_support(self):
        """Tapered sub-dermal fin rays, following mantle curvature (not paint strokes)."""
        for sg in [-1,1]:
            # Three broad muscular support ridges per fin side; very shallow relief.
            for j in range(3):
                xstart=2.2-1.1*j
                steps=7
                for i in range(steps):
                    t0=i/steps;t1=(i+1)/steps
                    def cross(s):
                        z=sg*(1.75+5.0*s)
                        x=xstart-(1.25+j*.18)*s + .25*math.sin(s*math.pi)
                        yy=self.mantletop(x,z)
                        width=(.29-.19*s)
                        aa=(x,yy+.012,z-width)
                        bb=(x,yy+.012,z+width)
                        ridge=(x,yy+.10*(1-s)+.01,z)
                        return aa,bb,ridge
                    aa,ba,ra=cross(t0);ab,bb,rb=cross(t1)
                    # Upper 2 quadrilateral halves with ridge; anatomical cutaneous fins.
                    self.quad(aa,ab,rb,ra,*[self.dorsal_uv(q) for q in (aa,ab,rb,ra)],'pectoral_fin_support')
                    self.quad(ra,rb,bb,ba,*[self.dorsal_uv(q) for q in (ra,rb,bb,ba)],'pectoral_fin_support')
    def sensory_crown(self):
        # Sensory nasal lobes formed in original geometry; only two low ridges.
        for sg in [-1,1]:
            for i in range(7):
                x0=4.25+i*.22; x1=x0+.22
                z0=sg*(.73+.09*math.sin(i*.35)); z1=sg*(.73+.09*math.sin((i+1)*.35))
                y0=self.mantletop(x0,z0);y1=self.mantletop(x1,z1)
                a=(x0,y0+.015,z0-.13); b=(x0,y0+.015,z0+.13)
                c=(x1,y1+.015,z1-.12); d=(x1,y1+.015,z1+.12)
                m=(x0,y0+.105,z0);n=(x1,y1+.08,z1)
                self.quad(a,c,n,m,*[self.dorsal_uv(q) for q in (a,c,n,m)],'cephalic_sensory_ridge')
                self.quad(m,n,d,b,*[self.dorsal_uv(q) for q in (m,n,d,b)],'cephalic_sensory_ridge')
    def buccal_support(self):
        # Structural thickened corner fold ties jaw to mantle, no floating plates.
        for sg in (-1,1):
            inside=(5.77,1.72,sg*2.12)
            outer=(5.48,1.92,sg*2.68)
            back=(4.83,1.83,sg*2.81)
            lower=(5.27,1.43,sg*2.55)
            self.tri(inside,outer,back,*([(.44,.135)]*3),'buccal_corner_fold')
            self.tri(inside,lower,outer,*([(.44,.135)]*3),'buccal_corner_fold')
    def create(self):
        self.mantle();self.face();self.spine_chain();self.tail()
        self.biological_support();self.sensory_crown();self.buccal_support()
        return self

def paint_refinement():
    # Work from approved v01 texture; retain color distribution + exact UVs.
    assert BASE_TEX.exists(), 'v01 base painting missing: '+str(BASE_TEX)
    base=Image.open(BASE_TEX).convert('RGBA')
    assert base.size==(2048,2048)
    marks=Image.new('RGBA',base.size,(0,0,0,0));d=ImageDraw.Draw(marks,'RGBA')
    rng=np.random.default_rng(20261109+2)
    # New subtle mineral scuffs and fine skin wear, all raster pixels.
    for _ in range(1000):
        x=int(rng.uniform(50,1990));y=int(rng.uniform(65,1070))
        a=int(rng.uniform(5,22));b=int(rng.uniform(-3,3))
        color=(232,175,103,int(rng.uniform(13,34))) if rng.random()<.66 else (49,37,29,int(rng.uniform(12,38)))
        d.line((x,y,x+a,y+b),fill=color,width=1)
    # Small overlapping paint-only scallops on fin extremities (UV X sides).
    for side in (-1,1):
        for i in range(115):
            xx=int((95 if side<0 else 1950)+rng.normal(0,58))
            yy=int(rng.uniform(150,1030));r=int(rng.uniform(2,7))
            d.arc((xx-r,yy-r,xx+r,yy+r),5,130,fill=(63,48,34,43),width=1)
    marks=marks.filter(ImageFilter.GaussianBlur(.5))
    Image.alpha_composite(base,marks).convert('RGB').save(TEX,optimize=True)

def glb_json(blob):
    assert blob[:4]==b'glTF' and struct.unpack_from('<I',blob,8)[0]==len(blob)
    n=struct.unpack_from('<I',blob,12)[0]
    return json.loads(blob[20:20+n])

def main():
    TEX.parent.mkdir(parents=True,exist_ok=True)
    paint_refinement()
    sculpt=Refined().create()
    verts=np.asarray(sculpt.vertices,dtype=np.float32);uv=np.asarray(sculpt.uv,dtype=np.float32)
    mesh=trimesh.Trimesh(vertices=verts,faces=np.asarray(sculpt.faces),process=False)
    mesh.visual=TextureVisuals(uv=uv,material=PBRMaterial(
        name='Arraia_Areia_V02_UV_Pintada',baseColorTexture=Image.open(TEX),
        metallicFactor=0.,roughnessFactor=.93,baseColorFactor=[1.,1.,1.,1.],doubleSided=True))
    scene=trimesh.Scene();scene.add_geometry(mesh,geom_name='Arraia_de_Areia_v02_refined')
    blob=scene.export(file_type='glb');GLB.write_bytes(blob)
    reread=trimesh.load(GLB,force='scene',process=False)
    gltf=glb_json(blob)
    assert len(gltf.get('meshes',[]))==1 and len(gltf.get('materials',[]))==1
    assert len(gltf.get('textures',[]))==1 and len(gltf.get('images',[]))==1
    assert not gltf.get('skins') and not gltf.get('animations')
    assert 'TEXCOORD_0' in gltf['meshes'][0]['primitives'][0]['attributes']
    triangles=sum(len(g.faces) for g in reread.geometry.values())
    assert triangles==len(sculpt.faces) and triangles>6296
    assert len(reread.geometry)==1
    assert np.isfinite(verts).all() and (uv>=0).all() and (uv<=1).all()
    assert np.allclose(reread.bounds[:,2],[-9,9],atol=.02)
    # Independently inspect embedded PNG pixels against user-reviewable raster.
    texture=reread.to_geometry().visual.material.baseColorTexture
    assert np.array_equal(np.asarray(texture.convert('RGB')),np.asarray(Image.open(TEX).convert('RGB')))
    record=dict(
        project='Wildhaven',species='Arraia-de-Areia',id='arraia-de-areia',version='v02',
        based_on='v01 blockout (user-approved shape)',stage='anatomical_refinement_static_uv',
        status={'concept':'approved_by_user','v01_shape':'approved_by_user',
                'v02_refinement':'awaiting_artistic_review','integration':'not_in_game'},
        model=GLB.name,texture='textures/'+TEX.name,
        texture_embedded=True,texture_resolution=[2048,2048],
        materials=1,meshes=1,triangles=triangles,vertices_flat_shaded=len(verts),
        joints=0,skins=0,animation_clips=0,lods=0,
        bytes_glb=len(blob),sha256_glb=hashlib.sha256(blob).hexdigest(),
        bytes_texture=TEX.stat().st_size,sha256_texture=hashlib.sha256(TEX.read_bytes()).hexdigest(),
        bounds_m=np.round(reread.bounds,4).tolist(),
        approx_wingspan_m=float(reread.extents[2]),approx_length_m=float(reread.extents[0]),
        textures_are_paint_only=True,color_patches_extra_meshes=0,
        feature_triangle_groups=sculpt.parts,
        render_source='VTK vtkGLTFImporter reimports this GLB',
        source_v01='assets/models/creatures/arraia-de-areia/v01/source/build.py'
    )
    (ROOT/'manifest.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:record[k] for k in ['triangles','materials','meshes','bytes_glb','sha256_glb','bounds_m','approx_wingspan_m','approx_length_m']},indent=2))

if __name__=='__main__':main()
