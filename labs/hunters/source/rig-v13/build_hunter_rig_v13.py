# Hunter rig v13 — blockout E0 (plano PvE, etapa E0). Blender 5.3, sem dependências externas.
#   blender -b --python labs/hunters/source/rig-v13/build_hunter_rig_v13.py -- <raiz-do-repositorio>
#
# Fonte: o corpo base fornecido pelo diretor (assets/hunters/hunter-workshop/base/hunter-masculino-1000v,
# sha256 90f7cf65…), conferido antes de usar. A forma não é remodelada: a malha ganha densidade só nas
# articulações (subdivisão plana, sem mudar a silhueta), e a cabeça fica intacta para os cabelos da oficina.
# O esqueleto mantém os 19 nomes originais e acrescenta ossos de torção, coluna média, polegar, dedos,
# ponta do pé, raiz e sockets. O rig de controle (IK de braço e perna com polo, rolamento de pé, alvo de
# arma) vive no mesmo armature com ossos que não deformam e não são exportados.
import bpy, bmesh, sys, os, math, hashlib, json
from mathutils import Vector, Matrix

ROOT = sys.argv[sys.argv.index('--') + 1]
SRC = os.path.join(ROOT, 'assets/hunters/hunter-workshop/base/hunter-masculino-1000v/hunter_masculino_1000v.glb')
SRC_SHA = '90f7cf659aa4243e07f6bef0ff28e0d616815f344095ad57e81dca817cbc5cf8'
OUT = os.path.join(ROOT, 'labs/hunters/assets/hunter-rig-v13')
os.makedirs(OUT, exist_ok=True)
assert hashlib.sha256(open(SRC, 'rb').read()).hexdigest() == SRC_SHA, 'corpo base diferente do manifesto'

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC, merge_vertices=True)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
me = next(o for o in bpy.data.objects if o.type == 'MESH')
arm.name, arm.data.name, me.name = 'Hunter_Rig_v13', 'Hunter_Rig_v13', 'Hunter_Body_v13'
for a in list(bpy.data.actions): bpy.data.actions.remove(a)
arm.animation_data_clear()
# o importador deixa a pose do nó glTF em matrix_basis; depois de mexer na rolagem dos ossos isso deslocaria o corpo
for pb in arm.pose.bones: pb.matrix_basis.identity()
assert arm.matrix_world == Matrix() and me.parent == arm
MW = me.matrix_world.copy()
# Rest positions (Blender world: +Z up, frente = −Y, lado esquerdo do personagem = +X).
H = {b.name: arm.matrix_world @ b.head_local for b in arm.data.bones}
SIDES = {'Right': -1, 'Left': 1}
lerp = lambda a, b, t: a + (b - a) * t
smooth = lambda e0, e1, x: (lambda u: u * u * (3 - 2 * u))(min(1, max(0, (x - e0) / (e1 - e0))))

# ---------- 1. Malha: subdivisão plana só nas articulações ----------
bm = bmesh.new(); bm.from_mesh(me.data)
dl = bm.verts.layers.deform.active
gidx = {g.name: g.index for g in me.vertex_groups}
def w(v, name): return v[dl].get(gidx[name], 0.0) if name in gidx else 0.0
spheres = [(H['Spine02'], .15), (lerp(H['Spine02'], H['Spine'], .5), .13)]
for s in SIDES:
    spheres += [(H[s + 'Arm'], .11), (H[s + 'ForeArm'], .10), (H[s + 'Hand'], .09), (H[s + 'UpLeg'], .15), (H[s + 'Leg'], .12), (H[s + 'Foot'], .09)]
def near(v):
    p = MW @ v.co
    if w(v, 'Head') > .02 or w(v, 'neck') > .25: return False   # cabeça intacta (cabelos da oficina)
    if any(w(v, s + 'Hand') > .5 or w(v, s + 'Foot') > .5 for s in SIDES): return True
    return any((p - c).length < r for c, r in spheres)
