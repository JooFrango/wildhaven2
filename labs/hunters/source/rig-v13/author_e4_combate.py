# E4, lote 2 — combate com espada no rig v13: combo de 3 golpes, carga (laço) e liberação (plano PvE §4 e §10).
#   blender -b labs/hunters/assets/hunter-rig-v13/hunter_rig_v13_source.blend --python labs/hunters/source/rig-v13/author_e4_combate.py -- <raiz>
# Roda depois de author_e4_locomocao.py.
#
# Método: cada golpe é uma lista de poses-chave (antecipação, início ativo, contato, fim ativo, continuação, volta). Cada
# pose sobrepõe a guarda só no que muda. As cadeias têm atraso próprio em torno da chave (a pelve 2 quadros antes, o
# antebraço 1 depois, a mão 2 depois, a cabeça 2 depois): o corpo lidera e a lâmina chega por último, em chicote.
# A direção da lâmina em cada pose é um alvo; pronação, flexão e desvio do punho são escolhidos dentro dos limites
# anatômicos. Pés plantados no mundo; o avanço do corpo vai para `rootMotion` (curva, eixo z) e o clipe sai em lugar.
# O contato não é digitado: é o quadro em que a lâmina chega mais longe à frente dentro da janela ativa (contrato §5).
import os, sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from e4_comum import *   # noqa: F401,F403
NATIVE_H = 1.70
BODY = next(o for o in bpy.data.objects if o.type == 'MESH' and o.find_armature() == arm)

# ---------- valores da guarda (iguais a key_guard(0)) e sobreposição ----------
GUARD = dict(hips=dict(x=0, back=.02, z=-.07, yaw=-22, lean=6, roll=0), spine=dict(yaw=12, lean=5, roll=0), neck=(6, -4), head=(5, -3),
             armR=dict(swing=GG['armR']['swing'], lower=GG['armR']['lower'], across=0, clav=GG['armR']['clav'], protr=0, elbow=GG['armR']['elbow'], pron=0, wflex=0, wdev=0),
             armL=dict(swing=GG['armL']['swing'], lower=GG['armL']['lower'], across=0, clav=GG['armL']['clav'], protr=0, elbow=GG['armL']['elbow'], pron=GG['armL']['pron']),
             feet={s: dict(fwd=v[0], side=v[1], yaw=v[2], lift=0, pitch=0) for s, v in GUARD_FEET.items()}, root=0.0,
             legs=dict(Lt=0, Lk=0, Rt=0, Rk=0))   # coxa e joelho em FK (só aparecem com o IK desligado)
def merge(base, over):
    out = {k: (dict(v) if isinstance(v, dict) else v) for k, v in base.items()}
    for k, v in over.items():
        if k == 'feet': out['feet'] = {s: {**base['feet'][s], **v.get(s, {})} for s in base['feet']}
        elif isinstance(v, dict) and isinstance(out.get(k), dict): out[k].update(v)
        else: out[k] = v
    return out

def bone_values(p):
    """Pose -> rotações (eixos do mundo, relativas ao pai) e posições de cada osso/controle (em lugar: sem a raiz)."""
    h = p['hips']; s_ = p['spine']; v = {}
    v['Hips'] = ('both', Vector((h['x'], h['back'], h['z'])), R(Z, h['yaw']) @ R(Y, h['roll']) @ R(X, h['lean']))
    for n, k in (('Spine02', .3), ('SpineMid', .35), ('Spine', .35)): v[n] = ('rot', R(Z, s_['yaw'] * k) @ R(Y, s_['roll'] * k) @ R(X, s_['lean'] * k))
    v['neck'] = ('rot', R(Z, p['neck'][0]) @ R(X, p['neck'][1])); v['Head'] = ('rot', R(Z, p['head'][0]) @ R(X, p['head'][1]))
    for s, sg in (('Left', 1), ('Right', -1)):
        A = p['armL' if s == 'Left' else 'armR']
        v[s + 'Shoulder'] = ('rot', R(Z, -sg * A['protr']) @ R(X, A['swing'] * .1) @ R(Y, -sg * A['clav']))
        v[s + 'Arm'] = ('rot', R(Z, sg * A['across']) @ R(X, A['swing']) @ R(Y, sg * A['lower']))
        v[s + 'ForeArm'] = ('rot', R(Z, -sg * A['elbow']))
        v[s + 'Hand'] = ('rot', hand_q(A) if s == 'Right' else R(X, A['pron']) @ R(Z, -12))
    lg = p['legs']
    for s, t_, k_ in (('Left', lg['Lt'], lg['Lk']), ('Right', lg['Rt'], lg['Rk'])):
        # eixo X do mundo: −t leva a coxa à frente (flexão do quadril); +k dobra o joelho para trás. O sinal invertido
        # (coxa para trás, joelho para a frente) foi a deformação apontada pelo diretor no primeiro rolamento.
        v[s + 'UpLeg'] = ('rot', R(X, -t_)); v[s + 'Leg'] = ('rot', R(X, k_))
    return v

