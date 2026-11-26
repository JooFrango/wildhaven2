"""Assemble a temporary background from the real continental terrain, excluding pilot neighbours in the viewer."""
from perimeter import WORLD, TILES, GLB, colors
from forest import Writer
import numpy as np
from scipy.spatial import Delaunay

def prepare_background(path):
    atlas=GLB(WORLD/'world-visual-coherence-v12/models/world_170_v12.glb')
    w=Writer()
    for tile in TILES:
        name=tile['id'];local=False
        if tile.get('regionId')=='tropical-south':
            g=GLB(WORLD/'tropical-south-v01/models'/(name+'.glb'));pr=g.primitive(name);local=True
        elif name=='HV_01':
            g=GLB(WORLD/'hunters-village-v01/models/hv_01_terrain_lod1.glb');pr=g.doc['meshes'][0]['primitives'][0];local=True
        else:
            g=atlas;pr=g.primitive(name+'__terrain')
        v=g.array(pr['attributes']['POSITION']).astype(float)
        c=colors(g,pr);f=g.array(pr['indices']).reshape(-1,3)
        if local:
            v[:,[0,2]]+=[tile['center_x'],tile['center_z']]
        mesh=w.mesh(name,v,f,c)
        w.node(name=name,mesh=mesh,extras={'tileId':name})
    w.save(path)
