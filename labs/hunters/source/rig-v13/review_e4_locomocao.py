# E4, lote 1 — portões e vídeos reais da locomoção, medidos no GLB exportado e reimportado.
#   blender -b --python labs/hunters/source/rig-v13/review_e4_locomocao.py -- <raiz>
import bpy, sys, os, json, math
from mathutils import Vector, Quaternion

ROOT = sys.argv[sys.argv.index('--') + 1]
GLB = os.path.join(ROOT, 'labs/hunters/assets/hunter-rig-v13/hunter_rig_v13_blockout.glb')
REV = os.path.join(ROOT, 'labs/hunters/resultados/pve2-e4'); os.makedirs(REV, exist_ok=True)
FPS = 60
# Deslizamento: 2 mm por quadro com o pé inteiro no chão (contrato); 5 mm no rolamento calcanhar/bola do pé, onde um pivô
# fixo não acompanha a curva da sola. Medido contra o chão, que no clipe em lugar anda para trás a speedMs.
GATES = {'slideMmPorQuadro': 2.0, 'slideRolamentoMm': 5.0, 'peAbaixoDoChaoMm': 5.0, 'plantadoAcimaMm': 15.0, 'costuraGraus': .5, 'folgaLaminaM': .02, 'pontaAcimaDoChaoM': .05,
         'punho': {'extensao': 60, 'flexao': 70, 'radial': 20, 'ulnar': 35}}

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = 60   # antes de importar: o importador converte segundos em quadros pela taxa da cena
bpy.ops.import_scene.gltf(filepath=GLB)
gl = json.loads(open(GLB, 'rb').read()[20:20 + int.from_bytes(open(GLB, 'rb').read()[12:16], 'little')])
EXTRAS = {a['name']: a.get('extras', {}) for a in gl['animations']}
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
body = next(o for o in bpy.data.objects if o.type == 'MESH' and o.find_armature())
sword = next(o for o in bpy.data.objects if o.type == 'MESH' and 'Espada' in o.name)
sc = bpy.context.scene; sc.render.fps = FPS
P, Bn = arm.pose.bones, arm.data.bones
CLIPS = [n for n in EXTRAS if n.startswith('pve2_a_') or n == 'pve2_b_sword_guard']   # golpes e rolamentos: review_e4_combate.py
W = lambda n: arm.matrix_world @ P[n].matrix
REST = {n: arm.matrix_world @ Bn[n].matrix_local for n in Bn.keys()}
gi = {g.name: g.index for g in body.vertex_groups}
SKIP = {gi[n] for n in gi if n.startswith('Right') and any(k in n for k in ('Hand', 'Fingers', 'Thumb', 'ForeArm'))}
BODY_IDS = [v.index for v in body.data.vertices if not any(g.group in SKIP and g.weight > .2 for g in v.groups)]
FOOT_IDS = {s: [v.index for v in body.data.vertices if any(g.group in (gi[s + 'Foot'], gi[s + 'ToeBase']) and g.weight > .5 for g in v.groups)] for s in ('Left', 'Right')}
def mesh_pts(o):
    dg = bpy.context.evaluated_depsgraph_get(); e = o.evaluated_get(dg); m = e.to_mesh()
    pts = [o.matrix_world @ v.co for v in m.vertices]; e.to_mesh_clear(); return pts
def wrist(side):
    """Rotação do punho (mão em relação ao antebraço, nos eixos da pose T): flexão/extensão, desvio, torção."""
    D = lambda n: W(n).to_quaternion() @ REST[n].to_quaternion().inverted()
    Wq = D(side + 'ForeArm').inverted() @ D(side + 'Hand')
    f = Vector((-1, 0, 0)) if side == 'Right' else Vector((1, 0, 0))
    sw, tw = Wq.to_swing_twist('X'); ax, ang = sw.to_axis_angle()
    rv = Quaternion(Vector((1, 0, 0)), -tw) @ (ax * ang); deg = math.degrees   # flexão e desvio no referencial da mão (sem a pronação)
    # mão direita: +Y = extensão, +Z = radial (polegar à frente na pose T); esquerda espelhada em Y
    ext = deg(rv.y) * (1 if side == 'Right' else -1); rad = deg(rv.z) * (1 if side == 'Right' else -1)
    return ext, rad, deg(tw)

def set_cyclic(act):
    for lay in act.layers:
        for st in lay.strips:
            for cb in st.channelbags:
                for fc in cb.fcurves:
                    if not any(m.type == 'CYCLES' for m in fc.modifiers): fc.modifiers.new('CYCLES')

