#!/usr/bin/env python3
"""Varrisco v04 — extend the real 29-clip v03 GLB to 41 skeletal animations.

Experimental original animation curves, not hand-animated/artist approved.
Uses only Python stdlib. Geometry, skin, materials, weights, and *all* existing
v03 keyframe data are retained byte-for-byte. The game owns position/damage.
Run: python assets/models/creatures/varrisco/v04/source/build_v04.py
"""
from __future__ import annotations
import hashlib
import json
import math
import struct
from pathlib import Path

DIR = Path(__file__).resolve().parent.parent
SRC = DIR.parent / 'v03' / 'varrisco-animated-v03-LOD0.glb'
DEST = DIR / 'varrisco-animated-v04-LOD0.glb'

# The remaining planned movements: four combat, five injury, three behaviour.
# Clip ID, duration (seconds), fps, repeat, category, semantic contact point.
NEW = [
    ('body_slam',          1.46, 36, False, 'combat',    .67),
    ('grab_start',         1.12, 36, False, 'combat',    .66),
    ('grab_hold',          1.60, 30, True,  'combat',    None),
    ('grab_release',       1.05, 30, False, 'combat',    .35),
    ('hurt_head',           .86, 30, False, 'injury',    None),
    ('hurt_leg',           1.12, 30, False, 'injury',    None),
    ('stagger',            1.12, 30, False, 'injury',    None),
    ('fall',               1.32, 36, False, 'injury',    None),
    ('get_up',             1.80, 36, False, 'injury',    None),
    ('exhausted',          2.60, 24, True,  'behaviour', None),
    ('guard_carcass',      2.20, 24, True,  'behaviour', None),
    ('search_lost_prey',   3.00, 24, True,  'behaviour', None),
]
assert len(NEW) == 12 and len({s[0] for s in NEW}) == 12

raw = SRC.read_bytes()
assert raw[:4] == b'glTF'
assert struct.unpack_from('<II', raw, 4) == (2, len(raw))
json_len, json_type = struct.unpack_from('<I4s', raw, 12)
assert json_type == b'JSON'
doc = json.loads(raw[20:20+json_len])
bin_pos = 20+json_len
bin_len, bin_type = struct.unpack_from('<I4s', raw, bin_pos)
assert bin_type == b'BIN\0'
original_bin = raw[bin_pos+8:bin_pos+8+bin_len]
assert len(doc['animations']) == 29
assert len(doc['skins']) == 1 and len(doc['skins'][0]['joints']) == 22
assert len({a['name'] for a in doc['animations']}) == 29
assert len(doc['meshes']) == 1
names = {node['name']: n for n, node in enumerate(doc['nodes'])}
bones = ('root pelvis thorax neck head jaw tailA tailB tailC tailD '
         'thighL shinL footL thighR shinR footR shoulderL forearmL handL '
         'shoulderR forearmR handR').split()
assert all(name in names for name in bones)
assert not set(spec[0] for spec in NEW).intersection({a['name'] for a in doc['animations']})

def sm(t):
    t = max(0., min(1., t))
    return t*t*(3.-2.*t)

def hump(q, a, peak, b):
    return sm((q-a)/(peak-a))*(1-sm((q-peak)/(b-peak)))

