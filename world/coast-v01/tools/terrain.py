"""Shape the five coasts in local metres. Positive cross-shore coordinate points to sea."""
import numpy as np
from scipy.interpolate import LinearNDInterpolator
from scipy.spatial import Delaunay
from perimeter import A, CORNERS, CELLS, DIR, PILOTS, SEA, center, colors, GLB, knots, source, surface

def smooth(x):
    t=np.clip(x,0,1)
    return t*t*(3-2*t)

def mix(a,b,t):
    return a+(b-a)*t

def tint(a,b,t):
    return mix(np.asarray(a),np.asarray(b),t[:,None])

def basis(kind):
    q,r=PILOTS[kind]
    normals=[]
    for i,(dq,dr) in enumerate(DIR):
        if (q+dq,r+dr) in CELLS:normals.append(-(CORNERS[i]+CORNERS[(i+1)%6])/(2*A))
    out=np.sum(normals,axis=0);out/=np.linalg.norm(out)
    return np.array([out[1],-out[0]]),out

def shoreline(kind,u):
    if kind=='glacial':
        return 350+425*np.exp(-((u+910)/535)**2)-310*np.exp(-((u-250)/730)**2)+175*np.exp(-((u-1340)/500)**2)
    bays=260*np.sin(u/665+.8)+125*np.sin(u/286-.5)+52*np.cos(u/126)
    if kind in ('arcos','falesia'):bays+=100*np.sin(u/87+np.cos(u/207))
    return 410+bays

def neighboring_field(tile,p):
    """Read the relief and effective linear albedo together from the same source surface."""
    g=GLB(source(tile))
    pr=surface(g,tile)
    v=g.array(pr['attributes']['POSITION']).astype(float)
    normals=(CORNERS+np.roll(CORNERS,-1,axis=0))/(2*A)
    extent=(p@normals.T).max(axis=1)
    inside=p/np.maximum(1,extent[:,None]/(A-2))
    data=LinearNDInterpolator(v[:,[0,2]],np.column_stack([v[:,1],colors(g,pr)]))(inside)
    assert np.isfinite(data).all(),tile['id']
    return data[:,0],data[:,1:]

def relief(kind,p,tile):
    along,out=basis(kind)
    u=p@along; v=p@out
    k=shoreline(kind,u)-v  # distance inland relative to the curving shore
    rugged=np.sin(u/164+v/310)*np.cos(v/197-u/680)+.37*np.sin(v/83+u/71)
    sand=np.array([.68,.45,.235])
    green=np.array([.135,.22,.054])
    if kind=='praia':
        upland=smooth((k-270)/1650)
        h=.055*k+upland*(285+72*rugged+51*np.cos(u/440))
        h+=19*np.exp(-((k-300-76*np.sin(u/430))/95)**2)
        c=tint(sand*.59,sand,smooth(k/100))
        c=tint(c,green,smooth((k-230-80*rugged)/270))
        c=tint(c,[.26,.31,.077],upland*(.3+.3*np.sin(u/210+v/187)))
    elif kind=='dunas':
        # Shift the crescent and the slip faces along the erg's existing wind direction.
        patch=np.column_stack([p[:,0]*1.06+208+.12*p[:,1],p[:,1]*.94-365])
        ridge,rgb=neighboring_field(tile,patch)
        land=smooth(k/1330)
        h=mix(.073*k,ridge-SEA,land)
        c=tint([.32,.178,.083],rgb,smooth(k/165))
    elif kind=='glacial':
        # A spur of WG_05 descends into a glacial trough and ends at the calving front.
        patch=np.column_stack([.90*p[:,0]+.29*p[:,1]+185,-.24*p[:,0]+.96*p[:,1]-420])
        mountain,rgb=neighboring_field(tile,patch)
        land=smooth((k-95)/1080)
        ice=.20*k+94*smooth((k+8)/56)+25*smooth((k-180)/120)
        h=mix(ice,(mountain-195)*.78+400,land)
        c=tint([.086,.28,.39],[.72,.85,.88],smooth((k-22)/116))
        c=tint(c,rgb,smooth((k-125)/440))
    elif kind=='falesia':
        notch=130*np.exp(-((u-630)/290)**2)
        h=.13*k+ (200-notch)*smooth((k+24)/76)+74*smooth((k-164-35*rugged)/78)+76*smooth((k-470)/225)
        h+=smooth(k/175)*(29*rugged+28*np.cos(u/405))
        c=tint([.055,.069,.073],[.235,.21,.153],smooth((h+18)/190))
        c=tint(c,[.073,.187,.054],smooth((k-58)/125)*(.80+.18*np.cos(u/192)))
        c=tint(c,[.18,.24,.057],smooth((k-460)/290)*(.55+.3*np.sin(v/193)))
    else:
        # Two wave-cut benches and shallow, irregular channels around tidal platforms.
        h=.095*k+27*smooth((k-55)/60)+89*smooth((k-320-62*rugged)/116)+76*smooth((k-790)/360)
        h+=smooth((k+220)/290)*17*rugged
        pools=15*np.exp(-((k-123)/103)**2)*(1+np.sin(u/83+.6*np.sin(v/90)))
        h-=pools
        c=tint([.085,.105,.092],[.427,.257,.13],smooth((h+10)/44))
        _,savanna=neighboring_field(tile,p*.91+[165,-160])
        c=tint(c,savanna,smooth((k-175)/245))
    h=np.where(k<0,np.maximum(h,-230+16*rugged),h)
    c=tint(c,[.084,.132,.116],.85*smooth(-k/180))
    return h+SEA,c

