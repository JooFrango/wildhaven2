# E4, lote 2 — portões, trajetórias e vídeos reais dos golpes, medidos no GLB exportado e reimportado.
#   blender -b --python labs/hunters/source/rig-v13/review_e4_combate.py -- <raiz>
# Gera também src/trajetorias-pve2.js: fonte única de tempo, fases, janelas, contatos de pé, curva de deslocamento e, nos
# golpes, punho (em alturas de corpo, 1,70 m) e direção da lâmina por quadro, nos eixos do glTF (+Z = frente, +Y = cima),
# no mesmo formato de trajetorias-pve1.js (contrato §6). O contato é calculado aqui: o quadro da janela ativa em que a
# lâmina chega mais longe à frente.
import bpy, sys, os, json, math, hashlib
from mathutils import Vector, Quaternion

ROOT = sys.argv[sys.argv.index('--') + 1]
GLB = os.environ.get('E4_GLB') or os.path.join(ROOT, 'labs/hunters/assets/hunter-rig-v13/hunter_rig_v13_blockout.glb')   # E4_GLB: revisar outro arquivo
REV = os.path.join(ROOT, 'labs/hunters/resultados/pve2-e4'); os.makedirs(REV, exist_ok=True)
TRAJ = os.path.join(ROOT, 'labs/hunters/src/trajetorias-pve2.js')
FPS, NATIVE_H = 60, 1.70
# Anatomia: joelho só dobra para trás (hiperextensão até 5°); quadril estende no máximo 30°.
# Deformação (calibrada nos clipes aceitos, sem os dedos fechados no cabo: máx. 85 triângulos ruins, 17 na coxa, 7 cm braço–cabeça):
# triângulo ruim = área posada < 35% ou > 200% da área em repouso.
GATES = {'joelhoHiperextensaoGraus': 5, 'quadrilExtensaoGraus': 30, 'triangulosRuins': 90, 'triangulosRuinsCoxa': 20, 'bracoCabecaM': .05,
         'costuraGraus': .5, 'slideMmPorQuadro': 2.0, 'folgaLaminaM': .02, 'punhoCabecaM': .16, 'cotoveloNoContatoGraus': 140, 'pontaAcimaDoChaoM': 0.0,
         'punho': {'extensao': 60, 'flexao': 70, 'radial': 20, 'ulnar': 35}}

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = FPS   # antes de importar: o importador converte segundos em quadros pela taxa da cena
bpy.ops.import_scene.gltf(filepath=GLB)
raw = open(GLB, 'rb').read(); gl = json.loads(raw[20:20 + int.from_bytes(raw[12:16], 'little')])
EXTRAS = {a['name']: a.get('extras', {}) for a in gl['animations']}
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
body = next(o for o in bpy.data.objects if o.type == 'MESH' and o.find_armature())
sword = next(o for o in bpy.data.objects if o.type == 'MESH' and 'Espada' in o.name)
sc = bpy.context.scene; P, Bn = arm.pose.bones, arm.data.bones
W = lambda n: arm.matrix_world @ P[n].matrix
REST = {n: arm.matrix_world @ Bn[n].matrix_local for n in Bn.keys()}
gi = {g.name: g.index for g in body.vertex_groups}
SKIP = {gi[n] for n in gi if n.startswith('Right') and any(k in n for k in ('Hand', 'Fingers', 'Thumb', 'ForeArm'))}
BODY_IDS = [v.index for v in body.data.vertices if not any(g.group in SKIP and g.weight > .2 for g in v.groups)]
FOOT_IDS = {s: [v.index for v in body.data.vertices if any(g.group in (gi[s + 'Foot'], gi[s + 'ToeBase']) and g.weight > .5 for g in v.groups)] for s in ('Left', 'Right')}
names = {g.index: g.name for g in body.vertex_groups}
def _dom(v): return names[max(v.groups, key=lambda g: g.weight).group] if v.groups else '-'
TRI = [tuple(p.vertices) for p in body.data.polygons]
REG = [_dom(body.data.vertices[t[0]]) for t in TRI]
SKIP_TRI = {i for i, n in enumerate(REG) if 'Finger' in n or 'Thumb' in n}
HEAD = [v.index for v in body.data.vertices if _dom(v) in ('Head', 'neck')][::2]
ARMS = [v.index for v in body.data.vertices if any(k in _dom(v) for k in ('Hand', 'Finger', 'Thumb', 'ForeArm'))][::2]
def areas(pts): return [((pts[b] - pts[a]).cross(pts[c] - pts[a])).length / 2 for a, b, c in TRI]
A0 = areas([body.matrix_world @ v.co for v in body.data.vertices])
def hinge(parent, child):
    """Rotação do filho em relação ao pai em torno do eixo X do repouso (graus): joelho + = dobra para trás; quadril + = extensão."""
    D = lambda n: W(n).to_quaternion() @ REST[n].to_quaternion().inverted()
    q = D(parent).inverted() @ D(child)
    if q.w < 0: q.negate()   # menor arco: ângulo em [0°, 180°]
    ax, ang = q.to_axis_angle(); return math.degrees((ax * ang).x)