def pose(name: str, q: float):
    """Delta rotations in xyz radians and bone-relative translations in metres."""
    rr, tt = {}, {}
    def R(n, x=0., y=0., z=0.):
        v = rr.setdefault(n, [0., 0., 0.])
        v[0]+=x; v[1]+=y; v[2]+=z
    def T(n, x=0., y=0., z=0.):
        v = tt.setdefault(n, [0., 0., 0.])
        v[0]+=x; v[1]+=y; v[2]+=z

    w = math.tau*q
    s = math.sin(w)
    s2 = math.sin(w*2)
    breathe = .5-.5*math.cos(w)
    if name == 'body_slam':
        # Lower the pelvis, wind up, drive the shoulder forward, recover.
        prep = hump(q, .01, .20, .44)
        charge = hump(q, .31, .63, .92)
        settle = hump(q, .80, .90, 1.)
        T('pelvis', -.06*prep+.09*charge, -.16*prep+.08*charge-.05*settle)
        R('pelvis', 0, 0, -.22*prep+.16*charge)
        R('thorax', 0, .13*charge, .23*prep-.46*charge)
        R('neck', 0, 0, .15*prep-.20*charge)
        R('head', 0, 0, .12*prep-.15*charge)
        R('shoulderL', 0, 0, -.32*charge)
        R('shoulderR', 0, 0, -.32*charge)
        for foot in ('L','R'):
            R('thigh'+foot, 0, 0, -.38*prep+.20*charge)
            R('shin'+foot, 0, 0, .47*prep-.22*charge)
        R('tailA', 0, -.14*charge, .24*charge)
        R('tailB', 0, -.13*charge, .16*charge)

    elif name == 'grab_start':
        prep = hump(q, .02, .30, .54)
        reach = hump(q, .37, .64, .94)
        closed = sm((q-.58)/.20)
        T('pelvis', 0, -.13*prep+.03*reach)
        R('thorax', 0, 0, .18*prep-.24*reach)
        R('neck', 0, 0, .29*prep-.32*reach)
        R('head', 0, 0, .12*prep-.20*reach)
        T('neck', .04*reach)
        T('head', .14*reach)
        R('jaw', 0, 0, -.42*(1-closed)*hump(q,.02,.33,.85))
        for foot in ('L','R'):
            R('thigh'+foot, 0, 0, -.22*prep)
            R('shin'+foot, 0, 0, .29*prep)
        R('tailA', 0, 0, .18*reach)

    elif name == 'grab_hold':
        # Loop maintains a gripped pose; actual attachment is in collision physics.
        struggle = .5-.5*math.cos(w)
        R('neck', 0, -.065*s, -.16+.05*struggle)
        R('head', 0, .045*s, -.07+.045*struggle)
        R('jaw', 0, 0, -.08+.024*s2)
        R('thorax', 0, .045*s, .07+.035*struggle)
        R('tailA', 0, -.14*s, .04*s2)
        R('tailB', 0, -.12*s, .03*s2)
        T('pelvis', 0, -.07+.018*struggle)
        for foot in ('L','R'):
            R('thigh'+foot, 0, 0, -.11)
            R('shin'+foot, 0, 0, .12)

    elif name == 'grab_release':
        opened = hump(q, .02, .30, .75)
        recoil = hump(q, .24, .55, .98)
        R('jaw', 0, 0, -.45*opened)
        R('neck', 0, 0, -.14*opened+.21*recoil)
        R('head', 0, 0, -.10*opened+.14*recoil)
        R('thorax', 0, 0, .13*recoil)
        T('head', -.09*recoil)
        R('tailA', 0, 0, -.13*recoil)

    elif name == 'hurt_head':
        shock = hump(q, .01, .18, .64)
        recover = hump(q, .38, .70, 1.)
        R('head', -.12*shock, -.38*shock+.08*recover, .40*shock-.07*recover)
        R('neck', .08*shock, .20*shock, .31*shock)
        R('thorax', -.12*shock, -.15*shock, .14*shock)
        R('jaw', 0, 0, -.20*shock)
        R('tailA', 0, .16*shock)
        T('pelvis', 0, -.055*shock)

    elif name == 'hurt_leg':
        buckle = hump(q, .03, .30, .78)
        recover = hump(q, .58, .80, 1.)
        R('thighL', .15*buckle, 0, -.53*buckle)
        R('shinL', 0, 0, .77*buckle)
        R('footL', 0, 0, -.18*buckle)
        R('thighR', 0, 0, .14*buckle)
        T('pelvis', 0, -.22*buckle+.06*recover, -.09*buckle)
        R('thorax', -.11*buckle, 0, .16*buckle)
        R('tailA', .05*buckle, 0, .27*buckle)
        R('neck', 0, 0, .12*buckle)

    elif name == 'stagger':
        hit = hump(q, .02, .25, .62)
        return_to_base = hump(q, .42, .73, 1.)
        R('root', .12*hit, .17*hit, -.22*hit+.08*return_to_base)
        R('thorax', -.16*hit, -.15*hit, .32*hit)
        R('neck', 0, 0, -.21*hit)
        R('head', 0, 0, -.22*hit)
        R('tailA', 0, .22*hit, -.28*hit)
        R('thighL', 0, 0, -.24*hit)
        R('thighR', 0, 0, .18*hit)
        R('shinL', 0, 0, .25*hit)
        T('pelvis', -.05*hit, -.10*hit)

    elif name == 'fall':
        fall = sm((q-.07)/.83)
        collision = hump(q, .58, .81, .98)
        # End on the side, not back at rest; physical ground/contact remains authoritative.
        R('root', -.82*fall, .09*fall, -.22*fall)
        T('root', 0, -.44*fall-.04*collision)
        R('thorax', 0, 0, .22*fall)
        R('neck', 0, 0, .37*fall)
        R('head', 0, 0, .25*fall+.06*collision)
        R('jaw', 0, 0, -.08*fall)
        R('thighL', 0, 0, -.48*fall)
        R('thighR', 0, 0, .28*fall)
        R('shinL', 0, 0, .56*fall)
        R('shinR', 0, 0, -.25*fall)
        R('tailA', 0, 0, -.22*fall)
        R('tailB', .10*fall, 0, -.14*fall)

    elif name == 'get_up':
        rise = sm((q-.12)/.76)
        # Start in the fall end-pose, gradually return to identity.
        ground = 1-rise
        R('root', -.82*ground, .09*ground, -.22*ground)
        T('root', 0, -.44*ground)
        R('thorax', 0, 0, .22*ground-.12*hump(q,.42,.60,.85))
        R('neck', 0, 0, .37*ground)
        R('head', 0, 0, .25*ground)
        R('jaw', 0, 0, -.08*ground)
        R('thighL', 0, 0, -.48*ground-.10*hump(q,.3,.58,.84))
        R('thighR', 0, 0, .28*ground-.08*hump(q,.3,.58,.84))
        R('shinL', 0, 0, .56*ground+.14*hump(q,.3,.58,.84))
        R('shinR', 0, 0, -.25*ground+.11*hump(q,.3,.58,.84))
        R('tailA', 0, 0, -.22*ground)
        R('tailB', .10*ground, 0, -.14*ground)

    elif name == 'exhausted':
        # Panting and fatigue; loop has identical first and last poses.
        R('thorax', 0, 0, .13+.033*s)
        R('neck', 0, 0, .08+.035*s)
        R('head', 0, 0, .09+.025*s)
        R('jaw', 0, 0, -.19-.09*breathe)
        T('pelvis', 0, -.11+.014*s2)
        for foot in ('L','R'):
            R('thigh'+foot, 0, 0, -.10)
            R('shin'+foot, 0, 0, .16)
        R('tailA', 0, .045*s)
        R('tailB', 0, .06*s)

    elif name == 'guard_carcass':
        # Defensive watch around food without forcibly causing an attack.
        R('neck', 0, .19*s, -.14+.03*s2)
        R('head', 0, .12*s, -.07)
        R('jaw', 0, 0, -.09*(.5-.5*math.cos(w*2)))
        R('thorax', 0, .065*s, -.045)
        R('shoulderL', 0, 0, -.11+.035*s)
        R('shoulderR', 0, 0, -.11-.035*s)
        T('pelvis', 0, -.07+.018*breathe)
        R('tailA', 0, -.23*s)
        R('tailB', 0, -.17*s)
        for foot in ('L','R'):
            R('thigh'+foot, 0, 0, -.08)
            R('shin'+foot, 0, 0, .09)

    elif name == 'search_lost_prey':
        # Sniffing, scanning; senses/brain remain responsible for reacquiring prey.
        scan = math.sin(w)
        scan2 = math.sin(w*2)
        R('neck', 0, .23*scan, .16*breathe)
        R('head', 0, .17*scan, .12*breathe)
        R('jaw', 0, 0, -.04*breathe)
        R('thorax', 0, -.06*scan, .045*breathe)
        R('tailA', 0, -.15*scan)
        R('tailB', 0, -.10*scan2)
        T('pelvis', 0, -.027*breathe)

    else:
        raise ValueError(name)
    return rr,tt

