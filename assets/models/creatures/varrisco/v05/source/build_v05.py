#!/usr/bin/env python3
"""Varrisco v05 — moveset de monstro (linha MH) sobre o GLB v04.

Refaz 8 ataques e acrescenta roar, tail_sweep e limp (41 - 8 + 11 = 44 clipes).
Método: pose-a-pose. Cada clipe é uma tabela de poses-chave (antecipação, golpe,
overshoot, recuperação) com easing por trecho, cauda com atraso (follow-through)
e IK analítico de 2 ossos nas pernas, que mantém os pés plantados ou nos alvos
chaveados. Amostrado a 30 fps em LINEAR, só stdlib (roda no Python do Blender).

Geometria, skin, pesos e os 33 clipes mantidos ficam idênticos aos da v04. Os
accessors dos 8 clipes substituídos saem do BIN (compactação). Corrige também os
min/max escalares herdados da v02 (glTF exige arrays; o importador do Blender recusa).

Executar: "<Blender>/5.3/python/bin/python.exe" assets/models/creatures/varrisco/v05/source/build_v05.py
"""
from __future__ import annotations
import hashlib, json, math, struct
from pathlib import Path

DIR = Path(__file__).resolve().parent.parent
SRC = DIR.parent / 'v04' / 'varrisco-animated-v04-LOD0.glb'
DEST = DIR / 'varrisco-animated-v05-LOD0.glb'
FPS = 30

# ---------- leitura da v04 ----------
raw = SRC.read_bytes()
assert raw[:4] == b'glTF' and struct.unpack_from('<II', raw, 4) == (2, len(raw))
jlen, jtype = struct.unpack_from('<I4s', raw, 12); assert jtype == b'JSON'
doc = json.loads(raw[20:20 + jlen])
blen, btype = struct.unpack_from('<I4s', raw, 20 + jlen); assert btype == b'BIN\0'
BIN = raw[28 + jlen:28 + jlen + blen]
assert len(doc['animations']) == 41 and len(doc['skins'][0]['joints']) == 22
NODE = {n['name']: i for i, n in enumerate(doc['nodes'])}
REST = {n['name']: n.get('translation', [0., 0., 0.]) for n in doc['nodes']}
assert not any('rotation' in n for n in doc['nodes']), 'rig v04 tem rotação de repouso identidade'
PARENT = {}
for i, n in enumerate(doc['nodes']):
    for c in n.get('children', []):
        PARENT[doc['nodes'][c]['name']] = doc['nodes'][i]['name']
BONES = ('root pelvis thorax neck head jaw tailA tailB tailC tailD thighL shinL footL '
         'thighR shinR footR shoulderL forearmL handL shoulderR forearmR handR').split()
TAIL = ('tailA', 'tailB', 'tailC', 'tailD')

# ---------- quaternions (x, y, z, w) ----------
def qmul(a, b):
    ax, ay, az, aw = a; bx, by, bz, bw = b
    return (aw*bx + ax*bw + ay*bz - az*by, aw*by - ax*bz + ay*bw + az*bx,
            aw*bz + ax*by - ay*bx + az*bw, aw*bw - ax*bx - ay*by - az*bz)
def qaxis(axis, deg):
    h = math.radians(deg) * .5; s = math.sin(h)
    return (axis[0]*s, axis[1]*s, axis[2]*s, math.cos(h))
def qeuler(rx, ry, rz):
    """Graus. Guinada (Y, + vira o focinho para a direita), arfagem (Z, + ergue o focinho), rolagem (X)."""
    return qmul(qmul(qaxis((0, 1, 0), ry), qaxis((0, 0, 1), rz)), qaxis((1, 0, 0), rx))
def qrot(q, v):
    x, y, z, w = q
    t = (2*(y*v[2] - z*v[1]), 2*(z*v[0] - x*v[2]), 2*(x*v[1] - y*v[0]))
    return (v[0] + w*t[0] + y*t[2] - z*t[1], v[1] + w*t[1] + z*t[0] - x*t[2], v[2] + w*t[2] + x*t[1] - y*t[0])
def qinv(q): return (-q[0], -q[1], -q[2], q[3])

# ---------- easing ----------
EASE = {
    'lin': lambda u: u,
    'io': lambda u: u*u*u*(u*(6*u - 15) + 10),      # pose a pose, para e parte suave
    'in': lambda u: u*u*u,                           # acelera até o impacto
    'out': lambda u: 1 - (1 - u)**3,                 # desacelera (antecipação, recuperação)
}

def sample_keys(keys, t, chan):
    """keys: [(tempo, ease, pose)]; canal ausente numa pose = repouso (0)."""
    if t <= keys[0][0]: return keys[0][2].get(chan)
    for (t0, _, p0), (t1, e, p1) in zip(keys, keys[1:]):
        if t <= t1:
            u = EASE[e]((t - t0) / max(1e-9, t1 - t0))
            a, b = p0.get(chan), p1.get(chan)
            if a is None and b is None: return None
            if isinstance(a if a is not None else b, (int, float)):
                a = a or 0.; b = b or 0.
                return a + (b - a) * u
            a = a or (0., 0., 0.); b = b or (0., 0., 0.)
            return [a[i] + (b[i] - a[i]) * u for i in range(3)]
    return keys[-1][2].get(chan)