def mesh_pts(o):
    dg = bpy.context.evaluated_depsgraph_get(); e = o.evaluated_get(dg); m = e.to_mesh()
    pts = [o.matrix_world @ v.co for v in m.vertices]; e.to_mesh_clear(); return pts
def wrist(side):
    D = lambda n: W(n).to_quaternion() @ REST[n].to_quaternion().inverted()
    sw, tw = (D(side + 'ForeArm').inverted() @ D(side + 'Hand')).to_swing_twist('X'); ax, ang = sw.to_axis_angle()
    rv = Quaternion(Vector((1, 0, 0)), -tw) @ (ax * ang)   # flexão e desvio no referencial da mão: a pronação gira esses eixos
    sg = 1 if side == 'Right' else -1
    return math.degrees(rv.y) * sg, math.degrees(rv.z) * sg, math.degrees(tw)
def socket():
    m = W('WeaponSocket_R'); return m.to_translation(), (m.to_quaternion() @ Vector((0, 1, 0))).normalized()
def elbow_deg(s='Right'):
    a, e, h = P[s + 'Arm'].head, P[s + 'ForeArm'].head, P[s + 'Hand'].head; return math.degrees((a - e).angle(h - e))
def pose_rot():
    return {b.name: W(b.name).to_quaternion() for b in P}
gl_axes = lambda v: [v.x, v.z, -v.y]   # Blender -> glTF (+Y cima, +Z frente)

