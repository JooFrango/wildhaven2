# Wildhaven — Megafauna da savana (primeiro protótipo animado v01)

Quatro artes conceituais aprovadas: **Torvardo** (grande pastador), **Raizauro** (réptil herbívoro escavador), **Mastélio** (grande frugívoro de focinho preênsil) e **Garruva** (réptil TERRESTRE necrófago). A Garruva ave está descartada. Os quatro GLBs **não** estão aprovados artisticamente neste estágio.

## Artefatos reais

- 12 GLBs em `models/{id}/{id}-savanna-animated-v01-LOD{0,1,2}.glb`, três por espécie.
- 12 PNGs `previews/{id}-real-3d-{side,front,three_quarter}-v01.png`, renderizados da geometria dos GLBs exportados, não de uma IA conceitual.
- Uma imagem comparativa formada unicamente desses 12 renders (`Wildhaven_Megafauna_4_Modelos_Reais_v01.png`).
- `models/{id}/{id}-manifest-v01.json`: triângulos reais, hashes SHA256, nome dos clipes, IDs e limites.
- `validation-report.json` confirma integridade dos arquivos e das animações.
- `viewer/index.html`: carregar GLBs, mudar LODs, escolher animações, orbitar o modelo e ativar wireframe.

## Modelagem e animações

A malha orgânica principal é **um único corpo conectado** gerado com SDF + marching cubes, com pesos de deformação e 17 juntas (19 no Mastélio, que tem dois pivôs adicionais de tromba). Detalhes anatômicos adicionais incluem chifres, casco, placas, escudos, escamas, bico, mandíbulas, dentes e pelos em geometria real. LODs são calculados por simplificação de quadrics e reatribuição das cores/pesos com transporte de atributos; mantêm os nomes e canais das animações do GLB original. Nada aqui edita criaturas existentes, a Alpha, mapas, sistemas ou ecossistema.

Clipes específicos: Torvardo 12, Raizauro 12, Mastélio 12, Garruva terrestre 13 (49 clipes distintos no LOD0). As animações são **in-place** e representam ciclos de movimentos; ainda não são animações AAA e não têm IK adaptativo de terreno ou física de contato.

## Reproduzir (Linux)

```bash
python3 -m pip install numpy==2.3.5 scipy==1.16.2 scikit-image==0.26.0 trimesh==4.11.1 vtk==9.6.2 pillow==11.3.0
xvfb-run -a python3 source/build_all.py
python3 source/validate.py
python3 source/make_sheet.py
python3 -m http.server 8000
```

Abra `http://localhost:8000/viewer/`. Os módulos Three.js são carregados de CDN.

## Regra de aprovação

- **Aprovação das artes conceituais não é aprovação dos modelos**.
- Os modelos ainda requerem revisão visual: em especial textura/escultura das jubas, placas, dobras, articulações, dentes e tromba.
- A prioridade é boa silhueta e baixo número de triângulos no gameplay, não representar fidelidade fotorrealista com uma malha simples.
- A publicação deve permanecer em PR de revisão; não mesclar nem substituir assets antigos sem consentimento do usuário.