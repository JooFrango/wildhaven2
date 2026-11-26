#!/usr/bin/env python3
"""Varrisco v03 — 12 new original animation clips and 5 revised clips.
Adds keyframe channels to the original v02 GLB; geometry, textures, weights,
rig and every original BIN byte are preserved. Python 3.10+, stdlib only.
Animations are EXPERIMENTAL, not artist-approved.
"""
import hashlib
import json
import math
import struct
from pathlib import Path

DIR = Path(__file__).resolve().parent.parent
BASE = DIR.parent / 'v02' / 'varrisco-animated-v02-LOD0.glb'
OUT = DIR / 'varrisco-animated-v03-LOD0.glb'
old = BASE.read_bytes()
assert old[:4] == b'glTF' and struct.unpack_from('<II', old, 4) == (2, len(old))
jlen, jtype = struct.unpack_from('<I4s', old, 12)
assert jtype == b'JSON'
gltf = json.loads(old[20:20+jlen])
bo = 20+jlen
blen, btype = struct.unpack_from('<I4s', old, bo)
assert btype == b'BIN\0'
original_bin = old[bo+8:bo+8+blen]
assert len(gltf['animations']) == 17
assert len(gltf['skins'][0]['joints']) == 22
nodes = {node['name']: index for index, node in enumerate(gltf['nodes'])}
joints = ('root pelvis thorax neck head jaw tailA tailB tailC tailD '
          'thighL shinL footL thighR shinR footR shoulderL forearmL handL '
          'shoulderR forearmR handR').split()
assert all(name in nodes for name in joints)
# name, duration, FPS, loop, replaces existing v02
specs = [
    ('walk', 1.13, 30, True, True),
    ('run', .60, 36, True, True),
    ('bite', .92, 36, False, True),
    ('claw_slash', 1.00, 36, False, True),
    ('pounce', 1.24, 36, False, True),
    ('sprint', .54, 36, True, False),
    ('backstep', 1.10, 30, True, False),
    ('strafe_left', 1.05, 30, True, False),
    ('strafe_right', 1.05, 30, True, False),
    ('dodge_left', .72, 36, False, False),
    ('dodge_right', .72, 36, False, False),
    ('jump_takeoff', .56, 36, False, False),
    ('jump_land', .70, 36, False, False),
    ('bite_heavy', 1.12, 36, False, False),
    ('claw_right', 1.00, 36, False, False),
    ('double_claw', 1.18, 36, False, False),
    ('feint', .95, 36, False, False),
]

def smooth(t):
    t = max(0., min(1., t))
    return t*t*(3-2*t)

def pulse(t, a, peak, b):
    return smooth((t-a)/(peak-a)) * (1-smooth((t-peak)/(b-peak)))