# ---------- IK analítico de 2 ossos no plano sagital do quadril ----------
def solve_leg(side, pelvis_world_q, pelvis_world_p, target):
    """Retorna (guinada coxa, arfagem coxa, canela, pé) em graus para levar o tornozelo ao alvo (espaço root).
    A coxa desfaz a guinada da pelve para a perna resolver no plano sagital do root."""
    thigh, shin, foot = 'thigh' + side, 'shin' + side, 'foot' + side
    hip = [pelvis_world_p[i] + qrot(pelvis_world_q, REST[thigh])[i] for i in range(3)]
    px = qrot(pelvis_world_q, (1, 0, 0)); yaw = math.degrees(math.atan2(-px[2], px[0]))
    frame = qmul(pelvis_world_q, qaxis((0, 1, 0), -yaw))
    t = qrot(qinv(frame), [target[i] - hip[i] for i in range(3)])
    k, a = REST[shin], REST[foot]
    L1, L2 = math.hypot(k[0], k[1]), math.hypot(a[0], a[1])
    d = max(abs(L1 - L2) + 1e-3, min(L1 + L2 - 1e-3, math.hypot(t[0], t[1])))
    c = (d*d - L1*L1 - L2*L2) / (2*L1*L2)
    phi0 = math.atan2(a[1], a[0]) - math.atan2(k[1], k[0])
    phi0 = math.atan2(math.sin(phi0), math.cos(phi0))
    phi = math.copysign(math.acos(max(-1., min(1., c))), phi0)  # joelho mantém o lado (para frente)
    th2 = phi + math.atan2(k[1], k[0]) - math.atan2(a[1], a[0])
    v = (k[0] + math.cos(th2)*a[0] - math.sin(th2)*a[1], k[1] + math.sin(th2)*a[0] + math.cos(th2)*a[1])
    th1 = math.atan2(t[1], t[0]) - math.atan2(v[1], v[0])
    fx = qrot(frame, (1, 0, 0)); pitch = math.atan2(fx[1], math.hypot(fx[0], fx[2]))
    th3 = -(pitch + th1 + th2)  # sola paralela ao chão
    norm = lambda r: math.degrees(math.atan2(math.sin(r), math.cos(r)))
    return -yaw, norm(th1), norm(th2), norm(th3)

ANKLE = {}
for s in 'LR':
    p = [0., 0., 0.]
    for b in ('pelvis', 'thigh' + s, 'shin' + s, 'foot' + s): p = [p[i] + REST[b][i] for i in range(3)]
    ANKLE[s] = p

def evaluate(spec, t):
    """Pose completa (rotações locais em graus XYZ e translações) no instante t."""
    keys = spec['keys']
    rot = {b: [0., 0., 0.] for b in BONES}
    trn = {b: [0., 0., 0.] for b in BONES}
    for b in BONES:
        v = sample_keys(keys, t, b)
        if v: rot[b] = list(v)
        v = sample_keys(keys, t, 'T:' + b)
        if v: trn[b] = list(v)
    # Cauda: um valor [x, y, z] distribuído pela cadeia com atraso (follow-through).
    for i, b in enumerate(TAIL):
        v = sample_keys(keys, max(0., t - .045*i), 'tail')
        if v:
            w = (.34, .28, .22, .18)[i] * 2.2
            rot[b] = [rot[b][j] + v[j]*w for j in range(3)]
    # Tremor (rugido, tensão): aditivo na cabeça, pescoço e mandíbula.
    tr = sample_keys(keys, t, 'tremor') or 0.
    if tr:
        rot['head'][1] += tr*math.sin(t*2*math.pi*11); rot['head'][2] += .6*tr*math.sin(t*2*math.pi*13 + 1)
        rot['jaw'][2] += .8*tr*math.sin(t*2*math.pi*17); rot['neck'][1] += .5*tr*math.sin(t*2*math.pi*7 + 2)
    # Pernas por IK, com o pé no alvo chaveado (offset do repouso em espaço root).
    q_pelvis = qeuler(*rot['pelvis'])
    p_pelvis = [REST['pelvis'][i] + trn['pelvis'][i] for i in range(3)]
    for s in 'LR':
        off = sample_keys(keys, t, 'F:' + s) or [0., 0., 0.]
        target = [ANKLE[s][i] + off[i] for i in range(3)]
        y1, a1, a2, a3 = solve_leg(s, q_pelvis, p_pelvis, target)
        rot['thigh' + s][1] += y1; rot['thigh' + s][2] += a1;rot['shin' + s][2] += a2; rot['foot' + s][2] += a3
        rot['foot' + s][2] += sample_keys(keys, t, 'P:' + s) or 0.  # flexão do pé chaveada
    return rot, trn

# ---------- moveset ----------
# Convenções (glTF, rig sem rotação de repouso): +X frente, +Y cima, +Z lado esquerdo.
# Graus [x rolagem, y guinada (+ direita), z arfagem (+ focinho/membro para cima/frente)].
# Cauda: z negativo ergue a cauda; jaw z negativo abre a boca. 'T:osso' em metros.
def P(**kw):
    out = {}
    for k, v in kw.items():
        k = k.replace('T_', 'T:').replace('F_', 'F:').replace('P_', 'P:')
        out[k] = v
    return out

def mirror(keys):
    """Espelha L<->R: troca nomes e inverte rolagem/guinada e o eixo Z das translações."""
    out = []
    for t, e, p in keys:
        q = {}
        for k, v in p.items():
            nk = k.replace('L', '#').replace('R', 'L').replace('#', 'R') if k[-1] in 'LR' else k
            if isinstance(v, (int, float)): q[nk] = v
            elif k.startswith(('T:', 'F:')): q[nk] = [v[0], v[1], -v[2]]
            else: q[nk] = [-v[0], -v[1], v[2]]
        out.append((t, e, q))
    return out

