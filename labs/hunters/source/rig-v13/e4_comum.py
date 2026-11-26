# Utilitários comuns dos autores da E4 (locomoção e combate) sobre o rig v13. Importado com o .blend já aberto.
import bpy, sys, os, math, json
from mathutils import Vector, Quaternion, Euler, Matrix

ROOT = sys.argv[sys.argv.index('--') + 1]   # raiz do repositório
OUT = os.path.join(ROOT, 'labs/hunters/assets/hunter-rig-v13')
FPS = 60
arm = bpy.data.objects['Hunter_Rig_v13']; P = arm.pose.bones; B = arm.data.bones
bpy.context.scene.render.fps = FPS
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='POSE')
GRIP = json.load(open(os.path.join(OUT, 'grip-v13.json')))
SIDES = ('Left', 'Right')
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))     # mundo Blender: X = esquerda do Hunter, −Y = frente, Z = cima
R = lambda axis, deg: Quaternion(axis, math.radians(deg))
smooth = lambda u: u * u * (3 - 2 * u)
TAU = 2 * math.pi

# ---------- pernas em IK, pé orientado pelo controle ----------
for s in SIDES:
    if 'Pe_IK' not in P[s + 'Foot'].constraints:
        c = P[s + 'Foot'].constraints.new('COPY_ROTATION'); c.name = 'Pe_IK'; c.target = arm; c.subtarget = 'CTRL_ankle_ik.' + s; c.influence = 0
CONS = [(s + 'Leg', 'IK_perna') for s in SIDES] + [(s + 'Foot', 'Pe_IK') for s in SIDES] + [(s + 'ToeBase', 'Ponta_IK') for s in SIDES]

def basis(name, D):
    """Rotação D dada em eixos do mundo, relativa ao pai, convertida para a base local do osso."""
    r = B[name].matrix_local.to_quaternion(); return r.inverted() @ D @ r
def key_rot(name, D, f):
    pb = P[name]; pb.rotation_mode = 'QUATERNION'; pb.rotation_quaternion = basis(name, D); pb.keyframe_insert('rotation_quaternion', frame=f)
def key_loc(name, world_delta, f):
    pb = P[name]; pb.location = B[name].matrix_local.to_quaternion().inverted() @ world_delta; pb.keyframe_insert('location', frame=f)

# CTRL_foot: cabeça no chão sob o tornozelo. Pivôs de rolamento (relativos à cabeça, no mundo em repouso):
# Pivôs no ponto real de contato, medidos na sola da malha em repouso: o vértice mais baixo e mais atrás (calcanhar)
# e a bola do pé no chão. Pivô acima do chão faz o pé rolar e escorregar.
_me = next(o for o in bpy.data.objects if o.type == 'MESH' and o.find_armature() == arm)
def _sole(s):
    gi = {g.name: g.index for g in _me.vertex_groups}
    pts = [_me.matrix_world @ v.co for v in _me.data.vertices if any(g.group == gi[s + 'Foot'] and g.weight > .5 for g in v.groups)]
    zmin = min(p.z for p in pts); low = [p for p in pts if p.z < zmin + .003]
    heel = max(low, key=lambda p: p.y)          # +Y = atrás
    by = P['CTRL_ball_roll.' + s].head.y; near = [p for p in pts if abs(p.y - by) < .03] or pts
    return heel, Vector((P['CTRL_ball_roll.' + s].head.x, by, min(p.z for p in near)))
_SOLE = {s: _sole(s) for s in SIDES}
def _back_sole(s):   # metade traseira da sola (rel. à cabeça do CTRL_foot): o calcanhar rola sobre ela
    gi = {g.name: g.index for g in _me.vertex_groups}; h = P['CTRL_foot.' + s].head
    pts = [_me.matrix_world @ v.co - h for v in _me.data.vertices if any(g.group == gi[s + 'Foot'] and g.weight > .5 for g in v.groups)]
    return [p for p in pts if p.y > 0 and p.z < .04]
