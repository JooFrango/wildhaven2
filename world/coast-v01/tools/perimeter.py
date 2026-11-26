"""Exterior flood fill, survey of the pinned terrain GLBs and concept-map registration."""
import json
import os
import sys
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
BASE = Path(os.environ.get('WILDHAVEN_BASE', ROOT.parents[1])).resolve()
WORLD = BASE / 'world'
sys.path.insert(0, str(WORLD / 'tropical-south-v01'))
from south_grid import A, CORNERS, DIR, center
from prepare_colors import colors
from base_world import resolve
from glb import GLB, dump

SOURCE = WORLD / 'tropical-south-v01/composition_195.json'
SEA = -270.0  # Below the lowest measured external terrain knot (-257.335 m).
TILES = json.loads(SOURCE.read_text('utf8'))['tiles']
CELLS = {(round(t['center_x']/(2*A)-t['center_z']/7500), round(t['center_z']/3750)):t for t in TILES}
PILOTS = {'glacial':(0,-7), 'praia':(5,3), 'dunas':(-4,0), 'falesia':(-4,13), 'arcos':(5,6)}
COLORS = dict(glacial='#d92e37', praia='#91521e', dunas='#f98324', falesia='#3071dc', arcos='#d93389')
# Centerlines traced in pixels on the supplied 589 x 636 map. Broken strokes stay separate.
STROKES = {
    'glacial':[[(109,70),(109,101),(122,134),(145,149),(191,150)],[(232,57),(258,57)]],
    'praia':[[(280,51),(317,55),(348,60),(364,83),(380,130)],[(214,151),(220,182)],[(379,318),(366,336),(378,367)]],
    'dunas':[[(198,174),(147,174),(110,182),(95,207),(81,269),(79,313),(91,345),(125,396),(150,405),(190,407),(177,444),(190,487),(203,500)]],
    'falesia':[[(396,127),(420,143),(439,181),(445,207),(461,228),(430,259),(428,282),(439,313),(396,315)],[(391,488),(405,469),(421,497),(438,524),(440,547),(458,582),(437,602),(364,603),(363,621),(337,623),(311,604),(270,607),(246,586),(230,553),(213,514)]],
    'arcos':[[(387,382),(401,414),(394,439),(393,466)]]}

def biome(t):
    return t.get('biome') or next((b for prefix,b in [('WG','glacial'),('ER','serra oriental'),('FX','floresta temperada'),('PL','planície'),('DN','megadunas'),('MN','maciço ocidental'),('MW','sopé'),('SV','savana'),('TR','transição tropical'),('J','selva')] if t['id'].startswith(prefix)), t['label'])

def exterior():
    low = np.min(list(CELLS),axis=0)-2
    high = np.max(list(CELLS),axis=0)+2
    stack = [tuple(low)]
    sea = set(stack)
    while stack:
        q,r = stack.pop()
        for dq,dr in DIR:
            p = q+dq,r+dr
            if low[0]<=p[0]<=high[0] and low[1]<=p[1]<=high[1] and p not in sea and p not in CELLS:
                stack.append(p)
                sea.add(p)
    return sea

def projection(xz):
    x,z = xz
    return np.array([190+.00616*x-.00018*z, 265+.00625*z])

def category(point):
    uv = projection(point)
    matches = []
    for kind,lines in STROKES.items():
        for line in lines:
            a,b = np.array(line[:-1]),np.array(line[1:])
            d = b-a
            t = ((uv-a)*d).sum(1)/(d*d).sum(1)
            matches.append((np.linalg.norm(uv-a-d*t.clip(0,1)[:,None],axis=1).min(),kind))
    return min(matches)[1]

def source(t):
    if t.get('regionId')=='tropical-south':
        return BASE/t['model_path']
    return resolve('detailed/'+t['id'].lower()+'_v12.glb')

def surface(g,t):
    names = [m['name'] for m in g.doc['meshes']]
    return g.primitive(next(n for n in ['terrain','terrain_v10','terrace_sand',t['id']] if n in names))

def knots(v,a,b):
    ab=(b-a)/2500
    s=(v[:,[0,2]]-a)@ab
    normal=np.array([-ab[1],ab[0]])
    d=(v[:,[0,2]]-a)@normal
    ix=np.flatnonzero((abs(d)<.015)&(s>-.015)&(s<2500.015))
    ix=ix[np.argsort(s[ix])]
    ix=ix[np.r_[True,np.diff(s[ix])>.02]]
    assert len(ix)>=10 and abs(s[ix[0]])<.02 and abs(s[ix[-1]]-2500)<.02
    return ix