CLIPS = [n for n in EXTRAS if n.startswith('pve2_c_') or '_roll_' in n]
arm.animation_data.action = bpy.data.actions['pve2_b_sword_guard']; sc.frame_set(int(bpy.data.actions['pve2_b_sword_guard'].frame_range[0])); GUARD = pose_rot()
result = {'gates': GATES, 'clips': {}, 'violacoes': []}; traj = {}
for name in CLIPS:
    ex = EXTRAS[name]; act = bpy.data.actions[name]; arm.animation_data.action = act
    f0 = int(act.frame_range[0]); N = round(ex['duration'] * FPS); ph = ex['phases']; fc = ex['footContacts']
    curve = ex['rootMotion'].get('curve', [0] * (N + 1))
    slide_at, clear_at, tip_at = None, None, None
    knee_min, hip_ext, bad_max, bad_leg, arm_head, bad_at = 999, -999, 0, 0, 9, None
    slide, clear, head, tipz, wr, frames, reach = 0, 9, 9, 9, {'ext': [0, 0], 'rad': [0, 0], 'tw': [0, 0]}, [], []
    prev = {}
    for n in range(N + 1):
        sc.frame_set(f0 + n); t = n / FPS; r = curve[n]; pts = mesh_pts(body)
        for s in ('Left', 'Right'):
            on = any(a - 1e-6 <= t <= b + 1e-6 for a, b in fc.get(s.lower(), []))
            sole = sorted(FOOT_IDS[s], key=lambda i: pts[i].z)[:6]
            ax = ex['rootMotion'].get('axis', 'z')   # chão parado: o corpo avança r (-Y em z; +X em x), o pé em lugar recua
            cur = {i: pts[i] - Vector((0, r, 0)) if ax == 'z' else pts[i] + Vector((r, 0, 0)) for i in FOOT_IDS[s]}
            if on and s in prev and prev[s][0] == n - 1:
                d_ = min((cur[i] - prev[s][1][i]).length for i in sole)
                if d_ > slide: slide, slide_at = d_, (n, s)
            prev[s] = (n, cur) if on else (None, {})
        A = areas(pts); bad = [i for i in range(len(TRI)) if i not in SKIP_TRI and A0[i] > 1e-7 and not (.35 <= A[i] / A0[i] <= 2.0)]
        if len(bad) > bad_max: bad_max, bad_at = len(bad), n
        bad_leg = max(bad_leg, sum(1 for i in bad if 'UpLeg' in REG[i]))
        arm_head = min(arm_head, min(min((pts[i] - pts[j]).length for j in ARMS) for i in HEAD))
        for s in ('Left', 'Right'):
            knee_min = min(knee_min, hinge(s + 'UpLeg', s + 'Leg')); hip_ext = max(hip_ext, hinge('Hips', s + 'UpLeg'))
        for s in ('Left', 'Right'):
            e_, d_, tw_ = wrist(s)
            for k, val in (('ext', e_), ('rad', d_), ('tw', tw_)): wr[k] = [min(wr[k][0], val), max(wr[k][1], val)]
        sp = mesh_pts(sword); tz = min(q.z for q in sp)
        if tz < tipz: tipz, tip_at = tz, n
        cl = min(min((pts[i] - q).length for i in BODY_IDS[::3]) for q in sp[::2])
        if cl < clear: clear, clear_at = cl, n
        p, d = socket(); head = min(head, (p - (arm.matrix_world @ P['Head'].head)).length)
        frames.append([round(x / NATIVE_H, 5) for x in gl_axes(p)] + [round(x, 5) for x in gl_axes(d)])
        reach.append(-(p + d * .45).y + (r if ex['rootMotion'].get('axis', 'z') == 'z' else 0))   # alcance à frente no mundo (parte que corta: 60% da lâmina)
    a0, a1 = (round(ph['activeStart'] * FPS), round(ph['activeEnd'] * FPS)) if 'activeStart' in ph else (0, 0)   # laço da carga: sem janela ativa
    contact = max(range(a0, a1 + 1), key=lambda n: reach[n]) if a1 > a0 else None
    sc.frame_set(f0); first = pose_rot(); sc.frame_set(f0 + N); last = pose_rot()
    ang = lambda A, Bq: max(math.degrees(A[k].rotation_difference(Bq[k]).angle) for k in A if not k.startswith('WeaponSocket'))
    seam_in = None if ex.get('startPose') or ex.get('loop') else ang(first, GUARD)
    seam_out = ang(first, last) if ex.get('loop') else ang(last, GUARD)
    el = None
    if contact is not None: sc.frame_set(f0 + contact); el = elbow_deg()
    r_ = dict(frames=N, contato=round(contact / FPS, 4) if contact is not None else None, costuraEntrada=seam_in and round(seam_in, 3), costuraSaida=round(seam_out, 3),
              slideMmPorQuadro=round(slide * 1000, 2), folgaLaminaM=round(clear, 3), punhoCabecaM=round(head, 3), pontaAcimaDoChaoM=round(tipz, 3),
              cotoveloNoContatoGraus=el and round(el, 1), joelhoMinGraus=round(knee_min, 1), quadrilExtensaoMaxGraus=round(hip_ext, 1),
              triangulosRuins=bad_max, triangulosRuinsCoxa=bad_leg, bracoCabecaM=round(arm_head, 3), pior={'deslizamento': slide_at, 'folga': clear_at, 'ponta': tip_at}, punho={k: [round(x, 1) for x in v] for k, v in wr.items()}, avancoM=curve[-1])
    G = GATES; viol = []; exc = set(ex.get('gateExceptions', []))   # rolamento: lâmina no chão e no corpo durante a cambalhota (documentado)
    r_['excecoes'] = sorted(exc)
    if seam_in is not None and seam_in > G['costuraGraus']: viol.append(f'costura de entrada {seam_in:.2f}°')
    if seam_out > G['costuraGraus']: viol.append(f'costura de saída {seam_out:.2f}°')
    if slide * 1000 > G['slideMmPorQuadro']: viol.append(f'pé plantado desliza {slide * 1000:.1f} mm')
    if clear < G['folgaLaminaM'] and 'folgaLaminaM' not in exc: viol.append(f'lâmina a {clear:.3f} m do corpo')
    if head < G['punhoCabecaM']: viol.append(f'punho a {head:.3f} m da cabeça')
    if tipz < G['pontaAcimaDoChaoM'] and 'pontaAcimaDoChaoM' not in exc: viol.append(f'ponta {tipz:.3f} m (abaixo do chão)')
    if el is not None and el < G['cotoveloNoContatoGraus']: viol.append(f'cotovelo {el:.0f}° no contato')
    if knee_min < -G['joelhoHiperextensaoGraus']: viol.append(f'joelho dobra para a frente ({knee_min:.0f}°)')
    if hip_ext > G['quadrilExtensaoGraus']: viol.append(f'quadril estendido {hip_ext:.0f}°')
    if bad_max > G['triangulosRuins']: viol.append(f'{bad_max} triângulos deformados (quadro {bad_at})')
    if bad_leg > G['triangulosRuinsCoxa']: viol.append(f'{bad_leg} triângulos deformados na coxa')
    if arm_head < G['bracoCabecaM']: viol.append(f'braço a {arm_head:.3f} m da cabeça')
    pu = G['punho']
    if wr['ext'][1] > pu['extensao'] or -wr['ext'][0] > pu['flexao'] or wr['rad'][1] > pu['radial'] or -wr['rad'][0] > pu['ulnar']: viol.append(f"punho fora do limite {r_['punho']}")
    r_['violacoes'] = viol; result['violacoes'] += [f'{name}: {x}' for x in viol]; result['clips'][name] = r_
    phases = dict(ph)
    if contact is not None: phases['contact'] = round(contact / FPS, 4)
    traj[name] = {'module': ex['module'], 'weapon': 'sword', 'loop': bool(ex.get('loop')), 'duration': ex['duration'], 'fps': FPS,
                  'impact': phases.get('contact'), 'phases': phases, 'interrupts': ex.get('interrupts', []), 'footContacts': fc,
                  'rootMotion': ex['rootMotion'], **({'startPose': ex['startPose']} if ex.get('startPose') else {}), 'frames': frames}
    print('GATE', name, json.dumps(r_, ensure_ascii=False))