sel = [e for e in bm.edges if near(e.verts[0]) and near(e.verts[1])]
bmesh.ops.subdivide_edges(bm, edges=sel, cuts=1, use_grid_fill=True)
bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
bm.to_mesh(me.data); bm.free(); me.data.update()
# as normais personalizadas da importação não acompanham a subdivisão: volta ao sombreamento suave da base
bpy.context.view_layer.objects.active = me
if me.data.has_custom_normals: bpy.ops.mesh.customdata_custom_splitnormals_clear()
me.data.shade_smooth()

# ---------- 2. Esqueleto v13 ----------
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
E = arm.data.edit_bones
FRONT, UP = Vector((0, -1, 0)), Vector((0, 0, 1))
def chain_tail(name, tail, roll_to):
    b = E[name]; b.tail = tail; b.align_roll(roll_to)
def new(name, parent, head, tail, roll_to, deform=True):
    b = E.new(name); b.head, b.tail = head, tail; b.align_roll(roll_to); b.parent = E[parent] if parent else None
    b.use_deform = deform; b.use_connect = False; return b
# raiz para o deslocamento do corpo
new('root', None, Vector((0, 0, 0)), Vector((0, .25, 0)), UP)
E['Hips'].parent = E['root']
# coluna de três segmentos: Spine02 (lombar) -> SpineMid (nova) -> Spine (peito)
mid = lerp(H['Spine02'], H['Spine'], .5)
chain_tail('Hips', H['Spine02'], FRONT)
chain_tail('Spine02', mid, FRONT)
new('SpineMid', 'Spine02', mid, H['Spine'], FRONT)
E['Spine'].parent = E['SpineMid']; chain_tail('Spine', H['neck'], FRONT)
chain_tail('neck', H['Head'], FRONT)
for s, sx in SIDES.items():
    sh, ar, fa, ha = H[s + 'Shoulder'], H[s + 'Arm'], H[s + 'ForeArm'], H[s + 'Hand']
    chain_tail(s + 'Shoulder', ar, UP); chain_tail(s + 'Arm', fa, UP); chain_tail(s + 'ForeArm', ha, UP)
    ax = (ha - fa).normalized()
    chain_tail(s + 'Hand', ha + ax * .135, UP)                    # mão alinhada ao antebraço: Y local = eixo da torção
    new(s + 'ArmTwist', s + 'Arm', lerp(ar, fa, .15), lerp(ar, fa, .45), UP)
    new(s + 'ForeArmTwist1', s + 'ForeArm', lerp(fa, ha, 1 / 3), lerp(fa, ha, 1 / 3) + ax * .06, UP)
    new(s + 'ForeArmTwist2', s + 'ForeArm', lerp(fa, ha, 2 / 3), lerp(fa, ha, 2 / 3) + ax * .06, UP)
    th1, th2, tht = ha + ax * .035 + Vector((0, -.055, -.02)), ha + ax * .085 + Vector((0, -.09, -.04)), ha + ax * .125 + Vector((0, -.11, -.06))
    new(s + 'Thumb1', s + 'Hand', th1, th2, UP); new(s + 'Thumb2', s + 'Thumb1', th2, tht, UP)
    k1, k2 = ha + ax * .135 + Vector((0, 0, -.01)), ha + ax * .17 + Vector((0, 0, -.015))
    new(s + 'Fingers1', s + 'Hand', k1, k2, UP); new(s + 'Fingers2', s + 'Fingers1', k2, ha + ax * .207, UP)
    ul, lg, ft = H[s + 'UpLeg'], H[s + 'Leg'], H[s + 'Foot']
    chain_tail(s + 'UpLeg', lg, FRONT); chain_tail(s + 'Leg', ft, FRONT)
    ball = Vector((ft.x + sx * .02, -.06, .028))
    chain_tail(s + 'Foot', ball, UP)
    new(s + 'UpLegTwist', s + 'UpLeg', lerp(ul, lg, .15), lerp(ul, lg, .45), FRONT)
    new(s + 'ToeBase', s + 'Foot', ball, Vector((ball.x, -.165, .02)), UP)
    # E1: auxiliares de meia-rotação. Copiam o referencial do osso de baixo e giram metade da dobra (driver),
    # para a dobra profunda do cotovelo e do joelho não pinçar.
    for hn, par, ref in ((s + 'ElbowHelper', s + 'Arm', s + 'ForeArm'), (s + 'KneeHelper', s + 'UpLeg', s + 'Leg')):
        r = E[ref]; hb = E.new(hn); hb.head, hb.tail, hb.roll = r.head.copy(), r.head + (r.tail - r.head) * .3, r.roll
        hb.parent = E[par]; hb.use_deform = True; hb.use_connect = False