CLAW_RIGHT = [
    (0.00, 'io', P()),
    (0.30, 'out', P(shoulderR=[-20, 0, 95], forearmR=[0, 0, 40], handR=[0, 0, 25], thorax=[0, 18, 8], neck=[0, -10, 0],
                    head=[0, -6, 0], pelvis=[0, 6, 0], T_pelvis=[-.05, -.04, 0], tail=[0, -6, -4], jaw=[0, 0, -10])),
    (0.42, 'in', P(shoulderR=[35, 0, -25], forearmR=[0, 0, -20], handR=[0, 0, -25], thorax=[0, -22, -8], neck=[0, 10, -4],
                   head=[0, 6, -4], pelvis=[0, -8, 0], T_pelvis=[.10, -.07, 0], tail=[0, 12, -6], jaw=[0, 0, -18])),
    (0.52, 'out', P(shoulderR=[45, 0, -35], forearmR=[0, 0, -25], handR=[0, 0, -30], thorax=[0, -26, -10], neck=[0, 12, -4],
                    head=[0, 6, -4], pelvis=[0, -10, 0], T_pelvis=[.12, -.08, 0], tail=[0, 14, -4])),
    (0.75, 'io', P(shoulderR=[10, 0, -10], forearmR=[0, 0, -8], thorax=[0, -8, -3], pelvis=[0, -3, 0], T_pelvis=[.04, -.03, 0], tail=[0, 4, 0])),
    (1.00, 'io', P()),
]