GROUP = {'Hips': 'core', 'Spine02': 'core', 'SpineMid': 'core', 'Spine': 'core', 'neck': 'head', 'Head': 'head',
         'RightShoulder': 'arm', 'LeftShoulder': 'arm', 'RightArm': 'arm', 'LeftArm': 'arm', 'RightForeArm': 'fore', 'LeftForeArm': 'fore',
         'RightHand': 'hand', 'LeftHand': 'hand', 'LeftUpLeg': 'core', 'RightUpLeg': 'core', 'LeftLeg': 'core', 'RightLeg': 'core'}
OFF = {'core': -2, 'head': 2, 'arm': 0, 'fore': 1, 'hand': 2}

def set_direct(p):
    """Aplica a pose sem chavear (para medir a lâmina enquanto o punho é resolvido)."""
    for n, (kind, *val) in bone_values(p).items():
        pb = P[n]; pb.rotation_mode = 'QUATERNION'
        if kind == 'both': pb.location = B[n].matrix_local.to_quaternion().inverted() @ val[0]; pb.rotation_quaternion = basis(n, val[1])
        else: pb.rotation_quaternion = basis(n, val[0])
    bpy.context.view_layer.update()

WLIM = {'pron': (-85, 85), 'wflex': (-50, 50), 'wdev': (-30, 15)}   # caixa do punho da espada (dentro dos limites anatômicos, com margem)
def solve_blade(p, target, prev=None):
    """Punho da espada dentro da caixa WLIM que melhor aponta a lâmina; perto do punho da chave anterior (continuidade)."""
    arm.animation_data.action = None; set_direct(p); best = None; t = Vector(target).normalized()
    for pr in range(-85, 86, 10):
        for fl in range(-50, 51, 10):
            for dv in range(-30, 16, 5):
                A = {**p['armR'], 'pron': pr, 'wflex': fl, 'wdev': dv}
                P['RightHand'].rotation_quaternion = basis('RightHand', hand_q(A))
                e = socket_dir().normalized().angle(t) + math.radians(.04 * (abs(fl) + abs(dv)))
                if prev: e += math.radians(.15 * (abs(pr - prev[0]) + abs(fl - prev[1]) + abs(dv - prev[2])))
                if best is None or e < best[0]: best = (e, pr, fl, dv)
    p['armR'].update(pron=best[1], wflex=best[2], wdev=best[3])
    socket_err = socket_dir().normalized().angle(t)   # erro sem as penalidades (o que o diretor vê)
    P['RightHand'].rotation_quaternion = basis('RightHand', hand_q(p['armR'])); socket_err = socket_dir().normalized().angle(t)
    return math.degrees(socket_err)

def foot_world(keys, s, f, steps=None):
    """Pé no mundo no quadro f: plantado entre chaves; se a chave seguinte o move, faz um passo (arco e ponta).
    Com `steps` [(lado, início, fim, destino)], os passos têm tempo próprio, independente das poses-chave do corpo."""
    if steps:
        pos = dict(keys[0]['pose']['feet'][s]); prev_end = 0
        for (side, fa, fb, dest) in steps:
            if side != s: continue
            if f < fa: return pos, False
            if f <= fb:
                u = (f - fa) / max(1, fb - fa); k = smooth(u)
                out = {q: pos[q] + (dest.get(q, pos[q]) - pos[q]) * k for q in ('fwd', 'side', 'yaw')}
                out['lift'] = .09 * math.sin(math.pi * u); out['pitch'] = 12 * math.sin(math.pi * u); return out, (0 < u < 1)
            pos.update(dest)
        return pos, False
    ks = [(k['f'], k['pose']['feet'][s], k['pose'].get('stepLift', .09)) for k in keys]
    for (fa, a, _), (fb, b, lift) in zip(ks, ks[1:]):
        if fa <= f <= fb:
            moved = abs(a['fwd'] - b['fwd']) + abs(a['side'] - b['side']) > 1e-4
            if not moved: return a, False
            u = (f - fa) / max(1, fb - fa); k = smooth(u)
            out = {key: a[key] + (b[key] - a[key]) * k for key in ('fwd', 'side', 'yaw')}
            out['lift'] = lift * math.sin(math.pi * u); out['pitch'] = 12 * math.sin(math.pi * u); return out, (0 < u < 1)
    return ks[-1][1], False

