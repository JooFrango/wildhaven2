#!/usr/bin/env python3
"""Varrisco v08 — corrige a malha do avesso herdada da v02 (54 clipes da v07, sem outra mudança).

Defeito (relatado pelo diretor em 2026-11-20, "a parte de fora está pra dentro"): na malha
Varrisco_v02_facet_silhouette, a ordem dos vértices de todos os 2754 triângulos E as normais apontavam para
dentro (volume com sinal -0,3786 m³). Com material de um lado só (doubleSided=false), o three.js mostrava a face
interna da pele. Correção: troca o 2º e o 3º índice de cada triângulo e nega cada normal, gravando no mesmo
lugar do BIN. Posições, cores, juntas, pesos, nós, skin, clipes e extras ficam idênticos aos da v07.

Executar: "<Blender>/5.3/python/bin/python.exe" assets/models/creatures/varrisco/v08/source/build_v08.py
"""
from __future__ import annotations
import hashlib, json, struct
from pathlib import Path

DIR = Path(__file__).resolve().parent.parent
SRC = DIR.parent / 'v07' / 'varrisco-animated-v07-LOD0.glb'
DEST = DIR / 'varrisco-animated-v08-LOD0.glb'

raw = SRC.read_bytes()
assert raw[:4] == b'glTF' and struct.unpack_from('<II', raw, 4) == (2, len(raw))
jlen, = struct.unpack_from('<I', raw, 12)
jbytes = raw[20:20 + jlen]
doc = json.loads(jbytes)
blen, = struct.unpack_from('<I', raw, 20 + jlen)
bin_off = 28 + jlen
binout = bytearray(raw[bin_off:bin_off + blen])
assert len(doc['meshes']) == 1 and len(doc['meshes'][0]['primitives']) == 1 and len(doc['animations']) == 54
prim = doc['meshes'][0]['primitives'][0]
assert prim.get('mode', 4) == 4

FMT = {5126: ('f', 4), 5121: ('B', 1), 5123: ('H', 2), 5125: ('I', 4)}
def slots(i):
    """Offsets (no BIN) de cada elemento do accessor, respeitando byteStride."""
    a = doc['accessors'][i]; v = doc['bufferViews'][a['bufferView']]
    fmt, size = FMT[a['componentType']]; w = {'SCALAR': 1, 'VEC3': 3}[a['type']]
    stride = v.get('byteStride', size * w); base = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    return fmt, w, [base + k * stride for k in range(a['count'])]

# Índices: (i0, i1, i2) -> (i0, i2, i1).
fmt, _, off = slots(prim['indices'])
idx = [struct.unpack_from('<' + fmt, binout, o)[0] for o in off]
assert len(idx) % 3 == 0
for t in range(0, len(idx), 3):
    struct.pack_into('<' + fmt, binout, off[t + 1], idx[t + 2])
    struct.pack_into('<' + fmt, binout, off[t + 2], idx[t + 1])

# Normais: n -> -n.
fmt, w, off = slots(prim['attributes']['NORMAL'])
assert fmt == 'f' and w == 3
for o in off:
    x, y, z = struct.unpack_from('<3f', binout, o)
    struct.pack_into('<3f', binout, o, -x, -y, -z)

# Conferência: volume com sinal positivo e normais concordando com a nova ordem.
pf, _, poff = slots(prim['attributes']['POSITION'])
P = [struct.unpack_from('<3f', binout, o) for o in poff]
nf, _, noff = slots(prim['attributes']['NORMAL'])
N = [struct.unpack_from('<3f', binout, o) for o in noff]
fi, _, ioff = slots(prim['indices'])
I = [struct.unpack_from('<' + fi, binout, o)[0] for o in ioff]
vol, concorda = 0.0, 0
for t in range(0, len(I), 3):
    a, b, c = P[I[t]], P[I[t + 1]], P[I[t + 2]]
    vol += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6
    u = [b[k] - a[k] for k in range(3)]; v = [c[k] - a[k] for k in range(3)]
    fn = (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])
    nn = [N[I[t]][k] + N[I[t + 1]][k] + N[I[t + 2]][k] for k in range(3)]
    concorda += sum(fn[k] * nn[k] for k in range(3)) > 0
tri = len(I) // 3
assert vol > 0 and concorda == tri, (vol, concorda, tri)

doc['asset']['generator'] = 'Wildhaven Varrisco v08 / v07 com a malha do lado certo (ordem dos triângulos e normais invertidas)'
payload = json.dumps(doc, separators=(',', ':'), ensure_ascii=False).encode('utf8')
payload += b' ' * (-len(payload) % 4)
glb = (b'glTF' + struct.pack('<II', 2, 28 + len(payload) + len(binout)) + struct.pack('<I4s', len(payload), b'JSON') + payload
       + struct.pack('<I4s', len(binout), b'BIN\0') + bytes(binout))
DEST.write_bytes(glb)
sha = hashlib.sha256(glb).hexdigest()

manifest = {
    'species': 'varrisco', 'version': 'v08-mh-54', 'stage': 'rig_and_animation_exported_review_pending',
    'previous_version': 'v07', 'source_v07_sha256': hashlib.sha256(raw).hexdigest(),
    'glb': {'path': DEST.name, 'bytes': len(glb), 'sha256': sha, 'triangles': tri, 'triangles_method': 'indices/3 da única primitiva',
            'skin_count': 1, 'joints': 22, 'animations': 54, 'signed_volume_m3': round(vol, 4), 'normals_agree_with_winding': f'{concorda}/{tri}'},
    'fix': 'Malha do avesso desde a v02 (volume -0,3786 m³, ordem e normais para dentro): 2º e 3º índice trocados e normais negadas. '
           'Posições, cores, juntas, pesos, nós, skin, 54 clipes e extras idênticos aos da v07.',
    'clips': 'iguais aos da v07 (ver v07/manifest.json)',
    'qa': {'khronos_independent_validation': 'pending', 'blender_import': 'see README', 'browser_visual_review': 'Hunter Lab ?mh=1 e viewer Three.js, 2026-11-20',
           'artistic_approval': 'aprovado pelo diretor em 2026-11-20 (PR #98, caçada ?pve1=1&pve2=1&mh=1)'},
}
(DIR / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
print('v08', len(glb), sha, 'volume', round(vol, 4), 'concorda', f'{concorda}/{tri}')