# sockets (ossos sem vértices): a arma e a bainha seguem o osso pai
new('WeaponSocket_R', 'RightHand', H['RightHand'] + (H['RightHand'] - H['RightForeArm']).normalized() * .09 + Vector((0, 0, -.03)),
    H['RightHand'] + (H['RightHand'] - H['RightForeArm']).normalized() * .09 + Vector((0, -.12, -.03)), UP)
new('WeaponSocket_L', 'LeftHand', H['LeftHand'] + (H['LeftHand'] - H['LeftForeArm']).normalized() * .09 + Vector((0, 0, -.03)),
    H['LeftHand'] + (H['LeftHand'] - H['LeftForeArm']).normalized() * .09 + Vector((0, -.12, -.03)), UP)
new('Sheath_Back', 'Spine', H['Spine'] + Vector((0, .14, .05)), H['Spine'] + Vector((-.25, .14, .35)), FRONT)
DEFORM = [b.name for b in E]
# ---------- 3. Rig de controle (não exportado) ----------
def ctrl(name, parent, head, tail, roll_to=UP): return new(name, parent, head, tail, roll_to, deform=False)
for s, sx in SIDES.items():
    ha, fa, ar = H[s + 'Hand'], H[s + 'ForeArm'], H[s + 'Arm']
    ctrl('CTRL_hand_ik.' + s, 'root', ha, ha + (ha - fa).normalized() * .135)
    ctrl('CTRL_elbow_pole.' + s, 'root', fa + Vector((0, .45, 0)), fa + Vector((0, .55, 0)))
    ft = H[s + 'Foot']; ball = E[s + 'ToeBase'].head.copy()
    ctrl('CTRL_foot.' + s, 'root', Vector((ft.x, ft.y, 0)), Vector((ft.x, ft.y - .2, 0)))
    ctrl('CTRL_ball_roll.' + s, 'CTRL_foot.' + s, ball, ball + Vector((0, 0, .08)))
    ctrl('CTRL_ankle_ik.' + s, 'CTRL_ball_roll.' + s, ft, ball, UP)
    ctrl('CTRL_toe.' + s, 'CTRL_foot.' + s, ball, E[s + 'ToeBase'].tail.copy())
    ctrl('CTRL_knee_pole.' + s, 'root', H[s + 'Leg'] + Vector((0, -.5, 0)), H[s + 'Leg'] + Vector((0, -.6, 0)))
ctrl('CTRL_weapon', 'root', E['WeaponSocket_R'].head.copy(), E['WeaponSocket_R'].tail.copy())
bpy.ops.object.mode_set(mode='OBJECT')

# ---------- 4. Pesos ----------
VG = me.vertex_groups
for n in DEFORM:
    if n not in VG: VG.new(name=n)
gidx = {g.name: g.index for g in VG}
def gw(v, n):
    for g in v.groups:
        if g.group == gidx[n]: return g.weight
    return 0.0
def getw(v): return {VG[g.group].name: g.weight for g in v.groups if g.weight > 0}
def putw(v, wd):
    for n in list(getw(v)):
        if n not in wd or wd[n] <= 1e-4: VG[n].remove([v.index])
    for n, x in wd.items():
        if x > 1e-4: VG[n].add([v.index], x, 'REPLACE')
def move(wd, src, dst, frac):
    a = wd.get(src, 0)
    if a > 0 and frac > 0: wd[src] = a * (1 - frac); wd[dst] = wd.get(dst, 0) + a * frac
