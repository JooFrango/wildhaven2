#!/usr/bin/env python3
"""Varrisco v06 — 4 golpes novos da linha MH sobre o GLB v05 aprovado (44 + 5 = 49 clipes).

Golpes aprovados pelo diretor em 2026-11-20: chute da garra em foice (sickle_kick), mordida giratória
(bite_turn_l / bite_turn_r, espelhadas), salto triplo da raiva (pounce_chain) e rabada em recuo (backstep_tail).
Mesmo motor da v05 (source/build_v05.py importado): poses-chave com easing, cauda com atraso, tremor e IK
analítico de 2 ossos nas pernas. A v05 inteira (malha, pesos, 44 clipes, BIN) é copiada sem alteração; os
5 clipes novos são acrescentados no fim do BIN.

Executar: "<Blender>/5.3/python/bin/python.exe" assets/models/creatures/varrisco/v06/source/build_v06.py
"""
from __future__ import annotations
import hashlib, json, math, struct, sys
from pathlib import Path

DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(DIR.parent / 'v05' / 'source'))
import build_v05 as M  # motor de poses (não reescreve a v05: a montagem dela só roda como script)
from build_v05 import P, mirror

SRC = DIR.parent / 'v05' / 'varrisco-animated-v05-LOD0.glb'
DEST = DIR / 'varrisco-animated-v06-LOD0.glb'

raw = SRC.read_bytes()
assert raw[:4] == b'glTF' and struct.unpack_from('<II', raw, 4) == (2, len(raw))
jlen, = struct.unpack_from('<I', raw, 12)
doc = json.loads(raw[20:20 + jlen])
blen, = struct.unpack_from('<I', raw, 20 + jlen)
BIN = raw[28 + jlen:28 + jlen + blen]
assert len(doc['animations']) == 44
NODE = {n['name']: i for i, n in enumerate(doc['nodes'])}
assert all(NODE[b] == M.NODE[b] for b in M.BONES), 'mesmos nós da v04/v05'

# Convenções (iguais à v05): +X frente, +Y cima, +Z esquerda; [rolagem x, guinada y (+ focinho à direita),
# arfagem z (+ para cima/frente)]; cauda z negativo ergue; jaw z negativo abre. F_L/F_R: alvo do tornozelo.
BITE_TURN_L = [
    (0.00, 'io', P()),
    (0.26, 'out', P(neck=[0, -18, 6], head=[0, -14, 4], thorax=[0, -6, 2], jaw=[0, 0, -8], T_pelvis=[-.03, -.05, 0], tail=[0, 10, -4])),
    (0.33, 'in', P(pelvis=[0, -10, 0], thorax=[-4, -20, -4], neck=[0, -28, -6], head=[0, -12, -4], jaw=[0, 0, -42], T_pelvis=[.03, -.07, 0], tail=[0, 18, -6])),
    (0.38, 'lin', P(pelvis=[0, -15, 0], thorax=[-6, -25, -8], neck=[0, -32, -12], head=[0, -14, -8], jaw=[0, 0, 2], T_pelvis=[.06, -.08, 0], tail=[0, 22, -8])),
    (0.48, 'out', P(pelvis=[0, -15, 0], thorax=[-6, -24, -8], neck=[0, -26, -12], head=[6, -2, -8], T_pelvis=[.05, -.08, 0], tail=[0, 14, -6])),
    (0.58, 'io', P(pelvis=[0, -14, 0], thorax=[-5, -23, -7], neck=[0, -34, -10], head=[-6, -20, -6], T_pelvis=[.05, -.07, 0], tail=[0, 24, -6])),
    (0.78, 'io', P(pelvis=[0, -6, 0], thorax=[-2, -10, -3], neck=[0, -12, -4], head=[0, -6, -2], T_pelvis=[.02, -.03, 0], tail=[0, 8, -2])),
    (1.00, 'io', P()),
]

