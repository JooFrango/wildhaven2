"""Varrisco v05 — reimporta o GLB exportado no Blender, mede pés/chão e gera folhas de quadros.

blender -b --factory-startup --python assets/models/creatures/varrisco/v05/source/render_v05_blender.py
Saída: v05/previews/<clipe>.png (6 quadros, perfil; tail_sweep e roar também em três-quartos) e
v05/previews/qa.json (altura mínima da malha, deslize dos tornozelos nos trechos plantados).
Outra versão: ... --python render_v05_blender.py -- <glb> <pasta_saida> <clipe1,clipe2,...> (v06 usa assim).
"""
import bpy, json, math, sys
from pathlib import Path
import numpy as np
from mathutils import Vector

DIR = Path(__file__).resolve().parent.parent
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
GLB = Path(ARGS[0]) if ARGS else DIR / 'varrisco-animated-v05-LOD0.glb'
OUT = Path(ARGS[1]) if ARGS else DIR / 'previews'; OUT.mkdir(exist_ok=True)
CLIPS = ARGS[2].split(',') if ARGS else ['bite', 'bite_heavy', 'claw_right', 'claw_slash', 'double_claw', 'pounce', 'jump_land', 'body_slam', 'roar', 'tail_sweep', 'limp']

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = 30
bpy.ops.import_scene.gltf(filepath=str(GLB))
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
mesh = next(o for o in bpy.data.objects if o.type == 'MESH' and o.find_armature() == arm)
for o in bpy.data.objects:
    if o not in (arm, mesh): o.hide_render = True
arm.hide_render = True
mat = bpy.data.materials.new('chao'); mat.diffuse_color = (.55, .5, .42, 1)
bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0)); bpy.context.object.data.materials.append(mat)

sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'MATERIAL'
sc.display.shading.show_shadows = True
sc.render.resolution_x, sc.render.resolution_y = 420, 300
sc.render.film_transparent = False
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 3.8

def aim(loc, target=(0, 0, .8)):
    cam.location = loc
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()

def set_action(name):
    act = next(a for a in bpy.data.actions if a.name == name or a.name.startswith(name + '_'))
    ad = arm.animation_data or arm.animation_data_create()
    ad.action = act
    if getattr(act, 'slots', None) and hasattr(ad, 'action_slot'): ad.action_slot = act.slots[0]
    f0, f1 = act.frame_range
    return int(round(f0)), int(round(f1))

def mesh_min_z():
    dg = bpy.context.evaluated_depsgraph_get(); ev = mesh.evaluated_get(dg); me = ev.to_mesh()
    co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get('co', co)
    mw = np.array(ev.matrix_world); z = (co.reshape(-1, 3) @ mw[:3, :3].T + mw[:3, 3])[:, 2]
    ev.to_mesh_clear(); return float(z.min())

def ankle(side):
    pb = arm.pose.bones['foot' + side]; return arm.matrix_world @ pb.head

qa = {}
for clip in CLIPS:
    f0, f1 = set_action(clip)
    zs, ank = [], {'L': [], 'R': []}
    for f in range(f0, f1 + 1):
        sc.frame_set(f); zs.append(mesh_min_z())
        for s in 'LR': ank[s].append(ankle(s))
    # deslize: deslocamento horizontal do tornozelo entre quadros consecutivos com o tornozelo baixo (<3 cm do repouso)
    slide = {}
    for s in 'LR':
        z0 = ank[s][0].z; d = 0.
        for a, b in zip(ank[s], ank[s][1:]):
            if a.z < z0 + .03 and b.z < z0 + .03: d = max(d, math.hypot(b.x - a.x, b.y - a.y))
        slide[s] = round(d, 4)
    qa[clip] = {'frames': f1 - f0 + 1, 'mesh_min_z_m': [round(min(zs), 3), round(max(zs), 3)], 'ankle_max_slide_per_frame_m': slide}
    views = [('perfil', (0, -8, .9))] + ([('tres_quartos', (5.5, -5.5, 2.4))] if clip in ('tail_sweep', 'roar', 'body_slam', 'bite_turn_l', 'bite_turn_r', 'backstep_tail', 'sickle_kick') else [])
    for vname, loc in views:
        aim(loc)
        frames = np.linspace(f0, f1, 6).round().astype(int)
        tiles = []
        for f in frames:
            sc.frame_set(int(f)); p = OUT / f'_tmp.png'; sc.render.filepath = str(p)
            bpy.ops.render.render(write_still=True)
            img = bpy.data.images.load(str(p)); px = np.array(img.pixels[:]).reshape(img.size[1], img.size[0], 4)
            tiles.append(px); bpy.data.images.remove(img)
        sheet = np.concatenate([np.concatenate(tiles[:3], axis=1), np.concatenate(tiles[3:], axis=1)][::-1], axis=0)
        h, w = sheet.shape[:2]
        im = bpy.data.images.new(f'{clip}_{vname}', w, h); im.pixels = sheet.ravel().tolist()
        im.filepath_raw = str(OUT / f'{clip}{"" if vname == "perfil" else "_" + vname}.png'); im.file_format = 'PNG'; im.save()
(OUT / '_tmp.png').unlink(missing_ok=True)
(OUT / 'qa.json').write_text(json.dumps(qa, indent=1) + '\n')
print('QA', json.dumps(qa))
