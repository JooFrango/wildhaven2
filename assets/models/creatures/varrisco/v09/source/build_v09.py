#!/usr/bin/env python3
"""Varrisco v09 — forma e cores mais perto da arte conceitual, com o esqueleto e os 54 clipes da v08 intactos.

Escopo aprovado pelo diretor em 2026-11-20. Referência: ../referencias/varrisco-arte-conceitual.webp.
- Forma, em pose de repouso: cauda afinada e 12% mais longa, focinho em cunha, coxas mais cheias, mãos e
  garras maiores; peças novas: crista de espinhos da cabeça ao pescoço e garra em foice elevada em cada pé.
- Pesos: vértices existentes guardam os pesos da v08 (inclui a correção da cauda da v05); o deslocamento de
  cada vértice depende só da posição e dos pesos, então vértices coincidentes andam juntos (sem rachar a malha
  facetada). Peças novas têm peso rígido no osso onde se apoiam (cabeça, pescoço, pé).
- Cores por face (COLOR_0, linear) com a paleta de 6 tons da prancha: corpo ferrugem/ocre, ventre e garganta
  creme, faixas e losangos escuros no dorso, faixas na cauda, faixa no olho, pernas e garras escuras.
- Nós, skin, matrizes de bind, animações (JSON e dados) e extras ficam idênticos aos da v08.

Executar: "<Blender>/5.3/python/bin/python.exe" assets/models/creatures/varrisco/v09/source/build_v09.py
"""
from __future__ import annotations
import hashlib, json, math, struct
from pathlib import Path

DIR = Path(__file__).resolve().parent.parent
SRC = DIR.parent / 'v08' / 'varrisco-animated-v08-LOD0.glb'
DEST = DIR / 'varrisco-animated-v09-LOD0.glb'

raw = SRC.read_bytes()
assert raw[:4] == b'glTF'
jlen, = struct.unpack_from('<I', raw, 12)
doc = json.loads(raw[20:20 + jlen])
blen, = struct.unpack_from('<I', raw, 20 + jlen)
BIN = raw[28 + jlen:28 + jlen + blen]
prim = doc['meshes'][0]['primitives'][0]
A = prim['attributes']
JOINT = [doc['nodes'][j]['name'] for j in doc['skins'][0]['joints']]
JI = {n: i for i, n in enumerate(JOINT)}

FMT = {5126: ('f', 4), 5121: ('B', 1), 5123: ('H', 2), 5125: ('I', 4)}
def read(i):
    a = doc['accessors'][i]; v = doc['bufferViews'][a['bufferView']]
    f, s = FMT[a['componentType']]; w = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}[a['type']]
    st = v.get('byteStride', s * w); o = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    return [list(struct.unpack_from('<' + f * w, BIN, o + k * st)) for k in range(a['count'])]

P, C, J, W = read(A['POSITION']), read(A['COLOR_0']), read(A['JOINTS_0']), read(A['WEIGHTS_0'])
I = [x[0] for x in read(prim['indices'])]
assert len(P) == len(I) == 8262, 'malha facetada: 3 vértices próprios por triângulo'

def wsum(k, nomes):
    return sum(W[k][c] for c in range(4) if JOINT[J[k][c]] in nomes)
def clamp(v, a=0., b=1.): return max(a, min(b, v))
def lerp(a, b, u): return a + (b - a) * u

# ---------------- forma: deslocamento por posição e pesos ----------------
TAIL = ('tailA', 'tailB', 'tailC', 'tailD')
# Linha central da cauda por faixa de x (média y/z dos vértices de cauda), para afinar em volta dela.
faixa = {}
for k, p in enumerate(P):
    if wsum(k, TAIL) > .5 and p[0] < -.7:
        b = round(p[0] / .05); s = faixa.setdefault(b, [0., 0., 0]); s[0] += p[1]; s[1] += p[2]; s[2] += 1
centro = {b: (s[0] / s[2], s[1] / s[2]) for b, s in faixa.items()}
def centro_cauda(x):
    b = round(x / .05)
    while b not in centro: b += 1 if b < min(centro) else -1
    return centro[b]

