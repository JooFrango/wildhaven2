"""Place each exported game tile at its manifest origin and compare every edge."""
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from ridge import ROOT, CELLS, folder, terrain, corridor, center, GLB, CORNERS, DIR, knots, np

catalog=json.loads((folder/'composition.json').read_text())
heights={}
for tile in catalog['tiles']:
    pos=tile['q'],tile['r']
    g=GLB(folder/(tile['id']+'.glb'))
    assert g.sha==tile['sha256']
    mesh=g.primitive('terrain')
    v=g.array(mesh['attributes']['POSITION']).astype(float)
    assert np.allclose(center(*pos),[tile['center_x'],tile['center_z']])
    assert np.isfinite(v).all() and np.max(abs(v[:,2]))==2500
    heights[pos]=v
assert set(heights)==corridor
errors=[]
coast={(t['q'],t['r']):t for t in json.loads((ROOT/'viewer/continente/composition.json').read_text())['tiles']}
for pos in sorted(corridor):
    for i,(dq,dr) in enumerate(DIR):
        near=pos[0]+dq,pos[1]+dr
        if near in corridor and near<pos:continue
        if near in heights:
            other=heights[near]
        elif near in CELLS:
            other=terrain(near)[0]
        else:
            g=GLB(ROOT/coast[near]['model'])
            other=g.array(g.primitive('terrain')['attributes']['POSITION']).astype(float)
        v=heights[pos]
        ids=knots(v,*CORNERS[[i,(i+1)%6]])
        js=knots(other,*CORNERS[[(i+3)%6,(i+4)%6]])[::-1]
        delta=v[ids]-other[js]
        delta[:,[0,2]]+=center(*pos)-center(*near)
        errors.append((float(np.linalg.norm(delta,axis=1).max()),pos,near))
print('Interfaces:',len(errors),'Worst:',sorted(errors,reverse=True)[:5])
assert max(errors)[0]<.03
