#!/usr/bin/env python3
"""Varrisco v11 — orientação das faces coerente em cada parte da malha (v10 sem outra mudança).

Defeito (diretor, 2026-11-21: "pernas e pescoço ainda dão pra ver por dentro"): a malha da v02 é feita de
~100 partes fechadas separadas (129 na v10), e dentro de cada parte havia faces com a ordem de vértices trocada
em relação às vizinhas (1002 arestas compartilhadas percorridas no mesmo sentido) e 59 partes inteiras do
avesso (volume com sinal negativo: pescoço, canelas, pés, ombros, mãos). A v08 inverteu a malha inteira, o
que acertou o tronco, a cauda e a cabeça mas não as tampas e as partes menores. Com material de um lado só,
essas faces somem e mostram o interior.

Correção, por parte conectada (vértices soldados por posição, 1e-4):
1. propaga uma orientação coerente pelos triângulos vizinhos (busca em largura pela aresta compartilhada);
2. se o volume com sinal da parte ficar negativo, inverte a parte inteira;
3. regrava a ordem dos índices (troca do 2º e 3º) e a normal facetada de cada triângulo invertido (n -> -n).
Posições, cores, juntas, pesos, nós, skin, os 55 clipes e extras ficam idênticos aos da v10.

Executar: "<Blender>/5.3/python/bin/python.exe" assets/models/creatures/varrisco/v11/source/build_v11.py
"""
from __future__ import annotations
import hashlib, json, struct
from collections import defaultdict, deque
from pathlib import Path

DIR = Path(__file__).resolve().parent.parent
SRC = DIR.parent / 'v10' / 'varrisco-animated-v10-LOD0.glb'
DEST = DIR / 'varrisco-animated-v11-LOD0.glb'

raw = SRC.read_bytes()
assert raw[:4] == b'glTF'
jlen, = struct.unpack_from('<I', raw, 12)
doc = json.loads(raw[20:20 + jlen])
blen, = struct.unpack_from('<I', raw, 20 + jlen)
binout = bytearray(raw[28 + jlen:28 + jlen + blen])
prim = doc['meshes'][0]['primitives'][0]
assert len(doc['meshes']) == 1 and len(doc['meshes'][0]['primitives']) == 1 and len(doc['animations']) == 55

FMT = {5126: ('f', 4), 5123: ('H', 2), 5125: ('I', 4)}
def slots(i):
    a = doc['accessors'][i]; v = doc['bufferViews'][a['bufferView']]
    f, s = FMT[a['componentType']]; w = {'SCALAR': 1, 'VEC3': 3}[a['type']]
    st = v.get('byteStride', s * w); o = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    return f, w, [o + k * st for k in range(a['count'])]

pf, _, poff = slots(prim['attributes']['POSITION']); P = [struct.unpack_from('<3f', binout, o) for o in poff]
fi, _, ioff = slots(prim['indices']); I = [struct.unpack_from('<' + fi, binout, o)[0] for o in ioff]
nf, _, noff = slots(prim['attributes']['NORMAL'])
T = len(I) // 3

# Soldagem por posição e arestas compartilhadas.
sold = {}
V = [sold.setdefault(tuple(round(c * 1e4) for c in p), len(sold)) for p in P]
tri = [tuple(V[I[3 * t + c]] for c in range(3)) for t in range(T)]
arestas = defaultdict(list)  # aresta não orientada -> [(triângulo, u, v) no sentido do triângulo]
for t, (a, b, c) in enumerate(tri):
    for u, v in ((a, b), (b, c), (c, a)):
        arestas[(min(u, v), max(u, v))].append((t, u, v))

# 1) Orientação coerente por busca em largura dentro de cada parte.
virar = [None] * T  # True = inverter este triângulo
comp = [-1] * T
ncomp = 0
for t0 in range(T):
    if virar[t0] is not None: continue
    virar[t0] = False; comp[t0] = ncomp; fila = deque([t0])
    while fila:
        t = fila.popleft(); a, b, c = tri[t]
        for u, v in ((a, b), (b, c), (c, a)):
            if virar[t]: u, v = v, u  # sentido efetivo depois da inversão
            viz = arestas[(min(u, v), max(u, v))]
            if len(viz) != 2: continue  # aresta não-variedade: não impõe sentido
            for g, gu, gv in viz:
                if g == t or virar[g] is not None: continue
                virar[g] = (gu, gv) == (u, v)  # vizinho coerente percorre a aresta no sentido oposto
                comp[g] = ncomp; fila.append(g)
    ncomp += 1