BACK = {s: _back_sole(s) for s in SIDES}
HEEL = {s: _SOLE[s][0] - P['CTRL_foot.' + s].head for s in SIDES}
BALL = {s: _SOLE[s][1] - P['CTRL_foot.' + s].head for s in SIDES}
def foot_pose(s, fwd, lift, pitch, pivot, side_off=0.0):
    """Pé no chão: avanço `fwd` (m, + = frente), altura `lift`, inclinação `pitch` (graus, + = ponta para cima),
    girando em torno do calcanhar ('heel'), da bola do pé ('ball') ou do tornozelo (None)."""
    q = R(X, -pitch)   # rotação +X abaixa a ponta (−Y); pitch + = ponta para cima
    off = Vector((0, 0, 0))
    if pivot == 'heel':   # o ponto do calcanhar que fica mais baixo nessa inclinação é o que toca o chão
        p = min(BACK[s], key=lambda x: (q @ x).z); off = p - q @ p; off.z += HEEL[s].z - p.z
    elif pivot:
        p = BALL[s]; off = p - q @ p
    return Vector((side_off, -fwd, lift)) + off, q

def key_foot(s, f, fwd, lift, pitch, pivot, side_off=0.0):
    loc, q = foot_pose(s, fwd, lift, pitch, pivot, side_off)
    key_loc('CTRL_foot.' + s, loc, f); key_rot('CTRL_foot.' + s, q, f)

def hermite(p0, p1, m0, m1, u):
    h00, h10, h01, h11 = 2 * u ** 3 - 3 * u ** 2 + 1, u ** 3 - 2 * u ** 2 + u, -2 * u ** 3 + 3 * u ** 2, u ** 3 - u ** 2
    return h00 * p0 + h10 * m0 + h01 * p1 + h11 * m1

def gait_foot(G, phase):
    """Trilha de um pé no ciclo (em lugar). Apoio: anda para trás a v; voo: Hermite com velocidades contínuas."""
    d, T, v = G['duty'], G['frames'] / FPS, G['v']
    Ls = v * T * d                                             # distância percorrida durante o apoio
    u = phase % 1.0
    def stance(sv):   # sv em [0, 1]
        fwd = Ls / 2 - sv * Ls + G['reach']
        if sv < G['flat']:   # contato com o calcanhar, ponta baixa até o pé assentar
            k = smooth(sv / G['flat']); return fwd, 0.0, G['heel'] * (1 - k), 'heel'
        if sv > G['heelOff']:   # calcanhar sobe, gira na bola do pé
            k = smooth((sv - G['heelOff']) / (1 - G['heelOff'])); return fwd, .007 * k, -G['toeOff'] * k, 'ball'   # 7 mm: a sola dobra na articulação dos dedos
        return fwd, 0.0, 0.0, None
    if u < d: return stance(u / d)
    w = (u - d) / (1 - d); Tsw = T * (1 - d)
    a, b = stance(1.0), stance(0.0)
    pa = foot_pose('Left', a[0], 0, a[2], a[3])[0]; pb_ = foot_pose('Left', b[0], 0, b[2], b[3])[0]   # posição da cabeça com o pivô
    fwd = hermite(-pa.y, -pb_.y, -v * Tsw * .5, -v * Tsw, w)   # sai quase parado; recua antes de pisar e pousa na velocidade do chão
    lift = hermite(pa.z, pb_.z, 0, 0, w) + G['lift'] * math.sin(math.pi * min(1, w / .9)) ** .8 * (1 if w < .9 else 0)   # sobe logo: a ponta não arrasta
    pitch = hermite(a[2], b[2], 0, 0, w) + G['swingPitch'] * math.sin(math.pi * w)
    return fwd, lift, pitch, None