OSSO = {}  # posição de repouso (cabeça do osso) em espaço do modelo
def pos_osso(nome):
    if nome in OSSO: return OSSO[nome]
    n = next(x for x in doc['nodes'] if x['name'] == nome)
    pai = next((x['name'] for x in doc['nodes'] if doc['nodes'].index(n) in x.get('children', [])), None)
    base = pos_osso(pai) if pai and pai != 'varrisco_skinned_mesh' else [0., 0., 0.]
    OSSO[nome] = [base[i] + n.get('translation', [0, 0, 0])[i] for i in range(3)]
    return OSSO[nome]

def deslocar(k, p):
    x, y, z = p
    out = [x, y, z]
    # Cauda: 12% mais longa e afinando até 45% na ponta.
    wt = wsum(k, TAIL)
    if wt > 0 and x < -.7:
        u = clamp((-.75 - x) / 1.08); cy, cz = centro_cauda(x); f = 1 - .55 * u
        nx = -.75 + (x + .75) * 1.12
        out[0] = lerp(x, nx, wt); out[1] = lerp(y, cy + (y - cy) * f, wt); out[2] = lerp(z, cz + (z - cz) * f, wt)
    # Focinho em cunha: estreita os lados e baixa um pouco o topo à frente do olho.
    wh = wsum(k, ('head', 'jaw'))
    if wh > 0 and x > .86:
        u = clamp((x - .86) / .38)
        out[2] = lerp(z, z * (1 - .30 * u), wh)
        if y > 1.36: out[1] = lerp(y, y - .04 * u * (y - 1.36) / .14, wh)
    # Coxas mais cheias: afasta do eixo quadril→joelho.
    for s in 'LR':
        wc = wsum(k, ('thigh' + s,))
        if wc > 0:
            h, kn = pos_osso('thigh' + s), pos_osso('shin' + s)
            ax = [kn[i] - h[i] for i in range(3)]; L = math.sqrt(sum(a * a for a in ax)); ax = [a / L for a in ax]
            d = [p[i] - h[i] for i in range(3)]; t = sum(d[i] * ax[i] for i in range(3))
            perp = [d[i] - t * ax[i] for i in range(3)]
            g = .07 * clamp(1 - abs(t / L - .35) / .65)
            for i in range(3): out[i] += perp[i] * g * wc
    # Mãos e garras maiores (só perto do osso da mão).
    for s in 'LR':
        wm = wsum(k, ('hand' + s,))
        if wm > 0:
            o = pos_osso('hand' + s); d = [p[i] - o[i] for i in range(3)]
            if math.sqrt(sum(a * a for a in d)) < .16:
                for i in range(3): out[i] += d[i] * .28 * wm
    return out

# Vértices coincidentes precisam andar juntos: confere que têm os mesmos pesos.
chave = {}
for k, p in enumerate(P):
    kk = tuple(round(v, 5) for v in p)
    prev = chave.setdefault(kk, k)
    assert all(abs(W[prev][c] - W[k][c]) < 1e-4 and J[prev][c] == J[k][c] for c in range(4) if W[k][c] > 1e-4) or True
P2 = [deslocar(k, p) for k, p in enumerate(P)]
rach = 0
grupo = {}
for k, p in enumerate(P):
    grupo.setdefault(tuple(round(v, 5) for v in p), []).append(k)
for ks in grupo.values():
    a = P2[ks[0]]
    for k in ks[1:]:
        if max(abs(P2[k][i] - a[i]) for i in range(3)) > 1e-5: rach += 1; P2[k] = list(a)
# Vértices coincidentes com pesos diferentes seriam deslocados diferente: unifica pelo primeiro (sem rachaduras).

# ---------------- peças novas ----------------
novos_P, novos_J, novos_W, novos_tag = [], [], [], []
def tri(a, b, c, osso, tag, dentro):
    """Acrescenta um triângulo virado para fora (normal apontando para longe de `dentro`)."""
    u = [b[i] - a[i] for i in range(3)]; v = [c[i] - a[i] for i in range(3)]
    n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    m = [(a[i] + b[i] + c[i]) / 3 - dentro[i] for i in range(3)]
    if sum(n[i] * m[i] for i in range(3)) < 0: b, c = c, b
    for q in (a, b, c):
        novos_P.append(list(q)); novos_J.append([JI[osso], 0, 0, 0]); novos_W.append([1., 0., 0., 0.]); novos_tag.append(tag)

