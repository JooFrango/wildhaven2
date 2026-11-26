# Exporta o GLB do rig v13, reimporta, mede deformação contra o corpo base, aplica os portões e gera renders reais.
#   blender -b labs/hunters/assets/hunter-rig-v13/hunter_rig_v13_source.blend --python labs/hunters/source/rig-v13/export_review_rig_v13.py -- <raiz>
# Comparação justa: o corpo base (19 ossos, sem torção) recebe as MESMAS rotações no mundo, quadro a quadro, e a
# pronação é dividida como a v12 faz (60% no antebraço inteiro, a partir do cotovelo; o resto na mão).
import bpy, sys, os, json, math, hashlib
from mathutils import Vector, Matrix, Quaternion

ROOT = sys.argv[sys.argv.index('--') + 1]
OUT = os.path.join(ROOT, 'labs/hunters/assets/hunter-rig-v13')
REV = os.path.join(ROOT, 'labs/hunters/resultados/rig-v13'); os.makedirs(REV, exist_ok=True)
GLB = os.path.join(OUT, 'hunter_rig_v13_blockout.glb')
BASE = os.path.join(ROOT, 'assets/hunters/hunter-workshop/base/hunter-masculino-1000v/hunter_masculino_1000v.glb')

# ---------- export (só ossos que deformam + espada presa ao socket; drivers amostrados em cada quadro) ----------
arm = bpy.data.objects['Hunter_Rig_v13']
FRAMES = list(bpy.context.scene['rig13_stress_frames'])
bpy.ops.object.select_all(action='DESELECT')
for o in [arm, *arm.children]: o.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True, export_def_bones=True,
                          export_animations=True, export_force_sampling=True, export_animation_mode='ACTIONS',
                          export_frame_range=False, export_yup=True, export_skins=True, export_morph=False, export_apply=False,
                          export_extras=True)   # campos do contrato (fases, contatos de pé, stride) saem em animation.extras

# ---------- reimporta v13 e base lado a lado ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = 60   # antes de importar: o importador converte segundos em quadros pela taxa da cena
def load(path, dx):
    before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=path)
    objs = [o for o in bpy.data.objects if o not in before]
    a = next(o for o in objs if o.type == 'ARMATURE'); m = next(o for o in objs if o.type == 'MESH' and o.find_armature())
    for o in objs:
        if o.parent is None: o.location.x += dx
    bpy.context.view_layer.update(); return a, m, objs
A13, M13, O13 = load(GLB, 0.0)
AB, MB, OB = load(BASE, 1.6)
if AB.animation_data: AB.animation_data.action = None
act = next(x for x in bpy.data.actions if 'stress' in x.name)
A13.animation_data.action = act
sc = bpy.context.scene

def world_rot(a, n, rest=False):
    m = a.data.bones[n].matrix_local if rest else a.pose.bones[n].matrix
    return a.matrix_world.to_quaternion() @ m.to_quaternion()
ORDER = [b.name for b in AB.data.bones]
REST_B = {pb.name: pb.matrix_basis.copy() for pb in AB.pose.bones}
def transfer(frame):
    sc.frame_set(frame); bpy.context.view_layer.update()
    for pb in AB.pose.bones: pb.matrix_basis = REST_B[pb.name]
    bpy.context.view_layer.update()
    out = {}
    for s in ('Right', 'Left'):
        rel_p = A13.pose.bones[s + 'ForeArm'].matrix.to_quaternion().inverted() @ A13.pose.bones[s + 'Hand'].matrix.to_quaternion()
        rel_r = A13.data.bones[s + 'ForeArm'].matrix_local.to_quaternion().inverted() @ A13.data.bones[s + 'Hand'].matrix_local.to_quaternion()
        out[s] = (rel_r.inverted() @ rel_p).to_swing_twist('Y')[1]
    for n in ORDER:
        if n not in A13.pose.bones: continue
        D = world_rot(A13, n) @ world_rot(A13, n, True).inverted()
        if n.endswith('ForeArm'):
            s = n[:-7]; ax = A13.matrix_world.to_quaternion() @ (A13.pose.bones[s + 'Hand'].head - A13.pose.bones[n].head).normalized()
            D = Quaternion(ax, .6 * out[s]) @ D                     # v12: 60% da pronação gira o antebraço inteiro
        target = D @ world_rot(AB, n, True)
        pb = AB.pose.bones[n]; loc = pb.matrix.translation.copy()
        pb.matrix = Matrix.Translation(loc) @ (AB.matrix_world.to_quaternion().inverted() @ target).to_matrix().to_4x4()
        bpy.context.view_layer.update()
    return out