result = {'gates': GATES, 'clips': {}, 'violacoes': []}
for name in CLIPS:
    ex = EXTRAS[name]; act = bpy.data.actions[name]; arm.animation_data.action = act
    f0 = int(act.frame_range[0]); N = round(ex['duration'] * FPS); v = ex.get('speedMs', 0)
    fc = ex.get('footContacts', {}); r = {'frames': N, 'speedMs': v, 'stride': ex.get('stride')}
    slide, slide_roll, below, high, wr, clear = 0, 0, 0, 0, {'ext': [0, 0], 'rad': [0, 0], 'tw': [0, 0]}, 9
    roll = ex.get('footRoll'); tipz = 9
    def rolling(s, t):   # fase do apoio: calcanhar (< flat) ou bola do pé (> heelOff)
        if not roll: return False
        for a, b in fc.get(s.lower(), []):
            if a - 1e-6 <= t <= b + 1e-6 and b > a:
                u = (t - a) / (roll['duty'] * N / FPS); return u < roll['flat'] or u > roll['heelOff']
        return False
    prev = {}
    for n in range(N + 1):
        sc.frame_set(f0 + n); t = n / FPS; back = Vector((0, v * t, 0))     # em lugar: o chão "anda" para trás a v
        pts = mesh_pts(body)
        for s in ('Left', 'Right'):
            on = any(a - 1e-6 <= t <= b + 1e-6 for a, b in fc.get(s.lower(), []))
            sole = sorted(FOOT_IDS[s], key=lambda i: pts[i].z)[:6]          # os 6 vértices mais baixos da sola
            low = min(pts[i].z for i in sole); below = max(below, -low)
            if on:
                high = max(high, low)
                cur = {i: pts[i] - back for i in sole}
                if s in prev and prev[s][0] == n - 1:
                    common = [i for i in cur if i in prev[s][1]]
                    if common:
                        d_ = min((cur[i] - prev[s][1][i]).length for i in common)
                        if rolling(s, t) or rolling(s, t - 1 / FPS): slide_roll = max(slide_roll, d_)
                        else: slide = max(slide, d_)
                prev[s] = (n, {i: pts[i] - back for i in FOOT_IDS[s]})
        for s in ('Left', 'Right'):
            e_, d_, tw_ = wrist(s)
            for k, val in (('ext', e_), ('rad', d_), ('tw', tw_)): wr[k] = [min(wr[k][0], val), max(wr[k][1], val)]
        sp = mesh_pts(sword); blade = sp[::2]; tipz = min(tipz, min(q.z for q in sp))
        clear = min(clear, min(min((pts[i] - q).length for i in BODY_IDS[::3]) for q in blade))
    sc.frame_set(f0); a0 = {b.name: W(b.name).to_quaternion() for b in P}
    sc.frame_set(f0 + N); seam = max(math.degrees(a0[b.name].rotation_difference(W(b.name).to_quaternion()).angle) for b in P)
    r.update(slideMmPorQuadro=round(slide * 1000, 2), slideRolamentoMm=round(slide_roll * 1000, 2), peAbaixoDoChaoMm=round(below * 1000, 1), plantadoAcimaMm=round(high * 1000, 1),
             costuraGraus=round(seam, 3), folgaLaminaM=round(clear, 3), pontaAcimaDoChaoM=round(tipz, 3), punho={k: [round(x, 1) for x in val] for k, val in wr.items()})
    G = GATES; viol = []
    if loop := ex.get('loop'):
        if seam > G['costuraGraus']: viol.append(f'costura {seam:.2f}°')
    if r['slideMmPorQuadro'] > G['slideMmPorQuadro']: viol.append(f"deslizamento {r['slideMmPorQuadro']} mm")
    if r['slideRolamentoMm'] > G['slideRolamentoMm']: viol.append(f"deslizamento no rolamento {r['slideRolamentoMm']} mm")
    if r['peAbaixoDoChaoMm'] > G['peAbaixoDoChaoMm']: viol.append(f"pé {r['peAbaixoDoChaoMm']} mm abaixo do chão")
    if r['plantadoAcimaMm'] > G['plantadoAcimaMm']: viol.append(f"pé plantado {r['plantadoAcimaMm']} mm acima do chão")
    if tipz < G['pontaAcimaDoChaoM']: viol.append(f'ponta da espada a {tipz:.3f} m do chão')
    if clear < G['folgaLaminaM']: viol.append(f'lâmina a {clear:.3f} m do corpo')
    pu = G['punho']
    if wr['ext'][1] > pu['extensao'] or -wr['ext'][0] > pu['flexao'] or wr['rad'][1] > pu['radial'] or -wr['rad'][0] > pu['ulnar']: viol.append(f"punho fora do limite {r['punho']}")
    r['violacoes'] = viol; result['violacoes'] += [f'{name}: {x}' for x in viol]
    result['clips'][name] = r
    print('GATE', name, json.dumps(r, ensure_ascii=False))