def proj(p, a, b): d = b - a; return (p - a).dot(d) / d.length_squared
def chain(wd, p, bones, S, E, W, blend_mid, blend_end, twist_lo, helper=None):
    """E1: refaz os pesos de um membro ao longo da cadeia, conservando o peso total do membro.
    bones = (superior, torção superior, inferior, torção 1, torção 2 ou None, extremidade).
    Antes, a subdivisão espalhava pesos do braço e da mão até o meio do antebraço."""
    C = sum(wd.pop(n, 0) for n in bones if n)
    if C <= 0: return
    up, uptw, lo, t1n, t2n, end = bones
    A, B = (E - S).length, (W - E).length
    a, b = proj(p, S, E), proj(p, E, W)
    sd = b * B if b > 0 else (a - 1) * A                     # distância ao longo da cadeia, medida do cotovelo/joelho
    lower = smooth(-blend_mid, blend_mid, sd); tip = smooth(B - blend_end[0], B + blend_end[1], sd)
    upper = 1 - lower; sh = 1 - smooth(.15, twist_lo, a)
    wd[uptw] = wd.get(uptw, 0) + C * upper * sh; wd[up] = wd.get(up, 0) + C * upper * (1 - sh)
    u = min(1, max(0, b)); mid = C * lower * (1 - tip)
    if t2n:   # antebraço: torção 0 -> 1/3 -> 2/3 -> mão
        f0 = max(0, 1 - 3 * u); f1 = max(0, 1 - abs(u - 1 / 3) * 3) if u < 2 / 3 else 0; f2 = max(0, 1 - abs(u - 2 / 3) * 3) if u < 2 / 3 else 1
    else:     # canela: Leg inteira (a torção da perna vem da coxa)
        f0, f1, f2 = 1, 0, 0
    tot = f0 + f1 + f2
    wd[lo] = wd.get(lo, 0) + mid * f0 / tot
    if t1n: wd[t1n] = wd.get(t1n, 0) + mid * f1 / tot
    if t2n: wd[t2n] = wd.get(t2n, 0) + mid * f2 / tot
    wd[end] = wd.get(end, 0) + C * lower * tip
    if helper:   # até 85% do anel da articulação passa ao auxiliar de meia-rotação
        hs = .85 * max(0, 1 - abs(sd) / (blend_mid * 1.6))
        for n in (up, uptw, lo, t1n):
            if n: move(wd, n, helper, hs)
for v in me.data.vertices:
    p = MW @ v.co; wd = getw(v)
    # coluna: Spine02 divide com SpineMid pela altura
    u = proj(p, H['Spine02'], H['Spine'])
    move(wd, 'Spine02', 'SpineMid', smooth(.25, .75, u))
    if u < .9: move(wd, 'Spine', 'SpineMid', .5 * (1 - smooth(.6, .9, u)))
    for s, sx in SIDES.items():
        chain(wd, p, (s + 'Arm', s + 'ArmTwist', s + 'ForeArm', s + 'ForeArmTwist1', s + 'ForeArmTwist2', s + 'Hand'),
              H[s + 'Arm'], H[s + 'ForeArm'], H[s + 'Hand'], .045, (.02, .03), .75, s + 'ElbowHelper')
        chain(wd, p, (s + 'UpLeg', s + 'UpLegTwist', s + 'Leg', None, None, s + 'Foot'),
              H[s + 'UpLeg'], H[s + 'Leg'], H[s + 'Foot'], .055, (.03, .03), .7, s + 'KneeHelper')
        # mão: polegar e dedos (luva) a partir da posição em repouso
        ha, ax = H[s + 'Hand'], (H[s + 'Hand'] - H[s + 'ForeArm']).normalized()
        d = p - ha; sl = d.dot(ax)
        if wd.get(s + 'Hand', 0) > 0 and sl > 0:
            if sl < .145 and (d.y < -.07 or (d.y < -.05 and d.z < -.03)):
                move(wd, s + 'Hand', s + 'Thumb1', smooth(0, .04, sl)); move(wd, s + 'Thumb1', s + 'Thumb2', smooth(.065, .1, sl))
            else:
                move(wd, s + 'Hand', s + 'Fingers1', smooth(.12, .145, sl)); move(wd, s + 'Fingers1', s + 'Fingers2', smooth(.155, .18, sl))
        if p.x * sx > 0: move(wd, s + 'Foot', s + 'ToeBase', smooth(-.035, -.085, p.y))
    putw(v, wd)