# ---------- interpolação nos parâmetros da pose, quadro a quadro ----------
# Spline de Hermite com tangentes de Catmull-Rom (velocidade contínua; o corpo não para em cada chave). Primeira e última
# chave com tangente zero: o golpe sai da guarda e volta a ela em repouso. Cada cadeia usa os tempos das chaves com o seu
# atraso (OFF), exceto na primeira e na última chave.
PARAM_GROUP = {'hips': 'core', 'spine': 'core', 'neck': 'head', 'head': 'head', 'root': 'core', 'legs': 'core'}
ARM_GROUP = {'swing': 'arm', 'lower': 'arm', 'across': 'arm', 'clav': 'arm', 'protr': 'arm', 'elbow': 'fore', 'pron': 'hand', 'wflex': 'hand', 'wdev': 'hand'}
def flat(p):
    out = {}
    for k, v in p.items():
        if k in ('hips', 'spine', 'legs'): out.update({(k, q): x for q, x in v.items()})
        elif k in ('neck', 'head'): out.update({(k, i): x for i, x in enumerate(v)})
        elif k in ('armR', 'armL'): out.update({(k, q): x for q, x in v.items()})
        elif k == 'root': out[('root',)] = v
    return out
def unflat(vals, template):
    p = merge(template, {})
    for key, x in vals.items():
        if key[0] in ('neck', 'head'): t = list(p[key[0]]); t[key[1]] = x; p[key[0]] = tuple(t)
        elif key[0] == 'root': p['root'] = x
        else: p[key[0]][key[1]] = x
    return p
def group_of(key): return ARM_GROUP[key[1]] if key[0] in ('armR', 'armL') else PARAM_GROUP[key[0]]
def spline(ts, vs, t):
    if t <= ts[0]: return vs[0]
    if t >= ts[-1]: return vs[-1]
    i = max(j for j in range(len(ts) - 1) if ts[j] <= t)
    m = lambda j: 0.0 if j in (0, len(ts) - 1) else (vs[j + 1] - vs[j - 1]) / (ts[j + 1] - ts[j - 1])
    dt = ts[i + 1] - ts[i]; u = (t - ts[i]) / dt
    return hermite(vs[i], vs[i + 1], m(i) * dt, m(i + 1) * dt, u)
def pose_at(keys, f, N):
    fk = [flat(k['pose']) for k in keys]; vals = {}
    for key in fk[0]:
        off = OFF[group_of(key)]
        ts = [k['f'] if k['f'] in (0, N) else min(N - 1, max(1, k['f'] + off)) for k in keys]
        vals[key] = spline(ts, [x[key] for x in fk], f)
    for q, (lo, hi) in WLIM.items(): vals[('armR', q)] = min(hi, max(lo, vals[('armR', q)]))   # overshoot da spline nunca sai da caixa
    return unflat(vals, keys[0]['pose'])