def evaluated(m):
    dg = bpy.context.evaluated_depsgraph_get(); e = m.evaluated_get(dg); mm = e.to_mesh()
    pts = [m.matrix_world @ v.co for v in mm.vertices]; e.to_mesh_clear(); return pts
def rest_pts(m): return [m.matrix_world @ v.co for v in m.data.vertices]
def head(a, n, rest=False): return a.matrix_world @ (a.data.bones[n].head_local if rest else a.pose.bones[n].head)
# anéis: (osso do início, osso do fim, posição u no segmento, osso cuja dobra é descontada na torção)
RINGS = {'ombro': ('RightArm', 'RightForeArm', .15, 'RightArm'), 'cotovelo': ('RightArm', 'RightForeArm', .97, 'RightArm'),
         'antebraco_15': ('RightForeArm', 'RightHand', .15, 'RightForeArm'), 'antebraco_50': ('RightForeArm', 'RightHand', .5, 'RightForeArm'),
         'punho_90': ('RightForeArm', 'RightHand', .9, 'RightForeArm'), 'joelho': ('LeftUpLeg', 'LeftLeg', .95, 'LeftUpLeg'),
         'canela_50': ('LeftLeg', 'LeftFoot', .5, 'LeftLeg')}
def ring_ids(a, m, k):
    b0, b1, u, _ = RINGS[k]; p0, p1 = head(a, b0, True), head(a, b1, True); d = p1 - p0; ids = []
    for i, p in enumerate(rest_pts(m)):
        t = (p - p0).dot(d) / d.length_squared
        if abs(t - u) < .07 and ((p - p0) - d * t).length < .1: ids.append(i)
    return ids
def axis(a, k, rest): b0, b1, _, _ = RINGS[k]; return head(a, b0, rest), head(a, b1, rest)
def radius(pts, ids, p0, p1):
    d = (p1 - p0).normalized(); return sum(((pts[i] - p0) - d * (pts[i] - p0).dot(d)).length for i in ids) / max(1, len(ids))
def surface_twist(m, pts, ids, p0r, p1r, p0, p1, swing):
    """Ângulo médio (graus) com que a superfície do anel gira em torno do eixo, descontada a dobra do membro."""
    ar, ap = (p1r - p0r).normalized(), (p1 - p0).normalized(); R = rest_pts(m); acc = 0
    for i in ids:
        r0 = R[i] - p0r; r0 = swing @ (r0 - ar * r0.dot(ar)); r0 = r0 - ap * r0.dot(ap); r1 = pts[i] - p0; r1 = r1 - ap * r1.dot(ap)
        if r0.length > 1e-6 and r1.length > 1e-6: acc += math.degrees(math.atan2(r0.cross(r1).dot(ap), r0.dot(r1)))
    return acc / max(1, len(ids))
transfer(1)
IDS = {'v13': {k: ring_ids(A13, M13, k) for k in RINGS}, 'base_v12': {k: ring_ids(AB, MB, k) for k in RINGS}}
REST = {'v13': {k: radius(rest_pts(M13), v, *axis(A13, k, True)) for k, v in IDS['v13'].items()},
        'base_v12': {k: radius(rest_pts(MB), v, *axis(AB, k, True)) for k, v in IDS['base_v12'].items()}}
# Portões da E1 (só o v13). Limites do plano, seção 9; "torção perto do cotovelo" mede o papel de bala.
GATES = {'raio_min': {'ombro': .75, 'cotovelo': .70, 'antebraco_15': .80, 'antebraco_50': .85, 'punho_90': .85, 'joelho': .65, 'canela_50': .85},
         'torcao_max_graus': {'antebraco_15': 15}}
