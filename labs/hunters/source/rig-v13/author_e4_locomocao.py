# E4, lote 1 — locomoção com espada no rig v13: guarda, andar, trote, corrida (plano PvE §4 e §10).
#   blender -b labs/hunters/assets/hunter-rig-v13/hunter_rig_v13_source.blend --python labs/hunters/source/rig-v13/author_e4_locomocao.py -- <raiz>
# Roda depois de build_hunter_rig_v13.py e salva o mesmo .blend com as ações novas.
#
# Método (plano §2 e §5): pernas por IK nos controles de pé (trilha exata no chão, rolamento calcanhar -> ponta com
# pivô no calcanhar e na bola do pé), resto do corpo por FK osso a osso. Cada cadeia tem fase própria: a pelve lidera,
# o tronco contra-gira atrasado, os braços balançam atrasados, a cabeça estabiliza o olhar. A mão da espada fica fixa no
# antebraço durante o ciclo (pronação constante, punho neutro): é a lâmina que segue o braço, nunca o contrário.
# Clipes "em lugar": o laboratório move o corpo; o pé plantado anda para trás à velocidade do clipe (stride nos extras).
import os, sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from e4_comum import *   # noqa: F401,F403 — utilitários, IK de pé, guarda
ARM_FREE = lambda swing, elbow, amp: {'swing': swing, 'lower': 72, 'abd': 6, 'clav': 3, 'elbow': elbow, 'elbowAmp': amp, 'pron': 10}
CLIPS = {
    'pve2_a_sword_walk': dict(module='a', frames=50, v=1.4, duty=.62, reach=-.065, flat=.25, heelOff=.62, heel=14, toeOff=28, lift=.07, swingPitch=6,
        width=.0, bob=.022, drop=-.03, sway=.022, yaw=5, list=4, lean=5, counter=6, breath=0,
        armL=ARM_FREE(22, 22, 8), armR={**ARM_FREE(12, 20, 4), 'lower': 74}, blade=(0, -.8, -.6)),
    'pve2_a_sword_jog': dict(module='a', frames=35, v=3.1, duty=.42, reach=-.075, flat=.22, heelOff=.5, heel=10, toeOff=32, lift=.13, swingPitch=10,
        width=-.01, bob=.035, drop=-.05, sway=.012, yaw=7, list=4, lean=13, counter=9, breath=0,
        armL=ARM_FREE(32, 75, 14), armR={**ARM_FREE(18, 50, 8), 'lower': 70}, blade=(0, -.92, -.4)),
    'pve2_a_sword_run': dict(module='a', frames=34, v=5.6, duty=.25, reach=-.08, flat=.24, heelOff=.42, heel=6, toeOff=34, lift=.22, swingPitch=16,
        width=-.02, bob=.05, drop=-.08, sway=.008, yaw=9, list=3, lean=22, counter=12, breath=0,
        armL=ARM_FREE(48, 88, 18), armR={**ARM_FREE(26, 80, 10), 'lower': 66}, blade=(-.26, .7, -.66), reverse=True),   # pegada reversa: lâmina para trás, para baixo e um pouco para fora (livra a coxa)
}
made = []
for name, G in CLIPS.items():
    arm.animation_data.action = bpy.data.actions.new('_tmp')
    for c_b, c_n in CONS: P[c_b].constraints[c_n].influence = 1
    err, pr = solve_pron(G, Vector(G['blade'])); arm.animation_data.action = bpy.data.actions['_tmp']
    bpy.data.actions.remove(arm.animation_data.action)
    act = key_gait(name, G); made.append(act)
    act['bladeCarry'] = {'grip': 'reverse' if G.get('reverse') else 'normal', 'targetDir': list(G['blade']), 'wrist': pr, 'errorDeg': round(math.degrees(err), 1)}
    print('CLIP', name, 'frames', G['frames'], 'stride', round(G['v'] * G['frames'] / FPS, 3), 'pron', pr, 'erroLamina', round(math.degrees(err), 1))

# ---------- guarda (laço de 3 s): base em pé de luta, respiração e transferência de peso ----------
act = bpy.data.actions.new('pve2_b_sword_guard'); arm.animation_data.action = act
N = 180
for f in range(0, N + 1, 4): key_guard(f / N, f + 1)
act['contract'] = 'hunter-pve-v02'; act['module'] = 'b'; act['weapon'] = 'sword'; act['loop'] = True; act['fps'] = FPS; act['duration'] = N / FPS
act['footContacts'] = {'left': [[0, N / FPS]], 'right': [[0, N / FPS]]}; act['rootMotion'] = {'mode': 'none'}; act['motion'] = 'in-place'
made.append(act)

# a ação de estresse continua FK: influência 0 explícita para o exportador não herdar o valor de outra ação
st = bpy.data.actions['rig13_stress']; st.use_fake_user = True; arm.animation_data.action = st   # sem usuário ela não seria salva
for f in bpy.context.scene['rig13_stress_frames']:
    for c_b, c_n in CONS: P[c_b].constraints[c_n].influence = 0; P[c_b].constraints[c_n].keyframe_insert('influence', frame=f)
    key_socket({}, f)   # socket em repouso na ação de estresse
for a in made:   # curvas lineares entre chaves densas; laço: extrapolação cíclica
    a.use_fake_user = True
bpy.context.scene['e4_clips'] = [a.name for a in made]
# medida rápida do IK de perna (o portão completo roda no GLB exportado, em review_e4_locomocao.py)
for a in made:
    arm.animation_data.action = a; f0, f1 = map(int, a.frame_range); worst = 0; knee = [180, 0]
    for f in range(f0, f1 + 1):
        bpy.context.scene.frame_set(f)
        for s in SIDES:
            e_ = (P[s + 'Foot'].head - P['CTRL_ankle_ik.' + s].head).length
            if e_ > worst: worst = e_; wf = (f, s, round((P['CTRL_ankle_ik.' + s].head - P[s + 'UpLeg'].head).length, 3))
            k = math.degrees((P[s + 'UpLeg'].head - P[s + 'Leg'].head).angle(P[s + 'Foot'].head - P[s + 'Leg'].head)); knee = [min(knee[0], k), max(knee[1], k)]
    print('IK', a.name, 'erro tornozelo mm', round(worst * 1000, 1), 'pior (quadro, lado, dist quadril-alvo)', wf if worst else None, 'joelho (ângulo interno) graus', [round(x) for x in knee])
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'hunter_rig_v13_source.blend'))
print('AUTHOR_OK', [a.name for a in made])