def author(name, spec):
    N = spec['frames']; keys = []
    for f, over, blade in spec['keys']:
        p = merge(spec.get('base', GUARD), over); keys.append({'f': f, 'pose': p, 'blade': blade})
    err, prev = {}, None
    for k in keys:
        if k['blade']:
            err[k['f']] = round(solve_blade(k['pose'], k['blade'], prev), 1); a = k['pose']['armR']; prev = (a['pron'], a['wflex'], a['wdev'])
    if spec.get('holdWrist'):   # laço: a mão não muda entre as chaves
        w = {q: keys[0]['pose']['armR'][q] for q in ('pron', 'wflex', 'wdev')}
        for k in keys: k['pose']['armR'].update(w)
    act = bpy.data.actions.new(name); arm.animation_data.action = act
    curve = []
    for f in range(N + 1):
        p = pose_at(keys, f, N); r = p['root']; curve.append(round(r, 5)); fr = f + 1
        ik = 1.0
        if spec.get('ikOff'):   # (desliga de, até; religa de, até): o corpo no ar com as pernas encolhidas em FK
            a0, a1, b0, b1 = spec['ikOff']
            ik = 1 - smooth(min(1, max(0, (f - a0) / (a1 - a0)))) if f < b0 else smooth(min(1, max(0, (f - b0) / (b1 - b0))))
        for c_b, c_n in CONS: P[c_b].constraints[c_n].influence = ik; P[c_b].constraints[c_n].keyframe_insert('influence', frame=fr)
        ankles = {}; ax = spec.get('rootAxis', 'z')
        for s in SIDES:   # pé plantado no mundo = parado; em lugar ele recua com a raiz
            w, moving = foot_world(keys, s, f, spec.get('steps'))
            loc, q = (foot_pose(s, w['fwd'] - r, w['lift'], w['pitch'], None, w['side']) if ax == 'z'
                      else foot_pose(s, w['fwd'], w['lift'], w['pitch'], None, w['side'] - r)); q = R(Z, w['yaw']) @ q
            h0 = B['CTRL_foot.' + s].head_local; ankles[s] = h0 + loc + q @ (B['CTRL_ankle_ik.' + s].head_local - h0)
            key_loc('CTRL_foot.' + s, loc, fr); key_rot('CTRL_foot.' + s, q, fr); key_rot('CTRL_toe.' + s, Quaternion(), fr)
        h = p['hips']; need = []   # a pelve desce o que for preciso para as duas pernas alcançarem os pés (como na locomoção)
        for s in SIDES:
            hip = B[s + 'UpLeg'].head_local + Vector((h['x'], h['back'], 0)); a_ = ankles[s]; L = LEG[s] * .97   # 3% de folga: o joelho nunca trava reto
            hz = math.hypot(a_.x - hip.x, a_.y - hip.y)
            need.append(max(-.18, a_.z + math.sqrt(max(0, L * L - hz * hz)) - hip.z if hz < L else -.18))
        if ik >= 1: h['z'] = softmin([h['z'], *need])
        for n, (kind, *val) in bone_values(p).items():
            if kind == 'both': key_loc(n, val[0], fr); key_rot(n, val[1], fr)
            else: key_rot(n, val[0], fr)
        for s in SIDES: key_fingers(s, fr)
        key_socket({}, fr)
        gs = spec.get('groundSolve')
        if gs and gs[0] <= f <= gs[1]:
            for _ in range(2):
                bpy.context.scene.frame_set(fr); dg = bpy.context.evaluated_depsgraph_get(); ev = BODY.evaluated_get(dg); mm = ev.to_mesh()
                low = min((BODY.matrix_world @ v.co).z for v in mm.vertices); ev.to_mesh_clear()
                h['z'] -= low; kind, loc, rot = bone_values(p)['Hips']; key_loc('Hips', loc, fr)
    ph = spec['phases']
    act['contract'] = 'hunter-pve-v02'; act['module'] = spec['module']; act['weapon'] = 'sword'; act['loop'] = spec.get('loop', False)
    act['fps'] = FPS; act['duration'] = N / FPS; act['phases'] = {k: round(v / FPS, 4) for k, v in ph.items()}
    act['interrupts'] = [{**w, 'from': round(w['from'] / FPS, 4), 'to': round(w['to'] / FPS, 4)} for w in spec['interrupts']]
    contacts = {}
    for s in SIDES:
        iv, ini = [], None
        for f in range(N + 1):
            on = not foot_world(keys, s, f, spec.get('steps'))[1]
            if on and ini is None: ini = f
            if (not on or f == N) and ini is not None: iv.append([round(ini / FPS, 4), round((f if on else f - 1) / FPS, 4)]); ini = None
        contacts[s.lower()] = iv
    act['footContacts'] = contacts
    act['rootMotion'] = ({'mode': 'curve', 'axis': spec.get('rootAxis', 'z'), 'distanceM': curve[-1], 'units': 'metros nativos (altura 1,70 m)', 'curve': curve}
                         if abs(curve[-1]) > 1e-4 or max(map(abs, curve)) > 1e-4 else {'mode': 'none'})
    act['motion'] = 'in-place; o avanço do corpo está em rootMotion (a simulação aplica)'
    if spec.get('gateExceptions'): act['gateExceptions'] = spec['gateExceptions']
    act['bladeKeys'] = {str(k): v for k, v in err.items()}   # erro (graus) entre a lâmina e o alvo em cada pose
    if spec.get('startPose'): act['startPose'] = spec['startPose']
    act.use_fake_user = True
    print('CLIP', name, 'quadros', N, 'erro da lâmina por chave', err, 'raiz', curve[-1])
    return act