metrics = {'frames': {}, 'ringVertices': {n: {k: len(v) for k, v in d.items()} for n, d in IDS.items()}, 'gates': GATES, 'violacoes': []}
for f in FRAMES:
    tw = transfer(f); pts = {'v13': evaluated(M13), 'base_v12': evaluated(MB)}
    row = {'pronacaoGraus': round(math.degrees(tw['Right']), 1), 'raioRelativo': {}, 'torcaoSuperficieGraus': {}}
    for n, (a, m) in {'v13': (A13, M13), 'base_v12': (AB, MB)}.items():
        row['raioRelativo'][n] = {k: round(radius(pts[n], ids, *axis(a, k, False)) / REST[n][k], 3) for k, ids in IDS[n].items()}
        row['torcaoSuperficieGraus'][n] = {}
        for k, ids in IDS[n].items():
            sb = RINGS[k][3]; sw = world_rot(A13, sb) @ world_rot(A13, sb, True).inverted()
            row['torcaoSuperficieGraus'][n][k] = round(surface_twist(m, pts[n], ids, *axis(a, k, True), *axis(a, k, False), sw), 1)
    for k, lim in GATES['raio_min'].items():
        if row['raioRelativo']['v13'][k] < lim: metrics['violacoes'].append(f'q{f} raio {k} {row["raioRelativo"]["v13"][k]} < {lim}')
    for k, lim in GATES['torcao_max_graus'].items():
        if abs(row['torcaoSuperficieGraus']['v13'][k]) > lim: metrics['violacoes'].append(f'q{f} torção {k} {row["torcaoSuperficieGraus"]["v13"][k]} > {lim}')
    metrics['frames'][f] = row
    print('FRAME', f, json.dumps(row))
print('VIOLACOES', metrics['violacoes'])

# ---------- renders reais (Workbench, textura do GLB) ----------
sc.render.engine = 'BLENDER_WORKBENCH'; sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'TEXTURE'
sc.world = bpy.data.worlds.new('w')
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'
def shot(center, scale, d, path, rx=720, ry=900):
    sc.render.resolution_x, sc.render.resolution_y = rx, ry
    cam.data.ortho_scale = scale; d = Vector(d).normalized(); cam.location = Vector(center) + d * 4
    cam.rotation_euler = (Vector(center) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = path; bpy.ops.render.render(write_still=True)
for f in os.listdir(REV):
    if f.endswith('.png'): os.remove(os.path.join(REV, f))
VIEWS = {'frente': (0, -1, .05), 'perfil': (-1, 0, .05), 'tres-quartos': (-.7, -.7, .25)}
for o in OB: o.hide_render = True
transfer(1)
for k, d in VIEWS.items(): shot(Vector((0, 0, .9)), 2.0, d, os.path.join(REV, f'v13_repouso_{k}.png'))
for o in OB: o.hide_render = False
for f in FRAMES[1:]:
    transfer(f)
    for k, d in VIEWS.items():
        shot(Vector((.8, 0, .9)), 3.6, d, os.path.join(REV, f'estresse_q{f:02d}_{k}.png'), 1200, 900)
    for n, a in (('v13', A13), ('base', AB)):   # aproximação do antebraço direito, de lado
        e, wv = head(a, 'RightForeArm'), head(a, 'RightHand'); ax = (wv - e).normalized()
        side = ax.cross(Vector((0, 0, 1))).normalized() if abs(ax.z) < .9 else Vector((0, -1, 0))
        shot((e + wv) / 2, .5, side + Vector((0, 0, .25)), os.path.join(REV, f'antebraco_q{f:02d}_{n}.png'), 640, 640)
# mão com a espada (repouso, pose de empunhadura): de cima e de frente
transfer(1)
h = head(A13, 'RightHand')
for k, d in {'mao_frente': (0, -1, .1), 'mao_cima': (0, -.15, 1), 'mao_palma': (0, .1, -1)}.items():
    for o in OB: o.hide_render = True
    shot(h + Vector((-.05, -.05, -.03)), .35, d, os.path.join(REV, f'v13_{k}.png'), 640, 640)
metrics['glb'] = {'path': os.path.relpath(GLB, ROOT).replace('\\', '/'), 'bytes': os.path.getsize(GLB),
                  'sha256': hashlib.sha256(open(GLB, 'rb').read()).hexdigest()}
json.dump(metrics, open(os.path.join(REV, 'deformacao-v13.json'), 'w'), indent=1)
print('REVIEW_OK')