# 2) Volume com sinal por parte; parte negativa inverte inteira.
def vol_tri(t, inv):
    a, b, c = (P[I[3 * t + k]] for k in range(3))
    if inv: b, c = c, b
    return (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6
vol = [0.] * ncomp
for t in range(T): vol[comp[t]] += vol_tri(t, virar[t])
for t in range(T):
    if vol[comp[t]] < 0: virar[t] = not virar[t]

# 3) Regrava índices e normais dos triângulos invertidos (no mesmo lugar do BIN).
invertidos = 0
for t in range(T):
    if not virar[t]: continue
    invertidos += 1
    i1, i2 = I[3 * t + 1], I[3 * t + 2]
    struct.pack_into('<' + fi, binout, ioff[3 * t + 1], i2); struct.pack_into('<' + fi, binout, ioff[3 * t + 2], i1)
    I[3 * t + 1], I[3 * t + 2] = i2, i1
    for k in (I[3 * t], i1, i2):
        x, y, z = struct.unpack_from('<3f', binout, noff[k])
        struct.pack_into('<3f', binout, noff[k], -x, -y, -z)

# Conferência: nenhuma aresta de variedade percorrida no mesmo sentido, todas as partes com volume positivo,
# normais facetadas concordando com a nova ordem.
trocadas = 0
for (_, _), viz in arestas.items():
    if len(viz) != 2: continue
    (t1, u1, v1), (t2, u2, v2) = viz
    if virar[t1]: u1, v1 = v1, u1
    if virar[t2]: u2, v2 = v2, u2
    trocadas += (u1, v1) == (u2, v2)
vol_final = [0.] * ncomp
for t in range(T): vol_final[comp[t]] += vol_tri(t, False)
N = [struct.unpack_from('<3f', binout, o) for o in noff]
concorda = 0
for t in range(T):
    a, b, c = (P[I[3 * t + k]] for k in range(3))
    u = [b[k] - a[k] for k in range(3)]; v = [c[k] - a[k] for k in range(3)]
    fn = (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])
    concorda += sum(fn[k] * N[I[3 * t]][k] for k in range(3)) > 0
nao_variedade = sum(1 for viz in arestas.values() if len(viz) > 2)
assert trocadas == 0 and min(vol_final) > 0 and concorda == T, (trocadas, min(vol_final), concorda, T)

doc['asset']['generator'] = 'Wildhaven Varrisco v11 / v10 com a orientação das faces coerente em cada parte'
payload = json.dumps(doc, separators=(',', ':'), ensure_ascii=False).encode('utf8')
payload += b' ' * (-len(payload) % 4)
glb = (b'glTF' + struct.pack('<II', 2, 28 + len(payload) + len(binout)) + struct.pack('<I4s', len(payload), b'JSON') + payload
       + struct.pack('<I4s', len(binout), b'BIN\0') + bytes(binout))
DEST.write_bytes(glb)
sha = hashlib.sha256(glb).hexdigest()

manifest = {
    'species': 'varrisco', 'version': 'v11-mh-55', 'stage': 'refinement_exported_review_pending',
    'previous_version': 'v10', 'source_v10_sha256': hashlib.sha256(raw).hexdigest(),
    'glb': {'path': DEST.name, 'bytes': len(glb), 'sha256': sha, 'triangles': T, 'skin_count': 1, 'joints': 22, 'animations': 55,
            'parts': ncomp, 'parts_with_negative_volume': 0, 'swapped_shared_edges': trocadas, 'non_manifold_edges': nao_variedade,
            'normals_agree_with_winding': f'{concorda}/{T}', 'min_part_volume': round(min(vol_final), 6)},
    'fix': (f'Orientação coerente por parte (BFS pelas arestas compartilhadas) e partes com volume negativo invertidas: '
            f'{invertidos} de {T} triângulos invertidos (índices 2º/3º trocados e normal negada). '
            'Posições, cores, juntas, pesos, nós, skin, os 55 clipes e extras idênticos aos da v10.'),
    'before_v10': {'parts': ncomp, 'parts_with_negative_volume': sum(1 for x in vol if x < 0)},
    'clips': 'iguais aos da v10 (ver v10/manifest.json)',
    'qa': {'khronos_independent_validation': 'pending', 'blender_import': 'see README', 'browser_visual_review': 'Hunter Lab ?mh=1 e viewer Three.js, 2026-11-21',
           'artistic_approval': 'aprovado pelo diretor em 2026-11-21 (PR #98, caçada ?pve1=1&pve2=1&mh=1)'},
}
(DIR / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
print('v11', len(glb), sha, 'partes', ncomp, 'negativas antes', manifest['before_v10']['parts_with_negative_volume'],
      'invertidos', invertidos, 'trocadas', trocadas, 'nao-variedade', nao_variedade, 'vol min', round(min(vol_final), 6))