def profiles(kind):
    q,r=PILOTS[kind]
    records=[]
    for i,(dq,dr) in enumerate(DIR):
        tile=CELLS.get((q+dq,r+dr))
        if not tile:continue
        g=GLB(source(tile));pr=surface(g,tile)
        v=g.array(pr['attributes']['POSITION']).astype(float)
        v[:,[0,2]]+=np.array([tile['center_x'],tile['center_z']])-center(q,r)
        a,b=CORNERS[[i,(i+1)%6]]
        ix=knots(v,a,b)
        tangent=(b-a)/2500
        inward=-(a+b)/(2*A)
        along=(v[:,[0,2]]-a)@tangent
        normal_distance=(v[:,[0,2]]-a)@inward
        faces=g.array(pr['indices']).reshape(-1,3)
        mask=abs(normal_distance[faces])<.015
        adj=faces[mask.sum(1)==2]
        tri=v[adj]
        normals=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0])
        good=abs(normals[:,1])>.00001
        mid=(along[adj]*mask[mask.sum(1)==2]).sum(1)[good]/2
        order=np.argsort(mid)
        slope=-(normals[good][:,[0,2]]@inward)/normals[good,1]
        rgb=colors(g,pr)[ix]
        records.append(dict(side=i,a=a,b=b,axis=tangent,inward=inward,s=along[ix],y=v[ix,1],c=rgb,
                            mid=mid[order],slope=slope[order],tile=tile))
    return records

def build_ground(kind,rng):
    recs=profiles(kind)
    sides={r['side']:r for r in recs}
    rings=[]
    for i in range(6):
        a,b=CORNERS[[i,(i+1)%6]]
        s=sides[i]['s']/2500 if i in sides else np.linspace(0,1,73)
        s=np.clip(s,0,1);s[0]=0
        rings.extend(a+(b-a)*s[:-1,None])
    ring=np.array(rings)
    normals=(CORNERS+np.roll(CORNERS,-1,axis=0))/(2*A)
    step=37
    gx,gz=np.meshgrid(np.arange(-2490,2490,step),np.arange(-2490,2490,step))
    grid=np.column_stack([gx.ravel(),gz.ravel()])+rng.uniform(-.29,.29,(gx.size,2))*step
    grid=grid[(grid@normals.T).max(1)<A-42]
    p=np.vstack([ring,ring*(1-10/A),ring*(1-29/A),grid])
    delaunay=Delaunay(p)
    f=delaunay.simplices[:,::-1].copy()
    tri=p[f];a,b=tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]
    f=f[(a[:,1]*b[:,0]-a[:,0]*b[:,1])>.001]
    h,c=relief(kind,p,recs[0]['tile'])
    distances=[];heights=[];cols=[]
    for rec in recs:
        off=p-rec['a']
        s=np.clip(off@rec['axis'],0,2500)
        d=np.linalg.norm(off-s[:,None]*rec['axis'],axis=1)
        distances.append(d)
        gradient=np.interp(s,rec['mid'],rec['slope'])
        heights.append(np.interp(s,rec['s'],rec['y'])+gradient*np.minimum(d,260))
        cols.append(np.column_stack([np.interp(s,rec['s'],rec['c'][:,k]) for k in range(3)]))
    distances=np.stack(distances,axis=1);d=distances.min(1)
    weight=1/np.maximum(.001,distances)**4;weight/=weight.sum(1)[:,None]
    transition={'dunas':590,'glacial':840}.get(kind,1020)
    h=mix((weight*np.array(heights).T).sum(1),h,smooth((d-27)/transition))
    c=tint((weight[:,:,None]*np.stack(cols,axis=1)).sum(1),c,smooth((d-12)/600))
    return np.column_stack([p[:,0],h,p[:,1]]),f,c,recs