def key_gait(name, G):
    act = bpy.data.actions.new(name); arm.animation_data.action = act
    N = G['frames']
    for f in range(0, N + 1):   # uma chave por quadro: o último quadro fecha o laço
        ph = f / N; fr = f + 1
        for c_b, c_n in CONS: P[c_b].constraints[c_n].influence = 1; P[c_b].constraints[c_n].keyframe_insert('influence', frame=fr)
        ankles = {}
        for s, off in (('Left', 0.0), ('Right', .5)):
            fwd, lift, pitch, pivot = gait_foot(G, ph + off)
            loc, q = foot_pose(s, fwd, lift, pitch, pivot, G['width'] * (1 if s == 'Left' else -1))
            h0 = B['CTRL_foot.' + s].head_local; ankles[s] = h0 + loc + q @ (B['CTRL_ankle_ik.' + s].head_local - h0)
            key_loc('CTRL_foot.' + s, loc, fr); key_rot('CTRL_foot.' + s, q, fr)
            key_rot('CTRL_toe.' + s, R(X, min(0, pitch)), fr)   # pé inclinado para baixo: a ponta fica nivelada (não entra no chão)
        body(G, ph, fr, ankles)
    act['contract'] = 'hunter-pve-v02'; act['module'] = G['module']; act['weapon'] = 'sword'; act['loop'] = True; act['fps'] = FPS
    act['duration'] = N / FPS; act['stride'] = G['v'] * N / FPS; act['speedMs'] = G['v']
    act['footContacts'] = {k: contacts(G, o) for k, o in (('left', 0.0), ('right', .5))}
    act['rootMotion'] = {'mode': 'none'}; act['motion'] = 'in-place; o pé plantado anda para trás a speedMs'
    act['footRoll'] = {'duty': G['duty'], 'flat': G['flat'], 'heelOff': G['heelOff']}   # fases do apoio: calcanhar, pé inteiro, bola do pé
    return act

def contacts(G, off):
    """Intervalos [primeiro, último] quadro com o pé no chão, em segundos. O quadro N é o quadro 0 (laço)."""
    N = G['frames']; out = []; ini = None; last = None
    for n in range(N):
        on = ((n / N + off) % 1.0) < G['duty']
        if on and ini is None: ini = n
        if on: last = n
        if not on and ini is not None: out.append([round(ini / FPS, 4), round(last / FPS, 4)]); ini = None
    if ini is not None: out.append([round(ini / FPS, 4), round(N / FPS, 4)])
    return out

LEG = {s: ((B[s + 'Leg'].head_local - B[s + 'UpLeg'].head_local).length + (B[s + 'Foot'].head_local - B[s + 'Leg'].head_local).length) for s in SIDES}
def softmin(vals, k=.008):
    m = min(vals); return m - k * math.log(sum(math.exp(-(v - m) / k) for v in vals))
# Pegada reversa (decisão do diretor para a corrida): o socket gira 180° em torno do eixo da guarda. O cabo continua na
# mesma linha dentro do punho; a lâmina sai do lado do dedo mínimo e a guarda fica junto dele.
GUARDA = Vector(GRIP['Right']['guarda'])
def key_socket(G, fr):
    key_rot('WeaponSocket_R', R(GUARDA, 180) if G.get('reverse') else Quaternion(), fr)