# ombro: suaviza a transição peito/clavícula/braço (conserva a soma desses grupos em cada vértice)
adj = {i: set() for i in range(len(me.data.vertices))}
for e in me.data.edges: a_, b_ = e.vertices; adj[a_].add(b_); adj[b_].add(a_)
for s in SIDES:
    G = ['Spine', 'SpineMid', s + 'Shoulder', s + 'Arm', s + 'ArmTwist']
    region = [v.index for v in me.data.vertices if ((MW @ v.co) - H[s + 'Arm']).length < .14]
    W0 = {i: getw(me.data.vertices[i]) for i in adj}
    for _ in range(4):
        W1 = {}
        for i in region:
            tot = sum(W0[i].get(g, 0) for g in G)
            if tot <= 0: continue
            avg = {g: (W0[i].get(g, 0) + sum(W0[j].get(g, 0) for j in adj[i])) / (1 + len(adj[i])) for g in G}
            k = sum(avg.values()) or 1
            W1[i] = {**W0[i], **{g: avg[g] / k * tot for g in G}}
        W0.update(W1)
    for i in region: putw(me.data.vertices[i], W0[i])
bpy.context.view_layer.objects.active = me
bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)
bpy.ops.object.vertex_group_clean(group_select_mode='ALL', limit=0.005)
bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)

# ---------- 5. Constraints e drivers ----------
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='POSE')
P = arm.pose.bones
def twist_driver(bone, src, k):
    pb = P[bone]; pb.rotation_mode = 'XYZ'
    fc = pb.driver_add('rotation_euler', 1); dr = fc.driver; dr.type = 'SCRIPTED'
    var = dr.variables.new(); var.name = 'tw'; var.type = 'TRANSFORMS'
    t = var.targets[0]; t.id = arm; t.bone_target = src; t.transform_type = 'ROT_Y'
    t.rotation_mode = 'SWING_TWIST_Y'; t.transform_space = 'LOCAL_SPACE'
    dr.expression = f'tw*{k}'
for s in SIDES:
    twist_driver(s + 'ForeArmTwist1', s + 'Hand', 1 / 3)
    twist_driver(s + 'ForeArmTwist2', s + 'Hand', 2 / 3)
    twist_driver(s + 'ArmTwist', s + 'Arm', -.5)
    twist_driver(s + 'UpLegTwist', s + 'UpLeg', -.5)
    for hn, src, i, ch in ((s + 'ElbowHelper', s + 'ForeArm', 2, 'ROT_Z'), (s + 'KneeHelper', s + 'Leg', 0, 'ROT_X')):
        pb = P[hn]; pb.rotation_mode = 'XYZ'; dr = pb.driver_add('rotation_euler', i).driver; dr.type = 'SCRIPTED'
        var = dr.variables.new(); var.name = 'b'; var.type = 'TRANSFORMS'; t = var.targets[0]
        t.id = arm; t.bone_target = src; t.transform_type = ch; t.rotation_mode = 'XYZ'; t.transform_space = 'LOCAL_SPACE'
        dr.expression = 'b*0.5'
    P[s + 'ForeArm'].lock_ik_y = True; P[s + 'Leg'].lock_ik_y = True; P[s + 'Leg'].lock_ik_z = True
    # joelho só dobra para trás: com a perna quase reta o solver às vezes escolhia o lado errado (−10° no combo 1).
    # Eixo X local da canela = −X do mundo: flexão é X local negativo.
    P[s + 'Leg'].use_ik_limit_x = True; P[s + 'Leg'].ik_min_x = math.radians(-160); P[s + 'Leg'].ik_max_x = 0
    ik = P[s + 'ForeArm'].constraints.new('IK'); ik.name = 'IK_braco'; ik.target = arm; ik.subtarget = 'CTRL_hand_ik.' + s
    ik.pole_target = arm; ik.pole_subtarget = 'CTRL_elbow_pole.' + s; ik.chain_count = 2; ik.influence = 0
    cr = P[s + 'Hand'].constraints.new('COPY_ROTATION'); cr.name = 'Mao_IK'; cr.target = arm; cr.subtarget = 'CTRL_hand_ik.' + s; cr.influence = 0
    ik = P[s + 'Leg'].constraints.new('IK'); ik.name = 'IK_perna'; ik.target = arm; ik.subtarget = 'CTRL_ankle_ik.' + s
    ik.pole_target = arm; ik.pole_subtarget = 'CTRL_knee_pole.' + s; ik.chain_count = 2; ik.influence = 0
    cr = P[s + 'ToeBase'].constraints.new('COPY_ROTATION'); cr.name = 'Ponta_IK'; cr.target = arm; cr.subtarget = 'CTRL_toe.' + s; cr.influence = 0
