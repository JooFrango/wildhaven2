#!/usr/bin/env python3
"""Varrisco v07 — reações de dano da linha MH sobre o GLB v06 aprovado (49 + 5 = 54 clipes).

Escopo aprovado pelo diretor em 2026-11-20: reação média lateral (hit_side_l/r, espelhadas), vacilo forte
com passo de equilíbrio (hit_heavy_l/r, espelhadas) e cabeça para trás num acerto frontal (hit_head).
Sufixo _l/_r = LADO DE ONDE VEIO O GOLPE (hit_side_l: golpe à esquerda, corpo recua para a direita).
Mesmo motor da v05 (poses-chave, easing, cauda com atraso, tremor, IK das pernas). A v06 inteira é
copiada sem alteração; os 5 clipes entram no fim do BIN.

Executar: "<Blender>/5.3/python/bin/python.exe" assets/models/creatures/varrisco/v07/source/build_v07.py
"""
from __future__ import annotations
import hashlib, json, math, struct, sys
from pathlib import Path

DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(DIR.parent / 'v05' / 'source'))
import build_v05 as M  # motor de poses (a montagem da v05 só roda como script)
from build_v05 import P, mirror

SRC = DIR.parent / 'v06' / 'varrisco-animated-v06-LOD0.glb'
DEST = DIR / 'varrisco-animated-v07-LOD0.glb'

raw = SRC.read_bytes()
assert raw[:4] == b'glTF' and struct.unpack_from('<II', raw, 4) == (2, len(raw))
jlen, = struct.unpack_from('<I', raw, 12)
doc = json.loads(raw[20:20 + jlen])
blen, = struct.unpack_from('<I', raw, 20 + jlen)
BIN = raw[28 + jlen:28 + jlen + blen]
assert len(doc['animations']) == 49
NODE = {n['name']: i for i, n in enumerate(doc['nodes'])}
assert all(NODE[b] == M.NODE[b] for b in M.BONES)

# Convenções da v05: +X frente, +Y cima, +Z esquerda; graus [rolagem x (+ inclina para a esquerda),
# guinada y (+ focinho para a direita), arfagem z (+ para cima)]. Golpe vindo da esquerda: o corpo rola e
# gira para a direita (x -, y +), a cabeça chicoteia para a direita e a cauda compensa para a esquerda.
HIT_SIDE_L = [
    (0.00, 'io', P()),
    (0.06, 'out', P(pelvis=[0, 5, 0], thorax=[-14, 12, 2], neck=[-4, 18, 6], head=[-6, 14, 4], jaw=[0, 0, -18],
                    T_pelvis=[-.02, -.03, 0], tail=[0, -14, -4], shoulderL=[-10, 0, 12], shoulderR=[8, 0, -8])),
    (0.16, 'out', P(pelvis=[0, 2, 0], thorax=[3, 4, 0], neck=[1, -6, 2], head=[2, -5, 1], jaw=[0, 0, -8], tail=[0, 6, -2])),
    (0.30, 'io', P(thorax=[-1, 1, 0], neck=[0, 2, 0], tail=[0, -2, 0])),
    (0.55, 'io', P()),
]
HIT_HEAVY_L = [
    (0.00, 'io', P()),
    # Impacto: tronco e cabeça arremessados para a direita.
    (0.08, 'out', P(pelvis=[0, 10, -2], thorax=[-22, 18, 4], neck=[-6, 26, 10], head=[-8, 18, 8], jaw=[0, 0, -32],
                    T_pelvis=[-.06, -.05, 0], tail=[0, -26, -8], shoulderL=[-20, 0, 25], shoulderR=[15, 0, -10], tremor=3)),
    # Cambaleia: a perna direita sai do chão e recua para recuperar o equilíbrio.
    (0.26, 'out', P(pelvis=[0, 12, -4], thorax=[-18, 14, -2], neck=[-4, 18, 4], head=[-4, 10, 2], jaw=[0, 0, -20],
                    T_pelvis=[-.10, -.08, 0], tail=[0, -18, -10], F_R=[-.10, .12, 0], P_R=-10, tremor=2)),
    (0.42, 'in', P(pelvis=[0, 6, -4], thorax=[-8, 6, -4], neck=[0, 8, 0], head=[0, 4, 0], jaw=[0, 0, -12],
                   T_pelvis=[-.12, -.10, 0], tail=[0, -8, -8], F_R=[-.16, 0, 0])),
    # Recupera a postura e balança a cabeça.
    (0.62, 'io', P(pelvis=[0, 2, -2], thorax=[0, 0, -2], neck=[0, -10, 2], head=[0, -12, 2], jaw=[0, 0, -10],
                   T_pelvis=[-.08, -.07, 0], tail=[0, 6, -4], F_R=[-.16, 0, 0])),
    (0.78, 'io', P(neck=[0, 6, 0], head=[0, 8, 0], T_pelvis=[-.04, -.04, 0], F_R=[-.08, .08, 0])),
    (0.92, 'io', P(T_pelvis=[-.01, -.01, 0], F_R=[0, .01, 0])),
    (1.10, 'io', P()),
]