def body(G, ph, fr, ankles=None):
    lag = lambda frames: ph - frames / G['frames']
    # pelve: desce no apoio, balança para o pé de apoio, gira com a perna que avança, tomba para o lado do voo
    stanceL = G['duty'] / 2
    bob = -G['bob'] * math.cos(2 * TAU * (ph - stanceL)) + G['drop']
    sway = G['sway'] * math.cos(TAU * (ph - stanceL))
    if ankles:   # a pelve desce o que for preciso para as duas pernas alcançarem os pés (98,5% da perna): sem joelho travado
        need = []
        for s_ in SIDES:
            hip = B[s_ + 'UpLeg'].head_local + Vector((sway, 0, 0)); a_ = ankles[s_]; L = LEG[s_] * .985
            hz = math.hypot(a_.x - hip.x, a_.y - hip.y)
            need.append(max(-.12, a_.z + math.sqrt(max(0, L * L - hz * hz)) - hip.z if hz < L else -.12))   # no máximo 12 cm
        bob = softmin([bob, *need])
    key_loc('Hips', Vector((sway, 0, bob)), fr)
    yaw = -G['yaw'] * math.cos(TAU * ph); lst = -G['list'] * math.cos(TAU * (ph - stanceL))
    key_rot('Hips', R(Z, yaw) @ R(Y, lst) @ R(X, G['lean'] * .25), fr)
    # coluna: inclinação distribuída; contra-giro do tronco atrasado 3 quadros
    cyaw = G['counter'] * math.cos(TAU * lag(3)); clean = G['lean'] * .25 + G['breath'] * math.sin(2 * TAU * ph)
    for n, k in (('Spine02', .3), ('SpineMid', .35), ('Spine', .35)):
        key_rot(n, R(Z, cyaw * k) @ R(Y, -lst * .4 * k) @ R(X, clean), fr)
    # cabeça: devolve o giro e a inclinação para olhar à frente (atrasada 4 quadros)
    hy = -(yaw + G['counter'] * math.cos(TAU * lag(4))) * .8
    key_rot('neck', R(Z, hy * .5) @ R(X, -G['lean'] * .55), fr); key_rot('Head', R(Z, hy * .5) @ R(X, -G['lean'] * .2), fr)
    # braços: oposto à perna do mesmo lado, atrasados 3 quadros; braço da espada balança menos
    for s, sg in (('Left', 1), ('Right', -1)):
        A = G['armL'] if s == 'Left' else G['armR']
        sw = A['swing'] * math.cos(TAU * (lag(3) - (0 if s == 'Left' else .5)))     # + = para trás
        key_rot(s + 'Shoulder', R(X, sw * .12) @ R(Y, -sg * A['clav']), fr)
        key_rot(s + 'Arm', R(X, sw) @ R(Y, sg * A['lower']), fr)
        el = A['elbow'] + A['elbowAmp'] * math.cos(TAU * (lag(5) - (0 if s == 'Left' else .5)))
        key_rot(s + 'ForeArm', R(Z, -sg * el), fr)
        hand = hand_q(A) if s == 'Right' else R(X, sg * A['pron']) @ R(Z, -sg * 8)
        key_rot(s + 'Hand', hand, fr)
        key_fingers(s, fr)
        if s == 'Right': key_socket(G, fr)

def key_fingers(s, fr):
    """Mão da espada: a curvatura que fecha o punho no cabo (grip-v13.json). Mão livre: semifechada, relaxada."""
    e = ({'Fingers1': GRIP['Right']['curvaturaDedos'][0], 'Fingers2': GRIP['Right']['curvaturaDedos'][1], 'Thumb1': -35, 'Thumb2': -40} if s == 'Right'
         else {'Fingers1': -30, 'Fingers2': -35, 'Thumb1': -10, 'Thumb2': -15})
    for fn, a in e.items():
        pb = P[s + fn]; pb.rotation_mode = 'QUATERNION'; pb.rotation_quaternion = R(Vector((1, 0, 0)), 0) @ Euler((math.radians(a), 0, 0), 'XYZ').to_quaternion()
        pb.keyframe_insert('rotation_quaternion', frame=fr)

# ---------- mão da espada: pronação, flexão e desvio escolhidos uma vez por clipe, dentro dos limites anatômicos ----------
# Ordem anatômica (mão direita, eixos da pose T): desvio (Z, + radial) e flexão (Y, + extensão) no punho, depois a pronação
# (X) do antebraço inteiro, que os ossos de torção distribuem. Limites: extensão 60°, flexão 70°, radial 20°, ulnar 35°.
WRIST = {'ext': 60, 'flex': 70, 'rad': 20, 'uln': 35}
def hand_q(A): return R(X, A['pron']) @ R(Y, A.get('wflex', 0)) @ R(Z, A.get('wdev', 0))
def socket_dir():
    bpy.context.view_layer.update(); return (arm.matrix_world.to_quaternion() @ P['WeaponSocket_R'].matrix.to_quaternion()) @ Y