# ---------- golpes ----------
# Direções da lâmina no mundo Blender: X = esquerda do Hunter, −Y = frente, Z = cima.
ARM = lambda **k: {'armR': k}
L_ = lambda **k: {'armL': k}
def H(**k): return {'hips': k}
def S(**k): return {'spine': k}
FEET = lambda **k: {'feet': k}
CUT_IN = [{'from': 0, 'to': 6, 'into': ['dodge', 'block']}]

CLIPS = {
 # 1: corte diagonal descendente, do ombro direito ao quadril esquerdo, com meio passo do pé da frente.
 'pve2_c_sword_combo_1': dict(module='c', frames=48,
   phases=dict(guard=0, anticipation=10, activeStart=15, activeEnd=23, recovery=30, guardReturn=48),
   interrupts=CUT_IN + [{'from': 30, 'to': 48, 'into': ['dodge', 'block', 'combo_2']}],
   keys=[(0, {}, None),
         (10, {**H(yaw=-42, lean=4, z=-.10), **S(yaw=-14, lean=2), **ARM(swing=-150, lower=25, across=-10, clav=18, elbow=105), **L_(swing=-55, elbow=60)}, (-.3, .45, .84)),
         (15, {**H(yaw=-15, lean=8, z=-.11, back=.0), **S(yaw=-4, lean=5), **ARM(swing=-125, lower=30, across=5, clav=14, elbow=55), **L_(swing=-35, elbow=85),
               **FEET(Left=dict(fwd=.30)), 'root': .05}, (-.2, -.55, .8)),
         (19, {**H(yaw=8, lean=13, z=-.13, back=-.02), **S(yaw=10, lean=8), **ARM(swing=-75, lower=40, across=28, clav=6, elbow=6), **L_(swing=-15, elbow=95),
               **FEET(Left=dict(fwd=.30)), 'root': .11}, (.35, -.8, -.48)),
         (23, {**H(yaw=18, lean=15, z=-.13, back=-.02), **S(yaw=14, lean=9), **ARM(swing=-42, lower=48, across=45, clav=2, elbow=22), **L_(swing=0, elbow=90),
               **FEET(Left=dict(fwd=.30)), 'root': .13}, (.62, -.38, -.68)),
         (30, {**H(yaw=22, lean=14, z=-.12, back=-.01), **S(yaw=12, lean=9), **ARM(swing=-22, lower=58, across=55, clav=2, elbow=45), **L_(swing=5, elbow=85),
               **FEET(Left=dict(fwd=.30)), 'root': .13}, (.6, .2, -.77)),
         (40, {**H(yaw=-8, lean=9, z=-.09), **S(yaw=6, lean=6), **ARM(swing=-40, lower=50, across=15, clav=6, elbow=65), **FEET(Left=dict(fwd=.30)), 'root': .13}, (0, -.5, .85)),
         (48, {**FEET(Left=dict(fwd=.30), Right=dict(fwd=.0)), 'root': .13}, None)]),
 # 2: corte horizontal reverso (de costas da mão), da esquerda para a direita, pelve girando à frente da lâmina.
 'pve2_c_sword_combo_2': dict(module='c', frames=51,
   phases=dict(guard=0, anticipation=9, activeStart=13, activeEnd=21, recovery=27, guardReturn=51),
   interrupts=CUT_IN + [{'from': 27, 'to': 51, 'into': ['dodge', 'block', 'combo_3']}],
   keys=[(0, {}, None),
         (9, {**H(yaw=12, lean=7, z=-.10), **S(yaw=16, lean=4), **ARM(swing=-70, lower=60, across=70, clav=6, protr=10, elbow=95), **L_(swing=-20, elbow=100)}, (.8, .45, .1)),
         (13, {**H(yaw=0, lean=8, z=-.11), **S(yaw=8, lean=5), **ARM(swing=-78, lower=58, across=38, clav=6, protr=8, elbow=50), **L_(swing=-10, elbow=95), **FEET(Left=dict(fwd=.25)), 'root': .03}, (.72, -.68, .05)),
         (17, {**H(yaw=-26, lean=9, z=-.12), **S(yaw=-10, lean=5), **ARM(swing=-86, lower=55, across=-8, clav=4, elbow=12), **L_(swing=10, elbow=80), **FEET(Left=dict(fwd=.25)), 'root': .07}, (-.25, -.97, .02)),
         (21, {**H(yaw=-42, lean=8, z=-.12), **S(yaw=-16, lean=5), **ARM(swing=-72, lower=55, across=-42, clav=4, elbow=20), **L_(swing=20, elbow=75), **FEET(Left=dict(fwd=.25)), 'root': .08}, (-.85, -.48, .05)),
         (27, {**H(yaw=-46, lean=8, z=-.11), **S(yaw=-18, lean=5), **ARM(swing=-52, lower=58, across=-62, clav=4, elbow=42), **L_(swing=15, elbow=80), **FEET(Left=dict(fwd=.25)), 'root': .08}, (-.8, .5, .1)),
         (38, {**H(yaw=-28, lean=7, z=-.09), **S(yaw=4, lean=5), **ARM(swing=-45, lower=52, across=-15, clav=6, elbow=65), **FEET(Left=dict(fwd=.25)), 'root': .08}, (0, -.5, .85)),
         (51, {**FEET(Left=dict(fwd=.25), Right=dict(fwd=-.05)), 'root': .08}, None)]),
 # 3: corte ascendente com passo longo: o corpo afunda, a perna da frente avança, e a lâmina sobe da direita baixa ao alto.
 'pve2_c_sword_combo_3': dict(module='c', frames=66,
   phases=dict(guard=0, anticipation=14, activeStart=20, activeEnd=28, recovery=36, guardReturn=66),
   steps=[('Left', 6, 14, dict(fwd=.60)), ('Right', 14, 23, dict(fwd=.30))],
   interrupts=CUT_IN + [{'from': 40, 'to': 66, 'into': ['dodge', 'block', 'combo_1']}],
   keys=[(0, {}, None),
         (8, {**H(yaw=-34, lean=14, z=-.14), **S(yaw=-10, lean=6), **ARM(swing=-12, lower=58, across=-32, clav=4, elbow=30), **L_(swing=-40, elbow=70), 'root': .06}, (-.6, .35, -.72)),
         (14, {**H(yaw=-30, lean=16, z=-.17, back=-.03), **S(yaw=-12, lean=7), **ARM(swing=14, lower=58, across=-34, clav=4, elbow=22), **L_(swing=-50, elbow=60),
               **FEET(Left=dict(fwd=.60)), 'root': .14}, (-.5, .5, -.7)),
         (20, {**H(yaw=-12, lean=11, z=-.13, back=-.03), **S(yaw=-4, lean=6), **ARM(swing=-40, lower=62, across=0, clav=6, elbow=15), **L_(swing=-20, elbow=80),
               **FEET(Left=dict(fwd=.60)), 'root': .30}, (-.2, -.6, -.77)),
         (24, {**H(yaw=4, lean=3, z=-.07, back=-.02), **S(yaw=4, lean=2), **ARM(swing=-108, lower=40, across=18, clav=14, elbow=10), **L_(swing=10, elbow=90),
               **FEET(Left=dict(fwd=.60)), 'root': .38}, (.3, -.52, .8)),
         (28, {**H(yaw=10, lean=-3, z=-.04, back=-.01), **S(yaw=8, lean=-4), **ARM(swing=-150, lower=25, across=22, clav=20, elbow=20), **L_(swing=20, elbow=95),
               **FEET(Left=dict(fwd=.60)), 'root': .43}, (.2, .2, .96)),
         (36, {**H(yaw=8, lean=-2, z=-.05), **S(yaw=6, lean=-3), **ARM(swing=-155, lower=22, across=15, clav=20, elbow=50), **L_(swing=10, elbow=95),
               **FEET(Left=dict(fwd=.60), Right=dict(fwd=.30)), 'root': .43}, (.1, .5, .86)),
         (50, {**H(yaw=-18, lean=7, z=-.08), **S(yaw=8, lean=5), **ARM(swing=-60, lower=48, across=8, clav=8, elbow=70), **FEET(Left=dict(fwd=.60), Right=dict(fwd=.30)), 'root': .43}, (0, -.5, .85)),
         (66, {**FEET(Left=dict(fwd=.60), Right=dict(fwd=.30)), 'root': .43}, None)]),
}
# Carga: base larga e baixa, lâmina sobre o ombro direito apontando para trás, mão livre mirando. Laço de 1 s com tremor
# de esforço. A liberação parte EXATAMENTE dessa pose (exceção à costura com a guarda, como a corrida e a recuperação).
CHARGE = merge(GUARD, {**H(yaw=-46, lean=9, z=-.15, back=.03), **S(yaw=-20, lean=4), 'neck': (14, -6), 'head': (10, -4),
                       **ARM(swing=-128, lower=30, across=-6, clav=20, protr=-6, elbow=112), **L_(swing=-75, lower=40, elbow=28, pron=10),
                       **FEET(Left=dict(fwd=.32, side=.07, yaw=-12), Right=dict(fwd=-.27, side=-.06, yaw=-38))})