for name, ex in EXTRAS.items():   # locomoção e guarda: só tempo, contatos e passada
    if name.startswith('pve2_') and name not in traj:
        traj[name] = {'module': ex['module'], 'weapon': 'sword', 'loop': True, 'duration': ex['duration'], 'fps': FPS, 'footContacts': ex['footContacts'],
                      'rootMotion': ex['rootMotion'], **({'stride': ex['stride'], 'speedMs': ex['speedMs']} if 'stride' in ex else {}),
                      **({'grip': ex['bladeCarry']['grip']} if 'bladeCarry' in ex else {})}
if not os.environ.get('E4_GLB'): open(TRAJ, 'w', encoding='utf-8', newline='\n').write(   # revisando outro GLB: não sobrescreve
    '// GERADO por labs/hunters/source/rig-v13/review_e4_combate.py a partir do GLB do rig v13. Não editar à mão.\n'
    '// Contrato hunter-pve-v02: tempo, fases (contato calculado), janelas, contatos de pé, curva de deslocamento (eixo z = frente,\n'
    '// metros nativos de 1,70 m) e, nos golpes, punho (alturas de corpo) e direção da lâmina por quadro a 60 fps, eixos do glTF.\n'
    'export default ' + json.dumps(traj, separators=(',', ':'), ensure_ascii=False) + ';\n')

