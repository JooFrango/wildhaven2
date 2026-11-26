# Wildhaven — Fulgaronte v01 (blockout de forma)

**Etapa:** conceito aprovado pelo diretor em 2026-11-15, anatomia/blockout **em revisão**.

Grande predador quadrúpede semiaquático de aproximadamente 5 m de altura e 16 m de comprimento, raríssimo, territorial, habitat extremo norte glacial. Dieta carnívora. É um protótipo ficcional para Wildhaven, diferente do Caudraco desértico e do Brejáveo tropical.

## Binário e prévias reais

- `fulgaronte_v01_blockout.glb`: GLB 2.0 real, 1 malha, 3.124 faces triangulares, textura UV PBR embutida.
- `fulgaronte_v01_uv_atlas.png`: mapa UV pintado para cor e manchas (não criar polígonos para padrões de pintura).
- `previews/fulgaronte_v01_real_glb_{perfil,frente,tres_quartos}.png`: três renders obtidos do GLB exportado e reimportado pelo VTK.
- `previews/Fulgaronte_v01_3_Vistas_GLb_Real.png`: prancha dos três renders.
- `manifest.json`: identificação da versão e SHA-256 medido do GLB.
- `source/build.py`: fonte de geometria e texturas; `source/render.py`: renders do GLB; `source/validate.py`: validação independente.

## Escopo e limitações

- Referência visual original enviada pelo diretor + concept art Fulgaronte aprovada.
- Prioridade geométrica: cabeça crocodiliana, couraça facetada, quatro patas musculosas, membranas anteriores estruturais e cauda com nadadeira.
- Medidas do GLB verificadas: 5,10 m de altura, 16,0 m de comprimento, 4,50 m de largura máxima.
- **Sem rig, skins, animações, LODs separados, VFX ou lógica elétrica/combate.** A descarga explosiva foi aprovada como ideia de ecologia, mas seu efeito visual/simulação será tratado em etapa própria.
- Pinturas e manchas exclusivamente no atlas UV; elementos de estrutura anatômica, como placas e nadadeiras, são geometria.
- Não integra, executa nem modifica `game/alpha01` e não modifica o mapa.
- **Não refinar ou iniciar rig** antes de aprovação específica da forma pelo diretor.

## Reprodução local

```bash
pip install numpy Pillow trimesh vtk
python source/build.py
python source/validate.py
python source/render.py
```

A publicação dos binários no GitHub só será considerada concluída após verificação de correspondência dos arquivos do repositório com os arquivos exportados.