SPECS = {
 'hit_side_l': dict(dur=0.55, cat='reaction', keys=HIT_SIDE_L),
 'hit_side_r': dict(dur=0.55, cat='reaction', keys=mirror(HIT_SIDE_L)),
 'hit_heavy_l': dict(dur=1.10, cat='reaction', keys=HIT_HEAVY_L),
 'hit_heavy_r': dict(dur=1.10, cat='reaction', keys=mirror(HIT_HEAVY_L)),
 'hit_head': dict(dur=0.60, cat='reaction', keys=[
    (0.00, 'io', P()),
    # Golpe de frente na cabeça: focinho joga para cima e para trás, corpo recua.
    (0.06, 'out', P(neck=[0, 0, 22], head=[0, 0, 18], jaw=[0, 0, -26], thorax=[0, 0, 6], T_pelvis=[-.07, -.02, 0], tail=[0, 0, 6],
                    shoulderL=[0, 0, 15], shoulderR=[0, 0, 15], tremor=2)),
    (0.18, 'out', P(neck=[0, 0, -6], head=[0, 0, -4], jaw=[0, 0, -10], thorax=[0, 0, -2], T_pelvis=[-.04, -.04, 0], tail=[0, 0, -3])),
    (0.34, 'io', P(neck=[0, 0, 2], head=[0, 0, 1], T_pelvis=[-.01, -.01, 0])),
    (0.60, 'io', P()),
 ]),
}
NEW = tuple(SPECS)