co = P['CTRL_hand_ik.Left'].constraints.new('CHILD_OF'); co.name = 'Mao_na_arma'; co.target = arm; co.subtarget = 'CTRL_weapon'; co.influence = 0
bpy.context.view_layer.update()
# ângulo de polo que preserva o repouso (busca numérica, 1°)
def rest_err(chain):
    return sum((P[n].matrix.to_quaternion().rotation_difference(arm.data.bones[n].matrix_local.to_quaternion()).angle) for n in chain)
for s in SIDES:
    for root_b, mid_b, cname in ((s + 'Arm', s + 'ForeArm', 'IK_braco'), (s + 'UpLeg', s + 'Leg', 'IK_perna')):
        c = P[mid_b].constraints[cname]; c.influence = 1; best = None
        for deg in range(-180, 180):
            c.pole_angle = math.radians(deg); bpy.context.view_layer.update()
            e = rest_err([root_b, mid_b])
            if best is None or e < best[0]: best = (e, deg)
        c.pole_angle = math.radians(best[1]); c.influence = 0
        print('POLE', s, cname, best[1], 'erro', round(math.degrees(best[0]), 3))
# clavícula automática no modo IK (influência 0 por padrão; 0,25 quando o braço está em IK)
for s in SIDES:
    dt = P[s + 'Shoulder'].constraints.new('DAMPED_TRACK'); dt.name = 'Clavicula_auto'; dt.target = arm
    dt.subtarget = 'CTRL_hand_ik.' + s; dt.influence = 0
bpy.ops.object.mode_set(mode='OBJECT')

# ---------- 6. Empunhadura (E1): punho fechado no cabo, sem penetração ----------
from mathutils import Euler
GRIP_CURL = {'Fingers1': (-80, 0, 0), 'Fingers2': (-75, 0, 0), 'Thumb1': (-35, 0, 0), 'Thumb2': (-40, 0, 0)}
GRIP = math.radians(15)                 # o cabo cruza a palma na diagonal, como na v12
R_HANDLE, G1, G0 = .015, -.10, .115     # raio e extensão do cabo da espada v12 (pomo -> guarda)
def set_rot(pb, e):
    pb.rotation_mode = 'QUATERNION'; pb.rotation_quaternion = Euler([math.radians(x) for x in e], 'XYZ').to_quaternion()
def curl(side, on, f=None):
    pose = dict(GRIP_CURL) if f is None else {**GRIP_CURL, 'Fingers1': (f[0], 0, 0), 'Fingers2': (f[1], 0, 0)}
    for k, e in pose.items(): set_rot(P[side + k], e if on else (0, 0, 0))
    bpy.context.view_layer.update()
def posed(ids):
    dg = bpy.context.evaluated_depsgraph_get(); ev = me.evaluated_get(dg); mm = ev.to_mesh()
    pts = [MW @ mm.vertices[i].co for i in ids]; ev.to_mesh_clear(); return pts