def quaternion(angles):
    x,y,z = (a*.5 for a in angles)
    sx,sy,sz = math.sin(x), math.sin(y), math.sin(z)
    cx,cy,cz = math.cos(x), math.cos(y), math.cos(z)
    return (sx*cy*cz+cx*sy*sz, cx*sy*cz-sx*cy*sz,
            cx*cy*sz+sx*sy*cz, cx*cy*cz-sx*sy*sz)

binout = bytearray(original_bin)
def add_float_accessor(values, typ):
    assert typ in ('SCALAR','VEC3','VEC4')
    assert all(math.isfinite(a) for a in values)
    data = struct.pack('<' + 'f'*len(values), *values)
    view_index = len(doc['bufferViews'])
    doc['bufferViews'].append({
        'buffer':0,
        'byteOffset':len(binout),
        'byteLength':len(data),
    })
    binout.extend(data)
    comps = {'SCALAR':1,'VEC3':3,'VEC4':4}[typ]
    accessor = {
        'bufferView':view_index,
        'componentType':5126,
        'count':len(values)//comps,
        'type':typ,
    }
    if typ=='SCALAR':
        accessor.update({'min':[min(values)],'max':[max(values)]})
    index = len(doc['accessors'])
    doc['accessors'].append(accessor)
    return index