def solve_pron(G, blade):
    body(G, 0.25, bpy.context.scene.frame_current); arm.animation_data.action = None   # pose do braço fixa; só a mão varia
    best = None
    for pr in range(-85, 86, 5):
        for fl in range(-40, WRIST['ext'] + 1, 10):            # sem flexão forte: o punho flexionado perde força no cabo
            for dv in range(-25, WRIST['rad'] + 1, 5):         # transporte: até 25° de ulnar, não o limite de 35° (punho forçado o ciclo todo)
                A = {'pron': pr, 'wflex': fl, 'wdev': dv}
                P['RightHand'].rotation_quaternion = basis('RightHand', hand_q(A))
                e = socket_dir().normalized().angle(blade.normalized()) + math.radians(.05 * (abs(fl) + abs(dv)))   # empate: punho mais neutro
                if best is None or e < best[0]: best = (e, A, socket_dir().normalized())
    G['armR'].update(best[1]); print('LAMINA alcançada', [round(x, 2) for x in best[2]]); return best[:2]

# ---------- guarda: pose de referência de todo clipe B/C (costura do contrato §9) ----------
GG = dict(armL={'swing': -38, 'lower': 55, 'abd': 22, 'clav': 6, 'elbow': 105, 'elbowAmp': 0, 'pron': 25},
          armR={'swing': -42, 'lower': 48, 'abd': 14, 'clav': 8, 'elbow': 72, 'elbowAmp': 0, 'pron': 0})
GUARD_FEET = {'Left': (.17, .04, -10), 'Right': (-.13, -.03, -28)}   # avanço, lado, giro da ponta (graus)
def key_guard(ph, fr, ik=True):
    """Guarda na fase ph do laço de respiração (ph = 0: a pose de referência)."""
    for c_b, c_n in CONS: P[c_b].constraints[c_n].influence = 1 if ik else 0; P[c_b].constraints[c_n].keyframe_insert('influence', frame=fr)
    shift = .012 * math.sin(TAU * ph); br = 1.2 * math.sin(2 * TAU * ph)
    for s, (fw, sd, yw) in GUARD_FEET.items():
        key_foot(s, fr, fw, 0, 0, None, sd); key_rot('CTRL_foot.' + s, R(Z, yw), fr); key_rot('CTRL_toe.' + s, Quaternion(), fr)
    key_loc('Hips', Vector((shift * .5, .02 + shift, -.07 + .004 * math.sin(2 * TAU * ph))), fr)
    key_rot('Hips', R(Z, -22) @ R(X, 6), fr)
    for n, k in (('Spine02', .3), ('SpineMid', .35), ('Spine', .35)): key_rot(n, R(Z, 12 * k) @ R(X, 5 * k + br * k), fr)
    key_rot('neck', R(Z, 6) @ R(X, -4), fr); key_rot('Head', R(Z, 5) @ R(X, -3 - br * .3), fr)
    for s, sg in (('Left', 1), ('Right', -1)):
        A = GG['armL'] if s == 'Left' else GG['armR']
        key_rot(s + 'Shoulder', R(X, A['swing'] * .1) @ R(Y, -sg * A['clav']), fr)
        key_rot(s + 'Arm', R(X, A['swing'] + br * .6) @ R(Y, sg * A['lower']), fr)
        key_rot(s + 'ForeArm', R(Z, -sg * A['elbow']), fr)
        key_rot(s + 'Hand', hand_q(A) if s == 'Right' else R(X, A['pron']) @ R(Z, -12), fr)
        key_fingers(s, fr)
    key_socket({}, fr)