CLIPS['pve2_c_sword_charge_loop'] = dict(module='c', frames=60, loop=True, base=CHARGE, holdWrist=True,
   phases=dict(guard=0, guardReturn=60), interrupts=[{'from': 0, 'to': 60, 'into': ['charge_release', 'dodge', 'block']}],
   keys=[(0, {}, (-.2, .76, -.3))] + [(f, {**H(z=-.15 + .006 * math.sin(math.pi * f / 15)), **S(yaw=-20 + 1.2 * math.sin(math.pi * f / 15), lean=4 + .8 * math.sin(math.pi * f / 10))}, None)
                                       for f in (10, 20, 30, 40, 50)] + [(60, {}, None)])
CLIPS['pve2_c_sword_charge_release'] = dict(module='c', frames=72, base=CHARGE, startPose='pve2_c_sword_charge_loop',
   steps=[('Left', 0, 6, dict(fwd=.68, side=.04, yaw=-10)), ('Right', 4, 11, dict(fwd=.38, side=-.03, yaw=-28))],   # salto curto de 2 quadros: estocada explosiva
   phases=dict(guard=0, anticipation=2, activeStart=6, activeEnd=14, recovery=24, guardReturn=72),
   interrupts=[{'from': 44, 'to': 72, 'into': ['dodge', 'block', 'combo_1']}],
   keys=[(0, {}, (-.2, .76, -.3)),
         (6, {**H(yaw=-24, lean=14, z=-.15), **S(yaw=-8, lean=8), **ARM(swing=-152, lower=22, across=0, clav=22, protr=0, elbow=55), **L_(swing=-40, elbow=50),
              **FEET(Left=dict(fwd=.68, side=.04, yaw=-10)), 'root': .10}, (-.1, -.3, .95)),
         (10, {**H(yaw=-4, lean=22, z=-.17, back=-.05), **S(yaw=0, lean=10), **ARM(swing=-62, lower=38, across=6, clav=8, elbow=10), **L_(swing=0, elbow=85),
               **FEET(Left=dict(fwd=.68, side=.04, yaw=-10)), 'root': .30}, (0, -.9, -.42)),
         (14, {**H(yaw=0, lean=24, z=-.18, back=-.05), **S(yaw=2, lean=12), **ARM(swing=-34, lower=45, across=6, clav=4, elbow=15), **L_(swing=10, elbow=85),
               **FEET(Left=dict(fwd=.68, side=.04, yaw=-10)), 'root': .38}, (.05, -.75, -.65)),
         (24, {**H(yaw=0, lean=24, z=-.18, back=-.05), **S(yaw=2, lean=12), **ARM(swing=-22, lower=50, across=6, clav=2, elbow=24), **L_(swing=15, elbow=80),
               **FEET(Left=dict(fwd=.68, side=.04, yaw=-10), Right=dict(fwd=.38, side=-.03, yaw=-28)), 'root': .45}, (.25, -.75, -.6)),
         (44, {**H(yaw=-14, lean=13, z=-.13), **S(yaw=4, lean=7), **ARM(swing=-38, lower=50, across=4, clav=6, elbow=60), **L_(swing=-25, elbow=90),
               **FEET(Left=dict(fwd=.68, side=.04, yaw=-10), Right=dict(fwd=.38, side=-.03, yaw=-28)), 'root': .51}, (0, -.6, .8)),
         (72, {'hips': GUARD['hips'], 'spine': GUARD['spine'], 'neck': GUARD['neck'], 'head': GUARD['head'],
               'armR': GUARD['armR'], 'armL': GUARD['armL'], **FEET(Left=dict(fwd=.68, side=.04, yaw=-10), Right=dict(fwd=.38, side=-.03, yaw=-28)), 'root': .51}, None)])