def aqueous(name):
    return any(w in name.lower() for w in ['water','river','stream','lake','oasis','swamp_water','agua','água']) and not any(w in name.lower() for w in ['rock','tree','bank','bed','reed','plant','canopy','trunk'])

def survey():
    sea=exterior()
    planned=defaultdict(list)
    land=[]
    for (q,r),t in CELLS.items():
        sides=[(i,(q+d,r+e)) for i,(d,e) in enumerate(DIR) if (q+d,r+e) in sea]
        if not sides:continue
        g=GLB(source(t))
        v=g.array(surface(g,t)['attributes']['POSITION']).astype(float)
        water=[]
        for m in g.doc['meshes']:
            if aqueous(m['name']):
                for pr in m['primitives']:
                    water.append((m['name'],g.array(pr['attributes']['POSITION']).astype(float)))
        land.append(dict(id=t['id'],q=q,r=r,biome=biome(t),model_path=t['model_path'],sha256=g.sha))
        for i,slot in sides:
            a,b=CORNERS[[i,(i+1)%6]]
            ix=knots(v,a,b)
            crossings=[]
            for name,w in water:
                ab=(b-a)/2500
                local=w[:,[0,2]]-a
                along=local@ab
                distance=abs(local@[-ab[1],ab[0]])
                mask=(along>=-2)&(along<=2502)&(distance<2)
                if mask.any():crossings.append(dict(mesh=name,range_y=w[mask,1].tolist()[::max(1,int(mask.sum()/8))]))
            planned[slot].append(dict(source=t['id'],biome=biome(t),source_side=i,coast_side=(i+3)%6,
                kind=category(center(q,r)+(a+b)/2),knots=len(ix),height_m=[float(v[ix,1].min()),float(v[ix,1].max())],water_at_edge=crossings))
    return dict(composition=SOURCE.name,base_commit='a09d24d37e07beada8d9ddc680d4af305073be52',sea_level_m=SEA,
        inland_voids=[list(p) for p in sorted({(q+d,r+e) for q,r in CELLS for d,e in DIR}-sea-CELLS.keys())],
        boundary=land, slots=[dict(q=q,r=r,center_xz=center(q,r).tolist(),kind=Counter(e['kind'] for e in edges).most_common(1)[0][0],
            pilot=next((k for k,p in PILOTS.items() if p==(q,r)),None),contacts=edges) for (q,r),edges in sorted(planned.items(),key=lambda p:p[0][::-1])])

def draw(data):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from matplotlib.patches import Polygon, Patch
    fig,ax=plt.subplots(figsize=(11,14))
    def tile(pos,fill,label,edge='#fafafa',width=.55):
        c=center(*pos)/1000
        ax.add_patch(Polygon(c+CORNERS/1000,facecolor=fill,edgecolor=edge,lw=width))
        ax.text(*c,label,ha='center',va='center',fontsize=4.2)
    for pos,t in CELLS.items():tile(pos,'#e2e8dd',t['id'])
    for row in data['slots']:
        pos=row['q'],row['r']
        tile(pos,COLORS[row['kind']],f'{pos[0]},{pos[1]}','#112825' if row['pilot'] else 'white',2 if row['pilot'] else .6)
    ax.autoscale();ax.invert_yaxis();ax.set_aspect('equal');ax.set_xlabel('X continental (km)');ax.set_ylabel('Z continental (km)')
    ax.set_title('Wildhaven  ·  Planta do litoral V01\n195 peças existentes  /  77 posições externas  /  5 protótipos em contorno escuro',loc='left')
    ax.legend(handles=[Patch(color=c,label=k) for k,c in COLORS.items()],loc='lower left')
    fig.tight_layout()
    for ext in ['png','svg']:fig.savefig(ROOT/'preview'/('perimetro.'+ext),dpi=145)
    svg=ROOT/'preview/perimetro.svg'
    svg.write_text('\n'.join(line.rstrip() for line in svg.read_text('utf8').splitlines())+'\n',encoding='utf8')
    plt.close(fig)

if __name__=='__main__':
    data=survey()
    dump(ROOT/'perimetro.json',data)
    (ROOT/'preview').mkdir(exist_ok=True)
    draw(data)
    print(len(data['boundary']),len(data['slots']),sum(len(s['contacts']) for s in data['slots']))