SPECS = {
 'bite': dict(dur=1.00, loop=False, cat='combat', contact=.40, janelas=dict(aviso=[0, .28], ativo=[.36, .44], punicao=[.52, 1.0]), keys=[
    (0.00, 'io', P()),
    (0.28, 'out', P(neck=[0, 0, 22], head=[0, 0, 12], jaw=[0, 0, -8], thorax=[0, 0, 8], T_pelvis=[-.06, -.05, 0], tail=[0, 0, -8])),
    (0.36, 'in', P(neck=[0, 0, -10], head=[0, 0, -6], jaw=[0, 0, -40], thorax=[0, 0, -6], T_pelvis=[.10, -.07, 0], tail=[0, 0, -10])),
    (0.40, 'lin', P(neck=[0, 0, -26], head=[0, 0, -12], jaw=[0, 0, 2], thorax=[0, 0, -10], T_pelvis=[.16, -.08, 0], tail=[0, 0, -12])),
    (0.52, 'out', P(neck=[0, 6, -24], head=[0, 14, -10], thorax=[0, 0, -10], T_pelvis=[.15, -.08, 0], tail=[0, -6, -10])),
    (0.62, 'io', P(neck=[0, -5, -20], head=[0, -10, -8], thorax=[0, 0, -8], T_pelvis=[.13, -.07, 0], tail=[0, 6, -8])),
    (0.78, 'io', P(neck=[0, 0, -8], head=[0, 0, -4], T_pelvis=[.05, -.04, 0], tail=[0, 0, -3])),
    (1.00, 'io', P()),
 ]),
 'bite_heavy': dict(dur=1.60, loop=False, cat='combat', contact=.5625, janelas=dict(aviso=[0, .72], ativo=[.84, .96], punicao=[1.0, 1.6]), keys=[
    (0.00, 'io', P()),
    (0.55, 'out', P(neck=[0, 0, 28], head=[0, 0, 8], jaw=[0, 0, -22], thorax=[0, 0, 16], pelvis=[0, 0, 6], T_pelvis=[-.14, -.10, 0], tail=[0, 0, -16], tremor=2)),
    (0.72, 'io', P(neck=[0, 0, 31], head=[0, 0, 10], jaw=[0, 0, -30], thorax=[0, 0, 18], pelvis=[0, 0, 7], T_pelvis=[-.16, -.12, 0], tail=[0, 0, -18], tremor=4)),
    (0.84, 'in', P(neck=[0, 0, -20], head=[0, 0, -8], jaw=[0, 0, -48], thorax=[0, 0, -12], pelvis=[0, 0, -6], T_pelvis=[.22, -.10, 0], tail=[0, 0, -18])),
    (0.90, 'lin', P(neck=[0, 0, -36], head=[0, 0, -16], jaw=[0, 0, 2], thorax=[0, 0, -16], pelvis=[0, 0, -8], T_pelvis=[.30, -.12, 0], tail=[0, 0, -20])),
    (1.02, 'out', P(neck=[0, 8, -34], head=[0, 18, -14], thorax=[0, 4, -16], pelvis=[0, 0, -8], T_pelvis=[.29, -.12, 0], tail=[0, -10, -14])),
    (1.14, 'io', P(neck=[0, -8, -32], head=[0, -18, -12], thorax=[0, -4, -15], pelvis=[0, 0, -7], T_pelvis=[.27, -.12, 0], tail=[0, 10, -12])),
    (1.26, 'io', P(neck=[0, 0, -12], head=[0, 0, 6], jaw=[0, 0, -6], thorax=[0, 0, -10], pelvis=[0, 0, -4], T_pelvis=[.14, -.09, 0], tail=[0, 0, -6])),
    (1.42, 'io', P(neck=[0, 0, -8], head=[0, 0, 2], thorax=[0, 0, -4], T_pelvis=[.06, -.05, 0])),
    (1.60, 'io', P()),
 ]),
 'claw_right': dict(dur=1.00, loop=False, cat='combat', contact=.42, janelas=dict(aviso=[0, .30], ativo=[.36, .48], punicao=[.55, 1.0]), keys=CLAW_RIGHT),
 'claw_slash': dict(dur=1.00, loop=False, cat='combat', contact=.42, janelas=dict(aviso=[0, .30], ativo=[.36, .48], punicao=[.55, 1.0]), keys=mirror(CLAW_RIGHT)),
 'double_claw': dict(dur=1.20, loop=False, cat='combat', contact=.4167, janelas=dict(aviso=[0, .38], ativo=[.44, .56], punicao=[.62, 1.2]), keys=[
    (0.00, 'io', P()),
    (0.38, 'out', P(shoulderL=[10, 0, 110], shoulderR=[-10, 0, 110], forearmL=[0, 0, 45], forearmR=[0, 0, 45], handL=[0, 0, 20], handR=[0, 0, 20],
                    thorax=[0, 0, 18], neck=[0, 0, 8], head=[0, 0, 6], jaw=[0, 0, -16], pelvis=[0, 0, 6], T_pelvis=[-.08, -.02, 0], tail=[0, 0, 4])),
    (0.50, 'in', P(shoulderL=[30, 0, -30], shoulderR=[-30, 0, -30], forearmL=[0, 0, -25], forearmR=[0, 0, -25], handL=[0, 0, -20], handR=[0, 0, -20],
                   thorax=[0, 0, -18], neck=[0, 0, -14], head=[0, 0, -6], jaw=[0, 0, -26], pelvis=[0, 0, -6], T_pelvis=[.16, -.10, 0], tail=[0, 0, -14])),
    (0.62, 'out', P(shoulderL=[34, 0, -36], shoulderR=[-34, 0, -36], forearmL=[0, 0, -28], forearmR=[0, 0, -28], handL=[0, 0, -24], handR=[0, 0, -24],
                    thorax=[0, 0, -20], neck=[0, 0, -12], head=[0, 0, -4], pelvis=[0, 0, -7], T_pelvis=[.18, -.12, 0], tail=[0, 0, -12])),
    (0.88, 'io', P(shoulderL=[12, 0, -12], shoulderR=[-12, 0, -12], thorax=[0, 0, -8], neck=[0, 0, -4], pelvis=[0, 0, -3], T_pelvis=[.08, -.06, 0], tail=[0, 0, -4])),
    (1.20, 'io', P()),
 ]),
 'pounce': dict(dur=1.30, loop=False, cat='combat', contact=.5538, janelas=dict(aviso=[0, .40], ativo=[.62, .78], punicao=[.80, 1.3]), keys=[
    (0.00, 'io', P()),
    (0.40, 'out', P(T_pelvis=[-.12, -.22, 0], pelvis=[0, 0, -4], thorax=[0, 0, -8], neck=[0, 0, 12], head=[0, 0, 8], jaw=[0, 0, -10],
                    shoulderL=[0, 0, 30], shoulderR=[0, 0, 30], tail=[0, 0, -8], tremor=1.5)),
    (0.52, 'in', P(T_pelvis=[.10, .10, 0], pelvis=[0, 0, 10], thorax=[0, 0, 4], neck=[0, 0, 4], head=[0, 0, 2], jaw=[0, 0, -20],
                   shoulderL=[0, 0, 60], shoulderR=[0, 0, 60], tail=[0, 0, 4], F_L=[-.12, .13, 0], F_R=[-.16, .14, 0], P_L=-22, P_R=-25)),
    (0.62, 'out', P(T_pelvis=[.16, .32, 0], pelvis=[0, 0, 4], thorax=[0, 0, -4], neck=[0, 0, -8], head=[0, 0, -4], jaw=[0, 0, -36],
                    shoulderL=[0, 0, 85], shoulderR=[0, 0, 85], forearmL=[0, 0, 30], forearmR=[0, 0, 30], tail=[0, 0, -2],
                    F_L=[.12, .34, 0], F_R=[.08, .30, 0], P_L=-25, P_R=-25)),
    (0.72, 'in', P(T_pelvis=[.22, .06, 0], pelvis=[0, 0, -6], thorax=[0, 0, -14], neck=[0, 0, -24], head=[0, 0, -10], jaw=[0, 0, 2],
                   shoulderL=[20, 0, 20], shoulderR=[-20, 0, 20], forearmL=[0, 0, -10], forearmR=[0, 0, -10], tail=[0, 0, -10],
                   F_L=[.18, .04, 0], F_R=[.16, .06, 0], P_L=-10, P_R=-10)),
    (0.80, 'out', P(T_pelvis=[.20, -.18, 0], pelvis=[0, 0, -8], thorax=[0, 0, -16], neck=[0, 0, -18], head=[0, 0, -8],
                    shoulderL=[20, 0, 0], shoulderR=[-20, 0, 0], tail=[0, 0, -16], F_L=[.18, 0, 0], F_R=[.16, 0, 0])),
    (0.95, 'io', P(T_pelvis=[.14, -.12, 0], thorax=[0, 0, -8], neck=[0, 0, -8], tail=[0, 0, -8], F_L=[.10, .07, 0], F_R=[.16, 0, 0])),
    (1.05, 'io', P(T_pelvis=[.08, -.08, 0], thorax=[0, 0, -4], neck=[0, 0, -4], tail=[0, 0, -4], F_L=[0, 0, 0], F_R=[.16, 0, 0])),
    (1.16, 'io', P(T_pelvis=[.03, -.04, 0], F_L=[0, 0, 0], F_R=[.06, .07, 0])),
    (1.30, 'io', P()),
 ]),
 'jump_land': dict(dur=0.70, loop=False, cat='combat', contact=None, janelas=dict(punicao=[.12, .70]), keys=[
    (0.00, 'io', P(T_pelvis=[0, .26, 0], pelvis=[0, 0, 4], neck=[0, 0, -6], tail=[0, 0, -4], F_L=[.08, .26, 0], F_R=[.04, .24, 0], P_L=-20, P_R=-20)),
    (0.12, 'in', P(T_pelvis=[0, .02, 0], pelvis=[0, 0, -2], thorax=[0, 0, -6], neck=[0, 0, -8], tail=[0, 0, -6], F_L=[.04, 0, 0], F_R=[.02, 0, 0])),
    (0.24, 'out', P(T_pelvis=[0, -.22, 0], pelvis=[0, 0, -8], thorax=[0, 0, -14], neck=[0, 0, -4], head=[0, 0, 6], tail=[0, 0, -18], F_L=[.04, 0, 0], F_R=[.02, 0, 0])),
    (0.42, 'io', P(T_pelvis=[0, -.10, 0], pelvis=[0, 0, -3], thorax=[0, 0, -5], tail=[0, 0, -6], F_L=[.02, 0, 0], F_R=[.01, 0, 0])),
    (0.70, 'io', P()),
 ]),
 'body_slam': dict(dur=1.46, loop=False, cat='combat', contact=.5479, janelas=dict(aviso=[0, .45], ativo=[.70, .86], punicao=[.90, 1.46]), keys=[
    (0.00, 'io', P()),
    (0.45, 'out', P(T_pelvis=[-.12, -.10, 0], pelvis=[0, -20, -2], thorax=[0, -15, -4], neck=[0, 18, -2], head=[0, 10, -4], jaw=[0, 0, -12],
                    shoulderL=[0, 0, 20], shoulderR=[0, 0, 20], tail=[0, 18, -6])),
    (0.58, 'in', P(T_pelvis=[.02, -.06, 0], pelvis=[0, -6, -2], thorax=[0, -4, -6], neck=[0, 8, -6], head=[0, 4, -6],
                   tail=[0, 10, -4], F_R=[.12, .12, 0], P_R=-15)),
    (0.70, 'in', P(T_pelvis=[.20, -.04, 0], pelvis=[3, 26, -4], thorax=[12, 18, -10], neck=[0, -14, -10], head=[0, -8, -6], jaw=[0, 0, -18],
                   shoulderL=[0, 0, -10], shoulderR=[-20, 0, 10], tail=[0, -16, -8], F_R=[.26, 0, 0])),
    (0.80, 'out', P(T_pelvis=[.30, -.08, 0], pelvis=[4, 30, -6], thorax=[18, 22, -12], neck=[0, -18, -12], head=[0, -10, -8],
                    shoulderL=[0, 0, -14], shoulderR=[-24, 0, 6], tail=[0, -22, -10], F_R=[.26, 0, 0])),
    (0.96, 'io', P(T_pelvis=[.20, -.10, 0], pelvis=[1, 14, -4], thorax=[6, 10, -8], neck=[0, 6, -8], head=[0, 12, -4],
                   tail=[0, 8, -8], F_R=[.26, 0, 0])),
    (1.10, 'io', P(T_pelvis=[.14, -.08, 0], pelvis=[0, 6, -2], thorax=[0, 4, -4], head=[0, -6, -2], tail=[0, -4, -4], F_R=[.26, 0, 0])),
    (1.28, 'io', P(T_pelvis=[.05, -.04, 0], F_R=[.10, .08, 0])),
    (1.46, 'io', P()),
 ]),
 'roar': dict(dur=2.00, loop=False, cat='combat', contact=.30, janelas=dict(aviso=[0, .5], ativo=[.6, 1.6], punicao=[1.6, 2.0]), keys=[
    (0.00, 'io', P()),
    (0.45, 'out', P(neck=[0, 0, -16], head=[0, 0, -10], jaw=[0, 0, -4], thorax=[0, 0, -8], T_pelvis=[-.05, -.07, 0], tail=[0, 0, 6],
                    shoulderL=[0, 0, -10], shoulderR=[0, 0, -10])),
    (0.62, 'in', P(neck=[0, 0, 24], head=[0, 0, 16], jaw=[0, 0, -52], thorax=[0, 0, 18], pelvis=[0, 0, 8], T_pelvis=[-.08, .02, 0], tail=[0, 0, -18],
                   shoulderL=[-25, 0, 30], shoulderR=[25, 0, 30], forearmL=[0, 0, 25], forearmR=[0, 0, 25], handL=[0, 0, 30], handR=[0, 0, 30], tremor=5)),
    (1.10, 'lin', P(neck=[0, -6, 26], head=[0, -8, 18], jaw=[0, 0, -55], thorax=[0, -4, 20], pelvis=[0, 0, 9], T_pelvis=[-.08, .02, 0], tail=[0, 4, -20],
                    shoulderL=[-28, 0, 32], shoulderR=[28, 0, 32], forearmL=[0, 0, 28], forearmR=[0, 0, 28], handL=[0, 0, 32], handR=[0, 0, 32], tremor=6)),
    (1.55, 'lin', P(neck=[0, 6, 23], head=[0, 8, 15], jaw=[0, 0, -50], thorax=[0, 4, 18], pelvis=[0, 0, 8], T_pelvis=[-.07, .01, 0], tail=[0, -4, -18],
                    shoulderL=[-25, 0, 30], shoulderR=[25, 0, 30], forearmL=[0, 0, 25], forearmR=[0, 0, 25], handL=[0, 0, 28], handR=[0, 0, 28], tremor=5)),
    (1.75, 'out', P(neck=[0, 0, 4], head=[0, 0, 2], jaw=[0, 0, -10], thorax=[0, 0, 2], T_pelvis=[-.02, -.02, 0], tail=[0, 0, -4])),
    (2.00, 'io', P()),
 ]),
 'tail_sweep': dict(dur=1.40, loop=False, cat='combat', contact=.4286, janelas=dict(aviso=[0, .35], ativo=[.50, .82], punicao=[.92, 1.4]), keys=[
    (0.00, 'io', P()),
    (0.35, 'out', P(root=[0, -35, 0], T_pelvis=[-.04, -.12, 0], pelvis=[0, -10, -4], thorax=[0, -8, -6], neck=[0, 20, -4], head=[0, 14, -6],
                    jaw=[0, 0, -12], tail=[0, -14, -6], tremor=1)),
    (0.45, 'in', P(root=[0, -20, 0], T_root=[0, .06, 0], T_pelvis=[0, -.06, 0], pelvis=[0, 8, -2], thorax=[0, 4, -4], neck=[0, 4, -4],
                   head=[0, 2, -4], tail=[0, 10, -8], F_L=[0, .06, 0], F_R=[0, .06, 0])),
    (0.62, 'lin', P(root=[0, 150, 0], T_root=[0, .12, 0], T_pelvis=[0, -.04, 0], pelvis=[0, 6, 0], thorax=[0, 4, -2], neck=[0, -10, -4],
                    tail=[0, 16, -4], F_L=[0, .14, 0], F_R=[0, .12, 0], P_L=-15, P_R=-15)),
    (0.80, 'lin', P(root=[0, 320, 0], T_root=[0, .04, 0], T_pelvis=[0, -.06, 0], pelvis=[0, 4, -2], thorax=[0, 2, -4], neck=[0, -14, -4],
                    tail=[0, 12, -4], F_L=[0, .04, 0], F_R=[0, .04, 0])),
    (0.92, 'out', P(root=[0, 372, 0], T_pelvis=[0, -.12, 0], pelvis=[0, -6, -4], thorax=[0, -4, -6], neck=[0, 4, -8], head=[0, 6, -6], tail=[0, -16, -10])),
    (1.10, 'io', P(root=[0, 356, 0], T_pelvis=[0, -.08, 0], pelvis=[0, 2, -3], neck=[0, -4, -6], tail=[0, 8, -6])),
    (1.40, 'io', P(root=[0, 360, 0])),
 ]),
 'limp': dict(dur=1.10, loop=True, cat='locomotion', contact=None, janelas={}, velocidade=1.0, keys=[]),
}