SPECS = {
 'sickle_kick': dict(dur=1.20, loop=False, cat='combat', contact=.45, janelas=dict(aviso=[0, .45], ativo=[.48, .62], punicao=[.66, 1.2]), keys=[
    (0.00, 'io', P()),
    # Apoia na cauda e na perna esquerda; recolhe a direita com a garra para cima.
    (0.45, 'out', P(T_pelvis=[-.06, -.06, 0], pelvis=[-2, 0, 8], thorax=[0, 0, 10], neck=[0, 0, -8], head=[0, 0, -6], jaw=[0, 0, -10],
                    shoulderL=[-15, 0, 25], shoulderR=[15, 0, 25], tail=[0, 0, 8], F_R=[.12, .42, 0], P_R=30, tremor=1.5)),
    # Golpe: a perna estende à frente e a garra rasga para baixo.
    (0.54, 'in', P(T_pelvis=[.04, -.04, 0], pelvis=[-2, 0, 4], thorax=[0, 0, 4], neck=[0, 0, -10], head=[0, 0, -8], jaw=[0, 0, -24],
                   shoulderL=[-15, 0, 15], shoulderR=[15, 0, 15], tail=[0, 0, 9], F_R=[.58, .30, 0], P_R=-40)),
    (0.64, 'out', P(T_pelvis=[.06, -.08, 0], pelvis=[-1, 0, -2], thorax=[0, 0, -4], neck=[0, 0, -6], head=[0, 0, -4], jaw=[0, 0, -10],
                    tail=[0, 0, 6], F_R=[.46, .13, 0], P_R=-8)),
    (0.86, 'io', P(T_pelvis=[.03, -.05, 0], thorax=[0, 0, -2], tail=[0, 0, 2], F_R=[.22, .10, 0], P_R=0)),
    (1.02, 'io', P(T_pelvis=[.01, -.02, 0], F_R=[0, .02, 0])),
    (1.20, 'io', P()),
 ]),
 'bite_turn_l': dict(dur=1.00, loop=False, cat='combat', contact=.38, janelas=dict(aviso=[0, .26], ativo=[.33, .42], punicao=[.48, 1.0]), keys=BITE_TURN_L),
 'bite_turn_r': dict(dur=1.00, loop=False, cat='combat', contact=.38, janelas=dict(aviso=[0, .26], ativo=[.33, .42], punicao=[.48, 1.0]), keys=mirror(BITE_TURN_L)),
 'pounce_chain': dict(dur=2.60, loop=False, cat='combat', contact=.6923, janelas=dict(aviso=[0, .45], saltos=[.45, .95, 1.45], ativo=[1.62, 1.86], punicao=[1.88, 2.6]), keys=[
    (0.00, 'io', P()),
    (0.45, 'out', P(T_pelvis=[-.12, -.24, 0], pelvis=[0, 0, -4], thorax=[0, 0, -10], neck=[0, 0, 14], head=[0, 0, 8], jaw=[0, 0, -14],
                    shoulderL=[0, 0, 30], shoulderR=[0, 0, 30], tail=[0, 0, -10], tremor=2.5)),
    # Salto 1
    (0.58, 'out', P(T_pelvis=[.10, .26, 0], pelvis=[0, 0, 6], thorax=[0, 0, -2], neck=[0, 0, -2], jaw=[0, 0, -18], shoulderL=[0, 0, 60], shoulderR=[0, 0, 60],
                    tail=[0, 0, -2], F_L=[.08, .28, 0], F_R=[.04, .24, 0], P_L=-20, P_R=-20)),
    (0.80, 'in', P(T_pelvis=[.02, -.18, 0], pelvis=[0, 0, -6], thorax=[0, 0, -12], neck=[0, 0, 6], head=[0, 0, 6], jaw=[0, 0, -12], tail=[0, 0, -14])),
    (0.95, 'io', P(T_pelvis=[-.06, -.22, 0], pelvis=[0, 0, -4], thorax=[0, 0, -10], neck=[0, 0, 12], head=[0, 0, 8], jaw=[0, 0, -16], tail=[0, 0, -10], tremor=2)),
    # Salto 2
    (1.08, 'out', P(T_pelvis=[.10, .28, 0], pelvis=[0, 0, 6], thorax=[0, 0, -2], neck=[0, 0, -4], jaw=[0, 0, -22], shoulderL=[0, 0, 65], shoulderR=[0, 0, 65],
                    tail=[0, 0, -2], F_L=[.08, .30, 0], F_R=[.04, .26, 0], P_L=-20, P_R=-20)),
    (1.30, 'in', P(T_pelvis=[.02, -.18, 0], pelvis=[0, 0, -6], thorax=[0, 0, -12], neck=[0, 0, 6], head=[0, 0, 6], jaw=[0, 0, -12], tail=[0, 0, -14])),
    (1.45, 'io', P(T_pelvis=[-.08, -.24, 0], pelvis=[0, 0, -4], thorax=[0, 0, -10], neck=[0, 0, 16], head=[0, 0, 10], jaw=[0, 0, -20], tail=[0, 0, -12], tremor=3)),
    # Salto 3: o mais alto, com mordida e garras na queda.
    (1.62, 'out', P(T_pelvis=[.16, .36, 0], pelvis=[0, 0, 4], thorax=[0, 0, -4], neck=[0, 0, -8], head=[0, 0, -4], jaw=[0, 0, -40],
                    shoulderL=[0, 0, 90], shoulderR=[0, 0, 90], forearmL=[0, 0, 30], forearmR=[0, 0, 30], tail=[0, 0, -2], F_L=[.12, .36, 0], F_R=[.08, .32, 0], P_L=-25, P_R=-25)),
    (1.80, 'in', P(T_pelvis=[.22, .06, 0], pelvis=[0, 0, -6], thorax=[0, 0, -14], neck=[0, 0, -26], head=[0, 0, -12], jaw=[0, 0, 2],
                   shoulderL=[20, 0, 20], shoulderR=[-20, 0, 20], forearmL=[0, 0, -10], forearmR=[0, 0, -10], tail=[0, 0, -10], F_L=[.18, .04, 0], F_R=[.16, .06, 0], P_L=-10, P_R=-10)),
    (1.90, 'out', P(T_pelvis=[.20, -.20, 0], pelvis=[0, 0, -8], thorax=[0, 0, -18], neck=[0, 0, -20], head=[0, 0, -8], shoulderL=[20, 0, 0], shoulderR=[-20, 0, 0],
                    tail=[0, 0, -16], F_L=[.18, 0, 0], F_R=[.16, 0, 0])),
    # Recuperação longa: ofega baixo, depois recolhe os pés.
    (2.20, 'io', P(T_pelvis=[.14, -.16, 0], thorax=[0, 0, -12], neck=[0, 0, -14], head=[0, 0, -6], jaw=[0, 0, -12], tail=[0, 0, -6], F_L=[.10, .07, 0], F_R=[.16, 0, 0], tremor=1)),
    (2.34, 'io', P(T_pelvis=[.08, -.10, 0], thorax=[0, 0, -6], neck=[0, 0, -6], tail=[0, 0, -3], F_L=[0, 0, 0], F_R=[.16, 0, 0])),
    (2.47, 'io', P(T_pelvis=[.03, -.05, 0], F_R=[.06, .07, 0])),
    (2.60, 'io', P()),
 ]),
 'backstep_tail': dict(dur=1.10, loop=False, cat='combat', contact=.40, janelas=dict(aviso=[0, .25], ativo=[.36, .56], punicao=[.62, 1.1]), keys=[
    (0.00, 'io', P()),
    (0.25, 'out', P(T_pelvis=[.03, -.10, 0], pelvis=[0, 12, -2], thorax=[0, 8, -4], neck=[0, -10, -2], head=[0, -6, -2], jaw=[0, 0, -10], tail=[0, -20, -4])),
    # Salto para trás com a cauda chicoteando para o lado.
    (0.40, 'in', P(T_root=[0, .10, 0], T_pelvis=[-.18, -.02, 0], pelvis=[0, -22, 2], thorax=[0, -10, 4], neck=[0, 8, 4], head=[0, 6, 2],
                   tail=[0, 40, -6], F_L=[-.12, .10, 0], F_R=[-.14, .12, 0], P_L=-15, P_R=-15)),
    (0.55, 'lin', P(T_pelvis=[-.10, -.14, 0], pelvis=[0, -18, -2], thorax=[0, -8, -6], neck=[0, 6, -4], head=[0, 4, -2], tail=[0, 26, -8], F_L=[-.06, 0, 0], F_R=[-.08, 0, 0])),
    (0.80, 'io', P(T_pelvis=[-.04, -.07, 0], pelvis=[0, -4, -1], thorax=[0, -2, -2], tail=[0, -8, -3], F_L=[-.02, 0, 0], F_R=[-.03, 0, 0])),
    (1.10, 'io', P()),
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
        'loop': False, 'durationSeconds': dur, 'fps': M.FPS, 'stage': 'experimental_v06_mh', 'category': 'combat',
        'rootMotion': 'in_place', 'contactFraction': spec['contact'], 'janelasSeg': spec['janelas'],
        'physicalAuthority': 'ecology_kernel', 'method': 'pose_to_pose_keys_eased_analytic_leg_ik'}})