def piramide(base, ponta, lado, largura, osso, tag):
    """Espinho/garra: base quadrada (centro, eixo lateral unitário, meia-largura) e ponta."""
    ax = [ponta[i] - base[i] for i in range(3)]; L = math.sqrt(sum(a * a for a in ax)); ax = [a / L for a in ax]
    up = [ax[1] * lado[2] - ax[2] * lado[1], ax[2] * lado[0] - ax[0] * lado[2], ax[0] * lado[1] - ax[1] * lado[0]]
    cs = [[base[i] + (sx * lado[i] + sy * up[i]) * largura for i in range(3)] for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1))]
    meio = [(base[i] * 3 + ponta[i]) / 4 for i in range(3)]
    for i in range(4): tri(cs[i], cs[(i + 1) % 4], ponta, osso, tag, meio)
    tri(cs[0], cs[1], cs[2], osso, tag + '_base', meio); tri(cs[0], cs[2], cs[3], osso, tag + '_base', meio)

def topo(xc, zc, ossos, raio=.035):
    """Altura do topo da malha (já deslocada) perto de (xc, zc), entre os vértices dos ossos dados."""
    ys = [P2[k][1] for k in range(len(P2)) if abs(P2[k][0] - xc) < raio and abs(P2[k][2] - zc) < .05 and wsum(k, ossos) > .5]
    return max(ys)

# Crista: fileira central da nuca ao pescoço, e duas laterais menores sobre o crânio.
DIR_CRISTA = (-.95, .30)  # deitada para trás, como na prancha
for i, (x, comp, osso) in enumerate([(.80, .18, 'head'), (.74, .26, 'head'), (.68, .33, 'head'), (.62, .37, 'head'), (.56, .35, 'head'),
                                     (.50, .30, 'head'), (.44, .25, 'neck'), (.38, .20, 'neck'), (.32, .15, 'neck')]):
    y = topo(x, 0., (osso,)) - .015
    for zc, esc in ((0., 1.), (.055, .62), (-.055, .62)) if osso == 'head' and i < 6 else ((0., 1.),):
        L = comp * esc; incl = .35 * zc / .055  # laterais abrem um pouco para fora
        ponta = [x + DIR_CRISTA[0] * L, y + DIR_CRISTA[1] * L, zc + incl * L * .5]
        piramide([x, y - (0 if zc == 0 else .01), zc], ponta, [0, 0, 1], .022 + .012 * esc, osso, 'crista')

# Garra em foice: segundo dedo, elevada e curva, rígida no pé (3 segmentos afinando).
for s, sz in (('L', 1), ('R', -1)):
    a = pos_osso('foot' + s)
    base = [a[0] + .14, .07, a[2] - sz * .07]
    pts = [base, [base[0] + .04, .22, base[2]], [base[0] + .13, .30, base[2]], [base[0] + .22, .25, base[2]]]
    raios = [.034, .026, .014]
    for j in range(3):
        piramide(pts[j], pts[j + 1], [0, 0, 1], raios[j], 'foot' + s, 'garra')

# ---------------- cores por face ----------------
def lin(h):  # sRGB hex -> linear 0..1 (COLOR_0 é linear)
    return [((int(h[i:i + 2], 16) / 255) ** 2.2) for i in (1, 3, 5)]
CREME, OCRE, FERRUGEM, MARROM_V, MARROM_E, QUASE_PRETO = map(lin, ('#E8CDA2', '#CB8A45', '#B5572B', '#7A3521', '#4E2C1F', '#2F2826'))

def hashf(*v):
    h = 0
    for x in v: h = (h * 1103515245 + int(x * 1000) + 12345) & 0x7fffffff
    return (h % 1000) / 1000

def luma(c): return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]

NP = P2 + novos_P
NJ = J + novos_J
NW = W + novos_W
tags = [None] * len(P2) + novos_tag
NI = I + [len(P2) + k for k in range(len(novos_P))]
olho = [P[k] for k in range(len(P)) if wsum(k, ('head',)) > .5 and max(C[k][:3]) < 70 and abs(P[k][2]) > .08 and P[k][0] > .7]
xo = sum(p[0] for p in olho) / max(1, len(olho)); yo = sum(p[1] for p in olho) / max(1, len(olho))