binout = bytearray(BIN)
def add_accessor(values, typ):
    data = struct.pack('<' + 'f' * len(values), *values)
    assert all(math.isfinite(x) for x in values)
    doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binout), 'byteLength': len(data)})
    binout.extend(data)
    w = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}[typ]
    acc = {'bufferView': len(doc['bufferViews']) - 1, 'componentType': 5126, 'count': len(values) // w, 'type': typ}
    if typ == 'SCALAR': acc.update(min=[min(values)], max=[max(values)])
    doc['accessors'].append(acc)
    return len(doc['accessors']) - 1

for name in NEW:
    spec = SPECS[name]; dur = spec['dur']; frames = round(dur * M.FPS)
    times = [dur * i / frames for i in range(frames + 1)]
    poses = [M.evaluate(spec, t) for t in times]
    tacc = add_accessor(times, 'SCALAR')
    samplers, channels = [], []
    for b in M.BONES:
        quats, prev = [], None
        for rot, _ in poses:
            q = M.qeuler(*rot[b])
            if prev and sum(q[i] * prev[i] for i in range(4)) < 0: q = tuple(-c for c in q)
            quats.extend(q); prev = q
        if any(abs(x) > 1e-3 for rot, _ in poses for x in rot[b]):
            samplers.append({'input': tacc, 'output': add_accessor(quats, 'VEC4'), 'interpolation': 'LINEAR'})
            channels.append({'sampler': len(samplers) - 1, 'target': {'node': NODE[b], 'path': 'rotation'}})
        if any(abs(x) > 1e-4 for _, trn in poses for x in trn[b]):
            vals = [M.REST[b][i] + trn[b][i] for _, trn in poses for i in range(3)]
            samplers.append({'input': tacc, 'output': add_accessor(vals, 'VEC3'), 'interpolation': 'LINEAR'})
            channels.append({'sampler': len(samplers) - 1, 'target': {'node': NODE[b], 'path': 'translation'}})
    assert len(channels) >= 8, (name, len(channels))
    doc['animations'].append({'name': name, 'samplers': samplers, 'channels': channels, 'extras': {
        'loop': False, 'durationSeconds': dur, 'fps': M.FPS, 'stage': 'experimental_v07_mh', 'category': spec['cat'],
        'rootMotion': 'in_place', 'physicalAuthority': 'ecology_kernel', 'method': 'pose_to_pose_keys_eased_analytic_leg_ik'}})
assert len(doc['animations']) == 54 and len({a['name'] for a in doc['animations']}) == 54
assert binout[:len(BIN)] == BIN

doc['asset']['generator'] = 'Wildhaven Varrisco v07 / v06 + hit_side_l/r, hit_heavy_l/r, hit_head'
doc['buffers'][0]['byteLength'] = len(binout)
payload = json.dumps(doc, separators=(',', ':'), ensure_ascii=False).encode('utf8')
payload += b' ' * (-len(payload) % 4)
binout.extend(b'\0' * (-len(binout) % 4))
glb = (b'glTF' + struct.pack('<II', 2, 28 + len(payload) + len(binout)) + struct.pack('<I4s', len(payload), b'JSON') + payload
       + struct.pack('<I4s', len(binout), b'BIN\0') + binout)
DEST.write_bytes(glb)
sha = hashlib.sha256(glb).hexdigest()

manifest = {
    'species': 'varrisco', 'version': 'v07-mh-54', 'stage': 'rig_and_animation_exported_review_pending',
    'previous_version': 'v06', 'source_v06_sha256': hashlib.sha256(raw).hexdigest(),
    'glb': {'path': DEST.name, 'bytes': len(glb), 'sha256': sha, 'triangles': 2754, 'triangles_method': 'indices/3 da única primitiva (inalterada desde a v02)',
            'skin_count': 1, 'joints': 22, 'animations': 54, 'interpolation': 'LINEAR', 'fps_new_clips': M.FPS},
    'added': list(NEW), 'kept_from_v06': 49,
    'clips': [{'name': a['name'], 'durationSeconds': a.get('extras', {}).get('durationSeconds'), 'loop': a.get('extras', {}).get('loop'),
               'origin': 'v07_new' if a['name'] in NEW else 'v06_unchanged'} for a in doc['animations']],
    'method': 'Motor da v05 (build_v05.py importado): poses-chave com easing, cauda com atraso, tremor aditivo, IK analítico de 2 ossos nas pernas; 30 fps.',
    'approval': 'Escopo de reação de dano aprovado pelo diretor em 2026-11-20 antes da autoria; clipes aprovados pelo diretor no lab em 2026-11-20.',
    'limitations': ['Keyframes autorados por agente, não por animador',
                    'O passo de equilíbrio do hit_heavy é para trás: o IK das pernas resolve só no plano sagital, sem passo lateral',
                    'Recuo e interrupção do golpe vêm da IA (monstro-varrisco.js), não do clipe'],
    'qa': {'khronos_independent_validation': 'pending', 'blender_import': 'see README', 'browser_visual_review': 'Hunter Lab ?mh=1, 2026-11-20', 'artistic_approval': 'aprovado pelo diretor em 2026-11-20 (PR #98, caçada ?pve1=1&pve2=1&mh=1)'},
}
(DIR / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
print('v07', len(glb), sha, len(doc['animations']), 'clipes')
