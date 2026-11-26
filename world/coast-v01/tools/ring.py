"""Fit the approved coastal surfaces to the entire exterior with a single world-space field."""
import json
from collections import defaultdict
from dataclasses import dataclass
import numpy as np
from scipy.ndimage import map_coordinates
from scipy.spatial import Delaunay
from scipy.interpolate import LinearNDInterpolator
from perimeter import ROOT, SEA, A, CELLS, CORNERS, DIR, PILOTS, GLB, center, colors, knots, source, surface
from terrain import basis, smooth

PLAN=json.loads((ROOT/'perimetro.json').read_text('utf8'))
SLOTS={(s['q'],s['r']):s for s in PLAN['slots']}
PILOT_FILES={t['id']:ROOT/t['model'] for t in json.loads((ROOT/'prototipos.json').read_text('utf8'))['tiles']}
NORMALS=(CORNERS+np.roll(CORNERS,-1,axis=0))/(2*A)
SAMPLE=np.linspace(-2500,2500,181)

def tile_id(pos):
    return SLOTS[pos]['pilot'] or 'costa_%+03d_%+03d'%pos

def rgb(g,pr):
    return colors(g,pr)

@dataclass
class Edge:
    a:np.ndarray
    b:np.ndarray
    axis:np.ndarray
    inward:np.ndarray
    s:np.ndarray
    y:np.ndarray
    color:np.ndarray
    slope:np.ndarray
    kind:str
    pilot:bool

def extract(g,pr,c,side,kind,pilot,v,col,faces):
    a,b=CORNERS[[side,(side+1)%6]];axis=(b-a)/2500
    outward=(a+b)/(2*A)
    ids=knots(v,a,b)
    along=(v[:,[0,2]]-a)@axis
    boundary=np.abs((v[:,[0,2]]-a)@outward)<.015
    mask=boundary[faces];selected=mask.sum(1)==2
    contact=faces[selected];tri=v[contact]
    normals=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0])
    good=np.abs(normals[:,1])>1e-6
    mid=((along[contact]*mask[selected]).sum(1)/2)[good];order=np.argsort(mid)
    slope=-(normals[good][:,[0,2]]@outward)/normals[good,1]
    s=along[ids].copy();s[0]=0;s[-1]=2500
    return Edge(a+c,b+c,axis,outward,s,v[ids,1],col[ids],np.interp(s,mid[order],slope[order]),kind,pilot)