assert len(doc['animations']) == 49 and len({a['name'] for a in doc['animations']}) == 49
assert binout[:len(BIN)] == BIN

doc['asset']['generator'] = 'Wildhaven Varrisco v06 / v05 + sickle_kick, bite_turn_l/r, pounce_chain, backstep_tail'
doc['buffers'][0]['byteLength'] = len(binout)
payload = json.dumps(doc, separators=(',', ':'), ensure_ascii=False).encode('utf8')
payload += b' ' * (-len(payload) % 4)
binout.extend(b'\0' * (-len(binout) % 4))
glb = (b'glTF' + struct.pack('<II', 2, 28 + len(payload) + len(binout)) + struct.pack('<I4s', len(payload), b'JSON') + payload
       + struct.pack('<I4s', len(binout), b'BIN\0') + binout)
DEST.write_bytes(glb)
sha = hashlib.sha256(glb).hexdigest()

manifest = {
    'species': 'varrisco', 'version': 'v06-mh-49', 'stage': 'rig_and_animation_exported_review_pending',
    'previous_version': 'v05', 'source_v05_sha256': hashlib.sha256(raw).hexdigest(),
    'glb': {'path': DEST.name, 'bytes': len(glb), 'sha256': sha, 'triangles': 2754, 'triangles_method': 'indices/3 da única primitiva (inalterada desde a v02)',
            'skin_count': 1, 'joints': 22, 'animations': 49, 'interpolation': 'LINEAR', 'fps_new_clips': M.FPS},
    'added': list(NEW), 'kept_from_v05': 44,
    'clips': [{'name': a['name'], 'durationSeconds': a.get('extras', {}).get('durationSeconds'), 'loop': a.get('extras', {}).get('loop'),
               'origin': 'v06_new' if a['name'] in NEW else 'v05_unchanged',
               **({'contactFraction': SPECS[a['name']]['contact'], 'janelasSeg': SPECS[a['name']]['janelas']} if a['name'] in NEW else {})} for a in doc['animations']],
    'method': 'Motor da v05 (build_v05.py importado): poses-chave com easing, cauda com atraso, tremor aditivo, IK analítico de 2 ossos nas pernas; 30 fps.',
    'approval': 'Lista de golpes aprovada pelo diretor em 2026-11-20 antes da autoria; clipes aprovados pelo diretor no lab em 2026-11-20.',
    'limitations': ['Keyframes autorados por agente, não por animador',
                    'pounce_chain é no lugar: os três saltos do corpo vêm da IA (impulsos em janelasSeg.saltos)',
                    'backstep_tail é no lugar: o recuo do corpo vem da IA',
                    'bite_turn_l/r giram pescoço, tórax e pelve ~80°; o rumo do corpo no jogo não muda',
                    'Clipes não aplicam dano nem movem o corpo no jogo (autoridade física: núcleo ecológico)'],
    'qa': {'khronos_independent_validation': 'pending', 'blender_import': 'see README', 'browser_visual_review': 'Hunter Lab ?mh=1, 2026-11-20', 'artistic_approval': 'aprovado pelo diretor em 2026-11-20 (PR #98, caçada ?pve1=1&pve2=1&mh=1)'},
}
(DIR / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
print('v06', len(glb), sha, len(doc['animations']), 'clipes')
