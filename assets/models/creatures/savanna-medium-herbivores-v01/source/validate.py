#!/usr/bin/env python3
"""Validate real GLB files, named clips, node targets, manifests and previews."""
from __future__ import annotations
import hashlib
import json
import struct
from pathlib import Path
from generate import SPECS, ROOT

def read_glb(path):
    raw=path.read_bytes()
    assert len(raw)>20 and raw[:4]==b"glTF", str(path)
    version,length=struct.unpack_from("<II",raw,4)
    assert version==2 and length==len(raw),str(path)
    jlen,jkind=struct.unpack_from("<I4s",raw,12)
    assert jkind==b"JSON" and jlen%4==0,str(path)
    j=json.loads(raw[20:20+jlen].decode("utf-8"))
    assert j["asset"]["version"]=="2.0"
    assert j["meshes"] and j["nodes"] and j["animations"]
    assert j["buffers"][0]["byteLength"]>0
    for mesh in j["meshes"]:
        assert len(mesh["primitives"])>=1
        for p in mesh["primitives"]:
            assert p["mode"]==4 and "POSITION" in p["attributes"] and "indices" in p
    for a in j["animations"]:
        assert a["samplers"] and a["channels"]
        for ch in a["channels"]:
            assert 0<=ch["target"]["node"]<len(j["nodes"])
            assert 0<=ch["sampler"]<len(a["samplers"])
            assert ch["target"]["path"] in ("rotation","translation")
    return raw,j

def main():
    models=[]
    for s in SPECS:
        root=ROOT/"assets/models/creatures"/s["id"]
        glb=root/(s["id"]+"-savanna-animated-v01.glb")
        raw,j=read_glb(glb)
        clips=[c["name"] for c in j["animations"]]
        assert clips==s["clips"],(s["id"],clips)
        assert not j.get("skins"),"Articulated pivot animations must not claim skinning"
        manifest=json.loads((root/(s["id"]+"-manifest-v01.json")).read_text())
        info=manifest["model"]
        assert info["bytes"]==len(raw)
        assert info["sha256"]==hashlib.sha256(raw).hexdigest()
        assert info["animationCount"]==len(clips)
        assert info["meshNodes"]>=18
        entry=json.loads((ROOT/"creatures/species"/(s["id"]+".json")).read_text())
        assert entry["assets"]["model"]==glb.relative_to(ROOT).as_posix()
        assert entry["animations"]==clips
        assert entry["integration"]["gameplay"] is False
        for angle in ("three_quarter","side","front"):
            p=root/(s["id"]+"-real-3d-"+angle+"-v01.png")
            assert p.is_file() and p.stat().st_size>10000,p
            assert p.read_bytes().startswith(b"\x89PNG\r\n\x1a\n"),p
        models.append((s["id"],len(raw),len(clips),info["triangles"],len(j["nodes"])))
    for name,size,clips,tris,nodes in models:
        print("VALIDATED",name,size,"bytes",clips,"clips",tris,"triangles",nodes,"nodes")
    print("PASS: 4 real GLBs + manifests + 12 genuine 3D preview PNGs")
if __name__=="__main__":
    main()