def make_pose(name, t):
    r, pos = {}, {}
    def rot(j, x=0., y=0., z=0.):
        q = r.setdefault(j, [0., 0., 0.])
        q[0] += x; q[1] += y; q[2] += z
    def move(j, x=0., y=0., z=0.):
        p = pos.setdefault(j, [0., 0., 0.])
        p[0] += x; p[1] += y; p[2] += z
    cycle = math.tau*t
    sine = math.sin(cycle)
    bounce = .5*(1-math.cos(2*cycle))
    def gait(hip, knee, tilt, backwards=False, sideways=0.):
        for foot, phase in (('L', 0.), ('R', math.pi)):
            a = math.sin(cycle+phase)
            lift = max(0., math.cos(cycle+phase))
            rot('thigh'+foot, 0, sideways*(1 if foot=='L' else -1), (-1 if backwards else 1)*hip*a)
            rot('shin'+foot, 0, 0, -knee*lift-.08)
            rot('foot'+foot, 0, 0, -.26*hip*a+.13*knee*lift)
            rot('shoulder'+foot, 0, 0, -.18*a)
            rot('forearm'+foot, 0, 0, .11*a)
        rot('thorax', 0, 0, tilt)
        rot('pelvis', 0, .035*sine)
        move('pelvis', 0, .026*bounce)
        rot('tailA', 0, .1*sine, .04*sine)
        rot('tailB', 0, -.08*sine, .025*sine)
        rot('head', 0, .035*sine)
    if name == 'walk':
        gait(.51, .37, -.035)
    elif name == 'run':
        gait(.88, .70, -.15)
        move('pelvis', 0, .012*bounce)
        rot('neck', 0, 0, -.07)
    elif name == 'sprint':
        gait(1.02, .84, -.22)
        move('pelvis', 0, .022*bounce)
        rot('neck', 0, 0, -.12)
        rot('tailC', 0, .12*sine, .06*sine)
    elif name == 'backstep':
        gait(.39, .33, .10, backwards=True)
        rot('head', 0, -.12, .05)
    elif name in ('strafe_left', 'strafe_right'):
        sign = 1 if name == 'strafe_left' else -1
        gait(.22, .38, -.06, sideways=.12*sign*sine)
        rot('pelvis', 0, 0, .05*sign)
        rot('thorax', .09*sign, 0, .02*sign)
        move('pelvis', 0, 0, .055*sign*sine)
        rot('tailA', 0, -.24*sign)
    elif name in ('dodge_left', 'dodge_right'):
        sign = 1 if name == 'dodge_left' else -1
        u = pulse(t, .06, .44, .96)
        rot('root', .14*sign*u, -.13*sign*u, -.16*u)
        rot('pelvis', -.12*sign*u, .1*sign*u, -.22*u)
        for foot in ('L', 'R'):
            rot('thigh'+foot, 0, 0, -.38*u)
            rot('shin'+foot, 0, 0, .43*u)
        move('pelvis', -.06*u, -.13*u, .13*sign*u)
        rot('tailA', 0, -.30*sign*u, .30*u)
    elif name == 'jump_takeoff':
        crouch = pulse(t, 0., .24, .57)
        jump = pulse(t, .28, .65, 1.)
        move('pelvis', 0, -.17*crouch+.16*jump)
        for foot in ('L', 'R'):
            rot('thigh'+foot, 0, 0, -.49*crouch+.27*jump)
            rot('shin'+foot, 0, 0, .54*crouch-.42*jump)
            rot('foot'+foot, 0, 0, -.14*jump)
        rot('thorax', 0, 0, .16*crouch-.23*jump)
        rot('neck', 0, 0, .10*crouch)
        rot('tailA', 0, 0, .23*jump)
    elif name == 'jump_land':
        u = pulse(t, .08, .32, .82)
        move('pelvis', 0, -.19*u)
        for foot in ('L', 'R'):
            rot('thigh'+foot, 0, 0, -.40*u)
            rot('shin'+foot, 0, 0, .51*u)
        rot('thorax', 0, 0, .29*u)
        rot('neck', 0, 0, -.15*u)
        rot('tailA', 0, 0, -.30*u)
    elif name in ('bite', 'bite_heavy'):
        heavy = name == 'bite_heavy'
        prep = pulse(t, .02, .29 if heavy else .26, .53 if heavy else .49)
        strike = pulse(t, .37 if heavy else .42, .69 if heavy else .74, .97 if heavy else .95)
        opening = pulse(t, .12, .56 if heavy else .55, .88 if heavy else .79)
        rot('thorax', 0, 0, .12*prep-.21*strike)
        rot('neck', 0, 0, .19*prep-.31*strike)
        rot('head', 0, 0, .10*prep-.17*strike)
        rot('jaw', 0, 0, -.38*opening)
        move('neck', .035*strike)
        move('head', (.17 if heavy else .11)*strike, -.015*strike)
        rot('tailA', 0, 0, .16*strike)
        for foot in ('L', 'R'):
            rot('thigh'+foot, 0, 0, -.08*strike)
    elif name in ('claw_slash', 'claw_right'):
        side = 'L' if name == 'claw_slash' else 'R'
        other = 'R' if side == 'L' else 'L'
        prep = pulse(t, .03, .25, .53)
        hit = pulse(t, .30, .63, .95)
        rot('thorax', 0, .19*hit if side=='L' else -.19*hit, -.14*hit)
        rot('shoulder'+side, 0, 0, .25*prep-.86*hit)
        rot('forearm'+side, 0, 0, -.10*prep-.66*hit)
        rot('hand'+side, 0, 0, -.19*hit)
        move('hand'+side, .085*hit)
        rot('shoulder'+other, 0, 0, .13*hit)
        rot('tailA', 0, -.2*hit if side=='L' else .2*hit)
    elif name == 'double_claw':
        left = pulse(t, .02, .37, .60)
        right = pulse(t, .39, .73, .98)
        rot('shoulderL', 0, 0, -.82*left)
        rot('forearmL', 0, 0, -.61*left)
        rot('shoulderR', 0, 0, -.86*right)
        rot('forearmR', 0, 0, -.64*right)
        rot('thorax', 0, .18*left-.18*right, -.13*(left+right))
        move('handL', .08*left)
        move('handR', .08*right)
        rot('tailA', 0, .17*(right-left))
    elif name == 'pounce':
        crouch = pulse(t, 0., .17, .40)
        airborne = pulse(t, .26, .61, .91)
        landing = pulse(t, .72, .91, 1.)
        move('pelvis', 0, -.21*crouch+.17*airborne-.11*landing)
        rot('thorax', 0, 0, .22*crouch-.32*airborne+.16*landing)
        for foot in ('L', 'R'):
            rot('thigh'+foot, 0, 0, -.37*crouch+.41*airborne-.3*landing)
            rot('shin'+foot, 0, 0, .41*crouch-.38*airborne+.37*landing)
            rot('shoulder'+foot, 0, 0, -.44*airborne)
        rot('neck', 0, 0, -.22*airborne)
        rot('head', 0, 0, -.15*airborne)
        rot('tailA', 0, 0, .22*airborne-.16*landing)
        # Horizontal root motion stays with the ecological physics controller.
    elif name == 'feint':
        pretend = pulse(t, .05, .34, .57)
        retreat = pulse(t, .43, .67, .93)
        rot('root', 0, .12*pretend)
        rot('thorax', 0, 0, -.20*pretend+.12*retreat)
        rot('neck', 0, -.12*pretend, .21*pretend)
        move('pelvis', 0, -.065*pretend)
        for foot in ('L', 'R'):
            rot('thigh'+foot, 0, 0, -.19*pretend+.10*retreat)
        rot('tailA', 0, -.18*pretend+.16*retreat)
    return r, pos