def roll(sg):
    """sg = +1: rolamento para a esquerda (+X); -1: para a direita. 0,9 s, 1,3 m de deslocamento lateral.
    Mergulho com rolamento (revisão do diretor: a primeira versão deformava o corpo). As mãos tocam o chão à frente,
    abrem para os lados quando o corpo inverte e nunca passam pelo rosto. Encolhimento dentro do que a malha do corpo base
    aguenta, medido pelos portões de deformação: quadril até 70°, joelho até 94°, coluna 28°, pescoço e cabeça 42°."""
    D = 1.30 * sg; yaw = 68 * sg; tuck = dict(Lt=70, Lk=92, Rt=70, Rk=94)
    arms = lambda swing, lower, elbow: dict(armR=dict(swing=swing, lower=lower, across=0, clav=4, elbow=elbow), armL=dict(swing=swing, lower=lower, elbow=elbow))
    return dict(module='b', frames=54, rootAxis='x', ikOff=(8, 11, 27, 31), groundSolve=(9, 29), gateExceptions=['folgaLaminaM', 'pontaAcimaDoChaoM'],
      phases=dict(guard=0, takeoff=8, groundContact=16, landing=30, recoverable=38, guardReturn=54),
      interrupts=[{'from': 38, 'to': 54, 'into': ['dodge', 'block', 'combo_1', 'charge']}],
      # na aterrissagem o corpo olha para o lado (±X): o lado esquerdo dele é +Y no rolamento esquerdo e −Y no direito
      steps=[('Left', 4, 32, dict(fwd=-.09 * sg, side=D + .10 * sg, yaw=yaw - 15)), ('Right', 5, 33, dict(fwd=.09 * sg, side=D - .10 * sg, yaw=yaw - 25)),
             ('Left', 40, 48, dict(fwd=.17, side=D + .04, yaw=-10)), ('Right', 42, 51, dict(fwd=-.13, side=D - .03, yaw=-28))],
      keys=[(0, {}, None),
            # agacha e estende os braços para a frente: as mãos vão buscar o chão
            (6, {'hips': dict(x=0, back=0, z=-.17, yaw=yaw * .6, lean=22, roll=0), 'spine': dict(yaw=0, lean=15, roll=0), 'neck': (0, 10), 'head': (0, 5),
                 **arms(-70, 45, 30), 'root': .06 * sg}, None),
            # mergulho: mãos no chão à frente, pernas empurram
            (10, {'hips': dict(x=0, back=0, z=-.22, yaw=yaw, lean=70, roll=0), 'spine': dict(yaw=0, lean=20, roll=0), 'neck': (0, 25), 'head': (0, 10),
                  **arms(-95, 40, 15), 'legs': dict(Lt=30, Lk=25, Rt=15, Rk=10), 'root': .32 * sg}, None),
            # ombro no chão: queixo no peito, braços abrem para os lados
            (16, {'hips': dict(x=0, back=0, z=-.42, yaw=yaw, lean=160, roll=0), 'spine': dict(yaw=0, lean=34, roll=0), 'neck': (0, 40), 'head': (0, 16),
                  **arms(-40, 15, 45), 'legs': tuck, 'root': .66 * sg}, None),
            # de costas: as mãos vão para os joelhos, longe da cabeça
            (22, {'hips': dict(x=0, back=0, z=-.47, yaw=yaw, lean=250, roll=0), 'spine': dict(yaw=0, lean=26, roll=0), 'neck': (0, 32), 'head': (0, 12),
                  **arms(-50, 40, 45), 'legs': tuck, 'root': .96 * sg}, None),
            # pés no chão: braços à frente para equilibrar
            (29, {'hips': dict(x=0, back=0, z=-.27, yaw=yaw, lean=335, roll=0), 'spine': dict(yaw=0, lean=18, roll=0), 'neck': (0, 12), 'head': (0, 6),
                  **arms(-60, 45, 50), 'legs': dict(Lt=75, Lk=95, Rt=78, Rk=98), 'root': 1.18 * sg}, None),
            (38, {'hips': dict(x=0, back=0, z=-.16, yaw=yaw * .7, lean=378, roll=0), 'spine': dict(yaw=0, lean=10, roll=0), 'neck': (0, -2), 'head': (0, -2),
                  **arms(-45, 50, 80), 'root': 1.28 * sg}, None),
            (54, {'hips': {**GUARD['hips'], 'lean': GUARD['hips']['lean'] + 360}, 'root': D}, None)])
CLIPS['pve2_b_sword_roll_left'] = roll(1); CLIPS['pve2_b_sword_roll_right'] = roll(-1)
made = [author(n, c) for n, c in CLIPS.items()]
st = bpy.data.actions['rig13_stress']; arm.animation_data.action = st
bpy.context.scene['e4_combate'] = [a.name for a in made]
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'hunter_rig_v13_source.blend'))
print('COMBATE_OK', [a.name for a in made])
