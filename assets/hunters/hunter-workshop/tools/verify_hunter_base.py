#!/usr/bin/env python3
"""Confere arquivos GLB e PNG locais com o manifesto, sem alterar os binarios."""
import hashlib, json, struct
from pathlib import Path
BASE = Path(__file__).resolve().parent.parent / "base" / "hunter-masculino-1000v"
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def verify():
    m = json.loads((BASE / "manifest.json").read_text(encoding="utf8"))
    gp = BASE / m["model"]["path"]; tp = BASE / m["texture"]["path"]
    assert gp.exists() and tp.exists(), "GLB/PNG originais ainda nao foram publicados neste checkout"
    glb = gp.read_bytes(); png = tp.read_bytes()
    assert glb[:4] == b"glTF" and struct.unpack_from("<I",glb,4)[0] == 2
    assert struct.unpack_from("<I",glb,8)[0] == len(glb)
    assert len(glb)==m["model"]["bytes"] and sha(gp)==m["model"]["sha256"]
    assert len(png)==m["texture"]["bytes"] and sha(tp)==m["texture"]["sha256"]
    size, kind = struct.unpack_from("<I4s",glb,12)
    assert kind == b"JSON"
    doc=json.loads(glb[20:20+size])
    ofs=20+size; binlen,bintype=struct.unpack_from("<I4s",glb,ofs)
    assert bintype == b"BIN\x00"
    blob=glb[ofs+8:ofs+8+binlen]
    view=doc["bufferViews"][doc["images"][0]["bufferView"]]
    embedded=blob[view.get("byteOffset",0):view.get("byteOffset",0)+view["byteLength"]]
    assert embedded==png, "PNG difere da textura embutida"
    p=doc["meshes"][0]["primitives"][0]
    assert doc["accessors"][p["attributes"]["POSITION"]]["count"]==m["model"]["verticesExported"]
    assert doc["accessors"][p["indices"]]["count"]//3==m["model"]["triangles"]
    joints=[doc["nodes"][i]["name"] for skin in doc["skins"] for i in skin["joints"]]
    assert joints==m["skeleton"]["jointNames"]
    assert [a["name"] for a in doc["animations"]]==m["model"]["animationClips"]
    print("OK: 1000 triangulos, 19 ossos, Running/Walking e textura embutida intacta")
if __name__=="__main__": verify()