def quaternion(xyz):
    x,y,z = (v*.5 for v in xyz)
    sx,sy,sz = math.sin(x), math.sin(y), math.sin(z)
    cx,cy,cz = math.cos(x), math.cos(y), math.cos(z)
    return (sx*cy*cz+cx*sy*sz, cx*sy*cz-sx*cy*sz,
            cx*cy*sz+sx*sy*cz, cx*cy*cz-sx*sy*sz)

blob = bytearray(original_bin)
def floats(values, kind):
    assert kind in ('SCALAR','VEC3','VEC4')
    assert all(math.isfinite(v) for v in values)
    data = struct.pack('<'+'f'*len(values), *values)
    view = len(gltf['bufferViews'])
    gltf['bufferViews'].append({'buffer':0,'byteOffset':len(blob),'byteLength':len(data)})
    blob.extend(data)
    components = {'SCALAR':1,'VEC3':3,'VEC4':4}[kind]
    accessor = {'bufferView':view,'componentType':5126,
                'count':len(values)//components,'type':kind}
    if kind == 'SCALAR':
        accessor.update({'min':[min(values)],'max':[max(values)]})
    index = len(gltf['accessors'])
    gltf['accessors'].append(accessor)
    return index

for name, duration, fps, looping, refined in specs:
    frames = math.ceil(duration*fps)
    times = [round(duration*i/frames, 7) for i in range(frames+1)]
    t_access = floats(times,'SCALAR')
    samplers, channels = [], []
    for bone in joints:
        rotation_data, translation_data = [], []
        rotated = translated = False
        rest = gltf['nodes'][nodes[bone]].get('translation',[0.,0.,0.])
        for k in range(frames+1):
            rotations, positions = make_pose(name,k/frames)
            angles = rotations.get(bone,[0.,0.,0.])
            offset = positions.get(bone,[0.,0.,0.])
            rotated |= any(abs(x)>1e-5 for x in angles)
            translated |= any(abs(x)>1e-5 for x in offset)
            rotation_data.extend(quaternion(angles))
            translation_data.extend(rest[i]+offset[i] for i in range(3))
        if rotated:
            output = floats(rotation_data,'VEC4')
            samplers.append({'input':t_access,'output':output,'interpolation':'LINEAR'})
            channels.append({'sampler':len(samplers)-1,
                             'target':{'node':nodes[bone],'path':'rotation'}})
        if translated:
            output = floats(translation_data,'VEC3')
            samplers.append({'input':t_access,'output':output,'interpolation':'LINEAR'})
            channels.append({'sampler':len(samplers)-1,
                             'target':{'node':nodes[bone],'path':'translation'}})
    assert len(channels)>=5, name
    new = {'name':name,'samplers':samplers,'channels':channels,
           'extras':{'loop':looping,'durationSeconds':duration,'fps':fps,
                     'stage':'experimental_v03','rootMotion':'in_place',
                     'refinedFromV02':refined}}
    if refined:
        where = next(i for i,a in enumerate(gltf['animations']) if a['name']==name)
        gltf['animations'][where] = new
    else:
        gltf['animations'].append(new)

assert len(gltf['animations'])==29
assert len(set(a['name'] for a in gltf['animations']))==29
assert blob[:len(original_bin)]==original_bin
gltf['asset']['generator'] = 'Wildhaven Varrisco v03 animation prototype'
gltf['buffers'][0]['byteLength'] = len(blob)
j = json.dumps(gltf,ensure_ascii=False,separators=(',',':')).encode('utf-8')
j += b' '*(-len(j)%4)
blob += b'\0'*(-len(blob)%4)
result = (b'glTF' + struct.pack('<II',2,12+8+len(j)+8+len(blob))
          + struct.pack('<I4s',len(j),b'JSON') + j
          + struct.pack('<I4s',len(blob),b'BIN\0') + blob)
OUT.write_bytes(result)
sha = hashlib.sha256(result).hexdigest()
manifest = {
    'species':'varrisco','version':'v03-experimental',
    'stage':'glb_generated_artist_review_pending',
    'base_sha256':hashlib.sha256(old).hexdigest(),
    'glb':{'path':OUT.name,'bytes':len(result),'sha256':sha,
           'triangles':2754,'skin_count':1,'joints':22,'animations':29},
    'added':[n for n,d,f,l,ref in specs if not ref],
    'refined':[n for n,d,f,l,ref in specs if ref],
    'specs':[{'name':n,'durationSeconds':d,'fps':fps,'loop':loop,'refined':ref}
             for n,d,fps,loop,ref in specs],
    'checks':{'original_bin_preserved':True,'unique_animation_names':True},
    'limitations':['Keyframes experimentais','Sem aprovacao artistica',
                   'Nao integrado na Alpha','IK e IA continuam no laboratorio']
}
(DIR/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'file':str(OUT),'bytes':len(result),'sha256':sha,'animations':29},ensure_ascii=False))
