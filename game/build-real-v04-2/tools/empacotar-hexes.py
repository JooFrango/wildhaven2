#!/usr/bin/env python3
"""V04 — Empacota cada hex certificado em um ZIP (physics/<id>-physics-v01/* + visual/<id>/*) para a release
`build-real-v04-hexes`, com índice hexes-v04.json (bytes + SHA-256). O servidor baixa sob demanda e confere.
Uso: python3 empacotar-hexes.py --physics .generated/physics-272-v04 --visual .generated/visual-272 \
       --relatorio game/build-real-v04/data/relatorio-continental-272-v04.json --out dist-hexes [--excluir HV_01,ER_18,...]"""
import argparse, hashlib, json, os, zipfile
ap = argparse.ArgumentParser()
ap.add_argument("--physics"); ap.add_argument("--visual"); ap.add_argument("--relatorio"); ap.add_argument("--out")
ap.add_argument("--excluir", default=""); ap.add_argument("--somente", default="")
a = ap.parse_args()
rel = json.load(open(a.relatorio, encoding="utf-8"))
cert = [t["id"] for t in rel["tiles"] if t["status"] == "certificado-tecnico"]
exc = set(filter(None, a.excluir.split(","))); som = set(filter(None, a.somente.split(",")))
os.makedirs(a.out, exist_ok=True)
nome = lambda t: t.replace("+", "p").replace("-", "m")
idx = {}
for t in sorted(cert):
    if t in exc or (som and t not in som): continue
    pd, vd = os.path.join(a.physics, f"{t}-physics-v01"), os.path.join(a.visual, t)
    if not os.path.isfile(os.path.join(pd, "index.json")) or not os.path.isfile(os.path.join(vd, "chunks.json")):
        print("ausente", t); continue
    zp = os.path.join(a.out, nome(t) + ".zip")
    with zipfile.ZipFile(zp, "w") as z:
        for root, sub, files in [(pd, "physics/" + f"{t}-physics-v01", None), (vd, "visual/" + t, None)]:
            for f in sorted(os.listdir(root)):
                full = os.path.join(root, f)
                if os.path.isfile(full):
                    # .gz e .glb/.bin já densos: guardados; JSON comprimido
                    comp = zipfile.ZIP_STORED if f.endswith((".gz", ".glb")) else zipfile.ZIP_DEFLATED
                    z.write(full, f"{sub}/{f}", compress_type=comp)
    b = open(zp, "rb").read()
    idx[t] = {"arquivo": os.path.basename(zp), "bytes": len(b), "sha256": hashlib.sha256(b).hexdigest()}
json.dump({"schema": "wildhaven.hexes.v04", "hexes": idx}, open(os.path.join(a.out, "hexes-v04.json"), "w"), indent=1)
print(len(idx), "pacotes;", round(sum(v["bytes"] for v in idx.values()) / 1048576), "MB")