def fit(side):
    """O cabo tem de ficar DENTRO do punho: além de não penetrar, a palma, os dedos e o polegar precisam cercá-lo.
    Mede a cobertura angular em volta do eixo do cabo (12 setores de 30°) e busca também a curvatura dos dedos."""
    names = {gidx[side + n] for n in ('Hand', 'Fingers1', 'Fingers2', 'Thumb1', 'Thumb2')}
    ids = [v.index for v in me.data.vertices if any(g.group in names and g.weight > .3 for g in v.groups)]
    ha = H[side + 'Hand']; h = (ha - H[side + 'ForeArm']).normalized()
    t = (FRONT - h * FRONT.dot(h)).normalized(); n = h.cross(t).normalized()
    if n.z < 0: n = -n                                                   # dorso da mão (para cima na pose T)
    b = (t * math.cos(GRIP) + h * math.sin(GRIP)).normalized()          # lâmina sai do lado do polegar
    e1 = (h - b * h.dot(b)).normalized(); e2 = b.cross(e1)
    best = None
    for f1 in (-50, -60, -70, -80, -90):
        for f2 in (-50, -65, -80, -95):
            curl(side, True, (f1, f2)); pts = posed(ids)
            for ai in range(24):
                for ci in range(19):
                    c = ha + h * (.03 + ai * .006) - n * (.005 + ci * .005)
                    mind, touch, bins = 9, 0, set()
                    for q in pts:
                        wv = q - c; sd = wv.dot(b); cl = max(G1, min(G0, sd)); r = wv - b * cl; dist = r.length
                        mind = min(mind, dist); touch += dist < R_HANDLE + .012
                        if abs(sd) < .05 and dist < .04: bins.add(int((math.degrees(math.atan2(r.dot(e2), r.dot(e1))) + 180) // 30) % 12)
                    if mind < R_HANDLE - .002: continue
                    score = len(bins) * 100 + touch - (mind - R_HANDLE) * 300
                    if best is None or score > best[0]: best = (score, c, mind, touch, len(bins), (f1, f2))
    curl(side, False)
    assert best and best[4] >= 9, f'cabo não envolvido pelo punho: cobertura {best and best[4]}/12'
    GRIP_CURL['Fingers1'], GRIP_CURL['Fingers2'] = (best[5][0], 0, 0), (best[5][1], 0, 0)
    return {'centro': best[1], 'lamina': b, 'guarda': e1, 'folgaMinM': best[2], 'verticesEncostados': best[3],
            'coberturaSetores': best[4], 'curvaturaDedos': list(best[5])}
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='POSE')
GRIPS = {s: fit(s) for s in SIDES}
bpy.ops.object.mode_set(mode='EDIT')
for s, g in GRIPS.items():
    b_ = arm.data.edit_bones['WeaponSocket_' + s[0]]; b_.head = g['centro']; b_.tail = g['centro'] + g['lamina'] * .1
    b_.align_roll(g['guarda'].cross(g['lamina']))
    print('GRIP', s, 'folga min mm', round(g['folgaMinM'] * 1000, 1), 'encostados', g['verticesEncostados'], 'cobertura', g['coberturaSetores'], '/12 curvatura', g['curvaturaDedos'])
bpy.ops.object.mode_set(mode='OBJECT')
# espada da v12 (60 triângulos) presa ao socket direito: mesma malha, sem modificar o GLB de origem
V12 = os.path.join(ROOT, 'labs/hunters/assets/hunter-pvp-v12/hunter_pvp_v12.glb')
before_o, before_a = set(bpy.data.objects), set(bpy.data.actions)
bpy.ops.import_scene.gltf(filepath=V12)
new_o = [o for o in bpy.data.objects if o not in before_o]
sword = next(o for o in new_o if o.type == 'MESH' and 'Sword' in o.name)
sword.parent = None
for o in new_o:
    if o is not sword: bpy.data.objects.remove(o, do_unlink=True)
for a in [a for a in bpy.data.actions if a not in before_a]: bpy.data.actions.remove(a)
sword.matrix_world = Matrix(); sword.name = 'Espada_v12'
vs = [v.co for v in sword.data.vertices]
ext = [max(v[i] for v in vs) - min(v[i] for v in vs) for i in range(3)]
ib = max(range(3), key=lambda i: ext[i]); ig = max((i for i in range(3) if i != ib), key=lambda i: ext[i])
tip = max(vs, key=lambda v: abs(v[ib])); sb = 1 if tip[ib] > 0 else -1
lb, lg = Vector([0, 0, 0]), Vector([0, 0, 0]); lb[ib] = sb; lg[ig] = 1
g = GRIPS['Right']; Mw = Matrix((g['guarda'], g['lamina'], g['guarda'].cross(g['lamina']))).transposed()   # mundo
Ml = Matrix((lg, lb, lg.cross(lb))).transposed()                                                           # local da espada
sword.parent = arm; sword.parent_type = 'BONE'; sword.parent_bone = 'WeaponSocket_R'
sword.matrix_world = Matrix.Translation(g['centro']) @ (Mw @ Ml.inverted()).to_4x4()
bpy.context.view_layer.update()

# ---------- 7. Ação de estresse (FK): mesmas poses aplicadas depois ao corpo base sem torção ----------
# A mão direita segura a espada em todos os quadros (punho fechado).
STRESS = [  # (quadro, {osso: (rx, ry, rz) graus, eixos locais do v13}); o corpo base recebe as mesmas rotações no mundo
    (1, {}),
    (12, {'RightForeArm': (0, 0, 115), 'RightHand': (0, 85, 0)}),                         # cotovelo 115°, pronação 85°
    (24, {'RightForeArm': (0, 0, 60), 'RightHand': (0, -80, 0)}),                         # supinação 80°
    (36, {'RightShoulder': (15, 0, 0), 'RightArm': (60, 0, 0), 'RightForeArm': (0, 0, 120), 'RightHand': (0, 70, 0),
          'LeftUpLeg': (85, 0, 0), 'LeftLeg': (-110, 0, 0), 'RightUpLeg': (-20, 0, 0)}),    # golpe por cima com passo
    (48, {'LeftUpLeg': (100, 0, 0), 'LeftLeg': (-130, 0, 0), 'RightUpLeg': (100, 0, 0), 'RightLeg': (-130, 0, 0),
          'Spine02': (25, 0, 0), 'SpineMid': (20, 0, 0), 'Spine': (15, 0, 0)}),               # agachamento do rolamento
    (60, {'RightForeArm': (0, 0, 90), 'RightHand': (-70, 0, 0)}),                          # flexão do punho 70°
    (72, {'RightForeArm': (0, 0, 40), 'RightHand': (60, 0, -30)}),                         # extensão 60° + desvio ulnar 30°
    (84, {'RightShoulder': (0, 0, 15), 'RightArm': (0, 0, 90)}),                           # braço à frente, clavícula projetada
    (96, {'RightArm': (0, 0, -45), 'RightForeArm': (0, 0, 80), 'LeftArm': (0, 0, -45), 'LeftForeArm': (0, 0, -80),
          'SpineMid': (0, 10, 0), 'Spine': (0, 12, 0), 'RightUpLeg': (40, 0, 0), 'LeftUpLeg': (-25, 0, 0), 'LeftLeg': (-30, 0, 0)}),  # corrida
]
def key_pose(arm_obj, poses):
    arm_obj.animation_data_create(); act = bpy.data.actions.new('rig13_stress'); arm_obj.animation_data.action = act
    f1, f2 = GRIPS['Right']['curvaturaDedos']   # curvatura encontrada para a mão direita
    grip = {**{'Right' + k: e for k, e in GRIP_CURL.items()}, 'RightFingers1': (f1, 0, 0), 'RightFingers2': (f2, 0, 0)}
    for f, pose in poses:
        for pb in arm_obj.pose.bones:
            if pb.name.startswith('CTRL_') or 'Twist' in pb.name or 'Helper' in pb.name: continue   # torção e auxiliares vêm dos drivers
            set_rot(pb, pose.get(pb.name, grip.get(pb.name, (0, 0, 0))))
            pb.keyframe_insert('rotation_quaternion', frame=f)
    return act
act = key_pose(arm, STRESS)
bpy.context.scene.frame_start, bpy.context.scene.frame_end = 1, STRESS[-1][0]
bpy.context.scene['rig13_stress_frames'] = [f for f, _ in STRESS]
json.dump({s: {'centro': list(g['centro']), 'lamina': list(g['lamina']), 'guarda': list(g['guarda']),
               **{k: g[k] for k in ('folgaMinM', 'verticesEncostados', 'coberturaSetores', 'curvaturaDedos')}} for s, g in GRIPS.items()},
          open(os.path.join(OUT, 'grip-v13.json'), 'w'), indent=1)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'hunter_rig_v13_source.blend'))
print('DEFORM', len(DEFORM), 'VERTS', len(me.data.vertices), 'TRIS', sum(len(p.vertices) - 2 for p in me.data.polygons))
print('BUILD_OK')