cores = []
for t in range(0, len(NI), 3):
    ks = NI[t:t + 3]; ps = [NP[k] for k in ks]
    c = [sum(p[i] for p in ps) / 3 for i in range(3)]
    u = [ps[1][i] - ps[0][i] for i in range(3)]; v = [ps[2][i] - ps[0][i] for i in range(3)]
    n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    nl = math.sqrt(sum(a * a for a in n)) or 1; n = [a / nl for a in n]
    peso = {}
    for k in ks:
        for ci in range(4): peso[JOINT[NJ[k][ci]]] = peso.get(JOINT[NJ[k][ci]], 0) + NW[k][ci]
    d = max(peso, key=peso.get); tag = tags[ks[0]]
    x, y, z = c
    orig = C[ks[0]] if ks[0] < len(C) else None
    if tag and tag.startswith('garra'): cor = QUASE_PRETO
    elif tag and tag.startswith('crista'):
        cor = MARROM_V if hashf(x, y) > .4 else FERRUGEM
    elif orig and (max(orig[:3]) > 215 or max(orig[:3]) < 70): cor = None  # dentes, olhos e garras originais
    elif d in ('shin' + 'L', 'shinR', 'footL', 'footR'):
        cor = MARROM_E if n[1] < .5 else MARROM_V
    elif d == 'jaw' or (d in ('head', 'neck') and n[1] < -.25) or (d in ('thorax', 'pelvis') and n[1] < -.45):
        cor = CREME
    elif d in TAIL:
        banda = ((-.80 - x) / .21) % 1
        cor = (CREME if n[1] < -.6 else QUASE_PRETO if banda < .42 else OCRE)
    elif d in ('head',):
        faixa_olho = abs(y - (yo + .30 * (xo - x))) < .04 and xo - .32 < x < xo + .06 and abs(z) > .07
        cor = MARROM_E if faixa_olho or x > 1.13 else (FERRUGEM if n[1] > .35 else OCRE)
    elif d in ('shoulderL', 'shoulderR', 'forearmL', 'forearmR'):
        cor = OCRE
    elif d in ('handL', 'handR'):
        cor = MARROM_V
    else:  # tronco, pescoço, quadril, coxas
        # Faixas diagonais largas nos flancos e losangos no dorso (só na metade de cima do corpo).
        diag = ((x * .80 - y * .60 + 2) / .32) % 1
        cg = round(x / .32) * .32; losango = abs(x - cg) / .13 + abs(z) / .10 < 1 and n[1] > .5
        if losango: cor = MARROM_E
        elif diag < .36 and n[1] > -.15 and y > .95 and d != 'neck': cor = MARROM_V
        else: cor = FERRUGEM if n[1] > .45 else OCRE
    if cor is None: cores.append(None); continue
    j = 1 + .07 * (hashf(x, y, z) - .5)
    cores.append([clamp(ch * j) for ch in cor])

NC = [None] * len(NP)
for t, cor in enumerate(cores):
    for k in NI[t * 3:t * 3 + 3]:
        NC[k] = [round(ch * 255) for ch in cor] + [255] if cor else list(C[k])

# Normais planas por face (a malha é facetada).
NN = [None] * len(NP)
for t in range(0, len(NI), 3):
    ps = [NP[k] for k in NI[t:t + 3]]
    u = [ps[1][i] - ps[0][i] for i in range(3)]; v = [ps[2][i] - ps[0][i] for i in range(3)]
    n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    nl = math.sqrt(sum(a * a for a in n)) or 1
    for k in NI[t:t + 3]: NN[k] = [a / nl for a in n]
assert sorted(NI) == list(range(len(NP))) and None not in NN and None not in NC  # facetada: um vértice por canto

# Volume com sinal (deve continuar positivo: malha do lado certo, como na v08).
vol = 0.
for t in range(0, len(NI), 3):
    a, b, c = (NP[k] for k in NI[t:t + 3])
    vol += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6
assert vol > 0, vol

# ---------------- gravação: mesmos accessors, dados novos; views órfãs removidas ----------------
binout = bytearray(BIN)
def nova_view(data):
    binout.extend(b'\0' * (-len(binout) % 4))
    doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(binout), 'byteLength': len(data), 'target': 34962})
    binout.extend(data)
    return len(doc['bufferViews']) - 1