# ---------- vídeos: três ângulos, três ciclos, chão com faixas que andam à velocidade do clipe ----------
sc.render.engine = 'BLENDER_WORKBENCH'; sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'TEXTURE'
sc.world = bpy.data.worlds.new('w'); sc.render.resolution_x, sc.render.resolution_y = 640, 720
mat = bpy.data.materials.new('chao'); mat.diffuse_color = (.30, .30, .30, 1)
mat2 = bpy.data.materials.new('faixa'); mat2.diffuse_color = (.75, .72, .62, 1)
bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, -.002)); floor = bpy.context.object; floor.data.materials.append(mat)
strips = []
for k in range(-30, 31):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, k * .5, 0)); s_ = bpy.context.object; s_.scale = (3, .02, .001); s_.data.materials.append(mat2); strips.append(s_)
sc.display.shading.color_type = 'MATERIAL'
for o in (body, sword):   # personagem com a cor da textura do GLB
    for m in o.data.materials:
        m.diffuse_color = (.62, .45, .32, 1) if o is body else (.75, .77, .8, 1)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 2.4
VIEWS = {'perfil': Vector((-1, 0, .08)), 'frente': Vector((0, -1, .08)), 'tres-quartos': Vector((-.7, -.7, .3))}
sc.render.image_settings.media_type = 'VIDEO'; sc.render.image_settings.file_format = 'FFMPEG'; sc.render.ffmpeg.format = 'MPEG4'; sc.render.ffmpeg.codec = 'H264'
sc.render.ffmpeg.constant_rate_factor = 'MEDIUM'
for name in CLIPS:
    ex = EXTRAS[name]; act = bpy.data.actions[name]; arm.animation_data.action = act; set_cyclic(act)
    f0 = int(act.frame_range[0]); N = round(ex['duration'] * FPS); cyc = 3 if N < 120 else 1; v = ex.get('speedMs', 0)
    sc.frame_start, sc.frame_end = f0, f0 + N * cyc - 1
    for s_, k in zip(strips, range(-30, 31)):
        s_.animation_data_clear(); s_.location.y = k * .5; s_.keyframe_insert('location', index=1, frame=f0)
        s_.location.y = k * .5 + v * (N * cyc) / FPS; s_.keyframe_insert('location', index=1, frame=f0 + N * cyc)
        for fc_ in s_.animation_data.action.layers[0].strips[0].channelbags[0].fcurves:
            for kp in fc_.keyframe_points: kp.interpolation = 'LINEAR'
    for vn, d in VIEWS.items():
        c = Vector((0, 0, .85)); cam.location = c + d.normalized() * 6
        cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(REV, f'{name}_{vn}.mp4'); bpy.ops.render.render(animation=True)
    # quadros-chave em PNG (perfil): contato, meio do apoio, impulso, voo
    sc.render.image_settings.media_type = 'IMAGE'; sc.render.image_settings.file_format = 'PNG'
    for lbl, u in (('a', 0), ('b', .25), ('c', .5), ('d', .75)):
        sc.frame_set(f0 + round(u * N)); c = Vector((0, 0, .85)); cam.location = c + VIEWS['perfil'].normalized() * 6
        cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(REV, f'{name}_perfil_{lbl}.png'); bpy.ops.render.render(write_still=True)
    sc.render.image_settings.media_type = 'VIDEO'; sc.render.image_settings.file_format = 'FFMPEG'
import hashlib
result['glb'] = {'bytes': os.path.getsize(GLB), 'sha256': hashlib.sha256(open(GLB, 'rb').read()).hexdigest()}   # medidas feitas sobre este arquivo
json.dump(result, open(os.path.join(REV, 'portoes-e4.json'), 'w'), indent=1, ensure_ascii=False)
print('VIOLACOES', result['violacoes'])
print('REVIEW_E4_OK')