# ---------- vídeos: o corpo avança pela curva da raiz sobre um chão parado ----------
sc.render.engine = 'BLENDER_WORKBENCH'; sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'MATERIAL'
sc.world = bpy.data.worlds.new('w'); sc.render.resolution_x, sc.render.resolution_y = 720, 720
mat = bpy.data.materials.new('chao'); mat.diffuse_color = (.30, .30, .30, 1); mat2 = bpy.data.materials.new('faixa'); mat2.diffuse_color = (.75, .72, .62, 1)
bpy.ops.mesh.primitive_plane_add(size=14, location=(0, 0, -.002)); bpy.context.object.data.materials.append(mat)
for k in range(-14, 15):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, k * .5, 0)); s_ = bpy.context.object; s_.scale = (4, .02, .001); s_.data.materials.append(mat2)
for o, c in ((body, (.62, .45, .32, 1)), (sword, (.75, .77, .8, 1))):
    for m in o.data.materials: m.diffuse_color = c
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 2.8
VIEWS = {'perfil': Vector((-1, 0, .08)), 'frente': Vector((0, -1, .08)), 'tres-quartos': Vector((-.7, -.7, .3))}
root_obj = bpy.data.objects.new('mover', None); sc.collection.objects.link(root_obj); arm.parent = root_obj   # o vídeo move o corpo pela curva
for name in (CLIPS if not os.environ.get('E4_SEM_VIDEO') else []):   # E4_SEM_VIDEO=1: só portões
    ex = EXTRAS[name]; act = bpy.data.actions[name]; arm.animation_data.action = act
    f0 = int(act.frame_range[0]); N = round(ex['duration'] * FPS); curve = ex['rootMotion'].get('curve', [0] * (N + 1))
    root_obj.animation_data_clear(); y0 = root_obj.location.y
    axis = ex['rootMotion'].get('axis', 'z'); root_obj.location = (0, y0, 0)
    for n in range(N + 1):
        if axis == 'z': root_obj.location.y = y0 - curve[n]; root_obj.keyframe_insert('location', index=1, frame=f0 + n)
        else: root_obj.location.x = curve[n]; root_obj.keyframe_insert('location', index=0, frame=f0 + n)
    sc.frame_start, sc.frame_end = f0, f0 + N
    c = Vector((0, -curve[-1] / 2, .85)) if ex['rootMotion'].get('axis', 'z') == 'z' else Vector((curve[-1] / 2, 0, .75))
    for vn, d in VIEWS.items():
        sc.render.image_settings.media_type = 'VIDEO'; sc.render.image_settings.file_format = 'FFMPEG'
        sc.render.ffmpeg.format = 'MPEG4'; sc.render.ffmpeg.codec = 'H264'
        cam.location = c + d.normalized() * 6; cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(REV, f'{name}_{vn}.mp4'); bpy.ops.render.render(animation=True)
    sc.render.image_settings.media_type = 'IMAGE'; sc.render.image_settings.file_format = 'PNG'
    marks = {'antecipacao': ex['phases'].get('anticipation', 0), 'contato': traj[name]['phases'].get('contact', 0), 'continuacao': ex['phases'].get('recovery', 0)}
    for lbl, tt in marks.items():
        sc.frame_set(f0 + round(tt * FPS))
        for vn in ('perfil', 'tres-quartos'):
            cam.location = c + VIEWS[vn].normalized() * 6; cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
            sc.render.filepath = os.path.join(REV, f'{name}_{vn}_{lbl}.png'); bpy.ops.render.render(write_still=True)
    root_obj.animation_data_clear(); root_obj.location = (0, y0, 0)
result['glb'] = {'bytes': os.path.getsize(GLB), 'sha256': hashlib.sha256(open(GLB, 'rb').read()).hexdigest()}
if not os.environ.get('E4_GLB'): json.dump(result, open(os.path.join(REV, 'portoes-e4-combate.json'), 'w'), indent=1, ensure_ascii=False)
print('VIOLACOES', result['violacoes'])
print('REVIEW_COMBATE_OK')