def limp_keys():
    """Ciclo de andar mancando (perna esquerda ferida): apoio curto, arrasto baixo, cabeça sobe quando a ferida carrega."""
    T, v = SPECS['limp']['dur'], SPECS['limp']['velocidade']
    def foot(t, st0, st1, lift):
        """Fase de apoio [st0, st1) recua com a velocidade; balanço avança com arco."""
        u = (t / T - st0) % 1.0; ls = (st1 - st0) % 1.0 or 1.0
        span = v * T * ls
        if u < ls: x = span/2 - span*(u/ls); y = 0.
        else:
            w = (u - ls) / (1 - ls); s = w*w*(3 - 2*w)
            x = -span/2 + span*s; y = lift*math.sin(math.pi*w)
        return [x, y, 0.]
    keys = []
    n = 22
    for i in range(n + 1):
        t = T*i/n; ph = i/n
        dip = math.exp(-((ph - .18)/.12)**2)               # perna ferida carrega: corpo afunda
        push = math.exp(-((ph - .62)/.15)**2)              # perna boa empurra
        keys.append((t, 'lin', P(F_L=foot(t, 0., .38, .045), F_R=foot(t, .40, 1.0, .12),
            P_L=-6*math.sin(math.pi*min(1, max(0, (ph - .38)/.62))), P_R=-18*math.sin(math.pi*min(1, max(0, ph/.40))),
            T_pelvis=[.02, -.075*dip + .02*push - .02, 0], pelvis=[-7*dip + 3*push, 4*math.sin(2*math.pi*ph), -3*dip],
            thorax=[3*dip, -3*math.sin(2*math.pi*ph), 4*dip - 2], neck=[0, 0, 10*dip - 4], head=[0, 0, 6*dip - 3],
            jaw=[0, 0, -4 - 4*dip], tail=[0, -8*math.sin(2*math.pi*(ph - .1)), 3 + 4*dip],
            shoulderL=[0, 0, 8*math.sin(2*math.pi*ph)], shoulderR=[0, 0, -8*math.sin(2*math.pi*ph)])))
    return keys
