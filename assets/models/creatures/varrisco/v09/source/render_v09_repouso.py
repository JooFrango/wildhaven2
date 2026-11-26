"""Varrisco v09 — perfil, frente e três-quartos do GLB exportado (pose de repouso, cores por vértice), lado a lado
com a arte conceitual. blender -b --factory-startup --python render_v09_repouso.py [-- <glb> <png_saida>]
"""
import bpy, sys
from pathlib import Path
import numpy as np
from mathutils import Vector

DIR = Path(__file__).resolve().parent.parent
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
GLB = Path(ARGS[0]) if ARGS else DIR / 'varrisco-animated-v09-LOD0.glb'
OUT = Path(ARGS[1]) if len(ARGS) > 1 else DIR / 'previews' / 'repouso-vs-conceito.png'
CONCEITO = DIR.parent / 'referencias' / 'varrisco-arte-conceitual.webp'

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=str(GLB))
for o in bpy.data.objects:
    if o.type != 'MESH' or not o.find_armature(): o.hide_render = True
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
if arm.animation_data: arm.animation_data.action = None
for pb in arm.pose.bones: pb.matrix_basis.identity()
sc.render.engine = 'BLENDER_WORKBENCH'
sh = sc.display.shading
sh.light = 'STUDIO'; sh.show_shadows = False
for tipo in ('VERTEX', 'ATTRIBUTE'):
    try: sh.color_type = tipo; break
    except TypeError: pass
sc.view_settings.view_transform = 'Standard'
sc.render.resolution_x, sc.render.resolution_y = 520, 360
sc.render.film_transparent = False
sc.world = sc.world or bpy.data.worlds.new('w'); sc.world.color = (.85, .82, .76)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 3.6

tiles = []
for nome, loc, esc in (('perfil', (0, -8, .8), 3.6), ('frente', (8, 0, .8), 2.2), ('tres_quartos', (5.5, -5.5, 2.6), 3.6)):
    cam.location = loc; cam.data.ortho_scale = esc
    cam.rotation_euler = (Vector((-.1, 0, .75)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    p = OUT.parent / f'_{nome}.png'; sc.render.filepath = str(p); bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(str(p)); tiles.append(np.array(img.pixels[:]).reshape(img.size[1], img.size[0], 4)); bpy.data.images.remove(img)
    p.unlink()
linha = np.concatenate(tiles, axis=1)
if CONCEITO.exists():
    ci = bpy.data.images.load(str(CONCEITO)); w, h = ci.size
    arr = np.array(ci.pixels[:]).reshape(h, w, 4)
    H = linha.shape[0] * 2; W = linha.shape[1]
    ys = (np.arange(H) * h / H).astype(int); xs = (np.arange(W) * w / W).astype(int)
    conceito = arr[ys][:, xs]
    linha = np.concatenate([conceito, linha], axis=0)  # pixels do Blender: linha 0 é a de baixo
im = bpy.data.images.new('saida', linha.shape[1], linha.shape[0]); im.pixels = linha.ravel().tolist()
im.filepath_raw = str(OUT); im.file_format = 'PNG'; im.save()
print('ok', OUT)