class Ring:
    def __init__(self):
        self.fixed={};self.edges=[];self.ocean=[];self.samples={}
        requests=defaultdict(list)
        for pos,slot in SLOTS.items():
            for e in slot['contacts']:
                side=e['coast_side'];dq,dr=DIR[side]
                requests[(pos[0]+dq,pos[1]+dr)].append((pos,side,e['kind']))
            for side,(dq,dr) in enumerate(DIR):
                other=pos[0]+dq,pos[1]+dr
                if other not in SLOTS and other not in CELLS:
                    self.ocean.append(CORNERS[[side,(side+1)%6]]+center(*pos))
                if slot['pilot'] and other in SLOTS and not SLOTS[other]['pilot']:
                    requests[pos].append((other,(side+3)%6,slot['pilot']))
        for old,faces_wanted in requests.items():
            pil=old in SLOTS
            if pil:
                kind=SLOTS[old]['pilot'];g=GLB(PILOT_FILES[kind]);pr=g.primitive('terrain')
            else:
                tile=CELLS[old];g=GLB(source(tile));pr=surface(g,tile)
            v=g.array(pr['attributes']['POSITION']).astype(float);col=rgb(g,pr)
            f=g.array(pr['indices']).reshape(-1,3)
            for pos,side,kind in faces_wanted:
                e=extract(g,pr,center(*old),(side+3)%6,kind,pil,v,col,f)
                self.edges.append(e);self.fixed[pos,side]=e
        self.ocean=np.array(self.ocean)
        xx,zz=np.meshgrid(SAMPLE,SAMPLE);grid=np.column_stack((xx.ravel(),zz.ravel()))
        coords=grid/np.maximum(1,(grid@NORMALS.T).max(1)[:,None]/(A-.1))
        for kind,path in PILOT_FILES.items():
            g=GLB(path);pr=g.primitive('terrain');v=g.array(pr['attributes']['POSITION'])
            values=np.column_stack([v[:,1],rgb(g,pr)])
            self.samples[kind]=LinearNDInterpolator(v[:,[0,2]],values)(coords).reshape(len(SAMPLE),len(SAMPLE),4)
        river=next(t for t in CELLS.values() if t['id']=='SV_E')
        g=GLB(source(river));pr=g.primitive('river_water');w=g.array(pr['attributes']['POSITION'])
        bank=w[np.abs(w[:,0]-A)<.01]
        self.mouth=np.array([river['center_x']+A,river['center_z']+np.mean([bank[:,2].min(),bank[:,2].max()])])
        self.river_y=float(np.median(bank[:,1]))
        self.half=float(np.ptp(bank[:,2])/2)

    def channel(self,x):
        run=np.clip(x,0,3050);t=run/3050
        z=self.mouth[1]+190*np.sin(run/700)*smooth(run/420)+235*t
        width=self.half+47*smooth(t)+16*np.sin(t*np.pi)
        y=self.river_y+(SEA-self.river_y)*smooth(t)
        return z,width,y

    def points(self,pos):
        perimeter=[]
        for i in range(6):
            a,b=CORNERS[[i,(i+1)%6]];edge=self.fixed.get((pos,i))
            s=2500-edge.s[::-1] if edge else np.linspace(0,2500,73)
            perimeter.extend(a+(b-a)*s[:-1,None]/2500)
        ring=np.array(perimeter);c=center(*pos)
        # Offset rows at the edge preserve the input slope. Seed interior sites per tile.
        rng=np.random.default_rng(81007+101*pos[0]+1009*pos[1])
        x,z=np.meshgrid(np.arange(-2400,2440,77),np.arange(-2400,2440,77))
        grid=np.column_stack([x.ravel(),z.ravel()])+rng.uniform(-17,17,(x.size,2))
        sites=[ring,ring*(1-12/A),grid[(grid@NORMALS.T).max(1)<A-36]]
        if pos==(5,5):
            # Sample the riverbed and both banks explicitly. The water ribbon shares the same stations.
            run=np.arange(0,3051,25);zz,width,_=self.channel(run)
            for frac in [-1.35,-1,-.79,0,.79,1,1.35]:
                p=np.column_stack([self.mouth[0]+run,zz+frac*width])-c
                sites.append(p[(p@NORMALS.T).max(1)<A-15])
        p=np.vstack(sites);tri=Delaunay(p);faces=tri.simplices[:,::-1]
        a,b=p[faces[:,1]]-p[faces[:,0]],p[faces[:,2]]-p[faces[:,0]]
        return p,faces[(a[:,1]*b[:,0]-a[:,0]*b[:,1])>.001]

    def field(self,pos,p):
        c=center(*pos);world=p+c;x,z=world.T
        total=np.zeros(len(p));vals=np.zeros((len(p),4));fixed=np.zeros_like(vals);fw=np.zeros(len(p))
        nearest=np.full(len(p),1e8);pilot_distance=nearest.copy()
        for e in self.edges:
            if np.linalg.norm((e.a+e.b)/2-c)>9450:continue
            delta=world-e.a;s=np.clip(delta@e.axis,0,2500)
            dist=np.linalg.norm(delta-s[:,None]*e.axis,axis=1)
            influence=smooth(1-dist/5300)/np.maximum(dist,1.)**2
            if not np.any(influence):continue
            y=np.interp(s,e.s,e.y)+np.interp(s,e.s,e.slope)*np.minimum(dist,120)
            col=np.column_stack([np.interp(s,e.s,e.color[:,j]) for j in range(3)])
            edge_val=np.column_stack([y,col])
            exact=influence**2
            fixed+=exact[:,None]*edge_val;fw+=exact;nearest=np.minimum(nearest,dist)
            if e.pilot:
                pilot_distance=np.minimum(pilot_distance,dist)
                continue
            along,out=basis(e.kind)
            tangent=e.axis
            # Preserve wind/strata continuity with world-space, kilometre-scale variation.
            wave=210*np.sin(x/1030+z/1980)+125*np.cos(z/511-x/1770)
            u=(s-1250)*(.89+.11*np.cos((e.a[0]+e.a[1])/13000))+155*np.sin(z/720+x/1100)
            vv=dist-A+wave*smooth(dist/610)
            look=u[:,None]*along+vv[:,None]*out
            ij=np.array([look[:,1]+2500,look[:,0]+2500])*(len(SAMPLE)-1)/5000
            template=self.samples[e.kind]
            fields=np.column_stack([map_coordinates(template[:,:,j],ij,order=1,mode='nearest') for j in range(4)])
            # Carry local biome colour onto the upper terraces, keeping ice/rock exposed at the shore.
            upland=smooth((fields[:,0]-SEA-100)/210)*smooth((2450-dist)/850)
            factor=.86 if e.kind in ('praia','falesia','arcos') else .30
            fields[:,1:]+=factor*upland[:,None]*(col-fields[:,1:])
            vals+=influence[:,None]*fields;total+=influence
        assert total.min()>0
        vals/=total[:,None];fixed/=fw[:,None]
        margin=np.full(len(p),1e8)
        for a,b in self.ocean:
            if np.linalg.norm((a+b)/2-c)>8000:continue
            direction=(b-a)/2500;delta=world-a
            margin=np.minimum(margin,np.linalg.norm(delta-np.clip(delta@direction,0,2500)[:,None]*direction,axis=1))
        # Submerge every open edge; the continental field and each approved pilot take precedence at contacts.
        ocean=smooth(margin/820)
        vals[:,0]=(SEA-175)*(1-ocean)+vals[:,0]*ocean
        vals[:,1:]=np.array([.07,.105,.11])*(1-ocean[:,None])+vals[:,1:]*ocean[:,None]
        blend=smooth((nearest-18)/np.where(pilot_distance<=nearest+.01,760,780))
        vals=fixed+(vals-fixed)*blend[:,None]
        run=x-self.mouth[0];cz,width,water=self.channel(run)
        side=np.abs(z-cz)/width
        carve=(1-smooth((side-.80)/.70))*smooth(run/110)*smooth((3540-run)/420)
        bed=water-9-7*(1-np.minimum(1,side)**2)
        vals[:,0]-=carve*np.maximum(0,vals[:,0]-bed)
        # Retain a channel even where the template drops below the descending stream.
        bank=water+22*(np.minimum(side,2)-1)
        raise_bank=smooth(run/110)*smooth((3425-run)/365)*(1-smooth((side-1.55)/1.1))
        vals[:,0]+=raise_bank*np.maximum(0,bank-vals[:,0])
        return vals