SPECS['limp']['keys'] = limp_keys()

REPLACED = ('bite', 'bite_heavy', 'claw_slash', 'claw_right', 'double_claw', 'pounce', 'jump_land', 'body_slam')
ADDED = ('roar', 'tail_sweep', 'limp')
assert set(SPECS) == set(REPLACED) | set(ADDED)

# Montagem só ao executar o script: build_v06.py importa o motor de poses acima sem reescrever a v05.
def main():
    # ---------- montagem ----------
    binout = bytearray(BIN)
    def add_accessor(values, typ):
        data = struct.pack('<' + 'f'*len(values), *values)
        assert all(math.isfinite(x) for x in values)
        doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binout), 'byteLength': len(data)})
        binout.extend(data)
        w = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}[typ]
        acc = {'bufferView': len(doc['bufferViews']) - 1, 'componentType': 5126, 'count': len(values)//w, 'type': typ}
        if typ == 'SCALAR': acc.update(min=[min(values)], max=[max(values)])
        doc['accessors'].append(acc)
        return len(doc['accessors']) - 1

    def build_clip(name, spec):
        dur = spec['dur']; frames = round(dur*FPS)
        times = [dur*i/frames for i in range(frames + 1)]
        poses = [evaluate(spec, t) for t in times]
        tacc = add_accessor(times, 'SCALAR')
        samplers, channels = [], []
        for b in BONES:
            quats, prev = [], None
            for rot, _ in poses:
                q = qeuler(*rot[b])
                if prev and sum(q[i]*prev[i] for i in range(4)) < 0: q = tuple(-c for c in q)  # continuidade de sinal
                quats.extend(q); prev = q
            moves_r = any(abs(x) > 1e-3 for rot, _ in poses for x in rot[b])
            moves_t = any(abs(x) > 1e-4 for _, trn in poses for x in trn[b])
            if moves_r:
                samplers.append({'input': tacc, 'output': add_accessor(quats, 'VEC4'), 'interpolation': 'LINEAR'})
                channels.append({'sampler': len(samplers) - 1, 'target': {'node': NODE[b], 'path': 'rotation'}})
            if moves_t:
                vals = [REST[b][i] + trn[b][i] for _, trn in poses for i in range(3)]
                samplers.append({'input': tacc, 'output': add_accessor(vals, 'VEC3'), 'interpolation': 'LINEAR'})
                channels.append({'sampler': len(samplers) - 1, 'target': {'node': NODE[b], 'path': 'translation'}})
        assert len(channels) >= 8, (name, len(channels))
        return {'name': name, 'samplers': samplers, 'channels': channels, 'extras': {
            'loop': spec['loop'], 'durationSeconds': dur, 'fps': FPS, 'stage': 'experimental_v05_mh',
            'category': spec['cat'], 'rootMotion': 'in_place', 'contactFraction': spec['contact'],
            'janelasSeg': spec['janelas'], 'physicalAuthority': 'ecology_kernel', 'method': 'pose_to_pose_keys_eased_analytic_leg_ik'}}

    # ---------- correção de pesos herdada da v02 ----------
    # Placas da cauda (x < -0.7) e crista dorsal sobre a pelve estavam 100% no thorax: ficavam paradas
    # ou se soltavam do corpo quando cauda/peito se moviam. Placas copiam os pesos do vértice de cauda
    # mais próximo em x; a crista passa a misturar pelve->thorax pela posição ao longo do dorso.
    CT = {5126: ('f', 4), 5121: ('B', 1), 5123: ('H', 2)}
    def read_acc(i):
        a = doc['accessors'][i]; v = doc['bufferViews'][a['bufferView']]
        fmt, size = CT[a['componentType']]; w = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}[a['type']]
        stride = v.get('byteStride', size*w); base = v.get('byteOffset', 0) + a.get('byteOffset', 0)
        return [list(struct.unpack_from('<' + fmt*w, BIN, base + k*stride)) for k in range(a['count'])]
    prim = doc['meshes'][0]['primitives'][0]; attrs = prim['attributes']
    POS, JNT, WGT = read_acc(attrs['POSITION']), read_acc(attrs['JOINTS_0']), read_acc(attrs['WEIGHTS_0'])
    JIDX = {doc['nodes'][n]['name']: j for j, n in enumerate(doc['skins'][0]['joints'])}
    thorax_only = lambda k: any(JNT[k][c] == JIDX['thorax'] and WGT[k][c] > .99 for c in range(4))
    tailish = [k for k in range(len(POS)) if any(JNT[k][c] in {JIDX[b] for b in TAIL} and WGT[k][c] > .3 for c in range(4))]
    fixed_tail = fixed_crest = 0
    for k in range(len(POS)):
        if not thorax_only(k): continue
        x = POS[k][0]
        if x < -0.7:
            src = min(tailish, key=lambda s: abs(POS[s][0] - x) + .2*abs(POS[s][2] - POS[k][2]))
            JNT[k], WGT[k] = list(JNT[src]), list(WGT[src]); fixed_tail += 1
        elif x < 0.14 and POS[k][1] > 1.15:
            wp = max(0., min(1., (0.14 - x) / 0.48))
            JNT[k], WGT[k] = [JIDX['pelvis'], JIDX['thorax'], 0, 0], [wp, 1 - wp, 0., 0.]; fixed_crest += 1
    assert fixed_tail > 200 and fixed_crest > 100, (fixed_tail, fixed_crest)
    jct = doc['accessors'][attrs['JOINTS_0']]['componentType']
    jdata = struct.pack('<' + CT[jct][0]*4*len(JNT), *[c for j in JNT for c in j])
    def add_raw_accessor(data, ctype, count, typ):
        binout.extend(b'\0' * (-len(binout) % 4))
        doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binout), 'byteLength': len(data), 'target': 34962})
        binout.extend(data)
        doc['accessors'].append({'bufferView': len(doc['bufferViews']) - 1, 'componentType': ctype, 'count': count, 'type': typ})
        return len(doc['accessors']) - 1
    attrs['JOINTS_0'] = add_raw_accessor(jdata, jct, len(JNT), 'VEC4')
    wsum = [sum(w) for w in WGT]; assert all(abs(s - 1) < 1e-3 for s in wsum)
    attrs['WEIGHTS_0'] = add_raw_accessor(struct.pack('<' + 'f'*4*len(WGT), *[c for w in WGT for c in w]), 5126, len(WGT), 'VEC4')

    kept = [a for a in doc['animations'] if a['name'] not in REPLACED]
    assert len(kept) == 33
    by_name = {a['name']: a for a in doc['animations']}
    new_clips = {n: build_clip(n, SPECS[n]) for n in REPLACED + ADDED}
    doc['animations'] = [new_clips[a['name']] if a['name'] in REPLACED else a for a in by_name.values()] + [new_clips[n] for n in ADDED]
    assert len(doc['animations']) == 44 and len({a['name'] for a in doc['animations']}) == 44

    # Corrige min/max escalares herdados (glTF exige arrays).
    for acc in doc['accessors']:
        for k in ('min', 'max'):
            if k in acc and not isinstance(acc[k], list): acc[k] = [acc[k]]

    # ---------- compactação: só accessors/bufferViews referenciados ----------
    used_acc = set()
    for m in doc['meshes']:
        for pr in m['primitives']:
            used_acc.update(pr['attributes'].values())
            if 'indices' in pr: used_acc.add(pr['indices'])
            for tg in pr.get('targets', []): used_acc.update(tg.values())
    for s in doc['skins']:
        if 'inverseBindMatrices' in s: used_acc.add(s['inverseBindMatrices'])
    for a in doc['animations']:
        for s in a['samplers']: used_acc.update((s['input'], s['output']))
    used_views = {doc['accessors'][i]['bufferView'] for i in used_acc} | {im['bufferView'] for im in doc.get('images', []) if 'bufferView' in im}
    acc_map = {old: new for new, old in enumerate(sorted(used_acc))}
    view_map = {old: new for new, old in enumerate(sorted(used_views))}
    newbin, views = bytearray(), []
    for old in sorted(used_views):
        v = dict(doc['bufferViews'][old]); off = v.get('byteOffset', 0)
        newbin.extend(b'\0' * (-len(newbin) % 4))
        chunk = binout[off:off + v['byteLength']]
        v['byteOffset'] = len(newbin); newbin.extend(chunk); views.append(v)
    accs = []
    for old in sorted(used_acc):
        a = dict(doc['accessors'][old]); a['bufferView'] = view_map[a['bufferView']]; accs.append(a)
    doc['accessors'], doc['bufferViews'] = accs, views
    for m in doc['meshes']:
        for pr in m['primitives']:
            pr['attributes'] = {k: acc_map[v] for k, v in pr['attributes'].items()}
            if 'indices' in pr: pr['indices'] = acc_map[pr['indices']]
            if 'targets' in pr: pr['targets'] = [{k: acc_map[v] for k, v in tg.items()} for tg in pr['targets']]
    for s in doc['skins']:
        if 'inverseBindMatrices' in s: s['inverseBindMatrices'] = acc_map[s['inverseBindMatrices']]
    for im in doc.get('images', []):
        if 'bufferView' in im: im['bufferView'] = view_map[im['bufferView']]
    for a in doc['animations']:
        for s in a['samplers']: s['input'], s['output'] = acc_map[s['input']], acc_map[s['output']]

    doc['asset']['generator'] = 'Wildhaven Varrisco v05 / moveset MH (8 ataques refeitos + roar, tail_sweep, limp)'
    newbin.extend(b'\0' * (-len(newbin) % 4))
    doc['buffers'][0]['byteLength'] = len(newbin)
    payload = json.dumps(doc, separators=(',', ':'), ensure_ascii=False).encode('utf8')
    payload += b' ' * (-len(payload) % 4)
    glb = (b'glTF' + struct.pack('<II', 2, 28 + len(payload) + len(newbin)) + struct.pack('<I4s', len(payload), b'JSON') + payload
           + struct.pack('<I4s', len(newbin), b'BIN\0') + newbin)
    DEST.write_bytes(glb)
    sha = hashlib.sha256(glb).hexdigest()

    def clip_rows():
        rows = []
        for a in doc['animations']:
            e = a.get('extras', {})
            rows.append({'name': a['name'], 'durationSeconds': e.get('durationSeconds'), 'loop': e.get('loop'),
                         'origin': 'v05_new' if a['name'] in ADDED else 'v05_reauthored' if a['name'] in REPLACED else 'v04_unchanged',
                         **({'contactFraction': e.get('contactFraction'), 'janelasSeg': e.get('janelasSeg')} if a['name'] in SPECS else {})})
        return rows

    manifest = {
        'species': 'varrisco', 'version': 'v05-mh-44', 'stage': 'rig_and_animation_exported_review_pending',
        'previous_version': 'v04', 'source_v04_sha256': hashlib.sha256(raw).hexdigest(),
        'glb': {'path': DEST.name, 'bytes': len(glb), 'sha256': sha, 'triangles': 2754, 'triangles_method': 'indices/3 da única primitiva (inalterada desde a v02)',
                'skin_count': 1, 'joints': 22, 'animations': 44, 'interpolation': 'LINEAR', 'fps_new_clips': FPS},
        'reauthored': list(REPLACED), 'added': list(ADDED), 'kept_from_v04': [a['name'] for a in kept],
        'clips': clip_rows(),
        'method': ('Poses-chave com easing por trecho (antecipação, golpe, overshoot, recuperação), cauda com atraso, '
                   'tremor aditivo e IK analítico de 2 ossos nas pernas no plano sagital do quadril; amostrado a 30 fps. '
                   'Autoria por tabela de poses em source/build_v05.py; validação e renders no Blender 5.3 (source/render_v05_blender.py).'),
        'fixes': ['min/max escalares de 17 accessors de tempo herdados da v02 viraram arrays (spec glTF; o importador do Blender recusava a v04)',
                  'accessors dos 8 clipes substituídos removidos do BIN',
                  'pesos: placas da cauda copiam os pesos da cauda; crista dorsal sobre a pelve mistura pelvis->thorax (antes 100% thorax)'],
        'limitations': ['Keyframes autorados por agente, não por animador (aprovados pelo diretor no lab em 2026-11-20)',
                        'IK de perna só no plano sagital: guinada/rolagem fortes da pelve deixam o pé fora do alvo por alguns cm',
                        'tail_sweep gira o osso root 360° no lugar; o jogo mantém a direção do corpo',
                        'limp supõe 1,0 m/s; o lab deve escalar a velocidade do clipe pela velocidade real',
                        'Clipes não aplicam dano nem movem o corpo no jogo (autoridade física: núcleo ecológico)'],
        'qa': {'khronos_independent_validation': 'pending', 'blender_import': 'see README', 'browser_visual_review': 'Hunter Lab ?mh=1, 2026-11-20', 'artistic_approval': 'aprovado pelo diretor em 2026-11-20 (PR #98, caçada ?pve1=1&pve2=1&mh=1)'},
    }
    (DIR / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print('v05', len(glb), sha, len(doc['animations']), 'clipes')


if __name__ == '__main__':
    main()