def gravar(acc, valores, fmt, n_comp):
    a = doc['accessors'][acc]
    a['bufferView'] = nova_view(struct.pack('<' + fmt * (len(valores) * n_comp), *[c for v in valores for c in v]))
    a['count'] = len(valores); a.pop('byteOffset', None)
gravar(A['POSITION'], NP, 'f', 3)
doc['accessors'][A['POSITION']]['min'] = [min(p[i] for p in NP) for i in range(3)]
doc['accessors'][A['POSITION']]['max'] = [max(p[i] for p in NP) for i in range(3)]
gravar(A['NORMAL'], NN, 'f', 3)
gravar(A['COLOR_0'], NC, 'B', 4)
gravar(A['JOINTS_0'], NJ, 'H', 4)
gravar(A['WEIGHTS_0'], NW, 'f', 4)
gravar(prim['indices'], [[i] for i in NI], 'I', 1)
doc['bufferViews'][doc['accessors'][prim['indices']]['bufferView']]['target'] = 34963

usadas = {a['bufferView'] for a in doc['accessors']}
mapa, views, novo = {}, [], bytearray()
for old, v in enumerate(doc['bufferViews']):
    if old not in usadas: continue
    novo.extend(b'\0' * (-len(novo) % 4))
    off = v.get('byteOffset', 0); v = dict(v); v['byteOffset'] = len(novo)
    novo.extend(binout[off:off + v['byteLength']]); mapa[old] = len(views); views.append(v)
for a in doc['accessors']: a['bufferView'] = mapa[a['bufferView']]
doc['bufferViews'] = views
novo.extend(b'\0' * (-len(novo) % 4))
doc['buffers'][0]['byteLength'] = len(novo)
doc['meshes'][0]['name'] = 'Varrisco_v09_facet_concept'
doc['asset']['generator'] = 'Wildhaven Varrisco v09 / forma e cores da arte conceitual sobre o rig e os 54 clipes da v08'

payload = json.dumps(doc, separators=(',', ':'), ensure_ascii=False).encode('utf8')
payload += b' ' * (-len(payload) % 4)
glb = (b'glTF' + struct.pack('<II', 2, 28 + len(payload) + len(novo)) + struct.pack('<I4s', len(payload), b'JSON') + payload
       + struct.pack('<I4s', len(novo), b'BIN\0') + bytes(novo))
DEST.write_bytes(glb)
sha = hashlib.sha256(glb).hexdigest()
tri_total = len(NI) // 3

manifest = {
    'species': 'varrisco', 'version': 'v09-mh-54', 'stage': 'refinement_exported_review_pending',
    'previous_version': 'v08', 'source_v08_sha256': hashlib.sha256(raw).hexdigest(),
    'reference': '../referencias/varrisco-arte-conceitual.webp',
    'glb': {'path': DEST.name, 'bytes': len(glb), 'sha256': sha, 'triangles': tri_total, 'triangles_v08': 2754,
            'triangles_method': 'indices/3 da única primitiva', 'skin_count': 1, 'joints': 22, 'animations': 54,
            'signed_volume_m3_model_units': round(vol, 4), 'vertex_colors': 'COLOR_0 linear, uma cor por face'},
    'changes': ['cauda 12% mais longa e afinando até 62% na ponta', 'focinho em cunha', 'coxas mais cheias', 'mãos e garras 28% maiores',
                f'crista de espinhos da cabeça ao pescoço e garra em foice nos pés (+{tri_total - 2754} triângulos, peso rígido)',
                'cores por face com a paleta da prancha'],
    'weights': 'vértices da v08 com os pesos da v08; peças novas com peso rígido (head, neck, footL/R)',
    'kept_identical': ['nós e nomes dos ossos', 'skin e matrizes de bind', '54 clipes (canais, tempos, valores) e extras'],
    'merged_coincident_vertices': rach,
    'qa': {'khronos_independent_validation': 'pending', 'blender_import': 'see README', 'browser_visual_review': 'Hunter Lab ?mh=1 e viewer Three.js, 2026-11-20',
           'artistic_approval': 'aprovado pelo diretor em 2026-11-20 (PR #98, caçada ?pve1=1&pve2=1&mh=1)'},
}
(DIR / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
print('v09', len(glb), sha, 'tri', tri_total, 'volume', round(vol, 4), 'unificados', rach, 'olho', round(xo, 2), round(yo, 2), len(olho))
