#!/usr/bin/env python3
"""Validate exported real GLB 2.0 files and three LODs of four Wildhaven species."""
from pathlib import Path
import struct,json,hashlib,math,argparse
ROOT=Path(__file__).resolve().parents[1]
EXPECTED={
'sevilho':['idle','walk','scurry','hop','forage','store_seed','sniff','alert','flee','rest','death'],
'arbelio':['idle','walk','climb','leap','grip','forage','balance','alert','flee','rest','death'],
'frutavil':['idle','walk','hop','perch','peck','eat_fruit','wing_flap','short_flight','alert','rest','death'],
'cromatil':['idle','walk','scurry','bask','forage','head_tilt','tail_whip','threat','retreat','rest','death']}

def verify_glb(p):
    raw=p.read_bytes()
    assert raw[:4]==b'glTF' and len(raw)>3000,str(p)
    version,total=struct.unpack_from('<II',raw,4)
    assert (version,total)==(2,len(raw)),p
    start=12;parts=[]
    while start<len(raw):
        assert start+8<=len(raw)
        n,kind=struct.unpack_from('<I4s',raw,start);start+=8
        assert n%4==0 and start+n<=len(raw)
        parts.append((kind,raw[start:start+n]));start+=n
    assert len(parts)==2 and parts[0][0]==b'JSON' and parts[1][0]==b'BIN\x00'
    doc=json.loads(parts[0][1])
    assert doc['asset']['version']=='2.0'
    assert len(parts[1][1])==doc['buffers'][0]['byteLength']
    nodes=doc['nodes']; acc=doc['accessors']; views=doc['bufferViews']; clipl=[]
    for v in views:
        assert v['byteOffset']>=0 and v['byteOffset']+v['byteLength']<=len(parts[1][1])
    for a in acc:
        assert 0<=a['bufferView']<len(views) and a['count']>0
    tri=0
    for mesh in doc['meshes']:
        for prim in mesh['primitives']:
            assert prim['mode']==4 and prim['indices']<len(acc)
            assert prim['attributes']['POSITION']<len(acc)
            assert prim['attributes']['NORMAL']<len(acc)
            count=acc[prim['indices']]['count']; assert count%3==0
            assert acc[prim['attributes']['POSITION']]['count']>0
            tri+=count//3
    for a in doc['animations']:
        assert a['samplers'] and a['channels'];clipl.append(a['name'])
        for channel in a['channels']:
            target=channel['target'];assert 0<=target['node']<len(nodes)
            assert target['path'] in ('rotation','translation','scale')
            assert 0<=channel['sampler']<len(a['samplers'])
        for sampler in a['samplers']:
            assert sampler['input']<len(acc) and sampler['output']<len(acc)
            assert acc[sampler['input']]['count']==acc[sampler['output']]['count']
    assert len(nodes)>=13 and len(doc['meshes'])>=12
    assert len(clipl)==len(set(clipl))==11
    return raw,doc,tri,clipl

def main(root=ROOT):
    report={'assets':[],'totalGLBs':0,'totalTrianglesLOD0':0,'totalUniqueClips':0}
    for species,expected in EXPECTED.items():
        manifest=json.loads((root/'models'/species/f'{species}-manifest-v01.json').read_text())
        assert manifest['status']=='asset_for_art_review'
        assert len(manifest['LODs'])==3
        tris=[]
        for lod in range(3):
            path=root/'models'/species/f'{species}-savanna-animated-v01-LOD{lod}.glb'
            raw,g,tri,clips=verify_glb(path)
            info=manifest['LODs'][lod]
            assert info['path']==path.name and info['lod']==lod
            assert info['bytes']==len(raw)
            assert info['sha256']==hashlib.sha256(raw).hexdigest()
            assert info['triangleCount']==tri
            assert clips==expected==info['animationNames']
            tris.append(tri)
            report['assets'].append({'species':species,'lod':lod,'triangles':tri,'bytes':len(raw),'clips':clips,'nodes':len(g['nodes'])})
        assert tris[0]>tris[1]>tris[2],(species,tris)
        report['totalGLBs']+=3;report['totalTrianglesLOD0']+=tris[0];report['totalUniqueClips']+=len(expected)
        for view in ('front','side','three_quarter'):
            img=root/'previews'/f'{species}-real-3d-{view}-v01.png'
            assert img.stat().st_size>10000 and img.read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
    report['status']='PASS'
    (root/'validation-report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
    print(json.dumps({'status':report['status'],'GLBs':report['totalGLBs'],'LOD0_triangles':report['totalTrianglesLOD0'],'unique_clips':report['totalUniqueClips']},ensure_ascii=False))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--root',type=Path,default=ROOT);a=p.parse_args();main(a.root)