for name,duration,fps,loop,category,contact in NEW:
    frames = math.ceil(duration*fps)
    times = [duration*i/frames for i in range(frames+1)]
    time_accessor = add_float_accessor(times, 'SCALAR')
    samplers, channels = [], []
    for bone in bones:
        rot_data, trans_data = [], []
        has_rotation, has_translation = False, False
        rest = doc['nodes'][names[bone]].get('translation',[0.,0.,0.])
        for k in range(frames+1):
            rr,tt=pose(name,k/frames)
            angle=rr.get(bone,[0.,0.,0.])
            offset=tt.get(bone,[0.,0.,0.])
            has_rotation |= any(abs(x)>1e-5 for x in angle)
            has_translation |= any(abs(x)>1e-5 for x in offset)
            rot_data.extend(quaternion(angle))
            trans_data.extend(rest[i]+offset[i] for i in range(3))
        if has_rotation:
            idx=add_float_accessor(rot_data,'VEC4')
            samplers.append({'input':time_accessor,'output':idx,'interpolation':'LINEAR'})
            channels.append({'sampler':len(samplers)-1,
                             'target':{'node':names[bone],'path':'rotation'}})
        if has_translation:
            idx=add_float_accessor(trans_data,'VEC3')
            samplers.append({'input':time_accessor,'output':idx,'interpolation':'LINEAR'})
            channels.append({'sampler':len(samplers)-1,
                             'target':{'node':names[bone],'path':'translation'}})
    assert len(channels)>=5, (name,len(channels))
    for channel in channels:
        assert channel['target']['node'] in [names[b] for b in bones]
    clip = {'name':name,'samplers':samplers,'channels':channels,
            'extras':{
                'loop':loop,
                'durationSeconds':duration,
                'fps':fps,
                'stage':'experimental_v04',
                'category':category,
                'rootMotion':'in_place',
                'contactFraction':contact,
                'physicalAuthority':'ecology_kernel'
            }}
    doc['animations'].append(clip)

assert len(doc['animations'])==41
assert len({c['name'] for c in doc['animations']})==41
assert binout[:len(original_bin)]==original_bin
doc['asset']['generator']='Wildhaven Varrisco v04 / 41 original rig clips'
doc['buffers'][0]['byteLength']=len(binout)
payload=json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode('utf8')
payload+=b' '*((-len(payload))%4)
binout.extend(b'\x00'*(-len(binout)%4))
glb=(b'glTF'+struct.pack('<II',2,12+8+len(payload)+8+len(binout))
     +struct.pack('<I4s',len(payload),b'JSON')+payload
     +struct.pack('<I4s',len(binout),b'BIN\0')+binout)
assert len(glb)==struct.unpack_from('<I',glb,8)[0]
DEST.write_bytes(glb)
manifest={
    'species':'varrisco',
    'version':'v04-experimental-41',
    'stage':'rig_and_animation_exported_review_pending',
    'previous_version':'v03',
    'source_v03_sha256':hashlib.sha256(raw).hexdigest(),
    'glb':{
        'path':DEST.name,
        'bytes':len(glb),
        'sha256':hashlib.sha256(glb).hexdigest(),
        'triangles':2754,
        'skin_count':1,
        'joints':22,
        'animations':41,
        'previous_animations_preserved':29,
    },
    'added':[
        {'name':name,'durationSeconds':d,'fps':fps,'loop':loop,
         'category':category,'contactFraction':contact}
        for name,d,fps,loop,category,contact in NEW
    ],
    'qa':{
        '29_original_clips_unchanged':True,
        'v03_bin_prefix_unchanged':True,
        'no_new_geometry':True,
        'khronos_independent_validation':'pending',
        'browser_visual_review':'pending',
        'artistic_approval':'pending',
    },
    'limitations':[
        'Procedural experimental keyframes: animation aesthetics not yet reviewed',
        'Animated clips do not independently perform grabs, injuries or damage',
        'IK and combat AI continue to be driven by the shared simulation kernel',
        'Alpha and original assets unchanged',
    ],
}
(DIR/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({
    'path':str(DEST),
    'bytes':len(glb),
    'sha256':manifest['glb']['sha256'],
    'clips':len(doc['animations']),
    'new_clips':len(NEW),
    'previous':29,
}))
